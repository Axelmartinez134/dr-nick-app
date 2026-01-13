import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

type UploadResponse = {
  success: boolean;
  bucket?: typeof BUCKET;
  path?: string;
  url?: string;
  contentType?: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error } as UploadResponse, { status: authed.status });
  }
  const { supabase, user } = authed;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const projectId = String(form.get('projectId') || '');
  const slideIndexRaw = String(form.get('slideIndex') || '');
  const slideIndex = Number(slideIndexRaw);
  if (!file || !projectId || !Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
    return NextResponse.json(
      { success: false, error: 'Missing file, projectId, or slideIndex (0..5)' } as UploadResponse,
      { status: 400 }
    );
  }

  // Ownership check via RLS + explicit filter.
  const { data: project, error: projErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id')
    .eq('id', projectId)
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (projErr || !project?.id) {
    return NextResponse.json({ success: false, error: 'Project not found' } as UploadResponse, { status: 404 });
  }

  // Validate file type / size
  const allowed = new Set(['png', 'webp', 'jpg', 'jpeg']);
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!allowed.has(ext)) {
    return NextResponse.json({ success: false, error: 'Unsupported file type (jpg/jpeg/png/webp only)' } as UploadResponse, {
      status: 400,
    });
  }
  // 10MB limit
  if ((file as any).size && Number((file as any).size) > 10 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'File too large (max 10MB)' } as UploadResponse, { status: 400 });
  }

  const contentType =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json(
      { success: false, error: 'Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)' } as UploadResponse,
      { status: 500 }
    );
  }

  // Ensure bucket exists (high-signal error if not).
  try {
    const { data: buckets, error: bucketsErr } = await svc.storage.listBuckets();
    if (!bucketsErr && Array.isArray(buckets)) {
      const names = buckets.map((b: any) => b?.name).filter(Boolean);
      if (!names.includes(BUCKET)) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Bucket not found: "${BUCKET}". Create a PUBLIC bucket named "${BUCKET}" ` +
              `in this Supabase project, then retry.`,
          } as UploadResponse,
          { status: 400 }
        );
      }
    }
  } catch {
    // ignore; upload will still error meaningfully
  }

  // Stable per-slide path; replace via upsert.
  const objectPath = `projects/${projectId}/slides/${slideIndex}/image.${ext}`.replace(/^\/+/, '');
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await svc.storage.from(BUCKET).upload(objectPath, buffer, { contentType, upsert: true });
  if (upErr) {
    return NextResponse.json({ success: false, error: upErr.message } as UploadResponse, { status: 400 });
  }

  const { data } = svc.storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({
    success: true,
    bucket: BUCKET,
    path: objectPath,
    url: data.publicUrl,
    contentType,
  } as UploadResponse);
}

