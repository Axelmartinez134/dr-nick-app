import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase, resolveActiveAccountId } from "../../_utils";
import { SYSTEM_HTML_PRESETS } from "@/features/html-editor/lib/presets";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });

  return NextResponse.json({
    success: true,
    presets: SYSTEM_HTML_PRESETS,
  });
}
