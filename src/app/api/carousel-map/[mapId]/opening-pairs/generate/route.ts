import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  assertPairsPayload,
  buildCarouselMapOpeningsSystem,
  callAnthropicJson,
  extractJsonObject,
  generationKey,
  getAuthedCarouselMapContext,
  isUuid,
  loadBrandVoice,
  loadCarouselMapGraph,
} from '../../../_lib';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Resp = { success: true; graph: any } | { success: false; error: string };

export async function POST(request: NextRequest, ctx: { params: Promise<{ mapId: string }> }) {
  try {
    const auth = await getAuthedCarouselMapContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, accountId, user } = auth;
    const { mapId } = await ctx.params;
    const id = String(mapId || '').trim();
    if (!id || !isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid mapId' } satisfies Resp, { status: 400 });

    const graph = await loadCarouselMapGraph({ supabase, accountId, mapId: id });
    const topic = graph.topics.find((row) => row.id === graph.selectedTopicId) || null;
    if (!topic) return NextResponse.json({ success: false, error: 'Select a topic first' } satisfies Resp, { status: 400 });

    const brandVoice = await loadBrandVoice({ supabase, accountId });
    const system = buildCarouselMapOpeningsSystem({ source: graph.source, topic, brandVoice });
    const rawText = await callAnthropicJson({
      system,
      userText: 'Generate the opening pairs now and return JSON only.',
      maxTokens: 2600,
      temperature: 0.3,
    });
    const pairs = assertPairsPayload(extractJsonObject(rawText));
    const key = generationKey();

    const { error: deleteErr } = await supabase
      .from('carousel_map_opening_pairs')
      .delete()
      .eq('account_id', accountId)
      .eq('carousel_map_id', id)
      .eq('topic_id', topic.id);
    if (deleteErr) throw new Error(deleteErr.message);

    const rows = pairs.map((pair, index) => ({
      account_id: accountId,
      carousel_map_id: id,
      topic_id: topic.id,
      created_by_user_id: user.id,
      source_generation_key: key,
      sort_order: index,
      title: pair.title,
      slide1: pair.slide1,
      slide2: pair.slide2,
      angle_text: pair.angleText,
    }));
    const { error: insertErr } = await supabase.from('carousel_map_opening_pairs').insert(rows as any);
    if (insertErr) throw new Error(insertErr.message);

    // Reset selected opening and expansions when pairs regenerate.
    await supabase
      .from('carousel_maps')
      .update({
        selected_slide1_source_pair_id: null,
        selected_slide1_text: null,
        selected_slide2_source_pair_id: null,
        selected_slide2_text: null,
      } as any)
      .eq('account_id', accountId)
      .eq('id', id);
    await supabase.from('carousel_map_expansions').delete().eq('account_id', accountId).eq('carousel_map_id', id);

    const next = await loadCarouselMapGraph({ supabase, accountId, mapId: id });
    return NextResponse.json({ success: true, graph: next } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}
