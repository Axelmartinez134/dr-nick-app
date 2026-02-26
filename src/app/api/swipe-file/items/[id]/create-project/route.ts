import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext, s, type SwipePlatform } from '../../../_utils';
import { loadEffectiveTemplateTypeSettings } from '@/app/api/editor/projects/_effective';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Body = {
  templateTypeId: 'regular' | 'enhanced';
  savedPromptId: string;
  ideaId?: string | null;
};

type Resp =
  | { success: true; projectId: string }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(v);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedSwipeContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user, accountId } = auth;

  const { id } = await ctx.params;
  const itemId = String(id || '').trim();
  if (!itemId || !isUuid(itemId)) return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });

  let body: Body | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }

  const templateTypeId = (body as any)?.templateTypeId === 'regular' ? 'regular' : (body as any)?.templateTypeId === 'enhanced' ? 'enhanced' : null;
  const savedPromptId = s((body as any)?.savedPromptId);
  const ideaId = s((body as any)?.ideaId);
  if (!templateTypeId) return NextResponse.json({ success: false, error: 'templateTypeId is required' } satisfies Resp, { status: 400 });
  if (!savedPromptId || !isUuid(savedPromptId)) {
    return NextResponse.json({ success: false, error: 'savedPromptId is required' } satisfies Resp, { status: 400 });
  }
  if (ideaId && !isUuid(ideaId)) {
    return NextResponse.json({ success: false, error: 'Invalid ideaId' } satisfies Resp, { status: 400 });
  }

  // Load swipe item (account scoped)
  const { data: item, error: itemErr } = await supabase
    .from('swipe_file_items')
    .select('id, url, platform, note, caption, transcript')
    .eq('id', itemId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (itemErr) return NextResponse.json({ success: false, error: itemErr.message } satisfies Resp, { status: 500 });
  if (!item?.id) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

  const platform = String((item as any)?.platform || 'unknown').trim() as SwipePlatform;
  const url = String((item as any)?.url || '').trim();

  // Optional: load idea snapshot (must belong to this account+item)
  let ideaSnapshot: { id: string; angleText: string } | null = null;
  if (ideaId) {
    const { data: ideaRow, error: ideaErr } = await supabase
      .from('swipe_file_ideas')
      .select('id, angle_text')
      .eq('account_id', accountId)
      .eq('swipe_item_id', itemId)
      .eq('id', ideaId)
      .maybeSingle();
    if (ideaErr) return NextResponse.json({ success: false, error: ideaErr.message } satisfies Resp, { status: 500 });
    const angleText = String((ideaRow as any)?.angle_text || '').trim();
    const id = String((ideaRow as any)?.id || '').trim();
    if (!id || !angleText) {
      return NextResponse.json({ success: false, error: 'Idea not found' } satisfies Resp, { status: 404 });
    }
    ideaSnapshot = { id, angleText };
  }

  // Load saved prompt for this user/account/template type.
  const { data: promptRow, error: promptErr } = await supabase
    .from('editor_poppy_saved_prompts')
    .select('id, prompt, title, template_type_id')
    .eq('id', savedPromptId)
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .eq('template_type_id', templateTypeId)
    .maybeSingle();
  if (promptErr) return NextResponse.json({ success: false, error: promptErr.message } satisfies Resp, { status: 500 });
  const promptText = String((promptRow as any)?.prompt || '').trim();
  if (!promptText) return NextResponse.json({ success: false, error: 'Saved prompt is empty' } satisfies Resp, { status: 400 });

  // Effective template settings for this type (slide template mapping, best practices, etc).
  const { effective } = await loadEffectiveTemplateTypeSettings(supabase as any, { accountId, actorUserId: user.id }, templateTypeId);

  const title = (() => {
    const base = platform === 'instagram' ? 'Swipe File (IG)' : platform === 'youtube' ? 'Swipe File (YT)' : 'Swipe File';
    const trimmed = url ? url.replace(/^https?:\/\//, '').slice(0, 60) : '';
    return `${base}: ${trimmed || 'Link'}`.slice(0, 120);
  })();

  // 1) Create project + slides (mirror /api/editor/projects/create)
  const PROJECT_SELECT =
    'id, owner_user_id, title, template_type_id, caption, prompt_snapshot, slide1_template_id_snapshot, slide2_5_template_id_snapshot, slide6_template_id_snapshot, created_at, updated_at' as const;

  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .insert({
      account_id: accountId,
      owner_user_id: user.id,
      title,
      template_type_id: templateTypeId,
      caption: null,
      // IMPORTANT: store the selected saved prompt so this project uses it (without changing global active).
      prompt_snapshot: promptText,
      slide1_template_id_snapshot: (effective as any)?.slide1TemplateId ?? null,
      slide2_5_template_id_snapshot: (effective as any)?.slide2to5TemplateId ?? null,
      slide6_template_id_snapshot: (effective as any)?.slide6TemplateId ?? null,
      // Swipe origin markers
      source_swipe_item_id: itemId,
      source_swipe_angle_snapshot: typeof (item as any)?.note === 'string' ? String((item as any).note || '').trim() || null : null,
      source_swipe_idea_id: ideaSnapshot ? ideaSnapshot.id : null,
      source_swipe_idea_snapshot: ideaSnapshot ? ideaSnapshot.angleText : null,
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

  // 2) Link swipe item → created project id
  await supabase
    .from('swipe_file_items')
    .update({ created_project_id: project.id, status: 'repurposed' } as any)
    .eq('id', itemId)
    .eq('account_id', accountId);

  return NextResponse.json({ success: true, projectId: String(project.id) } satisfies Resp);
}

