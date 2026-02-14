import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Stage = 'todo' | 'dm_sent' | 'responded_needs_followup' | 'booked' | 'sent_contract' | 'closed';

type RowOut = {
  id: string;
  username: string;
  fullName: string | null;
  profilePicUrl: string | null;
  profilePicUrlHD: string | null;
  aiScore: number | null;
  aiNiche: string | null;
  aiReason: string | null;
  aiHasOffer: boolean | null;
  aiCredential: string | null;
  enrichedAt: string | null;
  followingCount: number | null;
  pipelineStage: Stage;
  pipelineAddedAt: string | null;
  lastContactDate: string | null;
  sourcePostUrl: string | null;
  createdProjectId: string | null;
  createdTemplateId: string | null;
};

type Resp =
  | {
      success: true;
      rows: RowOut[];
    }
  | { success: false; error: string };

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

function isStage(v: any): v is Stage {
  return (
    v === 'todo' ||
    v === 'dm_sent' ||
    v === 'responded_needs_followup' ||
    v === 'booked' ||
    v === 'sent_contract' ||
    v === 'closed'
  );
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

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  const q = new URL(request.url);
  const search = String(q.searchParams.get('q') || '').trim().toLowerCase();
  const stageParam = String(q.searchParams.get('stage') || '').trim();
  const stageFilter: Stage | null = isStage(stageParam) ? (stageParam as Stage) : null;

  // Pull all pipeline rows (we'll dedupe by username in JS).
  const query = supabase
    .from('editor_outreach_targets')
    .select(
      [
        'id',
        'account_id',
        'created_by_user_id',
        'prospect_username',
        'username',
        'prospect_full_name',
        'full_name',
        'prospect_profile_pic_url',
        'profile_pic_url_hd',
        'enriched_profile_pic_url_hd',
        'ai_score',
        'ai_niche',
        'ai_reason',
        'ai_has_offer',
        'ai_credential',
        'enriched_at',
        'enriched_raw_json',
        'pipeline_stage',
        'pipeline_added_at',
        'last_contact_date',
        'source_post_url',
        'created_project_id',
        'created_template_id',
        'created_at',
      ].join(',')
    )
    // Include legacy rows saved without account_id (header missing) but owned by current user.
    .or(`account_id.eq.${accountId},and(account_id.is.null,created_by_user_id.eq.${user.id})`)
    .not('pipeline_stage', 'is', null)
    .order('pipeline_added_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5000);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  const rows = Array.isArray(data) ? data : [];
  return NextResponse.json({ success: true, rows: dedupeAndFilter(rows, { search, stageFilter }) } satisfies Resp);
}

function dedupeAndFilter(rows: any[], args: { search: string; stageFilter: Stage | null }): RowOut[] {
  const byUsername = new Map<string, any>();
  for (const r of rows) {
    const uname = normalizeUsername(r?.prospect_username) || normalizeUsername(r?.username);
    if (!uname) continue;
    // Keep the first seen (sorted desc by updated_at/created_at).
    if (!byUsername.has(uname)) byUsername.set(uname, r);
  }

  const out: RowOut[] = [];
  for (const [uname, r] of byUsername.entries()) {
    const stage = String(r?.pipeline_stage || '').trim();
    if (!isStage(stage)) continue;
    if (args.stageFilter && stage !== args.stageFilter) continue;

    const fullName = s(r?.prospect_full_name) || s(r?.full_name);
    if (args.search) {
      const hay = `${uname} ${String(fullName || '').toLowerCase()}`;
      if (!hay.includes(args.search)) continue;
    }

    const enrichedRaw = r?.enriched_raw_json ?? null;
    out.push({
      id: String(r?.id || ''),
      username: uname,
      fullName,
      profilePicUrl: s(r?.prospect_profile_pic_url) || s(r?.profile_pic_url_hd),
      profilePicUrlHD: s(r?.enriched_profile_pic_url_hd),
      aiScore: typeof r?.ai_score === 'number' && Number.isFinite(r.ai_score) ? Math.floor(r.ai_score) : null,
      aiNiche: s(r?.ai_niche),
      aiReason: s(r?.ai_reason),
      aiHasOffer: typeof r?.ai_has_offer === 'boolean' ? r.ai_has_offer : r?.ai_has_offer ?? null,
      aiCredential: s(r?.ai_credential),
      enrichedAt: typeof r?.enriched_at === 'string' ? r.enriched_at : r?.enriched_at ?? null,
      followingCount: enrichedRaw ? extractFollowingCountFromEnrichedRaw(enrichedRaw) : null,
      pipelineStage: stage as Stage,
      pipelineAddedAt: typeof r?.pipeline_added_at === 'string' ? r.pipeline_added_at : r?.pipeline_added_at ?? null,
      lastContactDate: typeof r?.last_contact_date === 'string' ? r.last_contact_date : r?.last_contact_date ?? null,
      sourcePostUrl: s(r?.source_post_url),
      createdProjectId: s(r?.created_project_id),
      createdTemplateId: s(r?.created_template_id),
    });
  }

  // Stable sort: stage (todo first), then newest added, then score desc, then username.
  out.sort((a, b) => {
    const stageRank = (s: Stage) => (s === 'todo' ? 0 : s === 'responded_needs_followup' ? 1 : s === 'dm_sent' ? 2 : s === 'booked' ? 3 : s === 'sent_contract' ? 4 : 5);
    const ra = stageRank(a.pipelineStage);
    const rb = stageRank(b.pipelineStage);
    if (ra !== rb) return ra - rb;
    const ta = a.pipelineAddedAt ? Date.parse(a.pipelineAddedAt) : 0;
    const tb = b.pipelineAddedAt ? Date.parse(b.pipelineAddedAt) : 0;
    if (ta !== tb) return tb - ta;
    const sa = typeof a.aiScore === 'number' ? a.aiScore : -1;
    const sb = typeof b.aiScore === 'number' ? b.aiScore : -1;
    if (sa !== sb) return sb - sa;
    return a.username.localeCompare(b.username);
  });

  return out;
}

