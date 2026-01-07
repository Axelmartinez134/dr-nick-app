import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, type TemplateTypeId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  projectId: string;
  templateTypeId: TemplateTypeId;
};

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  if (body.templateTypeId !== 'regular' && body.templateTypeId !== 'enhanced') {
    return NextResponse.json({ success: false, error: 'Invalid template type' }, { status: 400 });
  }

  // Ensure user owns project (RLS also enforces, but we want a clean 404/403)
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id')
    .eq('id', body.projectId)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (projectErr) return NextResponse.json({ success: false, error: projectErr.message }, { status: 500 });
  if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

  // Phase 2: create job row only. Phase 4 will do the Poppy + Claude work.
  const { data: job, error: jobErr } = await supabase
    .from('carousel_generation_jobs')
    .insert({
      project_id: body.projectId,
      template_type_id: body.templateTypeId,
      status: 'pending',
    })
    .select('id, project_id, template_type_id, status, error, created_at, started_at, finished_at')
    .single();

  if (jobErr) {
    // Unique partial index will throw on concurrent active job.
    // Supabase error code is typically 23505 for unique violation.
    const code = (jobErr as any).code;
    if (code === '23505') {
      return NextResponse.json({ success: false, error: 'A generation job is already running for this project' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: jobErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, job });
}


