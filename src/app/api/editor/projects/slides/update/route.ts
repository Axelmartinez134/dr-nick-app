import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  projectId: string;
  slideIndex: number;
  headline?: string | null;
  body?: string | null;
  layoutSnapshot?: any | null;
  inputSnapshot?: any | null;
};

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase } = authed;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  if (!Number.isInteger(body.slideIndex) || body.slideIndex < 0 || body.slideIndex > 5) {
    return NextResponse.json({ success: false, error: 'slideIndex must be 0..5' }, { status: 400 });
  }

  const patch: any = {};
  if (body.headline !== undefined) patch.headline = body.headline;
  if (body.body !== undefined) patch.body = body.body;
  if (body.layoutSnapshot !== undefined) patch.layout_snapshot = body.layoutSnapshot;
  if (body.inputSnapshot !== undefined) patch.input_snapshot = body.inputSnapshot;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('carousel_project_slides')
    .update(patch)
    .eq('project_id', body.projectId)
    .eq('slide_index', body.slideIndex)
    .select('id, project_id, slide_index, headline, body, layout_snapshot, input_snapshot, updated_at')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, slide: data });
}


