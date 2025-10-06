'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

type WeeklyLike = { week_number: number; weight: number | null; date?: string }

interface AliasPlateauMobilePillProps {
  data: WeeklyLike[]
  children: React.ReactNode
}

export default function AliasPlateauMobilePill({ data, children }: AliasPlateauMobilePillProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [pillOpen, setPillOpen] = useState(false)

  // Detect mobile once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = () => setIsMobile(mq.matches)
    handler()
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler as any)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler as any)
    }
  }, [])

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
      return { week: entry.week, value: Math.round(value * 100) / 100 }
    })
    return plateau
  }, [data])

  // Map x position to nearest series index (approximate using chart margins)
  const leftMargin = 20
  const rightMargin = 30

  const handlePointFromEvent = (clientX: number) => {
    if (!containerRef.current || series.length === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const innerWidth = Math.max(1, rect.width - (leftMargin + rightMargin))
    const clamped = Math.max(leftMargin, Math.min(rect.width - rightMargin, x))
    const ratio = (clamped - leftMargin) / innerWidth
    const idx = Math.round(ratio * (series.length - 1))
    setActiveIdx(Math.max(0, Math.min(series.length - 1, idx)))
    setPillOpen(true)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return
    if (e.touches && e.touches.length > 0) {
      handlePointFromEvent(e.touches[0].clientX)
    }
  }
  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return
    if (e.touches && e.touches.length > 0) {
      handlePointFromEvent(e.touches[0].clientX)
    }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isMobile) return
    handlePointFromEvent(e.clientX)
  }

  const onOutsideClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    if (!containerRef.current.contains(e.target as Node)) {
      setPillOpen(false)
      setActiveIdx(null)
    }
  }

  useEffect(() => {
    if (!isMobile) return
    const handler = (ev: MouseEvent) => onOutsideClick(ev as any)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [isMobile])

  // Render
  return (
    <div className="relative" ref={containerRef} style={{ touchAction: isMobile ? 'pan-y' as any : 'auto' }}>
      {/* Hide internal Recharts tooltip on mobile only */}
      {isMobile ? (
        <style>{`.alias-mobile-pill .recharts-tooltip-wrapper{ display: none !important; }`}</style>
      ) : null}
      <div className={isMobile ? 'alias-mobile-pill' : undefined}>
        {/* Chart content */}
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onMouseMove={onMouseMove}>
          {children}
        </div>
      </div>
      {/* External pill */}
      {isMobile && pillOpen && activeIdx !== null && series[activeIdx] ? (
        <div aria-live="polite" className="mt-2 px-3 py-2 rounded bg-gray-900 text-white text-sm inline-block">
          {`Week ${series[activeIdx].week}: ${series[activeIdx].value}% weight-loss rate`}
        </div>
      ) : null}
    </div>
  )
}


