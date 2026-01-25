import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { getAuthedSupabase } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'editor-shared-assets' as const;

type Resp =
  | {
      success: true;
      cached: boolean;
      asset: {
        id: string;
        source: string;
        sourceKey: string;
        variantKey: string;
        bucket: typeof BUCKET;
        path: string;
        url: string;
        contentType: 'image/png';
        width: number | null;
        height: number | null;
        sha256: string;
      };
    }
  | { success: false; error: string; statusCode?: number };

function safeString(v: any) {
  return String(v ?? '').trim();
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

function sanitizePathPart(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180);
}

function withVersion(url: string, v: string) {
  if (!url) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}`;
}

function sha256Hex(bytes: Uint8Array) {
  return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

export async function POST(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error, statusCode: authed.status } satisfies Resp, { status: authed.status });
  }
  const { supabase, user } = authed;

  // Allowlist: must be an editor user.
  const { data: eu, error: euErr } = await supabase
    .from('editor_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (euErr) {
    return NextResponse.json({ success: false, error: euErr.message } satisfies Resp, { status: 500 });
  }
  if (!eu?.user_id) {
    return NextResponse.json({ success: false, error: 'Access denied' } satisfies Resp, { status: 403 });
  }

  let body: any = {};
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' } satisfies Resp, { status: 400 });
  }

  const source = safeString(body?.source || 'vectorlogozone').toLowerCase();
  const sourceKey = safeString(body?.sourceKey || body?.source_key || '');
  const variantKey = safeString(body?.variantKey || body?.variant_key || '');
  const remoteUrl = safeString(body?.remoteUrl || body?.remote_url || '');

  if (!source || !sourceKey || !variantKey || !remoteUrl) {
    return NextResponse.json({ success: false, error: 'Missing source/sourceKey/variantKey/remoteUrl' } satisfies Resp, { status: 400 });
  }

  // Supported providers
  if (
    source !== 'vectorlogozone' &&
    source !== 'lobe-icons' &&
    source !== 'developer-icons' &&
    source !== 'svgporn' &&
    source !== 'gilbarbara' &&
    source !== 'simple-icons'
  ) {
    return NextResponse.json({ success: false, error: 'Unsupported logo source' } satisfies Resp, { status: 400 });
  }

  // If already cached, return it (shared across all editor users).
  const { data: existing, error: exErr } = await supabase
    .from('editor_logo_assets')
    .select('id, source, source_key, variant_key, storage_bucket, storage_path, public_url, content_type, width, height, sha256')
    .eq('source', source)
    .eq('source_key', sourceKey)
    .eq('variant_key', variantKey)
    .maybeSingle();
  if (exErr) return NextResponse.json({ success: false, error: exErr.message } satisfies Resp, { status: 500 });
  if (existing?.id && existing?.public_url) {
    return NextResponse.json({
      success: true,
      cached: true,
      asset: {
        id: String(existing.id),
        source,
        sourceKey,
        variantKey,
        bucket: BUCKET,
        path: String(existing.storage_path || ''),
        url: withVersion(String(existing.public_url || ''), String(Date.now())),
        contentType: 'image/png',
        width: typeof existing.width === 'number' ? existing.width : null,
        height: typeof existing.height === 'number' ? existing.height : null,
        sha256: String(existing.sha256 || ''),
      },
    } satisfies Resp);
  }

  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ success: false, error: 'Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)' } satisfies Resp, {
      status: 500,
    });
  }

  // Download SVG.
  const r = await fetch(remoteUrl, { method: 'GET' });
  if (!r.ok) {
    return NextResponse.json({ success: false, error: `Failed to download source asset (${r.status})`, statusCode: r.status } satisfies Resp, {
      status: 400,
    });
  }
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  // raw.githubusercontent.com sometimes returns text/plain; accept if URL ends with .svg.
  if (!remoteUrl.toLowerCase().endsWith('.svg') && !ct.includes('svg')) {
    return NextResponse.json({ success: false, error: 'Only SVG variants are supported in Phase 3D' } satisfies Resp, { status: 400 });
  }
  const ab = await r.arrayBuffer();
  const svgBytes = new Uint8Array(ab);

  // Convert SVG -> PNG. Keep it reasonably large so later inserts can scale without pixelation.
  // We render at higher density and then clamp to max dimension.
  const MAX_DIM = 1400;
  const pngBuf = await sharp(Buffer.from(svgBytes), { density: 300 })
    .png()
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
    .toBuffer();
  const pngBytes = new Uint8Array(pngBuf);
  const meta = await sharp(pngBuf).metadata();
  const sha = sha256Hex(pngBytes);

  const safeSourceKey = sanitizePathPart(sourceKey);
  const safeVariantKey = sanitizePathPart(variantKey);
  const storagePath = `logos/${sanitizePathPart(source)}/${safeSourceKey}/${safeVariantKey}.png`;
  const v = String(Date.now());

  const { error: upErr } = await svc.storage.from(BUCKET).upload(storagePath, pngBuf, { contentType: 'image/png', upsert: true });
  if (upErr) return NextResponse.json({ success: false, error: upErr.message } satisfies Resp, { status: 500 });

  const publicUrl = svc.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;

  // Upsert shared cache record using service role.
  const { data: saved, error: saveErr } = await svc
    .from('editor_logo_assets')
    .upsert(
      {
        source,
        source_key: sourceKey,
        variant_key: variantKey,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        public_url: publicUrl,
        content_type: 'image/png',
        width: meta.width ?? null,
        height: meta.height ?? null,
        sha256: sha,
        last_used_at: new Date().toISOString(),
        use_count: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source,source_key,variant_key' }
    )
    .select('id')
    .single();
  if (saveErr) return NextResponse.json({ success: false, error: saveErr.message } satisfies Resp, { status: 500 });

  return NextResponse.json({
    success: true,
    cached: false,
    asset: {
      id: String(saved?.id || ''),
      source,
      sourceKey,
      variantKey,
      bucket: BUCKET,
      path: storagePath,
      url: withVersion(publicUrl, v),
      contentType: 'image/png',
      width: meta.width ?? null,
      height: meta.height ?? null,
      sha256: sha,
    },
  } satisfies Resp);
}

