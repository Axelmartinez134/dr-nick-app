import { NextResponse } from 'next/server';
import { s } from '../../_utils';
import { requireServiceClient, resolveCaptureAccountContext, validateCaptureKeyOrThrow } from '../_utils';

export const runtime = 'nodejs';

type CategoryRow = { id: string; name: string; sort_order: number; created_at: string };

const DEFAULT_CATEGORIES = [
  { name: 'Repurpose inspiration', sortOrder: 10 },
  { name: 'Carousel outreach', sortOrder: 20 },
  { name: 'Send later', sortOrder: 30 },
  { name: 'Hook ideas', sortOrder: 40 },
  { name: 'Competitor research', sortOrder: 50 },
] as const;

async function listCategories(svc: any, accountId: string): Promise<CategoryRow[]> {
  const { data, error } = await svc
    .from('swipe_file_categories')
    .select('id, name, sort_order, created_at')
    .eq('account_id', accountId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as any) : [];
}

async function ensureSeeded(svc: any, accountId: string): Promise<void> {
  const existing = await listCategories(svc, accountId);
  if (existing.length > 0) return;
  const payload = DEFAULT_CATEGORIES.map((c) => ({
    account_id: accountId,
    name: c.name,
    sort_order: c.sortOrder,
  }));
  const { error } = await svc.from('swipe_file_categories').insert(payload as any);
  if (error) {
    const code = (error as any)?.code;
    if (code === '23505') return;
    throw new Error(error.message);
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const k = url.searchParams.get('k') || '';
    validateCaptureKeyOrThrow(k);

    const svc = requireServiceClient();
    const { accountId } = await resolveCaptureAccountContext(svc);

    await ensureSeeded(svc, accountId);
    const rows = await listCategories(svc, accountId);
    return NextResponse.json({
      success: true,
      categories: rows.map((r) => ({ id: String(r.id), name: String(r.name || '').trim() })),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const k = String(body?.k || '').trim();
    validateCaptureKeyOrThrow(k);

    const name = String(s(body?.name) || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!name) throw new Error('Missing category name');
    if (name.length > 80) throw new Error('name is too long');

    const svc = requireServiceClient();
    const { accountId } = await resolveCaptureAccountContext(svc);

    await ensureSeeded(svc, accountId);

    // place at end (match authed behavior)
    const { data: maxRow } = await svc
      .from('swipe_file_categories')
      .select('sort_order')
      .eq('account_id', accountId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const maxSort = typeof (maxRow as any)?.sort_order === 'number' ? (maxRow as any).sort_order : 0;
    const nextSort = Math.max(0, Math.floor(maxSort)) + 10;

    const { error } = await svc.from('swipe_file_categories').insert({ account_id: accountId, name, sort_order: nextSort } as any);
    if (error) {
      const code = (error as any)?.code;
      if (code !== '23505') throw new Error(error.message);
    }

    const rows = await listCategories(svc, accountId);
    return NextResponse.json({
      success: true,
      categories: rows.map((r) => ({ id: String(r.id), name: String(r.name || '').trim() })),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 401 });
  }
}

