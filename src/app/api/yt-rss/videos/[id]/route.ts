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
  const videoId = String(id || '').trim();
  if (!isUuid(videoId)) return NextResponse.json({ success: false, error: 'Invalid video id' } satisfies Resp, { status: 400 });

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body?.note === undefined) {
    return NextResponse.json({ success: false, error: 'No fields to update' } satisfies Resp, { status: 400 });
  }

  const note = typeof body.note === 'string' ? String(body.note).trim() || null : null;
  if (note && note.length > 25_000) {
    return NextResponse.json({ success: false, error: 'Angle / Notes must be 25,000 characters or fewer' } satisfies Resp, { status: 400 });
  }

  const { error } = await supabase.from('yt_videos').update({ note } as any).eq('id', videoId).eq('user_id', user.id);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  return NextResponse.json({ success: true } satisfies Resp);
}
