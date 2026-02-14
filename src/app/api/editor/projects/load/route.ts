import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

const PROJECT_SELECT = `id, owner_user_id, title, template_type_id, caption, outreach_message, prompt_snapshot, slide1_template_id_snapshot, slide2_5_template_id_snapshot, slide6_template_id_snapshot, background_effect_enabled, background_effect_type, project_background_color, project_text_color, background_effect_settings, theme_id_last_applied, theme_is_customized, theme_defaults_snapshot, last_manual_background_color, last_manual_text_color, ai_image_autoremovebg_enabled, review_ready, review_posted, review_approved, review_scheduled, review_comment, review_source, created_at, updated_at` as const;

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Project id is required' }, { status: 400 });

  // Primary: account-scoped
  let { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select(PROJECT_SELECT)
    .eq('id', id)
    .eq('account_id', accountId)
    .is('archived_at', null)
    .maybeSingle();

  // Backwards-safe: legacy rows created after Phase B without account_id
  if (!project?.id) {
    const legacy = await supabase
      .from('carousel_projects')
      .select(PROJECT_SELECT)
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .is('account_id', null)
      .is('archived_at', null)
      .maybeSingle();
    projectErr = projectErr || legacy.error;
    project = legacy.data as any;
    if (project?.id) {
      await supabase.from('carousel_projects').update({ account_id: accountId }).eq('id', project.id);
    }
  }
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || 'Project not found' }, { status: 404 });
  }

  const { data: slides, error: slidesErr } = await supabase
    .from('carousel_project_slides')
    .select('id, project_id, slide_index, headline, body, layout_snapshot, input_snapshot, ai_image_prompt, created_at, updated_at')
    .eq('project_id', project.id)
    .order('slide_index', { ascending: true });

  if (slidesErr) return NextResponse.json({ success: false, error: slidesErr.message }, { status: 500 });

  return NextResponse.json({ success: true, project, slides: slides || [] });
}


