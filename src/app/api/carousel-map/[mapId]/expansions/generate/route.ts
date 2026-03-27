import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  buildCarouselMapExpansionsScopeKey,
  buildCarouselMapOpeningSignature,
  assertExpansionsPayload,
  buildCarouselMapExpansionsSystem,
  callAnthropicJson,
  extractJsonObject,
  generationKey,
  getAuthedCarouselMapContext,
  isUuid,
  loadBrandVoice,
  loadCarouselMapPrompt,
  loadCarouselMapGraph,
  persistCarouselMapSteering,
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

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const graph = await loadCarouselMapGraph({ supabase, accountId, mapId: id });
    const topic = graph.topics.find((row) => row.id === graph.selectedTopicId) || null;
    if (!topic) return NextResponse.json({ success: false, error: 'Select a topic first' } satisfies Resp, { status: 400 });
    const selectedSlide1Text = String(graph.selectedSlide1Text || '').trim();
    const selectedSlide2Text = String(graph.selectedSlide2Text || '').trim();
    if (!selectedSlide1Text || !selectedSlide2Text) {
      return NextResponse.json({ success: false, error: 'Choose Slide 1 and Slide 2 first' } satisfies Resp, { status: 400 });
    }

    const brandVoice = await loadBrandVoice({ supabase, accountId });
    const expansionsPrompt = await loadCarouselMapPrompt({ supabase, accountId, promptKey: 'expansions' });
    const currentExpansions = (graph.expansions || []).filter((row) => row.topicId === topic.id);
    const openingSignature = buildCarouselMapOpeningSignature({
      topicId: topic.id,
      selectedSlide1Text,
      selectedSlide2Text,
    });
    const scopeKey = buildCarouselMapExpansionsScopeKey({
      topicId: topic.id,
      selectedSlide1Text,
      selectedSlide2Text,
    });
    const hasSubmittedSteering = Object.prototype.hasOwnProperty.call(body || {}, 'steeringText');
    const submittedSteeringText = hasSubmittedSteering ? String(body?.steeringText || '') : null;
    const effectiveSteeringText = hasSubmittedSteering ? submittedSteeringText || '' : graph.expansionsSteering.steeringText;
    if (hasSubmittedSteering) {
      await persistCarouselMapSteering({
        supabase,
        accountId,
        userId: user.id,
        mapId: id,
        stageKey: 'expansions',
        topicId: topic.id,
        scopeKey,
        openingSignature,
        steeringText: effectiveSteeringText,
        markUsed: !!String(effectiveSteeringText || '').trim(),
      });
    } else if (String(graph.expansionsSteering.steeringText || '').trim()) {
      await persistCarouselMapSteering({
        supabase,
        accountId,
        userId: user.id,
        mapId: id,
        stageKey: 'expansions',
        topicId: topic.id,
        scopeKey,
        openingSignature,
        steeringText: graph.expansionsSteering.steeringText,
        markUsed: true,
      });
    }
    const system = buildCarouselMapExpansionsSystem({
      source: graph.source,
      topic,
      brandVoice,
      masterPrompt: expansionsPrompt.promptText,
      selectedSlide1Text,
      selectedSlide2Text,
      steeringText: effectiveSteeringText,
      currentExpansions,
    });
    const rawText = await callAnthropicJson({
      system,
      userText: 'Generate the slides 3-6 expansions now and return JSON only.',
      maxTokens: 3200,
      temperature: 0.3,
    });
    const expansions = assertExpansionsPayload(extractJsonObject(rawText));
    const key = generationKey();

    const { error: deleteErr } = await supabase
      .from('carousel_map_expansions')
      .delete()
      .eq('account_id', accountId)
      .eq('carousel_map_id', id)
      .eq('topic_id', topic.id);
    if (deleteErr) throw new Error(deleteErr.message);

    const rows = expansions.map((item, index) => ({
      account_id: accountId,
      carousel_map_id: id,
      topic_id: topic.id,
      created_by_user_id: user.id,
      source_generation_key: key,
      sort_order: index,
      selected_slide1_source_pair_id: graph.selectedSlide1SourcePairId,
      selected_slide2_source_pair_id: graph.selectedSlide2SourcePairId,
      selected_slide1_text: selectedSlide1Text,
      selected_slide2_text: selectedSlide2Text,
      slide3: item.slide3,
      slide4: item.slide4,
      slide5: item.slide5,
      slide6: item.slide6,
    }));
    const { error: insertErr } = await supabase.from('carousel_map_expansions').insert(rows as any);
    if (insertErr) throw new Error(insertErr.message);

    const next = await loadCarouselMapGraph({ supabase, accountId, mapId: id });
    return NextResponse.json({ success: true, graph: next } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}
