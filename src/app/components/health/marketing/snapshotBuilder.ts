// Snapshot builder orchestrator
// Assembles weeksRaw, derived series, summary metrics, and pinned media
// Returns { slug, snapshotJson }

import { SNAPSHOT_SCHEMA_VERSION, SnapshotJson, SnapshotWeek } from './snapshotTypes'
import { loadPatientProfile, loadPatientWeeklyRows } from './snapshotDataLoaders'
import { buildDerived } from './snapshotDerived'
import { computeSummaryMetrics } from './snapshotSummary'
import { pinAssets, type SelectedMedia } from './snapshotPinning'
import { sanitizeAlias, makeSnapshotSlug } from './aliasUtils'

export interface BuilderSettings {
  displayNameMode: 'first_name' | 'anonymous'
  captionsEnabled: boolean
  layout: 'stack' | 'three_up'
  watermarkText?: string | null
  chartsEnabled?: Record<string, boolean>
  chartsOrder?: string[]
  displayWeeks?: { start: number; end: number }
  selectedMedia: SelectedMedia
  testimonialQuote?: string | null
}

function firstNameOnly(full: string | null | undefined): string {
  if (!full) return 'Client'
  const t = String(full).trim()
  if (!t) return 'Client'
  return t.split(/\s+/)[0]
}

function shortIdFromSlug(slug: string): string {
  const parts = slug.split('-')
  const last = parts[parts.length - 1] || slug
  return last.slice(0, 5).toUpperCase()
}

export async function snapshotBuilder(
  supabase: any,
  patientId: string,
  aliasInput: string,
  settings: BuilderSettings
): Promise<{ slug: string; snapshotJson: SnapshotJson }> {
  const startedAt = Date.now()
  // 1) Normalize alias and make a unique snapshot slug (immutable)
  const alias = sanitizeAlias(aliasInput)
  const slug = makeSnapshotSlug(alias)

  // 2) Load data
  const profile = await loadPatientProfile(supabase, patientId)
  const weekly = await loadPatientWeeklyRows(supabase, patientId)

  // 3) Convert to weeksRaw (copy ALL numeric weekly fields we support)
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

  // Apply optional global display range before computing
  let weeksRaw: SnapshotWeek[] = fullWeeks
  let effectiveEnd: number | undefined = undefined
  const availableMax = fullWeeks.reduce((m, w) => Math.max(m, w.week_number), 0)
  if (settings.displayWeeks && typeof settings.displayWeeks.start === 'number' && typeof settings.displayWeeks.end === 'number') {
    const start = Math.max(1, Math.floor(settings.displayWeeks.start))
    const endRequested = Math.max(start, Math.floor(settings.displayWeeks.end))
    const end = Math.min(endRequested, availableMax)
    effectiveEnd = end
    weeksRaw = fullWeeks.filter(w => (w.week_number === 0) || (w.week_number >= start && w.week_number <= end))
  }

  // 4) Derived series and summary metrics
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
      const rounded = Math.round(pct * 10) / 10
      ;(metrics as any).totalLossPct = rounded
    }
  } catch {}

  // 5) Determine patient label
  const patientLabel = settings.displayNameMode === 'first_name'
    ? firstNameOnly(profile.full_name)
    : ((settings as any)?.displayNameOverride || `Client ${shortIdFromSlug(slug)}`)

  // 6) Pin assets for this snapshot
  const media = await pinAssets(supabase, slug, settings.selectedMedia)

  // 7) Compose snapshot JSON
  const snapshotJson: SnapshotJson = {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    meta: {
      patientLabel,
      unitSystemLocked: 'imperial',
      chartsOrder: settings.chartsOrder || [
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
      chartsEnabled: settings.chartsEnabled || {
        weightTrend: true,
        projection: true,
        plateauWeight: true,
        waistTrend: false,
        plateauWaist: false,
        nutritionCompliancePct: false,
        sleepTrend: false,
        systolicTrend: false,
        diastolicTrend: false,
        strainTrend: false,
        disciplineNutritionCompliancePct: false,
        disciplineStrainTrend: false,
        morningFatBurnTrend: false,
        bodyFatTrend: false
      },
      captionsEnabled: settings.captionsEnabled,
      layout: settings.layout,
      // Watermark centralized via marketingConfig; do not persist per snapshot
      watermarkText: null,
      // Strip CTA label (centralized config) and allow identity override
      ctaLabel: null,
      displayNameOverride: (settings as any)?.displayNameOverride ?? null,
      displayNameMode: settings.displayNameMode,
      testimonialQuote: (settings as any)?.testimonialQuote ?? null,
      displayWeeks: settings.displayWeeks ? { start: settings.displayWeeks.start, end: settings.displayWeeks.end, effectiveEnd, availableMax } : { start: 1, end: availableMax, effectiveEnd: availableMax, availableMax }
    },
    metrics,
    weeksRaw,
    derived,
    media
  }
  const elapsedMs = Date.now() - startedAt
  console.info('[snapshotBuilder] built snapshot', { alias, slug, patientId, weeks: weeksRaw.length, elapsedMs })
  return { slug, snapshotJson }
}


