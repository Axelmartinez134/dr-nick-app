import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

type Body = {
  projectId: string;
  slideIndex: number;
  headline?: string | null;
  body?: string | null;
  layoutSnapshot?: any | null;
  inputSnapshot?: any | null;
  aiImagePrompt?: string | null;
};

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase } = authed;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 });
  if (!Number.isInteger(body.slideIndex) || body.slideIndex < 0 || body.slideIndex > 5) {
    return NextResponse.json({ success: false, error: 'slideIndex must be 0..5' }, { status: 400 });
  }

  // If we're updating `input_snapshot`, merge the nested `editor` object with what's already stored.
  // This prevents feature flags (e.g. layoutLocked, autoRealignOnImageRelease) from being wiped by
  // other save paths that send an inputSnapshot without those fields.
  let mergedInputSnapshot: any | null | undefined = undefined;
  if (body.inputSnapshot !== undefined && body.inputSnapshot !== null && typeof body.inputSnapshot === 'object') {
    try {
      const existing = await supabase
        .from('carousel_project_slides')
        .select('input_snapshot')
        .eq('project_id', body.projectId)
        .eq('slide_index', body.slideIndex)
        .maybeSingle();
      if (!existing.error) {
        const prev = (existing.data as any)?.input_snapshot;
        const prevEditor = (prev && typeof prev === 'object' && (prev as any).editor && typeof (prev as any).editor === 'object')
          ? (prev as any).editor
          : {};
        const next = body.inputSnapshot as any;
        const nextEditor = (next && typeof next === 'object' && (next as any).editor && typeof (next as any).editor === 'object')
          ? (next as any).editor
          : {};
        mergedInputSnapshot = {
          ...(prev && typeof prev === 'object' ? prev : {}),
          ...(next && typeof next === 'object' ? next : {}),
          editor: { ...prevEditor, ...nextEditor },
        };
      }
    } catch {
      // If merge fails, fall back to raw inputSnapshot (old behavior).
    }
  }

  const patch: any = {};
  if (body.headline !== undefined) patch.headline = body.headline;
  if (body.body !== undefined) patch.body = body.body;
  if (body.layoutSnapshot !== undefined) patch.layout_snapshot = body.layoutSnapshot;
  if (body.inputSnapshot !== undefined) patch.input_snapshot = mergedInputSnapshot !== undefined ? mergedInputSnapshot : body.inputSnapshot;
  if (body.aiImagePrompt !== undefined) patch.ai_image_prompt = body.aiImagePrompt;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('carousel_project_slides')
    .update(patch)
    .eq('project_id', body.projectId)
    .eq('slide_index', body.slideIndex)
    .select('id, project_id, slide_index, headline, body, layout_snapshot, input_snapshot, ai_image_prompt, updated_at')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, slide: data });
}


