import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  aiImageGenModel: 'gpt-image-1.5' | 'gemini-3-pro-image-preview';
};

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

  const next = String((body as any)?.aiImageGenModel || '').trim();
  if (next !== 'gpt-image-1.5' && next !== 'gemini-3-pro-image-preview') {
    return NextResponse.json({ success: false, error: 'Invalid aiImageGenModel' }, { status: 400 });
  }

  const { error: upErr } = await supabase
    .from('editor_account_settings')
    .upsert({ account_id: accountId, ai_image_gen_model: next }, { onConflict: 'account_id' });
  if (upErr) {
    return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, aiImageGenModel: next });
}

