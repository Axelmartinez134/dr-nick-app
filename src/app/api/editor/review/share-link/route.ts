import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp =
  | { success: true; token: string; path: string }
  | { success: false; error: string };

function makeToken(): string {
  // URL-safe base64 (no padding) for compact, unguessable tokens.
  return randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

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

  // Ensure the account has a persistent review token.
  const { data: settingsRow, error: settingsErr } = await supabase
    .from('editor_account_settings')
    .select('review_share_token')
    .eq('account_id', accountId)
    .maybeSingle();
  if (settingsErr) return NextResponse.json({ success: false, error: settingsErr.message } satisfies Resp, { status: 500 });

  const existing = String((settingsRow as any)?.review_share_token || '').trim();
  if (existing) {
    return NextResponse.json({ success: true, token: existing, path: `/editor/review/${existing}` } satisfies Resp);
  }

  const token = makeToken();

  // Upsert token. Uses RLS: requires actor is owner/admin of this account.
  const { data: upserted, error: upErr } = await supabase
    .from('editor_account_settings')
    .upsert({ account_id: accountId, review_share_token: token }, { onConflict: 'account_id' })
    .select('review_share_token')
    .single();
  if (upErr) {
    // If the token somehow collides (unique index), retry once.
    const msg = String(upErr.message || '');
    if (msg.toLowerCase().includes('duplicate') || msg.includes('23505')) {
      const token2 = makeToken();
      const retry = await supabase
        .from('editor_account_settings')
        .upsert({ account_id: accountId, review_share_token: token2 }, { onConflict: 'account_id' })
        .select('review_share_token')
        .single();
      if (retry.error) return NextResponse.json({ success: false, error: retry.error.message } satisfies Resp, { status: 500 });
      const tok = String((retry.data as any)?.review_share_token || '').trim();
      if (!tok) return NextResponse.json({ success: false, error: 'Failed to create review token' } satisfies Resp, { status: 500 });
      return NextResponse.json({ success: true, token: tok, path: `/editor/review/${tok}` } satisfies Resp);
    }
    return NextResponse.json({ success: false, error: upErr.message } satisfies Resp, { status: 500 });
  }

  const tok = String((upserted as any)?.review_share_token || '').trim();
  if (!tok) return NextResponse.json({ success: false, error: 'Failed to create review token' } satisfies Resp, { status: 500 });

  return NextResponse.json({ success: true, token: tok, path: `/editor/review/${tok}` } satisfies Resp);
}

