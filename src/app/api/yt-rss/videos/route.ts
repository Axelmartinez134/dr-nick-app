import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedYtContext, listVideosWithMirrorInfo } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Resp =
  | { success: true; videos: Awaited<ReturnType<typeof listVideosWithMirrorInfo>> }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthedYtContext(request, { includeAccount: true });
  if (!ctx.ok) return NextResponse.json({ success: false, error: ctx.error } satisfies Resp, { status: ctx.status });
  const { supabase, user, accountId } = ctx;

  const url = new URL(request.url);
  const creatorId = String(url.searchParams.get('creatorId') || '').trim();
  const limitRaw = Number(url.searchParams.get('limit') || '100');
  const offsetRaw = Number(url.searchParams.get('offset') || '0');
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 100));
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0);

  if (creatorId && !isUuid(creatorId)) {
    return NextResponse.json({ success: false, error: 'Invalid creatorId' } satisfies Resp, { status: 400 });
  }

  try {
    const videos = await listVideosWithMirrorInfo({
      supabase,
      userId: user.id,
      accountId,
      creatorId: creatorId || undefined,
      limit,
      offset,
    });
    return NextResponse.json({ success: true, videos } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to list videos') } satisfies Resp, { status: 500 });
  }
}
