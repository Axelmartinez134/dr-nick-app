import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type ProjectRow = {
  id: string;
  title: string;
  updated_at: string;
  review_ready: boolean;
  review_posted: boolean;
  review_approved: boolean;
  review_scheduled: boolean;
  review_drive_folder_url: string | null;
  slides_textlines: Array<{
    slide_index: number;
    textLines: string[];
  }>;
};

function normalizeTextLinesFromLayoutSnapshot(layoutSnapshot: any, slideNumber: number): string[] {
  const raw = Array.isArray(layoutSnapshot?.textLines) ? layoutSnapshot.textLines : [];
  const lines = raw
    .map((line: any) => {
      if (typeof line === 'string') return line;
      return String(line?.text ?? '');
    })
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines : [`Slide ${slideNumber}`];
}

type Resp =
  | { success: true; projects: ProjectRow[] }
  | { success: false; error: string };

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  // Superadmin only.
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) return NextResponse.json({ success: false, error: saErr.message } satisfies Resp, { status: 500 });
  if (!saRow?.user_id) return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  const { data, error } = await supabase
    .from('carousel_projects')
    .select('id, title, updated_at, review_ready, review_posted, review_approved, review_scheduled, review_drive_folder_url')
    .eq('account_id', accountId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const projectIds = Array.isArray(data) ? data.map((r: any) => String(r?.id || '').trim()).filter(Boolean) : [];
  const slidesByProjectId: Record<string, any[]> = {};

  if (projectIds.length > 0) {
    const { data: slideRows, error: slideErr } = await supabase
      .from('carousel_project_slides')
      .select('project_id, slide_index, layout_snapshot')
      .in('project_id', projectIds)
      .order('slide_index', { ascending: true });

    if (slideErr) return NextResponse.json({ success: false, error: slideErr.message } satisfies Resp, { status: 500 });

    (slideRows || []).forEach((row: any) => {
      const projectId = String(row?.project_id || '').trim();
      if (!projectId) return;
      if (!slidesByProjectId[projectId]) slidesByProjectId[projectId] = [];
      slidesByProjectId[projectId].push(row);
    });
  }

  const projects: ProjectRow[] = (data || []).map((r: any) => ({
    id: String(r?.id || ''),
    title: String(r?.title || 'Untitled Project'),
    updated_at: String(r?.updated_at || ''),
    review_ready: !!r?.review_ready,
    review_posted: !!r?.review_posted,
    review_approved: !!r?.review_approved,
    review_scheduled: !!r?.review_scheduled,
    review_drive_folder_url: r?.review_drive_folder_url ? String(r.review_drive_folder_url) : null,
    slides_textlines: Array.from({ length: 6 }).map((_, index) => {
      const slideRow =
        (Array.isArray(slidesByProjectId[String(r?.id || '')]) ? slidesByProjectId[String(r?.id || '')] : []).find(
          (row: any) => Number(row?.slide_index) === index
        ) || null;
      return {
        slide_index: index,
        textLines: normalizeTextLinesFromLayoutSnapshot(slideRow?.layout_snapshot ?? null, index + 1),
      };
    }),
  }));

  return NextResponse.json({ success: true, projects } satisfies Resp);
}

