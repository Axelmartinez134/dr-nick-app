import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  sourceId: string;
};

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const sourceId = String(body?.sourceId || '').trim();
  if (!sourceId) return NextResponse.json({ success: false, error: 'sourceId is required' }, { status: 400 });

  // Deleting the source cascades to runs + ideas via FK ON DELETE CASCADE.
  const { error } = await supabase
    .from('editor_idea_sources')
    .delete()
    .eq('id', sourceId)
    // Phase G: account-scoped sources (shared within account).
    // Backwards-safe fallback for legacy rows.
    .or(`account_id.eq.${accountId},and(account_id.is.null,owner_user_id.eq.${user.id})`);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, sourceId });
}

