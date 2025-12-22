'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression } from '../regressionUtils'
import TrendPill from './common/TrendPill'

interface BellyFatPercentChartProps {
  data: WeeklyCheckin[]
  hideTrendPill?: boolean
}

function ChartTooltip({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)
  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)} className="cursor-help">
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

export default function BellyFatPercentChart({ data, hideTrendPill = false }: BellyFatPercentChartProps) {
  const weeks = data.map(d => d.week_number)
  if (weeks.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip title="Belly Fat %" description="Accurately measures fat density in your abdominal region — a key indicator of health.">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-yellow-600 transition-colors">🧬 Belly Fat %</h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No belly fat percentage data yet</p>
        </div>
        <div className="mt-4">
          <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
            <li>Measures abdominal fat density — a key indicator of metabolic health.</li>
            <li>Targets progress in a primary area of concern for many clients.</li>
            <li>More precise than total body fat for tracking abdominal-specific change.</li>
            <li>Scale of 0–100% where lower is better.</li>
          </ul>
        </div>
      </div>
    )
  }

  const minWeek = Math.min(...weeks)
  const maxWeek = Math.max(...weeks)
  const byWeek: Record<number, { value: number | null; date?: string | null }> = {}
  data.forEach(entry => {
    const raw = (entry as any).belly_fat_percent
    const num = raw === null || raw === undefined || raw === '' ? null : parseFloat(String(raw))
    byWeek[entry.week_number] = {
      value: num !== null && !Number.isNaN(num) && Number.isFinite(num) ? num : null,
      date: entry.date || null
    }
  })
  const chartData: Array<{ week: number; percent: number | null; date?: string }> = []
  for (let w = minWeek; w <= maxWeek; w++) {
    const rec = byWeek[w] || { value: null, date: null }
    chartData.push({ week: w, percent: rec.value, date: rec.date ? new Date(rec.date).toLocaleDateString() : undefined })
  }

  const yAxisDomain = (() => {
    const values = chartData
      .map(d => (typeof d.percent === 'number' ? d.percent : null))
      .filter((v): v is number => v !== null && !isNaN(v))
    if (values.length === 0) return [0, 100]
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const padding = Math.max(0.25, (maxValue - minValue) * 0.1)
    // Data-driven min/max with small padding (no clamp to [0,100])
    return [minValue - padding, maxValue + padding]
  })()

  const yTicks = (() => {
    const [yMin, yMax] = yAxisDomain as [number, number]
    const span = yMax - yMin
    if (!isFinite(span) || span <= 0) return [Number(yMin.toFixed(2))]
    const desired = 5
    const step0 = span / (desired - 1)
    const pow10 = Math.pow(10, Math.floor(Math.log10(step0)))
    const err = step0 / pow10
    const factor = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1
    const step = factor * pow10
    const niceMin = Math.floor(yMin / step) * step
    const niceMax = Math.ceil(yMax / step) * step
    const ticks: number[] = []
    for (let v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(+v.toFixed(10))
    return ticks
  })()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-yellow-600">{`Belly Fat: ${payload[0].value}%`}</p>
          {payload[0].payload.date && (
            <p className="text-gray-600 text-sm">{`Date: ${payload[0].payload.date}`}</p>
          )}
        </div>
      )
    }
    return null
  }

  const xMin = Math.min(...chartData.map(d => d.week))
  const xMax = Math.max(...chartData.map(d => d.week))
  const xTicks = (() => { const arr: number[] = []; for (let w = xMin; w <= xMax; w++) arr.push(w); return arr })()

  const regressionResult = useMemo(() => {
    const valid = chartData.filter(d => typeof d.percent === 'number' && d.percent !== null && !Number.isNaN(d.percent as number))
    if (valid.length < 2) return { isValid: false, slope: 0, intercept: 0, trendPoints: [] as Array<{ week: number; value: number }>, equation: '' }
    return calculateLinearRegression(valid.map(d => ({ week: d.week, value: d.percent as number })), xMin, xMax)
  }, [chartData, xMin, xMax])

  const validPointCount = useMemo(() => {
    return chartData.filter(d => typeof d.percent === 'number' && d.percent !== null && !Number.isNaN(d.percent as number)).length
  }, [chartData])

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <ChartTooltip title="Belly Fat %" description="Accurately measures fat density in your abdominal region — a key indicator of health.">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-yellow-600 transition-colors">🧬 Belly Fat %</h3>
        </ChartTooltip>
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

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 56, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }} domain={[xMin, xMax]} type="number" ticks={xTicks as any} allowDecimals={false} tickFormatter={(v) => String(v)} interval={0} tickMargin={2} />
          <YAxis label={{ value: 'Percent', angle: -90, position: 'left', offset: 10 }} domain={[yTicks[0], yTicks[yTicks.length-1]] as any} ticks={yTicks as any} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="percent" stroke="#ca8a04" strokeWidth={3} dot={{ fill: '#ca8a04', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} name="Belly Fat %" connectNulls={true} />
          {(() => {
            const valid = chartData.filter(d => typeof d.percent === 'number' && d.percent !== null && !Number.isNaN(d.percent as number))
            if (valid.length < 2) return null
            const regression = calculateLinearRegression(
              valid.map(d => ({ week: d.week, value: d.percent as number })),
              xMin,
              xMax
            )
            return (
              <Line type="monotone" dataKey="value" data={regression.trendPoints as any} stroke="#000000" strokeWidth={2} dot={false} activeDot={false} name="" connectNulls={true} />
            )
          })()}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
          <li>Measures abdominal fat density — a key indicator of metabolic health.</li>
          <li>Targets progress in a primary area of concern for many clients.</li>
          <li>More precise than total body fat for tracking abdominal-specific change.</li>
          <li>Scale of 0–100% where lower is better.</li>
        </ul>
      </div>
    </div>
  )
}


