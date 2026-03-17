import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext } from '../../../../_utils';
import { isUuid } from '../_shared';

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

    const { error: delErr } = await supabase
      .from('swipe_file_idea_threads')
      .delete()
      .eq('account_id', accountId)
      .eq('swipe_item_id', swipeItemId);
    if (delErr) return NextResponse.json({ success: false, error: delErr.message } satisfies Resp, { status: 500 });

    return NextResponse.json({ success: true } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}
