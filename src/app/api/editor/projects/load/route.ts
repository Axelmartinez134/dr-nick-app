import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Project id is required' }, { status: 400 });

  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select(
      'id, owner_user_id, title, template_type_id, caption, prompt_snapshot, slide1_template_id_snapshot, slide2_5_template_id_snapshot, slide6_template_id_snapshot, created_at, updated_at'
    )
    .eq('id', id)
    .eq('owner_user_id', user.id)
    .single();
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


