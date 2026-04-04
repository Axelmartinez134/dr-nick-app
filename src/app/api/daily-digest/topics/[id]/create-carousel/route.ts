import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  buildDigestTopicSnapshot,
  ensureDigestSwipeItemForTopic,
  getAuthedDailyDigestContext,
  loadDailyDigestTopicSourceOrThrow,
} from '../../../_utils';
import { loadEffectiveTemplateTypeSettings } from '../../../../editor/projects/_effective';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Body = {
  savedPromptId?: string;
};

type Resp =
  | { success: true; projectId: string }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(v);
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedDailyDigestContext(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  }
  const { supabase, user, accountId } = auth;
  if (!accountId) {
    return NextResponse.json({ success: false, error: 'Missing active account' } satisfies Resp, { status: 400 });
  }

  const { id } = await ctx.params;
  const topicId = String(id || '').trim();
  if (!topicId || !isUuid(topicId)) {
    return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
  }

  let body: Body | null = null;
  try {
    body = (await request.json()) as Body;
  } catch {
    // Empty body is valid for Auto mode.
  }
  const savedPromptId = trimText((body as any)?.savedPromptId);
  if (savedPromptId && !isUuid(savedPromptId)) {
    return NextResponse.json({ success: false, error: 'Invalid savedPromptId' } satisfies Resp, { status: 400 });
  }

  let source;
  try {
    source = await loadDailyDigestTopicSourceOrThrow({ supabase, accountId, userId: user.id, topicId });
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status =
      msg === 'Invalid id'
        ? 400
        : msg === 'Topic not found' || msg === 'Source video not found'
          ? 404
          : msg === 'Topic is missing its source video'
            ? 400
            : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }

  let promptSnapshot: string | null = null;
  if (savedPromptId) {
    const { data: promptRow, error: promptErr } = await supabase
      .from('editor_poppy_saved_prompts')
      .select('id, prompt')
      .eq('id', savedPromptId)
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .eq('template_type_id', 'regular')
      .maybeSingle();
    if (promptErr) {
      return NextResponse.json({ success: false, error: promptErr.message } satisfies Resp, { status: 500 });
    }
    const promptText = trimText((promptRow as any)?.prompt);
    if (!promptText) {
      return NextResponse.json({ success: false, error: 'Saved prompt is empty' } satisfies Resp, { status: 400 });
    }
    promptSnapshot = promptText;
  }

  let swipeItemId = '';
  let canonicalUrl = '';
  let createdSwipeItemId: string | null = null;
  try {
    const ensured = await ensureDigestSwipeItemForTopic({
      supabase,
      accountId,
      userId: user.id,
      digestVideo: {
        youtubeVideoUrl: source.youtubeVideoUrl,
        videoTitle: source.videoTitle,
        creatorName: source.creatorName,
        thumbnailUrl: source.thumbnailUrl,
        summary: source.summary,
        rawTranscript: source.rawTranscript,
      },
    });
    swipeItemId = ensured.swipeItemId;
    canonicalUrl = ensured.canonicalUrl;
    createdSwipeItemId = ensured.created ? ensured.swipeItemId : null;
  } catch (e: any) {
    const msg = String(e?.message || 'Failed');
    const status =
      msg === 'Invalid YouTube URL for this video' || msg === 'No transcript available for this video. Cannot continue.'
        ? 400
        : 500;
    return NextResponse.json({ success: false, error: msg } satisfies Resp, { status });
  }

  const { effective } = await loadEffectiveTemplateTypeSettings(
    supabase as any,
    { accountId, actorUserId: user.id },
    'regular'
  );

  const sourceDigestTopicSnapshot = buildDigestTopicSnapshot({
    title: source.title,
    whatItIs: source.whatItIs,
    whyItMatters: source.whyItMatters,
    carouselAngle: source.carouselAngle,
    sourceVideoSummary: source.summary,
    sourceCreator: source.creatorName,
    sourceVideoTitle: source.videoTitle,
  });

  const title = source.title || 'Untitled Topic';

  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .insert({
      account_id: accountId,
      owner_user_id: user.id,
      title: title.slice(0, 120),
      template_type_id: 'regular',
      caption: null,
      review_source: canonicalUrl.slice(0, 8000),
      prompt_snapshot: promptSnapshot,
      source_swipe_item_id: swipeItemId,
      source_digest_topic_snapshot: sourceDigestTopicSnapshot,
      slide1_template_id_snapshot: (effective as any)?.slide1TemplateId ?? null,
      slide2_5_template_id_snapshot: (effective as any)?.slide2to5TemplateId ?? null,
      slide6_template_id_snapshot: (effective as any)?.slide6TemplateId ?? null,
    } as any)
    .select('id')
    .single();

  if (projectErr || !project?.id) {
    if (createdSwipeItemId) {
      await supabase.from('swipe_file_items').delete().eq('id', createdSwipeItemId).eq('account_id', accountId);
    }
    return NextResponse.json(
      { success: false, error: projectErr?.message || 'Failed to create project' } satisfies Resp,
      { status: 500 }
    );
  }

  const slideRows = Array.from({ length: 6 }).map((_, slideIndex) => ({
    project_id: project.id,
    slide_index: slideIndex,
    headline: null,
    body: null,
    layout_snapshot: null,
    input_snapshot: null,
  }));
  const { error: slidesErr } = await supabase.from('carousel_project_slides').insert(slideRows as any);
  if (slidesErr) {
    await supabase.from('carousel_projects').delete().eq('id', project.id);
    if (createdSwipeItemId) {
      await supabase.from('swipe_file_items').delete().eq('id', createdSwipeItemId).eq('account_id', accountId);
    }
    return NextResponse.json({ success: false, error: slidesErr.message } satisfies Resp, { status: 500 });
  }

  return NextResponse.json({ success: true, projectId: String(project.id) } satisfies Resp);
}
