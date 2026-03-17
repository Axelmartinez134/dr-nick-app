import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext, s } from '../../../../_utils';
import {
  buildSwipeIdeasContextText,
  buildSwipeIdeasSystemText,
  isUuid,
  loadSwipeIdeasContextOrThrow,
  loadSwipeIdeasMasterPrompt,
  sanitizePrompt,
} from '../_shared';

export const runtime = 'nodejs';
export const maxDuration = 120;

type CardOut = { title: string; slides: string[]; angleText: string };

type Resp =
  | { success: true; assistantMessage: string; cards: CardOut[]; threadId: string; sourceMessageId: string }
  | { success: false; error: string };

function normalizeSlideOutline(input: any): string[] {
  if (!Array.isArray(input)) return [];
  const out = input.map((x) => String(x ?? '')).slice(0, 6);
  return out.length === 6 ? out : [];
}

function extractJsonObject(text: string): any {
  const raw = String(text || '');
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('Model did not return JSON');
  return JSON.parse(raw.slice(first, last + 1));
}

function assertCards(payload: any): { assistantMessage: string; cards: CardOut[] } {
  const assistantMessage = typeof payload?.assistantMessage === 'string' ? payload.assistantMessage : '';
  const cardsIn = payload?.cards;
  if (!Array.isArray(cardsIn) || cardsIn.length < 1) throw new Error('Invalid output: cards must be a non-empty array');
  const cards: CardOut[] = cardsIn.slice(0, 12).map((c: any, idx: number) => {
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

function parseCardsFromRaw(rawText: string): { assistantMessage: string; cards: CardOut[] } {
  const payload = extractJsonObject(rawText);
  return assertCards(payload);
}

async function ensureThread(args: { supabase: any; accountId: string; userId: string; swipeItemId: string }): Promise<string> {
  const { supabase, accountId, userId, swipeItemId } = args;
  const { data: existing, error: exErr } = await supabase
    .from('swipe_file_idea_threads')
    .select('id')
    .eq('account_id', accountId)
    .eq('swipe_item_id', swipeItemId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  const existingId = String((existing as any)?.id || '').trim();
  if (existingId) return existingId;

  const { data: inserted, error: insErr } = await supabase
    .from('swipe_file_idea_threads')
    .insert({ account_id: accountId, swipe_item_id: swipeItemId, created_by_user_id: userId } as any)
    .select('id')
    .maybeSingle();
  if (insErr) {
    const code = (insErr as any)?.code;
    if (code !== '23505') throw new Error(insErr.message);
  }
  const insertedId = String((inserted as any)?.id || '').trim();
  if (insertedId) return insertedId;

  const { data: reread, error: rrErr } = await supabase
    .from('swipe_file_idea_threads')
    .select('id')
    .eq('account_id', accountId)
    .eq('swipe_item_id', swipeItemId)
    .maybeSingle();
  if (rrErr) throw new Error(rrErr.message);
  const rereadId = String((reread as any)?.id || '').trim();
  if (!rereadId) throw new Error('Failed to create idea thread');
  return rereadId;
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
    if (!content) return NextResponse.json({ success: false, error: 'Missing content' } satisfies Resp, { status: 400 });
    if (content.length > 10_000) return NextResponse.json({ success: false, error: 'Message too long' } satisfies Resp, { status: 400 });

    let swipeContext;
    try {
      swipeContext = await loadSwipeIdeasContextOrThrow({ supabase, accountId, swipeItemId });
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to load swipe item');
      const status = msg === 'Not found' ? 404 : 400;
      return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
    }

    const { brandVoice, masterPrompt } = await loadSwipeIdeasMasterPrompt({ supabase, accountId });

    const threadId = await ensureThread({ supabase, accountId, userId: user.id, swipeItemId });

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
    const contextText = buildSwipeIdeasContextText({ brandVoice, context: swipeContext });
    const system = sanitizePrompt([systemText, contextText].filter(Boolean).join('\n\n'));

    const anthropic = await callAnthropicJson({ system, messages: history, temperature: 0.2, max_tokens: 2600 });

    // Robustness: Claude may occasionally return non-JSON on follow-ups. Retry once with stricter instructions.
    const parsed = await (async () => {
      try {
        return parseCardsFromRaw(anthropic.rawText);
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
        return parseCardsFromRaw(retry.rawText);
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

    const draftRows = parsed.cards.map((c) => ({
      account_id: accountId,
      swipe_item_id: swipeItemId,
      thread_id: threadId,
      source_message_id: sourceMessageId,
      created_by_user_id: user.id,
      title: String(c.title || '').trim().slice(0, 240),
      slide_outline: normalizeSlideOutline(c.slides) as any,
      angle_text: String(c.angleText || '').trim(),
    }));

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

