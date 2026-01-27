import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

function toBool(v: string | null): boolean {
  const s = String(v || '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const { searchParams } = new URL(request.url);
  const includeDismissed = toBool(searchParams.get('includeDismissed'));

  // Sources (newest first; last_generated_at prioritized)
  const { data: sources, error: sourcesErr } = await supabase
    .from('editor_idea_sources')
    .select('id, owner_user_id, source_title, source_url, last_generated_at, created_at, updated_at')
    .eq('owner_user_id', user.id)
    .order('last_generated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(250);

  if (sourcesErr) return NextResponse.json({ success: false, error: sourcesErr.message }, { status: 500 });

  const sourceIds = (sources || []).map((s: any) => String(s.id)).filter(Boolean);
  let ideas: any[] = [];
  if (sourceIds.length > 0) {
    let q = supabase
      .from('editor_ideas')
      .select('id, source_id, run_id, title, bullets, status, approved_sort_index, created_at, updated_at')
      .eq('owner_user_id', user.id)
      .in('source_id', sourceIds)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (!includeDismissed) q = q.neq('status', 'dismissed');

    const { data: ideaRows, error: ideasErr } = await q;
    if (ideasErr) return NextResponse.json({ success: false, error: ideasErr.message }, { status: 500 });
    ideas = Array.isArray(ideaRows) ? ideaRows : [];
  }

  // Group by source_id for fast client rendering.
  const ideasBySource = new Map<string, any[]>();
  for (const i of ideas) {
    const sid = String((i as any)?.source_id || '').trim();
    if (!sid) continue;
    const arr = ideasBySource.get(sid) || [];
    arr.push(i);
    ideasBySource.set(sid, arr);
  }

  const outSources = (sources || []).map((s: any) => {
    const sid = String(s.id || '').trim();
    return {
      id: sid,
      sourceTitle: String(s.source_title || ''),
      sourceUrl: String(s.source_url || ''),
      lastGeneratedAt: s.last_generated_at || null,
      createdAt: s.created_at || null,
      updatedAt: s.updated_at || null,
      ideas: ideasBySource.get(sid) || [],
    };
  });

  return NextResponse.json({ success: true, includeDismissed, sources: outSources });
}

