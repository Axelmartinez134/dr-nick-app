import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase, resolveActiveAccountId } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  projectId: string;
  slide1TemplateIdSnapshot?: string | null;
  slide2to5TemplateIdSnapshot?: string | null;
  slide6TemplateIdSnapshot?: string | null;
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

  const patch: any = {};
  if (body.slide1TemplateIdSnapshot !== undefined) patch.slide1_template_id_snapshot = body.slide1TemplateIdSnapshot;
  if (body.slide2to5TemplateIdSnapshot !== undefined) patch.slide2_5_template_id_snapshot = body.slide2to5TemplateIdSnapshot;
  if (body.slide6TemplateIdSnapshot !== undefined) patch.slide6_template_id_snapshot = body.slide6TemplateIdSnapshot;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  // Safety: validate that any non-null template IDs belong to the active account.
  const idsToValidate = [
    body.slide1TemplateIdSnapshot ?? null,
    body.slide2to5TemplateIdSnapshot ?? null,
    body.slide6TemplateIdSnapshot ?? null,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  if (idsToValidate.length > 0) {
    const uniq = Array.from(new Set(idsToValidate));
    const { data: rows, error: rowsErr } = await supabase
      .from('carousel_templates')
      .select('id')
      .in('id', uniq)
      .eq('account_id', accountId);
    if (rowsErr) return NextResponse.json({ success: false, error: rowsErr.message }, { status: 500 });
    const found = new Set((rows || []).map((r: any) => String(r.id)));
    const missing = uniq.filter((id) => !found.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Template not found in this account: ${missing.join(', ')}` },
        { status: 403 }
      );
    }
  }

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

  return NextResponse.json({ success: true, project: data });
}

