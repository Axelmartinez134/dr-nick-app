// ECharts version of Weight Projections vs Actual

'use client'

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { type WeeklyCheckin, generateWeightProjections } from '../../healthService'
import { calculateLinearRegression } from '../../regressionUtils'

interface Props {
  data: WeeklyCheckin[]
  hideTooltips?: boolean
  hideTitles?: boolean
}

export default function MarketingWeightProjectionEChart({ data, hideTooltips = false, hideTitles = false }: Props) {
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
    const allValues: number[] = []
    seriesData.actualWeights.forEach(v => { if (v !== null && v !== undefined) allValues.push(v as number) })
    seriesData.projections.forEach(p => p.data.forEach(v => { if (v !== null && v !== undefined) allValues.push(v as number) }))
    const hasValues = allValues.length > 0
    const minValue = hasValues ? Math.min(...allValues) : 0
    const maxValue = hasValues ? Math.max(...allValues) : 100
    const padding = hasValues ? (maxValue - minValue) * 0.1 : 0
    const yMin = hasValues ? minValue - padding : 0
    const yMax = hasValues ? maxValue + padding : 100

    return {
      backgroundColor: 'transparent',
      animationDuration: 0,
      tooltip: hideTooltips ? undefined : { trigger: 'axis' },
      legend: hideTitles ? undefined : { top: 10 },
      grid: { left: 50, right: 20, top: hideTitles ? 10 : 40, bottom: 40 },
      xAxis: { type: 'category', data: seriesData.weeks, boundaryGap: false, name: 'Week' },
      yAxis: { type: 'value', name: 'Weight (lbs)', min: yMin, max: yMax },
      title: hideTitles ? undefined : { text: 'Weight Projections vs Actual', left: 'center' },
      series: [
        { name: 'Actual', type: 'line', data: seriesData.actualWeights, smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { width: 4, color: '#2563eb' }, itemStyle: { color: '#2563eb' } },
        ...seriesData.projections.map((p, idx) => ({ name: p.name, type: 'line', data: p.data, smooth: true, symbol: 'none', lineStyle: { width: 2, type: 'dashed' } })),
        ...(seriesData.trend.length ? [{ name: 'Actual Trend', type: 'line', data: seriesData.trend, smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#000' } }] : [])
      ]
    } as any
  }, [seriesData, hideTooltips, hideTitles])

  return (
    <div className="w-full h-full">
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )
}


