import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  // Backwards-safe: if any rows were created after Phase B without account_id, patch them into the user's Personal account.
  // This keeps legacy insert paths from "disappearing" when list becomes account-scoped.
  await supabase.from('carousel_projects').update({ account_id: accountId }).eq('owner_user_id', user.id).is('account_id', null);

  const { data, error } = await supabase
    .from('carousel_projects')
    .select('id, title, template_type_id, caption, updated_at, created_at, review_ready, review_posted, review_approved, review_scheduled')
    .eq('account_id', accountId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, projects: data || [] });
}


