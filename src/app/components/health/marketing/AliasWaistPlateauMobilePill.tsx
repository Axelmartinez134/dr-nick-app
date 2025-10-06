'use client'

import React, { useMemo } from 'react'
import AliasMobileValuePill, { type AliasMobileValuePillPoint } from './AliasMobileValuePill'

type WeeklyLike = { week_number: number; waist: number | null; date?: string }

interface AliasWaistPlateauMobilePillProps {
  data: WeeklyLike[]
  children: React.ReactNode
}

export default function AliasWaistPlateauMobilePill({ data, children }: AliasWaistPlateauMobilePillProps) {
  const leftMargin = 20
  const rightMargin = 30

  // Mirror WaistPlateauPreventionChart calculations
  const series = useMemo(() => {
    const allWeeks = (data || [])
      .filter((e) => e && e.waist !== null)
      .sort((a, b) => a.week_number - b.week_number)

    const entries: { week: number; individualLoss: number; waist: number }[] = []
    for (let i = 1; i < allWeeks.length; i++) {
      const curr = allWeeks[i]
      const prev = allWeeks[i - 1]
      if (curr.week_number > 0 && curr.waist !== null && prev.waist !== null) {
        const prevW = Number(prev.waist)
        const currW = Number(curr.waist)
        if (Number.isFinite(prevW) && Number.isFinite(currW) && prevW !== 0) {
          const lossPct = ((prevW - currW) / prevW) * 100
          entries.push({ week: curr.week_number, individualLoss: lossPct, waist: currW })
        }
      }
    }

    const plateau = entries.map((entry) => {
      let value = 0
      if (entry.week === 1) value = entry.individualLoss
      else if (entry.week === 2) {
        const w1 = entries.find((w) => w.week === 1)?.individualLoss || 0
        value = (w1 + entry.individualLoss) / 2
      } else if (entry.week === 3) {
        const w1 = entries.find((w) => w.week === 1)?.individualLoss || 0
        const w2 = entries.find((w) => w.week === 2)?.individualLoss || 0
        value = (w1 + w2 + entry.individualLoss) / 3
      } else if (entry.week === 4) {
        const w1 = entries.find((w) => w.week === 1)?.individualLoss || 0
        const w2 = entries.find((w) => w.week === 2)?.individualLoss || 0
        const w3 = entries.find((w) => w.week === 3)?.individualLoss || 0
        value = (w1 + w2 + w3 + entry.individualLoss) / 4
      } else {
        const currentWeekIndex = entries.findIndex((w) => w.week === entry.week)
        const last4 = entries.slice(Math.max(0, currentWeekIndex - 3), currentWeekIndex + 1)
        const sum = last4.reduce((acc, w) => acc + w.individualLoss, 0)
        value = sum / last4.length
      }
      return {
        week: entry.week,
        value: Math.round(value * 10) / 10,
        extra: { individualLoss: Math.round(entry.individualLoss * 10) / 10, waist: entry.waist }
      } as AliasMobileValuePillPoint
    })
    return plateau
  }, [data])

  const renderContent = (pt: AliasMobileValuePillPoint) => {
    const d = pt.extra || {}
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{`Week ${pt.week}`}</div>
        <div className="text-orange-600">{`Waist Plateau Prevention: ${pt.value}%`}</div>
        {typeof d.individualLoss === 'number' ? (
          <div className="text-green-600 text-xs">{`Individual Week Loss: ${d.individualLoss}%`}</div>
        ) : null}
        {typeof d.waist === 'number' ? (
          <div className="text-gray-600 text-xs">{`Waist: ${d.waist}`}</div>
        ) : null}
      </div>
    )
  }

  return (
    <AliasMobileValuePill
      data={data}
      deriveSeries={() => series}
      renderContent={renderContent}
      leftMargin={leftMargin}
      rightMargin={rightMargin}
      enableDesktop
    >
      {children}
    </AliasMobileValuePill>
  )
}



