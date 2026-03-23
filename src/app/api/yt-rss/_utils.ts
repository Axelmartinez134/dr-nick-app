import 'server-only';

import { NextRequest } from 'next/server';
import Parser from 'rss-parser';
import { XMLParser } from 'fast-xml-parser';
import { getAuthedSupabase, resolveActiveAccountId } from '../editor/_utils';
import { requireSuperadmin } from '../swipe-file/_utils';

export const runtime = 'nodejs';

export const YT_RSS_MIRROR_CATEGORY_NAME = 'YouTube Creator Feed';
const YOUTUBE_BROWSER_UA = 'Mozilla/5.0 (compatible; DrNickBot/1.0; +https://www.youtube.com/)';

type YoutubeFeedItemParsed = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  videoId?: string;
  channelId?: string;
};

type YtInitialText = { simpleText?: string; runs?: Array<{ text?: string }> };

type YtInitialVideoRenderer = {
  videoId?: string;
  title?: YtInitialText;
  thumbnail?: { thumbnails?: Array<{ url?: string }> };
  publishedTimeText?: YtInitialText;
  viewCountText?: YtInitialText;
  shortViewCountText?: YtInitialText;
  descriptionSnippet?: YtInitialText;
  ownerText?: YtInitialText;
};

export type YoutubeFeedVideo = {
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  description: string | null;
  publishedAt: string;
  viewCount: number | null;
  likeCount: number | null;
  rawXml: string | null;
};

export type YoutubeVideoOut = {
  id: string;
  creatorId: string;
  channelId: string;
  channelName: string;
  title: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  description: string | null;
  publishedAt: string;
  fetchedAt: string | null;
  viewCount: number | null;
  likeCount: number | null;
  note: string | null;
  mirroredSwipeItemId: string | null;
  mirroredCreatedProjectId: string | null;
  mirroredEnrichStatus: string | null;
  mirroredEnrichError: string | null;
  mirroredTranscript: string | null;
};

const parser = new Parser<any, YoutubeFeedItemParsed>({
  customFields: {
    item: [
      ['yt:videoId', 'videoId'],
      ['yt:channelId', 'channelId'],
    ],
  },
});

function s(v: any): string {
  return String(v ?? '').trim();
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function toInt(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function looksLikeUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

function buildYoutubeChannelFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

function buildYoutubeLongformFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(`UULF${channelId.slice(2)}`)}`;
}

function deriveChannelIdFromFeedUrl(url: URL): string | null {
  const channelId = s(url.searchParams.get('channel_id'));
  if (channelId.startsWith('UC')) return channelId;

  const playlistId = s(url.searchParams.get('playlist_id'));
  if (playlistId.startsWith('UULF') && playlistId.length > 4) return `UC${playlistId.slice(4)}`;
  return null;
}

function pickText(value: YtInitialText | null | undefined): string {
  const simple = s(value?.simpleText);
  if (simple) return simple;
  const runs = Array.isArray(value?.runs) ? value!.runs : [];
  return runs.map((run) => s(run?.text)).filter(Boolean).join('');
}

function parseRelativePublishedAt(text: string): string {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw) return new Date().toISOString();
  const match = raw.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/);
  if (!match) return new Date().toISOString();
  const value = Number(match[1]);
  const unit = String(match[2] || '');
  const d = new Date();
  if (!Number.isFinite(value) || !unit) return d.toISOString();
  if (unit === 'second') d.setSeconds(d.getSeconds() - value);
  else if (unit === 'minute') d.setMinutes(d.getMinutes() - value);
  else if (unit === 'hour') d.setHours(d.getHours() - value);
  else if (unit === 'day') d.setDate(d.getDate() - value);
  else if (unit === 'week') d.setDate(d.getDate() - value * 7);
  else if (unit === 'month') d.setMonth(d.getMonth() - value);
  else if (unit === 'year') d.setFullYear(d.getFullYear() - value);
  return d.toISOString();
}

function parseCompactNumber(text: string): number | null {
  const raw = String(text || '').trim().toLowerCase().replace(/,/g, '');
  if (!raw) return null;
  const match = raw.match(/(\d+(?:\.\d+)?)\s*([kmb])?/);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = String(match[2] || '');
  const mult = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : suffix === 'b' ? 1_000_000_000 : 1;
  return Math.max(0, Math.round(base * mult));
}

function collectVideoRenderers(input: any, out: YtInitialVideoRenderer[] = []): YtInitialVideoRenderer[] {
  if (!input) return out;
  if (Array.isArray(input)) {
    for (const item of input) collectVideoRenderers(item, out);
    return out;
  }
  if (typeof input !== 'object') return out;
  if ((input as any).videoRenderer && typeof (input as any).videoRenderer === 'object') {
    out.push((input as any).videoRenderer as YtInitialVideoRenderer);
  }
  for (const value of Object.values(input)) collectVideoRenderers(value, out);
  return out;
}

async function fetchYoutubeVideosPageFallback(channelId: string): Promise<{ channelName: string; videos: YoutubeFeedVideo[] }> {
  const res = await fetch(`https://www.youtube.com/channel/${encodeURIComponent(channelId)}/videos`, {
    method: 'GET',
    headers: {
      'user-agent': YOUTUBE_BROWSER_UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Videos page fetch failed (${res.status})`);
  const html = await res.text();
  if (!html.trim()) throw new Error('Videos page returned empty HTML');

  const channelName =
    s(html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]).replace(/\s*-\s*YouTube\s*$/i, '') ||
    s(html.match(/<title>([^<]+)<\/title>/i)?.[1]).replace(/\s*-\s*YouTube\s*$/i, '') ||
    'YouTube Creator';
  const initialDataMatch = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
  if (!initialDataMatch?.[1]) throw new Error('Videos page missing ytInitialData');
  const initialData = JSON.parse(initialDataMatch[1]);
  const renderers = collectVideoRenderers(initialData);
  const seen = new Set<string>();
  const videos: YoutubeFeedVideo[] = [];
  for (const renderer of renderers) {
    const videoId = s(renderer.videoId);
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    videos.push({
      videoId,
      channelId,
      channelName: pickText(renderer.ownerText) || channelName,
      title: pickText(renderer.title) || 'Untitled video',
      videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      thumbnailUrl:
        (Array.isArray(renderer.thumbnail?.thumbnails)
          ? s(renderer.thumbnail?.thumbnails[renderer.thumbnail.thumbnails.length - 1]?.url)
          : '') || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
      description: pickText(renderer.descriptionSnippet) || null,
      publishedAt: parseRelativePublishedAt(pickText(renderer.publishedTimeText)),
      viewCount: parseCompactNumber(pickText(renderer.shortViewCountText) || pickText(renderer.viewCountText)),
      likeCount: null,
      rawXml: null,
    });
    if (videos.length >= 15) break;
  }
  if (videos.length === 0) throw new Error('Videos page fallback found no videos');
  return { channelName, videos };
}

export function validateYoutubeFeedUrl(input: string):
  | { ok: true; channelId: string; feedUrl: string }
  | { ok: false; error: string } {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'Feed URL is required' };
  try {
    const url = new URL(raw);
    const host = String(url.hostname || '').toLowerCase();
    const path = String(url.pathname || '');
    if (!(host === 'www.youtube.com' || host === 'youtube.com')) {
      return { ok: false, error: 'Feed URL must use youtube.com' };
    }
    if (path !== '/feeds/videos.xml') {
      return { ok: false, error: 'Feed URL must use /feeds/videos.xml' };
    }
    const channelId = deriveChannelIdFromFeedUrl(url);
    if (!channelId || !channelId.startsWith('UC')) {
      return { ok: false, error: 'Feed URL must include channel_id=UC... or playlist_id=UULF...' };
    }
    return {
      ok: true,
      channelId,
      feedUrl: buildYoutubeLongformFeedUrl(channelId),
    };
  } catch {
    return { ok: false, error: 'Invalid YouTube feed URL' };
  }
}

function normalizeYoutubeInputUrl(input: string): URL | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    try {
      if (raw.startsWith('@')) return new URL(`https://www.youtube.com/${raw}`);
      if (raw.startsWith('/')) return new URL(`https://www.youtube.com${raw}`);
      return new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
}

function extractYoutubeChannelIdFromHtml(html: string): string | null {
  const patterns = [
    /<link[^>]+rel="alternate"[^>]+type="application\/(?:rss|atom)\+xml"[^>]+href="https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=(UC[0-9A-Za-z_-]+)"/i,
    /<meta[^>]+itemprop="identifier"[^>]+content="(UC[0-9A-Za-z_-]+)"/i,
    /"externalId":"(UC[0-9A-Za-z_-]+)"/i,
    /https:\/\/www\.youtube\.com\/channel\/(UC[0-9A-Za-z_-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const channelId = s(match?.[1]);
    if (channelId.startsWith('UC')) return channelId;
  }
  return null;
}

export async function resolveYoutubeFeedInput(input: string):
  Promise<{ ok: true; channelId: string; feedUrl: string } | { ok: false; error: string }> {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'Channel or feed URL is required' };

  const directFeed = validateYoutubeFeedUrl(raw);
  if (directFeed.ok) return directFeed;

  const url = normalizeYoutubeInputUrl(raw);
  if (!url) return { ok: false, error: 'Invalid YouTube URL' };

  const host = String(url.hostname || '').toLowerCase();
  if (!(host === 'www.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com')) {
    return { ok: false, error: 'URL must use youtube.com' };
  }

  const path = String(url.pathname || '').trim();
  const looksLikeChannelPath =
    path.startsWith('/@') || path.startsWith('/channel/') || path.startsWith('/c/') || path.startsWith('/user/');
  if (!looksLikeChannelPath) {
    return { ok: false, error: 'Enter a YouTube channel URL or a YouTube feed URL' };
  }

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'user-agent': YOUTUBE_BROWSER_UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Channel fetch failed (${res.status})`);
    const html = await res.text();
    if (!html.trim()) throw new Error('Channel page returned empty HTML');
    const channelId = extractYoutubeChannelIdFromHtml(html);
    if (!channelId) {
      return { ok: false, error: 'Could not resolve a YouTube channel_id from that channel URL' };
    }
    return {
      ok: true,
      channelId,
      feedUrl: buildYoutubeLongformFeedUrl(channelId),
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || 'Failed to resolve YouTube channel URL') };
  }
}

export async function getAuthedYtContext(
  request: NextRequest,
  opts?: { includeAccount?: boolean }
): Promise<
  | { ok: true; supabase: any; user: any; accountId: string | null }
  | { ok: false; status: number; error: string }
> {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return authed;
  const { supabase, user } = authed;
  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return superadmin;

  if (!opts?.includeAccount) {
    return { ok: true, supabase, user, accountId: null };
  }

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return { ok: false, status: acct.status, error: acct.error };
  return { ok: true, supabase, user, accountId: acct.accountId };
}

export async function fetchYoutubeFeed(feedUrl: string): Promise<{ channelName: string; videos: YoutubeFeedVideo[] }> {
  const candidateUrls: string[] = [];
  const rawFeedUrl = String(feedUrl || '').trim();
  if (rawFeedUrl) candidateUrls.push(rawFeedUrl);
  let derivedChannelId: string | null = null;
  try {
    const parsed = new URL(rawFeedUrl);
    const channelId = deriveChannelIdFromFeedUrl(parsed);
    if (channelId) {
      derivedChannelId = channelId;
      const preferred = buildYoutubeLongformFeedUrl(channelId);
      const fallback = buildYoutubeChannelFeedUrl(channelId);
      if (!candidateUrls.includes(preferred)) candidateUrls.unshift(preferred);
      if (!candidateUrls.includes(fallback)) candidateUrls.push(fallback);
    }
  } catch {
    // ignore bad feedUrl here; downstream fetch attempts will fail
  }

  let xml = '';
  let lastErrorMessage = '';
  for (const candidateUrl of candidateUrls) {
    try {
      const res = await fetch(candidateUrl, {
        method: 'GET',
        headers: {
          'user-agent': YOUTUBE_BROWSER_UA,
          accept: 'application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        lastErrorMessage = `Feed fetch failed (${res.status})`;
        continue;
      }
      xml = await res.text();
      if (xml.trim()) break;
      lastErrorMessage = 'Feed returned empty XML';
    } catch (e: any) {
      lastErrorMessage = String(e?.message || 'Feed fetch failed');
    }
  }

  if (!xml.trim() && derivedChannelId) {
    return await fetchYoutubeVideosPageFallback(derivedChannelId);
  }

  if (!xml.trim()) throw new Error(lastErrorMessage || 'Feed returned empty XML');

  const feed = await parser.parseString(xml);
  const channelName = s((feed as any)?.title) || s((feed as any)?.author) || 'YouTube Creator';

  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: false,
    trimValues: true,
  });
  const rawParsed = xmlParser.parse(xml);
  const entries = asArray((rawParsed as any)?.feed?.entry);
  const statsByVideoId = new Map<string, { viewCount: number | null; likeCount: number | null; thumbnailUrl: string | null }>();

  for (const entry of entries) {
    const videoId = s((entry as any)?.['yt:videoId']);
    if (!videoId) continue;
    const group = (entry as any)?.['media:group'] ?? null;
    const community = group?.['media:community'] ?? null;
    const statistics = community?.['media:statistics'] ?? null;
    const starRating = community?.['media:starRating'] ?? null;
    const thumbnail = group?.['media:thumbnail'] ?? null;
    const thumbUrl = s(Array.isArray(thumbnail) ? thumbnail[0]?.url : thumbnail?.url) || null;
    statsByVideoId.set(videoId, {
      viewCount: toInt(statistics?.views),
      likeCount: toInt(starRating?.count),
      thumbnailUrl: thumbUrl,
    });
  }

  const items = Array.isArray((feed as any)?.items) ? ((feed as any).items as YoutubeFeedItemParsed[]) : [];
  const videos = items
    .map((item) => {
      const videoId = s(item.videoId);
      const itemChannelId = s(item.channelId);
      const publishedAt = s(item.isoDate) || s(item.pubDate);
      if (!videoId || !itemChannelId || !publishedAt) return null;
      const stats = statsByVideoId.get(videoId);
      return {
        videoId,
        channelId: itemChannelId,
        channelName,
        title: s(item.title) || 'Untitled video',
        videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        thumbnailUrl: stats?.thumbnailUrl || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
        description: s(item.contentSnippet) || s(item.content) || null,
        publishedAt: new Date(publishedAt).toISOString(),
        viewCount: stats?.viewCount ?? null,
        likeCount: stats?.likeCount ?? null,
        rawXml: null,
      } satisfies YoutubeFeedVideo;
    })
    .filter(Boolean) as YoutubeFeedVideo[];

  return { channelName, videos };
}

export async function upsertCreatorVideos(args: {
  supabase: any;
  userId: string;
  creatorId: string;
  videos: YoutubeFeedVideo[];
}) {
  const now = new Date().toISOString();
  const payload = args.videos.map((video) => ({
    user_id: args.userId,
    creator_id: args.creatorId,
    video_id: video.videoId,
    channel_id: video.channelId,
    channel_name: video.channelName,
    title: video.title,
    video_url: video.videoUrl,
    thumbnail_url: video.thumbnailUrl,
    description: video.description,
    published_at: video.publishedAt,
    view_count: video.viewCount,
    like_count: video.likeCount,
    fetched_at: now,
    raw_xml: video.rawXml,
  }));

  if (payload.length === 0) return { insertedCount: 0, updatedCount: 0 };

  const videoIds = payload.map((row) => row.video_id);
  const { data: existingRows, error: existingErr } = await args.supabase
    .from('yt_videos')
    .select('video_id')
    .eq('user_id', args.userId)
    .eq('creator_id', args.creatorId)
    .in('video_id', videoIds);
  if (existingErr) throw new Error(existingErr.message);
  const existingIds = new Set((Array.isArray(existingRows) ? existingRows : []).map((row: any) => s(row?.video_id)));

  const { error: upsertErr } = await args.supabase
    .from('yt_videos')
    .upsert(payload as any, { onConflict: 'user_id,video_id' });
  if (upsertErr) throw new Error(upsertErr.message);

  let insertedCount = 0;
  let updatedCount = 0;
  for (const row of payload) {
    if (existingIds.has(row.video_id)) updatedCount += 1;
    else insertedCount += 1;
  }
  return { insertedCount, updatedCount };
}

export async function ensureSwipeMirrorCategory(args: { supabase: any; accountId: string }) {
  const { supabase, accountId } = args;
  const { data: existing, error: existingErr } = await supabase
    .from('swipe_file_categories')
    .select('id')
    .eq('account_id', accountId)
    .eq('name', YT_RSS_MIRROR_CATEGORY_NAME)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existing?.id) return String(existing.id);

  const { data: maxRow } = await supabase
    .from('swipe_file_categories')
    .select('sort_order')
    .eq('account_id', accountId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = Math.max(0, Math.floor(Number((maxRow as any)?.sort_order || 0))) + 10;
  const { data: inserted, error: insertErr } = await supabase
    .from('swipe_file_categories')
    .insert({
      account_id: accountId,
      name: YT_RSS_MIRROR_CATEGORY_NAME,
      sort_order: nextSort,
    } as any)
    .select('id')
    .single();
  if (insertErr) {
    const code = String((insertErr as any)?.code || '');
    if (code === '23505') {
      const { data: again, error: againErr } = await supabase
        .from('swipe_file_categories')
        .select('id')
        .eq('account_id', accountId)
        .eq('name', YT_RSS_MIRROR_CATEGORY_NAME)
        .maybeSingle();
      if (againErr) throw new Error(againErr.message);
      if (again?.id) return String(again.id);
    }
    throw new Error(insertErr.message);
  }
  return String(inserted.id);
}

export async function ensureVideoMirror(args: {
  supabase: any;
  userId: string;
  accountId: string;
  ytVideoId: string;
}) {
  const { supabase, userId, accountId, ytVideoId } = args;
  if (!looksLikeUuid(ytVideoId)) throw new Error('Invalid ytVideoId');

  const { data: existingMirror, error: mirrorErr } = await supabase
    .from('yt_video_swipe_mirrors')
    .select('swipe_item_id')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('yt_video_id', ytVideoId)
    .maybeSingle();
  if (mirrorErr) throw new Error(mirrorErr.message);
  const existingSwipeItemId = s((existingMirror as any)?.swipe_item_id);
  if (existingSwipeItemId) return existingSwipeItemId;

  const { data: video, error: videoErr } = await supabase
    .from('yt_videos')
    .select('id, title, note, video_url, description, thumbnail_url, channel_name')
    .eq('id', ytVideoId)
    .eq('user_id', userId)
    .maybeSingle();
  if (videoErr) throw new Error(videoErr.message);
  if (!video?.id) throw new Error('Video not found');

  const categoryId = await ensureSwipeMirrorCategory({ supabase, accountId });
  const { data: item, error: itemErr } = await supabase
    .from('swipe_file_items')
    .insert({
      account_id: accountId,
      created_by_user_id: userId,
      url: s((video as any)?.video_url),
      platform: 'youtube',
      status: 'new',
      category_id: categoryId,
      tags: [],
      note: s((video as any)?.note) || null,
      title: s((video as any)?.title) || null,
      caption: s((video as any)?.description) || null,
      author_handle: s((video as any)?.channel_name) || null,
      thumb_url: s((video as any)?.thumbnail_url) || null,
      enrich_status: 'idle',
    } as any)
    .select('id')
    .single();
  if (itemErr || !item?.id) throw new Error(itemErr?.message || 'Failed to create Swipe File item');

  const insertedSwipeItemId = String(item.id);
  const { error: linkErr } = await supabase.from('yt_video_swipe_mirrors').insert({
    user_id: userId,
    yt_video_id: ytVideoId,
    account_id: accountId,
    swipe_item_id: insertedSwipeItemId,
  } as any);
  if (linkErr) {
    const code = String((linkErr as any)?.code || '');
    if (code === '23505') {
      const { data: retryMirror, error: retryErr } = await supabase
        .from('yt_video_swipe_mirrors')
        .select('swipe_item_id')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .eq('yt_video_id', ytVideoId)
        .maybeSingle();
      await supabase.from('swipe_file_items').delete().eq('id', insertedSwipeItemId).eq('account_id', accountId);
      if (retryErr) throw new Error(retryErr.message);
      const retrySwipeItemId = s((retryMirror as any)?.swipe_item_id);
      if (retrySwipeItemId) return retrySwipeItemId;
    }
    throw new Error(linkErr.message);
  }

  return insertedSwipeItemId;
}

export async function listVideosWithMirrorInfo(args: {
  supabase: any;
  userId: string;
  accountId: string | null;
  creatorId?: string;
  videoIds?: string[];
  limit: number;
  offset: number;
}) {
  let query = args.supabase
    .from('yt_videos')
    .select('id, creator_id, channel_id, channel_name, title, video_id, video_url, thumbnail_url, description, published_at, fetched_at, view_count, like_count, note')
    .eq('user_id', args.userId)
    .order('published_at', { ascending: false })
    .range(args.offset, args.offset + args.limit - 1);
  if (args.creatorId) query = query.eq('creator_id', args.creatorId);
  if (Array.isArray(args.videoIds) && args.videoIds.length > 0) query = query.in('id', args.videoIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  const out: YoutubeVideoOut[] = rows.map((row: any) => ({
    id: String(row.id || ''),
    creatorId: String(row.creator_id || ''),
    channelId: String(row.channel_id || ''),
    channelName: String(row.channel_name || ''),
    title: String(row.title || ''),
    videoId: String(row.video_id || ''),
    videoUrl: String(row.video_url || ''),
    thumbnailUrl: typeof row.thumbnail_url === 'string' ? row.thumbnail_url : row.thumbnail_url ?? null,
    description: typeof row.description === 'string' ? row.description : row.description ?? null,
    publishedAt: String(row.published_at || ''),
    fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : row.fetched_at ?? null,
    viewCount: toInt(row.view_count),
    likeCount: toInt(row.like_count),
    note: typeof row.note === 'string' ? row.note : row.note ?? null,
    mirroredSwipeItemId: null,
    mirroredCreatedProjectId: null,
    mirroredEnrichStatus: null,
    mirroredEnrichError: null,
    mirroredTranscript: null,
  }));

  if (!args.accountId || out.length === 0) return out;

  const videoIds = out.map((row) => row.id).filter(Boolean);
  const { data: mirrorRows, error: mirrorsErr } = await args.supabase
    .from('yt_video_swipe_mirrors')
    .select('yt_video_id, swipe_item_id')
    .eq('user_id', args.userId)
    .eq('account_id', args.accountId)
    .in('yt_video_id', videoIds);
  if (mirrorsErr) throw new Error(mirrorsErr.message);

  const mirrorMap = new Map<string, string>();
  const swipeItemIds = new Set<string>();
  for (const row of Array.isArray(mirrorRows) ? mirrorRows : []) {
    const ytVideoId = s((row as any)?.yt_video_id);
    const swipeItemId = s((row as any)?.swipe_item_id);
    if (!ytVideoId || !swipeItemId) continue;
    mirrorMap.set(ytVideoId, swipeItemId);
    swipeItemIds.add(swipeItemId);
  }

  let swipeItemsById = new Map<string, any>();
  if (swipeItemIds.size > 0) {
    const { data: swipeItems, error: swipeErr } = await args.supabase
      .from('swipe_file_items')
      .select('id, created_project_id, enrich_status, enrich_error, transcript')
      .eq('account_id', args.accountId)
      .in('id', Array.from(swipeItemIds));
    if (swipeErr) throw new Error(swipeErr.message);
    swipeItemsById = new Map((Array.isArray(swipeItems) ? swipeItems : []).map((row: any) => [String(row.id || ''), row]));
  }

  return out.map((row) => {
    const swipeItemId = mirrorMap.get(row.id) || null;
    const swipeRow = swipeItemId ? swipeItemsById.get(swipeItemId) : null;
    return {
      ...row,
      mirroredSwipeItemId: swipeItemId,
      mirroredCreatedProjectId: s((swipeRow as any)?.created_project_id) || null,
      mirroredEnrichStatus: s((swipeRow as any)?.enrich_status) || null,
      mirroredEnrichError: typeof (swipeRow as any)?.enrich_error === 'string' ? (swipeRow as any).enrich_error : (swipeRow as any)?.enrich_error ?? null,
      mirroredTranscript: typeof (swipeRow as any)?.transcript === 'string' ? (swipeRow as any).transcript : (swipeRow as any)?.transcript ?? null,
    } satisfies YoutubeVideoOut;
  });
}
