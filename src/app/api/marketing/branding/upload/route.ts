import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE || process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// POST /api/marketing/branding/upload — uploads global MyFitnessPal logo (PNG) to a stable branding path
export async function POST(req: NextRequest)
{
  try {
    const supabase = svc()
    if (!supabase) return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    if (ext !== 'png') return NextResponse.json({ error: 'Only PNG is supported' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const path = 'lib/branding/mfp-logo.png'
    const { error: upErr } = await supabase.storage.from('marketing-assets').upload(path, buffer, { contentType: 'image/png', upsert: true })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })
    const { data } = supabase.storage.from('marketing-assets').getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


