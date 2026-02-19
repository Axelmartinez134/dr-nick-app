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

  // Load the row to derive its template_type_id (scope for activation).
  const { data: row, error: rowErr } = await supabase
    .from('editor_poppy_saved_prompts')
    .select('id, template_type_id')
    .eq('id', id)
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .single();

  if (rowErr || !row) {
    return NextResponse.json({ success: false, error: rowErr?.message || 'Prompt not found' }, { status: 404 });
  }

  const templateTypeId = String((row as any).template_type_id || '').trim();
  if (!templateTypeId) return NextResponse.json({ success: false, error: 'Invalid template type' }, { status: 400 });

  // Two-step activation (safe with the unique active partial index):
  // 1) clear active for scope
  // 2) activate target
  const { error: clearErr } = await supabase
    .from('editor_poppy_saved_prompts')
    .update({ is_active: false })
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .eq('template_type_id', templateTypeId);
  if (clearErr) {
    return NextResponse.json({ success: false, error: clearErr.message }, { status: 500 });
  }

  const { data: activated, error: actErr } = await supabase
    .from('editor_poppy_saved_prompts')
    .update({ is_active: true })
    .eq('id', id)
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .select('id, account_id, user_id, template_type_id, title, prompt, is_active, seed_key, created_at, updated_at')
    .single();

  if (actErr || !activated) {
    return NextResponse.json({ success: false, error: actErr?.message || 'Failed to activate prompt' }, { status: 500 });
  }

  return NextResponse.json({ success: true, prompt: activated });
}

