'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import AliasMobileValuePill, { AliasMobileValuePillPoint } from './AliasMobileValuePill'

type WeeklyLike = { week_number: number; weight: number | null; date?: string }

interface AliasPlateauMobilePillProps {
  data: WeeklyLike[]
  children: React.ReactNode
}

export default function AliasPlateauMobilePill({ data, children }: AliasPlateauMobilePillProps) {

  // Compute plateau prevention series from same input the chart uses
  // Mirrors PlateauPreventionChart logic (progressive avg weeks 1-4, rolling 4-week avg >=5)
  const series = useMemo(() => {
    const allWeeks = (data || [])
      .filter((e) => e && e.weight !== null)
      .sort((a, b) => a.week_number - b.week_number)

    const individualLosses: { week: number; individualLoss: number }[] = []
    for (let i = 1; i < allWeeks.length; i++) {
      const curr = allWeeks[i]
      const prev = allWeeks[i - 1]
      if (typeof curr.weight === 'number' && typeof prev.weight === 'number' && curr.week_number > 0 && prev.weight !== 0) {
        const individualLoss = ((prev.weight - curr.weight) / prev.weight) * 100
        individualLosses.push({ week: curr.week_number, individualLoss })
      }
    }
    const plateau = individualLosses.map((entry, idx) => {
      let value = 0
      if (entry.week === 1) value = entry.individualLoss
      else if (entry.week === 2) {
        const w1 = individualLosses.find((w) => w.week === 1)?.individualLoss || 0
        value = (w1 + entry.individualLoss) / 2
      } else if (entry.week === 3) {
        const w1 = individualLosses.find((w) => w.week === 1)?.individualLoss || 0
        const w2 = individualLosses.find((w) => w.week === 2)?.individualLoss || 0
        value = (w1 + w2 + entry.individualLoss) / 3
      } else if (entry.week === 4) {
        const w1 = individualLosses.find((w) => w.week === 1)?.individualLoss || 0
        const w2 = individualLosses.find((w) => w.week === 2)?.individualLoss || 0
        const w3 = individualLosses.find((w) => w.week === 3)?.individualLoss || 0
        value = (w1 + w2 + w3 + entry.individualLoss) / 4
      } else {
        const currentWeekIndex = individualLosses.findIndex((w) => w.week === entry.week)
        const last4 = individualLosses.slice(Math.max(0, currentWeekIndex - 3), currentWeekIndex + 1)
        const sum = last4.reduce((acc, w) => acc + w.individualLoss, 0)
        value = sum / last4.length
      }
      const weight = allWeeks.find((w) => w.week_number === entry.week)?.weight
      return {
        week: entry.week,
        value: Math.round(value * 100) / 100,
        individualLoss: Math.round(entry.individualLoss * 100) / 100,
        weight: typeof weight === 'number' ? Math.round(weight * 100) / 100 : null
      }
    })
    return plateau
  }, [data])

  // Margins for mapping inside the generic pill wrapper
  const leftMargin = 20
  const rightMargin = 30

  // RenderContent to match original tooltip styling
  const renderContent = (pt: AliasMobileValuePillPoint) => {
    const w = pt as any
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{`Week ${w.week}`}</div>
        <div className="text-blue-600">{`Plateau Prevention: ${w.value}%`}</div>
        {typeof w.individualLoss === 'number' ? (
          <div className="text-green-600 text-xs">{`Individual Week Loss: ${w.individualLoss}%`}</div>
        ) : null}
        {typeof w.weight === 'number' ? (
          <div className="text-gray-600 text-xs">{`Weight: ${w.weight} lbs`}</div>
        ) : null}
        <div className="text-xs text-gray-500 mt-1 border-t pt-1">
          {w.week <= 1 && "= Individual week loss"}
          {w.week === 2 && "= Avg of weeks 1-2"}
          {w.week === 3 && "= Avg of weeks 1-3"}
          {w.week === 4 && "= Avg of weeks 1-4"}
          {w.week > 4 && "= Rolling 4-week average"}
        </div>
      </div>
    )
  }

  // Positioning handled by generic wrapper; no local effects here

  // Render
  return (
    <AliasMobileValuePill
      data={data}
      deriveSeries={() => series as unknown as AliasMobileValuePillPoint[]}
      renderContent={(pt) => renderContent(pt)}
      leftMargin={leftMargin}
      rightMargin={rightMargin}
      enableDesktop
      numericXAxis
      xAccessor={(p) => (p as any).week}
    >
      {children}
    </AliasMobileValuePill>
  )
}


