import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

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
  const ideaIdsRaw = String(searchParams.get('ideaIds') || '').trim();
  const ideaIds = ideaIdsRaw
    ? ideaIdsRaw
        .split(',')
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .slice(0, 200)
    : [];

  if (ideaIds.length === 0) {
    return NextResponse.json({ success: true, createdByIdeaId: {} });
  }

  // Pull the newest run per idea_id (owner-scoped).
  // NOTE: If the table doesn't exist yet in a given environment, we fail soft and return empty.
  const { data, error } = await supabase
    .from('editor_idea_carousel_runs')
    .select('idea_id, project_id, created_at')
    // Phase G: account-scoped idea carousel runs (shared within account).
    // Backwards-safe fallback for legacy rows.
    .or(`account_id.eq.${accountId},and(account_id.is.null,owner_user_id.eq.${user.id})`)
    .in('idea_id', ideaIds)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    const msg = String((error as any)?.message || '');
    // Relation missing (migration not applied yet) → return empty so UI still works.
    if (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('relation')) {
      return NextResponse.json({ success: true, createdByIdeaId: {}, warning: 'carousel_runs_table_missing' });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const createdByIdeaId: Record<string, { projectId: string; createdAt: string }> = {};
  for (const r of data || []) {
    const ideaId = String((r as any)?.idea_id || '').trim();
    if (!ideaId) continue;
    if (createdByIdeaId[ideaId]) continue; // keep newest only (rows are ordered desc)
    const projectId = String((r as any)?.project_id || '').trim();
    const createdAt = String((r as any)?.created_at || '').trim();
    if (!projectId || !createdAt) continue;
    createdByIdeaId[ideaId] = { projectId, createdAt };
  }

  return NextResponse.json({ success: true, createdByIdeaId });
}

