import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });

  // Ensure user owns project
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (projectErr) return NextResponse.json({ success: false, error: projectErr.message }, { status: 500 });
  if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

  const { data: jobs, error } = await supabase
    .from('carousel_generation_jobs')
    .select('id, project_id, template_type_id, status, error, created_at, started_at, finished_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const active = (jobs || []).find((j) => j.status === 'pending' || j.status === 'running') || null;
  return NextResponse.json({ success: true, activeJob: active, recentJobs: jobs || [] });
}


