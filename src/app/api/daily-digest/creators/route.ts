import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedDailyDigestContext, listDailyDigestCreators } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 20;

type Resp =
  | { success: true; creators: Awaited<ReturnType<typeof listDailyDigestCreators>> }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

export async function GET(request: NextRequest) {
  const auth = await getAuthedDailyDigestContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user, accountId } = auth;
  if (!accountId) return NextResponse.json({ success: false, error: 'Missing active account' } satisfies Resp, { status: 400 });

  try {
    const creators = await listDailyDigestCreators({ supabase, userId: user.id, accountId });
    return NextResponse.json({ success: true, creators } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to list digest creators') } satisfies Resp, { status: 500 });
  }
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

  const ytCreatorId = String(body?.ytCreatorId || '').trim();
  if (!isUuid(ytCreatorId)) {
    return NextResponse.json({ success: false, error: 'Invalid ytCreatorId' } satisfies Resp, { status: 400 });
  }
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ success: false, error: 'enabled must be boolean' } satisfies Resp, { status: 400 });
  }

  const enabled = !!body.enabled;

  try {
    const { data: creator, error: creatorErr } = await supabase
      .from('yt_creators')
      .select('id')
      .eq('id', ytCreatorId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (creatorErr) throw new Error(creatorErr.message);
    if (!creator?.id) {
      return NextResponse.json({ success: false, error: 'Creator not found' } satisfies Resp, { status: 404 });
    }

    const { data: existing, error: existingErr } = await supabase
      .from('daily_digest_creator_settings')
      .select('id, enabled_at')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .eq('yt_creator_id', ytCreatorId)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);

    const nextEnabledAt = enabled
      ? new Date().toISOString()
      : (typeof (existing as any)?.enabled_at === 'string' ? (existing as any).enabled_at : (existing as any)?.enabled_at ?? null);

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from('daily_digest_creator_settings')
        .update({
          enabled,
          enabled_at: nextEnabledAt,
        } as any)
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .eq('account_id', accountId);
      if (updateErr) throw new Error(updateErr.message);
    } else {
      const { error: insertErr } = await supabase.from('daily_digest_creator_settings').insert({
        user_id: user.id,
        account_id: accountId,
        yt_creator_id: ytCreatorId,
        enabled,
        enabled_at: nextEnabledAt,
      } as any);
      if (insertErr) throw new Error(insertErr.message);
    }

    const creators = await listDailyDigestCreators({ supabase, userId: user.id, accountId });
    return NextResponse.json({ success: true, creators } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to update digest creator') } satisfies Resp, { status: 500 });
  }
}
