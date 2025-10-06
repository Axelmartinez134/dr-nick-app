'use client'

import React, { useMemo } from 'react'
import AliasMobileValuePill, { type AliasMobileValuePillPoint } from './AliasMobileValuePill'

type WeeklyLike = { week_number: number; morning_fat_burn_percent: number | null; date?: string }

interface AliasMorningFatBurnMobilePillProps {
  data: WeeklyLike[]
  children: React.ReactNode
}

export default function AliasMorningFatBurnMobilePill({ data, children }: AliasMorningFatBurnMobilePillProps) {
  const leftMargin = 20
  const rightMargin = 30

  const deriveSeries = useMemo(() => {
    return (rows: WeeklyLike[]): AliasMobileValuePillPoint[] => {
      const sorted = (rows || []).slice().sort((a, b) => a.week_number - b.week_number)
      return sorted.map((r) => ({
        week: r.week_number,
        value: (typeof r.morning_fat_burn_percent === 'number' && !Number.isNaN(r.morning_fat_burn_percent) ? Math.round(r.morning_fat_burn_percent * 10) / 10 : null),
        extra: { date: r.date }
      }))
    }
  }, [])

  const renderContent = (pt: AliasMobileValuePillPoint) => {
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{`Week ${pt.week}`}</div>
        <div className="text-orange-600">{`Morning Fat Burn: ${pt.value ?? '—'}%`}</div>
        {/* No date per Phase 4 spec */}
      </div>
    )
  }

  return (
    <AliasMobileValuePill
      data={data}
      deriveSeries={deriveSeries}
      renderContent={renderContent}
      leftMargin={leftMargin}
      rightMargin={rightMargin}
      enableDesktop
    >
      {children}
    </AliasMobileValuePill>
  )
}



