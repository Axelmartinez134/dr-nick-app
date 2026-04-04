import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedDailyDigestContext } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Resp =
  | {
      success: true;
      videos: Array<{
        id: string;
        ytVideoId: string | null;
        digestRunId: string | null;
        status: string;
        retryCount: number;
        errorMessage: string | null;
        youtubeVideoUrl: string;
        videoTitle: string;
        creatorName: string;
        thumbnailUrl: string | null;
        publishedAt: string;
        summary: string | null;
        uniqueViewpoints: string[];
        transcriptCharCount: number | null;
        rawTranscript: string | null;
        sourceRemoved: boolean;
        currentCreatorId: string | null;
        currentCreatorIsActive: boolean | null;
        digestEnabled: boolean | null;
        topics: Array<{
          id: string;
          title: string;
          whatItIs: string;
          whyItMatters: string;
          carouselAngle: string | null;
          status: string;
          note: string | null;
          sortOrder: number;
        }>;
      }>;
      latestTopicRunId: string | null;
    }
  | { success: false; error: string };

export async function GET(request: NextRequest) {
  const auth = await getAuthedDailyDigestContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user, accountId } = auth;
  if (!accountId) return NextResponse.json({ success: false, error: 'Missing active account' } satisfies Resp, { status: 400 });

  const { data: visibleRuns, error: runsErr } = await supabase
    .from('daily_digest_runs')
    .select('id, topics_extracted, status, started_at')
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .in('status', ['completed', 'completed_with_errors'])
    .order('started_at', { ascending: false })
    .limit(100);
  if (runsErr) return NextResponse.json({ success: false, error: runsErr.message } satisfies Resp, { status: 500 });

  const runRows = Array.isArray(visibleRuns) ? visibleRuns : [];
  const visibleRunIds = runRows.map((row: any) => String(row.id || '')).filter(Boolean);
  const latestTopicRunId =
    runRows.find((row: any) => Number(row?.topics_extracted || 0) > 0)?.id
      ? String(runRows.find((row: any) => Number(row?.topics_extracted || 0) > 0)?.id || '')
      : null;

  if (visibleRunIds.length === 0) {
    return NextResponse.json({ success: true, videos: [], latestTopicRunId: null } satisfies Resp);
  }

  const { data: videosData, error: videosErr } = await supabase
    .from('daily_digest_videos')
    .select(
      'id, yt_video_id, digest_run_id, status, retry_count, error_message, youtube_video_url, video_title, creator_name, thumbnail_url, published_at, summary, unique_viewpoints, transcript_char_count, raw_transcript'
    )
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .in('digest_run_id', visibleRunIds)
    .order('published_at', { ascending: false });
  if (videosErr) return NextResponse.json({ success: false, error: videosErr.message } satisfies Resp, { status: 500 });

  const videos = Array.isArray(videosData) ? videosData : [];
  const digestVideoIds = videos.map((row: any) => String(row.id || '')).filter(Boolean);
  const ytVideoIds = videos.map((row: any) => String(row.yt_video_id || '')).filter(Boolean);

  const [{ data: topicsData, error: topicsErr }, { data: ytVideoRows, error: ytVideoErr }] = await Promise.all([
    digestVideoIds.length
      ? supabase
          .from('daily_digest_topics')
          .select('id, digest_video_id, title, what_it_is, why_it_matters, carousel_angle, status, note, sort_order')
          .eq('user_id', user.id)
          .eq('account_id', accountId)
          .in('digest_video_id', digestVideoIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    ytVideoIds.length
      ? supabase.from('yt_videos').select('id, creator_id').eq('user_id', user.id).in('id', ytVideoIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (topicsErr) return NextResponse.json({ success: false, error: topicsErr.message } satisfies Resp, { status: 500 });
  if (ytVideoErr) return NextResponse.json({ success: false, error: ytVideoErr.message } satisfies Resp, { status: 500 });

  const topicsByVideoId = new Map<string, any[]>();
  for (const row of Array.isArray(topicsData) ? topicsData : []) {
    const key = String((row as any)?.digest_video_id || '').trim();
    if (!key) continue;
    topicsByVideoId.set(key, [...(topicsByVideoId.get(key) || []), row]);
  }

  const ytVideoToCreatorId = new Map<string, string>();
  const creatorIds = new Set<string>();
  for (const row of Array.isArray(ytVideoRows) ? ytVideoRows : []) {
    const ytVideoId = String((row as any)?.id || '').trim();
    const creatorId = String((row as any)?.creator_id || '').trim();
    if (!ytVideoId || !creatorId) continue;
    ytVideoToCreatorId.set(ytVideoId, creatorId);
    creatorIds.add(creatorId);
  }

  const [{ data: creatorRows, error: creatorErr }, { data: settingsRows, error: settingsErr }] = await Promise.all([
    creatorIds.size
      ? supabase.from('yt_creators').select('id, is_active').eq('user_id', user.id).in('id', Array.from(creatorIds))
      : Promise.resolve({ data: [], error: null }),
    creatorIds.size
      ? supabase
          .from('daily_digest_creator_settings')
          .select('yt_creator_id, enabled')
          .eq('user_id', user.id)
          .eq('account_id', accountId)
          .in('yt_creator_id', Array.from(creatorIds))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (creatorErr) return NextResponse.json({ success: false, error: creatorErr.message } satisfies Resp, { status: 500 });
  if (settingsErr) return NextResponse.json({ success: false, error: settingsErr.message } satisfies Resp, { status: 500 });

  const creatorMap = new Map<string, any>();
  for (const row of Array.isArray(creatorRows) ? creatorRows : []) {
    const creatorId = String((row as any)?.id || '').trim();
    if (!creatorId) continue;
    creatorMap.set(creatorId, row);
  }

  const settingsMap = new Map<string, any>();
  for (const row of Array.isArray(settingsRows) ? settingsRows : []) {
    const creatorId = String((row as any)?.yt_creator_id || '').trim();
    if (!creatorId) continue;
    settingsMap.set(creatorId, row);
  }

  return NextResponse.json({
    success: true,
    latestTopicRunId,
    videos: videos.map((row: any) => {
      const ytVideoId = typeof row.yt_video_id === 'string' ? row.yt_video_id : row.yt_video_id ?? null;
      const currentCreatorId = ytVideoId ? ytVideoToCreatorId.get(ytVideoId) || null : null;
      const creatorRow = currentCreatorId ? creatorMap.get(currentCreatorId) : null;
      const settingRow = currentCreatorId ? settingsMap.get(currentCreatorId) : null;
      return {
        id: String(row.id || ''),
        ytVideoId,
        digestRunId: typeof row.digest_run_id === 'string' ? row.digest_run_id : row.digest_run_id ?? null,
        status: String(row.status || ''),
        retryCount: Number(row.retry_count || 0),
        errorMessage: typeof row.error_message === 'string' ? row.error_message : row.error_message ?? null,
        youtubeVideoUrl: String(row.youtube_video_url || ''),
        videoTitle: String(row.video_title || ''),
        creatorName: String(row.creator_name || ''),
        thumbnailUrl: typeof row.thumbnail_url === 'string' ? row.thumbnail_url : row.thumbnail_url ?? null,
        publishedAt: String(row.published_at || ''),
        summary: typeof row.summary === 'string' ? row.summary : row.summary ?? null,
        uniqueViewpoints: Array.isArray(row.unique_viewpoints) ? row.unique_viewpoints.map((v: any) => String(v || '')).filter(Boolean) : [],
        transcriptCharCount:
          row.transcript_char_count == null ? null : Number.isFinite(Number(row.transcript_char_count)) ? Number(row.transcript_char_count) : null,
        rawTranscript: typeof row.raw_transcript === 'string' ? row.raw_transcript : row.raw_transcript ?? null,
        sourceRemoved: !ytVideoId || !currentCreatorId || !creatorRow,
        currentCreatorId,
        currentCreatorIsActive: creatorRow ? !!creatorRow.is_active : null,
        digestEnabled: settingRow ? !!settingRow.enabled : null,
        topics: (topicsByVideoId.get(String(row.id || '')) || []).map((topic: any) => ({
          id: String(topic.id || ''),
          title: String(topic.title || ''),
          whatItIs: String(topic.what_it_is || ''),
          whyItMatters: String(topic.why_it_matters || ''),
          carouselAngle: typeof topic.carousel_angle === 'string' ? topic.carousel_angle : topic.carousel_angle ?? null,
          status: String(topic.status || 'active'),
          note: typeof topic.note === 'string' ? topic.note : topic.note ?? null,
          sortOrder: Number(topic.sort_order || 0),
        })),
      };
    }),
  } satisfies Resp);
}
