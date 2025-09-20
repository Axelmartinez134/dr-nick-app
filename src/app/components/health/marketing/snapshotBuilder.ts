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
  selectedMedia: SelectedMedia
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

  // 4) Derived series and summary metrics
  const derived = buildDerived(weeksRaw)
  const metrics = computeSummaryMetrics(weeksRaw)

  // 5) Determine patient label
  const patientLabel = settings.displayNameMode === 'first_name'
    ? firstNameOnly(profile.full_name)
    : `Client ${shortIdFromSlug(slug)}`

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
        morningFatBurnTrend: false,
        bodyFatTrend: false
      },
      captionsEnabled: settings.captionsEnabled,
      layout: settings.layout,
      watermarkText: settings.watermarkText ?? null
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


