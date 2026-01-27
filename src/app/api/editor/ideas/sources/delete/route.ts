import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  sourceId: string;
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

  const sourceId = String(body?.sourceId || '').trim();
  if (!sourceId) return NextResponse.json({ success: false, error: 'sourceId is required' }, { status: 400 });

  // Deleting the source cascades to runs + ideas via FK ON DELETE CASCADE.
  const { error } = await supabase
    .from('editor_idea_sources')
    .delete()
    .eq('id', sourceId)
    .eq('owner_user_id', user.id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, sourceId });
}

