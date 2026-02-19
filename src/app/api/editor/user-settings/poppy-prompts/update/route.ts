import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  id: string;
  title?: string | null;
  prompt?: string | null;
};

function sanitizeTitle(input: any): string {
  return String(input ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

  const hasTitle = (body as any).title !== undefined;
  const hasPrompt = (body as any).prompt !== undefined;
  if (!hasTitle && !hasPrompt) {
    return NextResponse.json({ success: false, error: 'title or prompt is required' }, { status: 400 });
  }

  const patch: any = {};
  if (hasTitle) {
    const nextTitle = body.title === null ? '' : sanitizeTitle(body.title);
    if (!nextTitle) return NextResponse.json({ success: false, error: 'title cannot be empty' }, { status: 400 });
    if (nextTitle.length > 200) return NextResponse.json({ success: false, error: 'title too long' }, { status: 400 });
    patch.title = nextTitle;
  }
  if (hasPrompt) {
    const nextPrompt = body.prompt === null ? '' : String(body.prompt ?? '');
    if (nextPrompt.length > 80_000) return NextResponse.json({ success: false, error: 'prompt too long' }, { status: 400 });
    patch.prompt = nextPrompt;
  }

  const { data, error } = await supabase
    .from('editor_poppy_saved_prompts')
    .update(patch)
    .eq('id', id)
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .select('id, account_id, user_id, template_type_id, title, prompt, is_active, seed_key, created_at, updated_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update prompt' }, { status: 500 });
  }

  return NextResponse.json({ success: true, prompt: data });
}

