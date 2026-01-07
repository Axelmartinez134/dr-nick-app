import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const { data, error } = await supabase
    .from('carousel_projects')
    .select('id, title, template_type_id, caption, updated_at, created_at')
    .eq('owner_user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, projects: data || [] });
}


