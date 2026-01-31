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
  // AUTH CHECK (editor users)
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as UploadTemplateAssetResponse, { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ success: false, error: 'Server configuration error' } as UploadTemplateAssetResponse, { status: 500 });
  }

  const authedClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await authedClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as UploadTemplateAssetResponse, { status: 401 });
  }

  // Must be an editor user (RLS on editor_users allows select self).
  const { data: editorRow, error: editorErr } = await authedClient
    .from('editor_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (editorErr || !editorRow?.user_id) {
    return NextResponse.json({ success: false, error: 'Forbidden - Editor access required' } as UploadTemplateAssetResponse, { status: 403 });
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

  const accountHeader = String(req.headers.get('x-account-id') || '').trim();

  if (accountHeader) {
    // Account-scoped: only account owner/admin can upload template assets.
    const { data: mem, error: memErr } = await authedClient
      .from('editor_account_memberships')
      .select('role')
      .eq('account_id', accountHeader)
      .eq('user_id', user.id)
      .maybeSingle();
    if (memErr) {
      return NextResponse.json({ success: false, error: memErr.message } as UploadTemplateAssetResponse, { status: 500 });
    }
    const role = String((mem as any)?.role || '');
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' } as UploadTemplateAssetResponse, { status: 403 });
    }

    const { data: tpl, error: tplErr } = await supabase
      .from('carousel_templates')
      .select('id, account_id')
      .eq('id', templateId)
      .eq('account_id', accountHeader)
      .maybeSingle();
    if (tplErr || !tpl?.id) {
      return NextResponse.json({ success: false, error: 'Template not found' } as UploadTemplateAssetResponse, { status: 404 });
    }
  } else {
    // Legacy: templates are user-private.
    const { data: tpl, error: tplErr } = await supabase
      .from('carousel_templates')
      .select('id, owner_user_id')
      .eq('id', templateId)
      .maybeSingle();
    if (tplErr || !tpl?.id) {
      return NextResponse.json({ success: false, error: 'Template not found' } as UploadTemplateAssetResponse, { status: 404 });
    }
    if (String((tpl as any).owner_user_id || '') !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' } as UploadTemplateAssetResponse, { status: 403 });
    }
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


