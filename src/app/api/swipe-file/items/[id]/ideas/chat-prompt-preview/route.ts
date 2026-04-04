import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeSuperadminContext } from '../../../../_utils';
import {
  buildSwipeIdeasContextText,
  buildSwipeIdeasSystemText,
  formatSwipeIdeasHistoryText,
  isUuid,
  loadSwipeIdeasContextOrThrow,
  loadSwipeIdeasDigestTopicContext,
  loadSwipeIdeasMasterPrompt,
  normalizeSwipeIdeasChatMode,
} from '../_shared';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp =
  | {
      success: true;
      threadId: string | null;
      system: string;
      contextText: string;
      historyText: string;
    }
  | { success: false; error: string };

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthedSwipeSuperadminContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, accountId } = auth;

    const { id } = await ctx.params;
    const swipeItemId = String(id || '').trim();
    const chatMode = normalizeSwipeIdeasChatMode(request.nextUrl.searchParams.get('chatMode'));
    const sourceDigestTopicId = String(request.nextUrl.searchParams.get('sourceDigestTopicId') || '').trim();
    if (!swipeItemId || !isUuid(swipeItemId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
    }
    if (sourceDigestTopicId && !isUuid(sourceDigestTopicId)) {
      return NextResponse.json({ success: false, error: 'Invalid sourceDigestTopicId' } satisfies Resp, { status: 400 });
    }

    const swipeContext = await loadSwipeIdeasContextOrThrow({ supabase, accountId, swipeItemId });
    const { brandVoice, masterPrompt } = await loadSwipeIdeasMasterPrompt({ supabase, accountId, chatMode });
    const system = buildSwipeIdeasSystemText({ masterPrompt });
    const digestTopicContext = sourceDigestTopicId
      ? await loadSwipeIdeasDigestTopicContext({ supabase, accountId, sourceDigestTopicId })
      : null;
    const contextText = buildSwipeIdeasContextText({ brandVoice, context: swipeContext, digestTopicContext });

    const threadQuery = supabase
      .from('swipe_file_idea_threads')
      .select('id')
      .eq('account_id', accountId)
      .eq('chat_mode', chatMode);
    if (sourceDigestTopicId) {
      threadQuery.eq('source_digest_topic_id', sourceDigestTopicId);
    } else {
      threadQuery.eq('swipe_item_id', swipeItemId).is('source_digest_topic_id', null);
    }
    const { data: threadRow, error: threadErr } = await threadQuery.maybeSingle();
    if (threadErr) return NextResponse.json({ success: false, error: threadErr.message } satisfies Resp, { status: 500 });

    const threadId = String((threadRow as any)?.id || '').trim() || null;
    let historyText = '(none)';

    if (threadId) {
      const { data: historyRows, error: historyErr } = await supabase
        .from('swipe_file_idea_messages')
        .select('role, content, created_at')
        .eq('account_id', accountId)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(24);
      if (historyErr) return NextResponse.json({ success: false, error: historyErr.message } satisfies Resp, { status: 500 });

      const history = (Array.isArray(historyRows) ? (historyRows as any[]) : [])
        .map((r) => ({
          role: String(r.role) === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: String(r.content || ''),
        }))
        .reverse();
      historyText = formatSwipeIdeasHistoryText(history);
    }

    return NextResponse.json({ success: true, threadId, system, contextText, historyText } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const lower = msg.toLowerCase();
    const status =
      msg === 'Not found'
        ? 404
        : lower.includes('transcript missing') || lower.includes('transcript too long')
          ? 400
          : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}
