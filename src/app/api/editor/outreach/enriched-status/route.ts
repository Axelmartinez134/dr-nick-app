import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 15;

type Body = {
  usernames: string[];
};

type Resp =
  | { success: true; enrichedUsernames: string[] }
  | { success: false; error: string };

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

async function chunked<T>(arr: T[], size: number): Promise<T[][]> {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
  const usernamesRaw = Array.isArray((body as any)?.usernames) ? ((body as any).usernames as any[]) : [];
  const usernames = usernamesRaw.map(normalizeUsername).filter(Boolean) as string[];
  if (!usernames.length) return NextResponse.json({ success: false, error: 'usernames is required' } satisfies Resp, { status: 400 });
  if (usernames.length > 5000) return NextResponse.json({ success: false, error: 'Too many usernames (max 5000)' } satisfies Resp, { status: 400 });

  const enriched = new Set<string>();
  const chunks = await chunked(usernames, 200);
  for (const c of chunks) {
    const { data, error } = await supabase
      .from('editor_outreach_targets')
      .select('prospect_username')
      .eq('account_id', accountId)
      .eq('source_type', 'following')
      .in('prospect_username', c)
      .not('enriched_at', 'is', null);
    if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
    for (const r of Array.isArray(data) ? data : []) {
      const u = normalizeUsername((r as any)?.prospect_username);
      if (u) enriched.add(u);
    }
  }

  return NextResponse.json({ success: true, enrichedUsernames: Array.from(enriched) } satisfies Resp);
}

