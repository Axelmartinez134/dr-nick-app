import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp =
  | {
      success: true;
      runs: Array<{
        id: string;
        createdAt: string | null;
        outputCaption: string;
        excludedFromPrompt: boolean;
      }>;
      limit: number;
    }
  | { success: false; error: string };

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  // Superadmin only.
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) return NextResponse.json({ success: false, error: saErr.message } satisfies Resp, { status: 500 });
  if (!saRow?.user_id) return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });

  const { searchParams } = new URL(request.url);
  const projectId = String(searchParams.get('projectId') || '').trim();
  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' } satisfies Resp, { status: 400 });
  const limit = clampInt(searchParams.get('limit'), 1, 100, 50);

  // Ensure project exists in active account (clear 404 vs empty history).
  const { data: project, error: projectErr } = await supabase
    .from('carousel_projects')
    .select('id')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || 'Project not found' } satisfies Resp, { status: 404 });
  }

  const { data: rows, error } = await supabase
    .from('carousel_caption_regen_runs')
    .select('id, created_at, output_caption, excluded_from_prompt')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const runs = (rows || []).map((r: any) => ({
    id: String(r?.id || ''),
    createdAt: r?.created_at || null,
    outputCaption: String(r?.output_caption || ''),
    excludedFromPrompt: !!r?.excluded_from_prompt,
  }));

  return NextResponse.json({ success: true, runs, limit } satisfies Resp);
}

