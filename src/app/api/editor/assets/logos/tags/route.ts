import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedSupabase } from '../../../_utils';

export const runtime = 'nodejs';
export const maxDuration = 20;

type Resp =
  | { success: true; source: string; tags: Array<{ tag: string; count: number }>; totalRowsScanned: number }
  | { success: false; error: string };

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function safeString(v: any) {
  return String(v ?? '').trim();
}

function normalizeProviderSource(raw: string) {
  const s = safeString(raw).toLowerCase();
  if (s === 'vectorlogozone' || s === 'vlz') return 'vectorlogozone';
  if (s === 'lobe-icons' || s === 'lobeicons' || s === 'lobe_icons') return 'lobe-icons';
  if (s === 'developer-icons' || s === 'developericons' || s === 'developer_icons') return 'developer-icons';
  if (s === 'svgporn' || s === 'svg-logos' || s === 'svglogos') return 'svgporn';
  if (s === 'gilbarbara' || s === 'gilbarbara/logos' || s === 'logos') return 'gilbarbara';
  if (s === 'simple-icons' || s === 'simpleicons' || s === 'simple_icons') return 'simple-icons';
  return 'vectorlogozone';
}

export async function GET(req: NextRequest) {
  const authed = await getAuthedSupabase(req);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error } satisfies Resp, { status: authed.status });
  const { supabase } = authed;

  const { searchParams } = new URL(req.url);
  const source = normalizeProviderSource(searchParams.get('source') || 'vectorlogozone');
  const limit = clampInt(Number(searchParams.get('limit') || 200), 1, 500);

  // Phase 3C (conservative): compute tag stats in the server route by scanning catalog rows.
  // This avoids adding new DB objects (views/functions) during the conservative rollout.
  const { data, error } = await supabase
    .from('editor_logo_catalog')
    .select('tags, variants')
    .eq('source', source)
    .limit(20000);

  if (error) return NextResponse.json({ success: false, error: error.message } satisfies Resp, { status: 500 });

  const counts = new Map<string, number>();
  let scanned = 0;
  for (const row of data || []) {
    scanned++;
    const variants = (row as any)?.variants;
    const hasVariants = Array.isArray(variants) ? variants.length > 0 : !!variants; // best-effort
    if (!hasVariants) continue;
    const tags = Array.isArray((row as any)?.tags) ? ((row as any).tags as any[]) : [];
    for (const t of tags) {
      const tag = safeString(t);
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const tags = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));

  return NextResponse.json({ success: true, source, tags, totalRowsScanned: scanned } satisfies Resp);
}

