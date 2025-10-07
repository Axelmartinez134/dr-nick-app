import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
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

// Case-insensitive alias lookup
export async function GET(req: Request, { params }: { params: Promise<{ alias: string }> }) {
  try {
    const supabase = getServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })
    }

    const { alias } = await params
    if (!alias) return NextResponse.json({ error: 'Missing alias' }, { status: 400 })

    const { data: row, error } = await supabase
      .from('marketing_aliases')
      .select('current_slug')
      .ilike('alias', alias) // case-insensitive exact match
      .single()

    if (error || !row?.current_slug) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const payload = { slug: row.current_slug }
    // Weak ETag based on payload
    let etag = ''
    try {
      const jsonStr = JSON.stringify(payload)
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
    return NextResponse.json(payload, { status: 200, headers })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


