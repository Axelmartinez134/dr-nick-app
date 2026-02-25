import 'server-only';

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { canonicalizeInstagramUrl, derivePlatformFromUrl, s, type SwipePlatform } from '../_utils';

export const runtime = 'nodejs';

export function requireCaptureKeyFromEnv(): string {
  const k = String(process.env.SWIPE_CAPTURE_KEY || '').trim();
  if (!k) throw new Error('Server missing SWIPE_CAPTURE_KEY');
  if (k.length < 16) throw new Error('SWIPE_CAPTURE_KEY must be at least 16 characters');
  return k;
}

export function validateCaptureKeyOrThrow(input: string): void {
  const provided = String(input || '').trim();
  if (!provided) throw new Error('Missing capture key');
  const expected = requireCaptureKeyFromEnv();

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // timingSafeEqual requires equal length; mismatch fails fast.
  if (a.length !== b.length) throw new Error('Invalid capture key');
  if (!crypto.timingSafeEqual(a, b)) throw new Error('Invalid capture key');
}

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

export async function resolveCaptureAccountContext(svc: any): Promise<{ accountId: string; ownerUserId: string }> {
  const ownerUserId = String(process.env.SWIPE_CAPTURE_OWNER_USER_ID || '').trim();
  if (!ownerUserId) {
    throw new Error('Server missing SWIPE_CAPTURE_OWNER_USER_ID (must be a superadmin user uuid)');
  }

  const accountIdExplicit = String(process.env.SWIPE_CAPTURE_ACCOUNT_ID || '').trim();
  if (accountIdExplicit) return { accountId: accountIdExplicit, ownerUserId };

  const { data: acct, error } = await svc
    .from('editor_accounts')
    .select('id')
    .eq('created_by_user_id', ownerUserId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const accountId = String((acct as any)?.id || '').trim();
  if (!accountId) throw new Error('Could not resolve capture account id for SWIPE_CAPTURE_OWNER_USER_ID');
  return { accountId, ownerUserId };
}

export function requireServiceClient(): any {
  const svc = serviceClient();
  if (!svc) throw new Error('Server missing Supabase service role env');
  return svc;
}

export function normalizeTags(v: any): string[] {
  if (Array.isArray(v)) {
    return v
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .slice(0, 30);
  }
  const raw = typeof v === 'string' ? v : '';
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function normalizeSwipeUrlForInsert(urlRaw: string): { url: string; platform: SwipePlatform } {
  const platform = derivePlatformFromUrl(urlRaw);
  const url = platform === 'instagram' ? canonicalizeInstagramUrl(urlRaw) : String(urlRaw || '').trim();
  return { url, platform };
}

