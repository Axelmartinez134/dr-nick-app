import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../../editor/_utils';
import { loadEffectiveTemplateTypeSettings } from '../../_effective';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  projectId: string;
};

type InlineStyleRange = {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

function sanitizePrompt(input: string): string {
  // Remove ASCII control chars that can break JSON payloads/logging.
  return String(input || '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

function extractJsonObject(text: string): any {
  const s = String(text || '');
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('Parser did not return JSON');
  }
  const raw = s.slice(first, last + 1);
  return JSON.parse(raw);
}

function assertValidPayload(payload: any, templateTypeId: 'regular' | 'enhanced') {
  const slides = payload?.slides;
  const caption = payload?.caption;
  if (!Array.isArray(slides) || slides.length !== 6) {
    throw new Error('Invalid parser output: slides must be an array of length 6');
  }
  if (typeof caption !== 'string') {
    throw new Error('Invalid parser output: caption must be a string');
  }

  for (let i = 0; i < 6; i++) {
    const s = slides[i];
    if (!s || typeof s !== 'object') throw new Error(`Invalid slide ${i + 1}: must be an object`);
    if (typeof s.body !== 'string') throw new Error(`Invalid slide ${i + 1}: body must be a string`);
    if (templateTypeId === 'enhanced') {
      if (typeof s.headline !== 'string') throw new Error(`Invalid slide ${i + 1}: headline must be a string`);
    }
  }
}

function sanitizeInlineStyleRanges(text: string, ranges: any): InlineStyleRange[] {
  const s = String(text || '');
  const len = s.length;
  if (!Array.isArray(ranges) || len <= 0) return [];

  // Treat apostrophes as part of words so we don't break contractions/possessives (e.g., "Netflix's", "doesn't").
  // We also include the common curly apostrophe (’).
  const isWordChar = (ch: string) => /[A-Za-z0-9'’]/.test(ch);
  const snapToWordBoundaries = (startIn: number, endIn: number): { start: number; end: number } => {
    let start = Math.max(0, Math.min(len, Math.floor(startIn)));
    let end = Math.max(0, Math.min(len, Math.floor(endIn)));
    if (end <= start) return { start, end };

    // Trim whitespace edges first.
    while (start < end && /\s/.test(s[start]!)) start++;
    while (start < end && /\s/.test(s[end - 1]!)) end--;
    if (end <= start) return { start, end };

    // If start is inside a word, move left to the word boundary.
    while (
      start > 0 &&
      isWordChar(s[start - 1]!) &&
      isWordChar(s[start]!)
    ) {
      start--;
    }

    // If end is inside a word, move right to the word boundary.
    while (
      end < len &&
      isWordChar(s[end - 1]!) &&
      isWordChar(s[end]!)
    ) {
      end++;
    }

    // Re-trim whitespace after expanding.
    while (start < end && /\s/.test(s[start]!)) start++;
    while (start < end && /\s/.test(s[end - 1]!)) end--;
    return { start, end };
  };

  const out: InlineStyleRange[] = [];
  for (const r of ranges) {
    const start = Number((r as any)?.start);
    const end = Number((r as any)?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start < 0 || end > len || start >= end) continue;
    const snapped = snapToWordBoundaries(start, end);
    if (snapped.end <= snapped.start) continue;
    const next: InlineStyleRange = { start: snapped.start, end: snapped.end };
    if ((r as any)?.bold) next.bold = true;
    if ((r as any)?.italic) next.italic = true;
    if ((r as any)?.underline) next.underline = true;
    // Only keep ranges that actually apply a mark
    if (!next.bold && !next.italic && !next.underline) continue;
    out.push(next);
  }
  // Sort for determinism
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

async function callPoppy(prompt: string, args: { poppyConversationUrl: string }) {
  const baseUrl = String(args?.poppyConversationUrl || '').trim();
  const apiKey = process.env.POPPY_API_KEY;
  if (!baseUrl) throw new Error('Missing poppy_conversation_url for this user');
  if (!apiKey) throw new Error('Missing env var: POPPY_API_KEY');

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(
      'Invalid poppy_conversation_url for this user. It must be a full https URL like ' +
        '"https://api.getpoppy.ai/api/conversation?board_id=...&chat_id=...&model=...".'
    );
  }
  // Always enforce api_key from server env (never rely on stored URL).
  url.searchParams.set('api_key', apiKey);

  // Per spec: model comes from the stored URL (do NOT use env POPPY_MODEL for Generate Copy).
  const modelFromUrl = String(url.searchParams.get('model') || '').trim();

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelFromUrl ? { prompt, model: modelFromUrl } : { prompt }),
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Poppy error (${res.status}): ${text.slice(0, 500)}`);
    }
    return { rawText: text, model: modelFromUrl || null };
  } finally {
    clearTimeout(t);
  }
}

async function updateJobProgress(
  supabase: any,
  jobId: string,
  patch: { status?: string; error?: string | null }
) {
  try {
    const dbPatch: any = {};
    // NOTE: We keep `status` values conservative to avoid enum mismatches in some DBs.
    // If you later confirm status is TEXT, we can store richer values there.
    if (patch.status) dbPatch.status = patch.status;
    // We reuse `error` while the job is running to hold a progress code like "progress:poppy".
    // On completion, error is cleared to null. On failure, error holds the failure message.
    if (patch.error !== undefined) dbPatch.error = patch.error;
    if (Object.keys(dbPatch).length === 0) return;
    await supabase.from('carousel_generation_jobs').update(dbPatch).eq('id', jobId);
  } catch (e) {
    console.warn('[Generate Copy] ⚠️ Failed to update job progress:', e);
  }
}

async function callAnthropicParse(opts: {
  templateTypeId: 'regular' | 'enhanced';
  rawToParse: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  const schema =
    opts.templateTypeId === 'regular'
      ? `Return ONLY valid JSON in this exact shape:\n{\n  "slides": [\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."}\n  ],\n  "caption": "..."\n}\nRules:\n- slides must be length 6\n- body must be a string (can be empty)\n- caption must be a string`
      : `Return ONLY valid JSON in this exact shape:\n{\n  "slides": [\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."}\n  ],\n  "caption": "..."\n}\nRules:\n- slides must be length 6\n- headline/body must be strings (can be empty)\n- caption must be a string`;

  const userText = `${schema}\n\nData to structure:\n${opts.rawToParse}`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
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
        max_tokens: 2048,
        temperature: 0,
        messages: [{ role: 'user', content: userText }],
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
    return { rawText: text, model };
  } finally {
    clearTimeout(t);
  }
}

async function callAnthropicEmphasisRanges(opts: { slideTexts: string[]; instructionText: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  // Explicit model requested for this feature.
  const model = 'claude-sonnet-4-5-20250929';

  const texts = (opts.slideTexts || []).map((b) => String(b || ''));
  if (texts.length !== 6) throw new Error('Emphasis input must include exactly 6 slide texts');

  // NOTE: The caller provides the saved per-template-type emphasis prompt instruction text.
  // We append strict I/O format requirements here to keep parsing stable even if users edit the instructions.
  const instructionText = String(opts.instructionText || '');

  console.log('[Emphasis] 🧾 Instruction preview:', instructionText.slice(0, 180));

  // IMPORTANT: Provide input as JSON with a dedicated `text` field so the model does not
  // accidentally count the "index: " prefix when creating ranges.
  const slidesJson = JSON.stringify(texts.map((t, i) => ({ index: i, text: t })));

  const prompt = `${instructionText}

INPUT (JSON):
You are given EXACT slide text. Ranges must be relative to the slide's "text" field ONLY.
Do NOT count JSON syntax or the index number as part of the text.

SLIDES_JSON:
${slidesJson}

OUTPUT:
Return ONLY valid JSON (no markdown):
{
  "slides": [
    { "index": 0, "ranges": [ { "start": 0, "end": 10, "bold": true }, { "start": 15, "end": 22, "italic": true }, { "start": 30, "end": 40, "underline": true } ] }
  ]
}

RANGE RULES (HARD):
- Do NOT change any characters.
- Do NOT add/remove slides.
- Use half-open ranges [start,end)
- 0 <= start < end <= text.length
- Start/end MUST align to word/phrase boundaries (never split a word).
- Do not include leading/trailing whitespace in ranges.
- Prefer complete words/phrases; never punctuation/whitespace.
- Less is more; do not emphasize everything.`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
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
        max_tokens: 4096,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: ac.signal,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || JSON.stringify(json)?.slice(0, 500) || 'Unknown Anthropic error';
      throw new Error(`Anthropic emphasis error (${res.status}): ${msg}`);
    }
    const content0 = json?.content?.[0];
    const text = content0?.text || '';
    const payload = extractJsonObject(text);

    const out: InlineStyleRange[][] = Array.from({ length: 6 }, () => []);
    const slides = Array.isArray(payload?.slides) ? payload.slides : [];
    const rawCounts = Array.from({ length: 6 }, () => 0);
    for (const entry of slides) {
      const index = Number((entry as any)?.index);
      if (!Number.isFinite(index) || index < 0 || index > 5) continue;
      rawCounts[index] = Array.isArray((entry as any)?.ranges) ? (entry as any).ranges.length : 0;
      out[index] = sanitizeInlineStyleRanges(texts[index] || '', (entry as any)?.ranges);
    }
    console.log(
      '[Emphasis] ✅ Ranges per slide (raw→kept):',
      out.map((r, i) => `${rawCounts[i]}→${r.length}`).join(', ')
    );
    return out;
  } finally {
    clearTimeout(t);
  }
}

async function callAnthropicGenerateFromReel(opts: {
  templateTypeId: 'regular' | 'enhanced';
  poppyPromptRaw: string;
  bestPractices: string;
  reelCaption: string;
  reelTranscript: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  // Explicit model requested for this feature (match emphasis model).
  const model = 'claude-sonnet-4-5-20250929';

  const schema =
    opts.templateTypeId === 'regular'
      ? `Return ONLY valid JSON in this exact shape:\n{\n  "slides": [\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."}\n  ],\n  "caption": "..."\n}\nRules:\n- slides must be length 6\n- body must be a string (can be empty)\n- caption must be a string`
      : `Return ONLY valid JSON in this exact shape:\n{\n  "slides": [\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."}\n  ],\n  "caption": "..."\n}\nRules:\n- slides must be length 6\n- headline/body must be strings (can be empty)\n- caption must be a string`;

  const prompt = sanitizePrompt(String(opts.poppyPromptRaw || ''));
  const best = sanitizePrompt(String(opts.bestPractices || ''));
  const caption = sanitizePrompt(String(opts.reelCaption || ''));
  const transcript = sanitizePrompt(String(opts.reelTranscript || ''));
  if (!prompt) throw new Error('Template type prompt is empty');
  if (!transcript) throw new Error('Missing reel transcript (Whisper required)');

  const userText = [
    `You are an expert Instagram carousel copywriter.`,
    `You are given source material from an Instagram Reel (caption + transcript).`,
    ``,
    `PRIMARY INSTRUCTIONS (user-provided "Poppy Prompt"):\n${prompt}`,
    best ? `\nBEST PRACTICES (superadmin-only):\n${best}` : ``,
    ``,
    `SOURCE MATERIAL:\nREEL_CAPTION:\n${caption || '(empty)'}\n\nREEL_TRANSCRIPT:\n${transcript}`,
    ``,
    schema,
  ]
    .filter(Boolean)
    .join('\n');

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
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
        max_tokens: 4096,
        temperature: 0.2,
        messages: [{ role: 'user', content: userText }],
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
    return { rawText: text, model };
  } finally {
    clearTimeout(t);
  }
}

async function loadUserActivePoppyPrompt(args: {
  supabase: any;
  accountId: string;
  userId: string;
  templateTypeId: 'regular' | 'enhanced';
}) {
  const { supabase, accountId, userId, templateTypeId } = args;

  // Prefer the active saved prompt; fall back to the most recently updated saved prompt
  // (hardening against any unexpected "no active" states).
  //
  // Also harden against environments where the table/migration may not exist yet
  // by gracefully falling back to effective prompt.
  const { data: bestRow, error: bestErr } = await supabase
    .from('editor_poppy_saved_prompts')
    .select('id, prompt, is_active, updated_at, created_at')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .eq('template_type_id', templateTypeId)
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!bestErr && bestRow) {
    const bestPromptRaw = String((bestRow as any)?.prompt || '');
    const bestPrompt = sanitizePrompt(bestPromptRaw);
    if (bestPrompt) {
      const savedPromptId = String((bestRow as any)?.id || '').trim() || null;
      const isActive = !!(bestRow as any)?.is_active;
      const source: 'saved_active' | 'saved_latest' = isActive ? 'saved_active' : 'saved_latest';
      return {
        source,
        promptRaw: bestPromptRaw,
        prompt: bestPrompt,
        savedPromptId,
      };
    }
  }

  // Fallback: account-level effective prompt (defaults + account overrides).
  const { effective } = await loadEffectiveTemplateTypeSettings(
    supabase,
    { accountId, actorUserId: userId },
    templateTypeId
  );
  const effectiveRaw = String((effective as any)?.prompt || '');
  const effectivePrompt = sanitizePrompt(effectiveRaw);
  const source: 'effective_fallback' | 'effective_fallback_saved_error' = bestErr
    ? 'effective_fallback_saved_error'
    : 'effective_fallback';
  return {
    source,
    promptRaw: effectiveRaw,
    prompt: effectivePrompt,
    savedPromptId: null,
  };
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });

  // Load project (account-scoped)
  let { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id, template_type_id, prompt_snapshot, account_id')
    .eq('id', body.projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  // Backwards-safe: legacy row without account_id (owned by caller)
  if (!project?.id) {
    const legacy = await supabase
      .from('carousel_projects')
      .select('id, owner_user_id, template_type_id, prompt_snapshot, account_id')
      .eq('id', body.projectId)
      .eq('owner_user_id', user.id)
      .is('account_id', null)
      .maybeSingle();
    projectErr = projectErr || legacy.error;
    project = legacy.data as any;
    if (project?.id) {
      await supabase.from('carousel_projects').update({ account_id: accountId }).eq('id', body.projectId);
    }
  }
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || 'Project not found' }, { status: 404 });
  }

  const templateTypeId = project.template_type_id === 'enhanced' ? 'enhanced' : 'regular';

  // Phase 6: Generate Copy uses the user's active saved Poppy prompt (per-account, per template type).
  // Fallback to account-level effective prompt only if the saved prompt is missing/empty.
  const loadedPrompt = await loadUserActivePoppyPrompt({ supabase, accountId, userId: user.id, templateTypeId });
  const promptRaw = loadedPrompt.promptRaw;
  const prompt = loadedPrompt.prompt;
  if (!prompt) {
    return NextResponse.json(
      { success: false, error: 'Template type prompt is empty' },
      { status: 400 }
    );
  }

  // Brand voice (per-account): reuse the existing Brand Alignment prompt field as the canonical voice doc.
  const { data: brandRow, error: brandErr } = await supabase
    .from('editor_account_settings')
    .select('brand_alignment_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  if (brandErr) {
    return NextResponse.json({ success: false, error: brandErr.message }, { status: 500 });
  }
  const brandVoiceRaw = String((brandRow as any)?.brand_alignment_prompt_override ?? '');

  // Phase BV: compose the final Poppy prompt at runtime (brand voice + selected style prompt).
  // IMPORTANT: Keep the existing sanitizePrompt behavior unchanged (even if it flattens newlines).
  const composedPromptRaw = `BRAND_VOICE:\n${brandVoiceRaw}\n\nSTYLE_PROMPT:\n${promptRaw}`;
  const composedPrompt = sanitizePrompt(composedPromptRaw);

  // Reel/Post outreach detection (superadmin-only table). If present, we bypass Poppy for copy generation.
  const { data: outreachRow } = await supabase
    .from('editor_outreach_targets')
    .select('source_post_url, source_post_caption, source_post_transcript')
    .eq('account_id', accountId)
    .eq('created_project_id', project.id)
    .maybeSingle();

  const isReelOrigin = !!String((outreachRow as any)?.source_post_url || '').trim();
  const reelCaption = String((outreachRow as any)?.source_post_caption || '').trim();
  const reelTranscript = String((outreachRow as any)?.source_post_transcript || '').trim();
  // Best practices remain account-scoped effective settings.
  const { effective: ttEffective } = await loadEffectiveTemplateTypeSettings(
    supabase,
    { accountId, actorUserId: user.id },
    templateTypeId
  );
  const bestPractices = String((ttEffective as any)?.bestPractices || '').trim();

  // Poppy routing info (only required for non-reel generation).
  let poppyConversationUrl = '';
  let poppyRoutingMeta: { boardId: string | null; chatId: string | null; model: string | null } = {
    boardId: null,
    chatId: null,
    model: null,
  };
  let poppyPromptDebug: any = null;
  let poppyRequestBody: any = null;

  if (!isReelOrigin) {
    // Phase E: per-account Poppy routing (board/chat/model) stored on editor_account_settings.
    const { data: settingsRow, error: settingsErr } = await supabase
      .from('editor_account_settings')
      .select('poppy_conversation_url')
      .eq('account_id', accountId)
      .maybeSingle();
    if (settingsErr) {
      return NextResponse.json({ success: false, error: settingsErr.message }, { status: 500 });
    }
    // Backwards-safe: legacy per-user source.
    const { data: editorRow, error: editorErr } = await supabase
      .from('editor_users')
      .select('poppy_conversation_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (editorErr) {
      return NextResponse.json({ success: false, error: editorErr.message }, { status: 500 });
    }
    poppyConversationUrl =
      String((settingsRow as any)?.poppy_conversation_url || '').trim() ||
      String((editorRow as any)?.poppy_conversation_url || '').trim();
    if (!poppyConversationUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing poppy_conversation_url for this account' },
        { status: 400 }
      );
    }

    try {
      const u = new URL(poppyConversationUrl);
      poppyRoutingMeta = {
        boardId: String(u.searchParams.get('board_id') || '').trim() || null,
        chatId: String(u.searchParams.get('chat_id') || '').trim() || null,
        model: String(u.searchParams.get('model') || '').trim() || null,
      };
    } catch {
      // leave nulls; callPoppy will throw a clearer error
    }

    poppyRequestBody = poppyRoutingMeta.model
      ? { prompt: composedPrompt, model: poppyRoutingMeta.model }
      : { prompt: composedPrompt };
    poppyPromptDebug = {
      promptSource: loadedPrompt.source,
      savedPromptId: loadedPrompt.savedPromptId,
      promptRaw: JSON.stringify(composedPromptRaw),
      promptSanitized: composedPrompt,
      requestBody: poppyRequestBody,
    };
  }

  // Create + lock a job (unique partial index blocks concurrent jobs).
  const { data: job, error: jobErr } = await supabase
    .from('carousel_generation_jobs')
    .insert({
      account_id: accountId,
      project_id: project.id,
      template_type_id: templateTypeId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (jobErr) {
    const code = (jobErr as any).code;
    if (code === '23505') {
      return NextResponse.json(
        { success: false, error: 'A generation job is already running for this project' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: jobErr.message }, { status: 500 });
  }

  const jobId = job.id as string;

  try {
    let payload: any;

    if (isReelOrigin) {
      if (!reelTranscript) {
        throw new Error('Missing reel transcript. Transcription must finish before generating copy.');
      }
      await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:claude' });
      const generated = await callAnthropicGenerateFromReel({
        templateTypeId,
        poppyPromptRaw: composedPromptRaw,
        bestPractices,
        reelCaption,
        reelTranscript,
      });
      payload = extractJsonObject(generated.rawText);
    } else {
      await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:poppy' });
      try {
        console.log(
          `[Generate Copy][Poppy] account=${accountId} project=${project.id} templateType=${templateTypeId} body=${JSON.stringify(
            poppyRequestBody
          )}\nraw=${poppyPromptDebug?.promptRaw}\n\nsanitized=\n${composedPrompt}`
        );
      } catch {
        // ignore logging failures
      }
      const poppy = await callPoppy(composedPrompt, { poppyConversationUrl });
      await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:parse' });
      const parsed = await callAnthropicParse({ templateTypeId, rawToParse: poppy.rawText });
      payload = extractJsonObject(parsed.rawText);
    }

    assertValidPayload(payload, templateTypeId);

    const slides = payload.slides as Array<{ headline?: string; body: string }>;
    const caption = payload.caption as string;

    const emphasisInstruction = String(ttEffective?.emphasisPrompt || '').trim();

    // Generate emphasis ranges (Generate Copy only; Realign untouched).
    await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:emphasis' });
    const headlineStyleRangesBySlide: InlineStyleRange[][] =
      templateTypeId === 'enhanced'
        ? await callAnthropicEmphasisRanges({
            slideTexts: slides.map((s) => String(s.headline || '')),
            instructionText: emphasisInstruction,
          })
        : Array.from({ length: 6 }, () => []);
    const bodyStyleRangesBySlide: InlineStyleRange[][] = await callAnthropicEmphasisRanges({
      slideTexts: slides.map((s) => String(s.body || '')),
      instructionText: emphasisInstruction,
    });

    // Persist slides (overwrite everything model)
    await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:save' });

    // Preserve any existing per-line override state stored in input_snapshot (Phase 4).
    const { data: existingInputs } = await supabase
      .from('carousel_project_slides')
      .select('slide_index, input_snapshot')
      .eq('project_id', project.id);
    const existingByIdx = new Map<number, any>();
    (existingInputs || []).forEach((r: any) => {
      if (typeof r?.slide_index === 'number') existingByIdx.set(r.slide_index, r?.input_snapshot || null);
    });

    await Promise.all(
      slides.map((s, idx) => {
        const patch: any = {
          headline: templateTypeId === 'enhanced' ? (s.headline || '') : null,
          body: s.body || '',
        };
        const prev = existingByIdx.get(idx) || null;
        patch.input_snapshot = {
          ...(prev && typeof prev === 'object' ? prev : {}),
          headlineStyleRanges: templateTypeId === 'enhanced' ? (headlineStyleRangesBySlide[idx] || []) : [],
          bodyStyleRanges: bodyStyleRangesBySlide[idx] || [],
        };
        return supabase.from('carousel_project_slides').update(patch).eq('project_id', project.id).eq('slide_index', idx);
      })
    );

    // Persist caption (project-level)
    await supabase.from('carousel_projects').update({ caption }).eq('id', project.id);

    await supabase
      .from('carousel_generation_jobs')
      .update({ status: 'completed', finished_at: new Date().toISOString(), error: null })
      .eq('id', jobId);

    return NextResponse.json({
      success: true,
      jobId,
      templateTypeId,
      poppyRoutingMeta,
      ...(poppyPromptDebug ? { poppyPromptDebug } : {}),
      caption,
      slides: slides.map((s, idx) => ({
        headline: templateTypeId === 'enhanced' ? (s.headline || '') : null,
        body: s.body || '',
        headlineStyleRanges: templateTypeId === 'enhanced' ? (headlineStyleRangesBySlide[idx] || []) : [],
        bodyStyleRanges: bodyStyleRangesBySlide[idx] || [],
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Generate copy failed';
    await supabase
      .from('carousel_generation_jobs')
      .update({ status: 'failed', finished_at: new Date().toISOString(), error: msg })
      .eq('id', jobId);
    const status = msg.toLowerCase().includes('missing reel transcript') ? 400 : 500;
    return NextResponse.json({ success: false, error: msg, jobId }, { status });
  }
}


