import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { fetchYoutubeFeed, getAuthedYtContext, resolveYoutubeChannelDisplayName, resolveYoutubeFeedInput, upsertCreatorVideos } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type CreatorOut = {
  id: string;
  channelId: string;
  channelName: string;
  feedUrl: string;
  isActive: boolean;
  lastRefreshedAt: string | null;
  lastRefreshError: string | null;
  createdAt: string;
  videoCount: number;
};

type Resp =
  | { success: true; creators: CreatorOut[]; addedCreatorId?: string; refreshStats?: { insertedCount: number; updatedCount: number } }
  | { success: false; error: string };

async function listCreators(supabase: any, userId: string): Promise<CreatorOut[]> {
  const [{ data: creatorRows, error: creatorsErr }, { data: videoRows, error: videosErr }] = await Promise.all([
    supabase
      .from('yt_creators')
      .select('id, channel_id, channel_name, feed_url, is_active, last_refreshed_at, last_refresh_error, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase.from('yt_videos').select('creator_id').eq('user_id', userId),
  ]);
  if (creatorsErr) throw new Error(creatorsErr.message);
  if (videosErr) throw new Error(videosErr.message);

  const rows = Array.isArray(creatorRows) ? creatorRows : [];
  const suspicious = rows.filter((row: any) => {
    const channelName = String(row?.channel_name || '').trim().toLowerCase();
    return channelName === 'videos' || channelName === 'youtube creator' || !channelName;
  });

  if (suspicious.length > 0) {
    const fixes = await Promise.allSettled(
      suspicious.map(async (row: any) => {
        const creatorId = String(row?.id || '').trim();
        const channelId = String(row?.channel_id || '').trim();
        if (!creatorId || !channelId) return null;
        const nextName = await resolveYoutubeChannelDisplayName(channelId);
        const { error: updateErr } = await supabase
          .from('yt_creators')
          .update({ channel_name: nextName } as any)
          .eq('id', creatorId)
          .eq('user_id', userId);
        if (updateErr) throw new Error(updateErr.message);
        return { creatorId, nextName };
      })
    );

    for (const result of fixes) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const hit = rows.find((row: any) => String(row?.id || '') === result.value?.creatorId);
      if (hit) hit.channel_name = result.value.nextName;
    }
  }

  const counts = new Map<string, number>();
  for (const row of Array.isArray(videoRows) ? videoRows : []) {
    const creatorId = String((row as any)?.creator_id || '').trim();
    if (!creatorId) continue;
    counts.set(creatorId, (counts.get(creatorId) || 0) + 1);
  }

  return rows.map((row: any) => ({
    id: String(row.id || ''),
    channelId: String(row.channel_id || ''),
    channelName: String(row.channel_name || ''),
    feedUrl: String(row.feed_url || ''),
    isActive: !!row.is_active,
    lastRefreshedAt: typeof row.last_refreshed_at === 'string' ? row.last_refreshed_at : row.last_refreshed_at ?? null,
    lastRefreshError: typeof row.last_refresh_error === 'string' ? row.last_refresh_error : row.last_refresh_error ?? null,
    createdAt: String(row.created_at || ''),
    videoCount: counts.get(String(row.id || '')) || 0,
  }));
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthedYtContext(request);
  if (!ctx.ok) return NextResponse.json({ success: false, error: ctx.error } satisfies Resp, { status: ctx.status });
  const { supabase, user } = ctx;

  try {
    const creators = await listCreators(supabase, user.id);
    return NextResponse.json({ success: true, creators } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to list creators') } satisfies Resp, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthedYtContext(request);
  if (!ctx.ok) return NextResponse.json({ success: false, error: ctx.error } satisfies Resp, { status: ctx.status });
  const { supabase, user } = ctx;

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const validation = await resolveYoutubeFeedInput(String(body?.feedUrl || ''));
  if (!validation.ok) return NextResponse.json({ success: false, error: validation.error } satisfies Resp, { status: 400 });

  try {
    const { channelName, videos } = await fetchYoutubeFeed(validation.feedUrl);
    const { data: creator, error: insertErr } = await supabase
      .from('yt_creators')
      .insert({
        user_id: user.id,
        channel_id: validation.channelId,
        channel_name: channelName,
        feed_url: validation.feedUrl,
        is_active: true,
        last_refreshed_at: new Date().toISOString(),
        last_refresh_error: null,
      } as any)
      .select('id')
      .single();

    if (insertErr || !creator?.id) {
      const code = String((insertErr as any)?.code || '');
      if (code === '23505') {
        return NextResponse.json({ success: false, error: 'Creator already added' } satisfies Resp, { status: 409 });
      }
      throw new Error(insertErr?.message || 'Failed to add creator');
    }

    const refreshStats = await upsertCreatorVideos({
      supabase,
      userId: user.id,
      creatorId: String(creator.id),
      videos,
    });

    const creators = await listCreators(supabase, user.id);
    return NextResponse.json({
      success: true,
      creators,
      addedCreatorId: String(creator.id),
      refreshStats,
    } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to add creator') } satisfies Resp, { status: 500 });
  }
}
