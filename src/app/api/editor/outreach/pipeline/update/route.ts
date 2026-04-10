import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Stage = 'todo' | 'dm_sent' | 'responded_needs_followup' | 'booked' | 'sent_contract' | 'closed';

type Body = {
  username: string;
  patch: {
    pipelineStage?: Stage | null;
    lastContactDate?: string | null; // YYYY-MM-DD
    followupSentCount?: number | null; // 1..3 (null => unset)
    instagramDmThreadUrl?: string | null;
    instagramDmThreadId?: string | null;
    instagramDmThreadDiscoveredAt?: string | null;
    instagramDmThreadLastState?: string | null;
    instagramDmThreadLastRecommendedAction?: string | null;
    instagramDmThreadLastClassifiedAt?: string | null;
    instagramDmThreadLastRunArtifactPath?: string | null;
    instagramDmLastExecutionState?: string | null;
    instagramDmLastExecutionAt?: string | null;
    instagramDmLastExecutionError?: string | null;
    instagramDmLastFollowupNumber?: number | null;
    instagramDmLastFollowupMessage?: string | null;
    instagramDmLastExecutionRunArtifactPath?: string | null;
    sourcePostUrl?: string | null;
    // allow storing created ids from "Create from reel"
    createdProjectId?: string | null;
    createdTemplateId?: string | null;
    projectCreatedAt?: string | null;
    baseTemplateId?: string | null;
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

function normalizeUsername(v: any): string | null {
  const raw = typeof v === 'string' ? v.trim() : '';
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

function isDateString(v: any): boolean {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function todayYmdUtc(): string {
  const d = new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

  const patchIn = (body as any)?.patch || {};
  const patch: any = {};

  if ('pipelineStage' in patchIn) {
    const st = patchIn.pipelineStage;
    if (st === null) patch.pipeline_stage = null;
    else if (isStage(st)) patch.pipeline_stage = st;
    else return NextResponse.json({ success: false, error: 'pipelineStage invalid' } satisfies Resp, { status: 400 });

    // If stage becomes dm_sent, automatically set last_contact_date=today (unless explicitly provided).
    if (patch.pipeline_stage === 'dm_sent' && !('lastContactDate' in patchIn)) {
      patch.last_contact_date = todayYmdUtc();
    }
  }

  if ('followupSentCount' in patchIn) {
    const n = patchIn.followupSentCount;
    if (n === null) patch.followup_sent_count = null;
    else {
      const x = typeof n === 'number' ? n : typeof n === 'string' ? Number(n) : NaN;
      if (!Number.isFinite(x)) return NextResponse.json({ success: false, error: 'followupSentCount invalid' } satisfies Resp, { status: 400 });
      const clamped = Math.max(1, Math.min(3, Math.floor(x)));
      patch.followup_sent_count = clamped;
    }

    // Any follow-up action should bump last_contact_date=today (unless explicitly provided).
    if (!('lastContactDate' in patchIn)) {
      patch.last_contact_date = todayYmdUtc();
    }
  }

  if ('lastContactDate' in patchIn) {
    if (patchIn.lastContactDate === null) patch.last_contact_date = null;
    else if (isDateString(patchIn.lastContactDate)) patch.last_contact_date = patchIn.lastContactDate;
    else return NextResponse.json({ success: false, error: 'lastContactDate invalid' } satisfies Resp, { status: 400 });
  }

  if ('instagramDmThreadUrl' in patchIn) {
    patch.instagram_dm_thread_url =
      typeof patchIn.instagramDmThreadUrl === 'string' ? patchIn.instagramDmThreadUrl.trim() : patchIn.instagramDmThreadUrl ?? null;
  }

  if ('instagramDmThreadId' in patchIn) {
    patch.instagram_dm_thread_id =
      typeof patchIn.instagramDmThreadId === 'string' ? patchIn.instagramDmThreadId.trim() : patchIn.instagramDmThreadId ?? null;
  }

  if ('instagramDmThreadDiscoveredAt' in patchIn) {
    const raw = patchIn.instagramDmThreadDiscoveredAt;
    if (raw === null || raw === undefined || raw === '') patch.instagram_dm_thread_discovered_at = null;
    else if (typeof raw === 'string') patch.instagram_dm_thread_discovered_at = raw;
    else return NextResponse.json({ success: false, error: 'instagramDmThreadDiscoveredAt invalid' } satisfies Resp, { status: 400 });
  }

  if ('instagramDmThreadLastState' in patchIn) {
    patch.instagram_dm_thread_last_state =
      typeof patchIn.instagramDmThreadLastState === 'string'
        ? patchIn.instagramDmThreadLastState.trim()
        : patchIn.instagramDmThreadLastState ?? null;
  }

  if ('instagramDmThreadLastRecommendedAction' in patchIn) {
    patch.instagram_dm_thread_last_recommended_action =
      typeof patchIn.instagramDmThreadLastRecommendedAction === 'string'
        ? patchIn.instagramDmThreadLastRecommendedAction.trim()
        : patchIn.instagramDmThreadLastRecommendedAction ?? null;
  }

  if ('instagramDmThreadLastClassifiedAt' in patchIn) {
    const raw = patchIn.instagramDmThreadLastClassifiedAt;
    if (raw === null || raw === undefined || raw === '') patch.instagram_dm_thread_last_classified_at = null;
    else if (typeof raw === 'string') patch.instagram_dm_thread_last_classified_at = raw;
    else return NextResponse.json({ success: false, error: 'instagramDmThreadLastClassifiedAt invalid' } satisfies Resp, { status: 400 });
  }

  if ('instagramDmThreadLastRunArtifactPath' in patchIn) {
    patch.instagram_dm_thread_last_run_artifact_path =
      typeof patchIn.instagramDmThreadLastRunArtifactPath === 'string'
        ? patchIn.instagramDmThreadLastRunArtifactPath.trim()
        : patchIn.instagramDmThreadLastRunArtifactPath ?? null;
  }

  if ('instagramDmLastExecutionState' in patchIn) {
    patch.instagram_dm_last_execution_state =
      typeof patchIn.instagramDmLastExecutionState === 'string'
        ? patchIn.instagramDmLastExecutionState.trim()
        : patchIn.instagramDmLastExecutionState ?? null;
  }

  if ('instagramDmLastExecutionAt' in patchIn) {
    const raw = patchIn.instagramDmLastExecutionAt;
    if (raw === null || raw === undefined || raw === '') patch.instagram_dm_last_execution_at = null;
    else if (typeof raw === 'string') patch.instagram_dm_last_execution_at = raw;
    else return NextResponse.json({ success: false, error: 'instagramDmLastExecutionAt invalid' } satisfies Resp, { status: 400 });
  }

  if ('instagramDmLastExecutionError' in patchIn) {
    patch.instagram_dm_last_execution_error =
      typeof patchIn.instagramDmLastExecutionError === 'string'
        ? patchIn.instagramDmLastExecutionError.trim()
        : patchIn.instagramDmLastExecutionError ?? null;
  }

  if ('instagramDmLastFollowupNumber' in patchIn) {
    const n = patchIn.instagramDmLastFollowupNumber;
    if (n === null) patch.instagram_dm_last_followup_number = null;
    else {
      const x = typeof n === 'number' ? n : typeof n === 'string' ? Number(n) : NaN;
      if (!Number.isFinite(x)) {
        return NextResponse.json({ success: false, error: 'instagramDmLastFollowupNumber invalid' } satisfies Resp, { status: 400 });
      }
      patch.instagram_dm_last_followup_number = Math.max(1, Math.min(3, Math.floor(x)));
    }
  }

  if ('instagramDmLastFollowupMessage' in patchIn) {
    patch.instagram_dm_last_followup_message =
      typeof patchIn.instagramDmLastFollowupMessage === 'string'
        ? patchIn.instagramDmLastFollowupMessage.trim()
        : patchIn.instagramDmLastFollowupMessage ?? null;
  }

  if ('instagramDmLastExecutionRunArtifactPath' in patchIn) {
    patch.instagram_dm_last_execution_run_artifact_path =
      typeof patchIn.instagramDmLastExecutionRunArtifactPath === 'string'
        ? patchIn.instagramDmLastExecutionRunArtifactPath.trim()
        : patchIn.instagramDmLastExecutionRunArtifactPath ?? null;
  }

  if ('sourcePostUrl' in patchIn) {
    patch.source_post_url = typeof patchIn.sourcePostUrl === 'string' ? patchIn.sourcePostUrl.trim() : patchIn.sourcePostUrl ?? null;
  }

  if ('createdProjectId' in patchIn) patch.created_project_id = patchIn.createdProjectId ?? null;
  if ('createdTemplateId' in patchIn) patch.created_template_id = patchIn.createdTemplateId ?? null;
  if ('projectCreatedAt' in patchIn) patch.project_created_at = patchIn.projectCreatedAt ?? null;
  if ('baseTemplateId' in patchIn) patch.base_template_id = patchIn.baseTemplateId ?? null;

  if (!Object.keys(patch).length) return NextResponse.json({ success: true } satisfies Resp);

  // Apply patch to all rows for this username (across seeds) to keep pipeline consistent.
  // Include both account-scoped rows AND legacy rows owned by the current user where account_id is null.
  const doUpdate = async (scope: 'account' | 'legacy') => {
    const unameAt = `@${uname}`;
    // Match common variants so actions like "Delete row" don't resurrect on refresh.
    // Note: `ilike` gives case-insensitive exact match when no wildcards are used.
    const userMatch = [
      `prospect_username.eq.${uname}`,
      `username.eq.${uname}`,
      `prospect_username.eq.${unameAt}`,
      `username.eq.${unameAt}`,
      `prospect_username.ilike.${uname}`,
      `username.ilike.${uname}`,
      `prospect_username.ilike.${unameAt}`,
      `username.ilike.${unameAt}`,
    ].join(',');
    let q = supabase.from('editor_outreach_targets').update(patch).or(userMatch);
    if (scope === 'account') q = q.eq('account_id', accountId);
    else q = q.is('account_id', null).eq('created_by_user_id', user.id);
    const { error } = await q;
    if (error) throw new Error(error.message);
  };

  try {
    await doUpdate('account');
    await doUpdate('legacy');
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e || 'Update failed') } satisfies Resp, { status: 500 });
  }

  return NextResponse.json({ success: true } satisfies Resp);
}

