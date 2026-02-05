import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

function safeUrlInfo(raw: string | undefined) {
  const s = String(raw || '').trim();
  if (!s) return { present: false as const };
  try {
    const u = new URL(s);
    const host = u.host;
    const ref = host.endsWith('.supabase.co') ? host.replace('.supabase.co', '') : null;
    return { present: true as const, host, projectRef: ref };
  } catch {
    return { present: true as const, host: null as any, projectRef: null };
  }
}

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });

  const urlInfo = safeUrlInfo(process.env.NEXT_PUBLIC_SUPABASE_URL);

  // Probe what the running app's Supabase/PostgREST layer thinks about account_id.
  // This helps differentiate "DB missing column" vs "schema cache mismatch" vs "wrong project".
  let probe: any = null;
  try {
    const res = await supabase.from('editor_ideas').select('id, account_id').limit(1);
    probe = {
      ok: !res.error,
      error: res.error ? { message: res.error.message, details: (res.error as any).details, hint: (res.error as any).hint, code: (res.error as any).code } : null,
      dataSample: Array.isArray(res.data) ? res.data : null,
    };
  } catch (e: any) {
    probe = { ok: false, error: { message: String(e?.message || e) }, dataSample: null };
  }

  return NextResponse.json({
    success: true,
    supabaseUrl: urlInfo,
    resolved: { userId: user.id, accountId: acct.accountId },
    probe,
  });
}

