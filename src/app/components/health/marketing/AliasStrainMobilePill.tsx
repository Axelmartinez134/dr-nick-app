'use client'

import React, { useMemo } from 'react'
import AliasMobileValuePill, { type AliasMobileValuePillPoint } from './AliasMobileValuePill'

type WeeklyLike = { week_number: number; purposeful_exercise_days: number | null; date?: string }

interface AliasStrainMobilePillProps {
  data: WeeklyLike[]
  children: React.ReactNode
}

export default function AliasStrainMobilePill({ data, children }: AliasStrainMobilePillProps) {
  const leftMargin = 20
  const rightMargin = 30

  const deriveSeries = useMemo(() => {
    return (rows: WeeklyLike[]): AliasMobileValuePillPoint[] => {
      const sorted = (rows || []).slice().sort((a, b) => a.week_number - b.week_number)
      return sorted.map((r) => ({
        week: r.week_number,
        value: (typeof r.purposeful_exercise_days === 'number' && !Number.isNaN(r.purposeful_exercise_days) ? Math.round(r.purposeful_exercise_days) : null),
        extra: { date: r.date }
      }))
    }
  }, [])

  const renderContent = (pt: AliasMobileValuePillPoint) => {
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{`Week ${pt.week}`}</div>
        <div className="text-gray-800">{`Days Strain Goal Met: ${pt.value ?? '—'}/7`}</div>
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



