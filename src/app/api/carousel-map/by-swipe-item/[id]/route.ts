import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureCarouselMap,
  getAuthedCarouselMapContext,
  isUuid,
  loadCarouselMapGraph,
} from '../../_lib';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Resp =
  | { success: true; mapId: string; graph: any }
  | { success: false; error: string };

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthedCarouselMapContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, user, accountId } = auth;
    const { id } = await ctx.params;
    const swipeItemId = String(id || '').trim();
    if (!swipeItemId || !isUuid(swipeItemId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
    }
    const mapId = await ensureCarouselMap({ supabase, accountId, userId: user.id, swipeItemId });
    const graph = await loadCarouselMapGraph({ supabase, accountId, mapId });
    return NextResponse.json({ success: true, mapId, graph } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET(request, ctx);
}
