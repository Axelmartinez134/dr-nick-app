import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import {
  listEnabledDailyDigestScopes,
  requireServiceClient,
  runDailyDigestForScope,
} from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Resp =
  | {
      success: true;
      scopesProcessed: number;
      results: Array<Awaited<ReturnType<typeof runDailyDigestForScope>>>;
    }
  | { success: false; error: string };

function getCronToken(request: NextRequest): string {
  const authHeader = request.headers.get('authorization');
  return String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
}

export async function POST(request: NextRequest) {
  const token = getCronToken(request);
  if (!token || token !== String(process.env.CRON_SECRET || '').trim()) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies Resp, { status: 401 });
  }

  try {
    const svc = requireServiceClient();
    const scopes = await listEnabledDailyDigestScopes({ supabase: svc });
    const results: Array<Awaited<ReturnType<typeof runDailyDigestForScope>>> = [];

    for (const scope of scopes) {
      const result = await runDailyDigestForScope({
        supabase: svc,
        userId: scope.userId,
        accountId: scope.accountId,
      });
      if (result) results.push(result);
    }

    return NextResponse.json({
      success: true,
      scopesProcessed: results.length,
      results,
    } satisfies Resp);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Daily Digest cron failed') } satisfies Resp, { status: 500 });
  }
}
