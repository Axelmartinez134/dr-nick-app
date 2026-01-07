import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../../editor/_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  projectId: string;
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
    const poppy = await callPoppy(prompt);
    const parsed = await callAnthropicParse({ templateTypeId, rawToParse: poppy.rawText });
    const payload = extractJsonObject(parsed.rawText);
    assertValidPayload(payload, templateTypeId);

    const slides = payload.slides as Array<{ headline?: string; body: string }>;
    const caption = payload.caption as string;

    // Persist slides (overwrite everything model)
    await Promise.all(
      slides.map((s, idx) =>
        supabase
          .from('carousel_project_slides')
          .update({
            headline: templateTypeId === 'enhanced' ? (s.headline || '') : null,
            body: s.body || '',
          })
          .eq('project_id', project.id)
          .eq('slide_index', idx)
      )
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
      slides: slides.map((s) => ({
        headline: templateTypeId === 'enhanced' ? (s.headline || '') : null,
        body: s.body || '',
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


