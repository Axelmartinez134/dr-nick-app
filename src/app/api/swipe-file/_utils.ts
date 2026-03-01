import 'server-only';

import { NextRequest } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../editor/_utils';

export const runtime = 'nodejs';

export async function requireSuperadmin(supabase: any, userId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (saErr) return { ok: false, status: 500, error: saErr.message };
  if (!saRow?.user_id) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

export async function requireAccountMembership(args: {
  supabase: any;
  userId: string;
  accountId: string;
}): Promise<{ ok: true } | { ok: false; status: 403 | 500; error: string }> {
  const { supabase, userId, accountId } = args;
  const uid = String(userId || '').trim();
  const aid = String(accountId || '').trim();
  if (!uid || !aid) return { ok: false, status: 403, error: 'Forbidden' };

  // Owner fast-path.
  try {
    const { data: acct, error: acctErr } = await supabase
      .from('editor_accounts')
      .select('id')
      .eq('id', aid)
      .eq('created_by_user_id', uid)
      .maybeSingle();
    if (acctErr) {
      // If RLS blocks, treat as forbidden rather than leaking details.
    } else if (acct?.id) {
      return { ok: true };
    }
  } catch {
    // ignore
  }

  // Membership check.
  try {
    const { data: mem, error: memErr } = await supabase
      .from('editor_account_memberships')
      .select('account_id')
      .eq('account_id', aid)
      .eq('user_id', uid)
      .maybeSingle();
    if (memErr) return { ok: false, status: 403, error: 'Forbidden' };
    if (!mem?.account_id) return { ok: false, status: 403, error: 'Forbidden' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, status: 500, error: String(e?.message || 'Failed to validate account') };
  }
}

export function s(v: any): string | null {
  const out = typeof v === 'string' ? v.trim() : '';
  return out ? out : null;
}

export type SwipePlatform = 'instagram' | 'youtube' | 'tiktok' | 'x' | 'web' | 'unknown';

export function derivePlatformFromUrl(urlRaw: string): SwipePlatform {
  const raw = String(urlRaw || '').trim();
  if (!raw) return 'unknown';

  let hostname = '';
  try {
    const u = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
    hostname = String(u.hostname || '').toLowerCase();
  } catch {
    return 'unknown';
  }

  if (hostname.includes('instagram.com')) return 'instagram';
  if (hostname.includes('tiktok.com')) return 'tiktok';
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
  if (hostname === 'x.com' || hostname.includes('twitter.com')) return 'x';
  if (hostname) return 'web';
  return 'unknown';
}

export function canonicalizeInstagramUrl(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (!(raw.startsWith('http://') || raw.startsWith('https://'))) return raw;
  try {
    const u = new URL(raw);
    u.search = '';
    u.hash = '';
    const parts = String(u.pathname || '')
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts[0] === 'reels') parts[0] = 'reel';
    u.pathname = `/${parts.join('/')}${parts.length ? '/' : ''}`;
    return u.toString();
  } catch {
    return raw;
  }
}

export function isInstagramReelOrPostUrl(urlRaw: string): boolean {
  const raw = String(urlRaw || '').trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const parts = String(u.pathname || '')
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    const kind = parts[0] || '';
    return kind === 'p' || kind === 'reel' || kind === 'tv' || kind === 'reels';
  } catch {
    return false;
  }
}

export async function getAuthedSwipeContext(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return authed;
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return { ok: false as const, status: acct.status, error: acct.error };

  return { ok: true as const, supabase, user, accountId: acct.accountId };
}

export async function getAuthedSwipeSuperadminContext(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return authed;
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return { ok: false as const, status: superadmin.status, error: superadmin.error };

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return { ok: false as const, status: acct.status, error: acct.error };

  return { ok: true as const, supabase, user, accountId: acct.accountId };
}

