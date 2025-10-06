'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

export interface AliasMobileValuePillPoint {
  week: number
  value: number | null
  extra?: Record<string, any>
}

interface AliasMobileValuePillProps<T> {
  data: T[]
  deriveSeries: (data: T[]) => AliasMobileValuePillPoint[]
  renderContent: (point: AliasMobileValuePillPoint) => React.ReactNode
  leftMargin?: number
  rightMargin?: number
  enableDesktop?: boolean
  pillOffsetY?: number
  pillAbsoluteTop?: number | null
  children: React.ReactNode
}

export default function AliasMobileValuePill<T>({ data, deriveSeries, renderContent, leftMargin = 20, rightMargin = 30, enableDesktop = false, pillOffsetY = 4, pillAbsoluteTop = null, children }: AliasMobileValuePillProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pillRef = useRef<HTMLDivElement | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [pillOpen, setPillOpen] = useState(false)
  const [pillTop, setPillTop] = useState<number | null>(null)
  const rafPending = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = () => setIsMobile(mq.matches)
    handler()
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
    } else {
      mq.addListener(handler as any)
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', handler)
      } else {
        mq.removeListener(handler as any)
      }
    }
  }, [])

  const series = useMemo(() => deriveSeries(data), [data, deriveSeries])
  const pillEnabled = isMobile || enableDesktop

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
    if (!pillEnabled) return
    computePillTop()
    const onResize = () => computePillTop()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    let ro: ResizeObserver | null = null
    const chartEl = containerRef.current?.querySelector('.recharts-responsive-container, .recharts-wrapper') as HTMLElement | null
    if (chartEl && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => computePillTop())
      ro.observe(chartEl)
    }
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      if (ro) ro.disconnect()
    }
  }, [pillEnabled, children])

  const handleGlobalPointer = (target: EventTarget | null) => {
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
    if (!pillEnabled) return
    const clickHandler = (ev: MouseEvent) => handleGlobalPointer(ev.target)
    const touchHandler = (ev: TouchEvent) => handleGlobalPointer(ev.target as EventTarget)
    const keyHandler = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { setPillOpen(false); setActiveIdx(null) } }
    document.addEventListener('click', clickHandler, { passive: true })
    document.addEventListener('touchstart', touchHandler, { passive: true })
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('click', clickHandler)
      document.removeEventListener('touchstart', touchHandler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [pillEnabled, pillOpen])

  const updateFromClientXY = (clientX: number, clientY?: number) => {
    if (!containerRef.current || series.length === 0) return
    const chartEl = containerRef.current.querySelector('.recharts-responsive-container, .recharts-wrapper') as HTMLElement | null
    if (!chartEl) return
    const cRect = chartEl.getBoundingClientRect()
    const insideX = clientX >= cRect.left && clientX <= cRect.right
    const insideY = typeof clientY === 'number' ? (clientY >= cRect.top && clientY <= cRect.bottom) : true
    if (!(insideX && insideY)) return
    const xLocal = clientX - cRect.left
    const width = cRect.width
    const innerWidth = Math.max(1, width - (leftMargin + rightMargin))
    const clamped = Math.max(leftMargin, Math.min(width - rightMargin, xLocal))
    const ratio = (clamped - leftMargin) / innerWidth
    const idx = Math.round(ratio * (series.length - 1))
    setActiveIdx(Math.max(0, Math.min(series.length - 1, idx)))
    setPillOpen(true)
  }

  const scheduleUpdate = (x: number, y?: number) => {
    if (!pillEnabled) return
    if (rafPending.current) return
    rafPending.current = true
    requestAnimationFrame(() => {
      updateFromClientXY(x, y)
      rafPending.current = false
    })
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!pillEnabled) return
    if (e.touches && e.touches.length > 0) {
      scheduleUpdate(e.touches[0].clientX, e.touches[0].clientY)
    }
  }
  const onTouchStart = (e: React.TouchEvent) => {
    if (!pillEnabled) return
    if (e.touches && e.touches.length > 0) {
      scheduleUpdate(e.touches[0].clientX, e.touches[0].clientY)
    }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!pillEnabled) return
    scheduleUpdate(e.clientX, e.clientY)
  }
  const onMouseLeave = () => {
    if (!enableDesktop) return
    setPillOpen(false)
    setActiveIdx(null)
  }

  return (
    <div className="relative" ref={containerRef} style={{ touchAction: isMobile ? 'pan-y' as any : 'auto' }}>
      {pillEnabled ? (
        <style>{`
          .alias-mobile-pill .recharts-tooltip-wrapper{ display: none !important; }
        `}</style>
      ) : null}
      <div className={`alias-mobile-pill`}>
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} style={{ cursor: enableDesktop ? 'crosshair' : undefined }}>
          {children}
        </div>
      </div>
      {pillEnabled && pillOpen && activeIdx !== null && series[activeIdx] && (pillAbsoluteTop !== null || pillTop !== null) ? (
        <div aria-live="polite" className="absolute left-0 w-full flex justify-center z-10" style={{ top: (pillAbsoluteTop !== null ? pillAbsoluteTop : (pillTop as number) + pillOffsetY) }}>
          <div ref={pillRef} className="bg-white p-3 border rounded shadow-lg text-sm relative" style={{ pointerEvents: 'auto' }}>
            <button
              aria-label="Close"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gray-800 text-white flex items-center justify-center text-[10px]"
              onClick={() => { setPillOpen(false); setActiveIdx(null) }}
            >
              ×
            </button>
            {renderContent(series[activeIdx])}
          </div>
        </div>
      ) : null}
    </div>
  )
}


