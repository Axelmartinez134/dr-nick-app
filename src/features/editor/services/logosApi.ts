export type LogoProvider = 'vectorlogozone';

export type LogoTagStat = { tag: string; count: number };

export type LogoVariantTile = {
  source: LogoProvider;
  sourceKey: string;
  title: string;
  websiteDomain: string | null;
  tags: string[];
  variantKey: string;
  remoteUrl: string;
  format: 'svg' | 'other';
};

export async function fetchLogoTags(
  fetchJson: (path: string, init?: RequestInit) => Promise<any>,
  params: { source: LogoProvider; limit?: number }
): Promise<{ tags: LogoTagStat[]; totalRowsScanned: number }> {
  const source = params.source || 'vectorlogozone';
  const limit = typeof params.limit === 'number' ? params.limit : 200;
  const j = await fetchJson(
    `/api/editor/assets/logos/tags?source=${encodeURIComponent(source)}&limit=${encodeURIComponent(String(limit))}`,
    { method: 'GET' }
  );
  if (!j?.success) throw new Error(j?.error || 'Failed to load logo tags');
  return { tags: Array.isArray(j?.tags) ? j.tags : [], totalRowsScanned: Number(j?.totalRowsScanned || 0) };
}

export async function searchLogoVariants(
  fetchJson: (path: string, init?: RequestInit) => Promise<any>,
  params: { source: LogoProvider; q?: string; tag?: string | null; limit?: number }
): Promise<{ tiles: LogoVariantTile[]; rowsMatched: number }> {
  const source = params.source || 'vectorlogozone';
  const q = String(params.q || '').trim();
  const tag = params.tag ? String(params.tag).trim() : '';
  const limit = typeof params.limit === 'number' ? params.limit : 40;

  const qs = new URLSearchParams();
  qs.set('source', source);
  if (q) qs.set('q', q);
  if (tag) qs.set('tag', tag);
  qs.set('limit', String(limit));

  const j = await fetchJson(`/api/editor/assets/logos/search?${qs.toString()}`, { method: 'GET' });
  if (!j?.success) throw new Error(j?.error || 'Failed to search logos');
  return {
    tiles: Array.isArray(j?.tiles) ? (j.tiles as LogoVariantTile[]) : [],
    rowsMatched: Number(j?.rowsMatched || 0),
  };
}

export async function importLogoVariant(
  fetchJson: (path: string, init?: RequestInit) => Promise<any>,
  args: { source: LogoProvider; sourceKey: string; variantKey: string; remoteUrl: string }
): Promise<{
  cached: boolean;
  asset: {
    id: string;
    url: string;
    storage: { bucket: string; path: string };
    width: number | null;
    height: number | null;
  };
}> {
  const body = {
    source: args.source,
    sourceKey: args.sourceKey,
    variantKey: args.variantKey,
    remoteUrl: args.remoteUrl,
  };
  const j = await fetchJson('/api/editor/assets/logos/import', { method: 'POST', body: JSON.stringify(body) });
  if (!j?.success) throw new Error(j?.error || 'Logo import failed');
  return {
    cached: !!j?.cached,
    asset: {
      id: String(j?.asset?.id || ''),
      url: String(j?.asset?.url || ''),
      storage: { bucket: String(j?.asset?.bucket || ''), path: String(j?.asset?.path || '') },
      width: typeof j?.asset?.width === 'number' ? j.asset.width : null,
      height: typeof j?.asset?.height === 'number' ? j.asset.height : null,
    },
  };
}

