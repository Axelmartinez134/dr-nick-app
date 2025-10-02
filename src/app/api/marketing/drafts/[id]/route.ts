import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    .select('draft_json, patient_id, alias')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> })
{
  const supabase = svc()
  if (!supabase) return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })
  const { id } = await params
  const body = await req.json()
  let draft_json = body?.draft_json
  if (!draft_json || typeof draft_json !== 'object') return NextResponse.json({ error: 'Invalid draft_json' }, { status: 400 })
  try {
    // Auto-map legacy testimonial before/after to nested front.* if present
    const media = (draft_json as any)?.media || {}
    const t = media?.testimonial || {}
    const hasLegacy = (t && (typeof t.beforeUrl === 'string' || t.beforeUrl === null || typeof t.afterUrl === 'string' || t.afterUrl === null))
    if (hasLegacy) {
      const nextTestimonial = {
        front: {
          beforeUrl: t.beforeUrl ?? null,
          afterUrl: t.afterUrl ?? null
        },
        side: t.side || { beforeUrl: null, afterUrl: null },
        rear: t.rear || { beforeUrl: null, afterUrl: null },
        youtubeUrl: t.youtubeUrl ?? null
      }
      const nextMedia = { ...media, testimonial: nextTestimonial }
      draft_json = { ...(draft_json as any), media: nextMedia }
    }
  } catch {}
  const { error } = await supabase
    .from('marketing_drafts')
    .update({ draft_json })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}


