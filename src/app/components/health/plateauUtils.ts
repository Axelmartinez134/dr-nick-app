// src/app/components/health/plateauUtils.ts

export interface WeekWeightEntry {
  week_number: number
  weight?: number | null
}

// Compute Plateau Prevention (Weight Loss Rate) for a specific week using
// progressive averaging: weeks 1–4 use cumulative mean of individual week losses;
// week 5+ uses a rolling 4-week mean of individual week losses.
// Returns a value rounded to 2 decimals, or null if not computable.
export function computePlateauPreventionRateForWeek(
  historicalData: WeekWeightEntry[],
  targetWeek: number
): number | null {
  if (!historicalData || typeof targetWeek !== 'number' || targetWeek <= 0) {
    return null
  }

  // 1) Filter and sort weeks with weight
  const allWeeks = (historicalData || [])
    .filter(w => w && w.weight !== null && w.weight !== undefined)
    .sort((a, b) => a.week_number - b.week_number)

  if (allWeeks.length < 2) return null

  // 2) Build individual week losses vs immediately previous recorded week
  const individual: Array<{ week: number; loss: number }> = []
  for (let i = 1; i < allWeeks.length; i++) {
    const curr = allWeeks[i]
    const prev = allWeeks[i - 1]
    if (curr.week_number > 0 && prev.weight && curr.weight) {
      const loss = ((prev.weight - curr.weight) / prev.weight) * 100
      individual.push({ week: curr.week_number, loss })
    }
  }

  if (individual.length === 0) return null

  // Ensure we have an entry for the target week
  const lastForTarget = individual.find(w => w.week === targetWeek)
  if (!lastForTarget) return null

  let value: number

  if (targetWeek === 1) {
    value = lastForTarget.loss
  } else if (targetWeek === 2) {
    const w1 = individual.find(w => w.week === 1)?.loss ?? 0
    value = (w1 + lastForTarget.loss) / 2
  } else if (targetWeek === 3) {
    const w1 = individual.find(w => w.week === 1)?.loss ?? 0
    const w2 = individual.find(w => w.week === 2)?.loss ?? 0
    value = (w1 + w2 + lastForTarget.loss) / 3
  } else if (targetWeek === 4) {
    const w1 = individual.find(w => w.week === 1)?.loss ?? 0
    const w2 = individual.find(w => w.week === 2)?.loss ?? 0
    const w3 = individual.find(w => w.week === 3)?.loss ?? 0
    value = (w1 + w2 + w3 + lastForTarget.loss) / 4
  } else {
    // Rolling 4-week mean up to and including targetWeek
    const upToTarget = individual.filter(w => w.week <= targetWeek)
    const recent = upToTarget.slice(-4)
    if (recent.length === 0) return null
    const sum = recent.reduce((acc, w) => acc + w.loss, 0)
    value = sum / recent.length
  }

  return Math.round(value * 100) / 100
}


