import { SnapshotWeek, SnapshotDerived } from './snapshotTypes'
import { calculateLinearRegression } from '../regressionUtils'

type Point = [number, number]

function toSeries(weeks: SnapshotWeek[], key: keyof SnapshotWeek['fields']): Point[] {
  return weeks
    .filter(w => typeof w.week_number === 'number' && w.fields && w.fields[key] !== null && w.fields[key] !== undefined)
    .map(w => [w.week_number, Number(w.fields[key] as number)])
    .sort((a, b) => a[0] - b[0]) as Point[]
}

function projectWeight(pts: Point[]): Point[] {
  if (!pts || pts.length < 2) return []
  const minW = Math.min(...pts.map(p => p[0]))
  const maxW = Math.max(...pts.map(p => p[0]))
  const reg = calculateLinearRegression(
    pts.map(p => ({ week: p[0], value: p[1] })),
    minW,
    maxW
  )
  return reg.trendPoints.map(tp => [tp.week, tp.value]) as Point[]
}

function plateauSeries(pts: Point[]): { series: Point[]; lastValue: number | null } {
  if (!pts || pts.length < 2) return { series: [], lastValue: null }
  // Compute cumulative/rolling weekly loss % (mirrors plateau logic qualitatively)
  const sorted = [...pts].sort((a, b) => a[0] - b[0])
  const deltas: Array<{ week: number; lossPct: number }> = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1][1]
    const curr = sorted[i][1]
    if (prev && curr) {
      const lossPct = ((prev - curr) / prev) * 100
      deltas.push({ week: sorted[i][0], lossPct })
    }
  }
  if (deltas.length === 0) return { series: [], lastValue: null }

  const out: Point[] = []
  let lastVal: number | null = null
  for (let i = 0; i < deltas.length; i++) {
    const wk = deltas[i].week
    let value: number
    if (wk === 1) value = deltas[i].lossPct
    else if (wk === 2) {
      const w1 = deltas.find(d => d.week === 1)?.lossPct ?? 0
      value = (w1 + deltas[i].lossPct) / 2
    } else if (wk === 3) {
      const w1 = deltas.find(d => d.week === 1)?.lossPct ?? 0
      const w2 = deltas.find(d => d.week === 2)?.lossPct ?? 0
      value = (w1 + w2 + deltas[i].lossPct) / 3
    } else if (wk === 4) {
      const w1 = deltas.find(d => d.week === 1)?.lossPct ?? 0
      const w2 = deltas.find(d => d.week === 2)?.lossPct ?? 0
      const w3 = deltas.find(d => d.week === 3)?.lossPct ?? 0
      value = (w1 + w2 + w3 + deltas[i].lossPct) / 4
    } else {
      const recent = deltas.filter(d => d.week <= wk).slice(-4)
      const sum = recent.reduce((acc, d) => acc + d.lossPct, 0)
      value = recent.length > 0 ? sum / recent.length : deltas[i].lossPct
    }
    const rounded = Math.round(value * 100) / 100
    out.push([wk, rounded])
    lastVal = rounded
  }
  return { series: out, lastValue: lastVal }
}

export function buildDerived(weeks: SnapshotWeek[]): SnapshotDerived {
  const weight = toSeries(weeks, 'weight')
  const waist = toSeries(weeks, 'waist')
  const nutritionDays = toSeries(weeks, 'nutrition_compliance_days')
  const sleepScore = toSeries(weeks, 'sleep_consistency_score')
  const mfb = toSeries(weeks, 'morning_fat_burn_percent')
  const bodyFat = toSeries(weeks, 'body_fat_percentage')

  const weightTrend = weight
  const projection = projectWeight(weight)
  const { series: plateauWeight, lastValue: plateauWeightLastValue } = plateauSeries(weight)
  const waistTrend = waist
  const { series: plateauWaist } = plateauSeries(waist)

  // Nutrition: convert days (0..7) to percent
  const nutritionCompliancePct: Point[] = nutritionDays.map(([w, d]) => [w, Math.round(((d / 7) * 100) * 100) / 100])

  const sleepTrend = sleepScore
  const morningFatBurnTrend = mfb
  const bodyFatTrend = bodyFat

  return {
    weightTrend,
    projection,
    plateauWeight,
    plateauWeightLastValue: plateauWeightLastValue ?? null,
    waistTrend,
    plateauWaist,
    nutritionCompliancePct,
    sleepTrend,
    morningFatBurnTrend,
    bodyFatTrend
  }
}


