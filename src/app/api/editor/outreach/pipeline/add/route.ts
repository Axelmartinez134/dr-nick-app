import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 15;

type Body = {
  seedInstagramUrl: string;
  seedUsername: string;
  baseTemplateId?: string | null;
  row: {
    username: string;
    fullName?: string | null;
    profilePicUrl?: string | null;
    isVerified?: boolean | null;
    isPrivate?: boolean | null;
    raw?: any;
  };
};

type Resp = { success: true; applied: boolean } | { success: false; error: string };

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

function normalizeUsername(v: any): string | null {
  const raw = typeof v === 'string' ? v.trim() : '';
  if (!raw) return null;
  return raw.replace(/^@+/, '').trim().toLowerCase() || null;
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

  let body: Body | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }
  const seedInstagramUrl = String((body as any)?.seedInstagramUrl || '').trim();
  const seedUsername = normalizeUsername((body as any)?.seedUsername);
  const row = (body as any)?.row ?? null;
  const uname = normalizeUsername(row?.username);
  if (!seedInstagramUrl) return NextResponse.json({ success: false, error: 'seedInstagramUrl is required' } satisfies Resp, { status: 400 });
  if (!seedUsername) return NextResponse.json({ success: false, error: 'seedUsername is required' } satisfies Resp, { status: 400 });
  if (!uname) return NextResponse.json({ success: false, error: 'row.username is required' } satisfies Resp, { status: 400 });

  const nowIso = new Date().toISOString();

  // First try the "following schema" upsert. If the DB doesn't have those columns
  // (or schema cache is stale), fall back to a minimal insert/update using legacy columns.
  try {
    const baseRow: any = {
      created_by_user_id: user.id,
      account_id: accountId,
      instagram_url: `https://www.instagram.com/${uname}/`,
      full_name: typeof row?.fullName === 'string' ? row.fullName.trim() : row?.fullName ?? null,
      username: uname,
      profile_pic_url_hd: null,
      raw_json: row?.raw ?? null,
      source_type: 'following',
      source_seed_username: seedUsername,
      source_seed_instagram_url: seedInstagramUrl,
      source_raw_json: row?.raw ?? null,
      prospect_username: uname,
      prospect_full_name: typeof row?.fullName === 'string' ? row.fullName.trim() : row?.fullName ?? null,
      prospect_profile_pic_url: typeof row?.profilePicUrl === 'string' ? row.profilePicUrl.trim() : row?.profilePicUrl ?? null,
      prospect_is_verified: typeof row?.isVerified === 'boolean' ? row.isVerified : row?.isVerified ?? null,
      prospect_is_private: typeof row?.isPrivate === 'boolean' ? row.isPrivate : row?.isPrivate ?? null,
      base_template_id: (body as any)?.baseTemplateId ?? null,
    };

    const { error: upErr } = await supabase
      .from('editor_outreach_targets')
      .upsert([baseRow], { onConflict: 'account_id,source_type,source_seed_username,prospect_username' });
    if (upErr) throw upErr;
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    const looksLikeMissingColumn =
      msg.includes('does not exist') || msg.toLowerCase().includes('column') || msg.toLowerCase().includes('schema cache');
    if (!looksLikeMissingColumn) {
      return NextResponse.json({ success: false, error: msg || 'Failed to add to pipeline' } satisfies Resp, { status: 500 });
    }

    // Fallback: ensure at least one row exists keyed by legacy `username`.
    // Update first; if nothing updated, insert a minimal row.
    const { data: updExisting, error: updErr } = await supabase
      .from('editor_outreach_targets')
      .update({ pipeline_stage: 'todo', pipeline_added_at: nowIso })
      .eq('account_id', accountId)
      .eq('username', uname)
      .is('pipeline_stage', null)
      .select('id');
    if (updErr) return NextResponse.json({ success: false, error: updErr.message } satisfies Resp, { status: 500 });

    const updatedCount = Array.isArray(updExisting) ? updExisting.length : 0;
    if (updatedCount === 0) {
      const minimalRow: any = {
        created_by_user_id: user.id,
        account_id: accountId,
        instagram_url: `https://www.instagram.com/${uname}/`,
        full_name: typeof row?.fullName === 'string' ? row.fullName.trim() : row?.fullName ?? null,
        username: uname,
        profile_pic_url_hd: typeof row?.profilePicUrl === 'string' ? row.profilePicUrl.trim() : row?.profilePicUrl ?? null,
        raw_json: row?.raw ?? null,
        base_template_id: (body as any)?.baseTemplateId ?? null,
        pipeline_stage: 'todo',
        pipeline_added_at: nowIso,
      };
      const { error: insErr } = await supabase.from('editor_outreach_targets').insert(minimalRow as any);
      if (insErr) return NextResponse.json({ success: false, error: insErr.message } satisfies Resp, { status: 500 });
    }

    return NextResponse.json({ success: true, applied: true } satisfies Resp);
  }

  // Update all rows for this username (across seeds) but only if pipeline_stage is null.
  const applyUpdate = async (scope: 'account' | 'legacy') => {
    let q = supabase
      .from('editor_outreach_targets')
      .update({ pipeline_stage: 'todo', pipeline_added_at: nowIso })
      .or(`prospect_username.eq.${uname},username.eq.${uname}`)
      .is('pipeline_stage', null)
      .select('id');
    if (scope === 'account') q = q.eq('account_id', accountId);
    else q = q.is('account_id', null).eq('created_by_user_id', user.id);
    return await q;
  };

  let d1: any[] | null = null;
  let d2: any[] | null = null;
  try {
    const r1 = await applyUpdate('account');
    if (r1.error) throw r1.error;
    d1 = (r1.data as any[]) || null;
    const r2 = await applyUpdate('legacy');
    if (r2.error) throw r2.error;
    d2 = (r2.data as any[]) || null;
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    // If prospect_username doesn't exist, fall back to legacy username-only update.
    if (msg.includes('prospect_username') && msg.includes('does not exist')) {
      const { data: only, error: onlyErr } = await supabase
        .from('editor_outreach_targets')
        .update({ pipeline_stage: 'todo', pipeline_added_at: nowIso })
        .eq('account_id', accountId)
        .eq('username', uname)
        .is('pipeline_stage', null)
        .select('id');
      if (onlyErr) return NextResponse.json({ success: false, error: onlyErr.message } satisfies Resp, { status: 500 });
      d1 = Array.isArray(only) ? only : [];
      d2 = [];
    } else {
      return NextResponse.json({ success: false, error: msg || 'Failed to add to pipeline' } satisfies Resp, { status: 500 });
    }
  }

  const applied = (Array.isArray(d1) ? d1.length : 0) + (Array.isArray(d2) ? d2.length : 0) > 0;
  return NextResponse.json({ success: true, applied } satisfies Resp);
}

