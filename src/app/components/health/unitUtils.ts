// src/app/components/health/unitUtils.ts
// Utilities for unit conversion and formatting, and fetching a user's unit preference

import { supabase } from '../auth/AuthContext'

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

export function formatWeight(valueLbs: number | null | undefined, unitSystem: UnitSystem): string {
  if (valueLbs === null || valueLbs === undefined) return 'N/A'
  if (unitSystem === 'metric') {
    const kg = poundsToKilograms(valueLbs)
    return kg !== null ? `${kg.toFixed(2)} kg` : 'N/A'
  }
  return `${valueLbs.toFixed(2)} lbs`
}

export function formatLength(valueInches: number | null | undefined, unitSystem: UnitSystem): string {
  if (valueInches === null || valueInches === undefined) return 'N/A'
  if (unitSystem === 'metric') {
    const cm = inchesToCentimeters(valueInches)
    return cm !== null ? `${cm.toFixed(2)} cm` : 'N/A'
  }
  return `${valueInches.toFixed(2)} inches`
}

export function getWeightUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === 'metric' ? 'kg' : 'lbs'
}

export function getLengthUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === 'metric' ? 'cm' : 'inches'
}

export async function fetchUnitSystem(userId?: string): Promise<UnitSystem> {
  try {
    let id = userId
    if (!id) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return 'imperial'
      id = user.id
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('unit_system')
      .eq('id', id)
      .single()
    if (error) return 'imperial'
    const u = (data?.unit_system as UnitSystem) || 'imperial'
    return u === 'metric' ? 'metric' : 'imperial'
  } catch {
    return 'imperial'
  }
}

export function convertInputWeightToImperial(value: string, unitSystem: UnitSystem): number | null {
  if (!value && value !== '0') return null
  const num = parseFloat(value)
  if (isNaN(num)) return null
  if (unitSystem === 'metric') return kilogramsToPounds(num)
  return Math.round(num * 100) / 100
}

export function convertInputLengthToImperial(value: string, unitSystem: UnitSystem): number | null {
  if (!value && value !== '0') return null
  const num = parseFloat(value)
  if (isNaN(num)) return null
  if (unitSystem === 'metric') return centimetersToInches(num)
  return Math.round(num * 100) / 100
}


