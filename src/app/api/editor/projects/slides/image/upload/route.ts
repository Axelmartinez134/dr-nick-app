import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase } from '../../../../_utils';
import { computeAlphaMask128FromPngBytes, pngHasAnyTransparency } from '../_mask';
import { resolveActiveAccountId } from '../../../../_utils';

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
  mask?: { w: number; h: number; dataB64: string; alphaThreshold: number };
  bgRemovalEnabled?: boolean;
  bgRemovalStatus?: 'disabled' | 'processing' | 'succeeded' | 'failed' | 'skipped-alpha';
  original?: { bucket: typeof BUCKET; path: string; url: string; contentType: string };
  processed?: { bucket: typeof BUCKET; path: string; url: string; contentType: string };
  error?: string;
};

function withVersion(url: string, v: string) {
  if (!url) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}`;
}

function solidMask128(alphaThreshold = 0): NonNullable<UploadResponse['mask']> {
  const w = 128;
  const h = 128;
  // 1 byte per pixel, any non-zero is treated as "solid" by the client overlay renderer.
  const u8 = new Uint8Array(w * h);
  u8.fill(255);
  const dataB64 = Buffer.from(u8).toString('base64');
  return { w, h, dataB64, alphaThreshold };
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error } as UploadResponse, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error } as UploadResponse, { status: acct.status });
  const accountId = acct.accountId;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const projectId = String(form.get('projectId') || '');
  const slideIndexRaw = String(form.get('slideIndex') || '');
  const slideIndex = Number(slideIndexRaw);
  const bgRemovalEnabled = String(form.get('bgRemovalEnabled') || '1') !== '0';
  if (!file || !projectId || !Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
    return NextResponse.json(
      { success: false, error: 'Missing file, projectId, or slideIndex (0..5)' } as UploadResponse,
      { status: 400 }
    );
  }

  // Account-scoped project access check.
  const { data: project, error: projErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id, account_id')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (projErr || !project?.id) {
    return NextResponse.json({ success: false, error: 'Project not found' } as UploadResponse, { status: 404 });
  }

  // Backwards-safe: patch legacy null account_id (owned by caller) so it doesn't disappear later.
  if (!(project as any)?.account_id) {
    await supabase.from('carousel_projects').update({ account_id: accountId }).eq('id', projectId).eq('owner_user_id', user.id);
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

  // Multi-image Phase 1 guardrail:
  // Avoid per-slide fixed paths (which would overwrite an existing primary image when uploading a sticker).
  // Store each upload under a unique subdirectory so multiple uploads can coexist.
  const uploadId = (() => {
    try {
      const v = (globalThis as any)?.crypto?.randomUUID?.();
      if (v) return String(v);
    } catch {
      // ignore
    }
    return `upl_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  })();

  // Phase H (optional): prefix storage paths by account to keep assets naturally partitioned.
  // This is not required for correctness (RLS already enforces access), but helps future maintenance.
  const baseDir = `accounts/${accountId}/projects/${projectId}/slides/${slideIndex}/images/${uploadId}`.replace(/^\/+/, '');
  const activePath = `${baseDir}/active.${ext}`;
  const originalPath = `${baseDir}/original.${ext}`;
  const processedPath = `${baseDir}/processed.png`; // active when bg removal succeeds

  const buffer = Buffer.from(await file.arrayBuffer());

  // Always store original for retries (Phase 3 requirement).
  const { error: upOrigErr } = await svc.storage.from(BUCKET).upload(originalPath, buffer, { contentType, upsert: false });
  if (upOrigErr) {
    return NextResponse.json({ success: false, error: upOrigErr.message } as UploadResponse, { status: 400 });
  }
  const { data: origUrl } = svc.storage.from(BUCKET).getPublicUrl(originalPath);
  const v = String(Date.now());
  const original = { bucket: BUCKET, path: originalPath, url: withVersion(origUrl.publicUrl, v), contentType };

  // Default: active is the original upload (rectangle wrapping; toggle OFF path).
  let outPath = activePath;
  let outContentType = contentType;
  let outBytes: Uint8Array | null = null;
  // Per spec: always provide a mask so overlays can visualize wrap behavior.
  // If we cannot compute a real alpha silhouette, fall back to a solid rectangular mask.
  let outMask: UploadResponse['mask'] | undefined = solidMask128(0);
  let status: UploadResponse['bgRemovalStatus'] = bgRemovalEnabled ? 'processing' : 'disabled';
  let processed: UploadResponse['processed'] | undefined = undefined;

  const apiKey = String(process.env.REMOVEBG_API_KEY || '').trim();

  try {
    if (!bgRemovalEnabled) {
      // Store active as-is for compatibility.
      const { error: upActiveErr } = await svc.storage.from(BUCKET).upload(activePath, buffer, { contentType, upsert: false });
      if (upActiveErr) throw new Error(upActiveErr.message);
      status = 'disabled';
    } else {
      // Token-saver: if PNG already has transparency, skip API and compute mask server-side from original bytes.
      // NOTE: For webp we do not have a server decoder; we intentionally do NOT skip there.
      const canSkip = ext === 'png' && pngHasAnyTransparency(new Uint8Array(buffer));
      if (canSkip) {
        outPath = activePath;
        outContentType = contentType;
        outMask = computeAlphaMask128FromPngBytes(new Uint8Array(buffer), 32, 128, 128);
        // Ensure active object exists too.
        const { error: upActiveErr } = await svc.storage.from(BUCKET).upload(activePath, buffer, { contentType, upsert: false });
        if (upActiveErr) throw new Error(upActiveErr.message);
        status = 'skipped-alpha';
      } else {
        if (!apiKey) throw new Error('Server missing REMOVEBG_API_KEY');

        const upstream = new FormData();
        upstream.append('image_file', file);
        upstream.append('format', 'png');

        const r = await fetch('https://removebgapi.com/api/v1/remove', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });
        if (!r.ok) {
          throw new Error(`RemoveBG failed (${r.status})`);
        }

        const ab = await r.arrayBuffer();
        outBytes = new Uint8Array(ab);
        outMask = computeAlphaMask128FromPngBytes(outBytes, 32, 128, 128);

        // Upload processed PNG as the ACTIVE image.
        outPath = processedPath;
        outContentType = 'image/png';
        const { error: upProcErr } = await svc.storage.from(BUCKET).upload(processedPath, Buffer.from(outBytes), { contentType: 'image/png', upsert: false });
        if (upProcErr) throw new Error(upProcErr.message);
        const { data: procUrl } = svc.storage.from(BUCKET).getPublicUrl(processedPath);
        processed = { bucket: BUCKET, path: processedPath, url: withVersion(procUrl.publicUrl, v), contentType: 'image/png' };
        status = 'succeeded';
      }
    }
  } catch (e: any) {
    // Keep original visible if removal fails; still store active as the original upload.
    try {
      const { error: upActiveErr } = await svc.storage.from(BUCKET).upload(activePath, buffer, { contentType, upsert: false });
      if (upActiveErr) throw upActiveErr;
    } catch {
      // If even this fails, treat as fatal below.
      return NextResponse.json({ success: false, error: e?.message || 'Upload failed' } as UploadResponse, { status: 400 });
    }
    outPath = activePath;
    outContentType = contentType;
    status = bgRemovalEnabled ? 'failed' : 'disabled';
    // Keep fallback mask so overlays remain visual even after BG removal failure.
    outMask = outMask || solidMask128(0);
  }

  const { data } = svc.storage.from(BUCKET).getPublicUrl(outPath);
  return NextResponse.json({
    success: true,
    bucket: BUCKET,
    path: outPath,
    url: withVersion(data.publicUrl, v),
    contentType: outContentType,
    bgRemovalEnabled,
    bgRemovalStatus: status,
    ...(outMask ? { mask: outMask } : {}),
    original,
    ...(processed ? { processed } : {}),
  } as UploadResponse);
}

