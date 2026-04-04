import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedDailyDigestContext } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 20;

type Resp = { success: true } | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

function isTopicStatus(v: string): v is 'active' | 'starred' | 'dismissed' {
  return v === 'active' || v === 'starred' || v === 'dismissed';
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedDailyDigestContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user, accountId } = auth;
  if (!accountId) return NextResponse.json({ success: false, error: 'Missing active account' } satisfies Resp, { status: 400 });

  const { id } = await ctx.params;
  const topicId = String(id || '').trim();
  if (!isUuid(topicId)) return NextResponse.json({ success: false, error: 'Invalid topic id' } satisfies Resp, { status: 400 });

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const patch: any = {};
  if (body?.status !== undefined) {
    const nextStatus = String(body.status || '').trim();
    if (!isTopicStatus(nextStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid topic status' } satisfies Resp, { status: 400 });
    }
    patch.status = nextStatus;
  }
  if (body?.note !== undefined) {
    const nextNote = typeof body.note === 'string' ? String(body.note) : '';
    if (nextNote.length > 25_000) {
      return NextResponse.json({ success: false, error: 'note too long' } satisfies Resp, { status: 400 });
    }
    patch.note = nextNote.trim() ? nextNote.trim() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' } satisfies Resp, { status: 400 });
  }

  const { error } = await supabase
    .from('daily_digest_topics')
    .update(patch)
    .eq('id', topicId)
    .eq('user_id', user.id)
    .eq('account_id', accountId);

  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  return NextResponse.json({ success: true } satisfies Resp);
}
