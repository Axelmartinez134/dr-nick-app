'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression } from '../regressionUtils'

interface RestingHeartRateChartProps {
  data: WeeklyCheckin[]
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

export default function RestingHeartRateChart({ data }: RestingHeartRateChartProps) {
  const weeks = data.map(d => d.week_number)
  if (weeks.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip title="Resting Heart Rate" description="Acts as a key indicator of cardiovascular fitness; lower is generally better.">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-rose-600 transition-colors">❤️ Resting Heart Rate</h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No resting heart rate data yet</p>
        </div>
      </div>
    )
  }

  const minWeek = Math.min(...weeks)
  const maxWeek = Math.max(...weeks)
  const byWeek: Record<number, { bpm: number | null; date?: string | null }> = {}
  data.forEach(entry => {
    const raw = (entry as any).resting_heart_rate
    const num = raw === null || raw === undefined || raw === '' ? null : parseInt(String(raw))
    byWeek[entry.week_number] = {
      bpm: Number.isFinite(num as any) ? (num as number) : null,
      date: entry.date || null
    }
  })
  const chartData: Array<{ week: number; bpm: number | null; date?: string }> = []
  for (let w = minWeek; w <= maxWeek; w++) {
    const rec = byWeek[w] || { bpm: null, date: null }
    chartData.push({ week: w, bpm: rec.bpm, date: rec.date ? new Date(rec.date).toLocaleDateString() : undefined })
  }

  const yAxisDomain = (() => {
    const values = chartData
      .map(d => (typeof d.bpm === 'number' ? d.bpm : null))
      .filter((v): v is number => v !== null && !isNaN(v))
    if (values.length === 0) return [20, 120]
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const padding = Math.max(1, (maxValue - minValue) * 0.1)
    const minRaw = minValue - padding
    const maxRaw = maxValue + padding
    // Round to 1‑bpm steps (tighter padding)
    const minRounded = Math.floor(minRaw)
    const maxRounded = Math.ceil(maxRaw)
    return [minRounded, maxRounded]
  })()

  const yTicks = (() => {
    const [yMin, yMax] = yAxisDomain as [number, number]
    const ticks: number[] = []
    const step = 1
    for (let v = yMin; v <= yMax; v += step) ticks.push(v)
    return ticks
  })()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-rose-600">{`RHR: ${payload[0].value} bpm`}</p>
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

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className="mb-4">
        <ChartTooltip title="Resting Heart Rate" description="Acts as a key indicator of cardiovascular fitness; lower is generally better.">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-rose-600 transition-colors">❤️ Resting Heart Rate</h3>
        </ChartTooltip>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }} domain={[xMin, xMax]} type="number" ticks={xTicks as any} allowDecimals={false} tickFormatter={(v) => String(v)} />
          <YAxis label={{ value: 'bpm', angle: -90, position: 'left', offset: 10 }} domain={[yTicks[0], yTicks[yTicks.length-1]] as any} ticks={yTicks as any} allowDecimals={false} tickFormatter={(v) => String(Math.round(v as number))} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="bpm" stroke="#e11d48" strokeWidth={3} dot={{ fill: '#e11d48', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} name="Resting HR" connectNulls={true} />
          {(() => {
            const valid = chartData.filter(d => typeof d.bpm === 'number' && d.bpm !== null && !Number.isNaN(d.bpm as number))
            if (valid.length < 2) return null
            const regression = calculateLinearRegression(
              valid.map(d => ({ week: d.week, value: d.bpm as number })),
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
          <li>Key indicator of cardiovascular fitness and overall health.</li>
          <li>A lower resting rate is generally better.</li>
          <li>A downward trend over time shows improving cardiac efficiency.</li>
        </ul>
      </div>
    </div>
  )
}


