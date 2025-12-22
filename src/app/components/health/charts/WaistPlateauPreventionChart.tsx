// src/app/components/health/charts/WaistPlateauPreventionChart.tsx

'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { WeeklyCheckin } from '../healthService'
import { calculateLinearRegression } from '../regressionUtils'
import TrendPill from './common/TrendPill'

interface WaistPlateauPreventionChartProps {
  data: WeeklyCheckin[]
  hideIndividualWeekFormula?: boolean
  visibleStartWeek?: number
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

export default function WaistPlateauPreventionChart({ data, hideIndividualWeekFormula = false, visibleStartWeek, hideTrendPill = false }: WaistPlateauPreventionChartProps) {
  // Build ordered waist data
  const allWeeks = useMemo(() => {
    return (data || [])
      .filter(entry => entry.waist !== null && entry.waist !== undefined)
      .sort((a, b) => a.week_number - b.week_number)
  }, [data])

  // Step 1: Calculate individual week loss % from waist
  const individualLosses = useMemo(() => {
    const rows: { week: number; individualLoss: number; waist: number }[] = []
    for (let i = 1; i < allWeeks.length; i++) {
      const curr = allWeeks[i]
      const prev = allWeeks[i - 1]
      if (curr.week_number > 0 && curr.waist !== null && prev.waist !== null) {
        const prevW = parseFloat(String(prev.waist))
        const currW = parseFloat(String(curr.waist))
        if (Number.isFinite(prevW) && Number.isFinite(currW) && prevW !== 0) {
          const lossPct = ((prevW - currW) / prevW) * 100
          rows.push({ week: curr.week_number, individualLoss: lossPct, waist: currW })
        }
      }
    }
    return rows
  }, [allWeeks])

  // Step 2: Apply progressive/rolling averaging to get plateau prevention values
  const chartData = useMemo(() => {
    return individualLosses.map((entry, index) => {
      let plateauValue = 0
      if (entry.week === 1) {
        plateauValue = entry.individualLoss
      } else if (entry.week === 2) {
        const w1 = individualLosses.find(w => w.week === 1)?.individualLoss || 0
        plateauValue = (w1 + entry.individualLoss) / 2
      } else if (entry.week === 3) {
        const w1 = individualLosses.find(w => w.week === 1)?.individualLoss || 0
        const w2 = individualLosses.find(w => w.week === 2)?.individualLoss || 0
        plateauValue = (w1 + w2 + entry.individualLoss) / 3
      } else if (entry.week === 4) {
        const w1 = individualLosses.find(w => w.week === 1)?.individualLoss || 0
        const w2 = individualLosses.find(w => w.week === 2)?.individualLoss || 0
        const w3 = individualLosses.find(w => w.week === 3)?.individualLoss || 0
        plateauValue = (w1 + w2 + w3 + entry.individualLoss) / 4
      } else {
        const idx = individualLosses.findIndex(w => w.week === entry.week)
        const last4 = individualLosses.slice(Math.max(0, idx - 3), idx + 1)
        const sum = last4.reduce((acc, w) => acc + w.individualLoss, 0)
        plateauValue = sum / last4.length
      }
      return {
        week: entry.week,
        lossRate: Math.round(plateauValue * 10) / 10, // 1 decimal place
        individualLoss: Math.round(entry.individualLoss * 10) / 10,
        waist: entry.waist
      }
    })
  }, [individualLosses])

  // Normalize to include a Week 0 placeholder (null) through max week seen,
  // so the range slider can start at 0 without jumping the first plotted point.
  const normalizedChartData = useMemo(() => {
    const weekNumbers = (data || []).map(w => w.week_number)
    const maxWeek = weekNumbers.length > 0 ? Math.max(...weekNumbers) : 0
    const out: Array<{ week: number; lossRate: number | null; individualLoss?: number; waist?: number }> = []
    for (let w = 0; w <= maxWeek; w++) {
      const found = chartData.find(p => p.week === w)
      out.push({
        week: w,
        lossRate: found ? (found.lossRate as number) : null,
        individualLoss: found?.individualLoss,
        waist: found?.waist
      })
    }
    return out
  }, [data, chartData])

  // Horizontal average line (overall average loss rate across available weeks)
  const averageLineResult = useMemo(() => {
    if (individualLosses.length < 1) return { isValid: false, averageValue: 0 }
    const start = typeof visibleStartWeek === 'number' ? visibleStartWeek : 0
    let sum = 0
    let intervals = 0
    for (const row of individualLosses) {
      if (row.week >= start) {
        sum += row.individualLoss
        intervals++
      }
    }
    if (intervals < 1) return { isValid: false, averageValue: 0 }
    const avg = sum / intervals
    return { isValid: true, averageValue: Math.round(avg * 10) / 10 }
  }, [individualLosses, visibleStartWeek])

  const displayStart = typeof visibleStartWeek === 'number' ? visibleStartWeek : 0
  const displayChartData = useMemo(() => normalizedChartData.filter(p => p.week >= displayStart), [normalizedChartData, displayStart])

  const enhancedChartData = useMemo(() => {
    if (!averageLineResult.isValid) return displayChartData.map(p => ({ ...p, trendLine: null }))
    return displayChartData.map(p => ({ ...p, trendLine: averageLineResult.averageValue }))
  }, [displayChartData, averageLineResult])

  // Regression for pill classification on visible window
  const regressionResult = useMemo(() => {
    const valid = displayChartData.filter(d => typeof d.lossRate === 'number' && d.lossRate !== null && !Number.isNaN(d.lossRate as number))
    if (valid.length < 2) return { isValid: false, slope: 0, intercept: 0, trendPoints: [], equation: '' }
    const minWeek = Math.min(...displayChartData.map(d => d.week))
    const maxWeek = Math.max(...displayChartData.map(d => d.week))
    return calculateLinearRegression(valid.map(d => ({ week: d.week, value: d.lossRate as number })), minWeek, maxWeek)
  }, [displayChartData])

  // Prepare interval values for hover titleOverride (cap 80 terms)
  const intervalSummary = useMemo(() => {
    const start = typeof visibleStartWeek === 'number' ? visibleStartWeek : 0
    const vals = individualLosses.filter(r => r.week >= start).map(r => r.individualLoss)
    const intervalsUsed = vals.length
    return { vals, intervalsUsed }
  }, [individualLosses, visibleStartWeek])

  const calculateYAxisDomain = () => {
    const values: number[] = []
    displayChartData.forEach(d => { if (d.lossRate !== null && d.lossRate !== undefined && !isNaN(d.lossRate)) values.push(d.lossRate) })
    if (values.length === 0) return [0, 5]
    const maxValue = Math.max(...values)
    const padding = Math.max(1, maxValue * 0.2)
    return [0, maxValue + padding]
  }

  const AvgRightLabel = ({ viewBox, value }: any) => {
    const { x, y, width } = viewBox || {}
    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number') return null
    const labelX = x + width - 8
    const labelY = y - 6
    return (
      <text x={labelX} y={labelY} textAnchor="end" fontSize={12} fontWeight={600} fill="#000000">
        {`Avg: ${Number(value).toFixed(1)}%`}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-800">{`Week ${label}`}</p>
          <p className="text-orange-600">{`Waist Plateau Prevention: ${payload[0].value}%`}</p>
          {data.individualLoss !== undefined && (
            <p className="text-green-600 text-sm">{`Individual Week Loss: ${data.individualLoss}%`}</p>
          )}
          {data.waist !== undefined && (
            <p className="text-gray-600 text-sm">{`Waist: ${data.waist}`}</p>
          )}
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
        <ChartTooltip title="Plateau Prevention (Waist)" description="Tracks average weekly waist loss percentage using progressive averaging (weeks 1–4) then rolling 4‑week averages (week 5+) to flag plateaus early.">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 hover:text-orange-600 transition-colors">📉 Plateau Prevention (Waist Loss Rate)</h3>
        </ChartTooltip>
        <div className="text-center py-8 text-gray-500">
          <p>No waist data available yet</p>
          <p className="text-sm">Enter waist data for multiple weeks to see plateau prevention analysis</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-[0_12px_28px_rgba(0,0,0,0.09),0_-10px_24px_rgba(0,0,0,0.07)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <ChartTooltip title="Plateau Prevention (Waist)" description="Tracks week‑to‑week waist loss % to identify plateaus early. Declining trends toward 0% may signal adjustments are needed.">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-orange-600 transition-colors">📉 Plateau Prevention (Waist Loss Rate)</h3>
        </ChartTooltip>
        {!hideTrendPill && (
          <TrendPill
            slope={regressionResult.slope || 0}
            intercept={regressionResult.intercept || 0}
            pointsCount={intervalSummary.intervalsUsed}
            insufficientThreshold={1}
            orientation="negativeGood"
            titleOverride={averageLineResult.isValid ? (() => {
              const vals = intervalSummary.vals.map(v => `${v.toFixed(2)}%`)
              let terms = vals
              if (vals.length > 80) {
                const head = vals.slice(0, 40)
                const tail = vals.slice(-40)
                terms = [...head, '…', ...tail]
              }
              const avgText = averageLineResult.isValid ? averageLineResult.averageValue.toFixed(2) : '0.00'
              return `Avg = (${terms.join(' + ')}) ÷ ${intervalSummary.intervalsUsed} = ${avgText}%`
            })() : undefined}
          />
        )}
      </div>
      <p className="text-sm text-gray-600">Average weekly waist loss percentage using progressive/rolling averaging</p>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={enhancedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }} />
          <YAxis label={{ value: '% Loss Rate', angle: -90, position: 'insideLeft', offset: -10 }} domain={calculateYAxisDomain()} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="lossRate" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} name="Loss Rate" connectNulls={true} />
          {averageLineResult.isValid && (<ReferenceLine y={averageLineResult.averageValue} stroke="#000000" strokeWidth={2} />)}
          {averageLineResult.isValid && (<ReferenceLine y={averageLineResult.averageValue} strokeOpacity={0} label={<AvgRightLabel value={averageLineResult.averageValue} />} />)}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Tracks average weekly waist loss % to detect plateaus early</p>
        <p>• Weeks 1–4: Progressive averaging; Week 5+: rolling 4‑week average</p>
        <p>• Dark black line shows average plateau prevention across all weeks</p>
        <p>• Points above the line indicate better than average progress</p>
        {hideIndividualWeekFormula ? null : (
          <p>• Individual Week Formula: ((Previous Waist − Current Waist) ÷ Previous Waist) × 100</p>
        )}
      </div>
    </div>
  )
}


