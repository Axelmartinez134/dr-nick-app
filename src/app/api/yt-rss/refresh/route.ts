import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { fetchYoutubeFeed, getAuthedYtContext, upsertCreatorVideos } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 120;

type RefreshSummary = {
  creatorId: string;
  insertedCount: number;
  updatedCount: number;
};

type Resp =
  | {
      success: true;
      refreshedAt: string;
      insertedCount: number;
      updatedCount: number;
      failedFetches: number;
      errors: Array<{ creatorId: string; message: string }>;
      refreshedCreators: RefreshSummary[];
    }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

async function refreshOne(args: { supabase: any; userId: string; creator: any }): Promise<RefreshSummary> {
  const creatorId = String(args.creator.id || '').trim();
  const feedUrl = String(args.creator.feed_url || '').trim();
  const now = new Date().toISOString();
  try {
    const { channelName, videos } = await fetchYoutubeFeed(feedUrl);
    const counts = await upsertCreatorVideos({
      supabase: args.supabase,
      userId: args.userId,
      creatorId,
      videos,
    });
    const { error: updateErr } = await args.supabase
      .from('yt_creators')
      .update({
        channel_name: channelName,
        last_refreshed_at: now,
        last_refresh_error: null,
      } as any)
      .eq('id', creatorId)
      .eq('user_id', args.userId);
    if (updateErr) throw new Error(updateErr.message);
    return {
      creatorId,
      insertedCount: counts.insertedCount,
      updatedCount: counts.updatedCount,
    };
  } catch (e: any) {
    const msg = String(e?.message || 'Refresh failed');
    await args.supabase
      .from('yt_creators')
      .update({ last_refresh_error: msg } as any)
      .eq('id', creatorId)
      .eq('user_id', args.userId);
    throw new Error(msg);
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthedYtContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user } = auth;

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const creatorId = String(body?.creatorId || '').trim();
  if (creatorId && !isUuid(creatorId)) {
    return NextResponse.json({ success: false, error: 'Invalid creatorId' } satisfies Resp, { status: 400 });
  }

  try {
    let query = supabase
      .from('yt_creators')
      .select('id, feed_url, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (creatorId) query = query.eq('id', creatorId);
    else query = query.eq('is_active', true);

    const { data: creators, error: creatorsErr } = await query;
    if (creatorsErr) throw new Error(creatorsErr.message);
    const rows = Array.isArray(creators) ? creators : [];
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: creatorId ? 'Creator not found' : 'No active creators to refresh' } satisfies Resp, {
        status: 404,
      });
    }

    const settled = await Promise.allSettled(rows.map((creator) => refreshOne({ supabase, userId: user.id, creator })));
    const refreshedCreators: RefreshSummary[] = [];
    const errors: Array<{ creatorId: string; message: string }> = [];
    let insertedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < settled.length; i += 1) {
      const result = settled[i];
      const creator = rows[i];
      const rowCreatorId = String((creator as any)?.id || '');
      if (result.status === 'fulfilled') {
        refreshedCreators.push(result.value);
        insertedCount += result.value.insertedCount;
        updatedCount += result.value.updatedCount;
      } else {
        errors.push({
          creatorId: rowCreatorId,
          message: String(result.reason?.message || result.reason || 'Refresh failed'),
        });
      }
    }

    if (creatorId && errors.length > 0) {
      return NextResponse.json({ success: false, error: errors[0]?.message || 'Refresh failed' } satisfies Resp, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      refreshedAt: new Date().toISOString(),
      insertedCount,
      updatedCount,
      failedFetches: errors.length,
      errors,
      refreshedCreators,
    } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to refresh feeds') } satisfies Resp, { status: 500 });
  }
}
