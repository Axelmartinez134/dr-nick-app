import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  projectId: string;
  title?: string;
  caption?: string | null;
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

  const patch: any = {};
  if (typeof body.title === 'string') patch.title = body.title.trim() || 'Untitled Project';
  if (body.caption !== undefined) patch.caption = body.caption;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('carousel_projects')
    .update(patch)
    .eq('id', body.projectId)
    .eq('owner_user_id', user.id)
    .select('id, title, caption, template_type_id, updated_at')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, project: data });
}


