import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { scrapeInstagramReelViaApify } from '@/app/api/editor/outreach/_apify';
import { scrapeYoutubeViaApifyKaramelo } from '@/app/api/swipe-file/_apify';
import {
  downloadMp4FromUrl,
  requireOpenAiKey,
  requireServiceClient,
  uploadMp4ToReelsBucket,
  whisperTranscribeMp4Bytes,
} from '@/app/api/_shared/reel_media';
import {
  canonicalizeInstagramUrl,
  canonicalizeYoutubeWatchUrl,
  getAuthedSwipeSuperadminContext,
  isInstagramReelOrPostUrl,
  isYoutubeWatchUrl,
  s,
} from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 210;

type Resp = { success: true } | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(v);
}

function decodeHtmlEntities(input: string): string {
  const raw = String(input || '');
  if (!raw) return '';
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, num) => {
      const code = Number.parseInt(String(num), 10);
      if (!Number.isFinite(code)) return _m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _m;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const code = Number.parseInt(String(hex), 16);
      if (!Number.isFinite(code)) return _m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _m;
      }
    });
}

function cleanTranscriptText(input: string): string {
  let t = decodeHtmlEntities(input);
  // Strip simple HTML tags (e.g. <i>...</i>).
  t = t.replace(/<[^>]*>/g, '');
  // Remove common “quote” markers that appear in some transcripts.
  t = t.replace(/\s*>>\s*/g, ' ');
  // Normalize whitespace.
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log('[swipe-file][enrich]', ...args);
}

function safeShortcode(v: any): string | null {
  const sc = typeof v === 'string' ? v.trim() : '';
  if (!sc) return null;
  const cleaned = sc.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned ? cleaned : null;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedSwipeSuperadminContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, accountId } = auth;

  const { id } = await ctx.params;
  const itemId = String(id || '').trim();
  if (!itemId || !isUuid(itemId)) return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });

  log('start', { itemId, accountId });

  // Load item (account-scoped)
  const { data: item, error: itemErr } = await supabase
    .from('swipe_file_items')
    .select('id, url, platform, enrich_status')
    .eq('id', itemId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (itemErr) return NextResponse.json({ success: false, error: itemErr.message } satisfies Resp, { status: 500 });
  if (!item?.id) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

  const platform = String((item as any)?.platform || 'unknown').trim();
  const urlRaw = String((item as any)?.url || '').trim();
  const url =
    platform === 'instagram'
      ? canonicalizeInstagramUrl(urlRaw)
      : platform === 'youtube'
        ? canonicalizeYoutubeWatchUrl(urlRaw)
        : urlRaw;
  log('loaded', { platform, url, enrichStatus: String((item as any)?.enrich_status || '') });
  if (platform !== 'instagram' && platform !== 'youtube') {
    return NextResponse.json({ success: false, error: 'Enrichment V2 only supports Instagram + YouTube' } satisfies Resp, { status: 400 });
  }
  if (platform === 'instagram' && !isInstagramReelOrPostUrl(url)) {
    return NextResponse.json({ success: false, error: 'Invalid Instagram Reel/Post URL' } satisfies Resp, { status: 400 });
  }
  if (platform === 'youtube' && !isYoutubeWatchUrl(url)) {
    return NextResponse.json(
      { success: false, error: 'Only youtube.com/watch?v=... video URLs are supported right now.' } satisfies Resp,
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
    if (platform === 'youtube') {
      log('apify begin (youtube karamelo)', { outputFormat: 'captions' });

      const raw = await scrapeYoutubeViaApifyKaramelo({ videoUrl: url });
      const title = s((raw as any)?.title);
      const channelName = s((raw as any)?.channelName);
      const thumbnailUrl = s((raw as any)?.thumbnailUrl);
      const description = s((raw as any)?.description);

      const captionsAny = (raw as any)?.captions ?? null;
      let transcriptRaw: string | null = null;

      if (Array.isArray(captionsAny)) {
        // Most common: array of strings.
        const strings = (captionsAny as any[])
          .map((x) => (typeof x === 'string' ? x : typeof (x as any)?.text === 'string' ? String((x as any).text) : ''))
          .map((x) => String(x || '').trim())
          .filter(Boolean);
        transcriptRaw = strings.length ? strings.join(' ') : null;
      } else if (typeof captionsAny === 'string') {
        transcriptRaw = String(captionsAny || '').trim() || null;
      }

      const transcript = transcriptRaw ? cleanTranscriptText(transcriptRaw) : null;
      if (!transcript) {
        throw new Error('English transcript not available for this YouTube video.');
      }

      const { error: upErr } = await supabase
        .from('swipe_file_items')
        .update({
          url,
          enrich_status: 'ok',
          enrich_error: null,
          enriched_at: new Date().toISOString(),
          caption: description || null,
          transcript,
          author_handle: channelName,
          title,
          thumb_url: thumbnailUrl,
          raw_json: raw ?? null,
          source_captions_json: captionsAny ?? null,
          // Ensure YouTube never looks like it used the IG reel media pipeline.
          source_post_shortcode: null,
          source_post_video_storage_bucket: null,
          source_post_video_storage_path: null,
          source_post_whisper_used: null,
        } as any)
        .eq('id', itemId)
        .eq('account_id', accountId);
      if (upErr) throw new Error(upErr.message);

      log('done (youtube)', { itemId });
      return NextResponse.json({ success: true } satisfies Resp);
    }

    // 1) Apify scrape (metadata)
    log('apify begin', { includeTranscript: true, includeDownloadedVideo: true });
    const scraped = await scrapeInstagramReelViaApify({ reelUrl: url, includeTranscript: true, includeDownloadedVideo: true });
    const caption = typeof (scraped as any)?.caption === 'string' ? String((scraped as any).caption || '').trim() : null;
    const apifyTranscript = typeof (scraped as any)?.transcript === 'string' ? String((scraped as any).transcript || '').trim() : null;
    const authorHandle =
      typeof (scraped as any)?.ownerUsername === 'string' ? String((scraped as any).ownerUsername || '').trim() || null : null;
    const shortcode = safeShortcode((scraped as any)?.shortcode) || 'reel';

    // 2) Prefer the Outreach "download+whisper" path when available; fall back to Apify transcript.
    let transcript: string | null = apifyTranscript && apifyTranscript.trim() ? apifyTranscript.trim() : null;
    let whisperUsed: boolean | null = null;
    let storageBucket: string | null = null;
    let storagePath: string | null = null;

    const downloadedVideoUrl = String((scraped as any)?.downloadedVideoUrl || '').trim();
    if (downloadedVideoUrl) {
      try {
        const svc = requireServiceClient();
        const apiKey = requireOpenAiKey();

        log('video download begin');
        const buf = await downloadMp4FromUrl(downloadedVideoUrl);
        log('video download ok', { bytes: buf.length });

        const path = `accounts/${accountId}/swipe-file/items/${itemId}/${shortcode}.mp4`;
        log('storage upload begin', { path });
        await uploadMp4ToReelsBucket({ svc, path, buf });
        storageBucket = 'reels';
        storagePath = path;
        log('storage upload ok', { bucket: storageBucket, path: storagePath });

        log('whisper begin');
        const out = await whisperTranscribeMp4Bytes({
          apiKey,
          mp4Bytes: new Uint8Array(buf),
          filename: `${shortcode}.mp4`,
        });
        const w = String(out.text || '').trim();
        if (w) {
          transcript = w;
          whisperUsed = true;
          log('whisper ok', { chars: transcript.length });
        } else {
          log('whisper empty; falling back to apify transcript');
        }
      } catch (e: any) {
        log('whisper pipeline failed; falling back to apify transcript', { msg: String(e?.message || e || '') });
      }
    } else {
      log('no downloadedVideoUrl from apify; using apify transcript if present');
    }

    const nextStatus = transcript ? 'ok' : 'needs_transcript';
    log('apify ok', {
      hasCaption: !!(caption && caption.trim()),
      hasTranscript: !!(transcript && transcript.trim()),
      nextStatus,
      authorHandle,
    });

    const { error: upErr } = await supabase
      .from('swipe_file_items')
      .update({
        url,
        enrich_status: nextStatus,
        enrich_error: null,
        enriched_at: new Date().toISOString(),
        caption: caption || null,
        transcript: transcript || null,
        author_handle: authorHandle,
        raw_json: (scraped as any)?.raw ?? null,
        source_post_shortcode: shortcode,
        source_post_video_storage_bucket: storageBucket,
        source_post_video_storage_path: storagePath,
        source_post_whisper_used: whisperUsed,
      } as any)
      .eq('id', itemId)
      .eq('account_id', accountId);
    if (upErr) throw new Error(upErr.message);

    log('done', { itemId, nextStatus });
    return NextResponse.json({ success: true } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || e || 'Enrich failed');
    log('error', { itemId, msg });
    await supabase
      .from('swipe_file_items')
      .update({ enrich_status: 'error', enrich_error: msg } as any)
      .eq('id', itemId)
      .eq('account_id', accountId);
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status: 500 });
  }
}

