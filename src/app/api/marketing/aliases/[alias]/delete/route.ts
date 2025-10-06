import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const body = await req.json().catch(() => ({}))
    const confirm = String(body?.confirm || '')
    if (confirm !== 'DELETE') {
      return NextResponse.json({ error: "Confirmation text must be 'DELETE'" }, { status: 400 })
    }

    // Look up alias row (case-insensitive)
    const { data: aliasRow, error: aliasErr } = await supabase
      .from('marketing_aliases')
      .select('alias, patient_id')
      .ilike('alias', alias)
      .single()

    if (aliasErr || !aliasRow) {
      return NextResponse.json({ error: 'Alias not found' }, { status: 404 })
    }

    const patientId = aliasRow.patient_id as string

    // Delete all drafts for this alias (case-insensitive match on alias field in drafts)
    await supabase
      .from('marketing_drafts')
      .delete()
      .ilike('alias', alias)

    // Delete all shares for this patient
    await supabase
      .from('marketing_shares')
      .delete()
      .eq('patient_id', patientId)

    // Finally delete alias row
    const { error: delAliasErr } = await supabase
      .from('marketing_aliases')
      .delete()
      .ilike('alias', alias)

    if (delAliasErr) {
      return NextResponse.json({ error: delAliasErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


