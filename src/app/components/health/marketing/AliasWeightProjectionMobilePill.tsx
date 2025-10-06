'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import AliasMobileValuePill, { type AliasMobileValuePillPoint } from './AliasMobileValuePill'
import { poundsToKilograms } from '../unitCore'
import { generateWeightProjections } from '../healthService'

type Row = { week_number: number; weight: number | null; initial_weight?: number | null; date?: string }

interface AliasWeightProjectionMobilePillProps {
  data: Row[]
  unitSystem: 'imperial' | 'metric'
  children: React.ReactNode
}

export default function AliasWeightProjectionMobilePill({ data, unitSystem, children }: AliasWeightProjectionMobilePillProps) {
  const leftMargin = 20
  const rightMargin = 30
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [pillTop, setPillTop] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const legend = el.querySelector('.recharts-legend-wrapper') as HTMLElement | null
      if (!legend) return
      const cRect = el.getBoundingClientRect()
      const lRect = legend.getBoundingClientRect()
      // place pill 10px above legend top
      setPillTop(lRect.top - cRect.top - 10)
    }
    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(el)
    window.addEventListener('orientationchange', compute)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', compute)
      window.removeEventListener('resize', compute)
    }
  }, [])

  const deriveSeries = useMemo(() => {
    return (rows: Row[]): AliasMobileValuePillPoint[] => {
      const sorted = (rows || []).slice().sort((a, b) => a.week_number - b.week_number)
      if (sorted.length === 0) return []
      // Determine initial weight similar to chart logic
      const week0 = sorted.find(r => r.week_number === 0 && (r.initial_weight || r.weight))
      const initial = (week0?.initial_weight ?? week0?.weight) ?? (sorted.find(r => typeof r.weight === 'number')?.weight ?? null)
      const latestWeek = Math.max(...sorted.map(r => r.week_number))
      const projections = typeof initial === 'number' ? generateWeightProjections(initial, latestWeek) : []

      const projByWeek: Record<number, Partial<Record<string, number>>> = {}
      if (projections && projections.length > 0) {
        projections.forEach((proj, idx) => {
          proj.data.forEach(p => {
            if (!projByWeek[p.week]) projByWeek[p.week] = {}
            ;(projByWeek[p.week] as any)[`projection${idx}`] = p.weight
          })
        })
      }

      return Array.from({ length: latestWeek + 1 }).map((_, w) => {
        const rec = sorted.find(r => r.week_number === w)
        const rawActual = (rec && typeof rec.weight === 'number' && !Number.isNaN(rec.weight)) ? rec.weight : null
        const actualConv = unitSystem === 'metric' ? (rawActual !== null ? poundsToKilograms(rawActual) : null) : rawActual
        const p = projByWeek[w] || {}
        const p0 = (p as any).projection0 as number | undefined
        const p1 = (p as any).projection1 as number | undefined
        const p2 = (p as any).projection2 as number | undefined
        const p3 = (p as any).projection3 as number | undefined
        const conv = (v?: number) => {
          if (typeof v !== 'number' || Number.isNaN(v)) return null
          return unitSystem === 'metric' ? (poundsToKilograms(v) ?? null) : v
        }
        return {
          week: w,
          value: (actualConv !== null ? Math.round((actualConv as number) * 10) / 10 : null),
          extra: {
            date: rec?.date,
            projection0: conv(p0) !== null ? Math.round((conv(p0) as number) * 10) / 10 : null,
            projection1: conv(p1) !== null ? Math.round((conv(p1) as number) * 10) / 10 : null,
            projection2: conv(p2) !== null ? Math.round((conv(p2) as number) * 10) / 10 : null,
            projection3: conv(p3) !== null ? Math.round((conv(p3) as number) * 10) / 10 : null
          }
        }
      })
    }
  }, [unitSystem])

  const renderContent = (pt: AliasMobileValuePillPoint) => {
    const d = (pt.extra || {}) as any
    return (
      <div className="text-sm">
        <div className="font-medium text-gray-900">{`Week ${pt.week}`}</div>
        <div className="text-red-600">{`Actual: ${pt.value ?? '—'} ${unitSystem === 'metric' ? 'kg' : 'lbs'}`}</div>
        {d.projection0 !== undefined && d.projection0 !== null ? (
          <div className="text-emerald-600">{`0.5% Loss/Week: ${d.projection0} ${unitSystem === 'metric' ? 'kg' : 'lbs'}`}</div>
        ) : null}
        {d.projection1 !== undefined && d.projection1 !== null ? (
          <div className="text-blue-600">{`1.0% Loss/Week: ${d.projection1} ${unitSystem === 'metric' ? 'kg' : 'lbs'}`}</div>
        ) : null}
        {d.projection2 !== undefined && d.projection2 !== null ? (
          <div className="text-purple-600">{`1.5% Loss/Week: ${d.projection2} ${unitSystem === 'metric' ? 'kg' : 'lbs'}`}</div>
        ) : null}
        {d.projection3 !== undefined && d.projection3 !== null ? (
          <div className="text-amber-600">{`2.0% Loss/Week: ${d.projection3} ${unitSystem === 'metric' ? 'kg' : 'lbs'}`}</div>
        ) : null}
        {d.date ? (
          <div className="text-gray-600 text-xs mt-1">{`Date: ${d.date}`}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Keep built-in legend, but force 3-row layout via grid (Actual full width, 2 items per subsequent row) */}
      <style>{`
        .alias-wp-legend .recharts-legend-wrapper{ bottom:-12px !important; }
        .alias-wp-legend .recharts-legend-wrapper ul{ display:grid !important; grid-template-columns: repeat(2, max-content); justify-content:center; column-gap:24px; row-gap:6px; }
        .alias-wp-legend .recharts-legend-wrapper li{ margin:0 !important; display:flex !important; align-items:center; }
        .alias-wp-legend .recharts-legend-wrapper li:nth-child(1){ grid-column:1 / -1; justify-content:center; }
      `}</style>
      <div className="alias-wp-legend">
        <AliasMobileValuePill
          data={data}
          deriveSeries={deriveSeries}
          renderContent={renderContent}
          leftMargin={leftMargin}
          rightMargin={rightMargin}
          enableDesktop
          pillOffsetY={0}
          pillAbsoluteTop={pillTop}
        >
          {children}
        </AliasMobileValuePill>
      </div>
    </div>
  )
}


