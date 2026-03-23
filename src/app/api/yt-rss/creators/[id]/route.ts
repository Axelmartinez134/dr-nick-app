import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedYtContext } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 20;

type Resp = { success: true } | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedYtContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user } = auth;

  const { id } = await ctx.params;
  const creatorId = String(id || '').trim();
  if (!isUuid(creatorId)) return NextResponse.json({ success: false, error: 'Invalid creator id' } satisfies Resp, { status: 400 });

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const patch: any = {};
  if (body?.channelName !== undefined) {
    const channelName = String(body.channelName || '').trim();
    if (!channelName) return NextResponse.json({ success: false, error: 'channelName cannot be empty' } satisfies Resp, { status: 400 });
    patch.channel_name = channelName.slice(0, 160);
  }
  if (body?.isActive !== undefined) patch.is_active = !!body.isActive;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' } satisfies Resp, { status: 400 });
  }

  const { error } = await supabase.from('yt_creators').update(patch).eq('id', creatorId).eq('user_id', user.id);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  return NextResponse.json({ success: true } satisfies Resp);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedYtContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user } = auth;

  const { id } = await ctx.params;
  const creatorId = String(id || '').trim();
  if (!isUuid(creatorId)) return NextResponse.json({ success: false, error: 'Invalid creator id' } satisfies Resp, { status: 400 });

  const { error } = await supabase.from('yt_creators').delete().eq('id', creatorId).eq('user_id', user.id);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  return NextResponse.json({ success: true } satisfies Resp);
}
