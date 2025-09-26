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

    // Build snapshot (data load, derived, metrics, pin assets)
    const { slug, snapshotJson } = await snapshotBuilder(supabase, patientId, alias, settings)

    // Transactional publish: insert share, upsert alias pointer
    // Supabase JS doesn't do DB transactions across RPC easily without SQL; do sequential with checks
    const { error: insertErr } = await supabase
      .from('marketing_shares')
      .insert({
        slug,
        patient_id: patientId,
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


