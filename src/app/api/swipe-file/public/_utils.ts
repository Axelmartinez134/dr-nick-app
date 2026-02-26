import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { canonicalizeInstagramUrl, derivePlatformFromUrl, s, type SwipePlatform } from '../_utils';

export const runtime = 'nodejs';

export function requireCaptureKeyFromRequest(input: string): string {
  const provided = String(input || '').trim();
  if (!provided) throw new Error('Missing capture key');
  if (provided.length < 16) throw new Error('Invalid capture key');
  return provided;
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

export function requireServiceClient(): any {
  const svc = serviceClient();
  if (!svc) throw new Error('Server missing Supabase service role env');
  return svc;
}

export async function resolveCaptureAccountContextFromKey(svc: any, key: string): Promise<{ accountId: string; ownerUserId: string }> {
  const k = requireCaptureKeyFromRequest(key);
  const { data, error } = await svc
    .from('editor_accounts')
    .select('id, created_by_user_id, swipe_capture_key_enabled')
    .eq('swipe_capture_key', k)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const accountId = String((data as any)?.id || '').trim();
  const ownerUserId = String((data as any)?.created_by_user_id || '').trim();
  const enabled = (data as any)?.swipe_capture_key_enabled;
  if (!accountId || !ownerUserId) throw new Error('Invalid capture key');
  if (enabled === false) throw new Error('Capture key disabled');
  return { accountId, ownerUserId };
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

