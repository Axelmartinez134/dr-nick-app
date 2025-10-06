'use client'

import React, { useMemo } from 'react'
import AliasMobileValuePill, { type AliasMobileValuePillPoint } from './AliasMobileValuePill'

type WeeklyLike = { week_number: number; diastolic_bp: number | null; date?: string }

interface AliasDiastolicMobilePillProps {
  data: WeeklyLike[]
  children: React.ReactNode
}

export default function AliasDiastolicMobilePill({ data, children }: AliasDiastolicMobilePillProps) {
  const leftMargin = 20
  const rightMargin = 30

  const deriveSeries = useMemo(() => {
    return (rows: WeeklyLike[]): AliasMobileValuePillPoint[] => {
      const sorted = (rows || []).slice().sort((a, b) => a.week_number - b.week_number)
      return sorted.map((r) => ({
        week: r.week_number,
        value: (typeof r.diastolic_bp === 'number' && !Number.isNaN(r.diastolic_bp) ? Math.round(r.diastolic_bp * 100) / 100 : null),
        extra: { date: r.date }
      }))
    }
  }, [])

  const renderContent = (pt: AliasMobileValuePillPoint) => {
    const d = pt.extra || {}
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{`Week ${pt.week}`}</div>
        <div className="text-blue-600">{`Diastolic: ${pt.value ?? '—'} mmHg`}</div>
        {d.date ? (
          <div className="text-gray-600 text-xs">{`Date: ${d.date}`}</div>
        ) : null}
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


