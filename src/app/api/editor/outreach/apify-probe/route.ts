import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';
import { scrapeInstagramProfileViaApify } from '../_apify';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Resp =
  | { success: true; data: { fullName: string | null; username: string | null; profilePicUrlHD: string | null; raw: any } }
  | { success: false; error: string };

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  // Phase 0: superadmin-only probe (keeps Apify token usage from being reachable by non-superadmins).
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) return NextResponse.json({ success: false, error: saErr.message } satisfies Resp, { status: 500 });
  if (!saRow?.user_id) return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const instagramUrl = String(body?.instagramUrl || '').trim();
  if (!instagramUrl) {
    return NextResponse.json({ success: false, error: 'instagramUrl is required' } satisfies Resp, { status: 400 });
  }

  try {
    const data = await scrapeInstagramProfileViaApify({ instagramUrl });
    return NextResponse.json({ success: true, data } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e || 'Scrape failed') } satisfies Resp, { status: 500 });
  }
}

