// src/app/components/health/marketing/charts/MarketingPlateauPreventionChart.tsx
// Marketing version of Plateau Prevention Chart with animation controls

'use client'

import { useState, useMemo, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { WeeklyCheckin, calculateLossPercentageRate } from '../../healthService'
import { calculateLinearRegression, mergeDataWithTrendLine } from '../../regressionUtils'

interface MarketingPlateauPreventionChartProps {
  data: WeeklyCheckin[]
  isAnimating: boolean
  animationDuration: number
  onAnimationComplete: () => void
  hideTooltips?: boolean
  hideTitles?: boolean
}

export default function MarketingPlateauPreventionChart({ 
  data, 
  isAnimating, 
  animationDuration, 
  onAnimationComplete,
  hideTooltips = false,
  hideTitles = false
}: MarketingPlateauPreventionChartProps) {
  const [animatedData, setAnimatedData] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState(0)

  // Process data to calculate plateau prevention using Dr. Nick's progressive averaging method
  const chartData = useMemo(() => {
    // Include Week 0 in sorting for baseline calculations but filter out null weights
    const allWeeks = data
      .filter(entry => entry.weight !== null)
      .sort((a, b) => a.week_number - b.week_number)
    
    // Step 1: Calculate individual week losses for all weeks (including Week 1 from Week 0)
    const individualLosses: { week: number; individualLoss: number; weight: number }[] = []
    
    for (let i = 1; i < allWeeks.length; i++) {
      const currentWeek = allWeeks[i]
      const previousWeek = allWeeks[i - 1]
      
      if (currentWeek.weight && previousWeek.weight && currentWeek.week_number > 0) {
        // Individual week loss = ((previousWeight - currentWeight) / previousWeight) × 100
        const individualLoss = ((previousWeek.weight - currentWeek.weight) / previousWeek.weight) * 100
        
        individualLosses.push({
          week: currentWeek.week_number,
          individualLoss: individualLoss,
          weight: currentWeek.weight
        })
      }
    }
    
    // Step 2: Calculate plateau prevention values using progressive averaging
    const plateauPreventionData = individualLosses.map((entry, index) => {
      let plateauPreventionValue = 0
      
      if (entry.week === 1) {
        // Week 1: Just the individual week loss
        plateauPreventionValue = entry.individualLoss
      } else if (entry.week === 2) {
        // Week 2: Average of weeks 1 and 2
        const week1Loss = individualLosses.find(w => w.week === 1)?.individualLoss || 0
        plateauPreventionValue = (week1Loss + entry.individualLoss) / 2
      } else if (entry.week === 3) {
        // Week 3: Average of weeks 1, 2, and 3
        const week1Loss = individualLosses.find(w => w.week === 1)?.individualLoss || 0
        const week2Loss = individualLosses.find(w => w.week === 2)?.individualLoss || 0
        plateauPreventionValue = (week1Loss + week2Loss + entry.individualLoss) / 3
      } else if (entry.week === 4) {
        // Week 4: Average of weeks 1, 2, 3, and 4
        const week1Loss = individualLosses.find(w => w.week === 1)?.individualLoss || 0
        const week2Loss = individualLosses.find(w => w.week === 2)?.individualLoss || 0
        const week3Loss = individualLosses.find(w => w.week === 3)?.individualLoss || 0
        plateauPreventionValue = (week1Loss + week2Loss + week3Loss + entry.individualLoss) / 4
      } else {
        // Week 5+: Rolling 4-week average of most recent weeks only
        const currentWeekIndex = individualLosses.findIndex(w => w.week === entry.week)
        const last4Weeks = individualLosses.slice(Math.max(0, currentWeekIndex - 3), currentWeekIndex + 1)
        const sum = last4Weeks.reduce((acc, w) => acc + w.individualLoss, 0)
        plateauPreventionValue = sum / last4Weeks.length
      }
      
      return {
        week: entry.week,
        lossRate: Math.round(plateauPreventionValue * 100) / 100, // Round to 2 decimal places
        individualLoss: Math.round(entry.individualLoss * 100) / 100, // Store individual loss for tooltip
        weight: entry.weight
      }
    })
    
    return plateauPreventionData
  }, [data])

  // Calculate horizontal average line using Monday method; fall back to average of computed loss rates if no consecutive pairs
  const averageLineResult = useMemo(() => {
    const sortedAll = (data || [])
      .filter(entry => entry.weight !== null && entry.weight !== undefined)
      .sort((a, b) => a.week_number - b.week_number)

    const maxWeekNumber = (data && data.length > 0) ? Math.max(...data.map(d => d.week_number)) : 0

    if (maxWeekNumber <= 0 || sortedAll.length < 2) return { isValid: false, averageValue: 0 }

    let sum = 0
    let pairCount = 0
    for (let i = 1; i < sortedAll.length; i++) {
      const curr = sortedAll[i]
      const prev = sortedAll[i - 1]
      // Prefer consecutive pairs; if gaps exist we still compute using the immediate previous measurement
      if (curr.weight !== null && prev.weight !== null) {
        const prevW = parseFloat(String(prev.weight))
        const currW = parseFloat(String(curr.weight))
        if (Number.isFinite(prevW) && Number.isFinite(currW) && prevW !== 0) {
          const individualLoss = ((prevW - currW) / prevW) * 100
          sum += individualLoss
          if (curr.week_number === prev.week_number + 1) pairCount++
        }
      }
    }

    // If we had at least one consecutive pair, normalize by maxWeekNumber as before; otherwise average by number of computed pairs
    const divisor = pairCount > 0 ? maxWeekNumber : Math.max(sortedAll.length - 1, 1)
    const averageValue = sum / divisor
    return {
      isValid: true,
      averageValue: Math.round(averageValue * 100) / 100
    }
  }, [data])

  // Add horizontal average line to chart data
  const enhancedChartData = useMemo(() => {
    if (!averageLineResult.isValid) return chartData.map(point => ({ ...point, trendLine: null }))
    
    // Add the horizontal average line value to each data point
    return chartData.map(point => ({
      ...point,
      trendLine: averageLineResult.averageValue
    }))
  }, [chartData, averageLineResult])

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
      
      animateStep(1) // Start from week 1 since week 0 doesn't have loss data
    } else if (!isAnimating) {
      setAnimatedData(enhancedChartData)
      setCurrentWeek(Math.max(...enhancedChartData.map(d => d.week), 0))
    }
  }, [isAnimating, animationDuration, enhancedChartData, onAnimationComplete])

  // Calculate Y-axis domain (ensure visibility near zero)
  const calculateYAxisDomain = () => {
    const displayData = isAnimating ? animatedData : enhancedChartData
    const allValues: number[] = []
    
    displayData.forEach(d => {
      if (d.lossRate !== null && d.lossRate !== undefined && !isNaN(d.lossRate)) {
        allValues.push(d.lossRate)
      }
    })
    
    if (allValues.length === 0) return [0, 5] // Default range for percentages
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    
    // For loss rates, we want to show from 0 to a reasonable maximum
    const yMax = Math.max(maxValue * 1.2, 3) // At least 3% max
    const lower = Math.min(minValue - 0.5, 0)
    // If average line is ~0, ensure headroom so it’s visible above x-axis
    const nearZero = averageLineResult.isValid && Math.abs(averageLineResult.averageValue) < 0.25
    const yMin = nearZero ? -0.5 : (lower >= 0 ? 0 : lower)
    return [yMin, yMax]
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-green-600">
            {`Plateau Prevention: ${payload[0].value}%`}
          </p>
          {payload[0].payload.individualLoss !== undefined && (
            <p className="text-gray-600 text-sm">
              {`Individual Loss: ${payload[0].payload.individualLoss}%`}
            </p>
          )}
          {payload[0].payload.weight && (
            <p className="text-gray-600 text-sm">
              {`Weight: ${payload[0].payload.weight} lbs`}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const displayData = isAnimating ? animatedData : enhancedChartData

  // Right-edge average label renderer (marketing)
  const AvgRightLabel = ({ viewBox, value }: any) => {
    const { x, y, width } = viewBox || {}
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number') return null
    const labelX = x + width - 8
    const labelY = y - 6
    return (
      <text x={labelX} y={labelY} textAnchor="end" fontSize={12} fontWeight={600} fill="#000000">
        {`Avg: ${Number(value).toFixed(2)}%`}
      </text>
    )
  }

  if (displayData.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🔄</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Plateau Prevention Analysis
        </h3>
        <p className="text-gray-600">
          {isAnimating ? 'Starting animation...' : 'No data available for plateau prevention analysis'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {!hideTitles && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            🔄 Plateau Prevention Analysis
          </h3>
          <p className="text-sm text-gray-600">
            Progressive averaging to prevent weight loss plateaus
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
            label={{ value: 'Loss Rate (%)', angle: -90, position: 'insideLeft' }}
            domain={calculateYAxisDomain()}
            tickFormatter={(value) => `${Math.round(value * 100) / 100}%`}
          />
          {!hideTooltips && <Tooltip content={<CustomTooltip />} />}
          
          <Line 
            type="monotone" 
            dataKey="lossRate" 
            stroke="#3b82f6" 
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Loss Rate"
            animationDuration={isAnimating ? animationDuration / 2 : 0}
          />

          {/* Draw average as a dedicated series to guarantee visibility */}
          {averageLineResult.isValid && (
            <Line 
              type="monotone" 
              dataKey="trendLine" 
              stroke="#000000" 
              strokeWidth={2}
              dot={false}
              activeDot={false}
              name="Average"
              connectNulls
            />
          )}
          
          {averageLineResult.isValid && (
            <ReferenceLine
              y={averageLineResult.averageValue}
              strokeOpacity={0}
              label={{
                position: 'right',
                value: `Avg: ${averageLineResult.averageValue.toFixed(2)}%`,
                fill: '#000000',
                fontSize: 12,
                fontWeight: 600,
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {!hideTitles && (
        <div className="mt-4 text-xs text-gray-500">
          <p>• Progressive averaging prevents plateaus</p>
          <p>• Black line shows overall average</p>
          <p>• Target: Consistent loss rate over time</p>
        </div>
      )}
    </div>
  )
} 