import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  buildCarouselMapTopicsScopeKey,
  assertTopicsPayload,
  buildCarouselMapTopicsSystem,
  callAnthropicJson,
  extractJsonObject,
  generationKey,
  getAuthedCarouselMapContext,
  isUuid,
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
    const topicsPrompt = await loadCarouselMapPrompt({ supabase, accountId, promptKey: 'topics' });
    const hasSubmittedSteering = Object.prototype.hasOwnProperty.call(body || {}, 'steeringText');
    const submittedSteeringText = hasSubmittedSteering ? String(body?.steeringText || '') : null;
    const effectiveSteeringText = hasSubmittedSteering ? submittedSteeringText || '' : graph.topicsSteering.steeringText;
    if (hasSubmittedSteering) {
      await persistCarouselMapSteering({
        supabase,
        accountId,
        userId: user.id,
        mapId: id,
        stageKey: 'topics',
        scopeKey: buildCarouselMapTopicsScopeKey(),
        steeringText: effectiveSteeringText,
        markUsed: !!String(effectiveSteeringText || '').trim(),
      });
    } else if (String(graph.topicsSteering.steeringText || '').trim()) {
      await persistCarouselMapSteering({
        supabase,
        accountId,
        userId: user.id,
        mapId: id,
        stageKey: 'topics',
        scopeKey: buildCarouselMapTopicsScopeKey(),
        steeringText: graph.topicsSteering.steeringText,
        markUsed: true,
      });
    }
    const system = buildCarouselMapTopicsSystem({
      source: graph.source,
      masterPrompt: topicsPrompt.promptText,
      steeringText: effectiveSteeringText,
      currentTopics: graph.topics,
    });
    const rawText = await callAnthropicJson({
      system,
      userText: 'Extract the Carousel Map topics now and return the JSON only.',
      maxTokens: 2200,
      temperature: 0.1,
    });
    const topics = assertTopicsPayload(extractJsonObject(rawText));
    const key = generationKey();

    const { error: deleteErr } = await supabase
      .from('carousel_map_topics')
      .delete()
      .eq('account_id', accountId)
      .eq('carousel_map_id', id);
    if (deleteErr) throw new Error(deleteErr.message);

    const rows = topics.map((topic, index) => ({
      account_id: accountId,
      carousel_map_id: id,
      created_by_user_id: user.id,
      source_generation_key: key,
      sort_order: index,
      title: topic.title,
      summary: topic.summary,
      why_it_matters: topic.whyItMatters,
    }));
    const { error: insertErr } = await supabase.from('carousel_map_topics').insert(rows as any);
    if (insertErr) throw new Error(insertErr.message);

    // Reset downstream selections whenever topics are regenerated.
    await supabase
      .from('carousel_maps')
      .update({
        selected_topic_id: null,
        selected_slide1_source_pair_id: null,
        selected_slide1_text: null,
        selected_slide2_source_pair_id: null,
        selected_slide2_text: null,
      } as any)
      .eq('account_id', accountId)
      .eq('id', id);
    await supabase.from('carousel_map_opening_pairs').delete().eq('account_id', accountId).eq('carousel_map_id', id);
    await supabase.from('carousel_map_expansions').delete().eq('account_id', accountId).eq('carousel_map_id', id);

    const next = await loadCarouselMapGraph({ supabase, accountId, mapId: id });
    return NextResponse.json({ success: true, graph: next } satisfies Resp);
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status = msg === 'Carousel Map not found' ? 404 : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }
}
