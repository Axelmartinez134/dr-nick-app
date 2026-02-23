import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActiveAccountIdHeader, getAuthedSupabase } from '../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ReqBody = {
  baseTemplateId: string;
  scraped: {
    fullName: string | null;
    username: string | null;
    profilePicUrlHD: string | null;
    raw: any;
  };
};

type Resp =
  | { success: true; templateId: string; templateName: string }
  | { success: false; error: string };

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

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function firstNonEmpty(...vals: Array<any>): string | null {
  for (const v of vals) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s) return s;
  }
  return null;
}

function sanitizeName(s: string): string {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function normalizeHandle(username: string | null): string | null {
  const u = String(username || '').trim();
  if (!u) return null;
  return u.startsWith('@') ? u : `@${u}`;
}

function matchesKindOrName(asset: any, expected: string): boolean {
  const e = String(expected || '').trim().toLowerCase();
  if (!e) return false;
  const k = String(asset?.kind || '').trim().toLowerCase();
  const n = String(asset?.name || '').trim().toLowerCase();
  return k === e || n === e;
}

async function requireSuperadmin(supabase: any, userId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: saRow, error: saErr } = await supabase
    .from('editor_superadmins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (saErr) return { ok: false, status: 500, error: saErr.message };
  if (!saRow?.user_id) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

async function requireAccountAdminOrOwner(args: {
  supabase: any;
  userId: string;
  accountId: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { supabase, userId, accountId } = args;
  if (!accountId) return { ok: true };
  const { data: mem, error: memErr } = await supabase
    .from('editor_account_memberships')
    .select('role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (memErr) return { ok: false, status: 500, error: memErr.message };
  const role = String((mem as any)?.role || '');
  if (role !== 'owner' && role !== 'admin') return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

function inferExtAndContentType(args: { contentType: string; url: string }) {
  const ct = String(args.contentType || '').toLowerCase();
  if (ct.includes('image/png')) return { ext: 'png', contentType: 'image/png' };
  if (ct.includes('image/webp')) return { ext: 'webp', contentType: 'image/webp' };
  if (ct.includes('image/svg')) return { ext: 'svg', contentType: 'image/svg+xml' };
  if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return { ext: 'jpg', contentType: 'image/jpeg' };
  // Fallback: try to infer from URL
  const url = String(args.url || '').toLowerCase();
  if (url.includes('.webp')) return { ext: 'webp', contentType: 'image/webp' };
  if (url.includes('.svg')) return { ext: 'svg', contentType: 'image/svg+xml' };
  if (url.includes('.jpg') || url.includes('.jpeg')) return { ext: 'jpg', contentType: 'image/jpeg' };
  return { ext: 'png', contentType: 'image/png' };
}

function safeUrlForLog(u: string): string {
  const raw = String(u || '').trim();
  if (!raw) return '';
  if (!(raw.startsWith('http://') || raw.startsWith('https://'))) return raw;
  try {
    const url = new URL(raw);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return raw;
  }
}

function collectProfileImageCandidates(args: { primary: string; raw: any }): string[] {
  const urls: string[] = [];
  const add = (v: any) => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s) urls.push(s);
  };
  add(args.primary);
  const raw = args.raw ?? null;
  add(raw?.profilePicUrlHD);
  add(raw?.profilePicUrlHd);
  add(raw?.profilePicUrl);
  add(raw?.profile_pic_url_hd);
  add(raw?.profile_pic_url);
  // Some actors nest under `user`.
  add(raw?.user?.profilePicUrlHD);
  add(raw?.user?.profilePicUrlHd);
  add(raw?.user?.profilePicUrl);
  add(raw?.user?.profile_pic_url_hd);
  add(raw?.user?.profile_pic_url);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

function tryDecodeDataUrl(url: string): null | { buf: Buffer; contentType: string } {
  const s = String(url || '').trim();
  if (!s.startsWith('data:')) return null;
  const m = s.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
  if (!m) return null;
  const contentType = String(m[1] || 'application/octet-stream').trim() || 'application/octet-stream';
  const isBase64 = String(m[2] || '').toLowerCase().includes('base64');
  const payload = String(m[3] || '');
  try {
    const buf = Buffer.from(payload, isBase64 ? 'base64' : 'utf8');
    return { buf, contentType };
  } catch {
    return null;
  }
}

async function downloadImageBestEffort(args: {
  traceId: string;
  urls: string[];
}): Promise<{ buf: Buffer; contentType: string; urlUsed: string; status?: number }> {
  const { traceId, urls } = args;
  const hdrs: Record<string, string> = {
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: 'https://www.instagram.com/',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  };

  let lastErr = 'No URLs to download';
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const decoded = tryDecodeDataUrl(url);
    if (decoded) return { buf: decoded.buf, contentType: decoded.contentType, urlUsed: url };

    try {
      const res = await fetch(url, { method: 'GET', headers: hdrs, cache: 'no-store' as any, redirect: 'follow' as any });
      if (!res.ok) {
        lastErr = `Download failed (${res.status})`;
        console.warn('[outreach.create-template]', traceId, 'avatar_download_attempt_failed', {
          idx: i,
          status: res.status,
          url: safeUrlForLog(url),
          contentType: String(res.headers.get('content-type') || ''),
        });
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const contentType = String(res.headers.get('content-type') || '').trim() || 'application/octet-stream';
      if (!buf.length) {
        lastErr = 'Downloaded empty body';
        console.warn('[outreach.create-template]', traceId, 'avatar_download_empty_body', { idx: i, url: safeUrlForLog(url) });
        continue;
      }
      return { buf, contentType, urlUsed: url, status: res.status };
    } catch (e: any) {
      lastErr = String(e?.message || e || 'Download failed');
      console.warn('[outreach.create-template]', traceId, 'avatar_download_throw', { idx: i, url: safeUrlForLog(url), error: lastErr });
      continue;
    }
  }
  throw new Error(lastErr);
}

async function templateNameExists(args: {
  svc: any;
  accountId: string | null;
  ownerUserId: string;
  name: string;
}): Promise<boolean> {
  const { svc, accountId, ownerUserId, name } = args;
  const n = sanitizeName(name);
  if (!n) return false;
  const q = svc.from('carousel_templates').select('id').eq('name', n).limit(1);
  const { data, error } = await (accountId ? q.eq('account_id', accountId) : q.eq('owner_user_id', ownerUserId).is('account_id', null));
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

async function resolveUniqueTemplateName(args: {
  svc: any;
  accountId: string | null;
  ownerUserId: string;
  desiredName: string;
  handle: string;
}): Promise<string> {
  const { svc, accountId, ownerUserId, desiredName, handle } = args;
  const base = sanitizeName(desiredName) || 'Creator';
  const h = sanitizeName(handle);

  // Try base name first.
  if (!(await templateNameExists({ svc, accountId, ownerUserId, name: base }))) return base;

  // Then try base + handle suffix.
  const withHandle = h ? `${base} (${h})` : base;
  if (withHandle !== base && !(await templateNameExists({ svc, accountId, ownerUserId, name: withHandle }))) return withHandle;

  // Finally, add numeric suffix.
  for (let i = 2; i <= 50; i++) {
    const candidate = `${withHandle} (${i})`;
    if (!(await templateNameExists({ svc, accountId, ownerUserId, name: candidate }))) return candidate;
  }
  // Last resort: fall back to a timestamp suffix (extremely unlikely).
  return `${withHandle} (${Date.now()})`;
}

export async function POST(request: NextRequest) {
  const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase, user } = authed;

  const superadmin = await requireSuperadmin(supabase, user.id);
  if (!superadmin.ok) {
    console.warn('[outreach.create-template]', traceId, 'forbidden_superadmin', { userId: user.id, status: superadmin.status });
    return NextResponse.json({ success: false, error: superadmin.error } satisfies Resp, { status: superadmin.status });
  }

  const accountId = getActiveAccountIdHeader(request);
  const memOk = await requireAccountAdminOrOwner({ supabase, userId: user.id, accountId });
  if (!memOk.ok) {
    console.warn('[outreach.create-template]', traceId, 'forbidden_membership', { userId: user.id, accountId, status: memOk.status });
    return NextResponse.json({ success: false, error: memOk.error } satisfies Resp, { status: memOk.status });
  }

  let body: ReqBody | null = null;
  try {
    body = (await request.json()) as any;
  } catch {
    // ignore
  }

  const baseTemplateId = String(body?.baseTemplateId || '').trim();
  if (!baseTemplateId) {
    console.warn('[outreach.create-template]', traceId, 'missing_baseTemplateId');
    return NextResponse.json({ success: false, error: 'baseTemplateId is required' } satisfies Resp, { status: 400 });
  }

  const scraped = (body as any)?.scraped ?? null;
  const fullName = firstNonEmpty(scraped?.fullName);
  const usernameRaw = firstNonEmpty(scraped?.username);
  const handle = normalizeHandle(usernameRaw);
  const profilePicUrlHD = firstNonEmpty(scraped?.profilePicUrlHD);

  if (!handle) {
    console.warn('[outreach.create-template]', traceId, 'scrape_missing_username', { baseTemplateId, accountId, userId: user.id });
    return NextResponse.json({ success: false, error: 'Scrape missing username' } satisfies Resp, { status: 400 });
  }
  if (!profilePicUrlHD) {
    console.warn('[outreach.create-template]', traceId, 'scrape_missing_profilePicUrlHD', { baseTemplateId, accountId, userId: user.id, handle });
    return NextResponse.json({ success: false, error: 'Scrape missing profilePicUrlHD' } satisfies Resp, { status: 400 });
  }

  const svc = serviceClient();
  if (!svc) {
    console.error('[outreach.create-template]', traceId, 'missing_service_role_env');
    return NextResponse.json({ success: false, error: 'Server missing Supabase service role env' } satisfies Resp, { status: 500 });
  }

  console.log('[outreach.create-template]', traceId, 'start', {
    userId: user.id,
    accountId,
    baseTemplateId,
    handle,
    fullName: fullName || null,
    profilePicUrlHD: safeUrlForLog(profilePicUrlHD),
  });

  // Load base template under correct scope.
  const { data: srcTpl, error: srcErr } = await svc
    .from('carousel_templates')
    .select('id, name, definition, owner_user_id, account_id')
    .eq('id', baseTemplateId)
    .maybeSingle();
  if (srcErr) {
    console.error('[outreach.create-template]', traceId, 'base_template_load_error', { error: srcErr.message });
    return NextResponse.json({ success: false, error: srcErr.message } satisfies Resp, { status: 500 });
  }
  if (!srcTpl?.id) {
    console.warn('[outreach.create-template]', traceId, 'base_template_not_found', { baseTemplateId });
    return NextResponse.json({ success: false, error: 'Template not found' } satisfies Resp, { status: 404 });
  }
  if (accountId) {
    if (String((srcTpl as any).account_id || '') !== String(accountId)) {
      console.warn('[outreach.create-template]', traceId, 'template_scope_mismatch', {
        baseTemplateId,
        accountId,
        templateAccountId: String((srcTpl as any).account_id || ''),
      });
      return NextResponse.json({ success: false, error: 'Template not found' } satisfies Resp, { status: 404 });
    }
  } else {
    if (String((srcTpl as any).owner_user_id || '') !== user.id) {
      console.warn('[outreach.create-template]', traceId, 'template_owner_mismatch', {
        baseTemplateId,
        ownerUserId: String((srcTpl as any).owner_user_id || ''),
        userId: user.id,
      });
      return NextResponse.json({ success: false, error: 'Forbidden' } satisfies Resp, { status: 403 });
    }
  }

  // Duplicate base template row.
  const rawDesiredName = sanitizeName(fullName || handle);
  const desiredName = rawDesiredName || 'Creator';
  const def = clone<any>((srcTpl as any).definition || {});

  const finalName = await resolveUniqueTemplateName({ svc, accountId, ownerUserId: user.id, desiredName, handle });

  const { data: inserted, error: insErr } = await svc
    .from('carousel_templates')
    .insert({
      name: finalName,
      owner_user_id: user.id,
      ...(accountId ? { account_id: accountId } : {}),
      definition: def,
    })
    .select('id')
    .single();
  if (insErr || !inserted?.id) {
    console.error('[outreach.create-template]', traceId, 'template_insert_failed', { error: insErr?.message || 'unknown' });
    return NextResponse.json({ success: false, error: insErr?.message || 'Failed to create template copy' } satisfies Resp, { status: 400 });
  }
  const destTemplateId = String(inserted.id);

  // Copy storage assets from source -> dest (best-effort).
  const bucket = 'carousel-templates';
  const { data: files } = await svc.storage.from(bucket).list(`${baseTemplateId}/assets`, { limit: 1000 });
  if (Array.isArray(files)) {
    for (const f of files) {
      const name = (f as any)?.name;
      if (!name) continue;
      try {
        await svc.storage.from(bucket).copy(`${baseTemplateId}/assets/${name}`, `${destTemplateId}/assets/${name}`);
      } catch {
        // ignore
      }
    }
  }

  // Rewrite image src paths from base -> dest.
  if (def && Array.isArray(def.slides)) {
    for (const slide of def.slides) {
      if (!slide || !Array.isArray((slide as any).assets)) continue;
      for (const asset of (slide as any).assets) {
        if (!asset || asset.type !== 'image') continue;
        const src = asset.src || {};
        const oldPath = String(src.path || '');
        if (oldPath.startsWith(`${baseTemplateId}/`)) {
          const newPath = `${destTemplateId}/${oldPath.slice(`${baseTemplateId}/`.length)}`;
          src.path = newPath;
          try {
            const { data } = svc.storage.from(bucket).getPublicUrl(newPath);
            src.url = data.publicUrl;
          } catch {
            // ignore
          }
          asset.src = src;
        }
      }
    }
  }

  // Find required layers and apply text replacements.
  const nextFullName = sanitizeName(fullName || handle);
  const nextHandle = handle;

  let avatarAsset: any | null = null;
  let foundDisplayName = false;
  let foundHandle = false;
  if (def && Array.isArray(def.slides)) {
    for (const slide of def.slides) {
      if (!slide || !Array.isArray((slide as any).assets)) continue;
      for (const asset of (slide as any).assets) {
        if (!asset || typeof asset !== 'object') continue;
        if (asset.type === 'image' && matchesKindOrName(asset, 'avatar') && !avatarAsset) avatarAsset = asset;
        if (asset.type === 'text' && matchesKindOrName(asset, 'display_name')) {
          asset.text = nextFullName;
          foundDisplayName = true;
        }
        if (asset.type === 'text' && matchesKindOrName(asset, 'handle')) {
          asset.text = nextHandle;
          foundHandle = true;
        }
      }
    }
  }
  if (!avatarAsset) {
    console.warn('[outreach.create-template]', traceId, 'missing_required_layer_avatar', { baseTemplateId, destTemplateId });
    return NextResponse.json({ success: false, error: 'Selected base template is missing required layer: image kind/name "avatar"' } satisfies Resp, {
      status: 400,
    });
  }
  if (!foundDisplayName) {
    console.warn('[outreach.create-template]', traceId, 'missing_required_layer_display_name', { baseTemplateId, destTemplateId });
    return NextResponse.json(
      { success: false, error: 'Selected base template is missing required layer: text kind/name "display_name"' } satisfies Resp,
      { status: 400 }
    );
  }
  if (!foundHandle) {
    console.warn('[outreach.create-template]', traceId, 'missing_required_layer_handle', { baseTemplateId, destTemplateId });
    return NextResponse.json({ success: false, error: 'Selected base template is missing required layer: text kind/name "handle"' } satisfies Resp, {
      status: 400,
    });
  }

  // Download profile image server-side (avoids browser CORP/CORS issues).
  // IG CDN links can be sensitive to headers and may expire; try a few candidates from `raw`.
  let buf: Buffer;
  let inferred: { ext: string; contentType: string };
  try {
    const candidates = collectProfileImageCandidates({ primary: profilePicUrlHD, raw: (body as any)?.scraped?.raw ?? null });
    console.log('[outreach.create-template]', traceId, 'avatar_download_start', {
      candidateCount: candidates.length,
      candidates: candidates.slice(0, 5).map(safeUrlForLog),
    });
    const dl = await downloadImageBestEffort({ traceId, urls: candidates });
    buf = dl.buf;
    inferred = inferExtAndContentType({ contentType: dl.contentType, url: dl.urlUsed });
  } catch (e: any) {
    console.error('[outreach.create-template]', traceId, 'avatar_download_failed', { error: String(e?.message || e || 'Failed') });
    return NextResponse.json({ success: false, error: `Failed to download profile image: ${String(e?.message || e || 'Failed')}` } satisfies Resp, {
      status: 400,
    });
  }
  const assetId = String((avatarAsset as any)?.id || '').trim();
  if (!assetId) {
    console.error('[outreach.create-template]', traceId, 'avatar_asset_missing_id', { destTemplateId });
    return NextResponse.json({ success: false, error: 'Avatar asset is missing an id' } satisfies Resp, { status: 400 });
  }

  const objectPath = `${destTemplateId}/assets/${assetId}.${inferred.ext}`;
  const { error: upErr } = await svc.storage.from(bucket).upload(objectPath, buf, { upsert: true, contentType: inferred.contentType });
  if (upErr) {
    console.error('[outreach.create-template]', traceId, 'avatar_upload_failed', { error: upErr.message, objectPath });
    return NextResponse.json({ success: false, error: upErr.message } satisfies Resp, { status: 400 });
  }
  const { data: pub } = svc.storage.from(bucket).getPublicUrl(objectPath);
  if ((avatarAsset as any).src && typeof (avatarAsset as any).src === 'object') {
    (avatarAsset as any).src.bucket = bucket;
    (avatarAsset as any).src.path = objectPath;
    (avatarAsset as any).src.url = pub.publicUrl;
    (avatarAsset as any).src.contentType = inferred.contentType;
  }

  // Persist updated definition + final name.
  const { error: updErr } = await svc
    .from('carousel_templates')
    .update({ definition: def, name: finalName })
    .eq('id', destTemplateId);
  if (updErr) {
    console.error('[outreach.create-template]', traceId, 'template_update_failed', { error: updErr.message, destTemplateId });
    return NextResponse.json({ success: false, error: updErr.message } satisfies Resp, { status: 400 });
  }

  console.log('[outreach.create-template]', traceId, 'success', { destTemplateId, ms: Date.now() - startedAt });
  return NextResponse.json({ success: true, templateId: destTemplateId, templateName: finalName } satisfies Resp);
}

