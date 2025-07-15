// src/app/components/health/marketing/charts/MarketingWeightProjectionChart.tsx
// Marketing version of Weight Projection Chart with animation controls

'use client'

import { useState, useMemo, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { WeeklyCheckin, generateWeightProjections } from '../../healthService'
import { calculateLinearRegression, mergeDataWithTrendLine } from '../../regressionUtils'

interface MarketingWeightProjectionChartProps {
  data: WeeklyCheckin[]
  isAnimating: boolean
  animationDuration: number
  onAnimationComplete: () => void
}

export default function MarketingWeightProjectionChart({ 
  data, 
  isAnimating, 
  animationDuration, 
  onAnimationComplete 
}: MarketingWeightProjectionChartProps) {
  const [animatedData, setAnimatedData] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState(0)

  // Process actual weight data
  const actualWeightData = useMemo(() => {
    return data
      .filter(entry => entry.weight !== null)
      .sort((a, b) => a.week_number - b.week_number)
      .map(entry => ({
        week: entry.week_number,
        actualWeight: entry.weight
      }))
  }, [data])

  // Calculate chart data and projections
  const { initialWeight, chartData } = useMemo(() => {
    // Find initial weight from Week 0 or first available weight
    const initialWeightEntry = data.find(entry => 
      entry.week_number === 0 && (entry.initial_weight || entry.weight)
    )
    
    const initialWeight = initialWeightEntry?.initial_weight || 
                         initialWeightEntry?.weight || 
                         data.find(entry => entry.weight)?.weight

    if (!initialWeight) {
      return { initialWeight: null, chartData: [] }
    }

    // Calculate max week needed (latest actual data, minimum 16 weeks)
    const latestActualWeek = actualWeightData.length > 0 ? Math.max(...actualWeightData.map(d => d.week)) : 0
    const maxWeek = Math.max(16, latestActualWeek)

    // Generate projection data to match actual data length
    const projections = generateWeightProjections(initialWeight, maxWeek)
    const chartData: any[] = []

    for (let week = 0; week <= maxWeek; week++) {
      const dataPoint: any = { week }
      
      // Add actual weight if available
      const actualData = actualWeightData.find(d => d.week === week)
      if (actualData) {
        dataPoint.actualWeight = actualData.actualWeight
      }
      
      // Add projection data
      projections.forEach((projection, index) => {
        const projectionPoint = projection.data.find(p => p.week === week)
        if (projectionPoint) {
          dataPoint[`projection${index}`] = projectionPoint.weight
        }
      })
      
      chartData.push(dataPoint)
    }

    return { initialWeight, chartData }
  }, [data, actualWeightData])

  // Calculate regression for actual weight trend line
  const regressionResult = useMemo(() => {
    if (actualWeightData.length < 2) return { isValid: false, trendPoints: [], slope: 0, intercept: 0, rSquared: 0, equation: "", weeklyChange: 0, totalChange: 0, correlation: "None" }
    
    const regressionData = actualWeightData.map(d => ({ week: d.week, value: d.actualWeight! }))
    const minWeek = Math.min(...actualWeightData.map(d => d.week))
    const maxWeekForRegression = Math.max(...actualWeightData.map(d => d.week))
    
    return calculateLinearRegression(regressionData, minWeek, maxWeekForRegression)
  }, [actualWeightData])

  // Add trend line data to chart data
  const enhancedChartData = useMemo(() => {
    if (!regressionResult.isValid) return chartData
    
    return chartData.map(point => {
      // Only add trend line values for weeks where we have actual weight data
      const hasActualData = actualWeightData.some(d => d.week === point.week)
      const trendPoint = regressionResult.trendPoints.find(tp => tp.week === point.week)
      
      return {
        ...point,
        actualWeightTrendLine: (hasActualData && trendPoint) ? trendPoint.value : null
      }
    })
  }, [chartData, regressionResult, actualWeightData])

  // Animation effect
  useEffect(() => {
    if (isAnimating && enhancedChartData.length > 0) {
      setAnimatedData([])
      setCurrentWeek(0)
      
      const maxWeek = Math.max(...enhancedChartData.map(d => d.week))
      const stepDuration = animationDuration / (maxWeek + 1)
      
      const animateStep = (week: number) => {
        const dataToShow = enhancedChartData.filter(d => d.week <= week)
        setAnimatedData(dataToShow)
        setCurrentWeek(week)
        
        if (week >= maxWeek) {
          onAnimationComplete()
        } else {
          setTimeout(() => animateStep(week + 1), stepDuration)
        }
      }
      
      animateStep(0)
    } else if (!isAnimating) {
      setAnimatedData(enhancedChartData)
      setCurrentWeek(Math.max(...enhancedChartData.map(d => d.week), 0))
    }
  }, [isAnimating, animationDuration, enhancedChartData, onAnimationComplete])

  // Calculate Y-axis domain
  const calculateYAxisDomain = () => {
    const displayData = isAnimating ? animatedData : enhancedChartData
    const allValues: number[] = []
    
    // Add actual weight values
    actualWeightData.forEach(d => {
      if (d.actualWeight !== null && d.actualWeight !== undefined) {
        allValues.push(d.actualWeight)
      }
    })
    
    // Add all projection values
    displayData.forEach(point => {
      ['projection0', 'projection1', 'projection2', 'projection3'].forEach(key => {
        if (point[key] !== null && point[key] !== undefined) {
          allValues.push(point[key])
        }
      })
    })
    
    if (allValues.length === 0) return [0, 100]
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    const padding = (maxValue - minValue) * 0.1 // 10% padding
    
    return [minValue - padding, maxValue + padding]
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(1)} lbs`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const displayData = isAnimating ? animatedData : enhancedChartData

  if (displayData.length === 0 || !initialWeight) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">📈</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Weight Projections
        </h3>
        <p className="text-gray-600">
          {isAnimating ? 'Starting animation...' : 'No data available for weight projections'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📈 Weight Projections vs Actual
        </h3>
        <p className="text-sm text-gray-600">
          Compare actual progress against projected weight loss paths
          {isAnimating && ` (showing up to week ${currentWeek})`}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={displayData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="week" 
            label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: 'Weight (lbs)', angle: -90, position: 'insideLeft' }}
            domain={calculateYAxisDomain()}
            tickFormatter={(value) => `${Math.round(value * 10) / 10}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Actual weight line */}
          <Line 
            type="monotone" 
            dataKey="actualWeight" 
            stroke="#2563eb" 
            strokeWidth={4}
            dot={{ fill: '#2563eb', strokeWidth: 2, r: 6 }}
            activeDot={{ r: 8 }}
            name="Actual Weight"
            connectNulls={false}
            animationDuration={isAnimating ? animationDuration / 2 : 0}
          />
          
          {/* Projection lines */}
          <Line 
            type="monotone" 
            dataKey="projection0" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={false}
            name="1 lb/week"
            strokeDasharray="5 5"
            animationDuration={isAnimating ? animationDuration / 2 : 0}
          />
          <Line 
            type="monotone" 
            dataKey="projection1" 
            stroke="#f59e0b" 
            strokeWidth={2}
            dot={false}
            name="1.5 lbs/week"
            strokeDasharray="5 5"
            animationDuration={isAnimating ? animationDuration / 2 : 0}
          />
          <Line 
            type="monotone" 
            dataKey="projection2" 
            stroke="#ef4444" 
            strokeWidth={2}
            dot={false}
            name="2 lbs/week"
            strokeDasharray="5 5"
            animationDuration={isAnimating ? animationDuration / 2 : 0}
          />
          <Line 
            type="monotone" 
            dataKey="projection3" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            dot={false}
            name="2.5 lbs/week"
            strokeDasharray="5 5"
            animationDuration={isAnimating ? animationDuration / 2 : 0}
          />
          
          {/* Trend line for actual weight */}
          {regressionResult.isValid && (
            <Line 
              type="monotone" 
              dataKey="actualWeightTrendLine" 
              stroke="#000000" 
              strokeWidth={2}
              dot={false}
              activeDot={false}
              name="Actual Trend"
              connectNulls={false}
              animationDuration={isAnimating ? animationDuration / 2 : 0}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Blue line: Actual weight progress</p>
        <p>• Dashed lines: Projected weight loss paths</p>
        <p>• Black line: Actual trend direction</p>
      </div>
    </div>
  )
} 