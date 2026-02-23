// src/app/components/health/metricsService.ts
// Metrics calculation service for patient weight loss KPIs
// Uses runtime calculations with existing getWeeklyDataForCharts function

import { getWeeklyDataForCharts, WeeklyCheckin } from './healthService'
import { supabase } from '../auth/AuthContext'

// Performance monitoring thresholds (based on our scaling strategy)
const PERFORMANCE_THRESHOLDS = {
  SWEET_SPOT_MAX_MS: 500,     // 500ms = sweet spot limit
  YELLOW_FLAG_MS: 1000,       // 1s = monitoring needed
  RED_FLAG_MS: 2000,          // 2s = optimization required
  MAX_USERS_CURRENT: 1000,    // Current architecture limit
  OPTIMIZATION_NEEDED: 5000   // Users requiring database optimization
}

export interface MetricsData {
  totalWeightLossPercentage: number | null
  weeklyWeightLossPercentage: number | null
  weightChangeGoalPercent: number | null
  hasEnoughData: boolean
  dataPoints: number
  performanceMs: number
  error: string | null
}

// Calculate weight loss percentage metrics
export async function getPatientMetrics(userId?: string): Promise<MetricsData> {
  const startTime = performance.now()
  
  try {
    // Use existing getWeeklyDataForCharts function (zero database changes)
    // Pass userId if provided (Dr. Nick view), or undefined for current user (patient view)
    const { data, error } = await getWeeklyDataForCharts(userId)
    
    if (error) {
      return {
        totalWeightLossPercentage: null,
        weeklyWeightLossPercentage: null,
        weightChangeGoalPercent: null,
        hasEnoughData: false,
        dataPoints: 0,
        performanceMs: performance.now() - startTime,
        error: typeof error === 'string' ? error : 'Error fetching health data'
      }
    }

    if (!data || data.length === 0) {
      return {
        totalWeightLossPercentage: null,
        weeklyWeightLossPercentage: null,
        weightChangeGoalPercent: null,
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

    // Fetch weight change goal from profile
    let weightChangeGoalPercent: number | null = null
    if (currentUserId) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('weight_change_goal_percent')
        .eq('id', currentUserId)
        .single()
      
      weightChangeGoalPercent = profileData?.weight_change_goal_percent || 1.0
    }

    // Sort data by week number to ensure proper calculation
    const sortedData = [...data].sort((a, b) => a.week_number - b.week_number)
    
    // Find Week 0 (baseline) and most recent week with weight data
    const weekZero = sortedData.find(d => d.week_number === 0 && d.weight)
    const latestWeek = [...sortedData].reverse().find(d => d.weight && d.week_number > 0)
    const secondLatestWeek = [...sortedData].reverse().find(d => 
      d.weight && d.week_number >= 0 && d.week_number < (latestWeek?.week_number || 0)
    )

    // Calculate Total Weight Loss % (primary KPI)
    let totalWeightLossPercentage: number | null = null
    if (weekZero?.weight && latestWeek?.weight) {
      const weightLoss = weekZero.weight - latestWeek.weight
      totalWeightLossPercentage = Math.round((weightLoss / weekZero.weight) * 100 * 10) / 10 // Round to 1 decimal
    }

    // Calculate Week-over-Week Weight Loss %
    let weeklyWeightLossPercentage: number | null = null
    if (secondLatestWeek?.weight && latestWeek?.weight) {
      const weeklyLoss = secondLatestWeek.weight - latestWeek.weight
      const weekGap = Math.max(1, (latestWeek.week_number || 0) - (secondLatestWeek.week_number || 0))
      // Normalize over missing-week gaps so this represents average per-week change.
      weeklyWeightLossPercentage = Math.round((((weeklyLoss / secondLatestWeek.weight) * 100) / weekGap) * 10) / 10 // Round to 1 decimal
    }

    const performanceMs = performance.now() - startTime
    
    // Performance monitoring (dev-only; avoid console spam in production)
    if (process.env.NODE_ENV !== 'production') {
      if (performanceMs > PERFORMANCE_THRESHOLDS.RED_FLAG_MS) {
        console.warn(`🚨 METRICS PERFORMANCE RED FLAG: ${performanceMs}ms (>${PERFORMANCE_THRESHOLDS.RED_FLAG_MS}ms). Database optimization needed.`)
      } else if (performanceMs > PERFORMANCE_THRESHOLDS.YELLOW_FLAG_MS) {
        console.warn(`⚠️ METRICS PERFORMANCE YELLOW FLAG: ${performanceMs}ms (>${PERFORMANCE_THRESHOLDS.YELLOW_FLAG_MS}ms). Monitor performance.`)
      } else if (performanceMs <= PERFORMANCE_THRESHOLDS.SWEET_SPOT_MAX_MS) {
        console.log(`✅ METRICS PERFORMANCE SWEET SPOT: ${performanceMs}ms`)
      }
    }

    // Tighten hasEnoughData: Week 0 present AND at least one week >0 with a valid weight
    const hasAtLeastOneWeightedWeek = sortedData.some(d => d.week_number > 0 && !!d.weight)

    return {
      totalWeightLossPercentage,
      weeklyWeightLossPercentage,
      weightChangeGoalPercent,
      hasEnoughData: !!weekZero && hasAtLeastOneWeightedWeek,
      dataPoints: sortedData.length,
      performanceMs,
      error: null
    }

  } catch (err) {
    const performanceMs = performance.now() - startTime
    console.error('Error calculating patient metrics:', err)
    
    return {
      totalWeightLossPercentage: null,
      weeklyWeightLossPercentage: null,
      weightChangeGoalPercent: null,
      hasEnoughData: false,
      dataPoints: 0,
      performanceMs,
      error: err instanceof Error ? err.message : 'Unknown error calculating metrics'
    }
  }
}

// Helper function to get contextual insights based on metrics
export function getMetricsInsights(metrics: MetricsData): string[] {
  const insights: string[] = []
  
  if (!metrics.hasEnoughData) {
    insights.push("Complete your first few check-ins to see your progress metrics!")
    return insights
  }

  // Total weight loss insights
  if (metrics.totalWeightLossPercentage !== null) {
    if (metrics.totalWeightLossPercentage >= 10) {
      insights.push("🎉 Outstanding progress! You've achieved significant weight loss.")
    } else if (metrics.totalWeightLossPercentage >= 5) {
      insights.push("💪 Great job! You're making excellent progress toward your goals.")
    } else if (metrics.totalWeightLossPercentage >= 2) {
      insights.push("📈 Good progress! Keep up the consistent effort.")
    } else if (metrics.totalWeightLossPercentage >= 0) {
      insights.push("🎯 Every step counts! Stay consistent with your plan.")
    } else {
      insights.push("💡 Focus on consistency. Dr. Nick can help adjust your approach.")
    }
  }

  // Weekly progress insights
  if (metrics.weeklyWeightLossPercentage !== null) {
    if (metrics.weeklyWeightLossPercentage >= 2) {
      insights.push("🔥 Strong weekly progress! You're in a great rhythm.")
    } else if (metrics.weeklyWeightLossPercentage >= 1) {
      insights.push("✨ Solid weekly improvement! Consistency is key.")
    } else if (metrics.weeklyWeightLossPercentage >= 0) {
      insights.push("📊 Maintaining progress. Focus on your weekly habits.")
    } else {
      insights.push("🎯 Weekly fluctuations are normal. Trust the process.")
    }
  }

  return insights
}

// Export performance thresholds for monitoring dashboard (future feature)
export { PERFORMANCE_THRESHOLDS } 