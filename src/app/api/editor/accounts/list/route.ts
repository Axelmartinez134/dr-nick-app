import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type AccountItem = {
  accountId: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string | null;
};

type Resp = { success: true; accounts: AccountItem[] } | { success: false; error: string };

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  // Phase A: read-only endpoint for account switcher UI.
  // RLS ensures users can only see their own memberships + accounts they belong to.
  const { data, error } = await supabase
    .from('editor_account_memberships')
    .select('role, account:editor_accounts(id, display_name, created_at)')
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const accounts: AccountItem[] = [];
  for (const row of data || []) {
    const roleRaw = String((row as any)?.role || '').trim();
    const role = roleRaw === 'owner' || roleRaw === 'admin' || roleRaw === 'member' ? (roleRaw as AccountItem['role']) : 'member';
    const acct = (row as any)?.account || null;
    const accountId = String(acct?.id || '').trim();
    const displayName = String(acct?.display_name || '').trim();
    if (!accountId || !displayName) continue;
    accounts.push({ accountId, displayName, role, createdAt: acct?.created_at ?? null });
  }

  // Stable ordering: newest first, tie-break by display name.
  accounts.sort((a, b) => {
    const ta = Date.parse(String(a.createdAt || '')) || 0;
    const tb = Date.parse(String(b.createdAt || '')) || 0;
    if (tb !== ta) return tb - ta;
    return a.displayName.localeCompare(b.displayName);
  });

  return NextResponse.json({ success: true, accounts } satisfies Resp);
}

