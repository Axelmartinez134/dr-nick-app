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

type ProviderGroup = {
  source: string;
  rowsMatched: number;
  tiles: VariantTile[];
};

type Resp =
  | {
      success: true;
      q: string;
      cap: number;
      providers: ProviderGroup[];
    }
  | { success: false; error: string };

const PROVIDERS = ['vectorlogozone', 'lobe-icons', 'developer-icons', 'svgporn', 'gilbarbara', 'simple-icons'] as const;

function safeString(v: any) {
  return String(v ?? '').trim();
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
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

async function countMatches(supabase: any, source: string, needle: string) {
  // Count matched catalog rows for this provider (not tiles).
  const { count, error } = await supabase
    .from('editor_logo_catalog')
    .select('source_key', { count: 'exact', head: true })
    .eq('source', source)
    .ilike('search_text', `%${needle}%`);

  if (error) throw new Error(error.message);
  return Number(count || 0);
}

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase } = authed;

  const { searchParams } = new URL(req.url);
  const q = safeString(searchParams.get('q') || '');
  const cap = clampInt(Number(searchParams.get('limit') || 20), 1, 20); // hard cap 20 total tiles

  if (!q) {
    return NextResponse.json({ success: true, q: '', cap, providers: [] } satisfies Resp);
  }

  const needle = q.toLowerCase();

  // 1) Count matches per provider so we can order sections by “most matches”.
  const counts: Array<{ source: (typeof PROVIDERS)[number]; rowsMatched: number }> = [];
  for (const source of PROVIDERS) {
    const rowsMatched = await countMatches(supabase, source, needle);
    counts.push({ source, rowsMatched });
  }

  counts.sort((a, b) => b.rowsMatched - a.rowsMatched);

  // 2) Fill up to cap tiles, grouped by provider, in provider order.
  const providers: ProviderGroup[] = [];
  let remaining = cap;

  // Fetch more rows than needed so we can discard rows without variants.
  const ROW_LIMIT = 400;

  for (const { source, rowsMatched } of counts) {
    if (rowsMatched <= 0) continue;
    if (remaining <= 0) break;

    const { data, error } = await supabase
      .from('editor_logo_catalog')
      .select('source, source_key, title, website_domain, tags, variants, search_text')
      .eq('source', source)
      .ilike('search_text', `%${needle}%`)
      .order('title', { ascending: true })
      .limit(ROW_LIMIT);

    if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

    const tiles: VariantTile[] = [];
    for (const row of data || []) {
      const variants = (row as any)?.variants;
      if (!Array.isArray(variants) || variants.length === 0) continue;
      for (const v of variants) {
        const tile = buildTile(source, row, v);
        if (tile) tiles.push(tile);
        if (tiles.length >= remaining) break;
      }
      if (tiles.length >= remaining) break;
    }

    if (tiles.length > 0) {
      providers.push({ source, rowsMatched, tiles });
      remaining -= tiles.length;
    }
  }

  return NextResponse.json({ success: true, q, cap, providers } satisfies Resp);
}

