import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';
import { requireDeepseekApiKey } from '../_deepseek';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  items: Array<{
    username: string | null;
    fullName: string | null;
    profilePicUrl: string | null;
    isVerified: boolean | null;
    isPrivate: boolean | null;
    raw: any;
  }>;
};

type Qual = {
  score: number;
  niche: string;
  reason: string;
  has_offer: boolean;
  credential: string | null;
};

type RowResp =
  | { username: string; ok: true; data: Qual; model: string }
  | { username: string; ok: false; error: string };

type Resp =
  | { success: true; results: RowResp[] }
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

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function extractJsonObject(text: string): any {
  const s = String(text || '');
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('Model did not return JSON');
  const raw = s.slice(first, last + 1);
  return JSON.parse(raw);
}

function assertIntInRange(v: any, min: number, max: number, where: string) {
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new Error(`${where} must be an integer in [${min},${max}]`);
  }
}

function assertString(v: any, where: string) {
  if (typeof v !== 'string') throw new Error(`${where} must be a string`);
}

function assertBoolean(v: any, where: string) {
  if (typeof v !== 'boolean') throw new Error(`${where} must be a boolean`);
}

function assertStringOrNull(v: any, where: string) {
  if (v === null) return;
  if (typeof v !== 'string') throw new Error(`${where} must be a string or null`);
}

function validateQual(payload: any): Qual {
  if (!isPlainObject(payload)) throw new Error('Output must be a JSON object');
  assertIntInRange(payload.score, 0, 100, 'score');
  assertString(payload.niche, 'niche');
  assertString(payload.reason, 'reason');
  assertBoolean(payload.has_offer, 'has_offer');
  assertStringOrNull(payload.credential, 'credential');

  const niche = String(payload.niche || '').trim();
  const reason = String(payload.reason || '').trim();
  if (!niche) throw new Error('niche must be non-empty');
  if (!reason) throw new Error('reason must be non-empty');

  const credential =
    payload.credential === null ? null : String(payload.credential || '').trim() ? String(payload.credential).trim() : null;

  return {
    score: Number(payload.score),
    niche,
    reason,
    has_offer: Boolean(payload.has_offer),
    credential,
  };
}

function buildPrompt(args: {
  username: string;
  fullName: string | null;
  isVerified: boolean | null;
  isPrivate: boolean | null;
  profilePicUrl: string | null;
  raw: any;
}): string {
  const uname = String(args.username || '').replace(/^@+/, '').trim();
  const profileUrl = uname ? `https://www.instagram.com/${uname}/` : '';
  const metadataJson = JSON.stringify(args.raw ?? {}, null, 2);

  return [
    `You are a lead qualification agent for an Instagram carousel content service. Your job is to score how likely this Instagram profile is a qualified prospect.`,
    ``,
    `IDEAL CLIENT PROFILE:`,
    `- Health, wellness, fitness, nutrition, or functional medicine professional`,
    `- Has a coaching program, course, or transformation offer they sell`,
    `- Active on Instagram as a business channel (not just personal use)`,
    `- Follower range: 10K-150K (sweet spot is 20K-100K)`,
    `- Likely posts educational or motivational content`,
    `- Bonus: medical doctor, naturopath, chiropractor, dietitian, or licensed practitioner with credentials`,
    ``,
    `DISQUALIFY:`,
    `- Brand accounts or companies (supplement brands, gym chains, software companies)`,
    `- Meme pages, aggregator accounts, or media outlets`,
    `- Business coaches who teach marketing (they are the competition, not the client)`,
    `- Personal accounts with no business indicators`,
    `- Accounts with 500K+ followers (too large, different needs)`,
    `- Accounts with under 5K followers (too small, unlikely to pay)`,
    ``,
    `SCORING CRITERIA (0-100):`,
    `- 0-20: Not a match (wrong niche, brand account, too small/large, no business signals)`,
    `- 21-40: Weak match (tangentially related to health/wellness but missing key signals)`,
    `- 41-60: Moderate match (right niche but unclear if they sell programs or unclear follower range)`,
    `- 61-80: Strong match (right niche, likely sells programs, reasonable follower count)`,
    `- 81-100: Ideal match (health/wellness professional, clear coaching offer, 20K-100K followers, credentials visible)`,
    ``,
    `INPUT DATA:`,
    `Username: ${uname}`,
    `Full Name: ${String(args.fullName || '').trim() || '—'}`,
    `Is Verified: ${args.isVerified === null ? '—' : args.isVerified ? 'true' : 'false'}`,
    `Is Private: ${args.isPrivate === null ? '—' : args.isPrivate ? 'true' : 'false'}`,
    `Profile Photo URL: ${String(args.profilePicUrl || '').trim() || '—'}`,
    `Profile URL: ${profileUrl || '—'}`,
    `Metadata JSON: ${metadataJson}`,
    ``,
    `Respond ONLY in this exact JSON format, nothing else:`,
    `{"score": <number>, "niche": "<2-4 word niche label>", "reason": "<one sentence>", "has_offer": <true/false>, "credential": "<credential if visible, otherwise null>"}`,
  ].join('\n');
}

async function callDeepseekChat(opts: { apiKey: string; prompt: string }) {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 25_000);
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0,
        max_tokens: 300,
        messages: [{ role: 'user', content: opts.prompt }],
      }),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || json?.message || 'DeepSeek API error';
      throw new Error(String(msg));
    }
    const text = String(json?.choices?.[0]?.message?.content || '');
    return { text, model: String(json?.model || 'deepseek-chat') };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let nextIdx = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
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
  const itemsRaw = Array.isArray((body as any)?.items) ? ((body as any).items as any[]) : [];
  if (!itemsRaw.length) {
    return NextResponse.json({ success: false, error: 'items is required' } satisfies Resp, { status: 400 });
  }
  if (itemsRaw.length > 50) {
    return NextResponse.json({ success: false, error: 'Too many items (max 50)' } satisfies Resp, { status: 400 });
  }

  const apiKey = requireDeepseekApiKey();

  // Only score items that have a usable username.
  const toScore = itemsRaw
    .map((it) => ({
      username: String(it?.username || '').replace(/^@+/, '').trim(),
      fullName: typeof it?.fullName === 'string' ? it.fullName : it?.fullName ?? null,
      profilePicUrl: typeof it?.profilePicUrl === 'string' ? it.profilePicUrl : it?.profilePicUrl ?? null,
      isVerified: typeof it?.isVerified === 'boolean' ? it.isVerified : it?.isVerified ?? null,
      isPrivate: typeof it?.isPrivate === 'boolean' ? it.isPrivate : it?.isPrivate ?? null,
      raw: it?.raw ?? null,
    }))
    .filter((it) => !!it.username);

  if (!toScore.length) {
    return NextResponse.json({ success: false, error: 'No items had a valid username' } satisfies Resp, { status: 400 });
  }

  const results = await mapWithConcurrency(toScore, 3, async (it) => {
    try {
      const prompt = buildPrompt(it);
      const out = await callDeepseekChat({ apiKey, prompt });
      const payload = extractJsonObject(out.text);
      const data = validateQual(payload);
      return { username: it.username, ok: true as const, data, model: out.model } satisfies RowResp;
    } catch (e: any) {
      return { username: it.username, ok: false as const, error: String(e?.message || e || 'Qualification failed') } satisfies RowResp;
    }
  });

  return NextResponse.json({ success: true, results } satisfies Resp);
}

