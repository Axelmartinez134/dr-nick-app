'use client'

import React, { useMemo } from 'react'
import AliasMobileValuePill, { type AliasMobileValuePillPoint } from './AliasMobileValuePill'
import { inchesToCentimeters } from '../unitCore'

type WeeklyLike = { week_number: number; waist: number | null; date?: string }

interface AliasWaistTrendMobilePillProps {
  data: WeeklyLike[]
  unitSystem: 'imperial' | 'metric'
  children: React.ReactNode
}

export default function AliasWaistTrendMobilePill({ data, unitSystem, children }: AliasWaistTrendMobilePillProps) {
  const leftMargin = 20
  const rightMargin = 30

  const deriveSeries = useMemo(() => {
    return (rows: WeeklyLike[]): AliasMobileValuePillPoint[] => {
      const sorted = (rows || []).slice().sort((a, b) => a.week_number - b.week_number)
      return sorted.map((r) => {
        const raw = (typeof r.waist === 'number' && !Number.isNaN(r.waist)) ? r.waist : null
        const val = unitSystem === 'metric' ? (raw !== null ? inchesToCentimeters(raw) : null) : raw
        const rounded = val !== null ? Math.round((val as number) * 10) / 10 : null
        return { week: r.week_number, value: rounded, extra: { date: r.date } }
      })
    }
  }, [unitSystem])

  const renderContent = (pt: AliasMobileValuePillPoint) => {
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{`Week ${pt.week}`}</div>
        <div className="text-orange-600">{`Waist: ${pt.value ?? '—'} ${unitSystem === 'metric' ? 'cm' : 'inches'}`}</div>
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
    >
      {children}
    </AliasMobileValuePill>
  )
}



