import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedDailyDigestContext } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 20;

type RunRow = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  videosDiscovered: number;
  videosProcessed: number;
  videosFailed: number;
  videosPending: number;
  topicsExtracted: number;
  promptSource: string | null;
  errorMessage: string | null;
  runErrors: any[];
};

type Resp =
  | { success: true; runs: RunRow[]; activeRun: RunRow | null; lastCompletedRun: RunRow | null }
  | { success: false; error: string };

export async function GET(request: NextRequest) {
  const auth = await getAuthedDailyDigestContext(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error } satisfies Resp, { status: auth.status });
  const { supabase, user, accountId } = auth;
  if (!accountId) return NextResponse.json({ success: false, error: 'Missing active account' } satisfies Resp, { status: 400 });

  const { data, error } = await supabase
    .from('daily_digest_runs')
    .select('id, started_at, finished_at, status, videos_discovered, videos_processed, videos_failed, videos_pending, topics_extracted, prompt_source, error_message, run_errors')
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .order('started_at', { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const runs: RunRow[] = (Array.isArray(data) ? data : []).map((row: any) => ({
    id: String(row.id || ''),
    startedAt: String(row.started_at || ''),
    finishedAt: typeof row.finished_at === 'string' ? row.finished_at : row.finished_at ?? null,
    status: String(row.status || ''),
    videosDiscovered: Number(row.videos_discovered || 0),
    videosProcessed: Number(row.videos_processed || 0),
    videosFailed: Number(row.videos_failed || 0),
    videosPending: Number(row.videos_pending || 0),
    topicsExtracted: Number(row.topics_extracted || 0),
    promptSource: typeof row.prompt_source === 'string' ? row.prompt_source : row.prompt_source ?? null,
    errorMessage: typeof row.error_message === 'string' ? row.error_message : row.error_message ?? null,
    runErrors: Array.isArray(row.run_errors) ? row.run_errors : [],
  }));

  const activeRun = runs.find((run) => run.status === 'running') || null;
  const lastCompletedRun =
    runs.find((run) => run.status === 'completed' || run.status === 'completed_with_errors') || null;

  return NextResponse.json({ success: true, runs, activeRun, lastCompletedRun } satisfies Resp);
}
