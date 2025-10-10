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

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const supabase = getSupabaseService()
    if (!supabase) {
      return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })
    }

    const { slug } = await params
    const { data: row, error } = await supabase
      .from('marketing_shares')
      .select('snapshot_json, schema_version, revoked_at, view_count, alias')
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

    // Also increment lifetime alias total views (best-effort; ignore if column missing)
    try {
      const aliasVal = (row as any)?.alias
      if (aliasVal) {
        const { data: arow } = await supabase
          .from('marketing_aliases')
          .select('total_view_count')
          .ilike('alias', aliasVal)
          .single()
        const current = (arow as any)?.total_view_count ?? 0
        await supabase
          .from('marketing_aliases')
          .update({ total_view_count: current + 1 })
          .ilike('alias', aliasVal)
      }
    } catch {}

    const payload = typeof row.snapshot_json === 'object' && row.snapshot_json
      ? { ...row.snapshot_json, schema_version: (row as any).schema_version ?? (row.snapshot_json as any)?.schema_version ?? 1 }
      : row.snapshot_json

    // Disable caching so view_count increments and latest content are reflected immediately
    const headers: HeadersInit = {
      'Cache-Control': 'no-store',
      Vary: 'Accept'
    }
    return NextResponse.json(payload, { status: 200, headers })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


