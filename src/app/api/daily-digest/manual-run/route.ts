import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthedDailyDigestContext,
  requireServiceClient,
  runDailyDigestForScope,
} from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Resp =
  | {
      success: true;
      result: Awaited<ReturnType<typeof runDailyDigestForScope>>;
    }
  | { success: false; error: string };

export async function POST(request: NextRequest) {
  const auth = await getAuthedDailyDigestContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { user, accountId } = auth;
  if (!accountId) return NextResponse.json({ success: false, error: 'Missing active account' } satisfies Resp, { status: 400 });

  try {
    const svc = requireServiceClient();
    const result = await runDailyDigestForScope({
      supabase: svc,
      userId: user.id,
      accountId,
    });
    if (!result) {
      return NextResponse.json({ success: false, error: 'No enabled Daily Digest creators for this account' } satisfies Resp, { status: 404 });
    }
    return NextResponse.json({ success: true, result } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Daily Digest manual run failed') } satisfies Resp, { status: 500 });
  }
}
