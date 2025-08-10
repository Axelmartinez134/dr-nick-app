// ECharts version of Plateau Prevention (progressive averaging)

'use client'

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { type WeeklyCheckin } from '../../healthService'

interface Props {
  data: WeeklyCheckin[]
  hideTooltips?: boolean
  hideTitles?: boolean
}

export default function MarketingPlateauPreventionEChart({ data, hideTooltips = false, hideTitles = false }: Props) {
  const computed = useMemo(() => {
    const allWeeks = data
      .filter(entry => entry.weight !== null)
      .sort((a, b) => a.week_number - b.week_number)

    const individualLosses: { week: number; individualLoss: number }[] = []
    for (let i = 1; i < allWeeks.length; i++) {
      const cur = allWeeks[i]
      const prev = allWeeks[i - 1]
      if (cur.weight && prev.weight && cur.week_number > 0) {
        const loss = ((prev.weight - cur.weight) / prev.weight) * 100
        individualLosses.push({ week: cur.week_number, individualLoss: loss })
      }
    }

    const plateau = individualLosses.map((entry, idx) => {
      let val = 0
      if (entry.week === 1) val = entry.individualLoss
      else if (entry.week === 2) val = (individualLosses.find(w => w.week === 1)?.individualLoss || 0 + entry.individualLoss) / 2
      else if (entry.week === 3) val = (individualLosses.find(w => w.week === 1)?.individualLoss || 0 + (individualLosses.find(w => w.week === 2)?.individualLoss || 0) + entry.individualLoss) / 3
      else if (entry.week === 4) val = ((individualLosses.find(w => w.week === 1)?.individualLoss || 0) + (individualLosses.find(w => w.week === 2)?.individualLoss || 0) + (individualLosses.find(w => w.week === 3)?.individualLoss || 0) + entry.individualLoss) / 4
      else {
        const ix = individualLosses.findIndex(w => w.week === entry.week)
        const last4 = individualLosses.slice(Math.max(0, ix - 3), ix + 1)
        val = last4.reduce((a, b) => a + b.individualLoss, 0) / last4.length
      }
      return { week: entry.week, lossRate: Math.round(val * 100) / 100 }
    })

    const average = plateau.length ? Math.round((plateau.reduce((a, b) => a + b.lossRate, 0) / plateau.length) * 100) / 100 : 0
    const weeks = plateau.map(p => p.week)
    const values = plateau.map(p => p.lossRate)
    const avgLine = plateau.map(() => average)
    return { weeks, values, avgLine }
  }, [data])

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    animationDuration: 0,
    tooltip: hideTooltips ? undefined : { trigger: 'axis' },
    grid: { left: 50, right: 20, top: hideTitles ? 10 : 40, bottom: 40 },
    xAxis: { type: 'category', data: computed.weeks, name: 'Week', boundaryGap: false },
    yAxis: {
      type: 'value',
      name: 'Loss Rate (%)',
      min: 0,
      max: (() => {
        const vals = computed.values
        if (!vals.length) return 5
        const mx = Math.max(...vals)
        const pad = Math.max(1, mx * 0.2)
        return mx + pad
      })()
    },
    title: hideTitles ? undefined : { text: 'Plateau Prevention Analysis', left: 'center' },
    series: [
      { name: 'Loss Rate', type: 'line', data: computed.values, smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { width: 3, color: '#10b981' }, itemStyle: { color: '#10b981' } },
      { name: 'Average', type: 'line', data: computed.avgLine, smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#000' } }
    ]
  }) as any, [computed, hideTooltips, hideTitles])

  return (
    <div className="w-full h-full">
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )
}


