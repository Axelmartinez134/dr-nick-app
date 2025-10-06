'use client'

import React, { useMemo } from 'react'
import AliasMobileValuePill, { type AliasMobileValuePillPoint } from './AliasMobileValuePill'

type WeeklyLike = { week_number: number; sleep_consistency_score: number | null; date?: string }

interface AliasSleepMobilePillProps {
  data: WeeklyLike[]
  children: React.ReactNode
}

export default function AliasSleepMobilePill({ data, children }: AliasSleepMobilePillProps) {
  const leftMargin = 20
  const rightMargin = 30

  const deriveSeries = useMemo(() => {
    return (rows: WeeklyLike[]): AliasMobileValuePillPoint[] => {
      const sorted = (rows || []).slice().sort((a, b) => a.week_number - b.week_number)
      return sorted.map((r) => ({
        week: r.week_number,
        value: (typeof r.sleep_consistency_score === 'number' && !Number.isNaN(r.sleep_consistency_score) ? Math.round(r.sleep_consistency_score) : null),
        extra: { date: r.date }
      }))
    }
  }, [])

  const renderContent = (pt: AliasMobileValuePillPoint) => {
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{`Week ${pt.week}`}</div>
        <div className="text-gray-800">{`Sleep Consistency Score: ${pt.value ?? '—'}/100`}</div>
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



