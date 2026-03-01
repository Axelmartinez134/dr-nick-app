import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { getAuthedSwipeContext, requireAccountMembership } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp =
  | { success: true; keyPresent: boolean; key: string | null }
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

function requireServiceClient(): any {
  const svc = serviceClient();
  if (!svc) throw new Error('Server missing Supabase service role env');
  return svc;
}

function generateCaptureKey16(): string {
  // 12 bytes base64url => 16 URL-safe chars (no padding).
  return crypto.randomBytes(12).toString('base64url');
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthedSwipeContext(request);
  if (!ctx.ok) return NextResponse.json({ success: false, error: ctx.error } satisfies Resp, { status: ctx.status });

  try {
    const member = await requireAccountMembership({ supabase: ctx.supabase, userId: ctx.user.id, accountId: ctx.accountId });
    if (!member.ok) {
      return NextResponse.json({ success: false, error: member.error } satisfies Resp, { status: member.status });
    }
    const svc = requireServiceClient();

    // Read existing.
    const { data: row, error: rowErr } = await svc
      .from('editor_accounts')
      .select('id, swipe_capture_key, swipe_capture_key_enabled')
      .eq('id', ctx.accountId)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row?.id) throw new Error('Account not found');

    const existing = String((row as any)?.swipe_capture_key || '').trim();
    if (existing) {
      return NextResponse.json({ success: true, keyPresent: true, key: existing } satisfies Resp);
    }

    // Lazily generate & persist. Retry a few times in case of rare collisions.
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCaptureKey16();
      const { data: updated, error: upErr } = await svc
        .from('editor_accounts')
        .update({ swipe_capture_key: candidate, swipe_capture_key_created_at: now })
        .eq('id', ctx.accountId)
        .is('swipe_capture_key', null)
        .select('swipe_capture_key')
        .maybeSingle();

      if (upErr) {
        const code = (upErr as any)?.code;
        if (code === '23505') continue; // unique violation
        throw new Error(upErr.message);
      }

      const written = String((updated as any)?.swipe_capture_key || '').trim();
      if (written) {
        return NextResponse.json({ success: true, keyPresent: true, key: written } satisfies Resp);
      }

      // If update didn't apply (race), re-read and return if now present.
      const { data: reread, error: rereadErr } = await svc
        .from('editor_accounts')
        .select('swipe_capture_key')
        .eq('id', ctx.accountId)
        .maybeSingle();
      if (rereadErr) throw new Error(rereadErr.message);
      const rereadKey = String((reread as any)?.swipe_capture_key || '').trim();
      if (rereadKey) {
        return NextResponse.json({ success: true, keyPresent: true, key: rereadKey } satisfies Resp);
      }
    }

    throw new Error('Failed to generate capture key');
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to load capture key') } satisfies Resp, {
      status: 500,
    });
  }
}

