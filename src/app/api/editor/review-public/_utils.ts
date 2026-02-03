import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function serviceClient() {
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

export async function resolveAccountIdFromReviewToken(admin: any, token: string): Promise<string | null> {
  const t = String(token || '').trim();
  if (!t) return null;
  const { data, error } = await admin
    .from('editor_account_settings')
    .select('account_id')
    .eq('review_share_token', t)
    .maybeSingle();
  if (error) return null;
  const accountId = String((data as any)?.account_id || '').trim();
  return accountId || null;
}

export function cleanComment(v: any): string {
  const s = String(v ?? '').replace(/\r\n/g, '\n');
  // Simple guardrails (MVP): allow blank, cap length.
  return s.length > 4000 ? s.slice(0, 4000) : s;
}

