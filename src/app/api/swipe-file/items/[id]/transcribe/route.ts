import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { scrapeInstagramReelViaApify } from '@/app/api/editor/outreach/_apify';
import {
  downloadMp4FromUrl,
  requireOpenAiKey,
  requireServiceClient,
  uploadMp4ToReelsBucket,
  whisperTranscribeMp4Bytes,
} from '@/app/api/_shared/reel_media';
import { canonicalizeInstagramUrl, getAuthedSwipeSuperadminContext, isInstagramReelOrPostUrl } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 210;

type Resp = { success: true } | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(v);
}

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log('[swipe-file][transcribe]', ...args);
}

function extractDownloadedVideoUrl(raw: any): string | null {
  const first = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const fromArr = (v: any) => {
    if (!Array.isArray(v)) return null;
    for (const it of v) {
      const s = first(it);
      if (s) return s;
      const u = first((it as any)?.url);
      if (u) return u;
    }
    return null;
  };
  return (
    first(raw?.downloadedVideoUrl) ||
    first(raw?.downloadedVideoURL) ||
    first(raw?.downloaded_video_url) ||
    first(raw?.downloadedVideo) ||
    first(raw?.downloaded_video) ||
    first((raw?.downloadedVideo as any)?.url) ||
    first((raw?.downloaded_video as any)?.url) ||
    fromArr(raw?.downloadedVideos) ||
    fromArr(raw?.downloaded_videos) ||
    first(raw?.videoUrl) ||
    first(raw?.video_url) ||
    null
  );
}

function isInstagramTranscribableVideoUrl(urlRaw: string): boolean {
  const raw = String(urlRaw || '').trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const parts = String(u.pathname || '')
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    const kind = parts[0] || '';
    // We allow /p/ too because many IG "posts" are actually videos.
    // If it isn't a video, Apify simply won't return a downloadable MP4 URL and we'll error later.
    return kind === 'reel' || kind === 'reels' || kind === 'tv' || kind === 'p';
  } catch {
    return false;
  }
}

function extractShortcodeFromUrl(urlRaw: string): string | null {
  const raw = String(urlRaw || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const parts = String(u.pathname || '')
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    // /reel/<code>/, /tv/<code>/
    const code = parts[1] || '';
    return code ? code : null;
  } catch {
    return null;
  }
}

async function whisperTranscribeMp4(buf: Buffer): Promise<string> {
  const apiKey = requireOpenAiKey();
  log('whisper request', { bytes: buf.length });
  const out = await whisperTranscribeMp4Bytes({ apiKey, mp4Bytes: new Uint8Array(buf), filename: 'reel.mp4' });
  const text = typeof out?.text === 'string' ? String(out.text).trim() : '';
  if (!text) throw new Error('Whisper returned empty transcript');
  log('whisper ok', { chars: text.length });
  return text;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedSwipeSuperadminContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, accountId } = auth;

  const { id } = await ctx.params;
  const itemId = String(id || '').trim();
  if (!itemId || !isUuid(itemId)) return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });

  log('start', { itemId, accountId });

  const { data: item, error: itemErr } = await supabase
    .from('swipe_file_items')
    .select('id, url, platform, enrich_status, raw_json')
    .eq('id', itemId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (itemErr) return NextResponse.json({ success: false, error: itemErr.message } satisfies Resp, { status: 500 });
  if (!item?.id) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

  const platform = String((item as any)?.platform || 'unknown').trim();
  const urlRaw = String((item as any)?.url || '').trim();
  const url = platform === 'instagram' ? canonicalizeInstagramUrl(urlRaw) : urlRaw;
  log('loaded', { platform, url, enrichStatus: String((item as any)?.enrich_status || '') });
  if (platform !== 'instagram') {
    return NextResponse.json({ success: false, error: 'Transcribe V2 (Instagram-only)' } satisfies Resp, { status: 400 });
  }
  if (!isInstagramReelOrPostUrl(url)) {
    return NextResponse.json({ success: false, error: 'Invalid Instagram Reel/Post URL' } satisfies Resp, { status: 400 });
  }
  if (!isInstagramTranscribableVideoUrl(url)) {
    return NextResponse.json(
      { success: false, error: 'Transcription is only supported for Instagram Reel/TV/Post URLs.' } satisfies Resp,
      { status: 400 }
    );
  }

  // Mark running (best-effort; ignore if it fails).
  log('mark running');
  await supabase
    .from('swipe_file_items')
    .update({ enrich_status: 'running', enrich_error: null } as any)
    .eq('id', itemId)
    .eq('account_id', accountId);

  try {
    // Prefer a saved downloadedVideoUrl if present; otherwise rerun Apify with includeDownloadedVideo.
    const raw = (item as any)?.raw_json;
    const existingDownloaded = extractDownloadedVideoUrl(raw);

    const scraped = existingDownloaded
      ? null
      : await scrapeInstagramReelViaApify({ reelUrl: url, includeTranscript: false, includeDownloadedVideo: true });
    const downloadedVideoUrl = String(existingDownloaded || (scraped as any)?.downloadedVideoUrl || '').trim();
    if (!downloadedVideoUrl) {
      throw new Error(
        'Apify did not provide a downloadable video URL for this link. This can happen if Instagram blocks the download or the link is not a Reel/TV video.'
      );
    }
    log('download url ok', { hasExisting: !!existingDownloaded, urlPrefix: downloadedVideoUrl.slice(0, 60) });

    const buf = await downloadMp4FromUrl(downloadedVideoUrl);
    log('download ok', { bytes: buf.length });

    // Upload to storage (same as Outreach) so it’s repeatable.
    const svc = requireServiceClient();
    const shortcode =
      String((scraped as any)?.shortcode || (raw as any)?.shortCode || (raw as any)?.shortcode || extractShortcodeFromUrl(url) || '').trim() || 'reel';
    const safe = shortcode.replace(/[^a-zA-Z0-9_-]/g, '') || 'reel';
    const storagePath = `accounts/${accountId}/swipe-file/items/${itemId}/${safe}.mp4`;
    await uploadMp4ToReelsBucket({ svc, path: storagePath, buf });

    const transcript = await whisperTranscribeMp4(buf);

    const nextRaw = (scraped as any)?.raw ? (scraped as any).raw : raw ?? null;
    const { error: upErr } = await supabase
      .from('swipe_file_items')
      .update({
        url,
        enrich_status: 'ok',
        enrich_error: null,
        enriched_at: new Date().toISOString(),
        transcript,
        raw_json: nextRaw,
        source_post_shortcode: safe,
        source_post_video_storage_bucket: 'reels',
        source_post_video_storage_path: storagePath,
        source_post_whisper_used: true,
      } as any)
      .eq('id', itemId)
      .eq('account_id', accountId);
    if (upErr) throw new Error(upErr.message);

    log('done', { itemId });
    return NextResponse.json({ success: true } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || e || 'Transcribe failed');
    log('error', { itemId, msg });
    await supabase
      .from('swipe_file_items')
      .update({ enrich_status: 'error', enrich_error: msg } as any)
      .eq('id', itemId)
      .eq('account_id', accountId);
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status: 500 });
  }
}

