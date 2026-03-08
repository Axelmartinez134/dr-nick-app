import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 120;

type BodyIn = { projectId: string; slideIndex: number; content: string };
type Provider = 'poppy' | 'claude';

type CandidateOut = { body: string };
type Resp =
  | { success: true; threadId: string; sourceMessageId: string; assistantMessage: string; candidates: CandidateOut[] }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

function sanitizeText(input: string): string {
  // Preserve tabs/newlines but remove other control chars that can break JSON/logging.
  return String(input || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').trim();
}

function sanitizePrompt(input: string): string {
  return String(input || '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

function extractJsonObject(text: string): any {
  const raw = String(text || '');
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('Model did not return JSON');
  return JSON.parse(raw.slice(first, last + 1));
}

function assertOutput(payload: any): { assistantMessage: string; candidates: CandidateOut[] } {
  const assistantMessage = typeof payload?.assistantMessage === 'string' ? String(payload.assistantMessage).trim() : '';
  const cIn = payload?.candidates;
  if (!Array.isArray(cIn) || cIn.length !== 3) throw new Error('Invalid output: candidates must be an array of length 3');
  const candidates = cIn.slice(0, 3).map((c: any, idx: number) => {
    const body = String(c?.body || '').trim();
    if (!body) throw new Error(`Invalid candidate ${idx + 1}: body missing`);
    return { body };
  });
  return { assistantMessage: assistantMessage || 'Here are three options. Pick one to apply, or tell me what to change.', candidates };
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
        max_tokens: typeof args.max_tokens === 'number' ? args.max_tokens : 1800,
        temperature: typeof args.temperature === 'number' ? args.temperature : 0.3,
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
    const text = String(json?.content?.[0]?.text || '');
    return { rawText: text, model };
  } finally {
    clearTimeout(t);
  }
}

async function loadPoppyConversationUrl(args: { supabase: any; accountId: string; userId: string }) {
  const { supabase, accountId, userId } = args;

  const { data: settingsRow, error: settingsErr } = await supabase
    .from('editor_account_settings')
    .select('poppy_conversation_url')
    .eq('account_id', accountId)
    .maybeSingle();
  if (settingsErr) throw new Error(settingsErr.message);

  // Backwards-safe: legacy per-user source.
  const { data: editorRow, error: editorErr } = await supabase
    .from('editor_users')
    .select('poppy_conversation_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (editorErr) throw new Error(editorErr.message);

  const url =
    String((settingsRow as any)?.poppy_conversation_url || '').trim() ||
    String((editorRow as any)?.poppy_conversation_url || '').trim();
  if (!url) throw new Error('Missing poppy_conversation_url for this account');
  return url;
}

function parsePoppyRoutingMeta(poppyConversationUrl: string) {
  try {
    const u = new URL(String(poppyConversationUrl || '').trim());
    return {
      boardId: String(u.searchParams.get('board_id') || '').trim() || null,
      chatId: String(u.searchParams.get('chat_id') || '').trim() || null,
      model: String(u.searchParams.get('model') || '').trim() || null,
    };
  } catch {
    return { boardId: null as string | null, chatId: null as string | null, model: null as string | null };
  }
}

async function poppyAskOneShot(args: { apiKey: string; poppyConversationUrl: string; prompt: string }) {
  // IMPORTANT: We use the same call shape as Generate Copy (known working).
  const baseUrl = String(args.poppyConversationUrl || '').trim();
  const apiKey = String(args.apiKey || '').trim();
  const prompt = String(args.prompt || '').trim();
  if (!baseUrl) throw new Error('Missing poppy_conversation_url for this account');
  if (!apiKey) throw new Error('Missing env var: POPPY_API_KEY');

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(
      'Invalid poppy_conversation_url for this account. It must be a full https URL like ' +
        '"https://api.getpoppy.ai/api/conversation?board_id=...&chat_id=...&model=...".'
    );
  }

  // Always enforce api_key from server env (never rely on stored URL).
  url.searchParams.set('api_key', apiKey);

  // Per existing behavior: model comes from the stored URL.
  const modelFromUrl = String(url.searchParams.get('model') || '').trim();

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 60_000);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify(modelFromUrl ? { prompt, model: modelFromUrl } : { prompt }),
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Poppy error (${res.status}): ${text.slice(0, 500)}`);
    }
    const out = String(text || '').trim();
    if (!out) throw new Error('Poppy returned an empty response');
    return { rawText: out, model: modelFromUrl || null };
  } finally {
    clearTimeout(t);
  }
}

async function formatPoppyToCandidates(args: { rawText: string }) {
  const system = sanitizePrompt(
    [
      'You are a formatter. Convert the raw assistant response into EXACTLY 3 body rewrite options.',
      'Output format (HARD): Return ONLY valid JSON (no markdown, no preamble):',
      '{',
      '  "assistantMessage": "string",',
      '  "candidates": [',
      '    { "body": "string" },',
      '    { "body": "string" },',
      '    { "body": "string" }',
      '  ]',
      '}',
      'Rules (HARD):',
      '- candidates must be exactly 3.',
      '- Each candidate.body must be plain text only (no markdown).',
      '- Do NOT include numbering like "1)" inside the body unless the user explicitly asked.',
    ].join('\n')
  );
  const user = sanitizePrompt(`RAW_TEXT:\n${String(args.rawText || '').trim()}`);
  const r = await callAnthropicJson({
    system,
    messages: [{ role: 'user', content: user }],
    temperature: 0,
    max_tokens: 1200,
  });
  return assertOutput(extractJsonObject(r.rawText));
}

async function ensureThread(args: {
  supabase: any;
  accountId: string;
  userId: string;
  projectId: string;
  slideIndex: number;
}): Promise<string> {
  const { supabase, accountId, userId, projectId, slideIndex } = args;
  const { data: existing, error: exErr } = await supabase
    .from('carousel_body_regen_chat_threads')
    .select('id')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('slide_index', slideIndex)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  const existingId = String((existing as any)?.id || '').trim();
  if (existingId) return existingId;

  const { data: inserted, error: insErr } = await supabase
    .from('carousel_body_regen_chat_threads')
    .insert({ account_id: accountId, project_id: projectId, slide_index: slideIndex, created_by_user_id: userId } as any)
    .select('id')
    .maybeSingle();
  if (insErr) {
    const code = (insErr as any)?.code;
    if (code !== '23505') throw new Error(insErr.message);
  }
  const insertedId = String((inserted as any)?.id || '').trim();
  if (insertedId) return insertedId;

  const { data: reread, error: rrErr } = await supabase
    .from('carousel_body_regen_chat_threads')
    .select('id')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('slide_index', slideIndex)
    .maybeSingle();
  if (rrErr) throw new Error(rrErr.message);
  const rereadId = String((reread as any)?.id || '').trim();
  if (!rereadId) throw new Error('Failed to create body regen chat thread');
  return rereadId;
}

async function loadContextOrThrow(args: { supabase: any; accountId: string; projectId: string; slideIndex: number }) {
  const { supabase, accountId, projectId, slideIndex } = args;

  const { data: project, error: projErr } = await supabase
    .from('carousel_projects')
    .select('id, caption, title')
    .eq('account_id', accountId)
    .eq('id', projectId)
    .is('archived_at', null)
    .maybeSingle();
  if (projErr) throw new Error(projErr.message);
  if (!project?.id) throw new Error('Project not found');

  const { data: slides, error: slidesErr } = await supabase
    .from('carousel_project_slides')
    .select('slide_index, layout_snapshot')
    .eq('project_id', projectId)
    .order('slide_index', { ascending: true });
  if (slidesErr) throw new Error(slidesErr.message);
  if (!Array.isArray(slides) || slides.length !== 6) throw new Error('Could not load slides');

  for (const r of slides as any[]) {
    const snap = r?.layout_snapshot;
    const lines = snap && typeof snap === 'object' ? (snap as any).textLines : null;
    if (!Array.isArray(lines)) throw new Error('Generate/Realign first.');
  }

  const { data: settingsRow, error: settingsErr } = await supabase
    .from('editor_account_settings')
    .select('brand_alignment_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  if (settingsErr) throw new Error(settingsErr.message);

  const brandVoice = String((settingsRow as any)?.brand_alignment_prompt_override ?? '');

  const slidesText = (slides as any[])
    .slice()
    .sort((a: any, b: any) => Number(a?.slide_index) - Number(b?.slide_index))
    .map((r: any, idx: number) => {
      const si = Number.isFinite(r?.slide_index) ? Number(r.slide_index) : idx;
      const snap = r?.layout_snapshot || {};
      const lines = Array.isArray((snap as any)?.textLines) ? ((snap as any).textLines as any[]) : [];
      const joined = lines.map((l) => String(l?.text ?? '')).filter(Boolean).join('\n');
      return { slideIndex: si, textLines: joined || '(no text lines)' };
    });

  // Prior attempts (history) for this project+slide
  const { data: priorRuns } = await supabase
    .from('carousel_body_regen_attempts')
    .select('created_at, guidance_text, output_body')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('slide_index', slideIndex)
    .order('created_at', { ascending: false })
    .limit(20);

  const attempts = (Array.isArray(priorRuns) ? (priorRuns as any[]) : []).map((r) => ({
    createdAt: String(r?.created_at || ''),
    guidanceText: String(r?.guidance_text || ''),
    body: String(r?.output_body || ''),
  }));

  return {
    project: {
      id: String((project as any).id),
      title: String((project as any).title || ''),
      caption: String((project as any).caption || ''),
    },
    brandVoice,
    slidesText,
    attempts,
  };
}

function buildSystemPrompt(args: {
  masterPrompt: string;
  brandVoice: string;
  projectTitle: string;
  caption: string;
  slideIndex: number;
  slidesText: Array<{ slideIndex: number; textLines: string }>;
  attempts: Array<{ createdAt: string; guidanceText: string; body: string }>;
}) {
  const attemptsBlock = args.attempts.length
    ? args.attempts
        .slice()
        .reverse()
        .map((a, i) => {
          const when = a.createdAt ? ` (${a.createdAt})` : '';
          const g = a.guidanceText ? `Guidance: ${a.guidanceText}` : 'Guidance: (none)';
          return `ATTEMPT ${i + 1}${when}\n${g}\nBODY:\n${a.body}`;
        })
        .join('\n\n')
    : '(none)';

  const slidesBlock = args.slidesText
    .slice()
    .sort((a, b) => a.slideIndex - b.slideIndex)
    .map((s) => `SLIDE ${s.slideIndex + 1} (textLines):\n${s.textLines}`)
    .join('\n\n');

  const base = sanitizePrompt(
    [
      `MASTER_PROMPT:\n${args.masterPrompt}`,
      ``,
      `BRAND_VOICE:\n${args.brandVoice || '-'}`,
      ``,
      `PROJECT_TITLE:\n${args.projectTitle || '-'}`,
      ``,
      `CAROUSEL_TEXTLINES:\n${slidesBlock || '-'}`,
      ``,
      `CAPTION:\n${args.caption || '-'}`,
      ``,
      `PREVIOUS_BODY_ATTEMPTS (for this slide; avoid repeating them):\n${attemptsBlock}`,
      ``,
      `TARGET: You are rewriting BODY text for SLIDE ${args.slideIndex + 1} only.`,
      `OUTPUT FORMAT (HARD): Return ONLY valid JSON (no markdown, no preamble):`,
      `{`,
      `  "assistantMessage": "string",`,
      `  "candidates": [`,
      `    { "body": "string" },`,
      `    { "body": "string" },`,
      `    { "body": "string" }`,
      `  ]`,
      `}`,
      ``,
      `RULES (HARD):`,
      `- candidates must be exactly 3.`,
      `- Each candidate.body must be plain text only (no markdown, no quotes around the whole body).`,
      `- Keep each candidate consistent with the rest of the carousel context.`,
      `- If the user asks for changes, adapt the next three options accordingly.`,
    ].join('\n')
  );

  return base;
}

export async function POST(request: NextRequest) {
  try {
    const authed = await getAuthedSupabase(request);
    if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
    const { supabase, user } = authed;

    const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
    if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
    const accountId = acct.accountId;

    let body: BodyIn;
    try {
      body = (await request.json()) as BodyIn;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
    }

    const projectId = String(body?.projectId || '').trim();
    const slideIndex = Number(body?.slideIndex);
    const content = String((body as any)?.content || '').trim();
    const providerRaw = String((body as any)?.provider || 'claude').trim().toLowerCase();
    const provider: Provider = providerRaw === 'poppy' ? 'poppy' : 'claude';
    if (!projectId || !isUuid(projectId)) return NextResponse.json({ success: false, error: 'Invalid projectId' } satisfies Resp, { status: 400 });
    if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
      return NextResponse.json({ success: false, error: 'slideIndex must be 0..5' } satisfies Resp, { status: 400 });
    }
    if (!content) return NextResponse.json({ success: false, error: 'Missing content' } satisfies Resp, { status: 400 });
    if (content.length > 10_000) return NextResponse.json({ success: false, error: 'Message too long' } satisfies Resp, { status: 400 });

    const ctx = await loadContextOrThrow({ supabase, accountId, projectId, slideIndex });

    // Reuse the same master prompt override field used by Swipe Ideas (account-wide).
    const { data: settingsRow } = await supabase
      .from('editor_account_settings')
      .select('swipe_ideas_master_prompt_override')
      .eq('account_id', accountId)
      .maybeSingle();
    const masterPrompt = String((settingsRow as any)?.swipe_ideas_master_prompt_override ?? '').trim() || 'You are a helpful copywriting assistant.';

    const system = buildSystemPrompt({
      masterPrompt,
      brandVoice: String(ctx.brandVoice || ''),
      projectTitle: String(ctx.project.title || ''),
      caption: String(ctx.project.caption || ''),
      slideIndex,
      slidesText: ctx.slidesText,
      attempts: ctx.attempts,
    });

    const threadId = await ensureThread({ supabase, accountId, userId: user.id, projectId, slideIndex });

    // Persist user message.
    const userContent = sanitizeText(content);
    const { error: userMsgErr } = await supabase.from('carousel_body_regen_chat_messages').insert({
      account_id: accountId,
      thread_id: threadId,
      created_by_user_id: user.id,
      role: 'user',
      content: userContent,
    } as any);
    if (userMsgErr) return NextResponse.json({ success: false, error: userMsgErr.message } satisfies Resp, { status: 500 });

    // Load recent history (latest 24 messages) to send with the request.
    const { data: historyRows, error: historyErr } = await supabase
      .from('carousel_body_regen_chat_messages')
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

    const parsed = await (async () => {
      if (provider === 'poppy') {
        const poppyConversationUrl = await loadPoppyConversationUrl({ supabase, accountId, userId: user.id });
        const poppyApiKey = String(process.env.POPPY_API_KEY || '').trim();
        if (!poppyApiKey) throw new Error('Missing env var: POPPY_API_KEY');

        // NOTE: We intentionally do NOT use Poppy's create-conversation endpoint.
        // It's been returning 422 for valid board/chat IDs in your environment.
        // Instead, we call Poppy exactly like Generate Copy does (one-shot KB ask),
        // while keeping chat history on our side (DB) by embedding it into the prompt.
        const poppyPrompt = `${system}\n\nUSER_MESSAGE:\n${sanitizeText(content)}`.trim();
        const poppy = await poppyAskOneShot({ apiKey: poppyApiKey, poppyConversationUrl, prompt: poppyPrompt });
        return await formatPoppyToCandidates({ rawText: poppy.rawText });
      }

      // Claude path (current behavior): strict JSON directly.
      const anthropic = await callAnthropicJson({ system, messages: history, temperature: 0.3, max_tokens: 1800 });
      try {
        return assertOutput(extractJsonObject(anthropic.rawText));
      } catch {
        const retrySystem =
          system +
          '\n\n' +
          sanitizePrompt(['FORMAT_ERROR: Your previous response was invalid.', 'Return ONLY the JSON object in the required shape. No other text.'].join('\n'));
        const retry = await callAnthropicJson({ system: retrySystem, messages: history, temperature: 0, max_tokens: 1600 });
        return assertOutput(extractJsonObject(retry.rawText));
      }
    })();

    // Persist assistant message.
    const { data: assistantRow, error: assistantErr } = await supabase
      .from('carousel_body_regen_chat_messages')
      .insert({
        account_id: accountId,
        thread_id: threadId,
        created_by_user_id: user.id,
        role: 'assistant',
        content: sanitizeText(parsed.assistantMessage),
      } as any)
      .select('id')
      .single();
    if (assistantErr) return NextResponse.json({ success: false, error: assistantErr.message } satisfies Resp, { status: 500 });

    const sourceMessageId = String((assistantRow as any)?.id || '').trim();
    if (!sourceMessageId) return NextResponse.json({ success: false, error: 'Failed to persist assistant message' } satisfies Resp, { status: 500 });

    const sugRows = parsed.candidates.map((c, idx) => ({
      account_id: accountId,
      thread_id: threadId,
      source_message_id: sourceMessageId,
      idx,
      body: sanitizeText(c.body),
    }));
    const { error: sugErr } = await supabase.from('carousel_body_regen_chat_suggestions').insert(sugRows as any);
    if (sugErr) return NextResponse.json({ success: false, error: sugErr.message } satisfies Resp, { status: 500 });

    return NextResponse.json({
      success: true,
      threadId,
      sourceMessageId,
      assistantMessage: parsed.assistantMessage,
      candidates: parsed.candidates,
    } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status = msg.toLowerCase().includes('generate/realign first') ? 400 : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}

