// Snapshot preview builder (no pinning)
// Builds a SnapshotJson from patient data and draft media/settings without copying assets

import { SNAPSHOT_SCHEMA_VERSION, SnapshotJson, SnapshotWeek } from './snapshotTypes'
import { backfillChartsEnabled, defaultChartsOrder } from './chartDefaults'
import { loadPatientProfile, loadPatientWeeklyRows } from './snapshotDataLoaders'
import { buildDerived } from './snapshotDerived'
import { computeSummaryMetrics } from './snapshotSummary'

export interface PreviewMetaSettings {
  displayNameMode: 'first_name' | 'anonymous'
  captionsEnabled: boolean
  layout: 'stack' | 'three_up'
  chartsEnabled?: Record<string, boolean>
  chartsOrder?: string[]
  displayWeeks?: { start: number; end: number }
  totalFatLossLbs?: number | null
  beforeLabel?: string | null
  afterLabel?: string | null
}

export interface PreviewMedia {
  beforePhotoUrl?: string | null
  afterPhotoUrl?: string | null
  loopVideoUrl?: string | null
  fit3d?: { images?: string[]; youtubeId?: string | null }
  testing?: { baselineImageUrl?: string | null; followupImageUrl?: string | null; baselineReportUrl?: string | null; followupReportUrl?: string | null }
  testimonialYoutubeId?: string | null
  testimonial?: {
    front?: { beforeUrl?: string | null; afterUrl?: string | null }
    side?: { beforeUrl?: string | null; afterUrl?: string | null }
    rear?: { beforeUrl?: string | null; afterUrl?: string | null }
    youtubeUrl?: string | null
    // Legacy support fields (will be mapped to front.* if present)
    beforeUrl?: string | null
    afterUrl?: string | null
  }
}

export async function snapshotPreviewBuilder(
  supabase: any,
  patientId: string,
  meta: PreviewMetaSettings,
  media: PreviewMedia
): Promise<SnapshotJson> {
  const profile = await loadPatientProfile(supabase, patientId)
  const weekly = await loadPatientWeeklyRows(supabase, patientId)

  const fullWeeks: SnapshotWeek[] = weekly.map(w => ({
    week_number: w.week_number,
    fields: {
      weight: w.weight ?? null,
      initial_weight: (w as any)?.initial_weight ?? null,
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

  // Apply optional global display range before computing metrics/derived
  let weeksRaw: SnapshotWeek[] = fullWeeks
  let effectiveEnd: number | undefined = undefined
  const availableMax = fullWeeks.reduce((m, w) => Math.max(m, w.week_number), 0)
  if (meta.displayWeeks && typeof meta.displayWeeks.start === 'number' && typeof meta.displayWeeks.end === 'number') {
    const start = Math.max(1, Math.floor(meta.displayWeeks.start))
    const endRequested = Math.max(start, Math.floor(meta.displayWeeks.end))
    const end = Math.min(endRequested, availableMax)
    effectiveEnd = end
    weeksRaw = fullWeeks.filter(w => (w.week_number === 0) || (w.week_number >= start && w.week_number <= end))
  }

  const derived = buildDerived(weeksRaw)
  const metrics = computeSummaryMetrics(weeksRaw)
  // Override Total Loss % to always use week 0 baseline when available
  try {
    const baseline = fullWeeks
      .filter(w => typeof w.week_number === 'number' && w.week_number === 0)
      .map(w => w.fields?.weight)
      .find(v => v !== null && v !== undefined) as number | undefined
    const latestInRange = [...weeksRaw]
      .filter(w => typeof w.week_number === 'number' && (w.fields?.weight !== null && w.fields?.weight !== undefined))
      .sort((a, b) => a.week_number - b.week_number)
      .reverse()
      .find(w => w.week_number > 0)?.fields?.weight as number | undefined
    if (typeof baseline === 'number' && baseline > 0 && typeof latestInRange === 'number') {
      const pct = ((baseline - latestInRange) / baseline) * 100
      // Round to 1 decimal to match existing UI
      const roundedPct = Math.round(pct * 10) / 10
      ;(metrics as any).totalLossPct = roundedPct
    }
  } catch {}

  const patientLabel = meta.displayNameMode === 'first_name'
    ? String(profile.full_name || 'Client').split(/\s+/)[0]
    : (meta as any)?.displayNameOverride || 'Client PREVIEW'

  // Defensive mapping: if legacy testimonial.beforeUrl/afterUrl provided, map to nested front.*
  const normalizeTestimonial = (t: any) => {
    if (!t) return { front: { beforeUrl: null, afterUrl: null }, side: { beforeUrl: null, afterUrl: null }, rear: { beforeUrl: null, afterUrl: null }, youtubeUrl: null }
    const hasLegacy = (typeof t.beforeUrl === 'string' || typeof t.afterUrl === 'string' || t.beforeUrl === null || t.afterUrl === null)
    const front = t.front || { beforeUrl: hasLegacy ? (t.beforeUrl ?? null) : null, afterUrl: hasLegacy ? (t.afterUrl ?? null) : null }
    const side = t.side || { beforeUrl: null, afterUrl: null }
    const rear = t.rear || { beforeUrl: null, afterUrl: null }
    return { front, side, rear, youtubeUrl: t.youtubeUrl ?? null }
  }

  const snapshot: SnapshotJson = {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    meta: {
      patientLabel,
      unitSystemLocked: 'imperial',
      chartsOrder: Array.isArray(meta.chartsOrder) && meta.chartsOrder.length > 0 ? meta.chartsOrder : defaultChartsOrder(),
      chartsEnabled: backfillChartsEnabled(meta.chartsEnabled, { trackBloodPressure: !!profile.track_blood_pressure, trackBodyComposition: !!(profile as any).track_body_composition }),
      captionsEnabled: meta.captionsEnabled,
      layout: meta.layout,
      // Watermark centralized via marketingConfig
      watermarkText: null,
      // Optional marketing fields (fallbacks applied in client)
      ctaLabel: null,
      calendlyUrl: (meta as any)?.calendlyUrl ?? null,
      displayNameOverride: (meta as any)?.displayNameOverride ?? null,
      displayNameMode: meta.displayNameMode,
      testimonialQuote: (meta as any)?.testimonialQuote ?? null,
      age: typeof (meta as any)?.age === 'number' ? (meta as any).age : ((meta as any)?.age === null ? null : undefined),
      totalFatLossLbs: typeof (meta as any)?.totalFatLossLbs === 'number' ? (meta as any).totalFatLossLbs : ((meta as any)?.totalFatLossLbs === null ? null : undefined),
      beforeLabel: (meta as any)?.beforeLabel ?? undefined,
      afterLabel: (meta as any)?.afterLabel ?? undefined,
      displayWeeks: meta.displayWeeks ? { start: meta.displayWeeks.start, end: meta.displayWeeks.end, effectiveEnd, availableMax } : { start: 1, end: availableMax, effectiveEnd: availableMax, availableMax }
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
        baselineImageUrl: media.testing?.baselineImageUrl ?? null,
        followupImageUrl: media.testing?.followupImageUrl ?? null,
        baselineReportUrl: media.testing?.baselineReportUrl ?? null,
        followupReportUrl: media.testing?.followupReportUrl ?? null
      },
      testimonialYoutubeId: media.testimonialYoutubeId ?? null,
      testimonial: normalizeTestimonial(media.testimonial)
    }
  }

  return snapshot
}


