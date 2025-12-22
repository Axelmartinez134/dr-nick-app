'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression } from '../regressionUtils'
import TrendPill from './common/TrendPill'

interface SubcutaneousFatLevelChartProps {
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

export default function SubcutaneousFatLevelChart({ data, hideTrendPill = false }: SubcutaneousFatLevelChartProps) {
  const weeks = data.map(d => d.week_number)
  const hasWeeks = weeks.length > 0
  const minWeek = hasWeeks ? Math.min(...weeks) : 0
  const maxWeek = hasWeeks ? Math.max(...weeks) : 0

  const byWeek: Record<number, { value: number | null; date?: string | null }> = {}
  data.forEach(entry => {
    const raw = (entry as any).subcutaneous_fat_level
    const num = raw === null || raw === undefined || raw === '' ? null : parseFloat(String(raw))
    byWeek[entry.week_number] = {
      value: num !== null && !Number.isNaN(num) && Number.isFinite(num) ? num : null,
      date: entry.date || null
    }
  })
  const chartData: Array<{ week: number; level: number | null; date?: string }> = []
  if (hasWeeks) {
    for (let w = minWeek; w <= maxWeek; w++) {
      const rec = byWeek[w] || { value: null, date: null }
      chartData.push({
        week: w,
        level: rec.value,
        date: rec.date ? new Date(rec.date).toLocaleDateString() : undefined
      })
    }
  }

  const yAxisDomain = (() => {
    const values = chartData
      .map(d => (typeof d.level === 'number' ? d.level : null))
      .filter((v): v is number => v !== null && !isNaN(v))

    if (values.length === 0) return [0, 100]

    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const padding = Math.max(0.05, (maxValue - minValue) * 0.1)
    return [minValue - padding, maxValue + padding]
  })()

  // Compute nice ticks for cleaner labels
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
          <p className="text-emerald-600">{`Level: ${payload[0].value}`}</p>
          {payload[0].payload.date && (
            <p className="text-gray-600 text-sm">{`Date: ${payload[0].payload.date}`}</p>
          )}
        </div>
      )
    }
    return null
  }

  const xMin = chartData.length > 0 ? Math.min(...chartData.map(d => d.week)) : 0
  const xMax = chartData.length > 0 ? Math.max(...chartData.map(d => d.week)) : 0
  const xTicks = (() => { const arr: number[] = []; for (let w = xMin; w <= xMax; w++) arr.push(w); return arr })()

  const regressionResult = useMemo(() => {
    const valid = chartData.filter(d => typeof d.level === 'number' && d.level !== null && !Number.isNaN(d.level as number))
    if (valid.length < 2) return { isValid: false, slope: 0, intercept: 0, trendPoints: [] as Array<{ week: number; value: number }>, equation: '' }
    return calculateLinearRegression(valid.map(d => ({ week: d.week, value: d.level as number })), xMin, xMax)
  }, [chartData, xMin, xMax])

  const validPointCount = useMemo(() => {
    return chartData.filter(d => typeof d.level === 'number' && d.level !== null && !Number.isNaN(d.level as number)).length
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip title="Subcutaneous Fat Level" description="Measures the layer of fat just beneath your skin, giving a more complete body composition picture.">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-emerald-600 transition-colors">🧬 Subcutaneous Fat Level</h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No subcutaneous fat data yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <ChartTooltip title="Subcutaneous Fat Level" description="Measures the layer of fat just beneath your skin, giving a more complete body composition picture.">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-emerald-600 transition-colors">🧬 Subcutaneous Fat Level</h3>
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
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }} domain={[xMin, xMax]} type="number" ticks={xTicks as any} allowDecimals={false} tickFormatter={(v) => String(v)} interval={0} tickMargin={2} />
          <YAxis label={{ value: 'Level', angle: -90, position: 'insideLeft' }} domain={[yTicks[0], yTicks[yTicks.length-1]] as any} ticks={yTicks as any} allowDecimals tickFormatter={(v: number) => Number(v).toFixed(1)} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="level" stroke="#059669" strokeWidth={3} dot={{ fill: '#059669', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} name="Level" connectNulls={true} />
          {(() => {
            const valid = chartData.filter(d => typeof d.level === 'number' && d.level !== null && !Number.isNaN(d.level as number))
            if (valid.length < 2) return null
            const regression = calculateLinearRegression(
              valid.map(d => ({ week: d.week, value: d.level as number })),
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
          <li>Measures the fat layer beneath your skin to complete your composition picture.</li>
          <li>Compares abdominal subcutaneous fat relative to typical population averages.</li>
          <li>Helps track visible changes not always reflected by scale weight.</li>
          <li>Scale of 0–10 where lower is better.</li>
        </ul>
      </div>
    </div>
  )
}


