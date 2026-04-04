import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext, s } from '../../../../_utils';
import {
  buildSwipeIdeasContextText,
  buildSwipeIdeasSystemText,
  ensureSwipeIdeasThread,
  isUuid,
  loadSwipeIdeasContextOrThrow,
  loadSwipeIdeasDigestTopicContext,
  loadSwipeIdeasMasterPrompt,
  normalizeSwipeIdeasChatMode,
  sanitizePrompt,
  type SwipeIdeasChatMode,
} from '../_shared';

export const runtime = 'nodejs';
export const maxDuration = 120;

type IdeaCardOut = { title: string; slides: string[]; angleText: string };
type OpeningSlidesCardOut = { title: string; slide1: string; slide2: string; angleText: string };
type CardOut = IdeaCardOut | OpeningSlidesCardOut;

type Resp =
  | { success: true; assistantMessage: string; cards: CardOut[]; threadId: string; sourceMessageId: string }
  | { success: false; error: string };

function normalizeSlideOutline(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => String(x ?? '')).slice(0, 6);
}

function stripMarkdownCodeFences(text: string): string {
  const raw = String(text || '').trim();
  if (!raw.startsWith('```')) return raw;
  const match = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1] ? String(match[1]).trim() : raw;
}

function extractFirstBalancedJsonObject(text: string): string {
  const raw = String(text || '');
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (start === -1) {
      if (ch === '{') {
        start = i;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  throw new Error('Model did not return a balanced JSON object');
}

function extractJsonObject(text: string): any {
  const trimmed = String(text || '').trim();
  const unfenced = stripMarkdownCodeFences(trimmed);

  try {
    return JSON.parse(unfenced);
  } catch {
    // fall through to balanced-object extraction
  }

  const jsonSlice = extractFirstBalancedJsonObject(unfenced);
  return JSON.parse(jsonSlice);
}

function assertIdeasCards(payload: any): { assistantMessage: string; cards: IdeaCardOut[] } {
  const assistantMessage = typeof payload?.assistantMessage === 'string' ? payload.assistantMessage : '';
  const cardsIn = payload?.cards;
  if (!Array.isArray(cardsIn) || cardsIn.length < 1) throw new Error('Invalid output: cards must be a non-empty array');
  const cards: IdeaCardOut[] = cardsIn.slice(0, 12).map((c: any, idx: number) => {
    const title = String(c?.title || '').trim();
    const angleText = String(c?.angleText || '').trim();
    const slidesIn = c?.slides;
    const slides = Array.isArray(slidesIn) ? slidesIn.map((x: any) => String(x ?? '')).slice(0, 6) : [];
    if (!title) throw new Error(`Invalid card ${idx + 1}: title missing`);
    if (!angleText) throw new Error(`Invalid card ${idx + 1}: angleText missing`);
    if (slides.length !== 6) throw new Error(`Invalid card ${idx + 1}: slides must be length 6`);
    return { title, angleText, slides };
  });
  return { assistantMessage: String(assistantMessage || '').trim(), cards };
}

function assertOpeningSlidesCards(payload: any): { assistantMessage: string; cards: OpeningSlidesCardOut[] } {
  const assistantMessage = typeof payload?.assistantMessage === 'string' ? payload.assistantMessage : '';
  const cardsIn = payload?.cards;
  if (!Array.isArray(cardsIn) || cardsIn.length < 1) throw new Error('Invalid output: cards must be a non-empty array');
  const cards: OpeningSlidesCardOut[] = cardsIn.slice(0, 12).map((c: any, idx: number) => {
    const title = String(c?.title || '').trim();
    const angleText = String(c?.angleText || '').trim();
    const slide1 = String(c?.slide1 || '').trim();
    const slide2 = String(c?.slide2 || '').trim();
    if (!title) throw new Error(`Invalid card ${idx + 1}: title missing`);
    if (!angleText) throw new Error(`Invalid card ${idx + 1}: angleText missing`);
    if (!slide1) throw new Error(`Invalid card ${idx + 1}: slide1 missing`);
    if (!slide2) throw new Error(`Invalid card ${idx + 1}: slide2 missing`);
    return { title, angleText, slide1, slide2 };
  });
  return { assistantMessage: String(assistantMessage || '').trim(), cards };
}

async function callAnthropicJson(args: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 90_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: typeof args.max_tokens === 'number' ? args.max_tokens : 2600,
        temperature: typeof args.temperature === 'number' ? args.temperature : 0.2,
        system: args.system,
        messages: args.messages,
      }),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || JSON.stringify(json)?.slice(0, 500) || 'Unknown Anthropic error';
      throw new Error(`Anthropic error (${res.status}): ${msg}`);
    }
    const content0 = json?.content?.[0];
    const text = content0?.text || '';
    return { rawText: String(text || ''), model };
  } finally {
    clearTimeout(t);
  }
}

function parseCardsFromRaw(rawText: string, chatMode: SwipeIdeasChatMode): { assistantMessage: string; cards: CardOut[] } {
  const payload = extractJsonObject(rawText);
  return chatMode === 'opening_slides' ? assertOpeningSlidesCards(payload) : assertIdeasCards(payload);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthedSwipeContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, user, accountId } = auth;

    const { id } = await ctx.params;
    const swipeItemId = String(id || '').trim();
    if (!swipeItemId || !isUuid(swipeItemId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
    }

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const content = String(s(body?.content) || '').trim();
    const chatMode = normalizeSwipeIdeasChatMode(body?.chatMode);
    const sourceDigestTopicId = String(body?.sourceDigestTopicId || '').trim();
    if (!content) return NextResponse.json({ success: false, error: 'Missing content' } satisfies Resp, { status: 400 });
    if (content.length > 10_000) return NextResponse.json({ success: false, error: 'Message too long' } satisfies Resp, { status: 400 });
    if (sourceDigestTopicId && !isUuid(sourceDigestTopicId)) {
      return NextResponse.json({ success: false, error: 'Invalid sourceDigestTopicId' } satisfies Resp, { status: 400 });
    }

    let swipeContext;
    try {
      swipeContext = await loadSwipeIdeasContextOrThrow({ supabase, accountId, swipeItemId });
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to load swipe item');
      const status = msg === 'Not found' ? 404 : 400;
      return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
    }

    const { brandVoice, masterPrompt } = await loadSwipeIdeasMasterPrompt({ supabase, accountId, chatMode });
    const digestTopicContext = sourceDigestTopicId
      ? await loadSwipeIdeasDigestTopicContext({ supabase, accountId, sourceDigestTopicId })
      : null;

    const threadId = await ensureSwipeIdeasThread({
      supabase,
      accountId,
      userId: user.id,
      swipeItemId,
      chatMode,
      sourceDigestTopicId: sourceDigestTopicId || null,
    });

    // Persist user message.
    const { error: userMsgErr } = await supabase.from('swipe_file_idea_messages').insert({
      account_id: accountId,
      thread_id: threadId,
      created_by_user_id: user.id,
      role: 'user',
      content: sanitizePrompt(content),
    } as any);
    if (userMsgErr) return NextResponse.json({ success: false, error: userMsgErr.message } satisfies Resp, { status: 500 });

    // Load recent history (latest 24 messages).
    const { data: historyRows, error: historyErr } = await supabase
      .from('swipe_file_idea_messages')
      .select('role, content, created_at')
      .eq('account_id', accountId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(24);
    if (historyErr) return NextResponse.json({ success: false, error: historyErr.message } satisfies Resp, { status: 500 });

    const history = (Array.isArray(historyRows) ? (historyRows as any[]) : [])
      .map((r) => ({
        role: String(r.role) === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: String(r.content || ''),
      }))
      .reverse();

    const systemText = buildSwipeIdeasSystemText({ masterPrompt });
    const contextText = buildSwipeIdeasContextText({ brandVoice, context: swipeContext, digestTopicContext });
    const system = sanitizePrompt([systemText, contextText].filter(Boolean).join('\n\n'));

    const anthropic = await callAnthropicJson({ system, messages: history, temperature: 0.2, max_tokens: 2600 });

    // Robustness: Claude may occasionally return non-JSON on follow-ups. Retry once with stricter instructions.
    const parsed = await (async () => {
      try {
        return parseCardsFromRaw(anthropic.rawText, chatMode);
      } catch {
        const retrySystem =
          system +
          '\n\n' +
          sanitizePrompt(
            [
              'FORMAT_ERROR: Your previous response was invalid.',
              'Return ONLY the JSON object in the required shape. No other text.',
            ].join('\n')
          );
        const retry = await callAnthropicJson({ system: retrySystem, messages: history, temperature: 0, max_tokens: 2200 });
        return parseCardsFromRaw(retry.rawText, chatMode);
      }
    })();

    const assistantMessage = parsed.assistantMessage || 'Here are some ideas. Tell me which direction you like.';

    // Persist assistant message.
    const { data: assistantRow, error: assistantErr } = await supabase
      .from('swipe_file_idea_messages')
      .insert({
        account_id: accountId,
        thread_id: threadId,
        created_by_user_id: user.id,
        role: 'assistant',
        content: sanitizePrompt(assistantMessage),
      } as any)
      .select('id')
      .single();
    if (assistantErr) return NextResponse.json({ success: false, error: assistantErr.message } satisfies Resp, { status: 500 });

    const sourceMessageId = String((assistantRow as any)?.id || '').trim();
    if (!sourceMessageId) {
      return NextResponse.json({ success: false, error: 'Failed to persist assistant message' } satisfies Resp, { status: 500 });
    }

    const draftRows = parsed.cards.map((c) => {
      const slideOutline =
        chatMode === 'opening_slides'
          ? normalizeSlideOutline([(c as OpeningSlidesCardOut).slide1, (c as OpeningSlidesCardOut).slide2])
          : normalizeSlideOutline((c as IdeaCardOut).slides);
      return {
        account_id: accountId,
        swipe_item_id: swipeItemId,
        thread_id: threadId,
        source_message_id: sourceMessageId,
        created_by_user_id: user.id,
        title: String(c.title || '').trim().slice(0, 240),
        slide_outline: slideOutline as any,
        angle_text: String(c.angleText || '').trim(),
      };
    });

    const { error: draftErr } = await supabase.from('swipe_file_idea_drafts').insert(draftRows as any);
    if (draftErr) return NextResponse.json({ success: false, error: draftErr.message } satisfies Resp, { status: 500 });

    return NextResponse.json({
      success: true,
      assistantMessage,
      cards: parsed.cards,
      threadId,
      sourceMessageId,
    } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}

