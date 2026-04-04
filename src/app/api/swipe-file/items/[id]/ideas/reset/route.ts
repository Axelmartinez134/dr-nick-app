import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext } from '../../../../_utils';
import { isUuid, normalizeSwipeIdeasChatMode } from '../_shared';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp = { success: true } | { success: false; error: string };

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthedSwipeContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, accountId } = auth;

    const { id } = await ctx.params;
    const swipeItemId = String(id || '').trim();
    if (!swipeItemId || !isUuid(swipeItemId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
    }

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const chatMode = normalizeSwipeIdeasChatMode(body?.chatMode);
    const sourceDigestTopicId = String(body?.sourceDigestTopicId || '').trim();
    if (sourceDigestTopicId && !isUuid(sourceDigestTopicId)) {
      return NextResponse.json({ success: false, error: 'Invalid sourceDigestTopicId' } satisfies Resp, { status: 400 });
    }

    const query = supabase
      .from('swipe_file_idea_threads')
      .delete()
      .eq('account_id', accountId)
      .eq('chat_mode', chatMode);
    if (sourceDigestTopicId) {
      query.eq('source_digest_topic_id', sourceDigestTopicId);
    } else {
      query.eq('swipe_item_id', swipeItemId).is('source_digest_topic_id', null);
    }
    const { error: delErr } = await query;
    if (delErr) return NextResponse.json({ success: false, error: delErr.message } satisfies Resp, { status: 500 });

    return NextResponse.json({ success: true } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}
