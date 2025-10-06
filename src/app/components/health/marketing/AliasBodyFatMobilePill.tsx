'use client'

import React, { useMemo } from 'react'
import AliasMobileValuePill, { type AliasMobileValuePillPoint } from './AliasMobileValuePill'

type WeeklyLike = { week_number: number; body_fat_percentage: number | null; date?: string }

interface AliasBodyFatMobilePillProps {
  data: WeeklyLike[]
  children: React.ReactNode
}

export default function AliasBodyFatMobilePill({ data, children }: AliasBodyFatMobilePillProps) {
  const leftMargin = 20
  const rightMargin = 30

  const deriveSeries = useMemo(() => {
    return (rows: WeeklyLike[]): AliasMobileValuePillPoint[] => {
      // Align with chart data: include only rows with actual body fat values
      const filtered = (rows || [])
        .filter(r => typeof r.body_fat_percentage === 'number' && !Number.isNaN(r.body_fat_percentage as any))
        .slice()
        .sort((a, b) => a.week_number - b.week_number)
      return filtered.map((r) => ({
        week: r.week_number,
        value: Math.round((r.body_fat_percentage as number) * 10) / 10,
        extra: { date: r.date }
      }))
    }
  }, [])

  const renderContent = (pt: AliasMobileValuePillPoint) => {
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{`Week ${pt.week}`}</div>
        <div className="text-blue-600">{`Body Fat: ${pt.value ?? '—'}%`}</div>
        {/* Date intentionally hidden per Phase 3 spec */}
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
      numericXAxis
      xAccessor={(p) => p.week}
    >
      {children}
    </AliasMobileValuePill>
  )
}



