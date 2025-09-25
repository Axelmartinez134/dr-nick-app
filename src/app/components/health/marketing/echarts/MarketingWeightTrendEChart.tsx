// ECharts version of Weight Trend (marketing)

'use client'

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type * as echarts from 'echarts'
import { type WeeklyCheckin } from '../../healthService'
import { calculateLinearRegression } from '../../regressionUtils'
import { poundsToKilograms, type UnitSystem } from '../../unitUtils'

interface Props {
  data: WeeklyCheckin[]
  hideTooltips?: boolean
  hideTitles?: boolean
  progress?: number
  onReady?: (inst: echarts.ECharts) => void
  unitSystem?: UnitSystem
}

export default function MarketingWeightTrendEChart({ data, hideTooltips = false, hideTitles = false, progress = 1, onReady, unitSystem = 'imperial' }: Props) {
  const baseData = useMemo(() => {
    return data
      .filter(entry => entry.weight !== null)
      .sort((a, b) => a.week_number - b.week_number)
      .map(entry => ({ week: entry.week_number, weight: entry.weight! }))
  }, [data])

  const chartData = useMemo(() => {
    if (unitSystem === 'metric') {
      return baseData.map(d => ({ week: d.week, weight: poundsToKilograms(d.weight) ?? d.weight }))
    }
    return baseData
  }, [baseData, unitSystem])

  const regression = useMemo(() => {
    if (chartData.length < 2) return null
    const regressionData = chartData.map(d => ({ week: d.week, value: d.weight }))
    const minWeek = Math.min(...chartData.map(d => d.week))
    const maxWeek = Math.max(...chartData.map(d => d.week))
    return calculateLinearRegression(regressionData, minWeek, maxWeek)
  }, [chartData])

  const option = useMemo(() => {
    const pairs = chartData.map(d => [d.week, d.weight] as [number, number])
    const trendPairs = (regression?.isValid ? regression.trendPoints.map(tp => [tp.week, tp.value]) : []) as any

    // Moving head position along the series
    const maxIndex = Math.max(0, chartData.length - 1)
    const headIdxFloat = maxIndex * Math.min(1, Math.max(0, progress))
    const headFloor = Math.floor(headIdxFloat)
    const headFrac = headIdxFloat - headFloor
    const x0 = chartData[headFloor]?.week ?? 0
    const x1 = chartData[headFloor + 1]?.week ?? x0
    const y0 = chartData[headFloor]?.weight ?? 0
    const y1 = chartData[headFloor + 1]?.weight ?? y0
    const headX = x0 + (x1 - x0) * headFrac
    const headY = y0 + (y1 - y0) * headFrac

    // Y-axis domain with 10% padding, mimicking client WeightTrendChart
    const hasValues = pairs.length > 0
    const minValue = hasValues ? Math.min(...pairs.map(p => p[1])) : 0
    const maxValue = hasValues ? Math.max(...pairs.map(p => p[1])) : 100
    const padding = hasValues ? (maxValue - minValue) * 0.1 : 0
    const yMin = hasValues ? minValue - padding : 0
    const yMax = hasValues ? maxValue + padding : 100

    const minWeek = hasValues ? Math.min(...pairs.map(p => p[0])) : 0
    const maxWeek = hasValues ? Math.max(...pairs.map(p => p[0])) : 1

    // If no data, render a minimal empty-state chart (no series)
    if (pairs.length === 0) {
      return {
        backgroundColor: 'transparent',
        title: hideTitles ? undefined : { text: 'Weight Trend Analysis', left: 'center' },
        xAxis: { type: 'value', show: false },
        yAxis: { type: 'value', show: false },
        grid: { left: 0, right: 0, top: 0, bottom: 0 },
        series: []
      } as any
    }

    return {
      backgroundColor: 'transparent',
      animationDuration: 0,
      tooltip: hideTooltips ? undefined : {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params
          const week = p?.axisValue ?? ''
          const val = p?.data?.[1] ?? ''
          const unitLabel = unitSystem === 'metric' ? 'kg' : 'lbs'
          return `Week ${week}<br/>Weight: ${val} ${unitLabel}`
        }
      },
      grid: { left: 50, right: 20, top: hideTitles ? 10 : 40, bottom: 40 },
      xAxis: {
        type: 'value',
        name: 'Week',
        min: minWeek,
        max: maxWeek,
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        name: unitSystem === 'metric' ? 'Weight (kg)' : 'Weight (lbs)',
        min: yMin,
        max: yMax,
        axisLabel: {
          formatter: (val: number) => {
            const num = typeof val === 'number' ? val : parseFloat(String(val))
            if (!Number.isFinite(num)) return ''
            return Math.round(num * 10) / 10
          }
        }
      },
      title: hideTitles ? undefined : { text: 'Weight Trend Analysis', left: 'center' },
      series: [
        // Single weight line (client style)
        {
          name: unitSystem === 'metric' ? 'Weight (kg)' : 'Weight (lbs)',
          type: 'line',
          data: pairs,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 3, color: '#8b5cf6' },
          itemStyle: { color: '#8b5cf6' },
        },
        // Trend line (full-range, non-smoothed, solid black)
        ...(regression?.isValid ? [{
          name: 'Trend Line',
          type: 'line',
          data: trendPairs,
          smooth: false,
          symbol: 'none',
          connectNulls: true,
          lineStyle: { width: 2, color: '#000000' }
        }] : [])
      ]
    } as any
  }, [chartData, regression, hideTooltips, hideTitles, progress])

  return (
    <div className="w-full h-full">
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge={false} lazyUpdate onChartReady={onReady} />
    </div>
  )
}


