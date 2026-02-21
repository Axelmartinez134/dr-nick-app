import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';
import { loadEffectiveTemplateTypeSettings } from '../../_effective';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  projectId: string;
  slideIndex: number;
  guidanceText?: string | null;
};

type InlineStyleRange = {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

function sanitizeText(input: string): string {
  // Remove ASCII control chars that can break JSON payloads/logging,
  // but preserve common whitespace formatting (tabs/newlines).
  return String(input || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .trim();
}

function sanitizePrompt(input: string): string {
  // Slightly stricter: we don't want weird control chars in prompts either.
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

function sanitizeInlineStyleRanges(text: string, ranges: any): InlineStyleRange[] {
  const s = String(text || '');
  const len = s.length;
  if (!Array.isArray(ranges) || len <= 0) return [];

  const isWordChar = (ch: string) => /[A-Za-z0-9'’]/.test(ch);
  const snapToWordBoundaries = (startIn: number, endIn: number): { start: number; end: number } => {
    let start = Math.max(0, Math.min(len, Math.floor(startIn)));
    let end = Math.max(0, Math.min(len, Math.floor(endIn)));
    if (end <= start) return { start, end };

    while (start < end && /\s/.test(s[start]!)) start++;
    while (start < end && /\s/.test(s[end - 1]!)) end--;
    if (end <= start) return { start, end };

    while (start > 0 && isWordChar(s[start - 1]!) && isWordChar(s[start]!)) start--;
    while (end < len && isWordChar(s[end - 1]!) && isWordChar(s[end]!)) end++;

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
    if (!next.bold && !next.italic && !next.underline) continue;
    out.push(next);
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

async function callAnthropicRewriteBody(opts: { systemPrompt: string; userMessage: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  // Keep consistent with Caption Regenerate.
  const model = 'claude-sonnet-4-5-20250929';

  try {
    const full = `${opts.systemPrompt}\n\n${opts.userMessage}`;
    console.log('[BodyRegen][Rewrite] 🧪 Full prompt sent to Claude (stringified):');
    console.log(JSON.stringify(full));
  } catch {
    // ignore
  }

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 45_000);
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
        max_tokens: 1500,
        temperature: 0.7,
        messages: [{ role: 'user', content: `${opts.systemPrompt}\n\n${opts.userMessage}` }],
      }),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || 'Anthropic API error';
      throw new Error(msg);
    }
    const text = String(json?.content?.[0]?.text || '');
    return { text, model };
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropicEmphasisRanges(opts: { slideTexts: string[]; instructionText: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  // Explicit model requested for emphasis feature (match Generate Copy).
  const model = 'claude-sonnet-4-5-20250929';

  const texts = (opts.slideTexts || []).map((b) => String(b || ''));
  if (texts.length !== 6) throw new Error('Emphasis input must include exactly 6 slide texts');

  const instructionText = String(opts.instructionText || '');
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

  try {
    console.log('[BodyRegen][Emphasis] 🧪 Full prompt sent to Claude (stringified):');
    console.log(JSON.stringify(prompt));
  } catch {
    // ignore
  }

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
    for (const entry of slides) {
      const index = Number((entry as any)?.index);
      if (!Number.isFinite(index) || index < 0 || index > 5) continue;
      out[index] = sanitizeInlineStyleRanges(texts[index] || '', (entry as any)?.ranges);
    }
    return out;
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
      return { source, promptRaw: bestPromptRaw, prompt: bestPrompt, savedPromptId };
    }
  }

  const { effective } = await loadEffectiveTemplateTypeSettings(supabase, { accountId, actorUserId: userId }, templateTypeId);
  const effectiveRaw = String((effective as any)?.prompt || '');
  const effectivePrompt = sanitizePrompt(effectiveRaw);
  const source: 'effective_fallback' | 'effective_fallback_saved_error' = bestErr ? 'effective_fallback_saved_error' : 'effective_fallback';
  return { source, promptRaw: effectiveRaw, prompt: effectivePrompt, savedPromptId: null };
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

  const projectId = String(body?.projectId || '').trim();
  const slideIndex = Number(body?.slideIndex);
  const guidanceText = body?.guidanceText === undefined || body?.guidanceText === null ? null : String(body.guidanceText);

  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
    return NextResponse.json({ success: false, error: 'slideIndex must be 0..5' }, { status: 400 });
  }

  // Load project (account-scoped)
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id, template_type_id, prompt_snapshot')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || 'Project not found' }, { status: 404 });
  }

  const templateTypeId = String((project as any)?.template_type_id || '') === 'enhanced' ? 'enhanced' : 'regular';
  if (templateTypeId !== 'regular') {
    return NextResponse.json({ success: false, error: 'Body Regenerate is only available for Regular projects' }, { status: 400 });
  }

  // Load all 6 slide bodies
  const { data: slides, error: slidesErr } = await supabase
    .from('carousel_project_slides')
    .select('slide_index, body')
    .eq('project_id', projectId)
    .order('slide_index', { ascending: true });
  if (slidesErr || !slides || slides.length !== 6) {
    return NextResponse.json({ success: false, error: 'Could not load slides' }, { status: 500 });
  }

  const bodies = slides
    .slice()
    .sort((a: any, b: any) => Number(a.slide_index) - Number(b.slide_index))
    .map((s: any) => String(s?.body || ''));

  const currentBody = bodies[slideIndex] || '';

  // Prompt source: prefer project.prompt_snapshot if present, else fall back to active saved prompt (Regular).
  const promptSnapshotRaw = String((project as any)?.prompt_snapshot || '').trim();
  const promptSource = promptSnapshotRaw ? 'project_prompt_snapshot' : 'active_saved_prompt_fallback';
  const brandPromptRaw = promptSnapshotRaw
    ? promptSnapshotRaw
    : (await loadUserActivePoppyPrompt({ supabase, accountId, userId: user.id, templateTypeId: 'regular' })).promptRaw;
  const brandPrompt = sanitizeText(brandPromptRaw);

  // Effective template-type emphasis instruction (Regular).
  const { effective } = await loadEffectiveTemplateTypeSettings(supabase, { accountId, actorUserId: user.id }, 'regular');
  const emphasisInstruction = String((effective as any)?.emphasisPrompt || '').trim();

  // Load prior attempts (limit 20) to provide rejected-context.
  const { data: priorRuns } = await supabase
    .from('carousel_body_regen_attempts')
    .select('output_body, created_at')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('slide_index', slideIndex)
    .order('created_at', { ascending: true })
    .limit(20);
  const rejectedBodies: string[] = (priorRuns || [])
    .map((r: any) => String(r?.output_body || '').trim())
    .filter(Boolean);

  const slidesInput = bodies.map((b, i) => ({ slideNumber: i + 1, body: String(b || '') }));

  const userMessage = [
    `You are rewriting ONLY one slide body in a 6-slide Instagram carousel.`,
    ``,
    `HARD REQUIREMENTS:`,
    `- You are editing slide ${slideIndex + 1} ONLY.`,
    `- Do NOT output JSON.`,
    `- Return ONLY the new body text (no markdown, no quotes, no preamble).`,
    `- Use newlines to separate ideas to make it easy to read.`,
    `- Never use ** anywhere in the output.`,
    `- Do not surround the entire output with quotes.`,
    `- Use dashes sparingly.`,
    `- Never use an em dash (—). If you would use one, use an ellipsis (...) instead.`,
    ``,
    `CAROUSEL CONTEXT (JSON):`,
    JSON.stringify(
      {
        slides: slidesInput,
        targetSlideNumber: slideIndex + 1,
        currentBody,
        rejectedBodies,
        guidanceText: guidanceText ? String(guidanceText) : '',
      },
      null,
      2
    ),
    ``,
    rejectedBodies.length
      ? `NOTE: rejectedBodies are previous attempts the user disliked. Do NOT repeat their structure or phrasing; produce a meaningfully different rewrite.`
      : `NOTE: No prior attempts exist. Produce the best rewrite you can.`,
    guidanceText && String(guidanceText).trim()
      ? `USER GUIDANCE:\n${sanitizeText(String(guidanceText))}`
      : `USER GUIDANCE: (none)`,
  ].join('\n');

  const fullPromptSentToClaude = `${brandPrompt}\n\n${userMessage}`;

  try {
    const out = await callAnthropicRewriteBody({ systemPrompt: brandPrompt, userMessage });
    const nextBody = sanitizeText(out.text);
    if (!nextBody) throw new Error('Claude returned an empty body');

    // Emphasis ranges: run on all 6 bodies with slide N replaced by the new body; take ranges for N.
    const nextBodiesForEmphasis = bodies.slice();
    nextBodiesForEmphasis[slideIndex] = nextBody;
    const bodyRangesBySlide = await callAnthropicEmphasisRanges({
      slideTexts: nextBodiesForEmphasis,
      instructionText: emphasisInstruction,
    });
    const nextRanges = bodyRangesBySlide?.[slideIndex] || [];

    const inputContext = {
      slides: slidesInput,
      targetSlideNumber: slideIndex + 1,
      currentBody,
      rejectedBodies,
      guidanceText: guidanceText ? String(guidanceText) : '',
      promptSource,
    };

    await supabase.from('carousel_body_regen_attempts').insert({
      account_id: accountId,
      owner_user_id: user.id,
      project_id: projectId,
      slide_index: slideIndex,
      guidance_text: guidanceText && String(guidanceText).trim() ? String(guidanceText) : null,
      prompt_rendered: fullPromptSentToClaude,
      input_context: inputContext,
      output_body: nextBody,
      output_body_style_ranges: nextRanges,
    });

    return NextResponse.json({
      success: true,
      body: nextBody,
      bodyStyleRanges: nextRanges,
      debug: {
        model: out.model,
        promptSource,
        priorAttempts: rejectedBodies.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to regenerate body' }, { status: 500 });
  }
}

