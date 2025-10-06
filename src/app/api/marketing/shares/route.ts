// POST /api/marketing/shares — publish a snapshot and flip alias to latest
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { snapshotBuilder, type BuilderSettings } from '@/app/components/health/marketing/snapshotBuilder'
import { sanitizeAlias, isAliasValidFormat, validateAliasAvailable, nextAnonymousAlias } from '@/app/components/health/marketing/aliasUtils'

export async function POST(request: NextRequest) {
  try {
    const startedAt = Date.now()
    // Use service role for server-side writes (bypasses RLS safely on server)
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const SERVICE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE ||
      process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Server is missing Supabase env vars' }, { status: 500 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const body = await request.json()
    const {
      patientId,
      alias: aliasInput,
      settings
    }: { patientId: string; alias?: string; settings: BuilderSettings } = body

    if (!patientId || !settings) {
      return NextResponse.json({ error: 'Missing patientId or settings' }, { status: 400 })
    }

    // Resolve alias
    let alias = aliasInput ? sanitizeAlias(aliasInput) : ''
    if (!alias || !isAliasValidFormat(alias)) {
      // If not provided/invalid and anonymous mode requested, generate anonymousN
      alias = await nextAnonymousAlias(supabase)
    }

    // Availability check (case-insensitive) — allow reuse if the alias belongs to this patient
    const { data: existingAlias } = await supabase
      .from('marketing_aliases')
      .select('alias, patient_id')
      .ilike('alias', alias)
      .maybeSingle()

    if (existingAlias && existingAlias.patient_id !== patientId) {
      return NextResponse.json({ error: 'Alias already taken' }, { status: 400 })
    }

    // Resolve created_by as admin profile id (fallback to patientId if not found)
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL
    let createdBy: string | null = null
    if (adminEmail) {
      const { data: adminRow } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', adminEmail)
        .single()
      createdBy = adminRow?.id || null
    }

    // Defensive mapping: allow legacy testimonial before/after and map to nested front.*
    try {
      const sel: any = (settings as any)?.selectedMedia || {}
      const t = sel?.testimonial || {}
      const hasLegacy = (t && (typeof t.beforeUrl === 'string' || typeof t.afterUrl === 'string'))
      if (hasLegacy) {
        sel.testimonial = {
          front: { beforeUrl: t.beforeUrl ?? null, afterUrl: t.afterUrl ?? null },
          side: t.side || { beforeUrl: null, afterUrl: null },
          rear: t.rear || { beforeUrl: null, afterUrl: null },
          youtubeUrl: t.youtubeUrl ?? null
        }
        ;(settings as any).selectedMedia = sel
      }
    } catch {}

    // Build snapshot (data load, derived, metrics, pin assets)
    const { slug, snapshotJson } = await snapshotBuilder(supabase, patientId, alias, settings)

    // Atomic pinning validation: for any provided media, require a pinned URL
    try {
      const failures: string[] = []
      const sel = (settings as any)?.selectedMedia || {}
      const media = (snapshotJson as any)?.media || {}

      const nonEmpty = (v: any) => typeof v === 'string' && v.trim().length > 0

      if (typeof sel.beforePhotoUrl === 'string' && sel.beforePhotoUrl.trim().length > 0) {
        if (!nonEmpty(media.beforePhotoUrl)) failures.push('beforePhotoUrl')
      }
      if (typeof sel.afterPhotoUrl === 'string' && sel.afterPhotoUrl.trim().length > 0) {
        if (!nonEmpty(media.afterPhotoUrl)) failures.push('afterPhotoUrl')
      }
      if (typeof sel.loopVideoUrl === 'string' && sel.loopVideoUrl.trim().length > 0) {
        if (!nonEmpty(media.loopVideoUrl)) failures.push('loopVideoUrl')
      }

      if (sel.fit3d && Array.isArray(sel.fit3d.images)) {
        const provided = sel.fit3d.images.filter((x: any) => typeof x === 'string' && x.trim().length > 0)
        const pinned = Array.isArray(media?.fit3d?.images) ? media.fit3d.images : []
        for (let i = 0; i < provided.length; i++) {
          if (!nonEmpty(pinned[i])) failures.push(`fit3d.images[${i}]`)
        }
      }

      // testing baseline/followup images if provided must be pinned
      if (sel?.testing && typeof sel.testing.baselineImageUrl === 'string' && sel.testing.baselineImageUrl.trim().length > 0) {
        if (!nonEmpty(media?.testing?.baselineImageUrl)) failures.push('testing.baselineImageUrl')
      }
      if (sel?.testing && typeof sel.testing.followupImageUrl === 'string' && sel.testing.followupImageUrl.trim().length > 0) {
        if (!nonEmpty(media?.testing?.followupImageUrl)) failures.push('testing.followupImageUrl')
      }

      // Nested testimonial validation (if provided, must be pinned)
      const nested = (sel?.testimonial || {}) as any
      const pinnedNested = (media?.testimonial || {}) as any
      const checkPair = (groupKey: 'front' | 'side' | 'rear', which: 'beforeUrl' | 'afterUrl') => {
        const provided = nested?.[groupKey]?.[which]
        if (typeof provided === 'string' && provided.trim().length > 0) {
          const pinned = pinnedNested?.[groupKey]?.[which]
          if (!nonEmpty(pinned)) failures.push(`testimonial.${groupKey}.${which}`)
        }
      }
      ;(['front','side','rear'] as const).forEach((g) => {
        checkPair(g, 'beforeUrl')
        checkPair(g, 'afterUrl')
      })

      if (failures.length > 0) {
        console.warn('[publish] pinning validation failed', { alias, patientId, failures })
        return NextResponse.json({ error: 'Pinning failed', failures }, { status: 500 })
      }
    } catch (e: any) {
      console.error('[publish] pinning validation error', { error: e?.message || String(e) })
      return NextResponse.json({ error: 'Pinning validation error' }, { status: 500 })
    }

    // Transactional publish: insert share, upsert alias pointer
    // Supabase JS doesn't do DB transactions across RPC easily without SQL; do sequential with checks
    const { error: insertErr } = await supabase
      .from('marketing_shares')
      .insert({
        slug,
        patient_id: patientId,
        alias,
        snapshot_json: snapshotJson,
        schema_version: snapshotJson.schema_version,
        created_by: createdBy || patientId
      })

    if (insertErr) {
      return NextResponse.json({ error: `Failed to insert snapshot: ${insertErr.message}` }, { status: 400 })
    }

    // Upsert alias pointer
    const now = new Date().toISOString()
    const { error: aliasErr } = await supabase
      .from('marketing_aliases')
      .upsert({ alias, current_slug: slug, patient_id: patientId, created_by: createdBy || patientId, created_at: now, updated_at: now }, { onConflict: 'alias' })

    if (aliasErr) {
      return NextResponse.json({ error: `Failed to update alias: ${aliasErr.message}` }, { status: 400 })
    }

    const elapsedMs = Date.now() - startedAt
    console.info('[publish] success', { alias, slug, patientId, elapsedMs })
    return NextResponse.json({ success: true, slug, alias })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[publish] fail', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


