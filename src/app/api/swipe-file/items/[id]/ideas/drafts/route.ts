import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext } from '../../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type DraftOut = {
  id: string;
  createdAt: string;
  title: string;
  slideOutline: string[];
  angleText: string;
  sourceMessageId: string;
};

type Resp =
  | { success: true; drafts: DraftOut[] }
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
    .from('swipe_file_idea_drafts')
    .select('id, created_at, title, slide_outline, angle_text, source_message_id')
    .eq('account_id', accountId)
    .eq('swipe_item_id', swipeItemId)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const drafts: DraftOut[] = Array.isArray(rows)
    ? (rows as any[]).map((r) => ({
        id: String(r.id),
        createdAt: String(r.created_at || ''),
        title: String(r.title || ''),
        slideOutline: normalizeSlideOutline(r.slide_outline),
        angleText: String(r.angle_text || ''),
        sourceMessageId: String(r.source_message_id || ''),
      }))
    : [];

  return NextResponse.json({ success: true, drafts } satisfies Resp);
}

