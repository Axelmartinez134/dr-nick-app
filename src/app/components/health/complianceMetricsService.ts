// src/app/components/health/complianceMetricsService.ts
// Service for calculating compliance metrics

import { supabase } from '../auth/AuthContext'
import { getWeeklyDataForCharts } from './healthService'

export interface ComplianceMetrics {
  nutritionGoalMet: number | null  // % Average Days Nutrition Goal Met
  strainTargetGoalMet: number | null  // % Average Days Strain Target Goal Met
  poorRecoveryPercentage: number | null  // % Average Days Poor Recovery  
  waistHeightGoalDistance: number | null  // Distance From Waist/Height Goal
  hasEnoughData: boolean
  dataPoints: number
  performanceMs: number
  error?: string
}

// Calculate all compliance metrics for a patient
export async function getComplianceMetrics(userId?: string): Promise<ComplianceMetrics> {
  const startTime = performance.now()
  
  try {
    // Get health data using existing function
    const { data: healthData, error: healthError } = await getWeeklyDataForCharts(userId)
    
    if (healthError) {
      return {
        nutritionGoalMet: null,
        strainTargetGoalMet: null,
        poorRecoveryPercentage: null,
        waistHeightGoalDistance: null,
        hasEnoughData: false,
        dataPoints: 0,
        performanceMs: performance.now() - startTime,
        error: typeof healthError === 'string' ? healthError : 'Error fetching health data'
      }
    }

    if (!healthData || healthData.length === 0) {
      return {
        nutritionGoalMet: null,
        strainTargetGoalMet: null,
        poorRecoveryPercentage: null,
        waistHeightGoalDistance: null,
        hasEnoughData: false,
        dataPoints: 0,
        performanceMs: performance.now() - startTime,
        error: 'No health data found'
      }
    }

    // Get current user ID for profile lookup
    let currentUserId = userId
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser()
      currentUserId = user?.id
    }

    // Get height from profile
    let height: number | null = null
    if (currentUserId) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('height')
        .eq('id', currentUserId)
        .single()
      
      height = profileData?.height || null
    }

    // Filter out Week 0 (baseline) for goal calculations
    const activeWeeks = healthData.filter(week => week.week_number > 0)
    
    // Calculate metrics
    const nutritionGoalMet = calculateNutritionGoalMet(activeWeeks)
    const strainTargetGoalMet = calculateStrainTargetGoalMet(activeWeeks)
    const poorRecoveryPercentage = calculatePoorRecoveryPercentage(activeWeeks)
    const waistHeightGoalDistance = await calculateWaistHeightGoalDistance(activeWeeks, userId)
    
    const endTime = performance.now()
    const performanceMs = endTime - startTime
    
    return {
      nutritionGoalMet,
      strainTargetGoalMet,
      poorRecoveryPercentage,
      waistHeightGoalDistance,
      hasEnoughData: activeWeeks.length >= 2,
      dataPoints: activeWeeks.length,
      performanceMs,
      error: undefined
    }

  } catch (error) {
    return {
      nutritionGoalMet: null,
      strainTargetGoalMet: null,
      poorRecoveryPercentage: null,
      waistHeightGoalDistance: null,
      hasEnoughData: false,
      dataPoints: 0,
      performanceMs: performance.now() - startTime,
      error: `Error calculating compliance metrics: ${error}`
    }
  }
}

// Calculate % Average Days Nutrition Goal Met
function calculateNutritionGoalMet(activeWeeks: any[]): number | null {
  if (activeWeeks.length === 0) return null
  
  // Filter weeks that have valid nutrition compliance data (0-7 days only)
  const weeksWithValidNutritionData = activeWeeks.filter(week => 
    week.nutrition_compliance_days !== null && 
    week.nutrition_compliance_days !== undefined &&
    week.nutrition_compliance_days >= 0 &&
    week.nutrition_compliance_days <= 7
  )
  
  if (weeksWithValidNutritionData.length === 0) return null
  
  // Calculate compliance percentage for each week (nutrition_compliance_days / 7 * 100)
  const weeklyCompliances = weeksWithValidNutritionData.map(week => 
    (week.nutrition_compliance_days / 7) * 100
  )
  
  // Return average compliance across all weeks
  const averageCompliance = weeklyCompliances.reduce((sum, compliance) => sum + compliance, 0) / weeklyCompliances.length
  
  return Math.round(averageCompliance * 100) / 100 // Round to 2 decimal places
}

// Calculate % Average Days Strain Target Goal Met
function calculateStrainTargetGoalMet(activeWeeks: any[]): number | null {
  if (activeWeeks.length === 0) return null
  
  // Filter weeks that have valid purposeful exercise data (0-7 days only)
  // Exclude legacy data where values > 7 (old minute data from focal_heart_rate_training)
  const weeksWithValidExerciseData = activeWeeks.filter(week => 
    week.purposeful_exercise_days !== null && 
    week.purposeful_exercise_days !== undefined &&
    week.purposeful_exercise_days >= 0 &&
    week.purposeful_exercise_days <= 7  // Only include valid day counts (0-7)
  )
  
  if (weeksWithValidExerciseData.length === 0) return null
  
  // Calculate compliance percentage for each week (purposeful_exercise_days / 7 * 100)
  const weeklyCompliances = weeksWithValidExerciseData.map(week => 
    (week.purposeful_exercise_days / 7) * 100
  )
  
  // Return average compliance across all weeks
  const averageCompliance = weeklyCompliances.reduce((sum, compliance) => sum + compliance, 0) / weeklyCompliances.length
  
  return Math.round(averageCompliance * 100) / 100 // Round to 2 decimal places
}

// Calculate % Average Days Poor Recovery
// Total poor recovery days as percentage of total possible days since program start
function calculatePoorRecoveryPercentage(allData: any[]): number | null {
  if (allData.length === 0) return null
  
  // Filter weeks that have poor recovery data
  const weeksWithRecoveryData = allData.filter(week => 
    week.poor_recovery_days !== null && 
    week.poor_recovery_days !== undefined
  )
  
  if (weeksWithRecoveryData.length === 0) return null
  
  // Sum total poor recovery days
  const totalPoorRecoveryDays = weeksWithRecoveryData.reduce((sum, week) => 
    sum + (week.poor_recovery_days || 0), 0
  )
  
  // Total possible days = number of weeks * 7 days per week
  const totalPossibleDays = weeksWithRecoveryData.length * 7
  
  // Calculate percentage
  const poorRecoveryPercentage = (totalPoorRecoveryDays / totalPossibleDays) * 100
  
  return Math.round(poorRecoveryPercentage * 100) / 100 // Round to 2 decimal places
}

// Calculate Distance From Waist/Height Goal
// Goal: Waist/Height ratio of 0.5
// Distance = (current_waist / height) - 0.5
async function calculateWaistHeightGoalDistance(allData: any[], userId: string | undefined): Promise<number | null> {
  if (!userId) return null // Need userId for calculation
  
  // Get height from profile
  let height: number | null = null
  if (userId) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('height')
      .eq('id', userId)
      .single()
    
    height = profileData?.height || null
  }

  if (!height || height <= 0) return null // Need height for calculation
  
  // Get most recent waist measurement
  const sortedData = [...allData]
    .filter(d => d.waist !== null && d.waist !== undefined)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  
  if (sortedData.length === 0) return null
  
  const latestWaist = sortedData[0].waist
  
  // Calculate current ratio
  const currentRatio = latestWaist / height
  
  // Distance from goal (0.5)
  const distance = currentRatio - 0.5
  
  return Math.round(distance * 1000) / 1000 // Round to 3 decimal places
} 