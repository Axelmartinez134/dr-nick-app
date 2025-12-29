// src/app/components/health/charts/PlateauPreventionChart.tsx
// Chart 1: PLATEAU PREVENTION (WEIGHT) - with trendline

'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { WeeklyCheckin, calculateLossPercentageRate } from '../healthService'
import { calculateLinearRegression, mergeDataWithTrendLine } from '../regressionUtils'
import TrendPill from './common/TrendPill'
import { createPortal } from 'react-dom'

interface PlateauPreventionChartProps {
  data: WeeklyCheckin[]
  hideIndividualWeekFormula?: boolean
  hideTrendPill?: boolean
  visibleStartWeek?: number
}

// Chart Tooltip Component
function ChartTooltip({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // Position above the trigger, align left
      setCoords({ top: rect.top - 8, left: rect.left })
    }
  }, [isVisible])

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && coords && createPortal(
        <>
          {/* Paint a near-transparent overlay to ensure our layer is composited above native range thumbs */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'rgba(0,0,0,0.001)',
              pointerEvents: 'none'
            }}
          />
          <div
            style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999, transform: 'translateY(-100%)' }}
            className="w-80 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg"
          >
            <div className="font-medium mb-1">{title}</div>
            <div className="text-gray-300">{description}</div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

export default function PlateauPreventionChart({ data, hideIndividualWeekFormula = false, hideTrendPill = false, visibleStartWeek }: PlateauPreventionChartProps) {

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
      
      // IMPORTANT: Do not "bridge" missing weeks.
      // If week N-1 is missing, week N must be null (not computed vs an older prior week).
      if (currentWeek.week_number !== previousWeek.week_number + 1) continue

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

    // Normalize series to include week 0 placeholder (null) through max week seen
    const weekNumbers = (data || []).map(w => w.week_number)
    const maxWeek = weekNumbers.length > 0 ? Math.max(...weekNumbers) : 0
    const normalized: Array<{ week: number; lossRate: number | null; individualLoss?: number; weight?: number }> = []
    for (let w = 0; w <= maxWeek; w++) {
      const found = plateauPreventionData.find(p => p.week === w)
      normalized.push({
        week: w,
        lossRate: found ? found.lossRate : null,
        individualLoss: found?.individualLoss,
        weight: found?.weight
      })
    }
    return normalized
  }, [data])

  // Calculate horizontal average line using Monday "overall_loss_rate_percent" method
  const averageLineResult = useMemo(() => {
    const sortedAll = (data || [])
      .filter(entry => entry.weight !== null && entry.weight !== undefined)
      .sort((a, b) => a.week_number - b.week_number)

    if (sortedAll.length < 2) return { isValid: false, averageValue: 0, intervalsUsed: 0, intervalValues: [] as number[] }

    let sum = 0
    let intervals = 0
    const intervalValues: number[] = []
    for (let i = 1; i < sortedAll.length; i++) {
      const curr = sortedAll[i]
      const prev = sortedAll[i - 1]
      if (curr.week_number === prev.week_number + 1 && curr.weight !== null && prev.weight !== null) {
        const prevW = parseFloat(String(prev.weight))
        const currW = parseFloat(String(curr.weight))
        if (Number.isFinite(prevW) && Number.isFinite(currW) && prevW !== 0) {
          const individualLoss = ((prevW - currW) / prevW) * 100
          if (typeof visibleStartWeek !== 'number' || curr.week_number >= visibleStartWeek) {
            sum += individualLoss
            intervals++
            intervalValues.push(individualLoss)
          }
        }
      }
    }

    if (intervals < 1) return { isValid: false, averageValue: 0, intervalsUsed: 0, intervalValues: [] as number[] }
    const averageValue = sum / intervals
    return {
      isValid: true,
      averageValue: Math.round(averageValue * 100) / 100,
      intervalsUsed: intervals,
      intervalValues
    }
  }, [data, visibleStartWeek])

  // Filter series for display based on visibleStartWeek
  const displayStart = typeof visibleStartWeek === 'number' ? visibleStartWeek : 0
  const displayChartData = useMemo(() => chartData.filter(p => p.week >= displayStart), [chartData, displayStart])

  // Add horizontal average line to chart data
  const enhancedChartData = useMemo(() => {
    if (!averageLineResult.isValid) return displayChartData.map(point => ({ ...point, trendLine: null }))
    
    // Add the horizontal average line value to each data point
    return displayChartData.map(point => ({
      ...point,
      trendLine: averageLineResult.averageValue
    }))
  }, [displayChartData, averageLineResult])

  // Regression over the plateau prevention series (lossRate vs week) for the visible range
  const regressionResult = useMemo(() => {
    const valid = chartData.filter(d => typeof d.lossRate === 'number' && d.lossRate !== null && !Number.isNaN(d.lossRate as number))
    if (valid.length < 2) return { isValid: false, slope: 0, intercept: 0, trendPoints: [], equation: '' }
    const regressionData = valid.map(d => ({ week: d.week, value: d.lossRate as number }))
    const minWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))
    const res = calculateLinearRegression(regressionData, minWeek, maxWeek)
    return res
  }, [chartData])

  // Calculate Y-axis domain excluding trend line values to prevent skewing
  const calculateYAxisDomain = () => {
    const allValues: number[] = []
    
    // Add actual loss rate values
    displayChartData.forEach(d => {
      if (d.lossRate !== null && d.lossRate !== undefined && !isNaN(d.lossRate)) {
        allValues.push(d.lossRate)
      }
    })
    
    if (allValues.length === 0) return [0, 5] // Default range for percentages
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    
    // For loss rates, we want to show from 0 to a reasonable maximum
    const padding = Math.max(1, maxValue * 0.2) // At least 1% padding
    
    return [0, maxValue + padding]
  }

  // Custom label renderer for right-edge average text inside chart
  const AvgRightLabel = ({ viewBox, value }: any) => {
    const { x, y, width } = viewBox || {}
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number') return null
    const labelX = x + width - 8 // 8px padding from right edge
    const labelY = y - 6 // small upward nudge to reduce overlap with points
    return (
      <text x={labelX} y={labelY} textAnchor="end" fontSize={12} fontWeight={600} fill="#000000">
        {`Avg: ${Number(value).toFixed(2)}%`}
      </text>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-blue-600">
            {`Plateau Prevention: ${payload[0].value}%`}
          </p>
          {data.individualLoss !== undefined && (
            <p className="text-green-600 text-sm">
              {`Individual Week Loss: ${data.individualLoss}%`}
            </p>
          )}
          {data.weight && (
            <p className="text-gray-600 text-sm">
              {`Weight: ${data.weight} lbs`}
            </p>
          )}
          <div className="text-xs text-gray-500 mt-1 border-t pt-1">
            {label <= 1 && "= Individual week loss"}
            {label === 2 && "= Avg of weeks 1-2"} 
            {label === 3 && "= Avg of weeks 1-3"}
            {label === 4 && "= Avg of weeks 1-4"}
            {label > 4 && "= Rolling 4-week average"}
          </div>
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip 
          title="Plateau Prevention" 
          description="Tracks average weekly weight loss percentage using progressive averaging (weeks 1-4) then rolling 4-week averages (week 5+) to identify plateaus early. Declining trends may signal program adjustments are needed."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-green-600 transition-colors">
            📈 Plateau Prevention (Weight Loss Rate)
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No weight data available yet</p>
          <p className="text-sm">Enter weight data for multiple weeks to see plateau prevention analysis</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <ChartTooltip 
          title="Plateau Prevention" 
          description="Tracks week-to-week loss percentage to identify plateaus early. Any data point trends approaching 0% may require program adjustments."
        >
          <h3 className="text-lg font-semibold text-gray-900 hover:text-green-600 transition-colors">
            📈 Plateau Prevention (Weight Loss Rate)
          </h3>
        </ChartTooltip>
        {!hideTrendPill && (
          <TrendPill
            slope={regressionResult.slope || 0}
            intercept={regressionResult.intercept || 0}
            pointsCount={displayChartData.filter(d => typeof d.lossRate === 'number' && d.lossRate !== null).length}
            insufficientThreshold={1}
            orientation="positiveGood"
            titleOverride={averageLineResult.isValid ? (() => {
              const vals = (averageLineResult.intervalValues as number[]).map(v => `${v.toFixed(2)}%`)
              let terms = vals
              if (vals.length > 80) {
                const head = vals.slice(0, 40)
                const tail = vals.slice(-40)
                terms = [...head, '…', ...tail]
              }
              const termsStr = terms.join(' + ')
              return `Avg = (${termsStr}) ÷ ${averageLineResult.intervalsUsed} = ${averageLineResult.averageValue.toFixed(2)}%`
            })() : undefined}
          />
        )}
      </div>
      <p className="text-sm text-gray-600 mb-2">
        Tracks average weight loss percentage using progressive averaging to identify potential plateaus
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={enhancedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="week" 
            label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: '% Loss Rate', angle: -90, position: 'insideLeft', offset: -10 }}
            domain={calculateYAxisDomain()}
            tickFormatter={(value) => `${value.toFixed(1)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Original loss rate data line */}
          <Line 
            type="monotone" 
            dataKey="lossRate" 
            stroke="#3b82f6" 
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Loss Rate"
            // Connect across missing weeks (nulls) so gaps don't break the line.
            connectNulls={true}
          />
          
          {/* Horizontal average line - Dark black (continuous across x-range) */}
          {averageLineResult.isValid && (
            <ReferenceLine y={averageLineResult.averageValue} stroke="#000000" strokeWidth={2} />
          )}
          {/* Right-edge always-visible label for the average line using an invisible ReferenceLine */}
          {averageLineResult.isValid && (
            <ReferenceLine y={averageLineResult.averageValue} strokeOpacity={0} label={<AvgRightLabel value={averageLineResult.averageValue} />} />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Right-edge label now rendered via ReferenceLine label inside the chart */}

      <div className="mt-4 text-xs text-gray-500">
        <p>• Tracks average weekly weight loss % over time to detect plateaus early</p>
        <p>• Week 1-4: Progressive averaging (Week 2 = avg of weeks 1-2, Week 3 = avg of weeks 1-3, etc.)</p>
        <p>• Week 5+: Rolling 4-week average of most recent weeks only</p>
        <p>• Dark black line shows average plateau prevention across all weeks</p>
        <p>• Points above the line indicate better than average performance</p>
        {hideIndividualWeekFormula ? null : (
          <p>• Individual Week Formula: ((Previous Weight - Current Weight) ÷ Previous Weight) × 100</p>
        )}
      </div>
    </div>
  )
}