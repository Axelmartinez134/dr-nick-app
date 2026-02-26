import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext, s } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type IdeaOut = {
  id: string;
  createdAt: string;
  title: string;
  slideOutline: string[];
  angleText: string;
  sourceMessageId: string | null;
};

type Resp =
  | { success: true; ideas: IdeaOut[] }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

function normalizeSlideOutline(input: any): string[] {
  if (!Array.isArray(input)) return [];
  const out = input.map((x) => String(x ?? '')).slice(0, 6);
  return out.length === 6 ? out : [];
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

  const { data: rows, error } = await supabase
    .from('swipe_file_ideas')
    .select('id, created_at, title, slide_outline, angle_text, source_message_id')
    .eq('account_id', accountId)
    .eq('swipe_item_id', swipeItemId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const ideas: IdeaOut[] = Array.isArray(rows)
    ? (rows as any[]).map((r) => ({
        id: String(r.id),
        createdAt: String(r.created_at || ''),
        title: String(r.title || ''),
        slideOutline: normalizeSlideOutline(r.slide_outline),
        angleText: String(r.angle_text || ''),
        sourceMessageId: r.source_message_id ? String(r.source_message_id) : null,
      }))
    : [];

  return NextResponse.json({ success: true, ideas } satisfies Resp);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedSwipeContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user, accountId } = auth;

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

  const title = String(s(body?.title) || '').trim();
  const angleText = String(s(body?.angleText) || '').trim();
  const slideOutline = normalizeSlideOutline(body?.slideOutline);
  const threadId = s(body?.threadId);
  const sourceMessageId = s(body?.sourceMessageId);

  if (!title) return NextResponse.json({ success: false, error: 'Missing title' } satisfies Resp, { status: 400 });
  if (!angleText) return NextResponse.json({ success: false, error: 'Missing angleText' } satisfies Resp, { status: 400 });
  if (slideOutline.length !== 6) return NextResponse.json({ success: false, error: 'slideOutline must be length 6' } satisfies Resp, { status: 400 });
  if (title.length > 240) return NextResponse.json({ success: false, error: 'title too long' } satisfies Resp, { status: 400 });
  if (angleText.length > 50_000) return NextResponse.json({ success: false, error: 'angleText too long' } satisfies Resp, { status: 400 });

  if (threadId && !isUuid(threadId)) return NextResponse.json({ success: false, error: 'Invalid threadId' } satisfies Resp, { status: 400 });
  if (sourceMessageId && !isUuid(sourceMessageId)) {
    return NextResponse.json({ success: false, error: 'Invalid sourceMessageId' } satisfies Resp, { status: 400 });
  }

  const { error: insErr } = await supabase.from('swipe_file_ideas').insert({
    account_id: accountId,
    swipe_item_id: swipeItemId,
    thread_id: threadId || null,
    source_message_id: sourceMessageId || null,
    created_by_user_id: user.id,
    title,
    slide_outline: slideOutline as any,
    angle_text: angleText,
  } as any);
  if (insErr) return NextResponse.json({ success: false, error: insErr.message } satisfies Resp, { status: 500 });

  const { data: rows, error } = await supabase
    .from('swipe_file_ideas')
    .select('id, created_at, title, slide_outline, angle_text, source_message_id')
    .eq('account_id', accountId)
    .eq('swipe_item_id', swipeItemId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const ideas: IdeaOut[] = Array.isArray(rows)
    ? (rows as any[]).map((r) => ({
        id: String(r.id),
        createdAt: String(r.created_at || ''),
        title: String(r.title || ''),
        slideOutline: normalizeSlideOutline(r.slide_outline),
        angleText: String(r.angle_text || ''),
        sourceMessageId: r.source_message_id ? String(r.source_message_id) : null,
      }))
    : [];

  return NextResponse.json({ success: true, ideas } satisfies Resp);
}

