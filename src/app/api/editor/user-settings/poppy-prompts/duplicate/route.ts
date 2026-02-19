import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  id: string;
};

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

  const { data: src, error: srcErr } = await supabase
    .from('editor_poppy_saved_prompts')
    .select('id, template_type_id, title, prompt')
    .eq('id', id)
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .single();

  if (srcErr || !src) {
    return NextResponse.json({ success: false, error: srcErr?.message || 'Prompt not found' }, { status: 404 });
  }

  const nextTitle = `${String((src as any).title || 'Prompt').trim() || 'Prompt'} (copy)`;
  const nextPrompt = String((src as any).prompt || '');

  const { data: created, error: insErr } = await supabase
    .from('editor_poppy_saved_prompts')
    .insert({
      account_id: accountId,
      user_id: user.id,
      template_type_id: (src as any).template_type_id,
      title: nextTitle.slice(0, 200),
      prompt: nextPrompt,
      is_active: false,
      seed_key: null,
    } as any)
    .select('id, account_id, user_id, template_type_id, title, prompt, is_active, seed_key, created_at, updated_at')
    .single();

  if (insErr || !created) {
    return NextResponse.json({ success: false, error: insErr?.message || 'Failed to duplicate prompt' }, { status: 500 });
  }

  return NextResponse.json({ success: true, prompt: created });
}

