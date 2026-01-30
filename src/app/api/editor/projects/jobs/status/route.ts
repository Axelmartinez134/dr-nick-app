import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

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
  const projectId = searchParams.get('projectId');
  const jobType = searchParams.get('jobType'); // Optional: 'generate-copy', 'generate-ai-image'
  const slideIndexRaw = searchParams.get('slideIndex'); // Optional: for slide-specific jobs
  const slideIndex = slideIndexRaw !== null ? Number(slideIndexRaw) : null;

  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });

  // Ensure project exists in active account
  let { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();
  // Backwards-safe: legacy project without account_id (owned by caller)
  if (!project?.id) {
    const legacy = await supabase
      .from('carousel_projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_user_id', user.id)
      .is('account_id', null)
      .maybeSingle();
    projectErr = projectErr || legacy.error;
    project = legacy.data as any;
    if (project?.id) {
      await supabase.from('carousel_projects').update({ account_id: accountId }).eq('id', projectId);
    }
  }
  if (projectErr) return NextResponse.json({ success: false, error: projectErr.message }, { status: 500 });
  if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

  // Build query with optional filters
  let query = supabase
    .from('carousel_generation_jobs')
    .select('id, project_id, template_type_id, job_type, slide_index, status, error, created_at, started_at, finished_at')
    .eq('project_id', projectId);

  // Filter by job_type if provided
  if (jobType) {
    query = query.eq('job_type', jobType);
  }

  // Filter by slide_index if provided (for slide-specific jobs)
  if (slideIndex !== null && Number.isInteger(slideIndex)) {
    query = query.eq('slide_index', slideIndex);
  }

  const { data: jobs, error } = await query
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const active = (jobs || []).find((j) => j.status === 'pending' || j.status === 'running') || null;
  return NextResponse.json({ success: true, activeJob: active, recentJobs: jobs || [] });
}


