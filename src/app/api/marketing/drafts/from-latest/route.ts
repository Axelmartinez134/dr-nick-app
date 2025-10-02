import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE || process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(req: NextRequest)
{
  try {
    const supabase = svc()
    if (!supabase) return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })
    const body = await req.json()
    const { patientId, alias } = body || {}
    if (!patientId) return NextResponse.json({ error: 'Missing patientId' }, { status: 400 })

    // Resolve latest slug: prefer alias current, else latest non-revoked for patient
    let slug: string | null = null
    if (alias) {
      const { data: a } = await supabase.from('marketing_aliases').select('current_slug').ilike('alias', alias).maybeSingle()
      slug = a?.current_slug || null
    }
    if (!slug) {
      const { data: s } = await supabase
        .from('marketing_shares')
        .select('slug')
        .eq('patient_id', patientId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      slug = s?.slug || null
    }

    if (!slug) return NextResponse.json({ error: 'No published snapshot found for this patient/alias' }, { status: 404 })

    // Load snapshot
    const { data: share } = await supabase
      .from('marketing_shares')
      .select('patient_id, snapshot_json')
      .eq('slug', slug)
      .single()

    const snap = share?.snapshot_json || {}
    const draft = {
      meta: {
        displayNameMode: snap?.meta?.patientLabel ? 'first_name' : 'first_name',
        captionsEnabled: !!snap?.meta?.captionsEnabled,
        layout: snap?.meta?.layout === 'three_up' ? 'three_up' : 'stack',
        chartsEnabled: snap?.meta?.chartsEnabled || {},
        totalFatLossLbs: typeof snap?.meta?.totalFatLossLbs === 'number' ? snap.meta.totalFatLossLbs : null
      },
      media: snap?.media || {}
    }

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL
    let createdBy: string | null = null
    if (adminEmail) {
      const { data: adminRow } = await supabase.from('profiles').select('id').eq('email', adminEmail).single()
      createdBy = adminRow?.id || null
    }

    const { data: row, error } = await supabase
      .from('marketing_drafts')
      .insert({ patient_id: patientId, alias: alias || '', draft_json: draft, created_by: createdBy || patientId })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ draftId: row.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


