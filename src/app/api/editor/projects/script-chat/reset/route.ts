import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = { projectId: string };

type Resp =
  | { success: true }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

async function assertSuperadmin(supabase: any, userId: string) {
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (saErr) throw new Error(saErr.message);
  if (!saRow?.user_id) {
    return { ok: false as const, status: 403 as const, error: 'Forbidden' };
  }
  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  try {
    const authed = await getAuthedSupabase(request);
    if (!authed.ok) {
      return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
    }
    const { supabase, user } = authed;

    const sa = await assertSuperadmin(supabase, user.id);
    if (!sa.ok) return NextResponse.json({ success: false, error: sa.error } satisfies Resp, { status: sa.status });

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
    if (!projectId || !isUuid(projectId)) {
      return NextResponse.json({ success: false, error: 'Invalid projectId' } satisfies Resp, { status: 400 });
    }

    // Delete thread (cascades messages).
    const { error: delErr } = await supabase
      .from('editor_project_script_threads')
      .delete()
      .eq('account_id', accountId)
      .eq('project_id', projectId);
    if (delErr) return NextResponse.json({ success: false, error: delErr.message } satisfies Resp, { status: 500 });

    return NextResponse.json({ success: true } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}

