import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

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
  const projectId = String(searchParams.get('projectId') || '').trim();
  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });

  const slideIndex = clampInt(searchParams.get('slideIndex'), 0, 5, -1);
  if (slideIndex < 0 || slideIndex > 5) {
    return NextResponse.json({ success: false, error: 'slideIndex must be 0..5' }, { status: 400 });
  }

  const limit = clampInt(searchParams.get('limit'), 1, 20, 20);

  // Ensure project exists in active account (clear 404 vs. empty history).
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || 'Project not found' }, { status: 404 });
  }

  const { data: rows, error } = await supabase
    .from('carousel_body_regen_attempts')
    .select('id, created_at, guidance_text, output_body, output_body_style_ranges')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('slide_index', slideIndex)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const attempts = (rows || []).map((r: any) => ({
    id: String(r?.id || ''),
    createdAt: r?.created_at || null,
    guidanceText: r?.guidance_text === null || r?.guidance_text === undefined ? null : String(r.guidance_text),
    body: String(r?.output_body || ''),
    bodyStyleRanges: Array.isArray(r?.output_body_style_ranges) ? r.output_body_style_ranges : [],
  }));

  return NextResponse.json({ success: true, attempts, limit });
}

