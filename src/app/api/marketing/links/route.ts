import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE || process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: NextRequest)
{
  try {
    const supabase = svc()
    if (!supabase) return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const sort = (searchParams.get('sort') || 'updated_desc') as 'updated_desc' | 'views_desc' | 'cta_desc'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))
    const offset = (page - 1) * pageSize

    // Build base query: aliases joined with current slug and lifetime totals
    let base = supabase
      .from('marketing_aliases')
      .select('alias, current_slug, total_view_count, total_cta_count, patient_id, updated_at')

    // Simple search by alias (case-insensitive). Extend to name/email if needed via joins.
    if (q) {
      base = base.ilike('alias', `%${q}%`)
    }

    // Sorting
    if (sort === 'views_desc') base = base.order('total_view_count', { ascending: false, nullsFirst: false })
    else if (sort === 'cta_desc') base = base.order('total_cta_count', { ascending: false, nullsFirst: false })
    else base = base.order('updated_at', { ascending: false, nullsFirst: false })

    // Fetch page
    const { data: aliases, error } = await base.range(offset, offset + pageSize - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Load patient info for display
    const items: any[] = []
    for (const a of aliases || []) {
      const patient = { id: a.patient_id, name: '', email: '' }
      try {
        const { data: p } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', a.patient_id)
          .single()
        patient.name = p?.full_name || ''
        patient.email = p?.email || ''
      } catch {}

      // Also fetch published timestamp from current share (optional)
      let createdAt: string = ''
      try {
        const { data: s } = await supabase
          .from('marketing_shares')
          .select('created_at')
          .eq('slug', a.current_slug)
          .single()
        createdAt = s?.created_at || ''
      } catch {}

      items.push({
        alias: a.alias,
        currentSlug: a.current_slug,
        createdAt,
        views: a.total_view_count || 0,
        ctas: a.total_cta_count || 0,
        patient
      })
    }

    // Total count for pagination
    const { count } = await supabase
      .from('marketing_aliases')
      .select('alias', { count: 'exact', head: true })

    return NextResponse.json({ items, total: count || 0 }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

