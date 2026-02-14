import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 15;

type Resp =
  | {
      success: true;
      session: null | {
        id: string;
        createdAt: string;
        seedInstagramUrl: string | null;
        seedUsername: string | null;
        maxResults: number | null;
        maxSpendUsd: number | null;
        actorId: string | null;
        items: any[];
      };
    }
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

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });

  const svc = serviceClient();

  const db = svc || supabase;
  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  const accountId = acct.ok ? acct.accountId : null;
  let q = db
    .from('editor_outreach_scrape_sessions')
    .select('id, created_at, seed_instagram_url, seed_username, max_results, max_spend_usd, actor_id, items')
    .eq('kind', 'following')
    .order('created_at', { ascending: false })
    .limit(1);

  // Always scope to resolved active account id (bulletproof persistence).
  q = accountId ? q.eq('account_id', accountId) : q.is('account_id', null);

  const { data, error } = await q.maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  if (!data?.id) {
    return NextResponse.json({ success: true, session: null } satisfies Resp);
  }

  const items = Array.isArray((data as any)?.items) ? ((data as any).items as any[]) : [];
  return NextResponse.json({
    success: true,
    session: {
      id: String((data as any).id),
      createdAt: String((data as any).created_at || ''),
      seedInstagramUrl: (data as any).seed_instagram_url ?? null,
      seedUsername: (data as any).seed_username ?? null,
      maxResults: (data as any).max_results ?? null,
      maxSpendUsd: (data as any).max_spend_usd ?? null,
      actorId: (data as any).actor_id ?? null,
      items,
    },
  } satisfies Resp);
}

