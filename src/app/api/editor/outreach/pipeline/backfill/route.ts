import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Resp = { success: true; updated: number } | { success: false; error: string };

async function requireSuperadmin(supabase: any, userId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (saErr) return { ok: false, status: 500, error: saErr.message };
  if (!saRow?.user_id) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  // Backfill historical outreach into pipeline:
  // - rows with created_project_id or project_created_at
  // - pipeline_stage is null
  // Set stage to dm_sent, added_at now, and last_contact_date from project_created_at when available.
  const nowIso = new Date().toISOString();

  // NOTE: historically some rows were inserted without account_id (header missing).
  // To avoid "nothing shows up", include rows scoped either to the active account_id
  // OR legacy rows owned by the current user where account_id is null.
  const { data: candidates, error: selErr } = await supabase
    .from('editor_outreach_targets')
    .select('id, project_created_at')
    .is('pipeline_stage', null)
    .or('created_project_id.not.is.null,project_created_at.not.is.null')
    .or(`account_id.eq.${accountId},and(account_id.is.null,created_by_user_id.eq.${user.id})`)
    .limit(5000);

  if (selErr) return NextResponse.json({ success: false, error: selErr.message } satisfies Resp, { status: 500 });

  const rows = Array.isArray(candidates) ? candidates : [];
  const ids = rows.map((r: any) => String(r?.id || '').trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({ success: true, updated: 0 } satisfies Resp);

  // Update in chunks to keep PostgREST happy.
  const chunkSize = 200;
  let updated = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data: updData, error: updErr } = await supabase
      .from('editor_outreach_targets')
      .update({
        pipeline_stage: 'dm_sent',
        pipeline_added_at: nowIso,
      })
      .in('id', chunk)
      .select('id');
    if (updErr) return NextResponse.json({ success: false, error: updErr.message } satisfies Resp, { status: 500 });
    updated += Array.isArray(updData) ? updData.length : 0;
  }

  // Best-effort: set last_contact_date when project_created_at exists and last_contact_date is null.
  try {
    const idsWithProjectCreatedAt = rows
      .map((r: any) => ({ id: String(r?.id || '').trim(), ts: r?.project_created_at ?? null }))
      .filter((r) => r.id && r.ts);

    for (const r of idsWithProjectCreatedAt) {
      const d = new Date(String(r.ts));
      if (Number.isNaN(d.getTime())) continue;
      const yyyy = String(d.getUTCFullYear());
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      await supabase.from('editor_outreach_targets').update({ last_contact_date: dateStr }).eq('id', r.id).is('last_contact_date', null);
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ success: true, updated } satisfies Resp);
}

