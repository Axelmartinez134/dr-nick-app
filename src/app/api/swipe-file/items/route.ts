import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  canonicalizeInstagramUrl,
  derivePlatformFromUrl,
  getAuthedSwipeContext,
  isInstagramReelOrPostUrl,
  s,
  type SwipePlatform,
} from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 20;

type ItemOut = {
  id: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  platform: SwipePlatform;
  status: string;
  categoryId: string;
  tags: string[];
  note: string | null;
  enrichStatus: string;
  enrichError: string | null;
  enrichedAt: string | null;
  caption: string | null;
  transcript: string | null;
  authorHandle: string | null;
  title: string | null;
  thumbUrl: string | null;
  createdProjectId: string | null;
};

type Resp =
  | { success: true; items: ItemOut[] }
  | { success: false; error: string };

function normalizeTags(v: any): string[] {
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

export async function GET(request: NextRequest) {
  const ctx = await getAuthedSwipeContext(request);
  if (!ctx.ok) return NextResponse.json({ success: false, error: ctx.error } satisfies Resp, { status: ctx.status });
  const { supabase, accountId } = ctx;

  const u = new URL(request.url);
  const q = String(u.searchParams.get('q') || '').trim().toLowerCase();
  const categoryId = String(u.searchParams.get('categoryId') || '').trim();
  const status = String(u.searchParams.get('status') || '').trim();
  const platform = String(u.searchParams.get('platform') || '').trim();

  try {
    let query = supabase
      .from('swipe_file_items')
      .select(
        'id, created_at, updated_at, url, platform, status, category_id, tags, note, enrich_status, enrich_error, enriched_at, caption, transcript, author_handle, title, thumb_url, created_project_id'
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (categoryId) query = query.eq('category_id', categoryId);
    if (status) query = query.eq('status', status);
    if (platform) query = query.eq('platform', platform);
    if (q) {
      // Basic search (URL/caption/title/note). Keep simple for MVP.
      // NOTE: or() string is PostgREST; we avoid injection by limiting to ilike with escaped input.
      const safe = q.replace(/[%_]/g, '\\$&');
      query = query.or(`url.ilike.%${safe}%,title.ilike.%${safe}%,note.ilike.%${safe}%,caption.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = Array.isArray(data) ? data : [];

    const items: ItemOut[] = rows.map((r: any) => ({
      id: String(r.id || ''),
      createdAt: String(r.created_at || ''),
      updatedAt: String(r.updated_at || ''),
      url: String(r.url || ''),
      platform: (String(r.platform || 'unknown') as SwipePlatform) || 'unknown',
      status: String(r.status || 'new') || 'new',
      categoryId: String(r.category_id || ''),
      tags: Array.isArray(r.tags) ? (r.tags as any[]).map((t) => String(t || '').trim()).filter(Boolean) : [],
      note: typeof r.note === 'string' ? r.note : r.note ?? null,
      enrichStatus: String(r.enrich_status || 'idle') || 'idle',
      enrichError: typeof r.enrich_error === 'string' ? r.enrich_error : r.enrich_error ?? null,
      enrichedAt: typeof r.enriched_at === 'string' ? r.enriched_at : r.enriched_at ?? null,
      caption: typeof r.caption === 'string' ? r.caption : r.caption ?? null,
      transcript: typeof r.transcript === 'string' ? r.transcript : r.transcript ?? null,
      authorHandle: typeof r.author_handle === 'string' ? r.author_handle : r.author_handle ?? null,
      title: typeof r.title === 'string' ? r.title : r.title ?? null,
      thumbUrl: typeof r.thumb_url === 'string' ? r.thumb_url : r.thumb_url ?? null,
      createdProjectId: typeof r.created_project_id === 'string' ? r.created_project_id : r.created_project_id ?? null,
    }));

    return NextResponse.json({ success: true, items } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to list items') } satisfies Resp, { status: 500 });
  }
}

type CreateBody = {
  url: string;
  categoryId: string;
  tags?: string[] | string | null;
  note?: string | null;
};

export async function POST(request: NextRequest) {
  const ctx = await getAuthedSwipeContext(request);
  if (!ctx.ok) return NextResponse.json({ success: false, error: ctx.error } satisfies Resp, { status: ctx.status });
  const { supabase, user, accountId } = ctx;

  let body: CreateBody | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }

  const urlRaw = s((body as any)?.url);
  const categoryId = s((body as any)?.categoryId);
  if (!urlRaw) return NextResponse.json({ success: false, error: 'url is required' } satisfies Resp, { status: 400 });
  if (!categoryId) return NextResponse.json({ success: false, error: 'categoryId is required' } satisfies Resp, { status: 400 });

  const platform = derivePlatformFromUrl(urlRaw);
  const url = platform === 'instagram' ? canonicalizeInstagramUrl(urlRaw) : String(urlRaw || '').trim();
  const tags = normalizeTags((body as any)?.tags);
  const noteIn = typeof (body as any)?.note === 'string' ? String((body as any).note) : (body as any)?.note ?? null;
  const note = noteIn && typeof noteIn === 'string' ? String(noteIn).trim() || null : null;

  // Validate category belongs to account.
  const { data: catRow, error: catErr } = await supabase
    .from('swipe_file_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (catErr) return NextResponse.json({ success: false, error: catErr.message } satisfies Resp, { status: 500 });
  if (!catRow?.id) return NextResponse.json({ success: false, error: 'Invalid category' } satisfies Resp, { status: 400 });

  try {
    const enrichStatus =
      platform === 'instagram' && isInstagramReelOrPostUrl(url) ? ('idle' as const) : ('idle' as const);
    const { error } = await supabase.from('swipe_file_items').insert({
      account_id: accountId,
      created_by_user_id: user.id,
      url,
      platform,
      status: 'new',
      category_id: categoryId,
      tags,
      note,
      enrich_status: enrichStatus,
    } as any);
    if (error) throw new Error(error.message);

    // Return list (cheap; MVP).
    const { data, error: listErr } = await supabase
      .from('swipe_file_items')
      .select(
        'id, created_at, updated_at, url, platform, status, category_id, tags, note, enrich_status, enrich_error, enriched_at, caption, transcript, author_handle, title, thumb_url, created_project_id'
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (listErr) throw new Error(listErr.message);
    const rows = Array.isArray(data) ? data : [];
    const items: ItemOut[] = rows.map((r: any) => ({
      id: String(r.id || ''),
      createdAt: String(r.created_at || ''),
      updatedAt: String(r.updated_at || ''),
      url: String(r.url || ''),
      platform: (String(r.platform || 'unknown') as SwipePlatform) || 'unknown',
      status: String(r.status || 'new') || 'new',
      categoryId: String(r.category_id || ''),
      tags: Array.isArray(r.tags) ? (r.tags as any[]).map((t) => String(t || '').trim()).filter(Boolean) : [],
      note: typeof r.note === 'string' ? r.note : r.note ?? null,
      enrichStatus: String(r.enrich_status || 'idle') || 'idle',
      enrichError: typeof r.enrich_error === 'string' ? r.enrich_error : r.enrich_error ?? null,
      enrichedAt: typeof r.enriched_at === 'string' ? r.enriched_at : r.enriched_at ?? null,
      caption: typeof r.caption === 'string' ? r.caption : r.caption ?? null,
      transcript: typeof r.transcript === 'string' ? r.transcript : r.transcript ?? null,
      authorHandle: typeof r.author_handle === 'string' ? r.author_handle : r.author_handle ?? null,
      title: typeof r.title === 'string' ? r.title : r.title ?? null,
      thumbUrl: typeof r.thumb_url === 'string' ? r.thumb_url : r.thumb_url ?? null,
      createdProjectId: typeof r.created_project_id === 'string' ? r.created_project_id : r.created_project_id ?? null,
    }));

    return NextResponse.json({ success: true, items } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to create item') } satisfies Resp, { status: 500 });
  }
}

