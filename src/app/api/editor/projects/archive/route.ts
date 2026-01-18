import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  projectId: string;
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
  const projectId = String(body?.projectId || '').trim();
  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('carousel_projects')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('owner_user_id', user.id)
    .is('archived_at', null)
    .select('id, title, template_type_id, caption, updated_at, created_at, archived_at')
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!data?.id) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

  return NextResponse.json({ success: true, project: data });
}

