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
      .select('slug, revoked_at, alias')
      .eq('slug', slug)
      .single()

    if (fetchErr || !share) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (share.revoked_at) {
      return NextResponse.json({ error: 'Revoked' }, { status: 404 })
    }

    const { error: updErr } = await supabase.rpc('increment_cta_click', { _slug: slug })
    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Failed to count' }, { status: 500 })
    }

    // Also increment lifetime alias total ctas (best-effort; ignore if column missing)
    try {
      const aliasVal = (share as any)?.alias
      if (aliasVal) {
        const { data: arow } = await supabase
          .from('marketing_aliases')
          .select('total_cta_count')
          .ilike('alias', aliasVal)
          .single()
        const current = (arow as any)?.total_cta_count ?? 0
        await supabase
          .from('marketing_aliases')
          .update({ total_cta_count: current + 1 })
          .ilike('alias', aliasVal)
      }
    } catch {}

    // Disable caching for click responses
    const headers: HeadersInit = { 'Cache-Control': 'no-store', Vary: 'Accept' }
    return NextResponse.json({ counted: true }, { status: 200, headers })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


