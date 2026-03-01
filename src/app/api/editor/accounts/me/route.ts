import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type AccountItem = {
  accountId: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string | null;
};

type Resp =
  | { success: true; isSuperadmin: boolean; activeAccountId: string; accounts: AccountItem[] }
  | { success: false; error: string };

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const requestedActiveAccountId = acct.accountId;

  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) return NextResponse.json({ success: false, error: saErr.message } satisfies Resp, { status: 500 });
  const isSuperadmin = !!saRow?.user_id;

  const { data, error } = await supabase
    .from('editor_account_memberships')
    .select('role, account:editor_accounts(id, display_name, created_at)')
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const accounts: AccountItem[] = [];
  for (const row of data || []) {
    const roleRaw = String((row as any)?.role || '').trim();
    const role = roleRaw === 'owner' || roleRaw === 'admin' || roleRaw === 'member' ? (roleRaw as AccountItem['role']) : 'member';
    const acctRow = (row as any)?.account || null;
    const accountId = String(acctRow?.id || '').trim();
    const displayName = String(acctRow?.display_name || '').trim();
    if (!accountId || !displayName) continue;
    accounts.push({ accountId, displayName, role, createdAt: acctRow?.created_at ?? null });
  }

  // Stable ordering: newest first, tie-break by display name.
  accounts.sort((a, b) => {
    const ta = Date.parse(String(a.createdAt || '')) || 0;
    const tb = Date.parse(String(b.createdAt || '')) || 0;
    if (tb !== ta) return tb - ta;
    return a.displayName.localeCompare(b.displayName);
  });

  // Self-heal invalid x-account-id: only allow accounts the user actually belongs to.
  // This prevents stale localStorage from accidentally pointing a user at the wrong account context.
  const activeAccountId =
    accounts.some((a) => a.accountId === requestedActiveAccountId) ? requestedActiveAccountId : (accounts[0]?.accountId || '');

  return NextResponse.json({ success: true, isSuperadmin, activeAccountId, accounts } satisfies Resp);
}

