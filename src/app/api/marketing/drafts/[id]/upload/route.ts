import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE || process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> })
{
  const supabase = svc()
  if (!supabase) return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })
  const { id } = await params

  const form = await req.formData()
  const file = form.get('file') as File | null
  const kind = String(form.get('kind') || '') // 'before' | 'after' | 'loop' | 'fit3d' | 'testing' | 'testimonial_before' | 'testimonial_after' | 'testimonial_front_before' | 'testimonial_front_after' | 'testimonial_side_before' | 'testimonial_side_after' | 'testimonial_rear_before' | 'testimonial_rear_after'
  const idx = Number(form.get('index') || 0)
  if (!file || !kind) return NextResponse.json({ error: 'Missing file or kind' }, { status: 400 })

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
  const isMp4 = ext === 'mp4'
  const isPdf = ext === 'pdf'
  if (!(isImage || isMp4 || isPdf)) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })

  let dest = `${id}/`
  if (kind === 'before') dest += `photos/before.${ext}`
  else if (kind === 'after') dest += `photos/after.${ext}`
  else if (kind === 'loop') dest += `videos/loop.${ext}`
  else if (kind === 'fit3d') dest += `fit3d/${String(idx + 1).padStart(2, '0')}.${ext}`
  else if (kind === 'testing_baseline') dest += `testing/baseline.${ext}`
  else if (kind === 'testing_followup') dest += `testing/followup.${ext}`
  else if (kind === 'testimonial_before') dest += `testimonial/before.${ext}`
  else if (kind === 'testimonial_after') dest += `testimonial/after.${ext}`
  else if (kind === 'testimonial_front_before') dest += `testimonial/front/before.${ext}`
  else if (kind === 'testimonial_front_after') dest += `testimonial/front/after.${ext}`
  else if (kind === 'testimonial_side_before') dest += `testimonial/side/before.${ext}`
  else if (kind === 'testimonial_side_after') dest += `testimonial/side/after.${ext}`
  else if (kind === 'testimonial_rear_before') dest += `testimonial/rear/before.${ext}`
  else if (kind === 'testimonial_rear_after') dest += `testimonial/rear/after.${ext}`
  else return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })

  const contentType = isMp4 ? 'video/mp4' : (isPdf ? 'application/pdf' : (ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg')))
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage.from('marketing-assets').upload(`drafts/${dest}`, buffer, { contentType, upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })
  const { data } = supabase.storage.from('marketing-assets').getPublicUrl(`drafts/${dest}`)
  return NextResponse.json({ url: data.publicUrl })
}


