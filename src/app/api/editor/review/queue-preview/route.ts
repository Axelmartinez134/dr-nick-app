import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type ProjectRow = {
  id: string;
  title: string;
  updated_at: string;
  review_ready: boolean;
  review_posted: boolean;
  review_approved: boolean;
  review_scheduled: boolean;
};

type Resp =
  | { success: true; projects: ProjectRow[] }
  | { success: false; error: string };

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  // Superadmin only.
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) return NextResponse.json({ success: false, error: saErr.message } satisfies Resp, { status: 500 });
  if (!saRow?.user_id) return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  const { data, error } = await supabase
    .from('carousel_projects')
    .select('id, title, updated_at, review_ready, review_posted, review_approved, review_scheduled')
    .eq('account_id', accountId)
    .is('archived_at', null)
    .eq('review_ready', true)
    .eq('review_posted', false)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const projects: ProjectRow[] = (data || []).map((r: any) => ({
    id: String(r?.id || ''),
    title: String(r?.title || 'Untitled Project'),
    updated_at: String(r?.updated_at || ''),
    review_ready: !!r?.review_ready,
    review_posted: !!r?.review_posted,
    review_approved: !!r?.review_approved,
    review_scheduled: !!r?.review_scheduled,
  }));

  return NextResponse.json({ success: true, projects } satisfies Resp);
}

