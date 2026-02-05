import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body =
  | { action: 'approve'; ideaId: string }
  | { action: 'dismiss'; ideaId: string }
  | { action: 'unapprove'; ideaId: string }
  | { action: 'reorderApproved'; ideaIds: string[] };

async function getIdeaById(supabase: any, args: { ideaId: string }) {
  const { data, error } = await supabase
    .from('editor_ideas')
    .select('id, account_id, owner_user_id, status, approved_sort_index')
    .eq('id', args.ideaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const action = (body as any)?.action;
  if (!action) return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });

  try {
    if (action === 'approve') {
      const ideaId = String((body as any)?.ideaId || '').trim();
      if (!ideaId) return NextResponse.json({ success: false, error: 'ideaId is required' }, { status: 400 });
      const cur = await getIdeaById(supabase, { ideaId });
      if (!cur) return NextResponse.json({ success: false, error: 'Idea not found' }, { status: 404 });

      // Append to end of approved queue.
      const curAccountId = String((cur as any)?.account_id || '').trim() || null;
      let maxQ = supabase.from('editor_ideas').select('approved_sort_index').eq('status', 'approved');
      // Avoid PostgREST `.or(...)` parsing issues on some environments; rely on RLS + simple filters.
      // Queue should be scoped to the idea's account (or legacy null).
      maxQ = curAccountId ? maxQ.eq('account_id', curAccountId) : maxQ.is('account_id', null);
      const { data: maxRow, error: maxErr } = await maxQ
        .order('approved_sort_index', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (maxErr) throw new Error(maxErr.message);
      const max = Number((maxRow as any)?.approved_sort_index);
      const nextIndex = Number.isFinite(max) ? Math.floor(max) + 1 : 0;

      const nowIso = new Date().toISOString();
      const { data: updated, error } = await supabase
        .from('editor_ideas')
        .update({ status: 'approved', approved_sort_index: nextIndex, updated_at: nowIso })
        .eq('id', ideaId)
        .select('id, status, approved_sort_index')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, idea: updated });
    }

    if (action === 'dismiss') {
      const ideaId = String((body as any)?.ideaId || '').trim();
      if (!ideaId) return NextResponse.json({ success: false, error: 'ideaId is required' }, { status: 400 });
      const cur = await getIdeaById(supabase, { ideaId });
      if (!cur) return NextResponse.json({ success: false, error: 'Idea not found' }, { status: 404 });
      const nowIso = new Date().toISOString();
      const { data: updated, error } = await supabase
        .from('editor_ideas')
        .update({ status: 'dismissed', approved_sort_index: null, updated_at: nowIso })
        .eq('id', ideaId)
        .select('id, status, approved_sort_index')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, idea: updated });
    }

    if (action === 'unapprove') {
      const ideaId = String((body as any)?.ideaId || '').trim();
      if (!ideaId) return NextResponse.json({ success: false, error: 'ideaId is required' }, { status: 400 });
      const cur = await getIdeaById(supabase, { ideaId });
      if (!cur) return NextResponse.json({ success: false, error: 'Idea not found' }, { status: 404 });
      const nowIso = new Date().toISOString();
      const { data: updated, error } = await supabase
        .from('editor_ideas')
        .update({ status: 'pending', approved_sort_index: null, updated_at: nowIso })
        .eq('id', ideaId)
        .select('id, status, approved_sort_index')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, idea: updated });
    }

    if (action === 'reorderApproved') {
      const ideaIds = Array.isArray((body as any)?.ideaIds) ? (body as any).ideaIds : [];
      const ids = ideaIds.map((x: any) => String(x || '').trim()).filter(Boolean);
      if (ids.length === 0) return NextResponse.json({ success: false, error: 'ideaIds is required' }, { status: 400 });

      // Load all ideas to ensure ownership and to avoid partial reorder.
      const { data: rows, error } = await supabase
        .from('editor_ideas')
        .select('id, owner_user_id')
        .in('id', ids);
      if (error) throw new Error(error.message);
      const found = new Set((rows || []).map((r: any) => String(r.id)));
      for (const id of ids) {
        if (!found.has(id)) return NextResponse.json({ success: false, error: `Idea not found: ${id}` }, { status: 404 });
      }

      const nowIso = new Date().toISOString();
      // Best-effort sequential updates (keeps it simple; low volume).
      for (let i = 0; i < ids.length; i++) {
        await supabase
          .from('editor_ideas')
          .update({ status: 'approved', approved_sort_index: i, updated_at: nowIso })
          .eq('id', ids[i]);
      }
      return NextResponse.json({ success: true, approvedCount: ids.length });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${String(action)}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e || 'Update failed') }, { status: 500 });
  }
}

