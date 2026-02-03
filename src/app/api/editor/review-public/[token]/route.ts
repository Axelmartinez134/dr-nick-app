import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { resolveAccountIdFromReviewToken, serviceClient } from '../_utils';

export const runtime = 'nodejs';
export const maxDuration = 20;

type Resp =
  | {
      success: true;
      projects: Array<{
        id: string;
        title: string;
        updated_at: string;
        caption: string;
        template_type_id: string;
        slide1_template_id_snapshot: string | null;
        slide2_5_template_id_snapshot: string | null;
        slide6_template_id_snapshot: string | null;
        project_background_color: string;
        project_text_color: string;
        background_effect_enabled: boolean;
        background_effect_type: 'none' | 'dots_n8n';
        background_effect_settings: any;
        review_ready: boolean;
        review_posted: boolean;
        review_approved: boolean;
        review_scheduled: boolean;
        review_comment: string;
        slides: Array<{
          slide_index: number;
          headline: string;
          body: string;
          layout_snapshot: any;
          input_snapshot: any;
          ai_image_prompt: string;
          updated_at: string;
        }>;
      }>;
      templateSnapshotsById: Record<string, any>;
    }
  | { success: false; error: string };

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)' } satisfies Resp,
      { status: 500 }
    );
  }

  const accountId = await resolveAccountIdFromReviewToken(admin, token);
  if (!accountId) return NextResponse.json({ success: false, error: 'Not found' } satisfies Resp, { status: 404 });

  // Queue rule (MVP): Ready=true AND Posted=false (scheduled does NOT remove from queue).
  const { data: projRows, error: projErr } = await admin
    .from('carousel_projects')
    .select(
      [
        'id',
        'title',
        'updated_at',
        'caption',
        'template_type_id',
        'slide1_template_id_snapshot',
        'slide2_5_template_id_snapshot',
        'slide6_template_id_snapshot',
        'project_background_color',
        'project_text_color',
        'background_effect_enabled',
        'background_effect_type',
        'background_effect_settings',
        'review_ready',
        'review_posted',
        'review_approved',
        'review_scheduled',
        'review_comment',
      ].join(', ')
    )
    .eq('account_id', accountId)
    .is('archived_at', null)
    .eq('review_ready', true)
    .eq('review_posted', false)
    .order('updated_at', { ascending: false })
    .limit(40);

  if (projErr) return NextResponse.json({ success: false, error: projErr.message } satisfies Resp, { status: 500 });

  const projectsRaw = Array.isArray(projRows) ? (projRows as any[]) : [];
  const projectIds = projectsRaw.map((p) => String(p?.id || '').trim()).filter(Boolean);

  // Fetch slides in one round-trip.
  const slidesByProject: Record<string, any[]> = {};
  if (projectIds.length > 0) {
    const { data: slideRows, error: slideErr } = await admin
      .from('carousel_project_slides')
      .select('project_id, slide_index, headline, body, layout_snapshot, input_snapshot, ai_image_prompt, updated_at')
      .in('project_id', projectIds)
      .order('slide_index', { ascending: true });

    if (slideErr) return NextResponse.json({ success: false, error: slideErr.message } satisfies Resp, { status: 500 });

    (slideRows || []).forEach((r: any) => {
      const pid = String(r?.project_id || '').trim();
      if (!pid) return;
      if (!slidesByProject[pid]) slidesByProject[pid] = [];
      slidesByProject[pid].push(r);
    });
  }

  // Preload template definitions referenced by projects (slide 1 / 2-5 / 6 snapshots).
  const templateIds = new Set<string>();
  for (const p of projectsRaw) {
    const a = String(p?.slide1_template_id_snapshot || '').trim();
    const b = String(p?.slide2_5_template_id_snapshot || '').trim();
    const c = String(p?.slide6_template_id_snapshot || '').trim();
    if (a) templateIds.add(a);
    if (b) templateIds.add(b);
    if (c) templateIds.add(c);
  }
  const uniqTemplateIds = Array.from(templateIds);
  const templateSnapshotsById: Record<string, any> = {};
  if (uniqTemplateIds.length > 0) {
    const { data: defs, error: defErr } = await admin
      .from('carousel_templates')
      .select('id, definition')
      .in('id', uniqTemplateIds)
      .eq('account_id', accountId);
    if (defErr) return NextResponse.json({ success: false, error: defErr.message } satisfies Resp, { status: 500 });
    (defs || []).forEach((r: any) => {
      const id = String(r?.id || '').trim();
      if (!id) return;
      templateSnapshotsById[id] = r.definition;
    });
  }

  const projects = projectsRaw.map((p: any) => {
    const pid = String(p?.id || '').trim();
    const bgType: 'none' | 'dots_n8n' = String(p?.background_effect_type || 'none') === 'dots_n8n' ? 'dots_n8n' : 'none';
    const slidesRaw = Array.isArray(slidesByProject[pid]) ? slidesByProject[pid] : [];
    const slides = Array.from({ length: 6 }).map((_, i) => {
      const row = slidesRaw.find((r: any) => Number(r?.slide_index) === i) || null;
      return {
        slide_index: i,
        headline: String(row?.headline || ''),
        body: String(row?.body || ''),
        layout_snapshot: row?.layout_snapshot ?? null,
        input_snapshot: row?.input_snapshot ?? null,
        ai_image_prompt: String(row?.ai_image_prompt || ''),
        updated_at: String(row?.updated_at || ''),
      };
    });

    return {
      id: pid,
      title: String(p?.title || 'Untitled Project'),
      updated_at: String(p?.updated_at || ''),
      caption: String(p?.caption || ''),
      template_type_id: String(p?.template_type_id || 'regular'),
      slide1_template_id_snapshot: p?.slide1_template_id_snapshot ? String(p.slide1_template_id_snapshot) : null,
      slide2_5_template_id_snapshot: p?.slide2_5_template_id_snapshot ? String(p.slide2_5_template_id_snapshot) : null,
      slide6_template_id_snapshot: p?.slide6_template_id_snapshot ? String(p.slide6_template_id_snapshot) : null,
      project_background_color: String(p?.project_background_color || '#ffffff'),
      project_text_color: String(p?.project_text_color || '#000000'),
      background_effect_enabled: !!p?.background_effect_enabled,
      background_effect_type: bgType,
      background_effect_settings: p?.background_effect_settings ?? {},
      review_ready: !!p?.review_ready,
      review_posted: !!p?.review_posted,
      review_approved: !!p?.review_approved,
      review_scheduled: !!p?.review_scheduled,
      review_comment: String(p?.review_comment || ''),
      slides,
    };
  });

  return NextResponse.json({ success: true, projects, templateSnapshotsById } satisfies Resp);
}

