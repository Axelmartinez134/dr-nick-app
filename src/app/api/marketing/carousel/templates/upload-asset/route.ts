import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

interface UploadTemplateAssetResponse {
  success: boolean;
  bucket?: 'carousel-templates';
  path?: string;
  url?: string;
  contentType?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  // AUTH CHECK (admin-only)
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as UploadTemplateAssetResponse, { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Server configuration error' } as UploadTemplateAssetResponse, { status: 500 });
  }

  const verificationClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user }, error: userError } = await verificationClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as UploadTemplateAssetResponse, { status: 401 });
  }
  if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return NextResponse.json({ success: false, error: 'Forbidden - Admin access required' } as UploadTemplateAssetResponse, { status: 403 });
  }

  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } as UploadTemplateAssetResponse, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const templateId = String(form.get('templateId') || '');
  const assetId = String(form.get('assetId') || '');
  if (!file || !templateId || !assetId) {
    return NextResponse.json({ success: false, error: 'Missing file, templateId, or assetId' } as UploadTemplateAssetResponse, { status: 400 });
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const allowed = ['png', 'webp', 'jpg', 'jpeg', 'svg'];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ success: false, error: 'Unsupported file type' } as UploadTemplateAssetResponse, { status: 400 });
  }

  const contentType =
    ext === 'png' ? 'image/png' :
    ext === 'webp' ? 'image/webp' :
    ext === 'svg' ? 'image/svg+xml' :
    'image/jpeg';

  const buffer = Buffer.from(await file.arrayBuffer());
  const bucket = 'carousel-templates' as const;
  const path = `carousel-templates/${templateId}/assets/${assetId}.${ext}`.replace(/^\/+/, '');

  // NOTE: Supabase Storage "path" is within the bucket, so do NOT include the bucket name twice.
  const objectPath = `${templateId}/assets/${assetId}.${ext}`;

  // If the bucket doesn't exist (common local setup issue), return a high-signal error.
  try {
    const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
    if (!bucketsErr && Array.isArray(buckets)) {
      const names = buckets.map((b: any) => b?.name).filter(Boolean);
      if (!names.includes(bucket)) {
        const urlUsed = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'unknown';
        return NextResponse.json(
          {
            success: false,
            error: `Bucket not found: "${bucket}". Buckets visible to service role: ${names.join(', ') || '(none)'} . Supabase URL: ${urlUsed}. Create a PUBLIC bucket named "${bucket}" in this Supabase project.`,
          } as UploadTemplateAssetResponse,
          { status: 400 }
        );
      }
    }
  } catch {
    // ignore; upload will still produce a useful error
  }

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, { contentType, upsert: true });

  if (upErr) {
    return NextResponse.json({ success: false, error: upErr.message } as UploadTemplateAssetResponse, { status: 400 });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return NextResponse.json({
    success: true,
    bucket,
    path: objectPath,
    url: data.publicUrl,
    contentType,
  } as UploadTemplateAssetResponse);
}


