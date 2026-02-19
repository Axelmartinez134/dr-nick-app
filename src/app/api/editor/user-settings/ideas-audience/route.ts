import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  ideasAudience: string | null;
};

function sanitizeAudience(input: string): string {
  return String(input || '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  const { data: settingsRow, error } = await supabase
    .from('editor_account_settings')
    .select('ideas_prompt_audience')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    ideasAudience: String((settingsRow as any)?.ideas_prompt_audience ?? ''),
  });
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const raw = (body as any)?.ideasAudience;
  const next = raw === null ? null : sanitizeAudience(String(raw ?? ''));

  const { error } = await supabase
    .from('editor_account_settings')
    .upsert({ account_id: accountId, ideas_prompt_audience: next }, { onConflict: 'account_id' });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, ideasAudience: next ?? '' });
}

