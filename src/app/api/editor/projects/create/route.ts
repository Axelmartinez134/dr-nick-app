import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId, type TemplateTypeId } from '../../_utils';
import { loadEffectiveTemplateTypeSettings } from '../_effective';

export const runtime = 'nodejs';
export const maxDuration = 10;

const PROJECT_SELECT = `id, owner_user_id, title, template_type_id, caption, prompt_snapshot, slide1_template_id_snapshot, slide2_5_template_id_snapshot, slide6_template_id_snapshot, background_effect_enabled, background_effect_type, project_background_color, project_text_color, background_effect_settings, theme_id_last_applied, theme_is_customized, theme_defaults_snapshot, last_manual_background_color, last_manual_text_color, ai_image_autoremovebg_enabled, review_ready, review_posted, review_approved, review_scheduled, review_comment, review_source, created_at, updated_at` as const;

type Body = {
  title?: string;
  templateTypeId: TemplateTypeId;
};

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (body.templateTypeId !== 'regular' && body.templateTypeId !== 'enhanced') {
    return NextResponse.json({ success: false, error: 'Invalid template type' }, { status: 400 });
  }

  try {
    const { effective } = await loadEffectiveTemplateTypeSettings(supabase, { accountId, actorUserId: user.id }, body.templateTypeId);

    const title = (body.title || 'Untitled Project').trim() || 'Untitled Project';

    const { data: project, error: projectErr } = await supabase
      .from('carousel_projects')
      .insert({
        account_id: accountId,
        owner_user_id: user.id,
        title,
        template_type_id: body.templateTypeId,
        caption: null,
        prompt_snapshot: effective.prompt || '',
        slide1_template_id_snapshot: effective.slide1TemplateId,
        slide2_5_template_id_snapshot: effective.slide2to5TemplateId,
        slide6_template_id_snapshot: effective.slide6TemplateId,
      })
      .select(PROJECT_SELECT)
      .single();

    if (projectErr || !project) {
      return NextResponse.json({ success: false, error: projectErr?.message || 'Failed to create project' }, { status: 500 });
    }

    const slideRows = Array.from({ length: 6 }).map((_, slideIndex) => ({
      project_id: project.id,
      slide_index: slideIndex,
      headline: null,
      body: null,
      layout_snapshot: null,
      input_snapshot: null,
    }));

    const { error: slidesErr } = await supabase.from('carousel_project_slides').insert(slideRows);
    if (slidesErr) {
      // Best-effort cleanup; if it fails, RLS may block delete for some reason—rare.
      await supabase.from('carousel_projects').delete().eq('id', project.id);
      return NextResponse.json({ success: false, error: slidesErr.message }, { status: 500 });
    }

    const { data: slides, error: slidesFetchErr } = await supabase
      .from('carousel_project_slides')
      .select('id, project_id, slide_index, headline, body, created_at, updated_at')
      .eq('project_id', project.id)
      .order('slide_index', { ascending: true });
    if (slidesFetchErr) {
      return NextResponse.json({ success: false, error: slidesFetchErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, project, slides });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed to create project' },
      { status: 500 }
    );
  }
}


