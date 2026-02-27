import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext } from '../../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Resp =
  | {
      success: true;
      context: {
        title: string;
        authorHandle: string;
        categoryName: string;
        caption: string;
        transcript: string;
        note: string;
      };
    }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedSwipeContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, accountId } = auth;

  const { id } = await ctx.params;
  const swipeItemId = String(id || '').trim();
  if (!swipeItemId || !isUuid(swipeItemId)) {
    return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
  }

  const { data: item, error: itemErr } = await supabase
    .from('swipe_file_items')
    .select('id, transcript, caption, title, author_handle, note, category_id')
    .eq('account_id', accountId)
    .eq('id', swipeItemId)
    .maybeSingle();
  if (itemErr) return NextResponse.json({ success: false, error: itemErr.message } satisfies Resp, { status: 500 });
  if (!item?.id) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

  const transcript = String((item as any)?.transcript || '').trim();
  if (!transcript) return NextResponse.json({ success: false, error: 'Transcript missing. Enrich first.' } satisfies Resp, { status: 400 });
  if (transcript.length > 25_000) {
    return NextResponse.json({ success: false, error: 'Transcript too long, can’t chat.' } satisfies Resp, { status: 400 });
  }

  const categoryId = String((item as any)?.category_id || '').trim();
  let categoryName = '';
  if (categoryId) {
    const { data: cat, error: catErr } = await supabase
      .from('swipe_file_categories')
      .select('name')
      .eq('account_id', accountId)
      .eq('id', categoryId)
      .maybeSingle();
    if (catErr) return NextResponse.json({ success: false, error: catErr.message } satisfies Resp, { status: 500 });
    categoryName = String((cat as any)?.name || '').trim();
  }

  return NextResponse.json({
    success: true,
    context: {
      title: String((item as any)?.title || '').trim(),
      authorHandle: String((item as any)?.author_handle || '').trim(),
      categoryName,
      caption: String((item as any)?.caption || '').trim(),
      transcript,
      note: String((item as any)?.note || '').trim(),
    },
  } satisfies Resp);
}

