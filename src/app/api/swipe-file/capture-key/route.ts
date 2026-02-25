import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSwipeContext } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp =
  | { success: true; keyPresent: boolean; key: string | null }
  | { success: false; error: string };

export async function GET(request: NextRequest) {
  const ctx = await getAuthedSwipeContext(request);
  if (!ctx.ok) return NextResponse.json({ success: false, error: ctx.error } satisfies Resp, { status: ctx.status });

  const raw = String(process.env.SWIPE_CAPTURE_KEY || '').trim();
  if (!raw) {
    return NextResponse.json({ success: true, keyPresent: false, key: null } satisfies Resp);
  }
  return NextResponse.json({ success: true, keyPresent: true, key: raw } satisfies Resp);
}

