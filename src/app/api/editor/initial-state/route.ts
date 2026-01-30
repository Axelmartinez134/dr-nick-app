import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import type { CarouselTemplateDefinitionV1 } from '@/lib/carousel-template-types';
import { getAuthedSupabase, resolveActiveAccountId } from '../_utils';
import { loadEffectiveTemplateTypeSettings } from '../projects/_effective';

export const runtime = 'nodejs';
export const maxDuration = 10;

type TemplateTypeId = 'regular' | 'enhanced';

function starterTemplateDefinition(): CarouselTemplateDefinitionV1 {
  return {
    template_version: 1,
    slides: [
      {
        slideIndex: 0,
        contentRegion: { x: 0, y: 0, width: 1080, height: 1440 },
        assets: [],
      },
    ],
    allowedFonts: [
      'Inter',
      'Poppins',
      'Montserrat',
      'Playfair Display',
      'Open Sans',
      'Noto Serif',
      'Droid Serif',
      'Noto Serif Condensed',
    ],
  };
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  // Phase D: /editor boot is gated by account membership (Phase C). We treat editor_users as optional here.
  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  // Phase E: per-account editor settings (shared within account).
  const { data: settingsRow } = await supabase
    .from('editor_account_settings')
    .select('ai_image_gen_model')
    .eq('account_id', accountId)
    .maybeSingle();
  // Backwards-safe: legacy per-user source if account settings row is missing.
  const { data: editorRow } = await supabase
    .from('editor_users')
    .select('ai_image_gen_model')
    .eq('user_id', user.id)
    .maybeSingle();
  const aiImageGenModel =
    String((settingsRow as any)?.ai_image_gen_model || '').trim() ||
    String((editorRow as any)?.ai_image_gen_model || '').trim() ||
    'gpt-image-1.5';

  let templateTypeId: TemplateTypeId = 'regular';
  try {
    const body = (await req.json().catch(() => null)) as any;
    const raw = String(body?.templateTypeId || '').trim();
    if (raw === 'enhanced' || raw === 'regular') templateTypeId = raw;
  } catch {
    // ignore
  }

  // Load templates + projects in parallel (owner-only). If templates are empty, bootstrap a starter template.
  let bootstrapCreated = false;
  let starterTemplateId: string | null = null;

  // Backwards-safe: patch any legacy projects created after Phase B without account_id into the user's Personal account.
  await supabase.from('carousel_projects').update({ account_id: accountId }).eq('owner_user_id', user.id).is('account_id', null);

  const [templatesRes, projectsRes] = await Promise.all([
    supabase
      .from('carousel_templates')
      .select('id, name, updated_at')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('carousel_projects')
      .select('id, title, template_type_id, caption, updated_at, created_at')
      .eq('account_id', accountId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
  ]);

  if (templatesRes.error) {
    return NextResponse.json({ success: false, error: templatesRes.error.message }, { status: 500 });
  }
  if (projectsRes.error) {
    return NextResponse.json({ success: false, error: projectsRes.error.message }, { status: 500 });
  }

  let templatesOut: Array<{ id: string; name: string; updated_at: string }> = (templatesRes.data || []) as any;
  const projects = projectsRes.data || [];

  if (templatesOut.length === 0) {
    const def = starterTemplateDefinition();
    const { data: inserted, error: insErr } = await supabase
      .from('carousel_templates')
      .insert({ name: 'Starter Template', owner_user_id: user.id, account_id: accountId, definition: def as any })
      .select('id, name, updated_at')
      .single();
    if (insErr || !inserted?.id) {
      return NextResponse.json(
        { success: false, error: insErr?.message || 'Failed to create starter template' },
        { status: 500 }
      );
    }
    bootstrapCreated = true;
    starterTemplateId = String(inserted.id);
    templatesOut = [inserted as any];

    await supabase
      .from('carousel_template_type_overrides')
      .upsert(
        [
          {
            account_id: accountId,
            user_id: user.id,
            template_type_id: 'regular',
            slide1_template_id_override: starterTemplateId,
            slide2_5_template_id_override: starterTemplateId,
            slide6_template_id_override: starterTemplateId,
          },
          {
            account_id: accountId,
            user_id: user.id,
            template_type_id: 'enhanced',
            slide1_template_id_override: starterTemplateId,
            slide2_5_template_id_override: starterTemplateId,
            slide6_template_id_override: starterTemplateId,
          },
        ],
        { onConflict: 'account_id,template_type_id' }
      );
  }

  // Load effective settings for current template type (defaults + per-account overrides).
  const { defaults, override, effective } = await loadEffectiveTemplateTypeSettings(supabase, { accountId, actorUserId: user.id }, templateTypeId);

  // Preload mapped template definitions (slide 1 / 2-5 / 6).
  const ids = [effective.slide1TemplateId, effective.slide2to5TemplateId, effective.slide6TemplateId].filter(Boolean) as string[];
  const uniq = Array.from(new Set(ids));
  const templateSnapshotsById: Record<string, any> = {};
  if (uniq.length > 0) {
    const { data: defs } = await supabase
      .from('carousel_templates')
      .select('id, definition')
      .in('id', uniq)
      .eq('account_id', accountId);
    (defs || []).forEach((r: any) => {
      if (r?.id) templateSnapshotsById[String(r.id)] = r.definition;
    });
  }

  return NextResponse.json({
    success: true,
    bootstrap: { created: bootstrapCreated, starterTemplateId },
    templateTypeId,
    editorUser: {
      aiImageGenModel,
    },
    templates: (templatesOut || []).map((t: any) => ({ id: t.id, name: t.name, updatedAt: t.updated_at })),
    projects: projects || [],
    templateType: { defaults, override, effective },
    templateSnapshotsById,
  });
}

