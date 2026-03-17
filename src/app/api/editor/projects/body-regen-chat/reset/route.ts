import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';
import { isUuid } from '../_shared';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = { projectId: string; slideIndex: number };

type Resp =
  | { success: true }
  | { success: false; error: string };

export async function POST(request: NextRequest) {
  try {
    const authed = await getAuthedSupabase(request);
    if (!authed.ok) {
      return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
    }
    const { supabase, user } = authed;

    const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
    if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
    const accountId = acct.accountId;

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
    }

    const projectId = String(body?.projectId || '').trim();
    const slideIndex = Number(body?.slideIndex);
    if (!projectId || !isUuid(projectId)) {
      return NextResponse.json({ success: false, error: 'Invalid projectId' } satisfies Resp, { status: 400 });
    }
    if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
      return NextResponse.json({ success: false, error: 'slideIndex must be 0..5' } satisfies Resp, { status: 400 });
    }

    const { error: delErr } = await supabase
      .from('carousel_body_regen_chat_threads')
      .delete()
      .eq('account_id', accountId)
      .eq('project_id', projectId)
      .eq('slide_index', slideIndex);
    if (delErr) return NextResponse.json({ success: false, error: delErr.message } satisfies Resp, { status: 500 });

    return NextResponse.json({ success: true } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}
