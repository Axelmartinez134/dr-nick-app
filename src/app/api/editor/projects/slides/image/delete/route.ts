import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const BUCKET = 'carousel-project-images' as const;

type Body = {
  projectId: string;
  slideIndex: number;
  path?: string;
};

type DeleteResponse = { success: boolean; error?: string };

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error } as DeleteResponse, { status: authed.status });
  }
  const { supabase, user } = authed;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } as DeleteResponse, { status: 400 });
  }

  const projectId = String(body.projectId || '');
  const slideIndex = Number(body.slideIndex);
  if (!projectId || !Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
    return NextResponse.json({ success: false, error: 'projectId and slideIndex (0..5) are required' } as DeleteResponse, {
      status: 400,
    });
  }

  // Ownership check
  const { data: project, error: projErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id')
    .eq('id', projectId)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (projErr || !project?.id) {
    return NextResponse.json({ success: false, error: 'Project not found' } as DeleteResponse, { status: 404 });
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json(
      { success: false, error: 'Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)' } as DeleteResponse,
      { status: 500 }
    );
  }

  // Prefer explicit path (from stored metadata). Fallback to known prefixes (best-effort).
  const path = String(body.path || '').trim();
  const candidates = path
    ? [path]
    : [
        `projects/${projectId}/slides/${slideIndex}/image.png`,
        `projects/${projectId}/slides/${slideIndex}/image.webp`,
        `projects/${projectId}/slides/${slideIndex}/image.jpg`,
        `projects/${projectId}/slides/${slideIndex}/image.jpeg`,
      ];

  const { error: rmErr } = await svc.storage.from(BUCKET).remove(candidates);
  // Supabase remove returns error if none found in some cases; treat as best-effort.
  if (rmErr) {
    return NextResponse.json({ success: false, error: rmErr.message } as DeleteResponse, { status: 400 });
  }

  return NextResponse.json({ success: true } as DeleteResponse);
}

