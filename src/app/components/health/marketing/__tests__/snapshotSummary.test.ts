import { describe, it, expect } from 'vitest'
import { computeSummaryMetrics } from '../snapshotSummary'
import type { SnapshotWeek } from '../snapshotTypes'

describe('computeSummaryMetrics', () => {
  it('computes totals and averages with proper rounding', () => {
    const weeks: SnapshotWeek[] = [
      { week_number: 0, fields: { weight: 200, nutrition_compliance_days: 5, purposeful_exercise_days: 4 } },
      { week_number: 1, fields: { weight: 198, nutrition_compliance_days: 6, purposeful_exercise_days: 5 } },
      { week_number: 2, fields: { weight: 196, nutrition_compliance_days: 4, purposeful_exercise_days: 3 } }
    ]

    const m = computeSummaryMetrics(weeks)
    expect(m.totalLossPct).toBeCloseTo(((200 - 196) / 200) * 100, 1)
    expect(m.weeklyLossPct).toBeCloseTo(((198 - 196) / 198) * 100, 1)
    expect(m.avgNutritionCompliancePct).toBeCloseTo(((5 + 6 + 4) / 3 / 7) * 100, 2)
    expect(m.avgPurposefulExerciseDays).toBeCloseTo((4 + 5 + 3) / 3, 2)
  })
})


