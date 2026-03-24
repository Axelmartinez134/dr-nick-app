import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { loadEffectiveTemplateTypeSettings } from '@/app/api/editor/projects/_effective';
import type { CarouselMapExpansion } from '../../_types';
import {
  formatCarouselMapExpansionSnapshot,
  formatCarouselMapTopicSnapshot,
  getAuthedCarouselMapContext,
  isUuid,
  loadCarouselMapGraph,
} from '../../_lib';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  templateTypeId: 'regular' | 'enhanced';
  savedPromptId: string;
  expansionId: string;
};

type Resp = { success: true; projectId: string } | { success: false; error: string };

const PROJECT_SELECT =
  'id, owner_user_id, title, template_type_id, caption, prompt_snapshot, slide1_template_id_snapshot, slide2_5_template_id_snapshot, slide6_template_id_snapshot, created_at, updated_at' as const;

function buildProjectTitle(args: { sourceTitle: string; topicTitle: string }) {
  const primary = String(args.topicTitle || '').trim();
  if (primary) return primary.slice(0, 120);
  return (String(args.sourceTitle || '').trim() || 'Carousel Map Project').slice(0, 120);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ mapId: string }> }) {
  try {
    const auth = await getAuthedCarouselMapContext(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
    const { supabase, accountId, user } = auth;
    const { mapId } = await ctx.params;
    const id = String(mapId || '').trim();
    if (!id || !isUuid(id)) return NextResponse.json({ success: false, error: 'Invalid mapId' } satisfies Resp, { status: 400 });

    let body: Body | null = null;
    try {
      body = (await request.json()) as Body;
    } catch {
      body = null;
    }
    const templateTypeId =
      body?.templateTypeId === 'regular' ? 'regular' : body?.templateTypeId === 'enhanced' ? 'enhanced' : null;
    const savedPromptId = String(body?.savedPromptId || '').trim();
    const expansionId = String(body?.expansionId || '').trim();
    if (!templateTypeId) return NextResponse.json({ success: false, error: 'templateTypeId is required' } satisfies Resp, { status: 400 });
    if (!savedPromptId || !isUuid(savedPromptId)) return NextResponse.json({ success: false, error: 'savedPromptId is required' } satisfies Resp, { status: 400 });
    if (!expansionId || !isUuid(expansionId)) return NextResponse.json({ success: false, error: 'expansionId is required' } satisfies Resp, { status: 400 });

    const graph = await loadCarouselMapGraph({ supabase, accountId, mapId: id });
    const topic = graph.topics.find((row) => row.id === graph.selectedTopicId) || null;
    const expansion = graph.expansions.find((row) => row.id === expansionId) || null;
    if (!topic || !expansion) return NextResponse.json({ success: false, error: 'Expansion not found' } satisfies Resp, { status: 404 });

    const { data: promptRow, error: promptErr } = await supabase
      .from('editor_poppy_saved_prompts')
      .select('id, prompt, template_type_id')
      .eq('id', savedPromptId)
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .eq('template_type_id', templateTypeId)
      .maybeSingle();
    if (promptErr) throw new Error(promptErr.message);
    const promptText = String((promptRow as any)?.prompt || '').trim();
    if (!promptText) return NextResponse.json({ success: false, error: 'Saved prompt is empty' } satisfies Resp, { status: 400 });

    const { effective } = await loadEffectiveTemplateTypeSettings(supabase as any, { accountId, actorUserId: user.id }, templateTypeId);

    const { data: project, error: projectErr } = await supabase
      .from('carousel_projects')
      .insert({
        account_id: accountId,
        owner_user_id: user.id,
        title: buildProjectTitle({ sourceTitle: graph.source.title, topicTitle: topic.title }),
        template_type_id: templateTypeId,
        caption: null,
        prompt_snapshot: promptText,
        slide1_template_id_snapshot: (effective as any)?.slide1TemplateId ?? null,
        slide2_5_template_id_snapshot: (effective as any)?.slide2to5TemplateId ?? null,
        slide6_template_id_snapshot: (effective as any)?.slide6TemplateId ?? null,
        source_swipe_item_id: graph.source.swipeItemId,
        source_swipe_angle_snapshot: graph.source.note ? graph.source.note : null,
        source_carousel_map_id: id,
        source_carousel_map_expansion_id: expansion.id,
        source_carousel_map_topic_snapshot: formatCarouselMapTopicSnapshot(topic),
        source_carousel_map_selected_slide1_snapshot: expansion.selectedSlide1Text,
        source_carousel_map_selected_slide2_snapshot: expansion.selectedSlide2Text,
        source_carousel_map_expansion_snapshot: formatCarouselMapExpansionSnapshot(expansion as CarouselMapExpansion),
      } as any)
      .select(PROJECT_SELECT)
      .single();
    if (projectErr || !project?.id) {
      return NextResponse.json({ success: false, error: projectErr?.message || 'Failed to create project' } satisfies Resp, { status: 500 });
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
      return NextResponse.json({ success: false, error: slidesErr.message } satisfies Resp, { status: 500 });
    }

    await supabase
      .from('swipe_file_items')
      .update({ created_project_id: project.id, status: 'repurposed' } as any)
      .eq('id', graph.source.swipeItemId)
      .eq('account_id', accountId);

    return NextResponse.json({ success: true, projectId: String(project.id) } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed') } satisfies Resp, { status: 500 });
  }
}
