import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext } from '../../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type MessageOut = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };

type Resp =
  | { success: true; threadId: string; messages: MessageOut[] }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

async function ensureThread(args: { supabase: any; accountId: string; userId: string; swipeItemId: string }): Promise<string> {
  const { supabase, accountId, userId, swipeItemId } = args;

  // Load existing thread.
  const { data: existing, error: exErr } = await supabase
    .from('swipe_file_idea_threads')
    .select('id')
    .eq('account_id', accountId)
    .eq('swipe_item_id', swipeItemId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  const existingId = String((existing as any)?.id || '').trim();
  if (existingId) return existingId;

  // Create thread (handle rare race via unique constraint).
  const { data: inserted, error: insErr } = await supabase
    .from('swipe_file_idea_threads')
    .insert({ account_id: accountId, swipe_item_id: swipeItemId, created_by_user_id: userId } as any)
    .select('id')
    .maybeSingle();
  if (insErr) {
    const code = (insErr as any)?.code;
    if (code !== '23505') throw new Error(insErr.message);
  }
  const insertedId = String((inserted as any)?.id || '').trim();
  if (insertedId) return insertedId;

  // Race fallback: re-read.
  const { data: reread, error: rrErr } = await supabase
    .from('swipe_file_idea_threads')
    .select('id')
    .eq('account_id', accountId)
    .eq('swipe_item_id', swipeItemId)
    .maybeSingle();
  if (rrErr) throw new Error(rrErr.message);
  const rereadId = String((reread as any)?.id || '').trim();
  if (!rereadId) throw new Error('Failed to create idea thread');
  return rereadId;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthedSwipeContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, user, accountId } = auth;

    const { id } = await ctx.params;
    const swipeItemId = String(id || '').trim();
    if (!swipeItemId || !isUuid(swipeItemId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
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

    const threadId = await ensureThread({ supabase, accountId, userId: user.id, swipeItemId });

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

