import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext, s, type SwipePlatform } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp = { success: true } | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(v);
}

type PatchBody = {
  note?: string | null;
  tags?: string[] | string | null;
  status?: 'new' | 'reviewed' | 'repurposed' | 'archived' | null;
  categoryId?: string | null;
};

function normalizeTags(v: any): string[] | null {
  if (v === null) return [];
  if (v === undefined) return null;
  if (Array.isArray(v)) {
    return v
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .slice(0, 30);
  }
  const raw = typeof v === 'string' ? v : '';
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function isStatus(v: any): v is NonNullable<PatchBody['status']> {
  return v === 'new' || v === 'reviewed' || v === 'repurposed' || v === 'archived';
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedSwipeContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, accountId } = auth;

  const { id } = await ctx.params;
  const itemId = String(id || '').trim();
  if (!itemId || !isUuid(itemId)) return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });

  let body: PatchBody | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }

  const patch: any = {};
  if ((body as any)?.note !== undefined) {
    const noteIn = (body as any)?.note;
    const note = typeof noteIn === 'string' ? String(noteIn).trim() || null : noteIn === null ? null : null;
    patch.note = note;
  }
  const tagsNorm = normalizeTags((body as any)?.tags);
  if (tagsNorm !== null) patch.tags = tagsNorm;

  const statusIn = (body as any)?.status;
  if (statusIn !== undefined) {
    if (statusIn === null) {
      // ignore null
    } else if (!isStatus(statusIn)) {
      return NextResponse.json({ success: false, error: 'Invalid status' } satisfies Resp, { status: 400 });
    } else {
      patch.status = statusIn;
    }
  }

  const categoryId = (body as any)?.categoryId;
  if (categoryId !== undefined) {
    const cid = s(categoryId);
    if (!cid) return NextResponse.json({ success: false, error: 'Invalid categoryId' } satisfies Resp, { status: 400 });
    // Validate category belongs to account.
    const { data: catRow, error: catErr } = await supabase
      .from('swipe_file_categories')
      .select('id')
      .eq('id', cid)
      .eq('account_id', accountId)
      .maybeSingle();
    if (catErr) return NextResponse.json({ success: false, error: catErr.message } satisfies Resp, { status: 500 });
    if (!catRow?.id) return NextResponse.json({ success: false, error: 'Invalid category' } satisfies Resp, { status: 400 });
    patch.category_id = cid;
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ success: false, error: 'No fields to update' } satisfies Resp, { status: 400 });

  const { error } = await supabase
    .from('swipe_file_items')
    .update(patch)
    .eq('id', itemId)
    .eq('account_id', accountId);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  return NextResponse.json({ success: true } satisfies Resp);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedSwipeContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, accountId } = auth;

  const { id } = await ctx.params;
  const itemId = String(id || '').trim();
  if (!itemId || !isUuid(itemId)) return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });

  const { error } = await supabase.from('swipe_file_items').delete().eq('id', itemId).eq('account_id', accountId);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  return NextResponse.json({ success: true } satisfies Resp);
}

