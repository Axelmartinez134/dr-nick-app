import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sanitizeAlias } from '@/app/components/health/marketing/aliasUtils'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE || process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ alias: string }> })
{
  try {
    const supabase = svc()
    if (!supabase) return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })

    const { alias } = await params
    const requestedAlias = sanitizeAlias(String(alias || ''))
    const body = await req.json().catch(() => ({}))
    const confirm = String(body?.confirm || '')
    if (confirm !== 'DELETE') {
      return NextResponse.json({ error: "Confirmation text must be 'DELETE'" }, { status: 400 })
    }

    // Look up alias row (case-insensitive)
    const { data: aliasRow, error: aliasErr } = await supabase
      .from('marketing_aliases')
      .select('alias, patient_id')
      .ilike('alias', requestedAlias)
      .single()

    if (aliasErr || !aliasRow) {
      return NextResponse.json({ error: 'Alias not found' }, { status: 404 })
    }

    const patientId = aliasRow.patient_id as string

    // Delete all drafts for this alias (case-insensitive match on alias field in drafts)
    await supabase
      .from('marketing_drafts')
      .delete()
      .ilike('alias', requestedAlias)

    // Delete all shares for this alias (robust: select slugs by normalized alias, then delete by slug)
    const normalized = sanitizeAlias(String(aliasRow.alias || requestedAlias))
    const { data: shareRows } = await supabase
      .from('marketing_shares')
      .select('slug')
      .eq('alias', normalized)

    if (Array.isArray(shareRows) && shareRows.length > 0) {
      const slugs = shareRows.map(r => r.slug)
      await supabase
        .from('marketing_shares')
        .delete()
        .in('slug', slugs)
    }

    // Finally delete alias row
    const { error: delAliasErr } = await supabase
      .from('marketing_aliases')
      .delete()
      .ilike('alias', requestedAlias)

    if (delAliasErr) {
      return NextResponse.json({ error: delAliasErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, deletedSlugs: (Array.isArray(shareRows) ? shareRows.map(r => r.slug) : []) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


