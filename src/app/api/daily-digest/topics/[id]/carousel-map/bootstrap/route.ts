import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureDigestSwipeItemForTopic,
  getAuthedDailyDigestContext,
  loadDailyDigestTopicSourceOrThrow,
} from '../../../../_utils';
import { ensureCarouselMapForDigestTopic, isUuid } from '@/app/api/carousel-map/_lib';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Resp = { success: true; mapId: string } | { success: false; error: string };

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthedDailyDigestContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, user } = auth;
    const accountId = String(auth.accountId || '').trim();
    const userId = String(user?.id || '').trim();
    if (!accountId || !userId) return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies Resp, { status: 401 });

    const { id } = await ctx.params;
    const topicId = String(id || '').trim();
    if (!topicId || !isUuid(topicId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
    }

    const source = await loadDailyDigestTopicSourceOrThrow({ supabase, accountId, userId, topicId });
    const ensuredSwipeItem = await ensureDigestSwipeItemForTopic({
      supabase,
      accountId,
      userId,
      digestVideo: {
        youtubeVideoUrl: source.youtubeVideoUrl,
        videoTitle: source.videoTitle,
        creatorName: source.creatorName,
        thumbnailUrl: source.thumbnailUrl,
        summary: source.summary,
        rawTranscript: source.rawTranscript,
      },
    });

    const mapId = await ensureCarouselMapForDigestTopic({
      supabase,
      accountId,
      userId,
      swipeItemId: ensuredSwipeItem.swipeItemId,
      sourceDigestTopicId: source.topicId,
    });

    const { data: existingTopics, error: topicsErr } = await supabase
      .from('carousel_map_topics')
      .select('id')
      .eq('account_id', accountId)
      .eq('carousel_map_id', mapId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (topicsErr) throw new Error(topicsErr.message);

    let topicRowId = String((Array.isArray(existingTopics) ? existingTopics[0] : null as any)?.id || '').trim();
    if (!topicRowId) {
      const { data: insertedTopic, error: insertTopicErr } = await supabase
        .from('carousel_map_topics')
        .insert({
          account_id: accountId,
          carousel_map_id: mapId,
          source_generation_key: generationKey(),
          sort_order: 0,
          title: source.title,
          summary: source.whatItIs,
          why_it_matters: source.whyItMatters,
          created_by_user_id: user.id,
        } as any)
        .select('id')
        .single();
      if (insertTopicErr || !insertedTopic?.id) {
        throw new Error(insertTopicErr?.message || 'Failed to create map topic');
      }
      topicRowId = String(insertedTopic.id);
    }

    const { data: mapRow, error: mapErr } = await supabase
      .from('carousel_maps')
      .select('selected_topic_id')
      .eq('account_id', accountId)
      .eq('id', mapId)
      .maybeSingle();
    if (mapErr) throw new Error(mapErr.message);
    const selectedTopicId = String((mapRow as any)?.selected_topic_id || '').trim();
    if (!selectedTopicId) {
      const { error: updateErr } = await supabase
        .from('carousel_maps')
        .update({ selected_topic_id: topicRowId } as any)
        .eq('account_id', accountId)
        .eq('id', mapId);
      if (updateErr) throw new Error(updateErr.message);
    }

    return NextResponse.json({ success: true, mapId } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status =
      msg === 'Invalid id'
        ? 400
        : msg === 'Topic not found' || msg === 'Source video not found'
          ? 404
          : msg.includes('No transcript available') || msg === 'Invalid YouTube URL for this video'
            ? 400
            : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}

function generationKey() {
  return randomUUID();
}
