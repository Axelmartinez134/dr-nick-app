import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';
import { scrapeInstagramReelViaApify } from '../_apify';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  reelUrl: string;
};

type Data = {
  reelUrl: string;
  shortcode: string | null;
  ownerUsername: string | null;
  ownerFullName: string | null;
  caption: string | null;
  transcript: string | null;
  downloadedVideoUrl: string | null;
  raw: any;
};

type Resp =
  | { success: true; data: Data }
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

  const reelUrl = String((body as any)?.reelUrl || '').trim();
  if (!reelUrl) {
    return NextResponse.json({ success: false, error: 'reelUrl is required' } satisfies Resp, { status: 400 });
  }

  try {
    const data = await scrapeInstagramReelViaApify({ reelUrl, includeTranscript: true, includeDownloadedVideo: false });
    return NextResponse.json({ success: true, data } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e || 'Scrape failed') } satisfies Resp, { status: 500 });
  }
}

