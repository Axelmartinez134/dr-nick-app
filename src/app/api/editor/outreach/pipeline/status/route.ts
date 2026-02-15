import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 15;

type Body = { usernames: string[] };

type Resp = { success: true; usernamesInPipeline: string[] } | { success: false; error: string };

async function requireSuperadmin(supabase: any, userId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (saErr) return { ok: false, status: 500, error: saErr.message };
  if (!saRow?.user_id) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

function normalizeUsername(v: any): string | null {
  const raw = typeof v === 'string' ? v.trim() : '';
  if (!raw) return null;
  return raw.replace(/^@+/, '').trim().toLowerCase() || null;
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }

  const raw = Array.isArray((body as any)?.usernames) ? ((body as any).usernames as any[]) : [];
  const usernames = Array.from(new Set(raw.map(normalizeUsername).filter(Boolean))) as string[];
  if (!usernames.length) return NextResponse.json({ success: true, usernamesInPipeline: [] } satisfies Resp);
  if (usernames.length > 2000) {
    return NextResponse.json({ success: false, error: 'Too many usernames (max 2000)' } satisfies Resp, { status: 400 });
  }

  const out = new Set<string>();

  // Scope: account rows + legacy rows owned by user where account_id is null.
  const baseScope = supabase
    .from('editor_outreach_targets')
    .select('username, prospect_username')
    .not('pipeline_stage', 'is', null)
    .or(`account_id.eq.${accountId},and(account_id.is.null,created_by_user_id.eq.${user.id})`)
    .limit(5000);

  // 1) Query legacy `username` column (always exists).
  {
    const { data, error } = await baseScope.in('username', usernames);
    if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
    for (const r of Array.isArray(data) ? data : []) {
      const u = normalizeUsername((r as any)?.username);
      if (u) out.add(u);
    }
  }

  // 2) Best-effort query `prospect_username` (may not exist on older schemas).
  try {
    const { data } = await baseScope.in('prospect_username', usernames);
    for (const r of Array.isArray(data) ? data : []) {
      const u = normalizeUsername((r as any)?.prospect_username);
      if (u) out.add(u);
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ success: true, usernamesInPipeline: Array.from(out.values()) } satisfies Resp);
}

