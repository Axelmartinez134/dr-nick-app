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
  const [pillTop, setPillTop] = useState<number | null>(null)
  const pillRef = useRef<HTMLDivElement | null>(null)

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
      const weight = allWeeks.find((w) => w.week_number === entry.week)?.weight
      return {
        week: entry.week,
        value: Math.round(value * 100) / 100,
        individualLoss: Math.round(entry.individualLoss * 100) / 100,
        weight: typeof weight === 'number' ? Math.round(weight * 100) / 100 : null
      }
    })
    return plateau
  }, [data])

  // Map x position to nearest series index (approximate using chart margins)
  const leftMargin = 20
  const rightMargin = 30

  const handlePointFromEvent = (clientX: number, clientY?: number) => {
    if (!containerRef.current || series.length === 0) return
    const chartEl = containerRef.current.querySelector('.recharts-responsive-container, .recharts-wrapper') as HTMLElement | null
    if (!chartEl) return
    const cRect = chartEl.getBoundingClientRect()
    const insideX = clientX >= cRect.left && clientX <= cRect.right
    const insideY = typeof clientY === 'number' ? (clientY >= cRect.top && clientY <= cRect.bottom) : true
    if (!(insideX && insideY)) return // ignore touches/clicks outside actual chart area

    const xLocal = clientX - cRect.left
    const width = cRect.width
    const innerWidth = Math.max(1, width - (leftMargin + rightMargin))
    const clamped = Math.max(leftMargin, Math.min(width - rightMargin, xLocal))
    const ratio = (clamped - leftMargin) / innerWidth
    const idx = Math.round(ratio * (series.length - 1))
    setActiveIdx(Math.max(0, Math.min(series.length - 1, idx)))
    setPillOpen(true)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return
    if (e.touches && e.touches.length > 0) {
      handlePointFromEvent(e.touches[0].clientX, e.touches[0].clientY)
    }
  }
  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return
    if (e.touches && e.touches.length > 0) {
      handlePointFromEvent(e.touches[0].clientX, e.touches[0].clientY)
    }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isMobile) return
    handlePointFromEvent(e.clientX, e.clientY)
  }

  const handleGlobalPointer = (target: EventTarget | null) => {
    // Close if clicking/tapping anywhere outside the pill itself
    if (!pillOpen) return
    const pillEl = pillRef.current
    if (!pillEl) { setPillOpen(false); setActiveIdx(null); return }
    if (target instanceof Node) {
      if (!pillEl.contains(target)) {
        setPillOpen(false)
        setActiveIdx(null)
      }
    }
  }

  useEffect(() => {
    if (!isMobile) return
    const clickHandler = (ev: MouseEvent) => handleGlobalPointer(ev.target)
    const touchHandler = (ev: TouchEvent) => handleGlobalPointer(ev.target as EventTarget)
    document.addEventListener('click', clickHandler, { passive: true })
    document.addEventListener('touchstart', touchHandler, { passive: true })
    return () => {
      document.removeEventListener('click', clickHandler)
      document.removeEventListener('touchstart', touchHandler)
    }
  }, [isMobile, pillOpen])

  // Compute pill top position based on Recharts container
  const computePillTop = () => {
    if (!containerRef.current) return
    const wrapper = containerRef.current
    const chartEl = wrapper.querySelector('.recharts-responsive-container, .recharts-wrapper') as HTMLElement | null
    if (!chartEl) { setPillTop(null); return }
    const wrapRect = wrapper.getBoundingClientRect()
    const chartRect = chartEl.getBoundingClientRect()
    const top = chartRect.bottom - wrapRect.top
    setPillTop(top)
  }

  useEffect(() => {
    if (!isMobile) return
    computePillTop()
    const onResize = () => computePillTop()
    window.addEventListener('resize', onResize)
    const id = window.setInterval(computePillTop, 300) // guard for async layout
    return () => { window.removeEventListener('resize', onResize); window.clearInterval(id) }
  }, [isMobile, children, pillOpen])

  // Render
  return (
    <div className="relative" ref={containerRef} style={{ touchAction: isMobile ? 'pan-y' as any : 'auto' }}>
      {/* Mobile-only CSS: hide built-in tooltip; do NOT push description down (overlay pill above text) */}
      {isMobile ? (
        <style>{`
          .alias-mobile-pill .recharts-tooltip-wrapper{ display: none !important; }
        `}</style>
      ) : null}
      <div className={`${isMobile ? 'alias-mobile-pill' : ''} ${isMobile && pillOpen ? 'pill-open' : ''}`.trim()}>
        {/* Chart content with gesture capture */}
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onMouseMove={onMouseMove}>
          {children}
        </div>
      </div>
      {/* External pill absolutely positioned just below the chart area */}
      {isMobile && pillOpen && activeIdx !== null && series[activeIdx] && pillTop !== null ? (
        <div
          aria-live="polite"
          className="absolute left-0 w-full flex justify-center"
          style={{ top: pillTop + 4 }}
        >
          <div ref={pillRef} className="bg-white p-3 border rounded shadow-lg text-sm relative" style={{ pointerEvents: 'auto' }}>
            <button
              aria-label="Close"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gray-800 text-white flex items-center justify-center text-[10px]"
              onClick={() => { setPillOpen(false); setActiveIdx(null) }}
            >
              ×
            </button>
            <div className="font-medium text-gray-900">{`Week ${series[activeIdx].week}`}</div>
            <div className="text-blue-600">{`Plateau Prevention: ${series[activeIdx].value}%`}</div>
            {series[activeIdx].individualLoss !== undefined && series[activeIdx].individualLoss !== null ? (
              <div className="text-green-600 text-xs">{`Individual Week Loss: ${series[activeIdx].individualLoss}%`}</div>
            ) : null}
            {typeof series[activeIdx].weight === 'number' ? (
              <div className="text-gray-600 text-xs">{`Weight: ${series[activeIdx].weight} lbs`}</div>
            ) : null}
            <div className="text-xs text-gray-500 mt-1 border-t pt-1">
              {series[activeIdx].week <= 1 && "= Individual week loss"}
              {series[activeIdx].week === 2 && "= Avg of weeks 1-2"}
              {series[activeIdx].week === 3 && "= Avg of weeks 1-3"}
              {series[activeIdx].week === 4 && "= Avg of weeks 1-4"}
              {series[activeIdx].week > 4 && "= Rolling 4-week average"}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


