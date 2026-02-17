'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression } from '../regressionUtils'
import TrendPill from './common/TrendPill'

interface AvgDailyFastingHoursChartProps {
  data: WeeklyCheckin[]
  hideTrendPill?: boolean
}

function ChartTooltip({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)
  return (
    <div className="relative inline-block">
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
          <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function minutesToHhmm(mins: number): string {
  const safe = Math.max(0, Math.floor(mins))
  const hh = Math.floor(safe / 60)
  const mm = safe % 60
  const mmStr = mm < 10 ? `0${mm}` : String(mm)
  return `${hh}:${mmStr}`
}

export default function AvgDailyFastingHoursChart({ data, hideTrendPill = false }: AvgDailyFastingHoursChartProps) {
  // Determine the displayed week range (ChartsDashboard already filters by the global range slider).
  const weekBounds = useMemo(() => {
    const weeks = (data || [])
      .map(d => Number((d as any).week_number))
      .filter(n => Number.isFinite(n))
    if (weeks.length === 0) return { minWeek: 0, maxWeek: 0 }
    return { minWeek: Math.min(...weeks), maxWeek: Math.max(...weeks) }
  }, [data])

  // Raw fasting points (only weeks with real values; missing weeks are represented as nulls later)
  const raw = useMemo(() => {
    return (data || [])
      .filter(entry => {
        const v: any = (entry as any).avg_daily_fasting_minutes
        if (v === null || v === undefined || v === '') return false
        const n = parseFloat(String(v))
        return !Number.isNaN(n) && Number.isFinite(n)
      })
      .sort((a, b) => a.week_number - b.week_number)
      .map(entry => {
        const minutes = parseFloat(String((entry as any).avg_daily_fasting_minutes))
        return ({
          week: entry.week_number,
          fastingMinutes: minutes,
          fastingHours: minutes / 60,
          date: entry.date
        })
      })
  }, [data])

  const enhancedChartData = useMemo(() => {
    if (raw.length === 0) return [] as Array<{ week: number; fastingHours: number | null; fastingMinutes: number | null; date?: string; trendLine: number | null }>
    const startWeek = weekBounds.minWeek
    const maxWeek = weekBounds.maxWeek

    const regressionInput = raw
      .filter(d => d.fastingHours !== null)
      .map(d => ({ week: d.week, value: d.fastingHours as number }))
    const r = calculateLinearRegression(regressionInput, startWeek, maxWeek)

    const rawByWeek = new Map<number, { week: number; fastingHours: number; fastingMinutes: number; date?: string }>()
    raw.forEach(d => {
      rawByWeek.set(d.week, d)
    })

    const series: Array<{ week: number; fastingHours: number | null; fastingMinutes: number | null; date?: string; trendLine: number | null }> = []
    for (let w = startWeek; w <= maxWeek; w++) {
      const actual = rawByWeek.get(w)
      const tp = r.isValid ? r.trendPoints.find(t => t.week === w) : undefined
      series.push({
        week: w,
        fastingHours: actual ? (actual.fastingHours as number) : null,
        fastingMinutes: actual ? (actual.fastingMinutes as number) : null,
        date: actual?.date,
        trendLine: tp ? tp.value : null
      })
    }
    return series
  }, [raw, weekBounds])

  const regressionForPill = useMemo(() => {
    if (raw.length < 2) return { slope: 0, intercept: 0, count: raw.length }
    const startWeek = weekBounds.minWeek
    const maxWeek = weekBounds.maxWeek
    const regressionInput = raw
      .filter(d => typeof d.fastingHours === 'number' && Number.isFinite(d.fastingHours))
      .map(d => ({ week: d.week, value: d.fastingHours as number }))
    const r = calculateLinearRegression(regressionInput, startWeek, maxWeek)
    return { slope: r.slope || 0, intercept: r.intercept || 0, count: regressionInput.length }
  }, [raw, weekBounds])

  const averageLineResult = useMemo(() => {
    if (raw.length < 1) return { isValid: false, averageMinutes: 0, averageHours: 0, pointsUsed: 0 }
    const sumMinutes = raw.reduce((acc, d) => acc + Number(d.fastingMinutes || 0), 0)
    const averageMinutes = sumMinutes / raw.length
    return {
      isValid: Number.isFinite(averageMinutes),
      averageMinutes,
      averageHours: averageMinutes / 60,
      pointsUsed: raw.length
    }
  }, [raw])

  const calculateYAxisDomain = () => {
    const values: number[] = []
    enhancedChartData.forEach(d => {
      if (d.fastingHours !== null && d.fastingHours !== undefined && !Number.isNaN(d.fastingHours)) values.push(d.fastingHours)
    })
    if (values.length === 0) return [0, 24]
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const paddingHours = 1
    const lo = clamp(Math.floor(minValue - paddingHours), 0, 24)
    const hi = clamp(Math.ceil(maxValue + paddingHours), 0, 24)
    // ensure a sensible range
    if (hi - lo < 2) return [clamp(lo - 1, 0, 24), clamp(hi + 1, 0, 24)]
    return [lo, hi]
  }

  const yDomain = useMemo(() => calculateYAxisDomain(), [enhancedChartData])
  const yTicks = useMemo(() => {
    const lo = Math.round(yDomain[0] as number)
    const hi = Math.round(yDomain[1] as number)
    const out: number[] = []
    for (let v = lo; v <= hi; v++) out.push(v)
    return out
  }, [yDomain])

  // Custom label renderer for right-edge average text inside chart (match Plateau Prevention placement)
  const AvgRightLabel = ({ viewBox, valueMinutes }: any) => {
    const { x, y, width } = viewBox || {}
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number') return null
    const minsRounded = Math.round(Number(valueMinutes))
    if (!Number.isFinite(minsRounded)) return null
    const labelX = x + width - 8 // padding from right edge
    const labelY = y - 6 // small upward nudge
    return (
      <text x={labelX} y={labelY} textAnchor="end" fontSize={12} fontWeight={600} fill="#6b7280">
        {`Avg: ${minutesToHhmm(minsRounded)}`}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0]?.payload
      const mins = point?.fastingMinutes
      const display = (typeof mins === 'number' && Number.isFinite(mins)) ? minutesToHhmm(mins) : 'N/A'
      const formatDate = (dateStr: string) => {
        try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return dateStr }
      }
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-gray-800">{`Avg Daily Fasting: ${display}`}</p>
          {point?.date && (<p className="text-gray-600 text-sm">{`Date: ${formatDate(point.date)}`}</p>)}
        </div>
      )
    }
    return null
  }

  if (enhancedChartData.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip
          title="Average Daily Fasting (Hours)"
          description="Your average daily fasting duration (in hours) from each weekly check-in. This helps you track consistency over time."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-indigo-600 transition-colors">
            ⏳ Average Daily Fasting
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No fasting data available yet</p>
          <p className="text-sm">Your weekly check-ins will populate average daily fasting duration</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <ChartTooltip
          title="Average Daily Fasting (Hours)"
          description="Average daily fasting duration across the week."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
            ⏳ Average Daily Fasting
          </h3>
        </ChartTooltip>
        {!hideTrendPill && (
          <TrendPill
            slope={regressionForPill.slope || 0}
            intercept={regressionForPill.intercept || 0}
            pointsCount={regressionForPill.count || 0}
            insufficientThreshold={2}
            orientation="positiveGood"
            titleOverride="Trendline slope (hours/week)"
          />
        )}
      </div>
      <p className="text-sm text-gray-600">Weekly average fasting duration</p>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={enhancedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }} />
          <YAxis
            label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
            domain={yDomain as any}
            ticks={yTicks as any}
            tickFormatter={(v) => `${Math.round(v)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="fastingHours"
            stroke="#14b8a6"
            strokeWidth={3}
            dot={{ fill: '#14b8a6', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Fasting Hours"
            connectNulls={true}
          />
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
          {/* Horizontal average line (gray dashed) + right-edge label */}
          {averageLineResult.isValid && (
            <ReferenceLine
              y={averageLineResult.averageHours}
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}
          {averageLineResult.isValid && (
            <ReferenceLine
              y={averageLineResult.averageHours}
              strokeOpacity={0}
              label={<AvgRightLabel valueMinutes={averageLineResult.averageMinutes} />}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• This shows your weekly average daily fasting duration</p>
        <p>• Watch for consistency and a steady, repeatable pattern week-to-week</p>
        <p>• Dark black trend line shows your overall fasting consistency direction</p>
        <p>• Gray dashed line shows your average fasting duration for the selected time range</p>
        <p>• Small, repeatable habits beat “all-or-nothing” weeks</p>
      </div>
    </div>
  )
}


