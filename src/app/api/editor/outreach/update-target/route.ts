import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase, getActiveAccountIdHeader } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Body = {
  id: string;
  patch: {
    sourcePostTranscript?: string | null;
    sourcePostVideoStorageBucket?: string | null;
    sourcePostVideoStoragePath?: string | null;
    sourcePostWhisperUsed?: boolean | null;
  };
};

type Resp =
  | { success: true }
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

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });

  let body: Body | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }

  const id = s((body as any)?.id);
  const patchIn = (body as any)?.patch ?? null;
  if (!id) return NextResponse.json({ success: false, error: 'id is required' } satisfies Resp, { status: 400 });
  if (!patchIn || typeof patchIn !== 'object') {
    return NextResponse.json({ success: false, error: 'patch is required' } satisfies Resp, { status: 400 });
  }

  const patch: any = {};
  if ((patchIn as any).sourcePostTranscript !== undefined) patch.source_post_transcript = s((patchIn as any).sourcePostTranscript);
  if ((patchIn as any).sourcePostVideoStorageBucket !== undefined)
    patch.source_post_video_storage_bucket = s((patchIn as any).sourcePostVideoStorageBucket);
  if ((patchIn as any).sourcePostVideoStoragePath !== undefined) patch.source_post_video_storage_path = s((patchIn as any).sourcePostVideoStoragePath);
  if ((patchIn as any).sourcePostWhisperUsed !== undefined)
    patch.source_post_whisper_used = typeof (patchIn as any).sourcePostWhisperUsed === 'boolean' ? (patchIn as any).sourcePostWhisperUsed : null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' } satisfies Resp, { status: 400 });
  }

  const svc = serviceClient();
  if (!svc) return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } satisfies Resp, { status: 500 });

  // account_id is metadata on outreach_targets; use header if present to avoid cross-account accidents.
  const accountId = getActiveAccountIdHeader(request);

  const q = svc.from('editor_outreach_targets').update(patch).eq('id', id);
  const { error } = await (accountId ? q.eq('account_id', accountId) : q);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  return NextResponse.json({ success: true } satisfies Resp);
}

