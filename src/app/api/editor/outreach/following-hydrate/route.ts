import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 15;

type Body = {
  usernames: string[];
};

type RowOut = {
  username: string;
  ai: null | {
    score: number;
    niche: string | null;
    reason: string | null;
    has_offer: boolean | null;
    credential: string | null;
    model: string | null;
    mode: string | null;
    scoredAt: string | null;
  };
  enriched: {
    ok: boolean;
    enrichedAt: string | null;
    profilePicUrlHD: string | null;
    followingCount: number | null;
  };
};

type Resp = { success: true; rows: RowOut[] } | { success: false; error: string };

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

function pickFirstNumber(...vals: any[]): number | null {
  for (const v of vals) {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return null;
}

function extractFollowingCountFromEnrichedRaw(raw: any): number | null {
  return (
    pickFirstNumber(
      raw?.followingCount,
      raw?.followingsCount,
      raw?.following,
      raw?.following_count,
      raw?.edge_follow?.count,
      raw?.edgeFollow?.count,
      raw?.counts?.follows,
      raw?.counts?.following
    ) ?? null
  );
}

async function chunked<T>(arr: T[], size: number): Promise<T[][]> {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
  const usernamesRaw = Array.isArray((body as any)?.usernames) ? ((body as any).usernames as any[]) : [];
  const usernames = usernamesRaw.map(normalizeUsername).filter(Boolean) as string[];
  if (!usernames.length) return NextResponse.json({ success: false, error: 'usernames is required' } satisfies Resp, { status: 400 });
  if (usernames.length > 5000) return NextResponse.json({ success: false, error: 'Too many usernames (max 5000)' } satisfies Resp, { status: 400 });

  // We may have multiple rows per username across different seeds; pick the most recently updated signals.
  const bestByUsername = new Map<string, any>();

  const chunks = await chunked(usernames, 200);
  for (const c of chunks) {
    const { data, error } = await supabase
      .from('editor_outreach_targets')
      .select(
        [
          'prospect_username',
          'ai_score',
          'ai_niche',
          'ai_reason',
          'ai_has_offer',
          'ai_credential',
          'ai_model',
          'ai_mode',
          'ai_scored_at',
          'enriched_at',
          'enriched_profile_pic_url_hd',
          'enriched_raw_json',
        ].join(',')
      )
      .eq('account_id', accountId)
      .eq('source_type', 'following')
      .in('prospect_username', c);
    if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

    for (const r of Array.isArray(data) ? data : []) {
      const u = normalizeUsername((r as any)?.prospect_username);
      if (!u) continue;
      const prev = bestByUsername.get(u) || null;

      const prevScoreAt = prev?.ai_scored_at ? Date.parse(String(prev.ai_scored_at)) : 0;
      const thisScoreAt = (r as any)?.ai_scored_at ? Date.parse(String((r as any).ai_scored_at)) : 0;
      const prevEnrAt = prev?.enriched_at ? Date.parse(String(prev.enriched_at)) : 0;
      const thisEnrAt = (r as any)?.enriched_at ? Date.parse(String((r as any).enriched_at)) : 0;

      // Prefer rows with newer AI score; tie-breaker with newer enrichment.
      const prevRank = prevScoreAt * 10 + prevEnrAt;
      const thisRank = thisScoreAt * 10 + thisEnrAt;
      if (!prev || thisRank > prevRank) bestByUsername.set(u, r);
    }
  }

  const rows: RowOut[] = usernames.map((u) => {
    const r = bestByUsername.get(u) || null;
    const score = typeof r?.ai_score === 'number' && Number.isFinite(r.ai_score) ? Math.floor(r.ai_score) : null;
    const ai =
      score === null
        ? null
        : {
            score,
            niche: typeof r?.ai_niche === 'string' ? r.ai_niche : r?.ai_niche ?? null,
            reason: typeof r?.ai_reason === 'string' ? r.ai_reason : r?.ai_reason ?? null,
            has_offer: typeof r?.ai_has_offer === 'boolean' ? r.ai_has_offer : r?.ai_has_offer ?? null,
            credential: typeof r?.ai_credential === 'string' ? r.ai_credential : r?.ai_credential ?? null,
            model: typeof r?.ai_model === 'string' ? r.ai_model : r?.ai_model ?? null,
            mode: typeof r?.ai_mode === 'string' ? r.ai_mode : r?.ai_mode ?? null,
            scoredAt: typeof r?.ai_scored_at === 'string' ? r.ai_scored_at : r?.ai_scored_at ?? null,
          };

    const enrichedRaw = r?.enriched_raw_json ?? null;
    const enrichedAt = typeof r?.enriched_at === 'string' ? r.enriched_at : r?.enriched_at ?? null;
    const enrichedOk = !!enrichedAt;
    const profilePicUrlHD =
      typeof r?.enriched_profile_pic_url_hd === 'string'
        ? r.enriched_profile_pic_url_hd
        : r?.enriched_profile_pic_url_hd ?? null;
    const followingCount = enrichedRaw ? extractFollowingCountFromEnrichedRaw(enrichedRaw) : null;

    return {
      username: u,
      ai,
      enriched: { ok: enrichedOk, enrichedAt, profilePicUrlHD, followingCount },
    };
  });

  return NextResponse.json({ success: true, rows } satisfies Resp);
}

