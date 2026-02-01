import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  projectId: string;
};

type Verdict = 'aligned' | 'needs_edits' | 'off_brand';
type Severity = 'low' | 'medium' | 'high';
type Area = 'global' | 'caption' | 'slide';

function sanitizeText(input: string): string {
  // Preserve tabs/newlines (like other prompt editors), but remove control chars that can break payloads/logging.
  return String(input || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .trim();
}

function extractJsonObject(text: string): any {
  const s = String(text || '');
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('Model did not return JSON');
  }
  const raw = s.slice(first, last + 1);
  return JSON.parse(raw);
}

function computeVerdict(score: number): Verdict {
  if (score >= 80) return 'aligned';
  if (score >= 50) return 'needs_edits';
  return 'off_brand';
}

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function assertNoExtraKeys(obj: Record<string, any>, allowed: string[], where: string) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) {
      throw new Error(`Unexpected field "${k}" in ${where}`);
    }
  }
}

function assertIntInRange(v: any, min: number, max: number, where: string) {
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new Error(`${where} must be an integer in [${min},${max}]`);
  }
}

function assertString(v: any, where: string) {
  if (typeof v !== 'string') throw new Error(`${where} must be a string`);
}

function assertStringArray(v: any, where: string, maxItems: number) {
  if (!Array.isArray(v)) throw new Error(`${where} must be an array`);
  if (v.length > maxItems) throw new Error(`${where} too long`);
  for (const [i, it] of v.entries()) {
    if (typeof it !== 'string' || !String(it).trim()) throw new Error(`${where}[${i}] must be a non-empty string`);
  }
}

function assertValidPayload(payload: any) {
  if (!isPlainObject(payload)) throw new Error('Output must be a JSON object');

  assertNoExtraKeys(
    payload,
    ['schemaVersion', 'verdict', 'overallScore', 'summary', 'checks', 'issues', 'caption', 'slides'],
    'root'
  );

  if (payload.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  assertIntInRange(payload.overallScore, 0, 100, 'overallScore');
  assertString(payload.summary, 'summary');
  if (!String(payload.summary).trim()) throw new Error('summary must be non-empty');

  // verdict is accepted but will be overwritten server-side (threshold-based)
  if (payload.verdict !== 'aligned' && payload.verdict !== 'needs_edits' && payload.verdict !== 'off_brand') {
    throw new Error('verdict must be one of aligned|needs_edits|off_brand');
  }

  // checks
  if (!isPlainObject(payload.checks)) throw new Error('checks must be an object');
  assertNoExtraKeys(
    payload.checks,
    ['noEmojis', 'noHypeyClaims', 'consistentVoice', 'clearCTA', 'slideToSlideConsistency', 'captionMatchesSlides'],
    'checks'
  );
  for (const k of Object.keys(payload.checks)) {
    if (typeof (payload.checks as any)[k] !== 'boolean') throw new Error(`checks.${k} must be boolean`);
  }

  // caption
  if (!isPlainObject(payload.caption)) throw new Error('caption must be an object');
  assertNoExtraKeys(payload.caption, ['score', 'notes', 'suggestedEdits'], 'caption');
  assertIntInRange(payload.caption.score, 0, 100, 'caption.score');
  assertStringArray(payload.caption.notes, 'caption.notes', 12);
  assertStringArray(payload.caption.suggestedEdits, 'caption.suggestedEdits', 10);

  // slides
  if (!Array.isArray(payload.slides) || payload.slides.length !== 6) throw new Error('slides must be an array of length 6');
  const seenIdx = new Set<number>();
  for (const [i, s] of payload.slides.entries()) {
    if (!isPlainObject(s)) throw new Error(`slides[${i}] must be an object`);
    assertNoExtraKeys(s, ['slideIndex', 'score', 'notes', 'suggestedEdits'], `slides[${i}]`);
    assertIntInRange(s.slideIndex, 0, 5, `slides[${i}].slideIndex`);
    if (seenIdx.has(s.slideIndex)) throw new Error('slides.slideIndex values must be unique');
    seenIdx.add(s.slideIndex);
    assertIntInRange(s.score, 0, 100, `slides[${i}].score`);
    assertStringArray(s.notes, `slides[${i}].notes`, 10);
    assertStringArray(s.suggestedEdits, `slides[${i}].suggestedEdits`, 8);
  }

  // issues
  if (!Array.isArray(payload.issues)) throw new Error('issues must be an array');
  if (payload.issues.length > 25) throw new Error('issues too long');
  for (const [i, it] of payload.issues.entries()) {
    if (!isPlainObject(it)) throw new Error(`issues[${i}] must be an object`);
    assertNoExtraKeys(it, ['severity', 'area', 'slideIndex', 'quote', 'message', 'recommendation'], `issues[${i}]`);
    if (it.severity !== 'low' && it.severity !== 'medium' && it.severity !== 'high') {
      throw new Error(`issues[${i}].severity invalid`);
    }
    if (it.area !== 'global' && it.area !== 'caption' && it.area !== 'slide') {
      throw new Error(`issues[${i}].area invalid`);
    }
    if (it.slideIndex !== null && it.slideIndex !== undefined) {
      assertIntInRange(it.slideIndex, 0, 5, `issues[${i}].slideIndex`);
    }
    if (it.quote !== null && it.quote !== undefined) {
      assertString(it.quote, `issues[${i}].quote`);
      if (String(it.quote).length > 400) throw new Error(`issues[${i}].quote too long`);
    }
    assertString(it.message, `issues[${i}].message`);
    assertString(it.recommendation, `issues[${i}].recommendation`);
    if (!String(it.message).trim()) throw new Error(`issues[${i}].message must be non-empty`);
    if (!String(it.recommendation).trim()) throw new Error(`issues[${i}].recommendation must be non-empty`);
  }
}

async function callAnthropic(opts: { systemPrompt: string; userMessage: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  // Use same model family as other /editor calls for consistency.
  const model = 'claude-sonnet-4-5-20250929';

  const ac = new AbortController();
  // This endpoint can be slower than caption regen because the "system prompt" can be large
  // and we request a structured JSON object. Keep under maxDuration (60s) but allow more room.
  const timeout = setTimeout(() => ac.abort(), 55_000);
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
        max_tokens: 3000,
        temperature: 0,
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
  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });

  // Load project in active account.
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id, title, caption')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || 'Project not found' }, { status: 404 });
  }

  // Load slides (headline/body). Ensure deterministic order 1→6.
  const { data: slides, error: slidesErr } = await supabase
    .from('carousel_project_slides')
    .select('slide_index, headline, body')
    .eq('project_id', projectId)
    .order('slide_index', { ascending: true });
  if (slidesErr || !slides || slides.length !== 6) {
    return NextResponse.json({ success: false, error: 'Could not load slides' }, { status: 500 });
  }

  // Load per-account brand prompt (blank by default; required to run).
  const { data: settingsRow, error: settingsErr } = await supabase
    .from('editor_account_settings')
    .select('brand_alignment_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  if (settingsErr) return NextResponse.json({ success: false, error: settingsErr.message }, { status: 500 });
  const systemPromptRaw = String((settingsRow as any)?.brand_alignment_prompt_override || '');
  const systemPrompt = sanitizeText(systemPromptRaw);
  if (!systemPrompt) {
    return NextResponse.json(
      { success: false, error: 'Brand Alignment Prompt is empty. Paste it first.' },
      { status: 400 }
    );
  }

  const slidesInput = (slides || []).map((s: any, i: number) => ({
    slideNumber: i + 1,
    headline: String(s?.headline || ''),
    body: String(s?.body || ''),
  }));

  const userMessage = [
    `Return ONLY valid JSON. No markdown.`,
    `Schema (HARD):`,
    `{`,
    `  "schemaVersion": 1,`,
    `  "verdict": "aligned" | "needs_edits" | "off_brand",`,
    `  "overallScore": 0-100,`,
    `  "summary": "string",`,
    `  "checks": {`,
    `    "noEmojis": boolean,`,
    `    "noHypeyClaims": boolean,`,
    `    "consistentVoice": boolean,`,
    `    "clearCTA": boolean,`,
    `    "slideToSlideConsistency": boolean,`,
    `    "captionMatchesSlides": boolean`,
    `  },`,
    `  "issues": [`,
    `    {`,
    `      "severity": "low"|"medium"|"high",`,
    `      "area": "global"|"caption"|"slide",`,
    `      "slideIndex": 0-5 | null,`,
    `      "quote": "string" | null,`,
    `      "message": "string",`,
    `      "recommendation": "string"`,
    `    }`,
    `  ],`,
    `  "caption": { "score": 0-100, "notes": ["..."], "suggestedEdits": ["..."] },`,
    `  "slides": [`,
    `    { "slideIndex": 0, "score": 0-100, "notes": ["..."], "suggestedEdits": ["..."] },`,
    `    { "slideIndex": 1, "score": 0-100, "notes": ["..."], "suggestedEdits": ["..."] },`,
    `    { "slideIndex": 2, "score": 0-100, "notes": ["..."], "suggestedEdits": ["..."] },`,
    `    { "slideIndex": 3, "score": 0-100, "notes": ["..."], "suggestedEdits": ["..."] },`,
    `    { "slideIndex": 4, "score": 0-100, "notes": ["..."], "suggestedEdits": ["..."] },`,
    `    { "slideIndex": 5, "score": 0-100, "notes": ["..."], "suggestedEdits": ["..."] }`,
    `  ]`,
    `}`,
    ``,
    `CONTEXT (JSON):`,
    JSON.stringify(
      {
        projectTitle: String((project as any)?.title || ''),
        caption: String((project as any)?.caption || ''),
        slides: slidesInput,
      },
      null,
      2
    ),
    ``,
    `Rules:`,
    `- Be strict and specific. Provide concrete, actionable recommendations.`,
    `- If you quote, quote exact phrases from the context.`,
  ].join('\n');

  const fullPromptSentToClaude = `${systemPrompt}\n\n${userMessage}`;

  try {
    const out = await callAnthropic({ systemPrompt, userMessage });
    const payload = extractJsonObject(out.text);
    assertValidPayload(payload);

    const overallScore = Number(payload.overallScore);
    const verdict = computeVerdict(overallScore);

    // Server-enforced verdict (threshold-based), regardless of model's verdict.
    const normalized = {
      ...payload,
      overallScore,
      verdict,
    };

    // Phase 2: Persist run history (account-scoped)
    const { error: runInsErr } = await supabase.from('carousel_brand_alignment_runs').insert({
      account_id: accountId,
      owner_user_id: user.id,
      project_id: projectId,
      system_prompt: systemPrompt,
      user_message: userMessage,
      output_json: normalized,
      overall_score: overallScore,
      verdict,
      model: out.model,
    });
    if (runInsErr) throw new Error(runInsErr.message || 'Failed to persist brand alignment run');

    return NextResponse.json({
      success: true,
      result: normalized,
      debug: {
        model: out.model,
        promptSentToClaude: fullPromptSentToClaude,
      },
    });
  } catch (e: any) {
    const name = String(e?.name || '');
    const message = String(e?.message || '');
    const isAbort =
      name === 'AbortError' ||
      message.toLowerCase().includes('aborted') ||
      message.toLowerCase().includes('abort');

    if (isAbort) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Brand alignment check timed out while waiting for the model. Try again (or shorten the Brand Alignment Prompt).',
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { success: false, error: String(e?.message || 'Brand alignment check failed') },
      { status: 500 }
    );
  }
}

