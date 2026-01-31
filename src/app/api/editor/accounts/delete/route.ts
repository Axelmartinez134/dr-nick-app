import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  accountId: string;
  confirmText: string;
};

type Resp =
  | { success: true; accountId: string; displayName: string; deletedProjects: number; deletedTemplates: number }
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
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function safeTrim(v: any) {
  return String(v ?? '').trim();
}

async function listAllObjectPaths(args: { supabase: any; bucket: string; prefix: string }): Promise<string[]> {
  const { supabase, bucket, prefix } = args;
  const out: string[] = [];
  let offset = 0;
  const limit = 1000;
  // Best-effort pagination; if storage API changes, we just stop.
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit, offset }).catch(() => ({ data: null, error: null }));
    if (error) break;
    if (!Array.isArray(data) || data.length === 0) break;
    for (const f of data) {
      const name = String((f as any)?.name || '').trim();
      if (!name) continue;
      out.push(`${prefix}/${name}`.replace(/^\/+/, ''));
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  // Superadmin only.
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) return NextResponse.json({ success: false, error: saErr.message } satisfies Resp, { status: 500 });
  if (!saRow?.user_id) return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
  }

  const accountId = safeTrim(body.accountId);
  const confirmText = safeTrim(body.confirmText);
  if (!accountId) return NextResponse.json({ success: false, error: 'accountId is required' } satisfies Resp, { status: 400 });
  if (confirmText !== 'DELETE') {
    return NextResponse.json({ success: false, error: "Confirm text must be exactly 'DELETE'" } satisfies Resp, { status: 400 });
  }

  // Must be a member of the account (prevents deleting arbitrary accounts by ID).
  const { data: mem, error: memErr } = await supabase
    .from('editor_account_memberships')
    .select('role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (memErr) return NextResponse.json({ success: false, error: memErr.message } satisfies Resp, { status: 500 });
  if (!mem?.role) return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });

  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)' } satisfies Resp,
      { status: 500 }
    );
  }

  // Load account display name for response (and to confirm it exists).
  const { data: acct, error: acctErr } = await admin
    .from('editor_accounts')
    .select('id, display_name')
    .eq('id', accountId)
    .maybeSingle();
  if (acctErr) return NextResponse.json({ success: false, error: acctErr.message } satisfies Resp, { status: 500 });
  if (!acct?.id) return NextResponse.json({ success: false, error: 'Account not found' } satisfies Resp, { status: 404 });
  const displayName = safeTrim((acct as any).display_name) || 'Account';

  // Safety: prevent deleting any "(Personal)" account.
  // (We don't want accidental deletion of anyone's personal workspace.)
  if (displayName.toLowerCase().includes('(personal)')) {
    return NextResponse.json({ success: false, error: 'Refusing to delete a Personal account.' } satisfies Resp, { status: 400 });
  }

  // Gather project ids for deletes in tables that don't have account_id.
  const { data: projects, error: projErr } = await admin
    .from('carousel_projects')
    .select('id')
    .eq('account_id', accountId);
  if (projErr) return NextResponse.json({ success: false, error: projErr.message } satisfies Resp, { status: 500 });
  const projectIds = (projects || []).map((p: any) => safeTrim(p?.id)).filter(Boolean);

  // Gather template ids for reporting (storage cleanup deferred).
  const { data: templates, error: tplErr } = await admin
    .from('carousel_templates')
    .select('id')
    .eq('account_id', accountId);
  if (tplErr) return NextResponse.json({ success: false, error: tplErr.message } satisfies Resp, { status: 500 });
  const templateIds = (templates || []).map((t: any) => safeTrim(t?.id)).filter(Boolean);

  // Best-effort storage cleanup (does not block deletion if it fails).
  // - Template assets live under `${templateId}/assets/*` in bucket `carousel-templates`.
  // - Project images (Phase H) live under `accounts/<accountId>/...` in bucket `carousel-project-images`.
  try {
    const tplBucket = 'carousel-templates';
    for (const tid of templateIds) {
      const prefix = `${tid}/assets`;
      const paths = await listAllObjectPaths({ supabase: admin, bucket: tplBucket, prefix });
      if (paths.length > 0) {
        await admin.storage.from(tplBucket).remove(paths);
      }
    }
  } catch {
    // ignore
  }
  try {
    const imgBucket = 'carousel-project-images';
    const prefix = `accounts/${accountId}`;
    const paths = await listAllObjectPaths({ supabase: admin, bucket: imgBucket, prefix });
    if (paths.length > 0) {
      await admin.storage.from(imgBucket).remove(paths);
    }
  } catch {
    // ignore
  }

  // Delete order: children first, then parents.
  // NOTE: We use service role; RLS is bypassed.
  try {
    // Templates + mappings
    await admin.from('carousel_template_type_overrides').delete().eq('account_id', accountId);
    await admin.from('carousel_templates').delete().eq('account_id', accountId);

    // Recents + ideas + captions
    await admin.from('editor_recent_assets').delete().eq('account_id', accountId);
    await admin.from('editor_idea_carousel_runs').delete().eq('account_id', accountId);
    await admin.from('editor_ideas').delete().eq('account_id', accountId);
    await admin.from('editor_idea_runs').delete().eq('account_id', accountId);
    await admin.from('editor_idea_sources').delete().eq('account_id', accountId);
    await admin.from('carousel_caption_regen_runs').delete().eq('account_id', accountId);

    // Jobs (account_id scoped). Also delete by project_id in case of legacy null account_id.
    await admin.from('carousel_generation_jobs').delete().eq('account_id', accountId);
    if (projectIds.length > 0) {
      await admin.from('carousel_generation_jobs').delete().in('project_id', projectIds);
      await admin.from('carousel_caption_regen_runs').delete().in('project_id', projectIds);
      await admin.from('carousel_project_slides').delete().in('project_id', projectIds);
    }

    // Projects
    await admin.from('carousel_projects').delete().eq('account_id', accountId);

    // Settings + memberships + account
    await admin.from('editor_account_settings').delete().eq('account_id', accountId);
    await admin.from('editor_account_memberships').delete().eq('account_id', accountId);
    await admin.from('editor_accounts').delete().eq('id', accountId);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to delete account') } satisfies Resp, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    accountId,
    displayName,
    deletedProjects: projectIds.length,
    deletedTemplates: templateIds.length,
  } satisfies Resp);
}

