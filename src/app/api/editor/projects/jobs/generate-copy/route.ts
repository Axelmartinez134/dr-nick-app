import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../../editor/_utils';

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

const DEFAULT_EMPHASIS_PROMPT_REGULAR = `You are a social-media typography editor for a 6-slide carousel.

GOAL:
Make the text instantly scannable for someone scrolling fast. Use your discernment to apply emphasis so the reader understands the key takeaway in 1–2 seconds.

WHAT YOU CAN DO:
Return inline style ranges using bold / italic / underline.

WHAT YOU MUST NOT DO (hard rules):
- Do NOT change any characters in the text (no edits, no punctuation changes, no extra spaces, no rewording).
- Do NOT add or remove slides.
- Do NOT emphasize everything. Less is more.
- Avoid emphasizing stopwords and filler ("the", "and", "that", "really", etc.).
- Do NOT create overlapping ranges that fight each other.

WHEN TO USE EACH STYLE (use judgment):
- Bold: key nouns/terms and the core takeaway words that drive comprehension.
- Italic: contrast operators ("not", "but", "instead") to sharpen meaning.
- Underline: use sparingly, only if one short phrase is the single most "scroll-stopping" takeaway.

PLACEMENT (to avoid randomness):
- Emphasis should typically land on words that change meaning or carry the takeaway.
- Prefer complete words/phrases (no mid-word emphasis).
- Don’t emphasize punctuation or whitespace.`;

const DEFAULT_EMPHASIS_PROMPT_ENHANCED = `You are a social-media typography editor for a 6-slide carousel.

GOAL:
Make the headline + body instantly scannable for someone scrolling fast. Use your discernment to apply emphasis so the reader understands the key takeaway in 1–2 seconds.

WHAT YOU CAN DO:
Return inline style ranges using bold / italic / underline.

WHAT YOU MUST NOT DO (hard rules):
- Do NOT change any characters in the text (no edits, no punctuation changes, no extra spaces, no rewording).
- Do NOT add or remove slides.
- Do NOT emphasize everything. Less is more.
- Avoid emphasizing stopwords and filler ("the", "and", "that", "really", etc.).
- Do NOT create overlapping ranges that fight each other.

WHEN TO USE EACH STYLE (use judgment):
- Bold: key nouns/terms and the core takeaway words that drive comprehension.
- Italic: contrast operators ("not", "but", "instead") to sharpen meaning.
- Underline: use sparingly, only if one short phrase is the single most "scroll-stopping" takeaway.

PLACEMENT (to avoid randomness):
- Emphasis should typically land on words that change meaning or carry the takeaway.
- Prefer complete words/phrases (no mid-word emphasis).
- Don’t emphasize punctuation or whitespace.`;

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

async function callPoppy(prompt: string) {
  const baseUrl = (process.env.POPPY_CONVERSATION_URL || '').trim();
  const apiKey = process.env.POPPY_API_KEY;
  const model = process.env.POPPY_MODEL || 'claude-3-7-sonnet-20250219';
  if (!baseUrl) throw new Error('Missing env var: POPPY_CONVERSATION_URL');
  if (!apiKey) throw new Error('Missing env var: POPPY_API_KEY');

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(
      'Invalid URL in env var POPPY_CONVERSATION_URL. It must be a full https URL like ' +
        '"https://api.getpoppy.ai/api/conversation?board_id=...&chat_id=...".'
    );
  }
  // Ensure api_key is present (we keep it server-side only).
  if (!url.searchParams.get('api_key')) url.searchParams.set('api_key', apiKey);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 45_000);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model }),
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Poppy error (${res.status}): ${text.slice(0, 500)}`);
    }
    return { rawText: text, model };
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
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
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

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });

  // Load project (and ensure ownership via RLS + explicit filter)
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id, template_type_id, prompt_snapshot')
    .eq('id', body.projectId)
    .eq('owner_user_id', user.id)
    .single();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || 'Project not found' }, { status: 404 });
  }

  const templateTypeId = project.template_type_id === 'enhanced' ? 'enhanced' : 'regular';
  const prompt = sanitizePrompt(project.prompt_snapshot || '');
  if (!prompt) return NextResponse.json({ success: false, error: 'Project prompt is empty' }, { status: 400 });

  // Create + lock a job (unique partial index blocks concurrent jobs).
  const { data: job, error: jobErr } = await supabase
    .from('carousel_generation_jobs')
    .insert({
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
    await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:poppy' });
    const poppy = await callPoppy(prompt);
    await updateJobProgress(supabase, jobId, { status: 'running', error: 'progress:parse' });
    const parsed = await callAnthropicParse({ templateTypeId, rawToParse: poppy.rawText });
    const payload = extractJsonObject(parsed.rawText);
    assertValidPayload(payload, templateTypeId);

    const slides = payload.slides as Array<{ headline?: string; body: string }>;
    const caption = payload.caption as string;

    // Load saved emphasis prompt for this template type (shared global defaults).
    const { data: ttRow } = await supabase
      .from('carousel_template_types')
      .select('default_emphasis_prompt')
      .eq('id', templateTypeId)
      .maybeSingle();
    const emphasisInstruction =
      String(ttRow?.default_emphasis_prompt || '').trim() ||
      (templateTypeId === 'enhanced' ? DEFAULT_EMPHASIS_PROMPT_ENHANCED : DEFAULT_EMPHASIS_PROMPT_REGULAR);

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
    await Promise.all(
      slides.map((s, idx) => {
        const patch: any = {
          headline: templateTypeId === 'enhanced' ? (s.headline || '') : null,
          body: s.body || '',
        };
        patch.input_snapshot = {
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
    return NextResponse.json({ success: false, error: msg, jobId }, { status: 500 });
  }
}


