import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { cleanComment, resolveAccountIdFromReviewToken, serviceClient } from '../../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = { comment: string };

type Resp =
  | { success: true; projectId: string; review_comment: string; updated_at: string }
  | { success: false; error: string };

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string; projectId: string }> }) {
  const { token, projectId } = await ctx.params;
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)' } satisfies Resp,
      { status: 500 }
    );
  }

  const accountId = await resolveAccountIdFromReviewToken(admin, token);
  if (!accountId) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
  }

  const pid = String(projectId || '').trim();
  if (!pid) return NextResponse.json({ success: false, error: 'projectId is required' } satisfies Resp, { status: 400 });

  const next = cleanComment((body as any)?.comment);

  const { data, error } = await admin
    .from('carousel_projects')
    .update({ review_comment: next })
    .eq('id', pid)
    .eq('account_id', accountId)
    .is('archived_at', null)
    .select('id, review_comment, updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  if (!data?.id) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

  return NextResponse.json({
    success: true,
    projectId: String(data.id),
    review_comment: String((data as any).review_comment || ''),
    updated_at: String((data as any).updated_at || ''),
  } satisfies Resp);
}

