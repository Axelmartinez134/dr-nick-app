import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext, s } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type CategoryRow = { id: string; name: string; sort_order: number; created_at: string };

type Resp =
  | { success: true; categories: Array<{ id: string; name: string; sortOrder: number; createdAt: string }> }
  | { success: false; error: string };

const DEFAULT_CATEGORIES = [
  { name: 'Repurpose inspiration', sortOrder: 10 },
  { name: 'Carousel outreach', sortOrder: 20 },
  { name: 'Send later', sortOrder: 30 },
  { name: 'Hook ideas', sortOrder: 40 },
  { name: 'Competitor research', sortOrder: 50 },
] as const;

async function listCategories(supabase: any, accountId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('swipe_file_categories')
    .select('id, name, sort_order, created_at')
    .eq('account_id', accountId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as any) : [];
}

async function ensureSeeded(supabase: any, accountId: string): Promise<void> {
  const existing = await listCategories(supabase, accountId);
  if (existing.length > 0) return;
  // Best-effort seed; unique index prevents dupes.
  const payload = DEFAULT_CATEGORIES.map((c) => ({
    account_id: accountId,
    name: c.name,
    sort_order: c.sortOrder,
  }));
  const { error } = await supabase.from('swipe_file_categories').insert(payload as any);
  if (error) {
    const code = (error as any)?.code;
    if (code === '23505') return;
    throw new Error(error.message);
  }
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthedSwipeContext(request);
  if (!ctx.ok) return NextResponse.json({ success: false, error: ctx.error } satisfies Resp, { status: ctx.status });
  const { supabase, accountId } = ctx;

  try {
    await ensureSeeded(supabase, accountId);
    const rows = await listCategories(supabase, accountId);
    return NextResponse.json({
      success: true,
      categories: rows.map((r) => ({
        id: String(r.id),
        name: String(r.name || '').trim(),
        sortOrder: Number(r.sort_order || 0),
        createdAt: String(r.created_at || ''),
      })),
    } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to list categories') } satisfies Resp, { status: 500 });
  }
}

type CreateBody = { name: string };

export async function POST(request: NextRequest) {
  const ctx = await getAuthedSwipeContext(request);
  if (!ctx.ok) return NextResponse.json({ success: false, error: ctx.error } satisfies Resp, { status: ctx.status });
  const { supabase, accountId } = ctx;

  let body: CreateBody | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }
  const nameRaw = s((body as any)?.name);
  const name = String(nameRaw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!name) return NextResponse.json({ success: false, error: 'name is required' } satisfies Resp, { status: 400 });
  if (name.length > 80) return NextResponse.json({ success: false, error: 'name is too long' } satisfies Resp, { status: 400 });

  try {
    await ensureSeeded(supabase, accountId);
    // place at end
    const { data: maxRow } = await supabase
      .from('swipe_file_categories')
      .select('sort_order')
      .eq('account_id', accountId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const maxSort = typeof (maxRow as any)?.sort_order === 'number' ? (maxRow as any).sort_order : 0;
    const nextSort = Math.max(0, Math.floor(maxSort)) + 10;

    const { error } = await supabase.from('swipe_file_categories').insert({ account_id: accountId, name, sort_order: nextSort } as any);
    if (error) {
      const code = (error as any)?.code;
      if (code === '23505') {
        // Already exists; fall through to list.
      } else {
        throw new Error(error.message);
      }
    }

    const rows = await listCategories(supabase, accountId);
    return NextResponse.json({
      success: true,
      categories: rows.map((r) => ({
        id: String(r.id),
        name: String(r.name || '').trim(),
        sortOrder: Number(r.sort_order || 0),
        createdAt: String(r.created_at || ''),
      })),
    } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to create category') } satisfies Resp, { status: 500 });
  }
}

