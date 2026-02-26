import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  swipeIdeasMasterPromptOverride: string | null;
};

function sanitizePrompt(input: string): string {
  // Remove ASCII control chars that can break JSON payloads/logging,
  // but preserve common whitespace formatting (tabs/newlines).
  return String(input || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .trim();
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

  const { data: settingsRow, error: settingsErr } = await supabase
    .from('editor_account_settings')
    .select('swipe_ideas_master_prompt_override')
    .eq('account_id', accountId)
    .maybeSingle();
  if (settingsErr) {
    return NextResponse.json({ success: false, error: settingsErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    swipeIdeasMasterPromptOverride: String((settingsRow as any)?.swipe_ideas_master_prompt_override ?? ''),
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

  const raw = (body as any)?.swipeIdeasMasterPromptOverride;
  const next = raw === null ? null : sanitizePrompt(String(raw ?? ''));
  if (next !== null && next.length > 80_000) {
    return NextResponse.json({ success: false, error: 'swipeIdeasMasterPromptOverride too long' }, { status: 400 });
  }

  const { error: upErr } = await supabase
    .from('editor_account_settings')
    .upsert({ account_id: accountId, swipe_ideas_master_prompt_override: next }, { onConflict: 'account_id' });
  if (upErr) {
    return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, swipeIdeasMasterPromptOverride: next ?? '' });
}

