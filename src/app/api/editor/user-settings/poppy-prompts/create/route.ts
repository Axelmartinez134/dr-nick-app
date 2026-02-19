import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId, type TemplateTypeId } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  templateTypeId: TemplateTypeId;
  title?: string | null;
  prompt?: string | null;
};

function sanitizeText(input: any): string {
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

  const templateTypeId = body.templateTypeId === 'enhanced' ? 'enhanced' : body.templateTypeId === 'regular' ? 'regular' : null;
  if (!templateTypeId) return NextResponse.json({ success: false, error: 'Invalid template type' }, { status: 400 });

  const title = sanitizeText(body.title ?? 'New Prompt') || 'New Prompt';
  const prompt = String(body.prompt ?? '');
  if (title.length > 200) return NextResponse.json({ success: false, error: 'title too long' }, { status: 400 });
  if (prompt.length > 80_000) return NextResponse.json({ success: false, error: 'prompt too long' }, { status: 400 });

  const { data: created, error: insErr } = await supabase
    .from('editor_poppy_saved_prompts')
    .insert({
      account_id: accountId,
      user_id: user.id,
      template_type_id: templateTypeId,
      title,
      prompt,
      is_active: false,
      seed_key: null,
    } as any)
    .select('id, account_id, user_id, template_type_id, title, prompt, is_active, seed_key, created_at, updated_at')
    .single();

  if (insErr || !created) {
    return NextResponse.json({ success: false, error: insErr?.message || 'Failed to create prompt' }, { status: 500 });
  }

  // Best-effort UX stability: if no active prompt exists yet for this scope, make the new one active.
  try {
    const { data: activeRow } = await supabase
      .from('editor_poppy_saved_prompts')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .eq('template_type_id', templateTypeId)
      .eq('is_active', true)
      .maybeSingle();

    if (!activeRow?.id) {
      await supabase
        .from('editor_poppy_saved_prompts')
        .update({ is_active: false })
        .eq('account_id', accountId)
        .eq('user_id', user.id)
        .eq('template_type_id', templateTypeId);
      const { data: activated } = await supabase
        .from('editor_poppy_saved_prompts')
        .update({ is_active: true })
        .eq('id', (created as any).id)
        .eq('account_id', accountId)
        .eq('user_id', user.id)
        .select('id, account_id, user_id, template_type_id, title, prompt, is_active, seed_key, created_at, updated_at')
        .single();
      if (activated) {
        return NextResponse.json({ success: true, prompt: activated, activated: true });
      }
    }
  } catch {
    // ignore activation errors (non-critical)
  }

  return NextResponse.json({ success: true, prompt: created, activated: false });
}

