import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';
import { requireDeepseekApiKey } from '../_deepseek';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Body = {
  caption?: string | null;
  transcript?: string | null;
};

type Resp =
  | { success: true; topicLine: string; model: string }
  | { success: false; error: string };

async function requireSuperadmin(supabase: any, userId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (saErr) return { ok: false, status: 500, error: saErr.message };
  if (!saRow?.user_id) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

function s(v: any): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function clipText(text: string, max: number): string {
  const t = String(text || '');
  return t.length > max ? t.slice(0, max) : t;
}

function extractJsonObject(text: string): any {
  const s = String(text || '');
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('Model did not return JSON');
  const raw = s.slice(first, last + 1);
  return JSON.parse(raw);
}

function validateTopicLine(payload: any): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Output must be a JSON object');
  const tl = typeof (payload as any).topicLine === 'string' ? (payload as any).topicLine : '';
  const out = tl.trim().replace(/^"+|"+$/g, '');
  if (!out) throw new Error('topicLine must be non-empty');
  if (out.length > 80) throw new Error('topicLine must be <= 80 chars');
  // Keep it "label-like" for insertion into a sentence.
  return out;
}

function buildPrompt(args: { caption: string; transcript: string }): string {
  // Keep it simple + deterministic: we only need a short noun phrase.
  // We will insert this into: "made you this carousel from one of your recent posts about {topicLine}."
  return [
    `You are an assistant that generates a short topic label for an Instagram Reel/Post.`,
    ``,
    `TASK: Return a concise topic line that describes what the post is mainly about.`,
    `RULES:`,
    `- 3 to 7 words`,
    `- No punctuation at the end`,
    `- No quotes`,
    `- No hashtags`,
    `- No @mentions`,
    `- Avoid generic phrases like "this" or "my life"`,
    `- Output MUST be strict JSON only (no markdown, no extra text)`,
    ``,
    `INPUT CAPTION:`,
    clipText(args.caption, 2000),
    ``,
    `INPUT TRANSCRIPT (may be empty):`,
    clipText(args.transcript, 4000),
    ``,
    `Respond ONLY with JSON in this exact shape:`,
    `{"topicLine":"<3-7 word topic>"}`,
  ].join('\n');
}

async function callDeepseekChat(opts: { apiKey: string; prompt: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a precise JSON-only generator.' },
          { role: 'user', content: opts.prompt },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = String(j?.error?.message || j?.error || `DeepSeek error (${res.status})`);
      throw new Error(msg);
    }
    const text = String(j?.choices?.[0]?.message?.content || '').trim();
    const model = String(j?.model || 'deepseek-chat');
    if (!text) throw new Error('DeepSeek returned empty content');
    return { text, model };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });

  let body: Body | null = null;
  try {
    body = (await req.json()) as any;
  } catch {
    // ignore
  }

  const caption = s((body as any)?.caption).trim();
  const transcript = s((body as any)?.transcript).trim();
  if (!caption && !transcript) {
    return NextResponse.json({ success: false, error: 'caption or transcript is required' } satisfies Resp, { status: 400 });
  }

  try {
    const apiKey = requireDeepseekApiKey();
    const prompt = buildPrompt({ caption, transcript });
    const out = await callDeepseekChat({ apiKey, prompt });
    const payload = extractJsonObject(out.text);
    const topicLine = validateTopicLine(payload);
    return NextResponse.json({ success: true, topicLine, model: out.model } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e || 'Topic line failed') } satisfies Resp, { status: 500 });
  }
}

