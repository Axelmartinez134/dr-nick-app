import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  projectId: string;
  title?: string;
  caption?: string | null;
  backgroundEffectEnabled?: boolean;
  backgroundEffectType?: 'none' | 'dots_n8n';
  projectBackgroundColor?: string;
  projectTextColor?: string;
  backgroundEffectSettings?: any;
  themeIdLastApplied?: string | null;
  themeIsCustomized?: boolean;
  themeDefaultsSnapshot?: any | null;
  lastManualBackgroundColor?: string | null;
  lastManualTextColor?: string | null;
};

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });

  const patch: any = {};
  if (typeof body.title === 'string') patch.title = body.title.trim() || 'Untitled Project';
  if (body.caption !== undefined) patch.caption = body.caption;
  if (typeof body.backgroundEffectEnabled === 'boolean') patch.background_effect_enabled = body.backgroundEffectEnabled;
  if (body.backgroundEffectType !== undefined) {
    const t = body.backgroundEffectType;
    if (t !== 'none' && t !== 'dots_n8n') {
      return NextResponse.json({ success: false, error: 'Invalid backgroundEffectType' }, { status: 400 });
    }
    patch.background_effect_type = t;
  }

  // Theme foundation (Phase 1): project-wide colors/effect settings + provenance.
  if (body.projectBackgroundColor !== undefined) {
    patch.project_background_color = String(body.projectBackgroundColor || '').trim() || '#ffffff';
  }
  if (body.projectTextColor !== undefined) {
    patch.project_text_color = String(body.projectTextColor || '').trim() || '#000000';
  }
  if (body.backgroundEffectSettings !== undefined) {
    // Keep permissive at API layer; client owns schema. Must be JSON-serializable.
    patch.background_effect_settings = body.backgroundEffectSettings ?? {};
  }
  if (body.themeIdLastApplied !== undefined) {
    patch.theme_id_last_applied = body.themeIdLastApplied === null ? null : String(body.themeIdLastApplied || '').trim() || null;
  }
  if (typeof body.themeIsCustomized === 'boolean') {
    patch.theme_is_customized = body.themeIsCustomized;
  }
  if (body.themeDefaultsSnapshot !== undefined) {
    patch.theme_defaults_snapshot = body.themeDefaultsSnapshot ?? null;
  }
  if (body.lastManualBackgroundColor !== undefined) {
    patch.last_manual_background_color =
      body.lastManualBackgroundColor === null ? null : String(body.lastManualBackgroundColor || '').trim() || null;
  }
  if (body.lastManualTextColor !== undefined) {
    patch.last_manual_text_color = body.lastManualTextColor === null ? null : String(body.lastManualTextColor || '').trim() || null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('carousel_projects')
    .update(patch)
    .eq('id', body.projectId)
    .eq('owner_user_id', user.id)
    .select(
      [
        'id',
        'title',
        'caption',
        'template_type_id',
        'background_effect_enabled',
        'background_effect_type',
        'project_background_color',
        'project_text_color',
        'background_effect_settings',
        'theme_id_last_applied',
        'theme_is_customized',
        'theme_defaults_snapshot',
        'last_manual_background_color',
        'last_manual_text_color',
        'updated_at',
      ].join(', ')
    )
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, project: data });
}


