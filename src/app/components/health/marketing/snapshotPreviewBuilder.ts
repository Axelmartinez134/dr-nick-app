// Snapshot preview builder (no pinning)
// Builds a SnapshotJson from patient data and draft media/settings without copying assets

import { SNAPSHOT_SCHEMA_VERSION, SnapshotJson, SnapshotWeek } from './snapshotTypes'
import { loadPatientProfile, loadPatientWeeklyRows } from './snapshotDataLoaders'
import { buildDerived } from './snapshotDerived'
import { computeSummaryMetrics } from './snapshotSummary'

export interface PreviewMetaSettings {
  displayNameMode: 'first_name' | 'anonymous'
  captionsEnabled: boolean
  layout: 'stack' | 'three_up'
  chartsEnabled?: Record<string, boolean>
  chartsOrder?: string[]
}

export interface PreviewMedia {
  beforePhotoUrl?: string | null
  afterPhotoUrl?: string | null
  loopVideoUrl?: string | null
  fit3d?: { images?: string[]; youtubeId?: string | null }
  testing?: { docsendUrl?: string | null; callouts?: any }
  testimonialYoutubeId?: string | null
}

export async function snapshotPreviewBuilder(
  supabase: any,
  patientId: string,
  meta: PreviewMetaSettings,
  media: PreviewMedia
): Promise<SnapshotJson> {
  const profile = await loadPatientProfile(supabase, patientId)
  const weekly = await loadPatientWeeklyRows(supabase, patientId)

  const weeksRaw: SnapshotWeek[] = weekly.map(w => ({
    week_number: w.week_number,
    fields: {
      weight: w.weight ?? null,
      waist: w.waist ?? null,
      systolic_bp: w.systolic_bp ?? null,
      diastolic_bp: w.diastolic_bp ?? null,
      sleep_consistency_score: w.sleep_consistency_score ?? null,
      morning_fat_burn_percent: w.morning_fat_burn_percent ?? null,
      body_fat_percentage: w.body_fat_percentage ?? null,
      nutrition_compliance_days: w.nutrition_compliance_days ?? null,
      purposeful_exercise_days: w.purposeful_exercise_days ?? null,
      symptom_tracking_days: w.symptom_tracking_days ?? null
    }
  }))

  const derived = buildDerived(weeksRaw)
  const metrics = computeSummaryMetrics(weeksRaw)

  const patientLabel = meta.displayNameMode === 'first_name'
    ? String(profile.full_name || 'Client').split(/\s+/)[0]
    : 'Client PREVIEW'

  const snapshot: SnapshotJson = {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    meta: {
      patientLabel,
      unitSystemLocked: 'imperial',
      chartsOrder: meta.chartsOrder || [
        'weightTrend',
        'projection',
        'plateauWeight',
        'waistTrend',
        'plateauWaist',
        'nutritionCompliancePct',
        'sleepTrend',
        'morningFatBurnTrend',
        'bodyFatTrend'
      ],
      chartsEnabled: meta.chartsEnabled || {
        weightTrend: true,
        projection: true,
        plateauWeight: true,
        waistTrend: false,
        plateauWaist: false,
        nutritionCompliancePct: false,
        sleepTrend: false,
        morningFatBurnTrend: false,
        bodyFatTrend: false
      },
      captionsEnabled: meta.captionsEnabled,
      layout: meta.layout,
      watermarkText: null
    },
    metrics,
    weeksRaw,
    derived,
    media: {
      beforePhotoUrl: media.beforePhotoUrl ?? null,
      afterPhotoUrl: media.afterPhotoUrl ?? null,
      loopVideoUrl: media.loopVideoUrl ?? null,
      fit3d: {
        images: Array.isArray(media.fit3d?.images) ? media.fit3d!.images : [],
        youtubeId: media.fit3d?.youtubeId ?? null
      },
      testing: {
        docsendUrl: media.testing?.docsendUrl ?? null,
        callouts: media.testing?.callouts ?? {}
      },
      testimonialYoutubeId: media.testimonialYoutubeId ?? null
    }
  }

  return snapshot
}


