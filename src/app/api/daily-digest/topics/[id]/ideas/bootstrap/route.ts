import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureDigestSwipeItemForTopic,
  getAuthedDailyDigestContext,
  loadDailyDigestTopicSourceOrThrow,
} from '../../../../_utils';
import { ensureSwipeIdeasThread, isUuid } from '@/app/api/swipe-file/items/[id]/ideas/_shared';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Resp =
  | { success: true; swipeItemId: string; threadId: string; initialDraft: string }
  | { success: false; error: string };

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

    const threadId = await ensureSwipeIdeasThread({
      supabase,
      accountId,
      userId,
      swipeItemId: ensuredSwipeItem.swipeItemId,
      chatMode: 'ideas',
      sourceDigestTopicId: source.topicId,
    });

    const initialDraft = [
      `Let's turn this digest topic into a strong carousel idea.`,
      '',
      `Topic: ${source.title}`,
      source.carouselAngle ? `Angle: ${source.carouselAngle}` : '',
      '',
      `What it is: ${source.whatItIs}`,
      '',
      `Why it matters: ${source.whyItMatters}`,
    ]
      .filter(Boolean)
      .join('\n');

    return NextResponse.json({
      success: true,
      swipeItemId: ensuredSwipeItem.swipeItemId,
      threadId,
      initialDraft,
    } satisfies Resp);
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
