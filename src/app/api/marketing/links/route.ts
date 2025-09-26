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
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const sort = searchParams.get('sort') || 'updated_desc' // views_desc | cta_desc
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))

    // Fetch active aliases (current_slug not null)
    const { data: aliases, error: aliasErr } = await supabase
      .from('marketing_aliases')
      .select('alias, current_slug, patient_id, created_at, updated_at')
      .not('current_slug', 'is', null)

    if (aliasErr || !aliases) return NextResponse.json({ error: aliasErr?.message || 'No data' }, { status: 200 })

    const slugs = Array.from(new Set(aliases.map(a => a.current_slug as string)))
    const patientIds = Array.from(new Set(aliases.map(a => a.patient_id as string)))

    const [{ data: shares }, { data: profiles }] = await Promise.all([
      supabase.from('marketing_shares').select('slug, created_at, revoked_at, view_count, cta_click_count, patient_id').in('slug', slugs),
      supabase.from('profiles').select('id, full_name, email').in('id', patientIds)
    ])

    const slugToShare = new Map<string, any>(Array.isArray(shares) ? shares.map(s => [s.slug, s]) : [])
    const idToProfile = new Map<string, any>(Array.isArray(profiles) ? profiles.map(p => [p.id, p]) : [])

    let rows = aliases
      .map(a => {
        const s = slugToShare.get(a.current_slug as string)
        if (!s || s.revoked_at) return null
        const p = idToProfile.get(a.patient_id as string)
        return {
          patient: { id: a.patient_id, name: p?.full_name || 'Client', email: p?.email || '' },
          alias: a.alias,
          currentSlug: a.current_slug,
          createdAt: s.created_at,
          views: s.view_count || 0,
          ctas: s.cta_click_count || 0
        }
      })
      .filter(Boolean) as any[]

    // Search filter
    if (q) {
      rows = rows.filter(r =>
        r.alias.toLowerCase().includes(q) ||
        r.currentSlug.toLowerCase().includes(q) ||
        (r.patient.name || '').toLowerCase().includes(q) ||
        (r.patient.email || '').toLowerCase().includes(q)
      )
    }

    // Sort
    rows.sort((a, b) => {
      if (sort === 'views_desc') return (b.views - a.views) || (a.createdAt < b.createdAt ? 1 : -1)
      if (sort === 'cta_desc') return (b.ctas - a.ctas) || (a.createdAt < b.createdAt ? 1 : -1)
      // updated_desc ~ createdAt desc of current slug
      return a.createdAt < b.createdAt ? 1 : -1
    })

    const total = rows.length
    const start = (page - 1) * pageSize
    const items = rows.slice(start, start + pageSize)
    return NextResponse.json({ items, total, page, pageSize })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


