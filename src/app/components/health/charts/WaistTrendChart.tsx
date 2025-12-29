// src/app/components/health/charts/WaistTrendChart.tsx
// Chart 4: Waist Trend Analysis - with trendline

'use client'

import { useState, useMemo, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression, mergeDataWithTrendLine } from '../regressionUtils'
import { getLengthUnitLabel } from '../unitCore'
import { supabase } from '../../auth/AuthContext'
import TrendPill from './common/TrendPill'

interface WaistTrendChartProps {
  data: WeeklyCheckin[]
  unitSystem?: 'imperial' | 'metric'
  patientId?: string
  hideAlwaysMeasureNote?: boolean
  hideHeaderTitle?: boolean
  compactHeader?: boolean
  hideDateInTooltip?: boolean
  hideTrendPill?: boolean
}

// Chart Tooltip Component
function ChartTooltip({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block max-w-full">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      
      {isVisible && (
        <div className="absolute z-10 w-80 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg -top-2 left-0 transform -translate-y-full">
          <div className="font-medium mb-1">{title}</div>
          <div className="text-gray-300">{description}</div>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
}

import { inchesToCentimeters } from '../unitCore'

export default function WaistTrendChart({ data, unitSystem = 'imperial', patientId, hideAlwaysMeasureNote = false, hideHeaderTitle = false, compactHeader = false, hideDateInTooltip = false, hideTrendPill = false }: WaistTrendChartProps) {
  const [waistGoalDistance, setWaistGoalDistance] = useState<number | null>(null)

  // Local tooltip for the purple distance pill (mirrors metrics tooltip content)
  function DistancePill({ distance }: { distance: number }) {
    const [open, setOpen] = useState(false)
    const valueText = distance >= 0 ? `+${distance.toFixed(3)}` : distance.toFixed(3)
    return (
      <div className="relative inline-block">
        <div
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="cursor-help text-xs bg-purple-100 text-purple-800 rounded-full px-3 py-1 whitespace-normal md:whitespace-nowrap break-words max-w-[70vw] md:max-w-none"
        >
          DISTANCE FROM WAIST/HEIGHT GOAL • {valueText}
        </div>
        {open && (
          <div className="absolute z-10 w-80 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-lg bottom-full right-0 mb-2">
            <div className="font-semibold text-purple-300 mb-2">Distance from Waist-to-Height Goal</div>
            <div className="mb-2">
              <div className="font-medium text-green-300 mb-1">Formula</div>
              <div className="font-mono text-xs bg-gray-800 p-2 rounded">Goal = 0.5 | Current = (Waist ÷ Height) | Distance = Current − 0.5</div>
            </div>
            <div className="mb-2">
              <div className="font-medium text-yellow-300 mb-1">What it measures</div>
              <div className="text-gray-300">How close your waist-to-height ratio is to the 0.5 goal. It’s unitless and works with any units because both waist and height are in the same units.</div>
            </div>
            <div>
              <div className="font-medium text-blue-300 mb-1">Why it matters</div>
              <div className="text-gray-300">A ratio ≤ 0.5 is associated with optimal metabolic health. Values above 0.5 suggest increased risk; moving this distance toward 0 is the goal.</div>
            </div>
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
          </div>
        )}
      </div>
    )
  }

  useEffect(() => {
    const computeDistance = async () => {
      try {
        let userId = patientId
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id
        }
        if (!userId) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('height')
          .eq('id', userId)
          .single()
        const height = profile?.height
        if (!height || height <= 0) return
        const latest = [...data]
          .filter(d => d.waist !== null && d.waist !== undefined)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        if (!latest || latest.waist === null || latest.waist === undefined) return
        const currentRatio = (latest.waist as number) / height
        const distance = currentRatio - 0.5
        setWaistGoalDistance(Math.round(distance * 1000) / 1000)
      } catch {}
    }
    computeDistance()
  }, [data, patientId])
  // Build full week series within provided data's min..max range, preserving nulls to avoid x-axis compression
  const chartDataImperial = (() => {
    if (!data || data.length === 0) return [] as Array<{ week: number; waist: number | null; date?: string }>
    const weeks = data.map(d => d.week_number)
    const minWeek = Math.min(...weeks)
    const maxWeek = Math.max(...weeks)
    const byWeek: Record<number, { waist?: number | null; date?: string | null }> = {}
    data.forEach(entry => {
      const raw = entry.waist
      byWeek[entry.week_number] = {
        waist: raw !== undefined ? raw : null,
        date: entry.date || null
      }
    })
    const rows: Array<{ week: number; waist: number | null; date?: string }> = []
    for (let w = minWeek; w <= maxWeek; w++) {
      const rec = byWeek[w] || { waist: null, date: null }
      rows.push({
        week: w,
        waist: rec.waist !== undefined ? (rec.waist as number | null) : null,
        date: rec.date ? new Date(rec.date).toLocaleDateString() : undefined
      })
    }
    return rows
  })()

  const chartData = unitSystem === 'metric'
    ? chartDataImperial.map(d => ({ ...d, waist: inchesToCentimeters(d.waist as number) }))
    : chartDataImperial

  // Calculate regression for trend line using only non-null values, but span full visible range for X
  const regressionResult = useMemo(() => {
    const valid = chartData.filter(d => typeof d.waist === 'number' && d.waist !== null && !Number.isNaN(d.waist as number))
    if (valid.length < 2) return { isValid: false, trendPoints: [], slope: 0, intercept: 0, rSquared: 0, equation: "", weeklyChange: 0, totalChange: 0, correlation: "None" }
    const regressionData = valid.map(d => ({ week: d.week, value: d.waist as number }))
    const minWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))
    return calculateLinearRegression(regressionData, minWeek, maxWeek)
  }, [chartData])

  // Merge trend line data with chart data
  const enhancedChartData = useMemo(() => {
    if (!regressionResult.isValid) return chartData.map(point => ({ ...point, trendLine: null }))
    
    return chartData.map(point => {
      // Only add trend line values for weeks where we have actual waist data
      const hasActualData = chartData.some(d => d.week === point.week && d.waist !== null)
      const trendPoint = regressionResult.trendPoints.find(tp => tp.week === point.week)
      
      return {
        ...point,
        // trendPoint.value is already in the same units as chartData (we ran the regression on chartData)
        trendLine: (hasActualData && trendPoint) ? trendPoint.value : null
      }
    })
  }, [chartData, regressionResult, unitSystem])

  // Calculate Y-axis domain excluding trend line values to prevent skewing
  const calculateYAxisDomain = () => {
    const allValues: number[] = []
    
    // Add actual waist values
    chartData.forEach(d => {
      if (d.waist !== null && d.waist !== undefined && !isNaN(d.waist)) {
        allValues.push(d.waist)
      }
    })
    
    if (allValues.length === 0) return [20, 50] // Default range for waist measurements
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    const padding = (maxValue - minValue) * 0.1 // 10% padding
    
    return [minValue - padding, maxValue + padding]
  }

  const validPointCount = useMemo(() => {
    return chartData.filter(d => typeof d.waist === 'number' && d.waist !== null && !Number.isNaN(d.waist as number)).length
  }, [chartData])

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-orange-600">
            {`Waist: ${payload[0].value} ${getLengthUnitLabel(unitSystem)}`}
          </p>
          {!hideDateInTooltip && payload[0].payload.date && (
            <p className="text-gray-600 text-sm">
              {`Date: ${payload[0].payload.date}`}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip 
          title="Waist Trend" 
          description="Tracks waist circumference changes over time. Often more reliable for measuring visceral fat changes and body composition progress."
        >
          {hideHeaderTitle ? null : (
            <h3 className={`text-lg font-semibold text-gray-900 ${compactHeader ? 'mb-2' : 'mb-4'} hover:text-orange-600 transition-colors`}>
              📏 Waist Trend Analysis
            </h3>
          )}
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No waist measurements available yet</p>
          <p className="text-sm">Enter waist measurements to track body composition changes</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className={`${compactHeader ? 'mb-1' : 'mb-2'} flex items-start justify-between gap-3`}>
        <div className="min-w-0 flex-1">
        <ChartTooltip 
          title="Waist Trend" 
          description="Tracks waist circumference changes over time. Often more reliable than weight for measuring body composition changes and fat loss progress."
        >
          {hideHeaderTitle ? null : (
              <h3 className={`text-lg font-semibold text-gray-900 ${compactHeader ? 'mb-1' : 'mb-2'} hover:text-orange-600 transition-colors break-words`}>
              📏 Waist Trend Analysis
            </h3>
          )}
        </ChartTooltip>
          {waistGoalDistance !== null && (
            <div className={`${compactHeader ? 'mt-0.5' : 'mt-1'}`}>
            <DistancePill distance={waistGoalDistance} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {!hideTrendPill && (
            <TrendPill
              slope={regressionResult.slope || 0}
              intercept={regressionResult.intercept || 0}
              pointsCount={validPointCount}
              insufficientThreshold={2}
              orientation="negativeGood"
            />
          )}
        </div>
      </div>
      <p className={`text-sm text-gray-600 ${compactHeader ? 'mb-1' : 'mb-2'}`}>Weekly waist measurements showing body composition changes</p>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={enhancedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="week" 
            label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            label={{ value: unitSystem === 'metric' ? 'Waist (cm)' : 'Waist (inches)', angle: -90, position: 'insideLeft' }}
            domain={calculateYAxisDomain()}
            tickFormatter={(value) => `${Math.round(value * 10) / 10}`}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Original waist data line */}
          <Line 
            type="monotone" 
            dataKey="waist" 
            stroke="#f97316" 
            strokeWidth={3}
            dot={{ fill: '#f97316', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name={unitSystem === 'metric' ? 'Waist (cm)' : 'Waist (inches)'}
            connectNulls={true}
          />
          
          {/* Regression trend line - Dark black as requested */}
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
          />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Often more accurate than weight for fat loss tracking</p>
        <p>• Dark black trend line shows overall waist measurement change direction</p>
        {hideAlwaysMeasureNote ? null : (
          <p>• Always measure at the horizontal level of your belly button with your stomoch 100% relaxed.</p>
        )}
        <p>• Consistent measurement location is important</p>
      </div>
    </div>
  )
}