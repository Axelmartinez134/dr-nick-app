'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression } from '../regressionUtils'

interface VisceralFatLevelChartProps {
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

export default function VisceralFatLevelChart({ data }: VisceralFatLevelChartProps) {
  // Build continuous week series with nulls when missing
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip title="Visceral Fat Level" description="Tracks the dangerous, hidden fat surrounding your internal organs that is linked to metabolic health risks. Decreasing trend indicates reducing risk for metabolic syndrome and other chronic diseases.">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-blue-600 transition-colors">🧬 Visceral Fat Level</h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No visceral fat data yet</p>
        </div>
      </div>
    )
  }

  const weeks = data.map(d => d.week_number)
  const minWeek = Math.min(...weeks)
  const maxWeek = Math.max(...weeks)

  const byWeek: Record<number, { value: number | null; date?: string | null }> = {}
  data.forEach(entry => {
    const raw = (entry as any).visceral_fat_level
    const num = raw === null || raw === undefined || raw === '' ? null : parseFloat(String(raw))
    byWeek[entry.week_number] = {
      value: num !== null && !Number.isNaN(num) && Number.isFinite(num) ? num : null,
      date: entry.date || null
    }
  })
  const chartData: Array<{ week: number; level: number | null; date?: string }> = []
  for (let w = minWeek; w <= maxWeek; w++) {
    const rec = byWeek[w] || { value: null, date: null }
    chartData.push({
      week: w,
      level: rec.value,
      date: rec.date ? new Date(rec.date).toLocaleDateString() : undefined
    })
  }

  const yAxisDomain = (() => {
    const values = chartData
      .map(d => (typeof d.level === 'number' ? d.level : null))
      .filter((v): v is number => v !== null && !isNaN(v))

    if (values.length === 0) return [0, 100]

    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const padding = Math.max(1, (maxValue - minValue) * 0.1)
    return [Math.max(0, minValue - padding), maxValue + padding]
  })()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-blue-600">{`Level: ${payload[0].value}`}</p>
          {payload[0].payload.date && (
            <p className="text-gray-600 text-sm">{`Date: ${payload[0].payload.date}`}</p>
          )}
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip title="Visceral Fat Level" description="Tracks the dangerous, hidden fat surrounding your internal organs that is linked to metabolic health risks. Decreasing trend indicates reducing risk for metabolic syndrome and other chronic diseases.">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-blue-600 transition-colors">🧬 Visceral Fat Level</h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No visceral fat data yet</p>
        </div>
      </div>
    )
  }

  const projectionWeeks = 16
  const xMin = Math.min(...chartData.map(d => d.week))
  const xMax = Math.max(...chartData.map(d => d.week))
  const xMaxProj = xMax + projectionWeeks

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className="mb-4">
        <ChartTooltip title="Visceral Fat Level" description="Tracks the dangerous, hidden fat surrounding your internal organs that is linked to metabolic health risks. Decreasing trend indicates reducing risk for metabolic syndrome and other chronic diseases.">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-blue-600 transition-colors">🧬 Visceral Fat Level</h3>
        </ChartTooltip>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }} domain={[xMin, xMaxProj]} type="number" />
          <YAxis label={{ value: 'Level', angle: -90, position: 'insideLeft' }} domain={yAxisDomain as any} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="level" stroke="#2563eb" strokeWidth={3} dot={{ fill: '#2563eb', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} name="Level" connectNulls={true} />
          {(() => {
            const valid = chartData.filter(d => typeof d.level === 'number' && d.level !== null && !Number.isNaN(d.level as number))
            if (valid.length < 2) return null
            const regression = calculateLinearRegression(
              valid.map(d => ({ week: d.week, value: d.level as number })),
              xMin,
              xMaxProj
            )
            return (
              <Line type="monotone" dataKey="value" data={regression.trendPoints as any} stroke="#000000" strokeWidth={2} dot={false} activeDot={false} name="" connectNulls={true} />
            )
          })()}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
          <li>Tracks hidden visceral fat around internal organs linked to metabolic risk.</li>
          <li>A decreasing trend indicates lower risk of metabolic syndrome and chronic disease.</li>
          <li>Provides an actionable score to monitor and maintain internal health.</li>
        </ul>
      </div>
    </div>
  )
}


