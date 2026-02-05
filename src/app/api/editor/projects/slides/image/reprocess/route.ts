import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedSupabase, resolveActiveAccountId } from '../../../../_utils';
import { computeAlphaMask128FromPngBytes, pngHasAnyTransparency } from '../_mask';

export const runtime = 'nodejs';
export const maxDuration = 90;

const BUCKET = 'carousel-project-images' as const;

function withVersion(url: string, v: string) {
  if (!url) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}`;
}

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

type Body = { projectId: string; slideIndex: number; path?: string };
type Resp =
  | {
      success: true;
      processed: { bucket: typeof BUCKET; path: string; url: string; contentType: string };
      original: { bucket: typeof BUCKET; path: string; url: string; contentType: string };
      bgRemovalStatus: 'succeeded' | 'skipped-alpha';
      mask: { w: number; h: number; dataB64: string; alphaThreshold: number };
    }
  | { success: false; error: string; statusCode?: number };

async function downloadFirstExisting(
  svc: ReturnType<typeof serviceClient>,
  candidates: Array<{ path: string; contentType: string; ext: string }>
): Promise<null | { path: string; contentType: string; ext: string; bytes: Uint8Array }> {
  for (const c of candidates) {
    const { data, error } = await svc!.storage.from(BUCKET).download(c.path);
    if (error || !data) continue;
    const ab = await data.arrayBuffer();
    return { ...c, bytes: new Uint8Array(ab) };
  }
  return null;
}

function candidateForPath(p: string): null | { path: string; contentType: string; ext: string } {
  const path = String(p || '').trim().replace(/^\/+/, '');
  if (!path) return null;
  const ext = (path.split('.').pop() || '').toLowerCase();
  if (ext !== 'png' && ext !== 'webp' && ext !== 'jpg' && ext !== 'jpeg') return null;
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { path, contentType, ext };
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error, statusCode: authed.status } satisfies Resp, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request: req, supabase, userId: user.id });
  if (!acct.ok) {
    return NextResponse.json({ success: false, error: acct.error, statusCode: acct.status } satisfies Resp, { status: acct.status });
  }
  const accountId = acct.accountId;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
  }

  const projectId = String(body.projectId || '');
  const slideIndex = Number(body.slideIndex);
  if (!projectId || !Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) {
    return NextResponse.json({ success: false, error: 'projectId and slideIndex (0..5) are required' } satisfies Resp, { status: 400 });
  }

  // Account-scoped project access check
  const { data: project, error: projErr } = await supabase
    .from('carousel_projects')
    .select('id, owner_user_id, account_id')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (projErr || !project?.id) {
    return NextResponse.json({ success: false, error: 'Project not found' } satisfies Resp, { status: 404 });
  }

  // Backwards-safe: patch legacy null account_id (owned by caller)
  if (!(project as any)?.account_id) {
    await supabase.from('carousel_projects').update({ account_id: accountId }).eq('id', projectId).eq('owner_user_id', user.id);
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ success: false, error: 'Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)' } satisfies Resp, { status: 500 });
  }

  const apiKey = String(process.env.REMOVEBG_API_KEY || '').trim();
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Server missing REMOVEBG_API_KEY' } satisfies Resp, { status: 500 });
  }

  // Phase H (optional): prefer account-prefixed storage paths.
  // IMPORTANT: keep legacy fallback candidates for pre-Phase-H paths.
  const baseDir = `accounts/${accountId}/projects/${projectId}/slides/${slideIndex}`.replace(/^\/+/, '');
  const legacyBaseDir = `projects/${projectId}/slides/${slideIndex}`.replace(/^\/+/, '');
  const processedPath = `${baseDir}/image.png`;
  const v = String(Date.now());

  // Prefer the stored original.* (Phase 3), but fall back to old image.* if needed.
  const explicit = candidateForPath((body as any)?.path);
  const found = await downloadFirstExisting(svc, [
    ...(explicit ? [explicit] : []),
    // Phase H paths (account-prefixed)
    { path: `${baseDir}/original.png`, contentType: 'image/png', ext: 'png' },
    { path: `${baseDir}/original.webp`, contentType: 'image/webp', ext: 'webp' },
    { path: `${baseDir}/original.jpg`, contentType: 'image/jpeg', ext: 'jpg' },
    { path: `${baseDir}/original.jpeg`, contentType: 'image/jpeg', ext: 'jpeg' },
    { path: `${baseDir}/image.png`, contentType: 'image/png', ext: 'png' },
    { path: `${baseDir}/image.webp`, contentType: 'image/webp', ext: 'webp' },
    { path: `${baseDir}/image.jpg`, contentType: 'image/jpeg', ext: 'jpg' },
    { path: `${baseDir}/image.jpeg`, contentType: 'image/jpeg', ext: 'jpeg' },
    // Legacy paths (pre-Phase-H)
    { path: `${legacyBaseDir}/original.png`, contentType: 'image/png', ext: 'png' },
    { path: `${legacyBaseDir}/original.webp`, contentType: 'image/webp', ext: 'webp' },
    { path: `${legacyBaseDir}/original.jpg`, contentType: 'image/jpeg', ext: 'jpg' },
    { path: `${legacyBaseDir}/original.jpeg`, contentType: 'image/jpeg', ext: 'jpeg' },
    { path: `${legacyBaseDir}/image.png`, contentType: 'image/png', ext: 'png' },
    { path: `${legacyBaseDir}/image.webp`, contentType: 'image/webp', ext: 'webp' },
    { path: `${legacyBaseDir}/image.jpg`, contentType: 'image/jpeg', ext: 'jpg' },
    { path: `${legacyBaseDir}/image.jpeg`, contentType: 'image/jpeg', ext: 'jpeg' },
  ]);

  if (!found) {
    return NextResponse.json({ success: false, error: 'No source image found for this slide' } satisfies Resp, { status: 404 });
  }

  const originalUrl = withVersion(svc.storage.from(BUCKET).getPublicUrl(found.path).data.publicUrl, v);
  const original = { bucket: BUCKET, path: found.path, url: originalUrl, contentType: found.contentType };

  // Token-saver: if the original is PNG with transparency, skip removebg and compute mask from original bytes.
  const canSkip = found.ext === 'png' && pngHasAnyTransparency(found.bytes);

  let processedBytes: Uint8Array;
  let status: 'succeeded' | 'skipped-alpha';
  if (canSkip) {
    processedBytes = found.bytes;
    status = 'skipped-alpha';
  } else {
    // Call removebgapi.com with the source bytes.
    const upstream = new FormData();
    // Node 20 provides File.
    const f = new File([found.bytes], `image.${found.ext}`, { type: found.contentType });
    // Poof API compatibility: send both `image_file` and `file`.
    upstream.append('image_file', f);
    upstream.append('file', f);
    upstream.append('format', 'png');

    const r = await fetch('https://api.poof.bg/v1/remove', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: upstream,
    });
    try {
      if (r.redirected || (r.status >= 300 && r.status < 400)) {
        console.warn('[reprocess][removebg] upstream redirect/status', {
          status: r.status,
          redirected: r.redirected,
          url: r.url,
          location: r.headers.get('location'),
        });
      }
    } catch {
      // ignore
    }
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return NextResponse.json(
        {
          success: false,
          error: `RemoveBG failed (${r.status})${errText ? `: ${errText.slice(0, 300)}` : ''}`,
          statusCode: r.status,
        } satisfies Resp,
        { status: 400 }
      );
    }
    const ab = await r.arrayBuffer();
    processedBytes = new Uint8Array(ab);
    status = 'succeeded';
  }

  const mask = computeAlphaMask128FromPngBytes(processedBytes, 32, 128, 128);

  const { error: upErr } = await svc.storage.from(BUCKET).upload(processedPath, Buffer.from(processedBytes), { contentType: 'image/png', upsert: true });
  if (upErr) {
    return NextResponse.json({ success: false, error: upErr.message } satisfies Resp, { status: 400 });
  }

  const processedUrl = withVersion(svc.storage.from(BUCKET).getPublicUrl(processedPath).data.publicUrl, v);
  return NextResponse.json({
    success: true,
    original,
    processed: { bucket: BUCKET, path: processedPath, url: processedUrl, contentType: 'image/png' },
    bgRemovalStatus: status,
    mask,
  } satisfies Resp);
}

