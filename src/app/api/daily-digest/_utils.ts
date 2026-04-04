import 'server-only';

import { NextRequest } from 'next/server';
import { fetchYoutubeFeed, getAuthedYtContext, upsertCreatorVideos } from '../yt-rss/_utils';
import { requireServiceClient } from '../_shared/reel_media';
import { scrapeYoutubeViaApifyKaramelo } from '../swipe-file/_apify';
import { extractYoutubeTranscriptFromApify } from '../_shared/youtube-transcript';

export const runtime = 'nodejs';
export const DAILY_DIGEST_TIMEOUT_MS = 240_000;
export const DAILY_DIGEST_MAX_RETRIES = 2;
export const DAILY_DIGEST_LOOKBACK_DAYS = 10;

export const DEFAULT_DAILY_DIGEST_PROMPT = `SYSTEM:
You are an AI intelligence analyst for a business consultant who helps companies
adopt AI and become more efficient. Your job is to analyze YouTube video transcripts
and extract actionable intelligence.

The audience is business owners who feel:
- Anxious about falling behind competitors who adopt AI faster
- Overwhelmed by the pace of change and unsure what actually matters vs. hype
- Worried about investing in the wrong tools or strategies
- Pressure to "do something with AI" but unclear on what moves the needle
- Fear that ignoring AI will cost them revenue, market position, or relevance

Frame every insight through this lens: "If I'm a business owner with 10 other
priorities, why should I stop and pay attention to THIS?"

USER:
Analyze this transcript and produce a structured JSON response.

TRANSCRIPT:
{full transcript text}

VIDEO METADATA:
- Title: {title}
- Creator: {channel name}
- Published: {date}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "summary": "2-4 sentence core message of this video",
  "topics": [
    {
      "title": "Short topic label (5-10 words)",
      "what_it_is": "Plain explanation of what happened or what this is about (2-3 sentences)",
      "why_it_matters": "Why a business owner should care, tied to their real pain/anxiety (2-3 sentences)",
      "carousel_angle": "If this were a 6-slide carousel teaching this topic, what would the hook/angle be? (1 sentence)"
    }
  ],
  "unique_viewpoints": [
    "Any distinctive opinions, predictions, or contrarian takes the creator expressed (1 sentence each)"
  ]
}

Extract 1-5 topics depending on the video's scope. A focused video might have 1 topic.
A news roundup might have 5. Do not force topics where there aren't any.`;

export function sanitizePrompt(input: string): string {
  return String(input || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .trim();
}

function s(v: any): string {
  return typeof v === 'string' ? String(v).trim() : '';
}

function isoDaysBefore(input: string | null | undefined, days: number): string {
  const raw = String(input || '').trim();
  const date = raw ? new Date(raw) : new Date();
  const ts = Number.isFinite(date.getTime()) ? date : new Date();
  ts.setDate(ts.getDate() - Math.max(0, Math.floor(days)));
  return ts.toISOString();
}

function stripMarkdownCodeFences(text: string): string {
  const raw = String(text || '').trim();
  if (!raw.startsWith('```')) return raw;
  const match = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1] ? String(match[1]).trim() : raw;
}

function extractFirstBalancedJsonObject(text: string): string {
  const raw = String(text || '');
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (start === -1) {
      if (ch === '{') {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  throw new Error('Model did not return a balanced JSON object');
}

function parseJsonObject(text: string): any {
  const trimmed = stripMarkdownCodeFences(String(text || '').trim());
  try {
    return JSON.parse(trimmed);
  } catch {
    return JSON.parse(extractFirstBalancedJsonObject(trimmed));
  }
}

function buildDigestUserText(args: {
  promptUsed: string;
  transcript: string;
  title: string;
  creatorName: string;
  publishedAt: string;
  formatError?: boolean;
}) {
  let text = String(args.promptUsed || '');
  text = text.replaceAll('{full transcript text}', args.transcript);
  text = text.replaceAll('{title}', args.title);
  text = text.replaceAll('{channel name}', args.creatorName);
  text = text.replaceAll('{date}', args.publishedAt);
  if (args.formatError) {
    text += '\n\nFORMAT_ERROR:\nReturn ONLY valid JSON matching the requested schema. No markdown fences. No commentary.';
  }
  return text;
}

async function callAnthropicText(args: {
  system: string;
  userText: string;
  maxTokens?: number;
  temperature?: number;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 90_000);
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
        max_tokens: typeof args.maxTokens === 'number' ? args.maxTokens : 4000,
        temperature: typeof args.temperature === 'number' ? args.temperature : 0.2,
        system: args.system,
        messages: [{ role: 'user', content: args.userText }],
      }),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || JSON.stringify(json)?.slice(0, 500) || 'Unknown Anthropic error';
      throw new Error(`Anthropic error (${res.status}): ${msg}`);
    }
    return String(json?.content?.[0]?.text || '');
  } finally {
    clearTimeout(t);
  }
}

type DistilledTopic = {
  title: string;
  what_it_is: string;
  why_it_matters: string;
  carousel_angle: string | null;
};

async function distillDailyDigest(args: {
  promptUsed: string;
  transcript: string;
  title: string;
  creatorName: string;
  publishedAt: string;
}): Promise<{ summary: string; topics: DistilledTopic[]; uniqueViewpoints: string[] }> {
  const system = 'You are a structured JSON generator. Follow the user instructions exactly.';

  let lastError: unknown = null;
  for (const attempt of [
    { temperature: 0.2, formatError: false },
    { temperature: 0, formatError: true },
  ]) {
    try {
      const rawText = await callAnthropicText({
        system,
        userText: buildDigestUserText({
          promptUsed: args.promptUsed,
          transcript: args.transcript,
          title: args.title,
          creatorName: args.creatorName,
          publishedAt: args.publishedAt,
          formatError: attempt.formatError,
        }),
        temperature: attempt.temperature,
        maxTokens: 4000,
      });
      const parsed = parseJsonObject(rawText);
      const summary = s(parsed?.summary);
      if (!summary) throw new Error('Distillation response missing summary');
      const topics = Array.isArray(parsed?.topics)
        ? parsed.topics
            .map((topic: any) => ({
              title: s(topic?.title),
              what_it_is: s(topic?.what_it_is),
              why_it_matters: s(topic?.why_it_matters),
              carousel_angle: s(topic?.carousel_angle) || null,
            }))
            .filter((topic: DistilledTopic) => topic.title && topic.what_it_is && topic.why_it_matters)
        : [];
      const uniqueViewpoints = Array.isArray(parsed?.unique_viewpoints)
        ? parsed.unique_viewpoints.map((item: any) => s(item)).filter(Boolean)
        : [];
      return { summary, topics, uniqueViewpoints };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Daily Digest distillation failed');
}

function isTokenLimitError(message: string): boolean {
  const raw = String(message || '').toLowerCase();
  return raw.includes('token') || raw.includes('context length') || raw.includes('too long');
}

type DigestCreatorRow = {
  id: string;
  yt_creator_id: string;
  enabled_at: string | null;
  yt_creator: {
    id: string;
    channel_name: string;
    feed_url: string;
  } | null;
};

async function loadEnabledCreatorSettings(args: {
  supabase: any;
  userId: string;
  accountId: string;
}): Promise<DigestCreatorRow[]> {
  const { data, error } = await args.supabase
    .from('daily_digest_creator_settings')
    .select('id, yt_creator_id, enabled_at, yt_creator:yt_creators!inner(id, channel_name, feed_url)')
    .eq('user_id', args.userId)
    .eq('account_id', args.accountId)
    .eq('enabled', true)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map((row: any) => ({
    id: String(row.id || ''),
    yt_creator_id: String(row.yt_creator_id || ''),
    enabled_at: typeof row.enabled_at === 'string' ? row.enabled_at : row.enabled_at ?? null,
    yt_creator: row.yt_creator
      ? {
          id: String(row.yt_creator.id || ''),
          channel_name: String(row.yt_creator.channel_name || ''),
          feed_url: String(row.yt_creator.feed_url || ''),
        }
      : null,
  }));
}

type RunErrorEntry = {
  type: 'feed_refresh';
  creatorId: string;
  message: string;
};

type ScopeProcessResult = {
  runId: string;
  status: 'completed' | 'completed_with_errors' | 'failed';
  videosDiscovered: number;
  videosProcessed: number;
  videosFailed: number;
  videosPending: number;
  topicsExtracted: number;
  runErrors: RunErrorEntry[];
  errorMessage: string | null;
};

async function refreshCreatorFeed(args: {
  supabase: any;
  userId: string;
  creatorId: string;
  feedUrl: string;
}) {
  const now = new Date().toISOString();
  try {
    const { channelName, videos } = await fetchYoutubeFeed(args.feedUrl);
    await upsertCreatorVideos({
      supabase: args.supabase,
      userId: args.userId,
      creatorId: args.creatorId,
      videos,
    });
    const { error: updateErr } = await args.supabase
      .from('yt_creators')
      .update({
        channel_name: channelName,
        last_refreshed_at: now,
        last_refresh_error: null,
      } as any)
      .eq('id', args.creatorId)
      .eq('user_id', args.userId);
    if (updateErr) throw new Error(updateErr.message);
  } catch (error: any) {
    const message = String(error?.message || 'Feed refresh failed');
    await args.supabase
      .from('yt_creators')
      .update({
        last_refreshed_at: now,
        last_refresh_error: message,
      } as any)
      .eq('id', args.creatorId)
      .eq('user_id', args.userId);
    throw new Error(message);
  }
}

async function createDigestRun(args: { supabase: any; userId: string; accountId: string }) {
  const { data, error } = await args.supabase
    .from('daily_digest_runs')
    .insert({
      user_id: args.userId,
      account_id: args.accountId,
      status: 'running',
      started_at: new Date().toISOString(),
    } as any)
    .select('id')
    .single();
  if (error || !data?.id) throw new Error(error?.message || 'Failed to create Daily Digest run');
  return String(data.id);
}

async function updateRunPrompt(args: {
  supabase: any;
  runId: string;
  promptSource: 'default' | 'override';
  promptUsed: string;
}) {
  const { error } = await args.supabase
    .from('daily_digest_runs')
    .update({
      prompt_source: args.promptSource,
      prompt_used: args.promptUsed,
    } as any)
    .eq('id', args.runId);
  if (error) throw new Error(error.message);
}

async function finalizeRun(args: {
  supabase: any;
  runId: string;
  status: 'completed' | 'completed_with_errors' | 'failed';
  videosDiscovered: number;
  videosProcessed: number;
  videosFailed: number;
  videosPending: number;
  topicsExtracted: number;
  runErrors: RunErrorEntry[];
  errorMessage: string | null;
}) {
  const { error } = await args.supabase
    .from('daily_digest_runs')
    .update({
      status: args.status,
      finished_at: new Date().toISOString(),
      videos_discovered: args.videosDiscovered,
      videos_processed: args.videosProcessed,
      videos_failed: args.videosFailed,
      videos_pending: args.videosPending,
      topics_extracted: args.topicsExtracted,
      run_errors: args.runErrors,
      error_message: args.errorMessage,
    } as any)
    .eq('id', args.runId);
  if (error) throw new Error(error.message);
}

async function discoverNewVideos(args: {
  supabase: any;
  userId: string;
  accountId: string;
  runId: string;
  enabledCreators: DigestCreatorRow[];
}) {
  if (args.enabledCreators.length === 0) return [];

  const minCutoff = args.enabledCreators
    .map((row) => isoDaysBefore(row.enabled_at, DAILY_DIGEST_LOOKBACK_DAYS))
    .filter(Boolean)
    .sort()[0];

  let query = args.supabase
    .from('yt_videos')
    .select('id, creator_id, channel_name, title, video_url, thumbnail_url, published_at')
    .eq('user_id', args.userId)
    .in(
      'creator_id',
      args.enabledCreators.map((row) => row.yt_creator_id)
    )
    .order('published_at', { ascending: true });
  if (minCutoff) query = query.gt('published_at', minCutoff);

  const { data: ytVideos, error: ytVideosErr } = await query;
  if (ytVideosErr) throw new Error(ytVideosErr.message);

  const cutoffByCreatorId = new Map<string, string>();
  for (const row of args.enabledCreators) {
    cutoffByCreatorId.set(row.yt_creator_id, isoDaysBefore(row.enabled_at, DAILY_DIGEST_LOOKBACK_DAYS));
  }

  const candidates = (Array.isArray(ytVideos) ? ytVideos : []).filter((row: any) => {
    const creatorCutoff = cutoffByCreatorId.get(String(row.creator_id || '')) || '1970-01-01T00:00:00.000Z';
    return String(row.published_at || '') > creatorCutoff;
  });
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((row: any) => String(row.id || '')).filter(Boolean);
  const { data: existingRows, error: existingErr } = await args.supabase
    .from('daily_digest_videos')
    .select('yt_video_id')
    .eq('user_id', args.userId)
    .eq('account_id', args.accountId)
    .in('yt_video_id', candidateIds);
  if (existingErr) throw new Error(existingErr.message);

  const existingIds = new Set((Array.isArray(existingRows) ? existingRows : []).map((row: any) => String(row.yt_video_id || '')));
  const payload = candidates
    .filter((row: any) => !existingIds.has(String(row.id || '')))
    .map((row: any) => ({
      user_id: args.userId,
      account_id: args.accountId,
      yt_video_id: String(row.id || ''),
      digest_run_id: args.runId,
      status: 'pending',
      retry_count: 0,
      error_message: null,
      youtube_video_url: String(row.video_url || ''),
      video_title: String(row.title || ''),
      creator_name: String(row.channel_name || ''),
      thumbnail_url: typeof row.thumbnail_url === 'string' ? row.thumbnail_url : row.thumbnail_url ?? null,
      published_at: String(row.published_at || ''),
    }));

  if (payload.length === 0) return [];

  const { error: insertErr } = await args.supabase
    .from('daily_digest_videos')
    .upsert(payload as any, { onConflict: 'user_id,account_id,yt_video_id', ignoreDuplicates: true });
  if (insertErr) throw new Error(insertErr.message);

  const { data: insertedRows, error: insertedErr } = await args.supabase
    .from('daily_digest_videos')
    .select('id, user_id, account_id, yt_video_id, digest_run_id, status, retry_count, error_message, youtube_video_url, video_title, creator_name, thumbnail_url, published_at, raw_transcript')
    .eq('user_id', args.userId)
    .eq('account_id', args.accountId)
    .in(
      'yt_video_id',
      payload.map((row) => row.yt_video_id)
    )
    .order('published_at', { ascending: true });
  if (insertedErr) throw new Error(insertedErr.message);
  return Array.isArray(insertedRows) ? insertedRows : [];
}

async function loadCarryOverVideos(args: { supabase: any; userId: string; accountId: string }) {
  const { data, error } = await args.supabase
    .from('daily_digest_videos')
    .select('id, user_id, account_id, yt_video_id, digest_run_id, status, retry_count, error_message, youtube_video_url, video_title, creator_name, thumbnail_url, published_at, raw_transcript')
    .eq('user_id', args.userId)
    .eq('account_id', args.accountId)
    .or(`status.eq.pending,and(status.eq.failed,retry_count.lt.${DAILY_DIGEST_MAX_RETRIES})`)
    .order('published_at', { ascending: true });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

async function updateDigestVideo(args: {
  supabase: any;
  digestVideoId: string;
  patch: Record<string, any>;
}) {
  const { error } = await args.supabase.from('daily_digest_videos').update(args.patch as any).eq('id', args.digestVideoId);
  if (error) throw new Error(error.message);
}

async function processDigestVideo(args: {
  supabase: any;
  runId: string;
  row: any;
  promptUsed: string;
}) {
  const digestVideoId = String(args.row.id || '');
  const retryCount = Number(args.row.retry_count || 0);
  const youtubeVideoUrl = String(args.row.youtube_video_url || '');
  const videoTitle = String(args.row.video_title || '');
  const creatorName = String(args.row.creator_name || '');
  const publishedAt = String(args.row.published_at || '');

  try {
    let transcript = typeof args.row.raw_transcript === 'string' ? args.row.raw_transcript : args.row.raw_transcript ?? null;

    if (transcript) {
      await updateDigestVideo({
        supabase: args.supabase,
        digestVideoId,
        patch: {
          digest_run_id: args.runId,
          status: 'distilling',
          error_message: null,
        },
      });
    } else {
      await updateDigestVideo({
        supabase: args.supabase,
        digestVideoId,
        patch: {
          digest_run_id: args.runId,
          status: 'enriching',
          error_message: null,
        },
      });
      const raw = await scrapeYoutubeViaApifyKaramelo({ videoUrl: youtubeVideoUrl });
      const extracted = extractYoutubeTranscriptFromApify(raw);
      transcript = extracted.transcript;
      if (!transcript) {
        await updateDigestVideo({
          supabase: args.supabase,
          digestVideoId,
          patch: {
            digest_run_id: args.runId,
            status: 'failed',
            retry_count: 99,
            error_message: 'No transcript available',
          },
        });
        return { ok: false as const, topicsExtracted: 0 };
      }
      await updateDigestVideo({
        supabase: args.supabase,
        digestVideoId,
        patch: {
          digest_run_id: args.runId,
          status: 'distilling',
          raw_transcript: transcript,
          transcript_char_count: transcript.length,
          error_message: null,
        },
      });
    }

    const distilled = await distillDailyDigest({
      promptUsed: args.promptUsed,
      transcript: String(transcript || ''),
      title: videoTitle,
      creatorName,
      publishedAt,
    });

    const { error: deleteTopicsErr } = await args.supabase.from('daily_digest_topics').delete().eq('digest_video_id', digestVideoId);
    if (deleteTopicsErr) throw new Error(deleteTopicsErr.message);

    if (distilled.topics.length > 0) {
      const { error: insertTopicsErr } = await args.supabase.from('daily_digest_topics').insert(
        distilled.topics.map((topic, index) => ({
          digest_video_id: digestVideoId,
          user_id: args.row.user_id,
          account_id: args.row.account_id,
          title: topic.title,
          what_it_is: topic.what_it_is,
          why_it_matters: topic.why_it_matters,
          carousel_angle: topic.carousel_angle,
          status: 'active',
          note: null,
          sort_order: index,
        })) as any
      );
      if (insertTopicsErr) throw new Error(insertTopicsErr.message);
    }

    await updateDigestVideo({
      supabase: args.supabase,
      digestVideoId,
      patch: {
        digest_run_id: args.runId,
        status: 'completed',
        error_message: null,
        summary: distilled.summary,
        unique_viewpoints: distilled.uniqueViewpoints,
      },
    });
    return { ok: true as const, topicsExtracted: distilled.topics.length };
  } catch (error: any) {
    const message = String(error?.message || 'Daily Digest video processing failed');
    if (isTokenLimitError(message)) {
      await updateDigestVideo({
        supabase: args.supabase,
        digestVideoId,
        patch: {
          digest_run_id: args.runId,
          status: 'failed',
          retry_count: 99,
          error_message: 'Transcript too long for AI processing',
        },
      });
      return { ok: false as const, topicsExtracted: 0 };
    }

    await updateDigestVideo({
      supabase: args.supabase,
      digestVideoId,
      patch: {
        digest_run_id: args.runId,
        status: 'failed',
        retry_count: retryCount + 1,
        error_message: message,
      },
    });
    return { ok: false as const, topicsExtracted: 0 };
  }
}

export async function getAuthedDailyDigestContext(request: NextRequest) {
  return getAuthedYtContext(request, { includeAccount: true });
}

export async function loadDailyDigestPrompt(args: {
  supabase: any;
  userId: string;
  accountId: string;
}): Promise<{ promptSource: 'default' | 'override'; promptUsed: string }> {
  const { data, error } = await args.supabase
    .from('daily_digest_prompt_overrides')
    .select('distill_prompt')
    .eq('user_id', args.userId)
    .eq('account_id', args.accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const override = sanitizePrompt(String((data as any)?.distill_prompt || ''));
  if (override) {
    return { promptSource: 'override', promptUsed: override };
  }
  return { promptSource: 'default', promptUsed: DEFAULT_DAILY_DIGEST_PROMPT };
}

export async function listEnabledDailyDigestScopes(args?: { supabase?: any }) {
  const supabase = args?.supabase || requireServiceClient();
  const { data, error } = await supabase
    .from('daily_digest_creator_settings')
    .select('user_id, account_id')
    .eq('enabled', true);
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const scopes: Array<{ userId: string; accountId: string }> = [];
  for (const row of Array.isArray(data) ? data : []) {
    const userId = String((row as any)?.user_id || '').trim();
    const accountId = String((row as any)?.account_id || '').trim();
    if (!userId || !accountId) continue;
    const key = `${userId}::${accountId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    scopes.push({ userId, accountId });
  }
  return scopes;
}

export async function listDailyDigestCreators(args: {
  supabase: any;
  userId: string;
  accountId: string;
}) {
  const [{ data: creators, error: creatorsErr }, { data: settings, error: settingsErr }] = await Promise.all([
    args.supabase
      .from('yt_creators')
      .select('id, channel_name, channel_id, feed_url, is_active, last_refreshed_at, last_refresh_error, created_at')
      .eq('user_id', args.userId)
      .order('created_at', { ascending: true }),
    args.supabase
      .from('daily_digest_creator_settings')
      .select('yt_creator_id, enabled, enabled_at')
      .eq('user_id', args.userId)
      .eq('account_id', args.accountId),
  ]);

  if (creatorsErr) throw new Error(creatorsErr.message);
  if (settingsErr) throw new Error(settingsErr.message);

  const settingsMap = new Map<string, any>();
  for (const row of Array.isArray(settings) ? settings : []) {
    const creatorId = String((row as any)?.yt_creator_id || '').trim();
    if (!creatorId) continue;
    settingsMap.set(creatorId, row);
  }

  return (Array.isArray(creators) ? creators : []).map((row: any) => {
    const setting = settingsMap.get(String(row.id || ''));
    return {
      id: String(row.id || ''),
      channelId: String(row.channel_id || ''),
      channelName: String(row.channel_name || ''),
      feedUrl: String(row.feed_url || ''),
      isActive: !!row.is_active,
      lastRefreshedAt: typeof row.last_refreshed_at === 'string' ? row.last_refreshed_at : row.last_refreshed_at ?? null,
      lastRefreshError: typeof row.last_refresh_error === 'string' ? row.last_refresh_error : row.last_refresh_error ?? null,
      createdAt: String(row.created_at || ''),
      digestEnabled: !!setting?.enabled,
      digestEnabledAt: typeof setting?.enabled_at === 'string' ? setting.enabled_at : setting?.enabled_at ?? null,
    };
  });
}

export async function runDailyDigestForScope(args: {
  supabase?: any;
  userId: string;
  accountId: string;
}): Promise<ScopeProcessResult | null> {
  const supabase = args.supabase || requireServiceClient();
  const enabledCreators = await loadEnabledCreatorSettings({
    supabase,
    userId: args.userId,
    accountId: args.accountId,
  });
  if (enabledCreators.length === 0) return null;

  const runId = await createDigestRun({
    supabase,
    userId: args.userId,
    accountId: args.accountId,
  });

  let videosDiscovered = 0;
  let videosProcessed = 0;
  let videosFailed = 0;
  let videosPending = 0;
  let topicsExtracted = 0;
  const runErrors: RunErrorEntry[] = [];

  try {
    const { promptSource, promptUsed } = await loadDailyDigestPrompt({
      supabase,
      userId: args.userId,
      accountId: args.accountId,
    });
    await updateRunPrompt({ supabase, runId, promptSource, promptUsed });

    for (const row of enabledCreators) {
      if (!row.yt_creator?.id || !row.yt_creator.feed_url) continue;
      try {
        await refreshCreatorFeed({
          supabase,
          userId: args.userId,
          creatorId: row.yt_creator.id,
          feedUrl: row.yt_creator.feed_url,
        });
      } catch (error: any) {
        runErrors.push({
          type: 'feed_refresh',
          creatorId: row.yt_creator.id,
          message: String(error?.message || 'Feed refresh failed'),
        });
      }
    }

    const [carryOverRows, discoveredRows] = await Promise.all([
      loadCarryOverVideos({ supabase, userId: args.userId, accountId: args.accountId }),
      discoverNewVideos({
        supabase,
        userId: args.userId,
        accountId: args.accountId,
        runId,
        enabledCreators,
      }),
    ]);

    videosDiscovered = discoveredRows.length;

    const queue = [
      ...carryOverRows.map((row) => ({ kind: 'carry' as const, row })),
      ...discoveredRows.map((row) => ({ kind: 'new' as const, row })),
    ];

    const startedAt = Date.now();
    let nextIndex = 0;
    for (; nextIndex < queue.length; nextIndex += 1) {
      if (Date.now() - startedAt >= DAILY_DIGEST_TIMEOUT_MS) break;
      const current = queue[nextIndex];
      const outcome = await processDigestVideo({
        supabase,
        runId,
        row: current.row,
        promptUsed,
      });
      if (outcome.ok) {
        videosProcessed += 1;
        topicsExtracted += outcome.topicsExtracted;
      } else {
        videosFailed += 1;
      }
    }

    videosPending = queue.slice(nextIndex).filter((entry) => entry.kind === 'new').length;

    const status: ScopeProcessResult['status'] =
      videosFailed === 0 && runErrors.length === 0 ? 'completed' : 'completed_with_errors';

    await finalizeRun({
      supabase,
      runId,
      status,
      videosDiscovered,
      videosProcessed,
      videosFailed,
      videosPending,
      topicsExtracted,
      runErrors,
      errorMessage: runErrors.length > 0 ? runErrors[0].message : null,
    });

    return {
      runId,
      status,
      videosDiscovered,
      videosProcessed,
      videosFailed,
      videosPending,
      topicsExtracted,
      runErrors,
      errorMessage: runErrors.length > 0 ? runErrors[0].message : null,
    };
  } catch (error: any) {
    const message = String(error?.message || 'Daily Digest run failed');
    await finalizeRun({
      supabase,
      runId,
      status: 'failed',
      videosDiscovered,
      videosProcessed,
      videosFailed,
      videosPending,
      topicsExtracted,
      runErrors,
      errorMessage: message,
    });
    return {
      runId,
      status: 'failed',
      videosDiscovered,
      videosProcessed,
      videosFailed,
      videosPending,
      topicsExtracted,
      runErrors,
      errorMessage: message,
    };
  }
}

export { fetchYoutubeFeed, upsertCreatorVideos, requireServiceClient };
