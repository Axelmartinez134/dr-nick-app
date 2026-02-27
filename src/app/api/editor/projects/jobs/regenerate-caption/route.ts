import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  projectId: string;
};

function sanitizeText(input: string): string {
  // Remove ASCII control chars that can break JSON payloads/logging,
  // but preserve common whitespace formatting (tabs/newlines).
  return String(input || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .trim();
}

function buildDefaultCaptionPrompt(): string {
  return `Remake this caption.`;
}

async function callAnthropicCaption(opts: { systemPrompt: string; userMessage: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  // Keep consistent with other editor Claude calls (image prompts).
  const model = 'claude-sonnet-4-5-20250929';

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
        max_tokens: 2500,
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

  // Load project (caption + title) in active account.
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id, title, caption')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || 'Project not found' }, { status: 404 });
  }

  // Load all 6 slides (headline/body). (Regular can have null headline; normalize to empty string.)
  const { data: slides, error: slidesErr } = await supabase
    .from('carousel_project_slides')
    .select('slide_index, headline, body')
    .eq('project_id', projectId)
    .order('slide_index', { ascending: true });
  if (slidesErr || !slides || slides.length !== 6) {
    return NextResponse.json({ success: false, error: 'Could not load slides' }, { status: 500 });
  }

  // Phase E: per-account prompt override (shared within account).
  const { data: settingsRow } = await supabase
    .from('editor_account_settings')
    .select('caption_regen_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  const systemPromptRaw =
    String((settingsRow as any)?.caption_regen_prompt_override || '').trim() || buildDefaultCaptionPrompt();
  const systemPrompt = sanitizeText(systemPromptRaw);

  // Load prior runs (all) to give "rejected attempts" context.
  const { data: priorRuns } = await (async () => {
    // Phase 2026-02: support excluding specific runs from future prompt context (superadmin toggle).
    const res = await supabase
      .from('carousel_caption_regen_runs')
      .select('output_caption, created_at')
      .eq('project_id', projectId)
      // Phase G: account-scoped caption regen history (shared within account).
      // Backwards-safe fallback for legacy rows.
      .or(`account_id.eq.${accountId},and(account_id.is.null,owner_user_id.eq.${user.id})`)
      .neq('excluded_from_prompt', true)
      .order('created_at', { ascending: true });

    const errMsg = String((res as any)?.error?.message || '');
    const missingCol = errMsg.toLowerCase().includes('excluded_from_prompt') && errMsg.toLowerCase().includes('column');
    if (!missingCol) return { data: (res as any).data || null, error: (res as any).error || null };

    // Backwards-safe: older DB without the column.
    const legacy = await supabase
      .from('carousel_caption_regen_runs')
      .select('output_caption, created_at')
      .eq('project_id', projectId)
      .or(`account_id.eq.${accountId},and(account_id.is.null,owner_user_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    return { data: (legacy as any).data || null, error: (legacy as any).error || null };
  })();
  const rejectedCaptions: string[] = (priorRuns || [])
    .map((r: any) => String(r?.output_caption || '').trim())
    .filter(Boolean);

  const slidesInput = slides
    .slice()
    .sort((a: any, b: any) => Number(a.slide_index) - Number(b.slide_index))
    .map((s: any, i: number) => ({
      slideNumber: i + 1,
      headline: String(s?.headline || ''),
      body: String(s?.body || ''),
    }));

  const currentCaption = String((project as any)?.caption || '');
  const title = String((project as any)?.title || '');

  const userMessage = [
    `You are writing a LinkedIn carousel caption.`,
    ``,
    `HARD REQUIREMENTS:`,
    `- Use ONLY the information in the carousel context + the system prompt.`,
    `- Choose whatever length is appropriate for the context (no need to force long/short).`,
    `- No emojis. No excessive caps.`,
    `- End with the standard CTA exactly as provided in the system prompt.`,
    `- Return ONLY the final caption text (no markdown, no quotes, no preamble).`,
    ``,
    `CAROUSEL CONTEXT (JSON):`,
    JSON.stringify(
      {
        projectTitle: title,
        slides: slidesInput,
        currentCaption,
        rejectedCaptions,
      },
      null,
      2
    ),
    ``,
    rejectedCaptions.length
      ? `NOTE: The rejectedCaptions are previous attempts the user disliked. Do NOT repeat their structure or phrasing; produce a meaningfully different caption.`
      : `NOTE: No prior attempts exist. Produce the best caption you can.`,
  ].join('\n');

  const fullPromptSentToClaude = `${systemPrompt}\n\n${userMessage}`;

  try {
    const out = await callAnthropicCaption({ systemPrompt, userMessage });
    const caption = sanitizeText(out.text);
    if (!caption) throw new Error('Claude returned an empty caption');

    // Persist run history
    const inputContext = {
      projectTitle: title,
      slides: slidesInput,
      currentCaption,
      rejectedCaptions,
    };
    await supabase.from('carousel_caption_regen_runs').insert({
      account_id: accountId,
      owner_user_id: user.id,
      project_id: projectId,
      prompt_rendered: fullPromptSentToClaude,
      input_context: inputContext,
      output_caption: caption,
    });

    // Persist the caption onto the project
    await supabase
      .from('carousel_projects')
      .update({ caption })
      .eq('id', projectId)
      .eq('account_id', accountId);

    return NextResponse.json({
      success: true,
      caption,
      debug: {
        promptSentToClaude: fullPromptSentToClaude,
        systemPrompt,
        model: out.model,
        priorAttempts: rejectedCaptions.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Failed to regenerate caption' },
      { status: 500 }
    );
  }
}

