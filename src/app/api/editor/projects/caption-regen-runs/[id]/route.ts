import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Resp =
  | {
      success: true;
      run: {
        id: string;
        createdAt: string | null;
        outputCaption: string;
        promptRendered: string;
        inputContext: any;
        excludedFromPrompt: boolean;
      };
    }
  | { success: false; error: string };

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(String(v || '').trim());
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  // Superadmin only.
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) return NextResponse.json({ success: false, error: saErr.message } satisfies Resp, { status: 500 });
  if (!saRow?.user_id) return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });

  const { id } = await ctx.params;
  const runId = String(id || '').trim();
  if (!runId || !isUuid(runId)) {
    return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = String(searchParams.get('projectId') || '').trim();
  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' } satisfies Resp, { status: 400 });

  const { data: row, error } = await supabase
    .from('carousel_caption_regen_runs')
    .select('id, created_at, output_caption, prompt_rendered, input_context, excluded_from_prompt')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('id', runId)
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });
  if (!row?.id) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

  return NextResponse.json({
    success: true,
    run: {
      id: String((row as any).id),
      createdAt: (row as any)?.created_at || null,
      outputCaption: String((row as any)?.output_caption || ''),
      promptRendered: String((row as any)?.prompt_rendered || ''),
      inputContext: (row as any)?.input_context || null,
      excludedFromPrompt: !!(row as any)?.excluded_from_prompt,
    },
  } satisfies Resp);
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } satisfies Resp, { status: acct.status });
  const accountId = acct.accountId;

  // Superadmin only.
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (saErr) return NextResponse.json({ success: false, error: saErr.message } satisfies Resp, { status: 500 });
  if (!saRow?.user_id) return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });

  const { id } = await ctx.params;
  const runId = String(id || '').trim();
  if (!runId || !isUuid(runId)) {
    return NextResponse.json({ success: false, error: 'Invalid id' } satisfies Resp, { status: 400 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const excludedFromPrompt = (body as any)?.excludedFromPrompt;
  if (typeof excludedFromPrompt !== 'boolean') {
    return NextResponse.json({ success: false, error: 'excludedFromPrompt must be boolean' } satisfies Resp, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = String(searchParams.get('projectId') || '').trim();
  if (!projectId) return NextResponse.json({ success: false, error: 'projectId is required' } satisfies Resp, { status: 400 });

  const now = new Date().toISOString();
  const patch: any = {
    excluded_from_prompt: excludedFromPrompt,
    excluded_at: excludedFromPrompt ? now : null,
    excluded_by_user_id: excludedFromPrompt ? user.id : null,
  };

  const { data: updated, error: upErr } = await supabase
    .from('carousel_caption_regen_runs')
    .update(patch)
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('id', runId)
    .select('id, created_at, output_caption, prompt_rendered, input_context, excluded_from_prompt')
    .maybeSingle();
  if (upErr) return NextResponse.json({ success: false, error: upErr.message } satisfies Resp, { status: 500 });
  if (!updated?.id) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

  return NextResponse.json({
    success: true,
    run: {
      id: String((updated as any).id),
      createdAt: (updated as any)?.created_at || null,
      outputCaption: String((updated as any)?.output_caption || ''),
      promptRendered: String((updated as any)?.prompt_rendered || ''),
      inputContext: (updated as any)?.input_context || null,
      excludedFromPrompt: !!(updated as any)?.excluded_from_prompt,
    },
  } satisfies Resp);
}

