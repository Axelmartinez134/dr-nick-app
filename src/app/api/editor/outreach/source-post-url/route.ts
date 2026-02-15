import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 15;

type Body = {
  username: string;
  sourcePostUrl: string | null;
  // Optional seed context for upsert when missing
  seedInstagramUrl?: string | null;
  seedUsername?: string | null;
  baseTemplateId?: string | null;
  row?: {
    fullName?: string | null;
    profilePicUrl?: string | null;
    isVerified?: boolean | null;
    isPrivate?: boolean | null;
    raw?: any;
  };
};

type Resp = { success: true } | { success: false; error: string };

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

function s(v: any): string | null {
  const out = typeof v === 'string' ? v.trim() : '';
  return out ? out : null;
}

function normalizeUsername(v: any): string | null {
  const raw = s(v);
  if (!raw) return null;
  return raw.replace(/^@+/, '').trim().toLowerCase() || null;
}

function igUrlCandidatesForUsername(uname: string): string[] {
  const u = uname.trim().toLowerCase();
  if (!u) return [];
  const a = `https://www.instagram.com/${u}/`;
  const b = `https://www.instagram.com/${u}`;
  const c = `https://instagram.com/${u}/`;
  const d = `https://instagram.com/${u}`;
  return Array.from(new Set([a, b, c, d]));
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

  const uname = normalizeUsername((body as any)?.username);
  if (!uname) return NextResponse.json({ success: false, error: 'username is required' } satisfies Resp, { status: 400 });

  const sourcePostUrl = s((body as any)?.sourcePostUrl);
  const igUrls = igUrlCandidatesForUsername(uname);

  // 1) Update all existing rows for this username (across seeds), account + legacy-null-account rows.
  const patch: any = { source_post_url: sourcePostUrl };

  const doUpdate = async (scope: 'account' | 'legacy') => {
    const isMissingColumn = (err: any, col: string) => {
      const msg = String(err?.message || '').toLowerCase();
      const c = col.toLowerCase();
      return (
        (msg.includes(c) && msg.includes('does not exist')) ||
        (msg.includes(c) && msg.includes('schema cache')) ||
        (msg.includes('could not find') && msg.includes(c) && msg.includes('column'))
      );
    };

    const baseUpdate = () => {
      let q = supabase.from('editor_outreach_targets').update(patch);
      if (scope === 'account') q = q.eq('account_id', accountId);
      else q = q.is('account_id', null).eq('created_by_user_id', user.id);
      return q;
    };

    const tryUpdateIn = async (col: string, values: string[]) => {
      return await (baseUpdate() as any).in(col, values).select('id');
    };

    const tryUpdateEq = async (col: string, value: string) => {
      return await (baseUpdate() as any).eq(col, value).select('id');
    };

    let lastMissing: any = null;

    if (igUrls.length > 0) {
      const { data, error } = await tryUpdateIn('instagram_url', igUrls);
      if (!error) return { data, error: null as any };
      if (isMissingColumn(error, 'instagram_url')) lastMissing = error;
      else return { data: null, error };
    }

    {
      const { data, error } = await tryUpdateEq('prospect_username', uname);
      if (!error) return { data, error: null as any };
      if (isMissingColumn(error, 'prospect_username')) lastMissing = error;
      else return { data: null, error };
    }

    {
      const { data, error } = await tryUpdateEq('username', uname);
      if (!error) return { data, error: null as any };
      if (isMissingColumn(error, 'username')) lastMissing = error;
      else return { data: null, error };
    }

    // Only missing-column errors: treat as "no rows updated" and proceed to insert.
    return { data: [], error: null as any, _missing: lastMissing };
  };

  const { data: d1, error: e1 } = await doUpdate('account');
  if (e1) return NextResponse.json({ success: false, error: e1.message } satisfies Resp, { status: 500 });
  const { data: d2, error: e2 } = await doUpdate('legacy');
  if (e2) return NextResponse.json({ success: false, error: e2.message } satisfies Resp, { status: 500 });

  const updatedCount = (Array.isArray(d1) ? d1.length : 0) + (Array.isArray(d2) ? d2.length : 0);
  if (updatedCount > 0) return NextResponse.json({ success: true } satisfies Resp);

  // 2) If nothing to update, best-effort insert/upsert a row WITHOUT pipeline_stage.
  const seedInstagramUrl = s((body as any)?.seedInstagramUrl);
  const seedUsername = normalizeUsername((body as any)?.seedUsername);
  const baseTemplateId = s((body as any)?.baseTemplateId);
  const row = (body as any)?.row ?? null;

  // Try following-schema upsert first (if those columns exist).
  if (seedInstagramUrl && seedUsername) {
    try {
      const baseRow: any = {
        created_by_user_id: user.id,
        account_id: accountId,
        instagram_url: `https://www.instagram.com/${uname}/`,
        full_name: s(row?.fullName),
        username: uname,
        profile_pic_url_hd: null,
        raw_json: row?.raw ?? null,
        base_template_id: baseTemplateId,
        source_post_url: sourcePostUrl,

        source_type: 'following',
        source_seed_username: seedUsername,
        source_seed_instagram_url: seedInstagramUrl,
        source_raw_json: row?.raw ?? null,
        prospect_username: uname,
        prospect_full_name: s(row?.fullName),
        prospect_profile_pic_url: s(row?.profilePicUrl),
        prospect_is_verified: typeof row?.isVerified === 'boolean' ? row.isVerified : row?.isVerified ?? null,
        prospect_is_private: typeof row?.isPrivate === 'boolean' ? row.isPrivate : row?.isPrivate ?? null,
      };
      const { error: upErr } = await supabase
        .from('editor_outreach_targets')
        .upsert([baseRow], { onConflict: 'account_id,source_type,source_seed_username,prospect_username' });
      if (upErr) throw upErr;
      return NextResponse.json({ success: true } satisfies Resp);
    } catch {
      // fall through to minimal insert
    }
  }

  // Minimal insert with progressive fallback (older schemas may not have username/full_name/account_id/etc).
  const insertAttempts: any[] = [
    {
      created_by_user_id: user.id,
      account_id: accountId,
      instagram_url: `https://www.instagram.com/${uname}/`,
      source_post_url: sourcePostUrl,
    },
    {
      created_by_user_id: user.id,
      instagram_url: `https://www.instagram.com/${uname}/`,
      source_post_url: sourcePostUrl,
    },
    // Best-effort richer insert (only if those columns exist).
    {
      created_by_user_id: user.id,
      account_id: accountId,
      instagram_url: `https://www.instagram.com/${uname}/`,
      full_name: s(row?.fullName),
      username: uname,
      profile_pic_url_hd: s(row?.profilePicUrl),
      raw_json: row?.raw ?? null,
      base_template_id: baseTemplateId,
      source_post_url: sourcePostUrl,
    },
  ];

  let lastInsertErr: any = null;
  for (const attempt of insertAttempts) {
    const { error: insErr } = await supabase.from('editor_outreach_targets').insert(attempt as any);
    if (!insErr) return NextResponse.json({ success: true } satisfies Resp);
    const msg = String((insErr as any)?.message || '').toLowerCase();
    // If missing column, try smaller payload; otherwise return immediately.
    if (
      (msg.includes('does not exist') && msg.includes('column')) ||
      (msg.includes('schema cache') && msg.includes('column')) ||
      (msg.includes('could not find') && msg.includes('column'))
    ) {
      lastInsertErr = insErr;
      continue;
    }
    return NextResponse.json({ success: false, error: insErr.message } satisfies Resp, { status: 500 });
  }
  if (lastInsertErr) return NextResponse.json({ success: false, error: lastInsertErr.message } satisfies Resp, { status: 500 });

  return NextResponse.json({ success: true } satisfies Resp);
}

