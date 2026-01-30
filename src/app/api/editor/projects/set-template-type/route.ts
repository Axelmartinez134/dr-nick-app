import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId, type TemplateTypeId } from '../../_utils';
import { loadEffectiveTemplateTypeSettings } from '../_effective';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  projectId: string;
  templateTypeId: TemplateTypeId;
};

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  if (body.templateTypeId !== 'regular' && body.templateTypeId !== 'enhanced') {
    return NextResponse.json({ success: false, error: 'Invalid template type' }, { status: 400 });
  }

  // Load the effective (global default) prompt + template mapping for this template type.
  const { effective } = await loadEffectiveTemplateTypeSettings(supabase, { accountId, actorUserId: user.id }, body.templateTypeId);

  const patch: any = {
    template_type_id: body.templateTypeId,
    prompt_snapshot: effective?.prompt || '',
    slide1_template_id_snapshot: effective?.slide1TemplateId ?? null,
    slide2_5_template_id_snapshot: effective?.slide2to5TemplateId ?? null,
    slide6_template_id_snapshot: effective?.slide6TemplateId ?? null,
  };

  const { data, error } = await supabase
    .from('carousel_projects')
    .update(patch)
    .eq('id', body.projectId)
    .eq('account_id', accountId)
    .select(
      'id, owner_user_id, title, template_type_id, caption, prompt_snapshot, slide1_template_id_snapshot, slide2_5_template_id_snapshot, slide6_template_id_snapshot, created_at, updated_at'
    )
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update project' }, { status: 500 });
  }

  return NextResponse.json({ success: true, project: data, effective });
}

