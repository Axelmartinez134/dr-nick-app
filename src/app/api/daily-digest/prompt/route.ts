import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_DAILY_DIGEST_PROMPT,
  getAuthedDailyDigestContext,
  sanitizePrompt,
} from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp =
  | { success: true; prompt: string; isOverride: boolean }
  | { success: false; error: string };

export async function GET(request: NextRequest) {
  const auth = await getAuthedDailyDigestContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user, accountId } = auth;
  if (!accountId) return NextResponse.json({ success: false, error: 'Missing active account' } satisfies Resp, { status: 400 });

  const { data, error } = await supabase
    .from('daily_digest_prompt_overrides')
    .select('distill_prompt')
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const override = sanitizePrompt(String((data as any)?.distill_prompt || ''));
  return NextResponse.json({
    success: true,
    prompt: override || DEFAULT_DAILY_DIGEST_PROMPT,
    isOverride: !!override,
  } satisfies Resp);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthedDailyDigestContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user, accountId } = auth;
  if (!accountId) return NextResponse.json({ success: false, error: 'Missing active account' } satisfies Resp, { status: 400 });

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const next = sanitizePrompt(String(body?.distillPrompt || ''));
  if (!next) {
    return NextResponse.json({ success: false, error: 'distillPrompt is required' } satisfies Resp, { status: 400 });
  }
  if (next.length > 80_000) {
    return NextResponse.json({ success: false, error: 'distillPrompt too long' } satisfies Resp, { status: 400 });
  }

  const { error } = await supabase.from('daily_digest_prompt_overrides').upsert(
    {
      user_id: user.id,
      account_id: accountId,
      distill_prompt: next,
    } as any,
    { onConflict: 'user_id,account_id' }
  );
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  return NextResponse.json({ success: true, prompt: next, isOverride: true } satisfies Resp);
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthedDailyDigestContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user, accountId } = auth;
  if (!accountId) return NextResponse.json({ success: false, error: 'Missing active account' } satisfies Resp, { status: 400 });

  const { error } = await supabase
    .from('daily_digest_prompt_overrides')
    .delete()
    .eq('user_id', user.id)
    .eq('account_id', accountId);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  return NextResponse.json({ success: true, prompt: DEFAULT_DAILY_DIGEST_PROMPT, isOverride: false } satisfies Resp);
}
