import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { ensureVideoMirror, getAuthedYtContext, listVideosWithMirrorInfo } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 180;

type Resp =
  | { success: true; video: Awaited<ReturnType<typeof listVideosWithMirrorInfo>>[number] | null }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedYtContext(request, { includeAccount: true });
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user, accountId } = auth;

  const { id } = await ctx.params;
  const ytVideoId = String(id || '').trim();
  if (!isUuid(ytVideoId)) return NextResponse.json({ success: false, error: 'Invalid video id' } satisfies Resp, { status: 400 });
  if (!accountId) return NextResponse.json({ success: false, error: 'Missing active account' } satisfies Resp, { status: 400 });

  try {
    const swipeItemId = await ensureVideoMirror({
      supabase,
      userId: user.id,
      accountId,
      ytVideoId,
    });

    const origin = new URL(request.url).origin;
    const enrichRes = await fetch(`${origin}/api/swipe-file/items/${encodeURIComponent(swipeItemId)}/enrich`, {
      method: 'POST',
      headers: {
        authorization: String(request.headers.get('authorization') || ''),
        'content-type': 'application/json',
        'x-account-id': accountId,
      },
      cache: 'no-store',
    });
    const enrichJson = await enrichRes.json().catch(() => null);
    if (!enrichRes.ok || !enrichJson?.success) {
      throw new Error(String(enrichJson?.error || `Enrich failed (${enrichRes.status})`));
    }

    const videos = await listVideosWithMirrorInfo({
      supabase,
      userId: user.id,
      accountId,
      videoIds: [ytVideoId],
      limit: 1,
      offset: 0,
    });
    const video = videos.find((row) => row.id === ytVideoId) || null;
    return NextResponse.json({ success: true, video } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to enrich video') } satisfies Resp, { status: 500 });
  }
}
