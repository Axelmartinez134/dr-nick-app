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

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = getSupabaseService()
    if (!supabase) {
      return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })
    }

    const slug = params.slug
    const { data: row, error } = await supabase
      .from('marketing_shares')
      .select('snapshot_json, revoked_at, view_count')
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

    const res = NextResponse.json(row.snapshot_json, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        Vary: 'Accept'
      }
    })
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


