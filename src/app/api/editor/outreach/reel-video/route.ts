import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';
import { scrapeInstagramReelViaApify } from '../_apify';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  reelUrl: string;
  shortcode?: string | null;
  projectId: string;
};

type Resp =
  | { success: true; bucket: 'reels'; path: string }
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

function safeShortcode(v: any): string | null {
  const sc = s(v);
  if (!sc) return null;
  // IG shortcodes are typically URL-safe base64-ish; keep permissive but no slashes.
  const cleaned = sc.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned ? cleaned : null;
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }

  const reelUrl = s((body as any)?.reelUrl);
  const projectId = s((body as any)?.projectId);
  const shortcodeHint = safeShortcode((body as any)?.shortcode);
  if (!reelUrl) return NextResponse.json({ success: false, error: 'reelUrl is required' } satisfies Resp, { status: 400 });
  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' } satisfies Resp, { status: 400 });

  const svc = serviceClient();
  if (!svc) return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } satisfies Resp, { status: 500 });

  // 1) Run Apify with includeDownloadedVideo so we get a stable 3-day URL.
  const scraped = await scrapeInstagramReelViaApify({ reelUrl, includeTranscript: false, includeDownloadedVideo: true });
  const downloadedVideoUrl = s((scraped as any)?.downloadedVideoUrl);
  if (!downloadedVideoUrl) {
    return NextResponse.json({ success: false, error: 'Apify did not return downloadedVideoUrl' } satisfies Resp, { status: 500 });
  }

  // 2) Download the MP4 server-side.
  const vidRes = await fetch(downloadedVideoUrl, { method: 'GET' });
  if (!vidRes.ok) {
    return NextResponse.json(
      { success: false, error: `Failed to download reel video (${vidRes.status})` } satisfies Resp,
      { status: 400 }
    );
  }
  const buf = Buffer.from(await vidRes.arrayBuffer());

  // 3) Upload to Supabase Storage (bucket must exist; created manually in Supabase UI).
  const bucket = 'reels' as const;
  const shortcode = shortcodeHint || safeShortcode(scraped.shortcode) || 'reel';
  const path = `accounts/${accountId}/projects/${projectId}/${shortcode}.mp4`;

  const { error: upErr } = await svc.storage.from(bucket).upload(path, buf, {
    upsert: true,
    contentType: 'video/mp4',
  });
  if (upErr) {
    return NextResponse.json({ success: false, error: upErr.message } satisfies Resp, { status: 400 });
  }

  return NextResponse.json({ success: true, bucket, path } satisfies Resp);
}

