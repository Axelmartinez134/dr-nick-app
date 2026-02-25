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

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) return { ok: false as const, status: superadmin.status as const, error: superadmin.error };

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return { ok: false as const, status: acct.status as const, error: acct.error };

  return { ok: true as const, supabase, user, accountId: acct.accountId };
}

