import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedCarouselMapContext, isUuid, loadCarouselMapGraph } from '../_lib';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Resp = { success: true; graph: any } | { success: false; error: string };

export async function GET(request: NextRequest, ctx: { params: Promise<{ mapId: string }> }) {
  try {
    const auth = await getAuthedCarouselMapContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { accountId, supabase } = auth;
    const { mapId } = await ctx.params;
    const id = String(mapId || '').trim();
    if (!id || !isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid mapId' } satisfies Resp, { status: 400 });
    const graph = await loadCarouselMapGraph({ supabase, accountId, mapId: id });
    return NextResponse.json({ success: true, graph } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status = msg === 'Carousel Map not found' ? 404 : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}
