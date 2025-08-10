// src/app/components/health/marketing/charts/MarketingWaistTrendChart.tsx
// Marketing version of Waist Trend Chart with animation controls

'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../../healthService'
import { calculateLinearRegression, mergeDataWithTrendLine } from '../../regressionUtils'

interface MarketingWaistTrendChartProps {
  data: WeeklyCheckin[]
  isAnimating: boolean
  animationDuration: number
  onAnimationComplete: () => void
  hideTooltips?: boolean
  hideTitles?: boolean
}

export default function MarketingWaistTrendChart({ 
  data, 
  isAnimating, 
  animationDuration, 
  onAnimationComplete,
  hideTooltips = false,
  hideTitles = false
}: MarketingWaistTrendChartProps) {
  const [animatedData, setAnimatedData] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState(0)

  // Process waist data only
  const chartData = data
    .filter(entry => entry.waist !== null)
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      waist: entry.waist,
      date: new Date(entry.date).toLocaleDateString()
    }))

  // Calculate regression for trend line
  const regressionResult = useMemo(() => {
    if (chartData.length < 2) return { isValid: false, trendPoints: [], slope: 0, intercept: 0, rSquared: 0, equation: "", weeklyChange: 0, totalChange: 0, correlation: "None" }
    
    const regressionData = chartData.map(d => ({ week: d.week, value: d.waist! }))
    const minWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))
    
    return calculateLinearRegression(regressionData, minWeek, maxWeek)
  }, [chartData])

  // Enhanced chart data with trend line
  const enhancedChartData = useMemo(() => {
    if (!regressionResult.isValid) return chartData.map(point => ({ ...point, trendLine: null }))
    
    return chartData.map(point => {
      const hasActualData = chartData.some(d => d.week === point.week && d.waist !== null)
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
      if (d.waist !== null && d.waist !== undefined && !isNaN(d.waist)) {
        allValues.push(d.waist)
      }
    })
    
    if (allValues.length === 0) return [0, 50]
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    const padding = (maxValue - minValue) * 0.1
    
    return [minValue - padding, maxValue + padding]
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-amber-600">
            {`Waist: ${payload[0].value} inches`}
          </p>
          {payload[0].payload.date && (
            <p className="text-gray-600 text-sm">
              {`Date: ${payload[0].payload.date}`}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const displayData = isAnimating ? animatedData : enhancedChartData

  if (displayData.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">📏</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Waist Trend Analysis
        </h3>
        <p className="text-gray-600">
          {isAnimating ? 'Starting animation...' : 'No waist measurements available'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {!hideTitles && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            📏 Waist Trend Analysis
          </h3>
          <p className="text-sm text-gray-600">
            Weekly waist measurements with trend line
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
            label={{ value: 'Waist (inches)', angle: -90, position: 'insideLeft' }}
            domain={calculateYAxisDomain()}
            tickFormatter={(value) => `${Math.round(value * 10) / 10}`}
          />
          {!hideTooltips && <Tooltip content={<CustomTooltip />} />}
          
          <Line 
            type="monotone" 
            dataKey="waist" 
            stroke="#f59e0b" 
            strokeWidth={3}
            dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Waist"
            connectNulls={true}
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
          <p>• Track weekly waist measurements</p>
          <p>• Black trend line shows overall direction</p>
          <p>• Complements weight loss tracking</p>
        </div>
      )}
    </div>
  )
} 