import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { snapshotPreviewBuilder } from '@/app/components/health/marketing/snapshotPreviewBuilder'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE || process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> })
{
  const supabase = svc()
  if (!supabase) return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })
  const { id } = await params
  const { data, error } = await supabase
    .from('marketing_drafts')
    .select('patient_id, draft_json')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const meta = data.draft_json?.meta || { displayNameMode: 'first_name', captionsEnabled: true, layout: 'stack' }
  const media = data.draft_json?.media || {}
  const snapshot = await snapshotPreviewBuilder(supabase, data.patient_id, meta, media)
  return NextResponse.json(snapshot)
}


