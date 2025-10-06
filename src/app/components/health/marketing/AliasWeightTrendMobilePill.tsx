'use client'

import React, { useMemo } from 'react'
import AliasMobileValuePill, { type AliasMobileValuePillPoint } from './AliasMobileValuePill'
import { poundsToKilograms } from '../unitCore'

type WeeklyLike = { week_number: number; weight: number | null; date?: string }

interface AliasWeightTrendMobilePillProps {
  data: WeeklyLike[]
  unitSystem: 'imperial' | 'metric'
  children: React.ReactNode
}

export default function AliasWeightTrendMobilePill({ data, unitSystem, children }: AliasWeightTrendMobilePillProps) {
  const leftMargin = 20
  const rightMargin = 30

  const deriveSeries = useMemo(() => {
    return (rows: WeeklyLike[]): AliasMobileValuePillPoint[] => {
      const sorted = (rows || []).slice().sort((a, b) => a.week_number - b.week_number)
      return sorted.map((r) => {
        const raw = (typeof r.weight === 'number' && !Number.isNaN(r.weight)) ? r.weight : null
        const converted = unitSystem === 'metric' ? (raw !== null ? poundsToKilograms(raw) : null) : raw
        return { week: r.week_number, value: (converted !== null ? Math.round((converted as number) * 10) / 10 : null), extra: { date: r.date } }
      })
    }
  }, [unitSystem])

  const renderContent = (pt: AliasMobileValuePillPoint) => {
    const d = pt.extra || {}
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{`Week ${pt.week}`}</div>
        <div className="text-orange-600">{`Weight: ${pt.value ?? '—'} ${unitSystem === 'metric' ? 'kg' : 'lbs'}`}</div>
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
      numericXAxis
      xAccessor={(p) => p.week}
    >
      {children}
    </AliasMobileValuePill>
  )
}


