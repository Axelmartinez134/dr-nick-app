import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  bucket: 'reels';
  path: string;
};

type Resp =
  | { success: true; transcript: string }
  | { success: false; error: string };

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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

function s(v: any): string | null {
  const out = typeof v === 'string' ? v.trim() : '';
  return out ? out : null;
}

function requireOpenAiKey(): string {
  const k = String(process.env.OPENAI_API_KEY || '').trim();
  if (!k) throw new Error('Server missing OPENAI_API_KEY');
  return k;
}

function cleanPath(p: any): string | null {
  const raw = s(p);
  if (!raw) return null;
  return raw.replace(/^\/+/, '');
}

async function whisperTranscribeMp4(args: { apiKey: string; mp4Bytes: Uint8Array; filename: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const form = new FormData();
    // Node 20 provides File.
    const f = new File([args.mp4Bytes], args.filename, { type: 'video/mp4' });
    form.append('file', f);
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${args.apiKey}` },
      body: form,
      signal: controller.signal,
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = String(j?.error?.message || j?.error || `Whisper failed (${res.status})`);
      throw new Error(msg);
    }
    const text = typeof j?.text === 'string' ? j.text : '';
    return { text };
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

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body | null = null;
  try {
    body = (await req.json()) as any;
  } catch {
    // ignore
  }

  const bucket = String((body as any)?.bucket || '').trim();
  const path = cleanPath((body as any)?.path);
  if (bucket !== 'reels') return NextResponse.json({ success: false, error: 'bucket must be "reels"' } satisfies Resp, { status: 400 });
  if (!path) return NextResponse.json({ success: false, error: 'path is required' } satisfies Resp, { status: 400 });

  // Safety: only allow reading from the active account's namespace.
  const requiredPrefix = `accounts/${accountId}/`;
  if (!path.startsWith(requiredPrefix)) {
    return NextResponse.json({ success: false, error: 'Forbidden (path not in active account)' } satisfies Resp, { status: 403 });
  }

  const svc = serviceClient();
  if (!svc) return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } satisfies Resp, { status: 500 });

  try {
    const apiKey = requireOpenAiKey();

    const { data, error } = await svc.storage.from('reels').download(path);
    if (error || !data) throw new Error(error?.message || 'Failed to download video from storage');
    const ab = await data.arrayBuffer();
    const bytes = new Uint8Array(ab);
    if (!bytes.length) throw new Error('Downloaded video is empty');

    const filename = (path.split('/').pop() || 'reel.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
    const out = await whisperTranscribeMp4({ apiKey, mp4Bytes: bytes, filename });
    const transcript = String(out.text || '').trim();
    if (!transcript) throw new Error('Whisper returned empty transcript');

    return NextResponse.json({ success: true, transcript } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e || 'Transcription failed') } satisfies Resp, { status: 500 });
  }
}

