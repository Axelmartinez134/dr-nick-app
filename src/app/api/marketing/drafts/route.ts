import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sanitizeAlias, isAliasValidFormat } from '@/app/components/health/marketing/aliasUtils'
import { computeChartsEnabledDefaults } from '@/app/components/health/marketing/chartDefaults'
import { loadPatientProfile } from '@/app/components/health/marketing/snapshotDataLoaders'

function getServiceClient()
{
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE || process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// POST /api/marketing/drafts — create draft
export async function POST(req: NextRequest)
{
  try {
    const supabase = getServiceClient()
    if (!supabase) return NextResponse.json({ error: 'Server missing Supabase env' }, { status: 500 })

    const body = await req.json()
    const { patientId, alias: inputAlias } = body || {}
    if (!patientId || !inputAlias) return NextResponse.json({ error: 'Missing patientId or alias' }, { status: 400 })

    const alias = sanitizeAlias(String(inputAlias))
    if (!isAliasValidFormat(alias)) return NextResponse.json({ error: 'Invalid alias' }, { status: 400 })

    // Load profile to set BP-conditional defaults
    const profile = await (async () => {
      try { return await loadPatientProfile(supabase, patientId) } catch { return null }
    })()

    // Create a draft with full chartsEnabled defaults (flags; BP/BodyComp conditional)
    const draft = {
      meta: {
        displayNameMode: 'first_name',
        captionsEnabled: true,
        layout: 'stack',
        chartsEnabled: computeChartsEnabledDefaults({
          trackBloodPressure: !!(profile as any)?.track_blood_pressure,
          trackBodyComposition: !!(profile as any)?.track_body_composition
        }),
        totalFatLossLbs: null,
        // MyFitnessPal defaults
        mfpEnabled: false,
        mfpUrl: null,
        // Testimonial toggle default ON (back-compat)
        testimonialEnabled: true
      },
      media: {
        beforePhotoUrl: null,
        afterPhotoUrl: null,
        loopVideoUrl: null,
        fit3d: { images: [], youtubeId: null },
        testing: { baselineImageUrl: null, followupImageUrl: null, baselineReportUrl: null, followupReportUrl: null },
        testimonial: {
          front: { beforeUrl: null, afterUrl: null },
          side: { beforeUrl: null, afterUrl: null },
          rear: { beforeUrl: null, afterUrl: null },
          youtubeUrl: null
        }
      }
    }

    // Resolve created_by (admin) or fallback to patient
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL
    let createdBy: string | null = null
    if (adminEmail) {
      const { data: adminRow } = await supabase.from('profiles').select('id').eq('email', adminEmail).single()
      createdBy = adminRow?.id || null
    }

    const { data, error } = await supabase
      .from('marketing_drafts')
      .insert({ patient_id: patientId, alias, draft_json: draft, created_by: createdBy || patientId })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ draftId: data.id, alias })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


