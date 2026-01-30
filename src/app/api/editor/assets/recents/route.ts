import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type RecentRow = {
  id: string;
  url: string;
  storage_bucket: string | null;
  storage_path: string | null;
  kind: string;
  last_used_at: string;
  use_count: number;
};

function canonicalizeUrl(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    // Our storage URLs often include `?v=...` to bust caches. Remove it so recents dedupe properly.
    u.searchParams.delete('v');
    // If search becomes empty, remove trailing "?".
    u.search = u.searchParams.toString();
    return u.toString();
  } catch {
    // Not a valid absolute URL; best-effort strip common cache-buster.
    return s.replace(/([?&])v=[^&]+(&)?/g, (_m, p1, p2) => (p1 === '?' && !p2 ? '' : p1));
  }
}

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get('limit') || '');
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 30;

  const { data, error } = await supabase
    .from('editor_recent_assets')
    .select('id, url, storage_bucket, storage_path, kind, last_used_at, use_count')
    // Phase G: account-scoped recents (shared within account).
    // Backwards-safe fallback: allow legacy rows with account_id IS NULL owned by this user.
    .or(`account_id.eq.${accountId},and(account_id.is.null,owner_user_id.eq.${user.id})`)
    .order('last_used_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, recents: (data || []) as RecentRow[] });
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: any = {};
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const url = canonicalizeUrl(body?.url);
  if (!url) return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 });

  const storageBucket = body?.storage?.bucket ? String(body.storage.bucket).trim() : null;
  const storagePath = body?.storage?.path ? String(body.storage.path).trim() : null;
  const kind = String(body?.kind || 'upload').trim() || 'upload';

  const patch: any = {
    account_id: accountId,
    owner_user_id: user.id,
    url,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    kind,
    last_used_at: new Date().toISOString(),
  };

  const upsertId = async (onConflict: string) => {
    const { data, error } = await supabase
      .from('editor_recent_assets')
      .upsert(patch, { onConflict })
      .select('id')
      .single();
    return { data, error };
  };

  // Best practice: dedupe by storage when present, else by url.
  // We avoid incrementing use_count for now (optional); default on insert is 1.
  if (storageBucket && storagePath) {
    // Phase G: prefer account-scoped uniqueness; fall back to legacy owner-scoped constraint if migration not applied.
    const { data, error } = await upsertId('account_id,storage_bucket,storage_path');
    if (!error) return NextResponse.json({ success: true, id: data?.id || null });
    const msg = String((error as any)?.message || '');
    if (msg.toLowerCase().includes('no unique') || msg.toLowerCase().includes('conflict')) {
      const legacy = await upsertId('owner_user_id,storage_bucket,storage_path');
      if (legacy.error) return NextResponse.json({ success: false, error: legacy.error.message }, { status: 500 });
      return NextResponse.json({ success: true, id: legacy.data?.id || null });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Phase G: prefer account-scoped uniqueness; fall back to legacy owner-scoped constraint if migration not applied.
  const { data, error } = await upsertId('account_id,url');
  if (!error) return NextResponse.json({ success: true, id: data?.id || null });
  const msg = String((error as any)?.message || '');
  if (msg.toLowerCase().includes('no unique') || msg.toLowerCase().includes('conflict')) {
    const legacy = await upsertId('owner_user_id,url');
    if (legacy.error) return NextResponse.json({ success: false, error: legacy.error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: legacy.data?.id || null });
  }
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}

