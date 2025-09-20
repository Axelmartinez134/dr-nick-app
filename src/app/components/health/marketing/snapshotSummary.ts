import { SnapshotWeek, SnapshotMetrics } from './snapshotTypes'

function round(value: number, decimals = 2): number {
  const p = Math.pow(10, decimals)
  return Math.round(value * p) / p
}

function getSortedWeightWeeks(weeks: SnapshotWeek[]): Array<{ week: number; weight: number }> {
  return weeks
    .filter(w => typeof w.week_number === 'number' && w.fields && w.fields.weight !== null && w.fields.weight !== undefined)
    .map(w => ({ week: w.week_number, weight: Number(w.fields.weight as number) }))
    .sort((a, b) => a.week - b.week)
}

export function computeSummaryMetrics(
  weeks: SnapshotWeek[],
  opts?: { avgDecimals?: number; pctDecimals?: number }
): SnapshotMetrics {
  const pctDecimals = opts?.pctDecimals ?? 1 // align with existing UI usage
  const avgDecimals = opts?.avgDecimals ?? 2

  // Total and weekly loss % from weight
  let totalLossPct: number | null = null
  let weeklyLossPct: number | null = null

  const weights = getSortedWeightWeeks(weeks)
  const weekZero = weights.find(w => w.week === 0)
  const latest = [...weights].reverse().find(w => w.week > 0)
  const secondLatest = [...weights].reverse().find(w => w.week >= 0 && w.week < (latest?.week ?? 0))

  if (weekZero && latest) {
    const loss = weekZero.weight - latest.weight
    if (weekZero.weight > 0) {
      totalLossPct = round((loss / weekZero.weight) * 100, pctDecimals)
    }
  }

  if (secondLatest && latest && secondLatest.weight > 0) {
    const weeklyLoss = secondLatest.weight - latest.weight
    weeklyLossPct = round((weeklyLoss / secondLatest.weight) * 100, pctDecimals)
  }

  // Averages for nutrition % and exercise days
  const nutritionPoints = weeks
    .map(w => (w.fields?.nutrition_compliance_days ?? null))
    .filter(v => v !== null && v !== undefined) as number[]

  const avgNutritionCompliancePct = nutritionPoints.length > 0
    ? round((nutritionPoints.reduce((a, b) => a + b, 0) / nutritionPoints.length / 7) * 100, 2)
    : null

  const exercisePoints = weeks
    .map(w => (w.fields?.purposeful_exercise_days ?? null))
    .filter(v => v !== null && v !== undefined) as number[]

  const avgPurposefulExerciseDays = exercisePoints.length > 0
    ? round(exercisePoints.reduce((a, b) => a + b, 0) / exercisePoints.length, avgDecimals)
    : null

  return {
    totalLossPct,
    weeklyLossPct,
    avgNutritionCompliancePct,
    avgPurposefulExerciseDays
  }
}


