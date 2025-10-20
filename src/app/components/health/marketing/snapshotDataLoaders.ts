// src/app/components/health/marketing/snapshotDataLoaders.ts
// Server-side data loaders for snapshot building
// These helpers accept a Supabase client (provided by the API route) and return
// normalized, type-safe objects ready for snapshot derivation.

export interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  unit_system: 'imperial' | 'metric' | null
  weight_change_goal_percent: number | null
  notes_preferences?: any
  track_blood_pressure?: boolean | null
  track_body_composition?: boolean | null
}

export interface HealthDataRow {
  id: string
  user_id: string
  week_number: number
  date?: string | null
  created_at?: string | null
  weight?: number | null
  waist?: number | null
  systolic_bp?: number | null
  diastolic_bp?: number | null
  sleep_consistency_score?: number | null
  morning_fat_burn_percent?: number | null
  body_fat_percentage?: number | null
  visceral_fat_level?: number | null
  subcutaneous_fat_level?: number | null
  belly_fat_percent?: number | null
  resting_heart_rate?: number | null
  total_muscle_mass_percent?: number | null
  nutrition_compliance_days?: number | null
  purposeful_exercise_days?: number | null
  symptom_tracking_days?: number | null
}

function toNum(val: any): number | null {
  if (val === null || val === undefined) return null
  const n = typeof val === 'number' ? val : Number(val)
  return Number.isFinite(n) ? n : null
}

export async function loadPatientProfile(supabase: any, patientId: string): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, unit_system, weight_change_goal_percent, notes_preferences, track_blood_pressure, track_body_composition')
    .eq('id', patientId)
    .single()

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`)
  }

  return {
    id: data.id,
    full_name: data.full_name ?? null,
    email: data.email ?? null,
    unit_system: (data.unit_system === 'metric' ? 'metric' : data.unit_system === 'imperial' ? 'imperial' : null),
    weight_change_goal_percent: toNum(data.weight_change_goal_percent),
    notes_preferences: data.notes_preferences,
    track_blood_pressure: typeof data.track_blood_pressure === 'boolean' ? data.track_blood_pressure : null,
    track_body_composition: typeof (data as any).track_body_composition === 'boolean' ? (data as any).track_body_composition : null
  }
}

export async function loadPatientWeeklyRows(supabase: any, patientId: string): Promise<HealthDataRow[]> {
  const { data, error } = await supabase
    .from('health_data')
    .select('*')
    .eq('user_id', patientId)
    .order('week_number', { ascending: true })

  if (error) {
    throw new Error(`Failed to load weekly health data: ${error.message}`)
  }

  const rows = (data || []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    week_number: Number(r.week_number) || 0,
    date: r.date ?? r.created_at ?? null,
    created_at: r.created_at ?? null,
    weight: toNum(r.weight),
    waist: toNum(r.waist),
    systolic_bp: toNum(r.systolic_bp),
    diastolic_bp: toNum(r.diastolic_bp),
    sleep_consistency_score: toNum(r.sleep_consistency_score),
    morning_fat_burn_percent: toNum(r.morning_fat_burn_percent),
    body_fat_percentage: toNum(r.body_fat_percentage),
    visceral_fat_level: toNum(r.visceral_fat_level),
    subcutaneous_fat_level: toNum(r.subcutaneous_fat_level),
    belly_fat_percent: toNum(r.belly_fat_percent),
    resting_heart_rate: toNum(r.resting_heart_rate),
    total_muscle_mass_percent: toNum(r.total_muscle_mass_percent),
    nutrition_compliance_days: toNum(r.nutrition_compliance_days),
    purposeful_exercise_days: toNum(r.purposeful_exercise_days),
    symptom_tracking_days: toNum(r.symptom_tracking_days)
  })) as HealthDataRow[]

  return rows
}


