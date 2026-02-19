import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId, type TemplateTypeId } from '../../../_utils';
import { loadEffectiveTemplateTypeSettings } from '../../../projects/_effective';

export const runtime = 'nodejs';
export const maxDuration = 10;

type PromptRow = {
  id: string;
  account_id: string;
  user_id: string;
  template_type_id: TemplateTypeId;
  title: string;
  prompt: string;
  is_active: boolean;
  seed_key: string | null;
  created_at: string;
  updated_at: string;
};

function parseTemplateTypeId(req: NextRequest): TemplateTypeId | null {
  const { searchParams } = new URL(req.url);
  const raw = String(searchParams.get('type') || '').trim();
  if (raw === 'regular' || raw === 'enhanced') return raw;
  return null;
}

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  const templateTypeId = parseTemplateTypeId(req);
  if (!templateTypeId) {
    return NextResponse.json({ success: false, error: 'Invalid template type' }, { status: 400 });
  }

  const list = async () => {
    const { data, error } = await supabase
      .from('editor_poppy_saved_prompts')
      .select('id, account_id, user_id, template_type_id, title, prompt, is_active, seed_key, created_at, updated_at')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .eq('template_type_id', templateTypeId)
      .order('is_active', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as PromptRow[];
  };

  const ensureSeeded = async () => {
    // Seed from the current effective account-level prompt (defaults + account overrides).
    const { effective } = await loadEffectiveTemplateTypeSettings(supabase as any, { accountId, actorUserId: user.id }, templateTypeId);
    const prompt = String((effective as any)?.prompt || '').trim();
    if (!prompt) return false;

    const { error } = await supabase.from('editor_poppy_saved_prompts').insert({
      account_id: accountId,
      user_id: user.id,
      template_type_id: templateTypeId,
      title: 'Default Poppy Prompt',
      prompt,
      is_active: true,
      seed_key: 'default',
    } as any);

    if (!error) return true;
    // Best-effort idempotency: if a concurrent seed happened, ignore and proceed.
    const code = (error as any)?.code;
    if (code === '23505') return false;
    throw new Error(error.message);
  };

  const selfHealActive = async (rows: PromptRow[]) => {
    if (rows.length === 0) return;
    if (rows.some((r) => !!r.is_active)) return;
    const newest = rows[0];
    if (!newest?.id) return;
    // Best-effort: make newest active.
    await supabase
      .from('editor_poppy_saved_prompts')
      .update({ is_active: false })
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .eq('template_type_id', templateTypeId);
    await supabase
      .from('editor_poppy_saved_prompts')
      .update({ is_active: true })
      .eq('id', newest.id)
      .eq('account_id', accountId)
      .eq('user_id', user.id);
  };

  try {
    let rows = await list();
    if (rows.length === 0) {
      await ensureSeeded();
      rows = await list();
    } else {
      await selfHealActive(rows);
      rows = await list();
    }

    return NextResponse.json({ success: true, prompts: rows });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || 'Failed to list prompts') }, { status: 500 });
  }
}

