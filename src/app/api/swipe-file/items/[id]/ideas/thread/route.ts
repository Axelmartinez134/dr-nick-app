import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext } from '../../../../_utils';
import { ensureSwipeIdeasThread, normalizeSwipeIdeasChatMode } from '../_shared';

export const runtime = 'nodejs';
export const maxDuration = 30;

type MessageOut = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };

type Resp =
  | { success: true; threadId: string; messages: MessageOut[] }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthedSwipeContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, user, accountId } = auth;

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

    // Ensure the swipe item exists (account-scoped).
    const { data: itemRow, error: itemErr } = await supabase
      .from('swipe_file_items')
      .select('id')
      .eq('account_id', accountId)
      .eq('id', swipeItemId)
      .maybeSingle();
    if (itemErr) return NextResponse.json({ success: false, error: itemErr.message } satisfies Resp, { status: 500 });
    if (!itemRow?.id) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

    const threadId = await ensureSwipeIdeasThread({
      supabase,
      accountId,
      userId: user.id,
      swipeItemId,
      chatMode,
      sourceDigestTopicId: sourceDigestTopicId || null,
    });

    // Load recent messages (latest 50) and return oldest->newest.
    const { data: rows, error: msgErr } = await supabase
      .from('swipe_file_idea_messages')
      .select('id, role, content, created_at')
      .eq('account_id', accountId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (msgErr) return NextResponse.json({ success: false, error: msgErr.message } satisfies Resp, { status: 500 });
    const out: MessageOut[] = Array.isArray(rows)
      ? (rows as any[])
          .map((r) => ({
            id: String(r.id),
            role: (String(r.role) === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: String(r.content || ''),
            createdAt: String(r.created_at || ''),
          }))
          .reverse()
      : [];

    return NextResponse.json({ success: true, threadId, messages: out } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}

