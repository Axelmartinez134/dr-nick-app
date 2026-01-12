'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression } from '../regressionUtils'
import TrendPill from './common/TrendPill'

interface CreatineMyosMDDaysChartProps {
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

export default function CreatineMyosMDDaysChart({ data, hideTrendPill = false }: CreatineMyosMDDaysChartProps) {
  const raw = data
    .filter(entry => {
      const v: any = (entry as any).creatine_myosmd_days
      if (v === null || v === undefined || v === '') return false
      const n = parseFloat(String(v))
      return !Number.isNaN(n) && Number.isFinite(n)
    })
    .sort((a, b) => a.week_number - b.week_number)
    .map(entry => ({
      week: entry.week_number,
      creatineDays: parseFloat(String((entry as any).creatine_myosmd_days)),
      date: entry.date
    }))

  const enhancedChartData = useMemo(() => {
    if (raw.length === 0) return [] as Array<{ week: number; creatineDays: number | null; date?: string; trendLine: number | null }>
    const minDataWeek = Math.min(...raw.map(d => d.week))
    const maxWeek = Math.max(...raw.map(d => d.week))
    const startWeek = Math.max(1, minDataWeek)

    const regressionInput = raw
      .filter(d => typeof d.creatineDays === 'number' && Number.isFinite(d.creatineDays))
      .map(d => ({ week: d.week, value: d.creatineDays as number }))
    const r = calculateLinearRegression(regressionInput, startWeek, maxWeek)

    const series: Array<{ week: number; creatineDays: number | null; date?: string; trendLine: number | null }> = []
    for (let w = startWeek; w <= maxWeek; w++) {
      const actual = raw.find(d => d.week === w)
      const tp = r.isValid ? r.trendPoints.find(t => t.week === w) : undefined
      series.push({
        week: w,
        creatineDays: actual ? (actual.creatineDays as number) : null,
        date: actual?.date,
        trendLine: tp ? tp.value : null
      })
    }
    return series
  }, [raw])

  const regressionForPill = useMemo(() => {
    if (raw.length < 2) return { slope: 0, intercept: 0, count: raw.length }
    const minDataWeek = Math.min(...raw.map(d => d.week))
    const maxWeek = Math.max(...raw.map(d => d.week))
    const startWeek = Math.max(1, minDataWeek)
    const regressionInput = raw
      .filter(d => typeof d.creatineDays === 'number' && Number.isFinite(d.creatineDays))
      .map(d => ({ week: d.week, value: d.creatineDays as number }))
    const r = calculateLinearRegression(regressionInput, startWeek, maxWeek)
    return { slope: r.slope || 0, intercept: r.intercept || 0, count: regressionInput.length }
  }, [raw])

  const calculateYAxisDomain = () => {
    const values: number[] = []
    enhancedChartData.forEach(d => { if (d.creatineDays !== null && d.creatineDays !== undefined && !Number.isNaN(d.creatineDays)) values.push(d.creatineDays) })
    if (values.length === 0) return [0, 7]
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const padding = 0.5
    return [Math.max(0, Math.floor(minValue - padding)), Math.min(7, Math.ceil(maxValue + padding))]
  }

  const yDomain = useMemo(() => calculateYAxisDomain(), [enhancedChartData])
  const yTicks = useMemo(() => {
    const lo = Math.round(yDomain[0] as number)
    const hi = Math.round(yDomain[1] as number)
    const out: number[] = []
    for (let v = lo; v <= hi; v++) out.push(v)
    return out
  }, [yDomain])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value
      const formatDate = (dateStr: string) => {
        try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return dateStr }
      }
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-gray-800">{`Creatine / MyosMD Days: ${value}/7`}</p>
          {payload[0].payload.date && (<p className="text-gray-600 text-sm">{`Date: ${formatDate(payload[0].payload.date)}`}</p>)}
        </div>
      )
    }
    return null
  }

  if (enhancedChartData.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip
          title="Creatine / MyosMD Days"
          description="Number of days per week you took creatine / MyosMD. Consistency supports muscle retention, training performance, and recovery."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-indigo-600 transition-colors">
            🧪 Creatine / MyosMD Days
          </h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No creatine / MyosMD data available yet</p>
          <p className="text-sm">Your weekly check-ins will populate supplement consistency</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <ChartTooltip
          title="Creatine / MyosMD Days"
          description="Weekly supplement consistency. Higher is better—focus on building a repeatable routine."
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
            🧪 Creatine / MyosMD Days
          </h3>
        </ChartTooltip>
        {!hideTrendPill && (
          <TrendPill
            slope={regressionForPill.slope || 0}
            intercept={regressionForPill.intercept || 0}
            pointsCount={regressionForPill.count || 0}
            insufficientThreshold={2}
            orientation="positiveGood"
          />
        )}
      </div>
      <p className="text-sm text-gray-600">
        Weekly days you took{' '}
        <a
          href="https://blonyx.com/products/blonyx-hmb-creatine/?ref=THEFITTESTDOC&utm_source=affiliate"
          target="_blank"
          rel="noreferrer"
          className="underline text-blue-600 hover:text-blue-700"
        >
          HMB + Creatine
        </a>
        {' / and or '}
        <a
          href="https://myosmd.com/"
          target="_blank"
          rel="noreferrer"
          className="underline text-blue-600 hover:text-blue-700"
        >
          MyosMD
        </a>
        —consistency supports muscle retention and performance
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={enhancedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }} />
          <YAxis
            label={{ value: 'Days', angle: -90, position: 'insideLeft' }}
            domain={yDomain as any}
            ticks={yTicks as any}
            tickCount={8}
            tickFormatter={(v) => `${Math.round(v)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="creatineDays"
            stroke="#6366f1"
            strokeWidth={3}
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
            name="Creatine / MyosMD Days"
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
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Weekly totals reflect how many days you took it (0–7)</p>
        <p>• Dark black trend line shows your overall consistency direction</p>
        <p>• More consistent use supports strength, recovery, and lean mass retention</p>
        <p>• Build a sustainable routine—consistency beats perfection</p>
      </div>
    </div>
  )
}


