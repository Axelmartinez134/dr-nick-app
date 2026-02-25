// src/app/lib/grok/format.ts
// Server-safe Grok formatting utilities (no client-only imports).

export interface GrokDataPackage {
  patient_profile: {
    full_name: string
    email: string
    height: number | null
    protein_goal_grams: number | null
    weight_change_goal_percent: number | null
    created_date: string
    track_blood_pressure?: boolean
  }
  current_week: {
    week_number: number
    submission_date: string
    weight: number | null
    waist: number | null
    purposeful_exercise_days: number | null
    symptom_tracking_days: number | null
    detailed_symptom_notes: string | null
    poor_recovery_days: number | null
    sleep_consistency_score: number | null
    nutrition_compliance_days: number | null
    energetic_constraints_reduction_ok: boolean | null
    patient_notes: string | null
    systolic_bp?: number | null
    diastolic_bp?: number | null
    visceral_fat_level?: number | null
    subcutaneous_fat_level?: number | null
    belly_fat_percent?: number | null
    resting_heart_rate?: number | null
    total_muscle_mass_percent?: number | null
  }
  historical_data: Array<{
    week_number: number
    date: string
    weight: number | null
    waist: number | null
    purposeful_exercise_days: number | null
    symptom_tracking_days: number | null
    detailed_symptom_notes: string | null
    poor_recovery_days: number | null
    sleep_consistency_score: number | null
    nutrition_compliance_days: number | null
    patient_notes: string | null
    systolic_bp?: number | null
    diastolic_bp?: number | null
    visceral_fat_level?: number | null
    subcutaneous_fat_level?: number | null
    belly_fat_percent?: number | null
    resting_heart_rate?: number | null
    total_muscle_mass_percent?: number | null
  }>
  current_week_analysis: {
    weekly_whoop_analysis: string | null
    monthly_whoop_analysis: string | null
  }
  monday_message: {
    message_content: string | null
    generated_date: string | null
  }
  calculated_metrics: {
    total_weight_loss_percentage: number | null
    weekly_weight_loss_percentage: number | null
    plateau_prevention_rate: number | null
    weeks_of_data: number
    baseline_weight: number | null
    current_trend: string
  }
}

function poundsToKilograms(lbs: number | null | undefined): number | null {
  if (lbs === null || lbs === undefined) return null
  return Math.round((lbs * 0.45359237) * 100) / 100
}

function inchesToCentimeters(inches: number | null | undefined): number | null {
  if (inches === null || inches === undefined) return null
  return Math.round((inches * 2.54) * 100) / 100
}

// Format data for Grok (human-readable format)
export function formatDataForGrok(
  data: GrokDataPackage,
  prompt: string,
  unitSystem: 'imperial' | 'metric' = 'imperial'
): string {
  const toTwo = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100)
  const formatWeightVal = (lbs: number | null) => {
    if (lbs === null) return 'N/A'
    if (unitSystem === 'metric') {
      const kg = toTwo(poundsToKilograms(lbs))
      return kg !== null ? `${kg.toFixed(2)} kg` : 'N/A'
    }
    return `${toTwo(lbs)!.toFixed(2)} lbs`
  }
  const formatLengthVal = (inches: number | null) => {
    if (inches === null) return 'N/A'
    if (unitSystem === 'metric') {
      const cm = toTwo(inchesToCentimeters(inches))
      return cm !== null ? `${cm.toFixed(2)} cm` : 'N/A'
    }
    return `${toTwo(inches)!.toFixed(2)} inches`
  }
  const formatNumber = (num: number | null) => (num !== null ? (Math.round(num * 100) / 100).toString() : 'N/A')
  const formatDate = (date: string | null) => (date ? new Date(date).toLocaleDateString() : 'N/A')

  return `PATIENT HEALTH ANALYSIS REQUEST

${prompt}

=== PATIENT PROFILE ===
Name: ${data.patient_profile.full_name}
Email: ${data.patient_profile.email}
Height: ${formatLengthVal(data.patient_profile.height)}
Protein Goal: ${formatNumber(data.patient_profile.protein_goal_grams)} grams
Weight Change Goal: ${formatNumber(data.patient_profile.weight_change_goal_percent)}% weekly
Program Start Date: ${formatDate(data.patient_profile.created_date)}
Track Blood Pressure: ${data.patient_profile.track_blood_pressure ? 'Yes' : 'No'}

=== CURRENT WEEK DATA (Week ${data.current_week.week_number}) ===
Submission Date: ${formatDate(data.current_week.submission_date)}
Weight: ${formatWeightVal(data.current_week.weight)}
Waist: ${formatLengthVal(data.current_week.waist)}
Purposeful Exercise Days: ${formatNumber(data.current_week.purposeful_exercise_days)}/7
Symptom Tracking Days: ${formatNumber(data.current_week.symptom_tracking_days)}/7
Poor Recovery Days: ${formatNumber(data.current_week.poor_recovery_days)}/7
Sleep Consistency Score: ${formatNumber(data.current_week.sleep_consistency_score)}
Nutrition Compliance Days: ${formatNumber(data.current_week.nutrition_compliance_days)}/7
Energetic Constraints Reduction OK: ${data.current_week.energetic_constraints_reduction_ok ? 'Yes' : 'No'}
Patient Notes: ${data.current_week.patient_notes || 'None'}
Detailed Symptom Notes: ${data.current_week.detailed_symptom_notes || 'None'}
Systolic BP: ${formatNumber(data.current_week.systolic_bp || null)} mmHg
Diastolic BP: ${formatNumber(data.current_week.diastolic_bp || null)} mmHg
Visceral Fat Level: ${formatNumber((data.current_week as any).visceral_fat_level || null)}
Subcutaneous Fat Level: ${formatNumber((data.current_week as any).subcutaneous_fat_level || null)}
Belly Fat: ${formatNumber((data.current_week as any).belly_fat_percent || null)}%
Resting Heart Rate: ${formatNumber((data.current_week as any).resting_heart_rate || null)} bpm
Total Muscle Mass: ${formatNumber((data.current_week as any).total_muscle_mass_percent || null)}%

=== HISTORICAL PROGRESSION ===
${data.historical_data
  .sort((a, b) => a.week_number - b.week_number)
  .map(
    entry =>
      `Week ${entry.week_number}: Weight ${formatWeightVal(entry.weight)}, Waist ${formatLengthVal(entry.waist)}, Exercise ${formatNumber(entry.purposeful_exercise_days)}/7, Symptoms ${formatNumber(entry.symptom_tracking_days)}/7, Sleep Score ${formatNumber(entry.sleep_consistency_score)}, Nutrition ${formatNumber(entry.nutrition_compliance_days)}/7, Systolic ${formatNumber(entry.systolic_bp || null)} mmHg, Diastolic ${formatNumber(entry.diastolic_bp || null)} mmHg, Visceral ${formatNumber((entry as any).visceral_fat_level || null)}, Subcutaneous ${formatNumber((entry as any).subcutaneous_fat_level || null)}, Belly Fat ${formatNumber((entry as any).belly_fat_percent || null)}%, RHR ${formatNumber((entry as any).resting_heart_rate || null)} bpm, Muscle ${formatNumber((entry as any).total_muscle_mass_percent || null)}%`
  )
  .join('\n')}

=== DR. NICK'S CURRENT ANALYSIS ===
Weekly Whoop Analysis: ${data.current_week_analysis.weekly_whoop_analysis || 'Not available'}
Monthly Whoop Analysis: ${data.current_week_analysis.monthly_whoop_analysis || 'Not available'}

=== MONDAY MORNING MESSAGE ===
${data.monday_message.message_content || 'Not generated yet'}

=== CALCULATED METRICS ===
Total Weight Loss: ${formatNumber(data.calculated_metrics.total_weight_loss_percentage)}%
Weekly Loss Rate: ${formatNumber(data.calculated_metrics.weekly_weight_loss_percentage)}%
Plateau Prevention (Weight Loss Rate) — Week ${data.current_week.week_number} [progressive averaging: weeks 1–4 = cumulative mean of weekly loss%; week 5+ = rolling 4-week mean based on individual week-over-week loss vs the immediately prior recorded week]: ${formatNumber(data.calculated_metrics.plateau_prevention_rate)}%
Weeks of Data: ${data.calculated_metrics.weeks_of_data}
Baseline Weight: ${formatWeightVal(data.calculated_metrics.baseline_weight)}
Current Trend: ${data.calculated_metrics.current_trend}

PLEASE ANALYZE AND PROVIDE RECOMMENDATIONS FOLLOWING THE EXACT FORMAT PROVIDED IN THE PROMPT.`
}

