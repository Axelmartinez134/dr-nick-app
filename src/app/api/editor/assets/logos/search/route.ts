import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 20;

type VariantTile = {
  source: string;
  sourceKey: string;
  title: string;
  websiteDomain: string | null;
  tags: string[];
  variantKey: string;
  remoteUrl: string;
  format: 'svg' | 'other';
};

type Resp =
  | {
      success: true;
      source: string;
      q: string;
      tag: string | null;
      tiles: VariantTile[];
      rowsMatched: number;
      rowsScanned: number;
    }
  | { success: false; error: string };

function safeString(v: any) {
  return String(v ?? '').trim();
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeProviderSource(raw: string) {
  const s = safeString(raw).toLowerCase();
  if (s === 'vectorlogozone' || s === 'vlz') return 'vectorlogozone';
  if (s === 'lobe-icons' || s === 'lobeicons' || s === 'lobe_icons') return 'lobe-icons';
  if (s === 'developer-icons' || s === 'developericons' || s === 'developer_icons') return 'developer-icons';
  if (s === 'svgporn' || s === 'svg-logos' || s === 'svglogos') return 'svgporn';
  if (s === 'gilbarbara' || s === 'gilbarbara/logos' || s === 'logos') return 'gilbarbara';
  if (s === 'simple-icons' || s === 'simpleicons' || s === 'simple_icons') return 'simple-icons';
  // Conservative default
  return 'vectorlogozone';
}

function buildTile(source: string, row: any, v: any): VariantTile | null {
  const sourceKey = safeString(row?.source_key);
  const title = safeString(row?.title);
  const websiteDomain = row?.website_domain ? safeString(row.website_domain) : null;
  const tags = Array.isArray(row?.tags) ? row.tags.map((t: any) => safeString(t)).filter(Boolean) : [];
  const variantKey = safeString(v?.variant_key || v?.variantKey || v?.key || '');
  const remoteUrl = safeString(v?.remote_url || v?.remoteUrl || '');
  const formatRaw = safeString(v?.format || '');
  const format: 'svg' | 'other' = formatRaw === 'svg' ? 'svg' : 'other';
  if (!sourceKey || !title || !variantKey || !remoteUrl) return null;
  return { source, sourceKey, title, websiteDomain, tags, variantKey, remoteUrl, format };
}

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase } = authed;

  const { searchParams } = new URL(req.url);
  const source = normalizeProviderSource(searchParams.get('source') || 'vectorlogozone');
  const q = safeString(searchParams.get('q') || '');
  const tag = safeString(searchParams.get('tag') || '') || null;
  const limit = clampInt(Number(searchParams.get('limit') || 40), 1, 120);

  // Phase 3C UX: don’t return the whole dataset by default; require search or a tag.
  if (!q && !tag) {
    return NextResponse.json({ success: true, source, q: '', tag: null, tiles: [], rowsMatched: 0, rowsScanned: 0 } satisfies Resp);
  }

  let query = supabase
    .from('editor_logo_catalog')
    .select('source, source_key, title, website_domain, tags, variants, search_text')
    .eq('source', source);

  if (tag) {
    // tags is text[]; match rows that contain this tag.
    query = query.contains('tags', [tag]);
  }

  if (q) {
    const needle = q.toLowerCase();
    query = query.ilike('search_text', `%${needle}%`);
  }

  // Fetch more rows than requested tiles so we can discard rows without variants.
  const ROW_LIMIT = 400;
  const { data, error } = await query.order('title', { ascending: true }).limit(ROW_LIMIT);
  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const rows = data || [];
  const tiles: VariantTile[] = [];
  let scanned = 0;
  for (const row of rows) {
    scanned++;
    const variants = (row as any)?.variants;
    if (!Array.isArray(variants) || variants.length === 0) continue;
    for (const v of variants) {
      const tile = buildTile(source, row, v);
      if (tile) tiles.push(tile);
      if (tiles.length >= limit) break;
    }
    if (tiles.length >= limit) break;
  }

  return NextResponse.json({
    success: true,
    source,
    q,
    tag,
    tiles,
    rowsMatched: rows.length,
    rowsScanned: scanned,
  } satisfies Resp);
}

