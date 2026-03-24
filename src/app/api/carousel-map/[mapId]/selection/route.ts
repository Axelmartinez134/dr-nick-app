import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedCarouselMapContext, isUuid, loadCarouselMapGraph } from '../../_lib';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Resp = { success: true; graph: any } | { success: false; error: string };

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ mapId: string }> }) {
  try {
    const auth = await getAuthedCarouselMapContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, accountId } = auth;
    const { mapId } = await ctx.params;
    const id = String(mapId || '').trim();
    if (!id || !isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid mapId' } satisfies Resp, { status: 400 });

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const selectedTopicId = body?.selectedTopicId == null ? undefined : String(body.selectedTopicId || '').trim() || null;
    const selectedSlide1SourcePairId =
      body?.selectedSlide1SourcePairId == null ? undefined : String(body.selectedSlide1SourcePairId || '').trim() || null;
    const selectedSlide1Text = body?.selectedSlide1Text == null ? undefined : String(body.selectedSlide1Text || '').trim() || null;
    const selectedSlide2SourcePairId =
      body?.selectedSlide2SourcePairId == null ? undefined : String(body.selectedSlide2SourcePairId || '').trim() || null;
    const selectedSlide2Text = body?.selectedSlide2Text == null ? undefined : String(body.selectedSlide2Text || '').trim() || null;
    const clearExpansions = !!body?.clearExpansions;

    const patch: Record<string, string | null> = {};
    if (selectedTopicId !== undefined) patch.selected_topic_id = selectedTopicId;
    if (selectedSlide1SourcePairId !== undefined) patch.selected_slide1_source_pair_id = selectedSlide1SourcePairId;
    if (selectedSlide1Text !== undefined) patch.selected_slide1_text = selectedSlide1Text;
    if (selectedSlide2SourcePairId !== undefined) patch.selected_slide2_source_pair_id = selectedSlide2SourcePairId;
    if (selectedSlide2Text !== undefined) patch.selected_slide2_text = selectedSlide2Text;
    if (Object.keys(patch).length < 1) {
      return NextResponse.json({ success: false, error: 'No selection changes provided' } satisfies Resp, { status: 400 });
    }

    const { error: updateErr } = await supabase.from('carousel_maps').update(patch as any).eq('account_id', accountId).eq('id', id);
    if (updateErr) throw new Error(updateErr.message);

    if (clearExpansions) {
      const { error: deleteErr } = await supabase
        .from('carousel_map_expansions')
        .delete()
        .eq('account_id', accountId)
        .eq('carousel_map_id', id);
      if (deleteErr) throw new Error(deleteErr.message);
    }

    const graph = await loadCarouselMapGraph({ supabase, accountId, mapId: id });
    return NextResponse.json({ success: true, graph } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}
