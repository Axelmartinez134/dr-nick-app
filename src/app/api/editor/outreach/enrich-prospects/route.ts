import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';
import { scrapeInstagramProfileViaApify } from '../_apify';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  seedUsername: string;
  usernames: string[];
};

type RowResp =
  | { username: string; ok: true; profilePicUrlHD: string | null }
  | { username: string; ok: false; error: string };

type Resp =
  | { success: true; results: RowResp[] }
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

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let nextIdx = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
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

  const seedUsername = normalizeUsername((body as any)?.seedUsername);
  const usernamesRaw = Array.isArray((body as any)?.usernames) ? ((body as any).usernames as any[]) : [];
  const usernames = usernamesRaw
    .map((u) => normalizeUsername(u))
    .filter(Boolean) as string[];

  if (!seedUsername) {
    return NextResponse.json({ success: false, error: 'seedUsername is required' } satisfies Resp, { status: 400 });
  }
  if (!usernames.length) {
    return NextResponse.json({ success: false, error: 'usernames is required' } satisfies Resp, { status: 400 });
  }
  if (usernames.length > 25) {
    return NextResponse.json({ success: false, error: 'Too many usernames (max 25)' } satisfies Resp, { status: 400 });
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } satisfies Resp, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const results = await mapWithConcurrency(usernames, 2, async (uname) => {
    try {
      // Ensure the prospect exists (Phase 6 save) so we know which row to update.
      const { data: row, error: rowErr } = await svc
        .from('editor_outreach_targets')
        .select('id')
        .eq('account_id', accountId)
        .eq('source_type', 'following')
        .eq('source_seed_username', seedUsername)
        .eq('prospect_username', uname)
        .maybeSingle();
      if (rowErr) throw new Error(rowErr.message);
      const id = String((row as any)?.id || '').trim();
      if (!id) throw new Error('Prospect not found. Save it first.');

      const instagramUrl = `https://www.instagram.com/${uname}/`;
      const scraped = await scrapeInstagramProfileViaApify({ instagramUrl });

      const patch: any = {
        enriched_profile_pic_url_hd: s(scraped.profilePicUrlHD),
        enriched_raw_json: scraped.raw ?? null,
        enriched_at: nowIso,
        // Also fill the “single-profile” columns so later “create template/project” can reuse them safely.
        instagram_url: instagramUrl,
        full_name: s(scraped.fullName),
        username: s(scraped.username) ? normalizeUsername(scraped.username) : uname,
        profile_pic_url_hd: s(scraped.profilePicUrlHD),
      };

      const { error: updErr } = await svc.from('editor_outreach_targets').update(patch).eq('id', id);
      if (updErr) throw new Error(updErr.message);

      return { username: uname, ok: true as const, profilePicUrlHD: s(scraped.profilePicUrlHD) } satisfies RowResp;
    } catch (e: any) {
      return { username: uname, ok: false as const, error: String(e?.message || e || 'Enrichment failed') } satisfies RowResp;
    }
  });

  return NextResponse.json({ success: true, results } satisfies Resp);
}

