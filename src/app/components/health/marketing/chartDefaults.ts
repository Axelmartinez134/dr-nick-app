// Centralized defaults and helpers for charts configuration

export type ChartsEnabled = Record<string, boolean>

export interface ChartsDefaultsOptions {
  trackBloodPressure?: boolean
  trackBodyComposition?: boolean
}

// Full list of chart keys the marketing app supports (14 total)
export const ALL_CHART_KEYS: string[] = [
  'weightTrend',
  'projection',
  'plateauWeight',
  'waistTrend',
  'plateauWaist',
  'nutritionCompliancePct',
  'sleepTrend',
  'systolicTrend',
  'diastolicTrend',
  'strainTrend',
  'disciplineNutritionCompliancePct',
  'disciplineStrainTrend',
  'morningFatBurnTrend',
  'bodyFatTrend',
  // Body Composition
  'visceralFatLevel',
  'subcutaneousFatLevel',
  'bellyFatPercent',
  'restingHeartRate',
  'totalMuscleMassPercent'
]

// Default display order across sections (includes all 14)
export function defaultChartsOrder(): string[] {
  return [
    'weightTrend',
    'projection',
    'plateauWeight',
    'waistTrend',
    'plateauWaist',
    'nutritionCompliancePct',
    'sleepTrend',
    'systolicTrend',
    'diastolicTrend',
    'strainTrend',
    'disciplineNutritionCompliancePct',
    'disciplineStrainTrend',
    'morningFatBurnTrend',
    'bodyFatTrend',
    // RHR belongs with Metabolic Health
    'restingHeartRate',
    // Body Composition section (order within group)
    'visceralFatLevel',
    'subcutaneousFatLevel',
    'bellyFatPercent',
    'totalMuscleMassPercent'
  ]
}

// Compute defaults: all charts ON by default, except BP charts depend on trackBloodPressure
export function computeChartsEnabledDefaults(opts: ChartsDefaultsOptions = {}): ChartsEnabled {
  const trackBP = !!opts.trackBloodPressure
  const trackBC = !!opts.trackBodyComposition
  const base: ChartsEnabled = {}
  for (const key of ALL_CHART_KEYS) base[key] = true
  base.systolicTrend = trackBP
  base.diastolicTrend = trackBP
  // Body Composition defaults respect track flag
  base.visceralFatLevel = trackBC
  base.subcutaneousFatLevel = trackBC
  base.bellyFatPercent = trackBC
  // RHR is independent of Body Composition and defaults ON
  base.restingHeartRate = true
  base.totalMuscleMassPercent = trackBC
  return base
}

// Backfill a possibly-partial map with the complete defaults
export function backfillChartsEnabled(partial: ChartsEnabled | undefined, opts: ChartsDefaultsOptions = {}): ChartsEnabled {
  const defaults = computeChartsEnabledDefaults(opts)
  const result: ChartsEnabled = { ...defaults }
  if (partial && typeof partial === 'object') {
    for (const key of Object.keys(partial)) {
      // Only override known keys; ignore unknowns for safety
      if (ALL_CHART_KEYS.includes(key)) {
        result[key] = !!partial[key]
      }
    }
  }
  return result
}


