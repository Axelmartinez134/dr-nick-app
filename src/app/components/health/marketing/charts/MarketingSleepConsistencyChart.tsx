// src/app/components/health/marketing/charts/MarketingSleepConsistencyChart.tsx
// Marketing version of Sleep Consistency Chart with animation controls

'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { WeeklyCheckin } from '../../healthService'
import { calculateLinearRegression, mergeDataWithTrendLine } from '../../regressionUtils'

interface MarketingSleepConsistencyChartProps {
  data: WeeklyCheckin[]
  isAnimating: boolean
  animationDuration: number
  onAnimationComplete: () => void
  hideTooltips?: boolean
  hideTitles?: boolean
}

export default function MarketingSleepConsistencyChart({ 
  data, 
  isAnimating, 
  animationDuration, 
  onAnimationComplete,
  hideTooltips = false,
  hideTitles = false
}: MarketingSleepConsistencyChartProps) {
  const [animatedData, setAnimatedData] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState(0)

  // Process sleep data
  const chartData = data
    .filter(entry => entry.sleep_consistency_score !== null)
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      sleepScore: entry.sleep_consistency_score,
      date: entry.date // Keep raw date
    }))

  // Calculate regression for trend line
  const regressionResult = useMemo(() => {
    if (chartData.length < 2) return { isValid: false, trendPoints: [], slope: 0, intercept: 0, rSquared: 0, equation: "", weeklyChange: 0, totalChange: 0, correlation: "None" }
    
    const regressionData = chartData.map(d => ({ week: d.week, value: d.sleepScore! }))
    const minWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))
    
    return calculateLinearRegression(regressionData, minWeek, maxWeek)
  }, [chartData])

  // Merge trend line data with chart data
  const enhancedChartData = useMemo(() => {
    if (!regressionResult.isValid) return chartData.map(point => ({ ...point, trendLine: null }))
    
    return chartData.map(point => {
      // Only add trend line values for weeks where we have actual sleep data
      const hasActualData = chartData.some(d => d.week === point.week && d.sleepScore !== null)
      const trendPoint = regressionResult.trendPoints.find(tp => tp.week === point.week)
      
      return {
        ...point,
        trendLine: (hasActualData && trendPoint) ? trendPoint.value : null
      }
    })
  }, [chartData, regressionResult])

  // Animation effect (guarded)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasAnimatingRef = useRef(false)
  const lastDataRef = useRef<any[]>([])

  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (isAnimating && enhancedChartData.length > 0) {
      if (!wasAnimatingRef.current) {
        wasAnimatingRef.current = true
        setAnimatedData([])
        setCurrentWeek(0)
        const maxWeek = Math.max(...enhancedChartData.map(d => d.week))
        const stepDuration = animationDuration / (maxWeek + 1)
        const animateStep = (week: number) => {
          const dataToShow = enhancedChartData.filter(d => d.week <= week)
          setAnimatedData(dataToShow)
          setCurrentWeek(week)
          if (week < maxWeek) {
            timerRef.current = setTimeout(() => animateStep(week + 1), stepDuration)
          }
        }
        animateStep(0)
      }
    } else {
      if (wasAnimatingRef.current || lastDataRef.current !== enhancedChartData) {
        wasAnimatingRef.current = false
        lastDataRef.current = enhancedChartData
        setAnimatedData(enhancedChartData)
        setCurrentWeek(Math.max(...enhancedChartData.map(d => d.week), 0))
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [isAnimating, animationDuration, enhancedChartData])

  // Calculate Y-axis domain
  const calculateYAxisDomain = () => {
    const displayData = isAnimating ? animatedData : enhancedChartData
    const allValues: number[] = []
    
    displayData.forEach(d => {
      if (d.sleepScore !== null && d.sleepScore !== undefined && !isNaN(d.sleepScore)) {
        allValues.push(d.sleepScore)
      }
    })
    
    if (allValues.length === 0) return [0, 100] // Default range for sleep scores
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    
    // For sleep scores, we want to show the full 0-100 range with some padding
    const padding = 5 // 5 point padding
    
    return [Math.max(0, minValue - padding), Math.min(100, maxValue + padding)]
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const score = payload[0].value

      const formatDate = (dateStr: string) => {
        try {
          return new Date(dateStr).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })
        } catch {
          return dateStr
        }
      }
      
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-gray-800">
            {`Sleep Consistency Score: ${score}/100`}
          </p>
          {payload[0].payload.date && (
            <p className="text-gray-600 text-sm">
              {`Date: ${formatDate(payload[0].payload.date)}`}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  // Function to get line color based on score
  const getScoreColor = (score: number) => {
    if (score >= 67) return '#10b981' // Green - High Score
    if (score >= 34) return '#eab308' // Yellow - Middle Score
    return '#ef4444' // Red - Low Score
  }

  const displayData = isAnimating ? animatedData : enhancedChartData

  if (displayData.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">😴</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Sleep Consistency & Recovery
        </h3>
        <p className="text-gray-600">
          {isAnimating ? 'Starting animation...' : 'No sleep data available'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {!hideTitles && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            😴 Sleep Consistency & Recovery
          </h3>
          <p className="text-sm text-gray-600">
            Sleep consistency scores from Whoop data
            {isAnimating && ` (showing up to week ${currentWeek})`}
          </p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={displayData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="week" 
            label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: 'Sleep Score', angle: -90, position: 'insideLeft' }}
            domain={calculateYAxisDomain()}
            tickFormatter={(value) => `${Math.round(value)}`}
          />
          {!hideTooltips && <Tooltip content={<CustomTooltip />} />}
          
          {/* Reference lines for score ranges */}
          <ReferenceLine y={67} stroke="#10b981" strokeDasharray="5 5" />
          <ReferenceLine y={34} stroke="#eab308" strokeDasharray="5 5" />
          
          <Line 
            type="monotone" 
            dataKey="sleepScore" 
            stroke="#8b5cf6" 
            strokeWidth={3}
            dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Sleep Score"
            connectNulls={false}
            animationDuration={isAnimating ? animationDuration / 2 : 0}
          />
          
          {regressionResult.isValid && (
            <Line 
              type="monotone" 
              dataKey="trendLine" 
              stroke="#000000" 
              strokeWidth={2}
              dot={false}
              activeDot={false}
              name="Trend Line"
              connectNulls={true}
              animationDuration={isAnimating ? animationDuration / 2 : 0}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {!hideTitles && (
        <div className="mt-4 text-xs text-gray-500">
          <p>• Green zone (67+): Excellent sleep consistency</p>
          <p>• Yellow zone (34-66): Good sleep consistency</p>
          <p>• Red zone (0-33): Needs improvement</p>
        </div>
      )}
    </div>
  )
} 