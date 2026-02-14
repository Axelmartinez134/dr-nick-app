import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Body = {
  seedUsername: string;
  prospectUsername: string;
  createdTemplateId: string;
  createdProjectId: string;
  baseTemplateId: string | null;
};

type Resp =
  | { success: true }
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

  const seedUsername = normalizeUsername((body as any)?.seedUsername);
  const prospectUsername = normalizeUsername((body as any)?.prospectUsername);
  const createdTemplateId = s((body as any)?.createdTemplateId);
  const createdProjectId = s((body as any)?.createdProjectId);
  const baseTemplateId = s((body as any)?.baseTemplateId);

  if (!seedUsername) return NextResponse.json({ success: false, error: 'seedUsername is required' } satisfies Resp, { status: 400 });
  if (!prospectUsername) return NextResponse.json({ success: false, error: 'prospectUsername is required' } satisfies Resp, { status: 400 });
  if (!createdTemplateId) return NextResponse.json({ success: false, error: 'createdTemplateId is required' } satisfies Resp, { status: 400 });
  if (!createdProjectId) return NextResponse.json({ success: false, error: 'createdProjectId is required' } satisfies Resp, { status: 400 });

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } satisfies Resp, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await svc
    .from('editor_outreach_targets')
    .update({
      base_template_id: baseTemplateId,
      created_template_id: createdTemplateId,
      created_project_id: createdProjectId,
      project_created_at: nowIso,
    } as any)
    .eq('account_id', accountId)
    .eq('source_type', 'following')
    .eq('source_seed_username', seedUsername)
    .eq('prospect_username', prospectUsername)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  if (!data?.id) {
    return NextResponse.json({ success: false, error: 'Prospect not found. Save it first.' } satisfies Resp, { status: 404 });
  }

  return NextResponse.json({ success: true } satisfies Resp);
}

