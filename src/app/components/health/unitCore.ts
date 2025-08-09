// src/app/components/health/unitCore.ts
// Pure unit conversion and labeling helpers (no runtime dependencies)

export type UnitSystem = 'imperial' | 'metric'

export function poundsToKilograms(lbs: number | null | undefined): number | null {
  if (lbs === null || lbs === undefined) return null
  return Math.round((lbs * 0.45359237) * 100) / 100
}

export function kilogramsToPounds(kg: number | null | undefined): number | null {
  if (kg === null || kg === undefined) return null
  return Math.round((kg / 0.45359237) * 100) / 100
}

export function inchesToCentimeters(inches: number | null | undefined): number | null {
  if (inches === null || inches === undefined) return null
  return Math.round((inches * 2.54) * 100) / 100
}

export function centimetersToInches(cm: number | null | undefined): number | null {
  if (cm === null || cm === undefined) return null
  return Math.round((cm / 2.54) * 100) / 100
}

export function getWeightUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === 'metric' ? 'kg' : 'lbs'
}

export function getLengthUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === 'metric' ? 'cm' : 'inches'
}


