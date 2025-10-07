import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseService()
{
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const supabase = getSupabaseService()
    if (!supabase) {
      return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })
    }

    const { slug } = await params
    const { data: row, error } = await supabase
      .from('marketing_shares')
      .select('snapshot_json, schema_version, revoked_at, view_count')
      .eq('slug', slug)
      .single()

    if (error || !row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (row.revoked_at) {
      return NextResponse.json({ error: 'Revoked' }, { status: 410 })
    }

    // Best-effort increment of view_count
    const nextCount = (row.view_count || 0) + 1
    await supabase
      .from('marketing_shares')
      .update({ view_count: nextCount })
      .eq('slug', slug)

    const payload = typeof row.snapshot_json === 'object' && row.snapshot_json
      ? { ...row.snapshot_json, schema_version: (row as any).schema_version ?? (row.snapshot_json as any)?.schema_version ?? 1 }
      : row.snapshot_json

    // Compute weak ETag based on snapshot payload only (ignore view_count changes)
    let etag = ''
    try {
      const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload)
      let h = 5381
      for (let i = 0; i < jsonStr.length; i++) {
        h = (h * 33) ^ jsonStr.charCodeAt(i)
      }
      const hash = (h >>> 0).toString(16)
      etag = `W/"${hash}-${jsonStr.length}"`
    } catch {}

    const ifNoneMatch = req.headers.get('if-none-match') || ''
    if (etag && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=86400',
          'Surrogate-Control': 'max-age=86400',
          ETag: etag,
          Vary: 'Accept'
        }
      })
    }

    const headers: HeadersInit = {
      'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=86400',
      'Surrogate-Control': 'max-age=86400',
      Vary: 'Accept'
    }
    if (etag) (headers as Record<string, string>).ETag = etag
    const res = NextResponse.json(payload, { status: 200, headers })
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


