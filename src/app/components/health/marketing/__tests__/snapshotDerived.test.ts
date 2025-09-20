import { describe, it, expect } from 'vitest'
import { buildDerived } from '../snapshotDerived'
import type { SnapshotWeek } from '../snapshotTypes'

describe('buildDerived', () => {
  it('creates expected series arrays', () => {
    const weeks: SnapshotWeek[] = [
      { week_number: 0, fields: { weight: 200, waist: 36, nutrition_compliance_days: 5 } },
      { week_number: 1, fields: { weight: 198, waist: 35.5, nutrition_compliance_days: 6 } },
      { week_number: 2, fields: { weight: 196, waist: 35, nutrition_compliance_days: 4 } }
    ]

    const d = buildDerived(weeks)
    expect(d.weightTrend?.length).toBe(3)
    expect(d.projection && d.projection.length).toBeGreaterThan(0)
    expect(d.plateauWeight && d.plateauWeight.length).toBeGreaterThan(0)
    expect(typeof d.plateauWeightLastValue === 'number' || d.plateauWeightLastValue === null).toBe(true)
    expect(d.waistTrend?.length).toBe(3)
    expect(d.plateauWaist && d.plateauWaist.length).toBeGreaterThan(0)
    expect(d.nutritionCompliancePct?.[0][1]).toBeCloseTo((5 / 7) * 100, 2)
  })
})


