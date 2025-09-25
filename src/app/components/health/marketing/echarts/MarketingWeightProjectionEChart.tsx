// ECharts version of Weight Projections vs Actual

'use client'

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { type WeeklyCheckin, generateWeightProjections } from '../../healthService'
import { calculateLinearRegression } from '../../regressionUtils'
import { poundsToKilograms, type UnitSystem } from '../../unitUtils'

interface Props {
  data: WeeklyCheckin[]
  hideTooltips?: boolean
  hideTitles?: boolean
  unitSystem?: UnitSystem
}

export default function MarketingWeightProjectionEChart({ data, hideTooltips = false, hideTitles = false, unitSystem = 'imperial' }: Props) {
  const actual = useMemo(() => {
    return data
      .filter(e => e.weight !== null)
      .sort((a, b) => a.week_number - b.week_number)
      .map(e => ({ week: e.week_number, weight: e.weight! }))
  }, [data])

  const initialWeight = useMemo(() => {
    const w0 = data.find(d => d.week_number === 0 && (d.initial_weight || d.weight))
    return w0?.initial_weight || w0?.weight || data.find(d => d.weight)?.weight || null
  }, [data])

  const seriesData = useMemo(() => {
    if (!initialWeight) return { weeks: [], actualWeights: [], projections: [], trend: [] as (number|null)[] }

    const latestActualWeek = actual.length > 0 ? Math.max(...actual.map(d => d.week)) : 0
    const maxWeek = Math.max(16, latestActualWeek)
    const projections = generateWeightProjections(initialWeight, maxWeek)

    const weeks = Array.from({ length: maxWeek + 1 }, (_, i) => i)
    const actualWeights = weeks.map(w => actual.find(a => a.week === w)?.weight ?? null)

    const regression = actual.length >= 2 ? calculateLinearRegression(actual.map(a => ({ week: a.week, value: a.weight })), Math.min(...actual.map(a => a.week)), Math.max(...actual.map(a => a.week))) : null
    const trend = regression?.isValid ? weeks.map(w => regression!.trendPoints.find(t => t.week === w)?.value ?? null) : []

    const projSeries = projections.map((p) => ({
      name: `${p.rate} loss/wk`,
      data: weeks.map(w => p.data.find(x => x.week === w)?.weight ?? null)
    }))

    return { weeks, actualWeights, projections: projSeries, trend }
  }, [actual, initialWeight])

  const option = useMemo(() => {
    // Y-axis domain to include actual + projections with padding (mimic client)
    const toDisplay = (v: number | null) => unitSystem === 'metric' ? (poundsToKilograms(v) ?? v) : v
    const allValues: number[] = []
    seriesData.actualWeights.forEach(v => { const d = toDisplay(v as any); if (d !== null && d !== undefined) allValues.push(d as number) })
    seriesData.projections.forEach(p => p.data.forEach(v => { const d = toDisplay(v as any); if (d !== null && d !== undefined) allValues.push(d as number) }))
    const hasValues = allValues.length > 0
    const minValue = hasValues ? Math.min(...allValues) : 0
    const maxValue = hasValues ? Math.max(...allValues) : 100
    const padding = hasValues ? (maxValue - minValue) * 0.1 : 0
    const yMinRaw = hasValues ? minValue - padding : 0
    const yMaxRaw = hasValues ? maxValue + padding : 100
    // Round y-axis domain to tidy 5-unit steps to avoid awkward ticks like 169.58
    const roundTo = 5
    const yMin = Math.floor(yMinRaw / roundTo) * roundTo
    const yMax = Math.ceil(yMaxRaw / roundTo) * roundTo

    // Convert series for display
    const actualDisplay = seriesData.actualWeights.map(v => toDisplay(v as any))
    const projectionsDisplay = seriesData.projections.map(p => ({ name: p.name, data: p.data.map(v => toDisplay(v as any)) }))
    const projectionColors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']
    const trendDisplay = seriesData.trend.map(v => (v === null || v === undefined) ? v : toDisplay(v as any))

    return {
      backgroundColor: 'transparent',
      animationDuration: 0,
      tooltip: hideTooltips ? undefined : { trigger: 'axis' },
      legend: hideTitles ? undefined : { top: 10 },
      grid: { left: 50, right: 20, top: hideTitles ? 10 : 40, bottom: 40 },
      xAxis: { type: 'category', data: seriesData.weeks, boundaryGap: false, name: 'Week' },
      yAxis: {
        type: 'value',
        name: unitSystem === 'metric' ? 'Weight (kg)' : 'Weight (lbs)',
        min: yMin,
        max: yMax,
        axisLabel: {
          formatter: (val: number) => {
            const n = typeof val === 'number' ? val : parseFloat(String(val))
            if (!Number.isFinite(n)) return ''
            return Math.round(n)
          }
        }
      },
      title: hideTitles ? undefined : { text: 'Weight Projections vs Actual', left: 'center' },
      series: [
        { name: 'Actual', type: 'line', data: actualDisplay, smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { width: 4, color: '#ef4444' }, itemStyle: { color: '#ef4444' } },
        ...projectionsDisplay.map((p, idx) => ({ name: p.name, type: 'line', data: p.data, smooth: true, symbol: 'none', lineStyle: { width: 2, type: 'dashed', color: projectionColors[idx % projectionColors.length] } })),
        ...(trendDisplay.length ? [{ name: 'Actual Trend', type: 'line', data: trendDisplay, smooth: false, symbol: 'none', connectNulls: true, lineStyle: { width: 2, color: '#000' } }] : [])
      ]
    } as any
  }, [seriesData, hideTooltips, hideTitles, unitSystem])

  return (
    <div className="w-full h-full">
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )
}


