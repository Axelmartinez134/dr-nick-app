import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  seedInstagramUrl: string;
  seedUsername: string;
  baseTemplateId: string | null;
  items: Array<{
    username: string | null;
    fullName: string | null;
    profilePicUrl: string | null;
    isVerified: boolean | null;
    isPrivate: boolean | null;
    raw: any;
    ai?: {
      score: number;
      niche: string;
      reason: string;
      has_offer: boolean;
      credential: string | null;
      model?: string | null;
      mode?: string | null; // 'lite' | 'enriched'
    } | null;
  }>;
};

type Resp =
  | { success: true; attempted: number; inserted: number }
  | { success: false; error: string };

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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
  return raw.replace(/^@+/, '').trim() || null;
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

  const seedInstagramUrl = s((body as any)?.seedInstagramUrl);
  const seedUsername = normalizeUsername((body as any)?.seedUsername);
  const itemsRaw = Array.isArray((body as any)?.items) ? ((body as any).items as any[]) : [];
  const baseTemplateId = s((body as any)?.baseTemplateId);

  if (!seedInstagramUrl) {
    return NextResponse.json({ success: false, error: 'seedInstagramUrl is required' } satisfies Resp, { status: 400 });
  }
  if (!seedUsername) {
    return NextResponse.json({ success: false, error: 'seedUsername is required' } satisfies Resp, { status: 400 });
  }
  if (!itemsRaw.length) {
    return NextResponse.json({ success: false, error: 'items is required' } satisfies Resp, { status: 400 });
  }
  if (itemsRaw.length > 200) {
    return NextResponse.json({ success: false, error: 'Too many items (max 200 per request)' } satisfies Resp, { status: 400 });
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } satisfies Resp, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const rows = itemsRaw
    .map((it) => {
      const prospectUsername = normalizeUsername(it?.username);
      if (!prospectUsername) return null;
      const profileUrl = `https://www.instagram.com/${prospectUsername}/`;

      const ai = it?.ai ?? null;
      const aiScore = typeof ai?.score === 'number' && Number.isFinite(ai.score) ? Math.floor(ai.score) : null;
      const aiMode = s(ai?.mode) || (aiScore !== null ? 'lite' : null);

      return {
        created_by_user_id: user.id,
        account_id: accountId,

        // Canonical identity (keep backwards-compat with existing single-profile fields)
        instagram_url: profileUrl,
        full_name: s(it?.fullName),
        username: prospectUsername,
        profile_pic_url_hd: null,
        raw_json: it?.raw ?? null,

        // Following-source fields
        source_type: 'following',
        source_seed_username: seedUsername,
        source_seed_instagram_url: seedInstagramUrl,
        source_raw_json: it?.raw ?? null,

        prospect_username: prospectUsername,
        prospect_full_name: s(it?.fullName),
        prospect_profile_pic_url: s(it?.profilePicUrl),
        prospect_is_verified: typeof it?.isVerified === 'boolean' ? it.isVerified : null,
        prospect_is_private: typeof it?.isPrivate === 'boolean' ? it.isPrivate : null,

        // AI (lite)
        ai_score: aiScore,
        ai_niche: s(ai?.niche),
        ai_reason: s(ai?.reason),
        ai_has_offer: typeof ai?.has_offer === 'boolean' ? ai.has_offer : null,
        ai_credential: s(ai?.credential),
        ai_scored_at: aiScore !== null ? nowIso : null,
        ai_model: s(ai?.model),
        ai_mode: aiMode,

        base_template_id: baseTemplateId,
      };
    })
    .filter(Boolean) as any[];

  if (!rows.length) {
    return NextResponse.json({ success: false, error: 'No items had a valid username' } satisfies Resp, { status: 400 });
  }

  // Dedupe via UNIQUE index that matches our upsert conflict target:
  // (account_id, source_type, source_seed_username, prospect_username)
  const { data: inserted, error } = await svc
    .from('editor_outreach_targets')
    .upsert(rows, { onConflict: 'account_id,source_type,source_seed_username,prospect_username', ignoreDuplicates: true })
    .select('id');

  if (error) {
    return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    attempted: rows.length,
    inserted: Array.isArray(inserted) ? inserted.length : 0,
  } satisfies Resp);
}

