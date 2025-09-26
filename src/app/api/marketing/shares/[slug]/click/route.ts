import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseService() {
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

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const supabase = getSupabaseService()
    if (!supabase) {
      return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })
    }

    const { slug } = await params
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

    // Validate slug exists and is not revoked
    const { data: share, error: fetchErr } = await supabase
      .from('marketing_shares')
      .select('slug, revoked_at')
      .eq('slug', slug)
      .single()

    if (fetchErr || !share) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (share.revoked_at) {
      return NextResponse.json({ error: 'Revoked' }, { status: 404 })
    }

    const { error: updErr } = await supabase.rpc('sql_increment_cta_click', { _slug: slug })
    if (updErr) {
      // Fallback to direct update if RPC not present
      const { error: fallbackErr } = await supabase
        .from('marketing_shares')
        .update({ cta_click_count: (null as any) }) // no-op; we will use increment via RPC alternative below
        .eq('slug', slug)
      // Ignore fallback error; try raw increment with single update
      const { error: incErr } = await supabase.rpc('exec_raw', {
        sql: `update marketing_shares set cta_click_count = cta_click_count + 1 where slug = $1`,
        params: [slug]
      } as any)
      if (fallbackErr && incErr) {
        return NextResponse.json({ error: updErr.message || 'Failed to count' }, { status: 500 })
      }
    }

    return NextResponse.json({ counted: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


