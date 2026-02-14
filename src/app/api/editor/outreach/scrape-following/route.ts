import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';
import { scrapeInstagramFollowingViaApify } from '../_apify';

export const runtime = 'nodejs';
// Apify run waits up to 180s; keep route maxDuration >= that.
export const maxDuration = 210;

type Body = {
  seedInstagramUrl: string;
  maxResults?: number;
  maxSpendUsd?: number;
};

type Item = {
  seedUsername: string;
  username: string | null;
  fullName: string | null;
  profilePicUrl: string | null;
  isVerified: boolean | null;
  isPrivate: boolean | null;
  raw: any;
};

type Resp =
  | { success: true; seedUsername: string; items: Item[]; sessionId?: string }
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

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });

  let body: Body | null = null;
  try {
    body = (await req.json()) as any;
  } catch {
    // ignore
  }

  const seedInstagramUrl = String((body as any)?.seedInstagramUrl || '').trim();
  if (!seedInstagramUrl) {
    return NextResponse.json({ success: false, error: 'seedInstagramUrl is required' } satisfies Resp, { status: 400 });
  }

  const maxResultsRaw = (body as any)?.maxResults;
  const maxSpendUsdRaw = (body as any)?.maxSpendUsd;

  try {
    const out = await scrapeInstagramFollowingViaApify({
      seedInstagramUrlOrUsername: seedInstagramUrl,
      maxResults: maxResultsRaw,
      maxSpendUsd: maxSpendUsdRaw,
    });

    // Auto-save scrape session so reopening modal restores the table.
    let sessionId: string | null = null;
    try {
      const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
      const accountId = acct.ok ? acct.accountId : null;
      const row = {
        created_by_user_id: user.id,
        account_id: accountId,
        kind: 'following',
        seed_instagram_url: seedInstagramUrl,
        seed_username: out.seedUsername,
        max_results: Number.isFinite(maxResultsRaw as any) ? Number(maxResultsRaw) : null,
        max_spend_usd: Number.isFinite(maxSpendUsdRaw as any) ? Number(maxSpendUsdRaw) : null,
        actor_id: 'datavoyantlab/instagram-following-scraper',
        items: out.items as any,
      };
      const { data: inserted, error: insErr } = await supabase
        .from('editor_outreach_scrape_sessions')
        .insert(row as any)
        .select('id')
        .single();
      if (!insErr && inserted?.id) sessionId = String(inserted.id);
    } catch {
      // best-effort; scrape still returns results
    }

    return NextResponse.json({ success: true, seedUsername: out.seedUsername, items: out.items, sessionId: sessionId ?? undefined } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e || 'Scrape failed') } satisfies Resp, { status: 500 });
  }
}

