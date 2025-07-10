// src/app/components/health/regressionUtils.ts
// Linear regression utility for adding trend lines to all charts
// Used to calculate dark black regression lines from Week 0 to latest week

export interface RegressionPoint {
  week: number
  value: number
}

export interface RegressionResult {
  slope: number
  intercept: number
  rSquared: number
  isValid: boolean
  trendPoints: Array<{ week: number; value: number }>
  
  // HOVER EFFECT DATA - Easy to remove by commenting out these fields
  equation: string          // e.g., "y = -1.2x + 200"
  weeklyChange: number      // e.g., -1.2 (lbs/week or units/week)
  totalChange: number       // e.g., -15.6 (total change over period)
  correlation: string       // e.g., "Strong" | "Moderate" | "Weak"
}

/**
 * Calculate linear regression for trend line
 * @param data Array of {week, value} points
 * @param minWeek Start week (usually 0)
 * @param maxWeek End week (latest available)
 * @returns RegressionResult with trend line data
 */
export function calculateLinearRegression(
  data: RegressionPoint[],
  minWeek: number,
  maxWeek: number
): RegressionResult {
  // Filter out null/undefined values and ensure we have valid data
  const validData = data.filter(point => 
    point.week !== null && 
    point.week !== undefined && 
    point.value !== null && 
    point.value !== undefined &&
    !isNaN(point.week) &&
    !isNaN(point.value)
  )

  // Need at least 2 points for regression
  if (validData.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      isValid: false,
      trendPoints: [],
      equation: "Insufficient data",
      weeklyChange: 0,
      totalChange: 0,
      correlation: "None"
    }
  }

  // Calculate linear regression using least squares method
  const n = validData.length
  const sumX = validData.reduce((sum, point) => sum + point.week, 0)
  const sumY = validData.reduce((sum, point) => sum + point.value, 0)
  const sumXY = validData.reduce((sum, point) => sum + (point.week * point.value), 0)
  const sumXX = validData.reduce((sum, point) => sum + (point.week * point.week), 0)
  const sumYY = validData.reduce((sum, point) => sum + (point.value * point.value), 0)

  // Calculate slope and intercept
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Calculate R-squared (coefficient of determination)
  const yMean = sumY / n
  const ssRes = validData.reduce((sum, point) => {
    const predicted = slope * point.week + intercept
    return sum + Math.pow(point.value - predicted, 2)
  }, 0)
  const ssTot = validData.reduce((sum, point) => {
    return sum + Math.pow(point.value - yMean, 2)
  }, 0)
  const rSquared = ssTot === 0 ? 1 : 1 - (ssRes / ssTot)

  // Generate trend line points from minWeek to maxWeek
  const trendPoints: Array<{ week: number; value: number }> = []
  for (let week = minWeek; week <= maxWeek; week++) {
    const value = slope * week + intercept
    trendPoints.push({ week, value })
  }

  // HOVER EFFECT CALCULATIONS - Easy to remove by commenting out this section
  // =============================================================================
  const weeklyChange = slope
  const totalChange = slope * (maxWeek - minWeek)
  const absRSquared = Math.abs(rSquared)
  const correlation = absRSquared >= 0.7 ? "Strong" : 
                     absRSquared >= 0.4 ? "Moderate" : "Weak"
  const equation = `y = ${slope >= 0 ? '' : '-'}${Math.abs(slope).toFixed(2)}x + ${intercept.toFixed(1)}`
  // =============================================================================

  return {
    slope,
    intercept,
    rSquared,
    isValid: true,
    trendPoints,
    equation,
    weeklyChange,
    totalChange,
    correlation
  }
}

/**
 * Merge trend line data with existing chart data
 * @param chartData Original chart data
 * @param regressionResult Regression calculation result
 * @param trendFieldName Field name for trend line (default: 'trendLine')
 * @returns Enhanced chart data with trend line values
 */
export function mergeDataWithTrendLine<T extends { week: number }>(
  chartData: T[],
  regressionResult: RegressionResult,
  trendFieldName: string = 'trendLine'
): Array<T & { [key: string]: number | null }> {
  if (!regressionResult.isValid) {
    return chartData.map(point => ({
      ...point,
      [trendFieldName]: null
    }))
  }

  return chartData.map(point => {
    const trendPoint = regressionResult.trendPoints.find(tp => tp.week === point.week)
    return {
      ...point,
      [trendFieldName]: trendPoint ? trendPoint.value : null
    }
  })
}

/**
 * HOVER EFFECT HELPER - Easy to remove by commenting out this entire function
 * =============================================================================
 * Helper function to format trend line hover information
 * Returns formatted string for trend line tooltips
 */
export function formatTrendLineHover(
  regressionResult: RegressionResult,
  unit: string = ""
): string {
  if (!regressionResult.isValid) return "Insufficient data for trend analysis"

  const { weeklyChange, totalChange, correlation, rSquared } = regressionResult
  
  return `📈 Trend Analysis
Weekly Change: ${weeklyChange > 0 ? '+' : ''}${weeklyChange.toFixed(2)} ${unit}/week
Total Change: ${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} ${unit}
Correlation: ${correlation} (R² = ${rSquared.toFixed(3)})`
}
// ============================================================================= 