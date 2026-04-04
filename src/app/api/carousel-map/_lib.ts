import 'server-only';

import { createHash, randomUUID } from 'crypto';
import { getAuthedSwipeSuperadminContext } from '../swipe-file/_utils';
import {
  loadSwipeIdeasContextOrThrow,
  sanitizePrompt,
} from '../swipe-file/items/[id]/ideas/_shared';
import type {
  CarouselMapDigestTopicContext,
  CarouselMapExpansion,
  CarouselMapGraph,
  CarouselMapOpeningPair,
  CarouselMapPromptKey,
  CarouselMapPromptState,
  CarouselMapPromptSection,
  CarouselMapSource,
  CarouselMapSteeringStageKey,
  CarouselMapSteeringState,
  CarouselMapTopic,
} from './_types';

export function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

export async function getAuthedCarouselMapContext(request: Request) {
  return getAuthedSwipeSuperadminContext(request as any);
}

function stripMarkdownCodeFences(text: string): string {
  const raw = String(text || '').trim();
  if (!raw.startsWith('```')) return raw;
  const match = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1] ? String(match[1]).trim() : raw;
}

function extractFirstBalancedJsonObject(text: string): string {
  const raw = String(text || '');
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (start === -1) {
      if (ch === '{') {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  throw new Error('Model did not return a balanced JSON object');
}

export function extractJsonObject(text: string): any {
  const trimmed = stripMarkdownCodeFences(String(text || '').trim());
  try {
    return JSON.parse(trimmed);
  } catch {
    return JSON.parse(extractFirstBalancedJsonObject(trimmed));
  }
}

export async function callAnthropicJson(args: {
  system: string;
  userText: string;
  maxTokens?: number;
  temperature?: number;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
  if (!apiKey) throw new Error('Missing env var: ANTHROPIC_API_KEY');

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 90_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: typeof args.maxTokens === 'number' ? args.maxTokens : 2200,
        temperature: typeof args.temperature === 'number' ? args.temperature : 0.2,
        system: args.system,
        messages: [{ role: 'user', content: args.userText }],
      }),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error?.message || JSON.stringify(json)?.slice(0, 500) || 'Unknown Anthropic error';
      throw new Error(`Anthropic error (${res.status}): ${msg}`);
    }
    return String(json?.content?.[0]?.text || '');
  } finally {
    clearTimeout(t);
  }
}

export async function ensureCarouselMap(args: {
  supabase: any;
  accountId: string;
  userId: string;
  swipeItemId: string;
}) {
  const { supabase, accountId, userId, swipeItemId } = args;
  const { data: existing, error: existingErr } = await supabase
    .from('carousel_maps')
    .select('id')
    .eq('account_id', accountId)
    .eq('swipe_item_id', swipeItemId)
    .is('source_digest_topic_id', null)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  const existingId = String((existing as any)?.id || '').trim();
  if (existingId) return existingId;

  const { data: inserted, error: insertedErr } = await supabase
    .from('carousel_maps')
    .insert({
      account_id: accountId,
      swipe_item_id: swipeItemId,
      source_digest_topic_id: null,
      created_by_user_id: userId,
    } as any)
    .select('id')
    .maybeSingle();
  if (insertedErr && String((insertedErr as any)?.code || '') !== '23505') {
    throw new Error(insertedErr.message);
  }
  const insertedId = String((inserted as any)?.id || '').trim();
  if (insertedId) return insertedId;

  const { data: reread, error: rereadErr } = await supabase
    .from('carousel_maps')
    .select('id')
    .eq('account_id', accountId)
    .eq('swipe_item_id', swipeItemId)
    .is('source_digest_topic_id', null)
    .maybeSingle();
  if (rereadErr) throw new Error(rereadErr.message);
  const rereadId = String((reread as any)?.id || '').trim();
  if (!rereadId) throw new Error('Failed to create Carousel Map');
  return rereadId;
}

export async function ensureCarouselMapForDigestTopic(args: {
  supabase: any;
  accountId: string;
  userId: string;
  swipeItemId: string;
  sourceDigestTopicId: string;
}) {
  const { supabase, accountId, userId, swipeItemId, sourceDigestTopicId } = args;
  const { data: existing, error: existingErr } = await supabase
    .from('carousel_maps')
    .select('id')
    .eq('account_id', accountId)
    .eq('source_digest_topic_id', sourceDigestTopicId)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  const existingId = String((existing as any)?.id || '').trim();
  if (existingId) return existingId;

  const { data: inserted, error: insertedErr } = await supabase
    .from('carousel_maps')
    .insert({
      account_id: accountId,
      swipe_item_id: swipeItemId,
      source_digest_topic_id: sourceDigestTopicId,
      created_by_user_id: userId,
    } as any)
    .select('id')
    .maybeSingle();
  if (insertedErr && String((insertedErr as any)?.code || '') !== '23505') {
    throw new Error(insertedErr.message);
  }
  const insertedId = String((inserted as any)?.id || '').trim();
  if (insertedId) return insertedId;

  const { data: reread, error: rereadErr } = await supabase
    .from('carousel_maps')
    .select('id')
    .eq('account_id', accountId)
    .eq('source_digest_topic_id', sourceDigestTopicId)
    .maybeSingle();
  if (rereadErr) throw new Error(rereadErr.message);
  const rereadId = String((reread as any)?.id || '').trim();
  if (!rereadId) throw new Error('Failed to create Carousel Map');
  return rereadId;
}

async function loadCategoryName(args: { supabase: any; accountId: string; swipeItemId: string }) {
  const { supabase, accountId, swipeItemId } = args;
  const { data: row, error } = await supabase
    .from('swipe_file_items')
    .select('category_id')
    .eq('account_id', accountId)
    .eq('id', swipeItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const categoryId = String((row as any)?.category_id || '').trim();
  if (!categoryId) return '';
  const { data: cat, error: catErr } = await supabase
    .from('swipe_file_categories')
    .select('name')
    .eq('account_id', accountId)
    .eq('id', categoryId)
    .maybeSingle();
  if (catErr) throw new Error(catErr.message);
  return String((cat as any)?.name || '').trim();
}

export async function loadCarouselMapGraph(args: {
  supabase: any;
  accountId: string;
  mapId: string;
}): Promise<CarouselMapGraph> {
  const { supabase, accountId, mapId } = args;
  const { data: mapRow, error: mapErr } = await supabase
    .from('carousel_maps')
    .select(
      'id, swipe_item_id, source_digest_topic_id, selected_topic_id, selected_slide1_source_pair_id, selected_slide1_text, selected_slide2_source_pair_id, selected_slide2_text'
    )
    .eq('account_id', accountId)
    .eq('id', mapId)
    .maybeSingle();
  if (mapErr) throw new Error(mapErr.message);
  if (!mapRow?.id) throw new Error('Carousel Map not found');

  const swipeItemId = String((mapRow as any)?.swipe_item_id || '').trim();
  const sourceDigestTopicId = String((mapRow as any)?.source_digest_topic_id || '').trim();
  const sourceContext = await loadSwipeIdeasContextOrThrow({ supabase, accountId, swipeItemId });
  const categoryName = sourceContext.categoryName || (await loadCategoryName({ supabase, accountId, swipeItemId }));
  const source: CarouselMapSource = {
    swipeItemId,
    url: sourceContext.url,
    title: sourceContext.title,
    authorHandle: sourceContext.authorHandle,
    platform: sourceContext.platform,
    categoryName,
    caption: sourceContext.caption,
    transcript: sourceContext.transcript,
    note: sourceContext.note,
  };

  let digestTopic: CarouselMapDigestTopicContext | null = null;
  if (sourceDigestTopicId) {
    const { data: digestRow, error: digestErr } = await supabase
      .from('daily_digest_topics')
      .select('id, title, what_it_is, why_it_matters, carousel_angle')
      .eq('account_id', accountId)
      .eq('id', sourceDigestTopicId)
      .maybeSingle();
    if (digestErr) throw new Error(digestErr.message);
    if (digestRow?.id) {
      digestTopic = {
        id: String(digestRow.id),
        title: String((digestRow as any)?.title || ''),
        whatItIs: String((digestRow as any)?.what_it_is || ''),
        whyItMatters: String((digestRow as any)?.why_it_matters || ''),
        carouselAngle: String((digestRow as any)?.carousel_angle || '').trim() || null,
      };
    }
  }

  const [topicsRes, pairsRes, expansionsRes] = await Promise.all([
    supabase
      .from('carousel_map_topics')
      .select('id, source_generation_key, sort_order, title, summary, why_it_matters, created_at')
      .eq('account_id', accountId)
      .eq('carousel_map_id', mapId)
      .order('created_at', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('carousel_map_opening_pairs')
      .select('id, topic_id, source_generation_key, sort_order, title, slide1, slide2, angle_text, created_at')
      .eq('account_id', accountId)
      .eq('carousel_map_id', mapId)
      .order('created_at', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('carousel_map_expansions')
      .select(
        'id, topic_id, source_generation_key, sort_order, selected_slide1_source_pair_id, selected_slide2_source_pair_id, selected_slide1_text, selected_slide2_text, slide3, slide4, slide5, slide6, created_at'
      )
      .eq('account_id', accountId)
      .eq('carousel_map_id', mapId)
      .order('created_at', { ascending: true })
      .order('sort_order', { ascending: true }),
  ]);
  if (topicsRes.error) throw new Error(topicsRes.error.message);
  if (pairsRes.error) throw new Error(pairsRes.error.message);
  if (expansionsRes.error) throw new Error(expansionsRes.error.message);

  const topics: CarouselMapTopic[] = Array.isArray(topicsRes.data)
    ? topicsRes.data.map((row: any) => ({
        id: String(row.id),
        sourceGenerationKey: String(row.source_generation_key),
        sortOrder: Number(row.sort_order || 0),
        title: String(row.title || ''),
        summary: String(row.summary || ''),
        whyItMatters: String(row.why_it_matters || ''),
        createdAt: String(row.created_at || ''),
      }))
    : [];

  const openingPairs: CarouselMapOpeningPair[] = Array.isArray(pairsRes.data)
    ? pairsRes.data.map((row: any) => ({
        id: String(row.id),
        topicId: String(row.topic_id),
        sourceGenerationKey: String(row.source_generation_key),
        sortOrder: Number(row.sort_order || 0),
        title: String(row.title || ''),
        slide1: String(row.slide1 || ''),
        slide2: String(row.slide2 || ''),
        angleText: String(row.angle_text || ''),
        createdAt: String(row.created_at || ''),
      }))
    : [];

  const expansions: CarouselMapExpansion[] = Array.isArray(expansionsRes.data)
    ? expansionsRes.data.map((row: any) => ({
        id: String(row.id),
        topicId: String(row.topic_id),
        sourceGenerationKey: String(row.source_generation_key),
        sortOrder: Number(row.sort_order || 0),
        selectedSlide1SourcePairId: row.selected_slide1_source_pair_id ? String(row.selected_slide1_source_pair_id) : null,
        selectedSlide2SourcePairId: row.selected_slide2_source_pair_id ? String(row.selected_slide2_source_pair_id) : null,
        selectedSlide1Text: String(row.selected_slide1_text || ''),
        selectedSlide2Text: String(row.selected_slide2_text || ''),
        slide3: String(row.slide3 || ''),
        slide4: String(row.slide4 || ''),
        slide5: String(row.slide5 || ''),
        slide6: String(row.slide6 || ''),
        createdAt: String(row.created_at || ''),
      }))
    : [];

  const topicsScopeKey = buildCarouselMapTopicsScopeKey();
  const openingPairsScopeKey = mapRow?.selected_topic_id ? buildCarouselMapOpeningPairsScopeKey(String((mapRow as any).selected_topic_id || '')) : '';
  const openingSignature = buildCarouselMapOpeningSignature({
    topicId: (mapRow as any)?.selected_topic_id,
    selectedSlide1Text: (mapRow as any)?.selected_slide1_text,
    selectedSlide2Text: (mapRow as any)?.selected_slide2_text,
  });
  const expansionsScopeKey = openingSignature ? `opening:${openingSignature}` : '';
  const [topicsSteering, openingPairsSteering, expansionsSteering] = await Promise.all([
    loadCarouselMapSteeringState({
      supabase,
      accountId,
      mapId,
      stageKey: 'topics',
      scopeKey: topicsScopeKey,
    }),
    loadCarouselMapSteeringState({
      supabase,
      accountId,
      mapId,
      stageKey: 'opening_pairs',
      scopeKey: openingPairsScopeKey,
    }),
    loadCarouselMapSteeringState({
      supabase,
      accountId,
      mapId,
      stageKey: 'expansions',
      scopeKey: expansionsScopeKey,
    }),
  ]);

  return {
    id: String(mapRow.id),
    source,
    digestTopic,
    selectedTopicId: (mapRow as any)?.selected_topic_id ? String((mapRow as any).selected_topic_id) : null,
    selectedSlide1SourcePairId: (mapRow as any)?.selected_slide1_source_pair_id ? String((mapRow as any).selected_slide1_source_pair_id) : null,
    selectedSlide1Text: (mapRow as any)?.selected_slide1_text ? String((mapRow as any).selected_slide1_text) : null,
    selectedSlide2SourcePairId: (mapRow as any)?.selected_slide2_source_pair_id ? String((mapRow as any).selected_slide2_source_pair_id) : null,
    selectedSlide2Text: (mapRow as any)?.selected_slide2_text ? String((mapRow as any).selected_slide2_text) : null,
    topics,
    openingPairs,
    expansions,
    topicsSteering,
    openingPairsSteering,
    expansionsSteering,
  };
}

export const DEFAULT_CAROUSEL_MAP_TOPICS_MASTER_PROMPT = `You are extracting topics from one long-form source for Carousel Map.

Your job:
- Identify the real topics in the source material.
- Ignore filler, repetition, storytelling padding, and generic motivational language.
- Focus only on topics that could plausibly become strong carousel directions.
- Make each topic specific enough that it feels useful, distinct, and actionable.
- Summarize why each topic matters so the user can quickly decide where to explore.`;

export const DEFAULT_CAROUSEL_MAP_OPENING_PAIRS_MASTER_PROMPT = `You are an idea-generation assistant for Instagram carousel opening slides.

Your job:
- Help me develop only the first two slides of a carousel.
- Focus on strong hooks, framing, tension, clarity, novelty, and payoff.
- Do not generate slides 3-6.
- Produce multiple viable opening-slide pairs grounded in the source material and brand voice.
- Keep in mind that Slide 1 has to be contextually relevant to what was talked about inside the source material and its pure purpose is to get someone to swipe.
- Slide 1 does not need to be wordy or long. It just has to get someone to swipe to read Slide 2.
- Slide 2 has a second life on Instagram because someone may be shown Slide 2 if they skipped Slide 1 in the feed.
- Slide 2 must also have a hook, but it should give a little more context while changing the framing just enough that it does not feel like Slide 1 repeated.
- Slide 2 can contain a bit more information, but it should still feel punchy and make someone want to read the rest of the slides.`;

export const DEFAULT_CAROUSEL_MAP_EXPANSIONS_MASTER_PROMPT = `You are expanding an Instagram carousel after the opening has already been chosen.

Your job:
- Respect the selected Slide 1 and Slide 2 exactly as the opening.
- Generate multiple strong options for Slides 3-6 only.
- Keep the logic tight, escalating, and aligned with the source material.
- Make Slides 3-6 feel like a natural continuation of the chosen opening rather than a disconnected second draft.
- Land the carousel with a strong payoff, conclusion, or CTA when appropriate.`;

export function getDefaultCarouselMapPrompt(promptKey: CarouselMapPromptKey): string {
  if (promptKey === 'topics') return DEFAULT_CAROUSEL_MAP_TOPICS_MASTER_PROMPT;
  if (promptKey === 'opening_pairs') return DEFAULT_CAROUSEL_MAP_OPENING_PAIRS_MASTER_PROMPT;
  return DEFAULT_CAROUSEL_MAP_EXPANSIONS_MASTER_PROMPT;
}

export async function loadCarouselMapPrompt(args: {
  supabase: any;
  accountId: string;
  promptKey: CarouselMapPromptKey;
}): Promise<CarouselMapPromptState> {
  const { supabase, accountId, promptKey } = args;
  const { data, error } = await supabase
    .from('editor_account_prompt_overrides')
    .select('prompt_text')
    .eq('account_id', accountId)
    .eq('surface', 'carousel_map')
    .eq('prompt_key', promptKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const overrideText = typeof (data as any)?.prompt_text === 'string' ? String((data as any).prompt_text) : null;
  return {
    promptKey,
    promptText: overrideText !== null ? overrideText : getDefaultCarouselMapPrompt(promptKey),
    isOverride: overrideText !== null,
  };
}

export async function loadAllCarouselMapPrompts(args: { supabase: any; accountId: string }) {
  const [topics, openingPairs, expansions] = await Promise.all([
    loadCarouselMapPrompt({ ...args, promptKey: 'topics' }),
    loadCarouselMapPrompt({ ...args, promptKey: 'opening_pairs' }),
    loadCarouselMapPrompt({ ...args, promptKey: 'expansions' }),
  ]);
  return {
    topics,
    opening_pairs: openingPairs,
    expansions,
  };
}

export function normalizeCarouselMapSteeringText(input: string | null | undefined): string {
  return sanitizePrompt(String(input || ''));
}

export function buildCarouselMapTopicsScopeKey() {
  return 'map';
}

export function buildCarouselMapOpeningPairsScopeKey(topicId: string) {
  return `topic:${String(topicId || '').trim()}`;
}

export function buildCarouselMapOpeningSignature(args: {
  topicId: string | null | undefined;
  selectedSlide1Text: string | null | undefined;
  selectedSlide2Text: string | null | undefined;
}) {
  const topicId = String(args.topicId || '').trim();
  const slide1 = normalizeCarouselMapSteeringText(args.selectedSlide1Text);
  const slide2 = normalizeCarouselMapSteeringText(args.selectedSlide2Text);
  if (!topicId || !slide1 || !slide2) return '';
  return createHash('sha1').update(JSON.stringify({ topicId, slide1, slide2 })).digest('hex');
}

export function buildCarouselMapExpansionsScopeKey(args: {
  topicId: string | null | undefined;
  selectedSlide1Text: string | null | undefined;
  selectedSlide2Text: string | null | undefined;
}) {
  const sig = buildCarouselMapOpeningSignature(args);
  return sig ? `opening:${sig}` : '';
}

function emptySteeringState(stageKey: CarouselMapSteeringStageKey, scopeKey: string | null): CarouselMapSteeringState {
  return {
    stageKey,
    scopeKey,
    steeringText: '',
    lastUsedSteeringText: '',
    lastUsedAt: null,
  };
}

function steeringStateFromRow(
  stageKey: CarouselMapSteeringStageKey,
  scopeKey: string | null,
  row: any
): CarouselMapSteeringState {
  return {
    stageKey,
    scopeKey,
    steeringText: String(row?.steering_text || ''),
    lastUsedSteeringText: String(row?.last_used_steering_text || ''),
    lastUsedAt: row?.last_used_at ? String(row.last_used_at) : null,
  };
}

export async function loadCarouselMapSteeringState(args: {
  supabase: any;
  accountId: string;
  mapId: string;
  stageKey: CarouselMapSteeringStageKey;
  scopeKey: string;
}) {
  const { supabase, accountId, mapId, stageKey, scopeKey } = args;
  if (!scopeKey) return emptySteeringState(stageKey, null);
  const { data, error } = await supabase
    .from('carousel_map_generation_steering')
    .select('scope_key, steering_text, last_used_steering_text, last_used_at')
    .eq('account_id', accountId)
    .eq('carousel_map_id', mapId)
    .eq('stage_key', stageKey)
    .eq('scope_key', scopeKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? steeringStateFromRow(stageKey, scopeKey, data) : emptySteeringState(stageKey, scopeKey);
}

export async function persistCarouselMapSteering(args: {
  supabase: any;
  accountId: string;
  userId: string;
  mapId: string;
  stageKey: CarouselMapSteeringStageKey;
  topicId?: string | null;
  scopeKey: string;
  steeringText: string;
  openingSignature?: string | null;
  markUsed: boolean;
}) {
  const steeringText = normalizeCarouselMapSteeringText(args.steeringText);
  if (!args.scopeKey) return;
  if (!steeringText) {
    const { error } = await args.supabase
      .from('carousel_map_generation_steering')
      .delete()
      .eq('account_id', args.accountId)
      .eq('carousel_map_id', args.mapId)
      .eq('stage_key', args.stageKey)
      .eq('scope_key', args.scopeKey);
    if (error) throw new Error(error.message);
    return;
  }
  const payload: any = {
    account_id: args.accountId,
    carousel_map_id: args.mapId,
    stage_key: args.stageKey,
    scope_key: args.scopeKey,
    topic_id: args.topicId ? String(args.topicId).trim() : null,
    opening_signature: args.openingSignature ? String(args.openingSignature).trim() : null,
    steering_text: steeringText,
    updated_by_user_id: args.userId,
    created_by_user_id: args.userId,
    last_used_steering_text: args.markUsed ? steeringText : null,
    last_used_at: args.markUsed ? new Date().toISOString() : null,
  };
  const { error } = await args.supabase
    .from('carousel_map_generation_steering')
    .upsert(payload, { onConflict: 'account_id,carousel_map_id,stage_key,scope_key' });
  if (error) throw new Error(error.message);
}

function formatCurrentTopicsForPrompt(topics: Array<Pick<CarouselMapTopic, 'title' | 'summary' | 'whyItMatters'>>) {
  if (!topics.length) return '(none)';
  return topics
    .map(
      (topic, index) =>
        `${index + 1}. ${topic.title}\nSUMMARY: ${topic.summary}\nWHY_IT_MATTERS: ${topic.whyItMatters}`
    )
    .join('\n\n');
}

function formatCurrentOpeningPairsForPrompt(
  pairs: Array<Pick<CarouselMapOpeningPair, 'title' | 'slide1' | 'slide2' | 'angleText'>>
) {
  if (!pairs.length) return '(none)';
  return pairs
    .map(
      (pair, index) =>
        `${index + 1}. ${pair.title}\nSLIDE_1: ${pair.slide1}\nSLIDE_2: ${pair.slide2}\nANGLE: ${pair.angleText}`
    )
    .join('\n\n');
}

function formatCurrentExpansionsForPrompt(
  expansions: Array<Pick<CarouselMapExpansion, 'selectedSlide1Text' | 'selectedSlide2Text' | 'slide3' | 'slide4' | 'slide5' | 'slide6'>>
) {
  if (!expansions.length) return '(none)';
  return expansions
    .map(
      (row, index) =>
        `${index + 1}.\nSLIDE_1: ${row.selectedSlide1Text}\nSLIDE_2: ${row.selectedSlide2Text}\nSLIDE_3: ${row.slide3}\nSLIDE_4: ${row.slide4}\nSLIDE_5: ${row.slide5}\nSLIDE_6: ${row.slide6}`
    )
    .join('\n\n');
}

export function buildCarouselMapTopicsSystem(args: {
  source: CarouselMapSource;
  masterPrompt: string;
  steeringText?: string;
  currentTopics?: Array<Pick<CarouselMapTopic, 'title' | 'summary' | 'whyItMatters'>>;
}) {
  const masterPrompt = sanitizePrompt(String(args.masterPrompt || ''));
  const steeringText = normalizeCarouselMapSteeringText(args.steeringText);
  if (!masterPrompt) throw new Error('Carousel Map topics prompt is empty');
  return sanitizePrompt(
    [
      `MASTER_PROMPT:`,
      masterPrompt,
      ``,
      `OUTPUT FORMAT (HARD):`,
      `Return ONLY valid JSON in this shape:`,
      `{`,
      `  "topics": [`,
      `    {`,
      `      "title": "string",`,
      `      "summary": "string",`,
      `      "whyItMatters": "string"`,
      `    }`,
      `  ]`,
      `}`,
      ``,
      `RULES (HARD):`,
      `- Return 5-12 topics unless the source truly supports fewer.`,
      `- title must be concise and specific.`,
      `- summary should explain the core topic in 1 sentence.`,
      `- whyItMatters should explain why the topic matters in 1 sentence.`,
      `- Stay close to the source material.`,
      `- Do not produce carousel copy yet.`,
      args.currentTopics?.length
        ? `- Avoid repeating the same topic framing already shown unless the user steering explicitly asks for it.`
        : ``,
      ``,
      `CURRENTLY_DISPLAYED_TOPICS:`,
      formatCurrentTopicsForPrompt(args.currentTopics || []),
      ``,
      `USER_STEERING:`,
      steeringText || '(none)',
      ``,
      `SOURCE_CONTEXT:`,
      `- Title: ${args.source.title || '-'}`,
      `- Author handle: ${args.source.authorHandle || '-'}`,
      `- Platform: ${args.source.platform || '-'}`,
      `- Category: ${args.source.categoryName || '-'}`,
      `- Angle / Notes: ${args.source.note || '-'}`,
      ``,
      `CAPTION:`,
      args.source.caption || '-',
      ``,
      `TRANSCRIPT:`,
      args.source.transcript,
    ].join('\n')
  );
}

export function buildCarouselMapOpeningsSystem(args: {
  source: CarouselMapSource;
  topic: CarouselMapTopic;
  digestTopic?: CarouselMapDigestTopicContext | null;
  brandVoice: string;
  masterPrompt: string;
  steeringText?: string;
  currentPairs?: Array<Pick<CarouselMapOpeningPair, 'title' | 'slide1' | 'slide2' | 'angleText'>>;
}) {
  const masterPrompt = sanitizePrompt(String(args.masterPrompt || ''));
  const steeringText = normalizeCarouselMapSteeringText(args.steeringText);
  if (!masterPrompt) throw new Error('Carousel Map opening pairs prompt is empty');
  return sanitizePrompt(
    [
      `MASTER_PROMPT:`,
      masterPrompt,
      ``,
      `OUTPUT FORMAT (HARD):`,
      `Return ONLY valid JSON in this exact shape:`,
      `{`,
      `  "pairs": [`,
      `    {`,
      `      "title": "string",`,
      `      "slide1": "string",`,
      `      "slide2": "string",`,
      `      "angleText": "string"`,
      `    }`,
      `  ]`,
      `}`,
      ``,
      `IMPORTANT:`,
      `- Return JSON only. No markdown. No preamble.`,
      `- Return 6-12 pairs unless the selected topic clearly supports fewer.`,
      `- slide1 must be swipe-worthy immediately.`,
      `- slide2 must also hook independently while adding more context.`,
      `- slide1 and slide2 should feel related, but not repetitive.`,
      `- angleText should be a clear, concise label for the opening logic.`,
      `- Do not generate slides 3-6.`,
      args.currentPairs?.length
        ? `- Avoid repeating the same opening logic, phrasing, or angle already shown unless the user steering explicitly asks for it.`
        : ``,
      ``,
      `BRAND_VOICE:`,
      args.brandVoice || '-',
      ``,
      `SELECTED_TOPIC:`,
      `- Title: ${args.topic.title}`,
      `- Summary: ${args.topic.summary}`,
      `- Why it matters: ${args.topic.whyItMatters}`,
      args.digestTopic?.carouselAngle ? `DIGEST_TOPIC_CONTEXT:` : ``,
      args.digestTopic?.carouselAngle ? `- Carousel angle: ${args.digestTopic.carouselAngle}` : ``,
      ``,
      `CURRENTLY_DISPLAYED_OPENING_PAIRS:`,
      formatCurrentOpeningPairsForPrompt(args.currentPairs || []),
      ``,
      `USER_STEERING:`,
      steeringText || '(none)',
      ``,
      `SOURCE_CONTEXT:`,
      `- Title: ${args.source.title || '-'}`,
      `- Author handle: ${args.source.authorHandle || '-'}`,
      `- Platform: ${args.source.platform || '-'}`,
      `- Category: ${args.source.categoryName || '-'}`,
      `- Angle / Notes: ${args.source.note || '-'}`,
      ``,
      `CAPTION:`,
      args.source.caption || '-',
      ``,
      `TRANSCRIPT:`,
      args.source.transcript,
    ].join('\n')
  );
}

export function buildCarouselMapExpansionsSystem(args: {
  source: CarouselMapSource;
  topic: CarouselMapTopic;
  digestTopic?: CarouselMapDigestTopicContext | null;
  brandVoice: string;
  masterPrompt: string;
  selectedSlide1Text: string;
  selectedSlide2Text: string;
  steeringText?: string;
  currentExpansions?: Array<Pick<CarouselMapExpansion, 'selectedSlide1Text' | 'selectedSlide2Text' | 'slide3' | 'slide4' | 'slide5' | 'slide6'>>;
}) {
  const masterPrompt = sanitizePrompt(String(args.masterPrompt || ''));
  const steeringText = normalizeCarouselMapSteeringText(args.steeringText);
  if (!masterPrompt) throw new Error('Carousel Map expansions prompt is empty');
  return sanitizePrompt(
    [
      `MASTER_PROMPT:`,
      masterPrompt,
      ``,
      `OUTPUT FORMAT (HARD):`,
      `Return ONLY valid JSON in this shape:`,
      `{`,
      `  "expansions": [`,
      `    {`,
      `      "slide3": "string",`,
      `      "slide4": "string",`,
      `      "slide5": "string",`,
      `      "slide6": "string"`,
      `    }`,
      `  ]`,
      `}`,
      ``,
      `RULES (HARD):`,
      `- Return 4-8 expansions unless the source truly supports fewer.`,
      `- Do not rewrite slide1 or slide2.`,
      `- Slides 3-6 should feel like a natural continuation of the chosen opening.`,
      `- Slide 6 should land with a strong payoff, conclusion, or CTA if appropriate.`,
      args.currentExpansions?.length
        ? `- Avoid repeating the same slides 3-6 structure or phrasing already shown unless the user steering explicitly asks for it.`
        : ``,
      ``,
      `BRAND_VOICE:`,
      args.brandVoice || '-',
      ``,
      `SELECTED_TOPIC:`,
      `- Title: ${args.topic.title}`,
      `- Summary: ${args.topic.summary}`,
      `- Why it matters: ${args.topic.whyItMatters}`,
      args.digestTopic?.carouselAngle ? `DIGEST_TOPIC_CONTEXT:` : ``,
      args.digestTopic?.carouselAngle ? `- Carousel angle: ${args.digestTopic.carouselAngle}` : ``,
      ``,
      `CHOSEN_OPENING:`,
      `- Slide 1: ${args.selectedSlide1Text}`,
      `- Slide 2: ${args.selectedSlide2Text}`,
      ``,
      `CURRENTLY_DISPLAYED_EXPANSIONS:`,
      formatCurrentExpansionsForPrompt(args.currentExpansions || []),
      ``,
      `USER_STEERING:`,
      steeringText || '(none)',
      ``,
      `SOURCE_CONTEXT:`,
      `- Title: ${args.source.title || '-'}`,
      `- Author handle: ${args.source.authorHandle || '-'}`,
      `- Platform: ${args.source.platform || '-'}`,
      `- Category: ${args.source.categoryName || '-'}`,
      `- Angle / Notes: ${args.source.note || '-'}`,
      ``,
      `CAPTION:`,
      args.source.caption || '-',
      ``,
      `TRANSCRIPT:`,
      args.source.transcript,
    ].join('\n')
  );
}

export function assertTopicsPayload(payload: any): Array<Pick<CarouselMapTopic, 'title' | 'summary' | 'whyItMatters'>> {
  const input = Array.isArray(payload?.topics) ? payload.topics : [];
  const rows = input
    .map((item: any): Pick<CarouselMapTopic, 'title' | 'summary' | 'whyItMatters'> => ({
      title: String(item?.title || '').trim(),
      summary: String(item?.summary || '').trim(),
      whyItMatters: String(item?.whyItMatters || '').trim(),
    }))
    .filter((item: Pick<CarouselMapTopic, 'title' | 'summary' | 'whyItMatters'>) => item.title && item.summary && item.whyItMatters)
    .slice(0, 12);
  if (rows.length < 1) throw new Error('Invalid output: topics must be a non-empty array');
  return rows;
}

export function assertPairsPayload(payload: any): Array<Pick<CarouselMapOpeningPair, 'title' | 'slide1' | 'slide2' | 'angleText'>> {
  const input = Array.isArray(payload?.pairs) ? payload.pairs : [];
  const rows = input
    .map((item: any): Pick<CarouselMapOpeningPair, 'title' | 'slide1' | 'slide2' | 'angleText'> => ({
      title: String(item?.title || '').trim(),
      slide1: String(item?.slide1 || '').trim(),
      slide2: String(item?.slide2 || '').trim(),
      angleText: String(item?.angleText || '').trim(),
    }))
    .filter((item: Pick<CarouselMapOpeningPair, 'title' | 'slide1' | 'slide2' | 'angleText'>) => item.title && item.slide1 && item.slide2 && item.angleText)
    .slice(0, 16);
  if (rows.length < 1) throw new Error('Invalid output: pairs must be a non-empty array');
  return rows;
}

export function assertExpansionsPayload(payload: any): Array<Pick<CarouselMapExpansion, 'slide3' | 'slide4' | 'slide5' | 'slide6'>> {
  const input = Array.isArray(payload?.expansions) ? payload.expansions : [];
  const rows = input
    .map((item: any): Pick<CarouselMapExpansion, 'slide3' | 'slide4' | 'slide5' | 'slide6'> => ({
      slide3: String(item?.slide3 || '').trim(),
      slide4: String(item?.slide4 || '').trim(),
      slide5: String(item?.slide5 || '').trim(),
      slide6: String(item?.slide6 || '').trim(),
    }))
    .filter((item: Pick<CarouselMapExpansion, 'slide3' | 'slide4' | 'slide5' | 'slide6'>) => item.slide3 && item.slide4 && item.slide5 && item.slide6)
    .slice(0, 12);
  if (rows.length < 1) throw new Error('Invalid output: expansions must be a non-empty array');
  return rows;
}

export async function loadBrandVoice(args: { supabase: any; accountId: string }) {
  const { data, error } = await args.supabase
    .from('editor_account_settings')
    .select('brand_alignment_prompt_override')
    .eq('account_id', args.accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String((data as any)?.brand_alignment_prompt_override || '').trim();
}

export function formatCarouselMapTopicSnapshot(topic: CarouselMapTopic) {
  return [
    `TITLE:\n${topic.title}`,
    ``,
    `SUMMARY:\n${topic.summary}`,
    ``,
    `WHY_IT_MATTERS:\n${topic.whyItMatters}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatCarouselMapOpeningSnapshot(args: { slide1: string; slide2: string }) {
  return [`SLIDE_1:\n${args.slide1}`, ``, `SLIDE_2:\n${args.slide2}`].filter(Boolean).join('\n');
}

export function formatCarouselMapExpansionSnapshot(expansion: CarouselMapExpansion) {
  return [
    `SLIDE_1:\n${expansion.selectedSlide1Text}`,
    ``,
    `SLIDE_2:\n${expansion.selectedSlide2Text}`,
    ``,
    `SLIDE_3:\n${expansion.slide3}`,
    ``,
    `SLIDE_4:\n${expansion.slide4}`,
    ``,
    `SLIDE_5:\n${expansion.slide5}`,
    ``,
    `SLIDE_6:\n${expansion.slide6}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildCarouselMapPromptPreview(args: {
  stylePromptRaw: string;
  bestPracticesRaw: string;
  source: CarouselMapSource;
  topic: CarouselMapTopic;
  digestTopic?: CarouselMapDigestTopicContext | null;
  expansion: CarouselMapExpansion;
  templateTypeId: 'regular' | 'enhanced';
}) {
  const schema =
    args.templateTypeId === 'regular'
      ? `Return ONLY valid JSON in this exact shape:\n{\n  "slides": [\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."},\n    {"body": "..."}\n  ],\n  "caption": "..."\n}\nRules:\n- slides must be length 6\n- body must be a string (can be empty)\n- caption must be a string`
      : `Return ONLY valid JSON in this exact shape:\n{\n  "slides": [\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."},\n    {"headline": "...", "body": "..."}\n  ],\n  "caption": "..."\n}\nRules:\n- slides must be length 6\n- headline/body must be strings (can be empty)\n- caption must be a string`;

  const composedPromptRaw = [
    `STYLE_PROMPT:\n${args.stylePromptRaw}`,
    ``,
    `CAROUSEL_MAP_SELECTED_TOPIC:\n${formatCarouselMapTopicSnapshot(args.topic)}`,
    args.digestTopic?.carouselAngle ? `DIGEST_TOPIC_CONTEXT:\n- Carousel angle: ${args.digestTopic.carouselAngle}` : ``,
    ``,
    `CAROUSEL_MAP_OPENING:\n${formatCarouselMapOpeningSnapshot({
      slide1: args.expansion.selectedSlide1Text,
      slide2: args.expansion.selectedSlide2Text,
    })}`,
    ``,
    `CAROUSEL_MAP_EXPANSION_OUTLINE:\n${formatCarouselMapExpansionSnapshot(args.expansion)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = sanitizePrompt(composedPromptRaw);
  const best = sanitizePrompt(args.bestPracticesRaw);
  const caption = sanitizePrompt(args.source.caption);
  const transcript = sanitizePrompt(args.source.transcript);

  const fullPrompt = [
    `You are an expert Instagram carousel copywriter.`,
    `You are given source material from an Instagram Reel (caption + transcript).`,
    ``,
    `PRIMARY INSTRUCTIONS: Create the carousel from the selected Carousel Map topic, opening, and outline.\n${prompt}`,
    best ? `\nBEST PRACTICES (superadmin-only):\n${best}` : ``,
    ``,
    `SOURCE MATERIAL:\nREEL_CAPTION:\n${caption || '(empty)'}\n\nREEL_TRANSCRIPT:\n${transcript}`,
    ``,
    schema,
  ]
    .filter(Boolean)
    .join('\n');

  const sections: CarouselMapPromptSection[] = [
    {
      id: 'intro',
      title: 'Intro',
      content: `You are an expert Instagram carousel copywriter.\nYou are given source material from an Instagram Reel (caption + transcript).`,
    },
    {
      id: 'primary',
      title: 'Primary instructions',
      content: `PRIMARY INSTRUCTIONS: Create the carousel from the selected Carousel Map topic, opening, and outline.\n${prompt}`,
    },
    ...(best ? [{ id: 'best_practices', title: 'Best practices', content: `BEST PRACTICES (superadmin-only):\n${best}` }] : []),
    {
      id: 'source',
      title: 'Source material',
      content: `SOURCE MATERIAL:\nREEL_CAPTION:\n${caption || '(empty)'}\n\nREEL_TRANSCRIPT:\n${transcript}`,
    },
    {
      id: 'output_schema',
      title: 'Output schema',
      content: schema,
    },
  ];

  return { fullPrompt, sections, composedPromptRaw };
}

export function generationKey() {
  return randomUUID();
}
