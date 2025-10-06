 

// Snapshot schema version for forward compatibility
export const SNAPSHOT_SCHEMA_VERSION = 1 as const

// Numeric weekly fields copied from health_data into weeksRaw
export interface SnapshotWeekFields {
  weight?: number | null
  initial_weight?: number | null
  waist?: number | null
  systolic_bp?: number | null
  diastolic_bp?: number | null
  sleep_consistency_score?: number | null
  morning_fat_burn_percent?: number | null
  body_fat_percentage?: number | null
  nutrition_compliance_days?: number | null
  purposeful_exercise_days?: number | null
  symptom_tracking_days?: number | null
  // Future numeric fields can be added here without breaking readers
  [key: string]: number | null | undefined
}

export interface SnapshotWeek {
  week_number: number
  fields: SnapshotWeekFields
}

export interface SnapshotMeta {
  patientLabel: string
  unitSystemLocked: 'imperial' | 'metric'
  chartsOrder: string[]
  chartsEnabled: Record<string, boolean>
  captionsEnabled: boolean
  layout: 'stack' | 'three_up'
  watermarkText?: string | null
  // New optional fields for marketing UI
  ctaLabel?: string | null
  calendlyUrl?: string | null
  displayNameOverride?: string | null
  displayNameMode?: 'first_name' | 'anonymous'
  testimonialQuote?: string | null
  // Absolute total fat loss in pounds (fixed story value)
  totalFatLossLbs?: number | null
  // Optional global display range for charts/metrics
  displayWeeks?: {
    start: number
    end: number
    effectiveEnd?: number
    availableMax?: number
  }
}

export interface SnapshotMetrics {
  totalLossPct: number | null
  weeklyLossPct: number | null
  avgNutritionCompliancePct: number | null
  avgPurposefulExerciseDays: number | null
}

// Ready-to-plot derived series for all charts
export interface SnapshotDerived {
  weightTrend?: Array<[number, number]>
  projection?: Array<[number, number]>
  plateauWeight?: Array<[number, number]>
  plateauWeightLastValue?: number | null
  waistTrend?: Array<[number, number]>
  plateauWaist?: Array<[number, number]>
  nutritionCompliancePct?: Array<[number, number]>
  sleepTrend?: Array<[number, number]>
  morningFatBurnTrend?: Array<[number, number]>
  bodyFatTrend?: Array<[number, number]>
}

export interface SnapshotMedia {
  beforePhotoUrl?: string | null
  afterPhotoUrl?: string | null
  loopVideoUrl?: string | null
  fit3d?: {
    images?: string[]
    youtubeId?: string | null
  }
  testing?: {
    baselineImageUrl?: string | null
    followupImageUrl?: string | null
    baselineReportUrl?: string | null
    followupReportUrl?: string | null
  }
  testimonialYoutubeId?: string | null
  testimonial?: {
    front?: { beforeUrl?: string | null; afterUrl?: string | null }
    side?: { beforeUrl?: string | null; afterUrl?: string | null }
    rear?: { beforeUrl?: string | null; afterUrl?: string | null }
    youtubeUrl?: string | null
  }
}

export interface SnapshotJson {
  schema_version: number
  meta: SnapshotMeta
  metrics: SnapshotMetrics
  weeksRaw: SnapshotWeek[]
  derived: SnapshotDerived
  media: SnapshotMedia
}

// Reader helper type guard (lightweight)
export function isSnapshotJson(x: any): x is SnapshotJson {
  return x && typeof x === 'object' && typeof x.schema_version === 'number' && x.meta && x.metrics && Array.isArray(x.weeksRaw)
}

// Reader helper to normalize older snapshots to the current schema
export function normalizeSnapshot(input: any): SnapshotJson {
  // If already valid and version is current, return as-is
  if (isSnapshotJson(input) && input.schema_version === SNAPSHOT_SCHEMA_VERSION) {
    return input
  }

  // If it looks like a snapshot but older, coerce missing fields
  if (isSnapshotJson(input)) {
    const meta: SnapshotMeta = {
      patientLabel: input.meta?.patientLabel ?? 'Client',
      unitSystemLocked: input.meta?.unitSystemLocked === 'metric' ? 'metric' : 'imperial',
      chartsOrder: Array.isArray(input.meta?.chartsOrder) ? input.meta.chartsOrder : [],
      chartsEnabled: typeof input.meta?.chartsEnabled === 'object' && input.meta?.chartsEnabled ? input.meta.chartsEnabled : {},
      captionsEnabled: !!input.meta?.captionsEnabled,
      layout: input.meta?.layout === 'three_up' ? 'three_up' : 'stack',
      watermarkText: input.meta?.watermarkText ?? null,
      ctaLabel: input.meta?.ctaLabel ?? null,
      calendlyUrl: input.meta?.calendlyUrl ?? null,
      displayNameOverride: input.meta?.displayNameOverride ?? null,
      totalFatLossLbs: typeof input.meta?.totalFatLossLbs === 'number' ? input.meta.totalFatLossLbs : (input.meta?.totalFatLossLbs === null ? null : undefined)
    }

    const metrics: SnapshotMetrics = {
      totalLossPct: typeof input.metrics?.totalLossPct === 'number' ? input.metrics.totalLossPct : null,
      weeklyLossPct: typeof input.metrics?.weeklyLossPct === 'number' ? input.metrics.weeklyLossPct : null,
      avgNutritionCompliancePct: typeof input.metrics?.avgNutritionCompliancePct === 'number' ? input.metrics.avgNutritionCompliancePct : null,
      avgPurposefulExerciseDays: typeof input.metrics?.avgPurposefulExerciseDays === 'number' ? input.metrics.avgPurposefulExerciseDays : null
    }

    const weeksRaw: SnapshotWeek[] = Array.isArray(input.weeksRaw)
      ? input.weeksRaw.map((w: any) => ({
          week_number: typeof w?.week_number === 'number' ? w.week_number : 0,
          fields: typeof w?.fields === 'object' && w?.fields ? w.fields : {}
        }))
      : []

    const derived: SnapshotDerived = typeof input.derived === 'object' && input.derived ? input.derived : {}
    const media: SnapshotMedia = typeof input.media === 'object' && input.media ? input.media : {}

    return {
      schema_version: SNAPSHOT_SCHEMA_VERSION,
      meta,
      metrics,
      weeksRaw,
      derived,
      media
    }
  }

  // If input is invalid, return a minimal empty structure (caller can handle)
  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    meta: {
      patientLabel: 'Client',
      unitSystemLocked: 'imperial',
      chartsOrder: [],
      chartsEnabled: {},
      captionsEnabled: true,
      layout: 'stack',
      watermarkText: null,
      totalFatLossLbs: null
    },
    metrics: {
      totalLossPct: null,
      weeklyLossPct: null,
      avgNutritionCompliancePct: null,
      avgPurposefulExerciseDays: null
    },
    weeksRaw: [],
    derived: {},
    media: {}
  }
}


