import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  projectId: string;
  reviewReady?: boolean;
  reviewPosted?: boolean;
  reviewApproved?: boolean;
  reviewScheduled?: boolean;
};

type Resp =
  | {
      success: true;
      project: {
        id: string;
        title: string;
        updated_at: string;
        review_ready: boolean;
        review_posted: boolean;
        review_approved: boolean;
        review_scheduled: boolean;
      };
    }
  | { success: false; error: string };

export async function POST(req: NextRequest) {
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
  }

  const projectId = String(body?.projectId || '').trim();
  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' } satisfies Resp, { status: 400 });

  const patch: any = {};
  if (typeof body.reviewReady === 'boolean') patch.review_ready = body.reviewReady;
  if (typeof body.reviewPosted === 'boolean') patch.review_posted = body.reviewPosted;
  if (typeof body.reviewApproved === 'boolean') patch.review_approved = body.reviewApproved;
  if (typeof body.reviewScheduled === 'boolean') patch.review_scheduled = body.reviewScheduled;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' } satisfies Resp, { status: 400 });
  }

  const { data, error } = await supabase
    .from('carousel_projects')
    .update(patch)
    .eq('id', projectId)
    .eq('account_id', accountId)
    .is('archived_at', null)
    .select('id, title, updated_at, review_ready, review_posted, review_approved, review_scheduled')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  return NextResponse.json({ success: true, project: data as any } satisfies Resp);
}

