'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import type { SnapshotJson } from '@/app/components/health/marketing/snapshotTypes'
import { CTA_LABEL, TAGLINE } from '@/app/components/health/marketing/marketingConfig'
import { poundsToKilograms } from '@/app/components/health/unitUtils'
import dynamic from 'next/dynamic'
const WeightTrendChart = dynamic(() => import('@/app/components/health/charts/WeightTrendChart'), { ssr: false }) as any
const AliasWeightTrendMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasWeightTrendMobilePill'), { ssr: false })
const WeightProjectionChart = dynamic(() => import('@/app/components/health/charts/WeightProjectionChart'), { ssr: false }) as any
const AliasWeightProjectionMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasWeightProjectionMobilePill'), { ssr: false })
const ClientPlateauPreventionChart = dynamic(() => import('@/app/components/health/charts/PlateauPreventionChart'), { ssr: false })
const AliasPlateauMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasPlateauMobilePill'), { ssr: false })
const WaistTrendChart = dynamic(() => import('@/app/components/health/charts/WaistTrendChart'), { ssr: false }) as any
const AliasWaistTrendMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasWaistTrendMobilePill'), { ssr: false })
const WaistPlateauPreventionChart = dynamic(() => import('@/app/components/health/charts/WaistPlateauPreventionChart'), { ssr: false }) as any
const AliasWaistPlateauMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasWaistPlateauMobilePill'), { ssr: false })
const SystolicBloodPressureChart = dynamic(() => import('@/app/components/health/charts/SystolicBloodPressureChart'), { ssr: false }) as any
const AliasSystolicMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasSystolicMobilePill'), { ssr: false })
const DiastolicBloodPressureChart = dynamic(() => import('@/app/components/health/charts/DiastolicBloodPressureChart'), { ssr: false }) as any
const AliasDiastolicMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasDiastolicMobilePill'), { ssr: false })
const StrainGoalMetChart = dynamic(() => import('@/app/components/health/charts/StrainGoalMetChart'), { ssr: false }) as any
const AliasStrainMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasStrainMobilePill'), { ssr: false })
const NutritionComplianceChart = dynamic(() => import('@/app/components/health/charts/NutritionComplianceChart'), { ssr: false }) as any
const AliasNutritionMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasNutritionMobilePill'), { ssr: false })
const SleepConsistencyChart = dynamic(() => import('@/app/components/health/charts/SleepConsistencyChart'), { ssr: false }) as any
const AliasSleepMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasSleepMobilePill'), { ssr: false })
const MorningFatBurnChart = dynamic(() => import('@/app/components/health/charts/MorningFatBurnChart'), { ssr: false }) as any
const AliasMorningFatBurnMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasMorningFatBurnMobilePill'), { ssr: false })
const BodyFatPercentageChart = dynamic(() => import('@/app/components/health/charts/BodyFatPercentageChart'), { ssr: false }) as any
const AliasBodyFatMobilePill = dynamic(() => import('@/app/components/health/marketing/AliasBodyFatMobilePill'), { ssr: false })

type UnitSystem = 'imperial' | 'metric'

export default function AliasStoryClient({ snapshot, shareSlug, pageType = 'alias', pageAlias }: { snapshot: SnapshotJson; shareSlug?: string; pageType?: 'alias' | 'version'; pageAlias?: string }) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')
  const [showStickyCTA, setShowStickyCTA] = useState(false)
  const [aliasForTracking, setAliasForTracking] = useState<string>(pageAlias || '')
  const [testimonialMediaOpen, setTestimonialMediaOpen] = useState(false)

  // Placeholder sizing: hero and testimonial pairs
  const heroLeftRef = useRef<HTMLDivElement | null>(null)
  const heroRightRef = useRef<HTMLDivElement | null>(null)
  const [heroHeights, setHeroHeights] = useState<{ left: number; right: number }>({ left: 0, right: 0 })

  const frontBeforeRef = useRef<HTMLDivElement | null>(null)
  const frontAfterRef = useRef<HTMLDivElement | null>(null)
  const sideBeforeRef = useRef<HTMLDivElement | null>(null)
  const sideAfterRef = useRef<HTMLDivElement | null>(null)
  const rearBeforeRef = useRef<HTMLDivElement | null>(null)
  const rearAfterRef = useRef<HTMLDivElement | null>(null)
  const [testimonialHeights, setTestimonialHeights] = useState<Record<'front' | 'side' | 'rear', { before: number; after: number }>>({ front: { before: 0, after: 0 }, side: { before: 0, after: 0 }, rear: { before: 0, after: 0 } })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const measureHero = () => {
      try {
        const leftEl = heroLeftRef.current || null
        const rightEl = heroRightRef.current || null
        const lMedia = leftEl ? (leftEl.querySelector('img,video') as HTMLElement | null) : null
        const rMedia = rightEl ? (rightEl.querySelector('img,video') as HTMLElement | null) : null
        const lPh = leftEl ? (leftEl.querySelector('[data-ph="hero-left"]') as HTMLElement | null) : null
        const rPh = rightEl ? (rightEl.querySelector('[data-ph="hero-right"]') as HTMLElement | null) : null
        const lh = (lMedia?.clientHeight || lPh?.clientHeight || 0)
        const rh = (rMedia?.clientHeight || rPh?.clientHeight || 0)
        setHeroHeights({ left: lh, right: rh })
      } catch {}
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureHero) : null
    if (heroLeftRef.current) ro?.observe(heroLeftRef.current)
    if (heroRightRef.current) ro?.observe(heroRightRef.current)
    window.addEventListener('resize', measureHero)
    setTimeout(measureHero, 0)
    setTimeout(measureHero, 300)
    return () => {
      try { ro?.disconnect() } catch {}
      window.removeEventListener('resize', measureHero)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const measureTestimonials = () => {
      try {
        setTestimonialHeights({
          front: { before: frontBeforeRef.current?.clientHeight || 0, after: frontAfterRef.current?.clientHeight || 0 },
          side: { before: sideBeforeRef.current?.clientHeight || 0, after: sideAfterRef.current?.clientHeight || 0 },
          rear: { before: rearBeforeRef.current?.clientHeight || 0, after: rearAfterRef.current?.clientHeight || 0 }
        })
      } catch {}
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureTestimonials) : null
    ;[frontBeforeRef, frontAfterRef, sideBeforeRef, sideAfterRef, rearBeforeRef, rearAfterRef].forEach(r => { if (r.current) ro?.observe(r.current!) })
    window.addEventListener('resize', measureTestimonials)
    // Measure when testimonial section toggles open
    setTimeout(measureTestimonials, 0)
    setTimeout(measureTestimonials, 300)
    return () => {
      try { ro?.disconnect() } catch {}
      window.removeEventListener('resize', measureTestimonials)
    }
  }, [testimonialMediaOpen])


  const m = snapshot.metrics
  const meta = snapshot.meta
  const ctaLabel = (meta as any)?.ctaLabel || 'Book a consult'
  const displayLabel = (meta as any)?.displayNameOverride || meta.patientLabel
  const firstNameForTitle = String(displayLabel || 'Client').split(' ')[0]
  const slug = (shareSlug as any) || (snapshot?.meta as any)?.slug
  const chartsEnabled = {
    weightTrend: true,
    projection: true,
    plateauWeight: true,
    waistTrend: false,
    plateauWaist: false,
    nutritionCompliancePct: false,
    sleepTrend: false,
    systolicTrend: false,
    diastolicTrend: false,
    strainTrend: false,
    disciplineNutritionCompliancePct: false,
    disciplineStrainTrend: false,
    morningFatBurnTrend: false,
    bodyFatTrend: false,
    ...(meta as any)?.chartsEnabled
  } as Record<string, boolean>

  // Preconnect to media host and preload hero assets
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const media: any = (snapshot as any)?.media || {}
      const heroCandidates: (string | undefined)[] = [
        media?.beforePhotoUrl as string | undefined,
        media?.afterPhotoUrl as string | undefined,
        media?.loopVideoUrl as string | undefined
      ]
      const urls: string[] = heroCandidates.filter((u): u is string => !!u)
      const head = document.head
      if (head && urls.length > 0) {
        const host = new URL(urls[0]).origin
        const preconnect = document.createElement('link')
        preconnect.rel = 'preconnect'
        preconnect.href = host
        preconnect.crossOrigin = 'anonymous'
        head.appendChild(preconnect)

        const dnsPrefetch = document.createElement('link')
        dnsPrefetch.rel = 'dns-prefetch'
        dnsPrefetch.href = host
        head.appendChild(dnsPrefetch)

        urls.slice(0, 2).forEach((u) => {
          try {
            const isMp4 = /\.mp4($|\?)/i.test(new URL(u).pathname)
            const link = document.createElement('link')
            link.rel = 'preload'
            link.as = isMp4 ? 'video' : 'image'
            if (isMp4) link.type = 'video/mp4'
            link.href = u
            head.appendChild(link)
          } catch {}
        })
      }

      // Preconnect to PDF host if present
      try {
        const pdfUrl = (snapshot as any)?.media?.testing?.pdfUrl as string | undefined
        if (pdfUrl && head) {
          const pdfHost = new URL(pdfUrl).origin
          const pc = document.createElement('link')
          pc.rel = 'preconnect'
          pc.href = pdfHost
          pc.crossOrigin = 'anonymous'
          head.appendChild(pc)

          const dp = document.createElement('link')
          dp.rel = 'dns-prefetch'
          dp.href = pdfHost
          head.appendChild(dp)
        }
      } catch {}
    } catch {}
  }, [snapshot])
  const reportClick = (ctaId: string) => {
    try {
      const s = (window as any).__marketingSlug || slug
      if (s) {
        fetch(`/api/marketing/shares/${encodeURIComponent(s)}/click`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ctaId, pageType })
        })
      }
    } catch {}
  }

  // Sticky CTA visibility (mobile only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (!isMobile) return
    setShowStickyCTA(true) // show immediately on load
    const target = document.querySelector('.lead-capture') as Element | null
    if (!target) return
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      setShowStickyCTA(!entry.isIntersecting)
    }, { threshold: 0.01, rootMargin: '0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  const scrollToCTA = (source?: string): void => {
    try { reportClick(source || 'cta') } catch {}
    // Hide sticky CTA during programmatic scroll
    setShowStickyCTA(false)
    const el = document.getElementById('cta')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // After a short delay, decide visibility based on whether CTA is in view
    window.setTimeout(() => {
      try {
        const target = document.getElementById('cta')
        if (!target) return
        const r = target.getBoundingClientRect()
        const fullyInView = r.top >= 0 && r.bottom <= window.innerHeight
        setShowStickyCTA(!fullyInView)
      } catch {}
    }, 900)
  }

  // Removed Calendly init (switched to cnvrsnly embed)

  // Weeks shown logic for KPIs and hero overlays
  const weeksRawAny = (snapshot as any)?.weeksRaw
  const weeksMax = Array.isArray(weeksRawAny) && weeksRawAny.length > 0
    ? Math.max(...(weeksRawAny as any[]).map((w: any) => Number(w?.week_number || 0)))
    : 0
  const dwGlobal = (snapshot.meta as any)?.displayWeeks
  const weeksShown = typeof dwGlobal?.effectiveEnd === 'number' ? dwGlobal.effectiveEnd : weeksMax
  const weeksStart = typeof dwGlobal?.start === 'number' ? Math.max(1, Math.floor(dwGlobal.start)) : 1

  // Total loss display with two decimals and inline weeks
  const totalLossPctNum = typeof m.totalLossPct === 'number' ? (m.totalLossPct as number) : null
  const totalLossDisplay = totalLossPctNum !== null
    ? `${totalLossPctNum.toFixed(1)}%`
    : '—'

  // Average weekly fat loss % across the selected range: totalLossPct divided by weeks shown
  const avgWeeklyLossPctNum = totalLossPctNum !== null && weeksShown > 0 ? (totalLossPctNum / weeksShown) : null

  // Reduce Motion removed: always autoplay/loop videos
  // alias provided from server ensures first-render param available to embed

  

  return (
    <>
    <main className="min-h-screen bg-white pb-8">
      {/* Brand Bar */}
      <div className="w-full bg-blue-600 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto px-4 py-3 text-center">
          <div className="font-semibold tracking-wide">Data driven health guided by an actual MD.</div>
        </div>
      </div>
      {/* Header */}
      <header className="max-w-md mx-auto p-4 text-center">
        <div className="text-xs text-gray-700">Board‑Certified • 1:1 Coaching • Science‑Backed</div>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          {displayLabel}
          {(() => {
            const age = (snapshot?.meta as any)?.age
            if (typeof age === 'number') {
              return <span className="text-gray-800 font-normal">{`, ${age} Years Old`}</span>
            }
            return null
          })()}
        </h1>
        {weeksShown > 0 ? (
          <div className="mt-1 text-xl font-bold text-gray-900">{weeksShown} weeks</div>
        ) : null}
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <button
            className={`px-3 py-1 rounded-md border ${unitSystem === 'imperial' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
            onClick={() => setUnitSystem('imperial')}
          >
            Imperial
          </button>
          <button
            className={`px-3 py-1 rounded-md border ${unitSystem === 'metric' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
            onClick={() => setUnitSystem('metric')}
          >
            Metric
          </button>
        </div>
      </header>

      {/* Hero media: below unit toggle; two-column layout (left + optional right)
          Layout rules:
          - If both images exist: left=Before, right=After
          - If only After: right=After; left=Loop (if present) else empty
          - If only Before: left=Before; right=Loop (if present) else empty
          - If neither image: left=Loop (if present)
          Fit3D is ignored for hero. */}
      {(() => {
        const media = (snapshot as any)?.media || {}
        const loop = media?.loopVideoUrl as string | undefined
        const beforeUrl = media?.beforePhotoUrl as string | undefined
        const afterUrl = media?.afterPhotoUrl as string | undefined
        const firstFit3d = Array.isArray(media?.fit3d?.images) && media.fit3d.images.length > 0
          ? (media.fit3d.images[0] as string)
          : undefined

        const isMp4 = (u?: string) => {
          if (!u) return false
          try { return /\.mp4($|\?)/i.test(new URL(u).pathname) } catch { return false }
        }

        // Decide left/right explicitly
        let left: string | null = null
        let right: string | null = null
        if (beforeUrl && afterUrl) {
          left = beforeUrl
          right = afterUrl
        } else if (afterUrl && !beforeUrl) {
          right = afterUrl
          left = loop || null
        } else if (beforeUrl && !afterUrl) {
          left = beforeUrl
          right = loop || null
        } else if (!beforeUrl && !afterUrl) {
          left = loop || null
        }

        // Always render two frames; fallback to placeholders when media is missing

        const renderBox = (u: string | null | undefined, heightPx?: number, phKey?: 'hero-left' | 'hero-right' | 't-front-before' | 't-front-after' | 't-side-before' | 't-side-after' | 't-rear-before' | 't-rear-after') => (
          <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white">
            {typeof u === 'string' && u ? (
              isMp4(u) ? (
                <video src={u} muted playsInline controls={false} className="w-full h-auto pointer-events-none" loop autoPlay preload="auto" />
              ) : (
                <img src={u} alt="Hero" loading="eager" fetchPriority="high" className="w-full h-auto" />
              )
            ) : (
              <div
                className="w-full flex items-center justify-center bg-gray-100"
                style={heightPx && heightPx > 0 ? { height: heightPx, minHeight: '160px' } : { aspectRatio: '9 / 18' }}
                data-ph={phKey || ''}
                aria-label="Coming soon"
              >
                <div className="text-gray-900 text-sm font-medium">Coming Soon!</div>
              </div>
            )}
          </div>
        )

        // Decide where labels should render (only on actual before/after images)
        const showBeforeLabelOnLeft = !!beforeUrl && !!left && left === beforeUrl
        const showAfterLabelOnRight = !!afterUrl && !!right && right === afterUrl
        const beforeLabel = ((meta as any)?.beforeLabel || '').trim() || 'Before'
        const afterLabel = ((meta as any)?.afterLabel || '').trim() || 'After'

        // Helpers to format weight with units
        const formatWeight = (lbs: number): string => {
          if (unitSystem === 'metric') {
            const kg = poundsToKilograms(lbs)
            const v = typeof kg === 'number' ? kg : lbs
            return `${v.toFixed(1)} kg`
          }
          return `${lbs.toFixed(1)} lbs`
        }

        const getWeightForWeek = (weekNum: number): number | null => {
          const w = (weeksRawAny as any[])?.find((x: any) => Number(x?.week_number) === weekNum)
          if (!w) return null
          const wt = w?.fields?.weight
          return typeof wt === 'number' ? wt : null
        }

        const getNearestWeightUpTo = (endWeek: number, startWeek: number): number | null => {
          for (let i = endWeek; i >= Math.max(1, startWeek); i--) {
            const v = getWeightForWeek(i)
            if (typeof v === 'number') return v
          }
          return null
        }

        const leftWeightLbs = getWeightForWeek(0)
        const rightWeightLbs = weeksShown > 0 ? getNearestWeightUpTo(weeksShown, weeksStart) : null

        return (
          <section className="max-w-md mx-auto px-4">
            <div className="grid grid-cols-2 gap-3 items-stretch">
              <div className="relative h-full" ref={heroLeftRef}>
                {true ? (
                  <div className="absolute z-10 -top-3 left-1/2 -translate-x-1/2">
                    <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-xs text-gray-900">{beforeLabel}</div>
                  </div>
                ) : null}
                {typeof leftWeightLbs === 'number' ? (
                  <div className="absolute z-10 -bottom-3 left-1/2 -translate-x-1/2">
                    <div className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-sm font-semibold leading-tight text-gray-900 whitespace-nowrap">{formatWeight(leftWeightLbs)}</div>
                  </div>
                ) : null}
                {renderBox(left, !left && heroHeights.right > 0 ? heroHeights.right : undefined, 'hero-left')}
              </div>
              <div className="relative h-full" ref={heroRightRef}>
                {true ? (
                  <div className="absolute z-10 -top-3 left-1/2 -translate-x-1/2">
                    <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-xs text-gray-900">{afterLabel}</div>
                  </div>
                ) : null}
                {typeof rightWeightLbs === 'number' ? (
                  <div className="absolute z-10 -bottom-3 left-1/2 -translate-x-1/2">
                    <div className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-sm font-semibold leading-tight text-gray-900 whitespace-nowrap">{formatWeight(rightWeightLbs)}</div>
                  </div>
                ) : null}
                {renderBox(right, !right && heroHeights.left > 0 ? heroHeights.left : undefined, 'hero-right')}
              </div>
            </div>
          </section>
        )
      })()}

      {/* Compliance cards */}
      <section className="max-w-md mx-auto p-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700 whitespace-nowrap sm:overflow-hidden sm:text-ellipsis">{unitSystem === 'metric' ? 'Total Loss (Weight % / Kg)' : 'Total Loss (Weight % / lbs)'}</div>
          <div className="text-xl font-bold text-gray-900 whitespace-nowrap overflow-visible">
            {(() => {
              const base = totalLossDisplay
              // Compute dynamic loss: Week 0 baseline minus latest-in-range
              const getWeightForWeek = (weekNum: number): number | null => {
                const w = (weeksRawAny as any[])?.find((x: any) => Number(x?.week_number) === weekNum)
                if (!w) return null
                const wt = w?.fields?.weight
                return typeof wt === 'number' ? wt : null
              }
              const getNearestWeightUpTo = (endWeek: number, startWeek: number): number | null => {
                for (let i = endWeek; i >= Math.max(1, startWeek); i--) {
                  const v = getWeightForWeek(i)
                  if (typeof v === 'number') return v
                }
                return null
              }
              const baselineLbs = getWeightForWeek(0)
              const latestLbs = weeksShown > 0 ? getNearestWeightUpTo(weeksShown, weeksStart) : null
              if (typeof baselineLbs === 'number' && typeof latestLbs === 'number') {
                const lossLbs = baselineLbs - latestLbs
                const value = unitSystem === 'metric' ? poundsToKilograms(lossLbs) : lossLbs
                const unit = unitSystem === 'metric' ? 'kg' : 'lbs'
                const formatted = typeof value === 'number' ? value.toFixed(1) : String(value)
                return `${base} / ${formatted} ${unit}`
              }
              return base
            })()}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700">Average Weekly Fat Loss %</div>
          <div className="text-xl font-bold text-gray-900">{typeof avgWeeklyLossPctNum === 'number' ? `${avgWeeklyLossPctNum.toFixed(2)}%` : '—'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700 whitespace-nowrap sm:overflow-hidden sm:text-ellipsis">Average Nutrition Compliance %</div>
          <div className="text-xl font-bold text-gray-900 whitespace-nowrap overflow-visible">{typeof m.avgNutritionCompliancePct === 'number' ? `${m.avgNutritionCompliancePct.toFixed(2)}%` : '—'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700 whitespace-nowrap sm:overflow-hidden sm:text-ellipsis">Average Exercise Compliance %</div>
          <div className="text-xl font-bold text-gray-900 whitespace-nowrap overflow-visible">{typeof m.avgPurposefulExerciseDays === 'number' ? `${((m.avgPurposefulExerciseDays / 7) * 100).toFixed(2)}%` : '—'}</div>
        </div>
      </section>

      {/* Removed: old testimonial card and "What you'll get" section */}

      {/* Guidance copy before pillars */}
      <div className="max-w-md mx-auto px-4 mt-2 mb-2 text-center">
        <div className="text-sm font-semibold text-gray-900">Explore what matters to you</div>
        <div className="text-sm text-gray-700">Open a section to see the numbers behind the results.</div>
      </div>

      {/* Pillar Modules (collapsible) */}
      <section id="charts" className="max-w-md mx-auto p-4">
        {/* 🧪 Metabolic Health */}
        <details className="rounded-lg border border-gray-200 shadow-sm mb-3">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">🧪 Metabolic Health</summary>
          <div className="p-2">
            <p className="text-sm text-gray-700 mb-3">Directly improve metabolic health so that your body prefers fat as a fuel and your rate of loss stays on track.</p>
            {chartsEnabled.morningFatBurnTrend && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <div className="mt-4">
                <AliasMorningFatBurnMobilePill
                  data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: w.date || '', morning_fat_burn_percent: (w.fields?.morning_fat_burn_percent ?? null) })) as any}
                >
                  <MorningFatBurnChart
                    data={(snapshot.weeksRaw || []).map((w: any) => ({
                      week_number: w.week_number,
                      date: w.date || '',
                      morning_fat_burn_percent: (w.fields?.morning_fat_burn_percent ?? null)
                    })) as any}
                  />
                </AliasMorningFatBurnMobilePill>
              </div>
            )}

            {chartsEnabled.plateauWeight && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <div className="mt-4">
                <AliasPlateauMobilePill
                  data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, weight: (w.fields?.weight ?? null), date: '' }))}
                >
                  <ClientPlateauPreventionChart
                    data={(snapshot.weeksRaw || []).map((w: any) => ({
                      week_number: w.week_number,
                      date: '',
                      weight: (w.fields?.weight ?? null)
                    })) as any}
                    hideIndividualWeekFormula
                  />
                </AliasPlateauMobilePill>
              </div>
            )}

            {chartsEnabled.bodyFatTrend && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <div className="mt-4">
                <AliasBodyFatMobilePill
                  data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: w.date || '', body_fat_percentage: (w.fields?.body_fat_percentage ?? null) })) as any}
                >
                  <BodyFatPercentageChart
                    data={(snapshot.weeksRaw || []).map((w: any) => ({
                      week_number: w.week_number,
                      date: w.date || '',
                      body_fat_percentage: (w.fields?.body_fat_percentage ?? null)
                    })) as any}
                    hideDateInTooltip
                  />
                </AliasBodyFatMobilePill>
              </div>
            )}

            {chartsEnabled.systolicTrend && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <div className="mt-4">
                <AliasSystolicMobilePill data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', systolic_bp: (w.fields?.systolic_bp ?? null) })) as any}>
                  <SystolicBloodPressureChart data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', systolic_bp: (w.fields?.systolic_bp ?? null) })) as any} />
                </AliasSystolicMobilePill>
              </div>
            )}

            {chartsEnabled.diastolicTrend && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <div className="mt-4">
                <AliasDiastolicMobilePill data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', diastolic_bp: (w.fields?.diastolic_bp ?? null) })) as any}>
                  <DiastolicBloodPressureChart data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', diastolic_bp: (w.fields?.diastolic_bp ?? null) })) as any} />
                </AliasDiastolicMobilePill>
              </div>
            )}

            <div className="mt-3">
              <button onClick={(e) => { e.preventDefault(); scrollToCTA('metabolic_section') }} className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium transform transition duration-200 hover:scale-105 active:scale-95">{CTA_LABEL}</button>
            </div>
          </div>
        </details>

        {/* 🥗 Dietary Protocol */}
        <details className="rounded-lg border border-gray-200 shadow-sm mb-3">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">🥗 Dietary Protocol</summary>
          <div className="p-2">
            <p className="text-sm text-gray-700 mb-3">Dialed-in macros and consistency keep your actual results aligned with projections.</p>
            {chartsEnabled.nutritionCompliancePct && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <AliasNutritionMobilePill
                data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', nutrition_compliance_days: (w.fields?.nutrition_compliance_days ?? null) })) as any}
              >
                <NutritionComplianceChart
                  data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', nutrition_compliance_days: (w.fields?.nutrition_compliance_days ?? null) })) as any}
                />
              </AliasNutritionMobilePill>
            )}
            {chartsEnabled.projection && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <div className="mt-4">
                <AliasWeightProjectionMobilePill
                  data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', weight: (w.fields?.weight ?? null), initial_weight: (w.fields?.initial_weight ?? null) })) as any}
                  unitSystem={unitSystem}
                >
                  <WeightProjectionChart
                    data={(snapshot.weeksRaw || []).map((w: any) => ({
                      week_number: w.week_number,
                      date: '',
                      weight: (w.fields?.weight ?? null),
                      initial_weight: (w.fields?.initial_weight ?? null)
                    })) as any}
                    unitSystem={unitSystem}
                  />
                </AliasWeightProjectionMobilePill>
              </div>
            )}

            {chartsEnabled.weightTrend && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <div className="mt-4">
                <AliasWeightTrendMobilePill
                  data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', weight: (w.fields?.weight ?? null) })) as any}
                  unitSystem={unitSystem}
                >
                  <WeightTrendChart
                    data={(snapshot.weeksRaw || []).map((w: any) => ({
                      week_number: w.week_number,
                      date: '',
                      weight: (w.fields?.weight ?? null)
                    })) as any}
                    unitSystem={unitSystem}
                  />
                </AliasWeightTrendMobilePill>
              </div>
            )}

            

            <div className="mt-3">
              <button onClick={(e) => { e.preventDefault(); scrollToCTA('dietary_section') }} className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium transform transition duration-200 hover:scale-105 active:scale-95">{CTA_LABEL}</button>
            </div>
          </div>
        </details>

        {/* 🏋️ Fitness Optimized */}
        <details className="rounded-lg border border-gray-200 shadow-sm mb-3">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">🏋️ Fitness Optimized</summary>
          <div className="p-2">
            <p className="text-sm text-gray-700 mb-3">Build capacity and protect lean mass while measurements reflect healthier body composition.</p>
            {chartsEnabled.waistTrend && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <AliasWaistTrendMobilePill
                data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', waist: (w.fields?.waist ?? null) })) as any}
                unitSystem={unitSystem}
              >
                <WaistTrendChart
                  data={(snapshot.weeksRaw || []).map((w: any) => ({
                    week_number: w.week_number,
                    date: '',
                    waist: (w.fields?.waist ?? null)
                  })) as any}
                  unitSystem={unitSystem}
                  hideAlwaysMeasureNote
                  compactHeader
                  hideDateInTooltip
                />
              </AliasWaistTrendMobilePill>
            )}

            {chartsEnabled.plateauWaist && Array.isArray(snapshot.derived.waistTrend) && (snapshot.derived.waistTrend as any[]).length > 0 && (
              <div className="mt-4">
                <AliasWaistPlateauMobilePill
                  data={(snapshot.derived.waistTrend || []).map(([week, value]) => ({ date: '', week_number: week, waist: value })) as any}
                >
                  <WaistPlateauPreventionChart
                    data={(snapshot.derived.waistTrend || []).map(([week, value]) => ({ date: '', week_number: week, waist: value })) as any}
                    hideIndividualWeekFormula
                  />
                </AliasWaistPlateauMobilePill>
              </div>
            )}


            {chartsEnabled.strainTrend && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <div className="mt-4">
                <AliasStrainMobilePill data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', purposeful_exercise_days: (w.fields?.purposeful_exercise_days ?? null) })) as any}>
                  <StrainGoalMetChart data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', purposeful_exercise_days: (w.fields?.purposeful_exercise_days ?? null) })) as any} />
                </AliasStrainMobilePill>
              </div>
            )}

            

            <div className="mt-3">
              <button onClick={(e) => { e.preventDefault(); scrollToCTA('fitness_section') }} className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium transform transition duration-200 hover:scale-105 active:scale-95">{CTA_LABEL}</button>
            </div>
          </div>
        </details>

        {/* ⚡ Discipline */}
        <details className="rounded-lg border border-gray-200 shadow-sm">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">⚡ Discipline</summary>
          <div className="p-2">
            <p className="text-sm text-gray-700 mb-3">Consistency compounds—better sleep and nutrition adherence accelerate results.</p>
            {chartsEnabled.sleepTrend && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <AliasSleepMobilePill
                data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: w.date || '', sleep_consistency_score: (w.fields?.sleep_consistency_score ?? null) })) as any}
              >
                <SleepConsistencyChart
                  data={(snapshot.weeksRaw || []).map((w: any) => ({
                    week_number: w.week_number,
                    date: w.date || '',
                    sleep_consistency_score: (w.fields?.sleep_consistency_score ?? null)
                  })) as any}
                />
              </AliasSleepMobilePill>
            )}

            {chartsEnabled.disciplineNutritionCompliancePct && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <div className="mt-4">
                <AliasNutritionMobilePill
                  data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', nutrition_compliance_days: (w.fields?.nutrition_compliance_days ?? null) })) as any}
                >
                  <NutritionComplianceChart
                    data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', nutrition_compliance_days: (w.fields?.nutrition_compliance_days ?? null) })) as any}
                  />
                </AliasNutritionMobilePill>
              </div>
            )}

            {chartsEnabled.disciplineStrainTrend && Array.isArray(snapshot.weeksRaw) && (snapshot.weeksRaw as any[]).length > 0 && (
              <div className="mt-4">
                <AliasStrainMobilePill
                  data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', purposeful_exercise_days: (w.fields?.purposeful_exercise_days ?? null) })) as any}
                >
                  <StrainGoalMetChart
                    data={(snapshot.weeksRaw || []).map((w: any) => ({ week_number: w.week_number, date: '', purposeful_exercise_days: (w.fields?.purposeful_exercise_days ?? null) })) as any}
                  />
                </AliasStrainMobilePill>
              </div>
            )}

            

            <div className="mt-3">
              <button onClick={(e) => { e.preventDefault(); scrollToCTA('discipline_section') }} className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium transform transition duration-200 hover:scale-105 active:scale-95">{CTA_LABEL}</button>
            </div>
          </div>
        </details>
      </section>

      {/* Testimonial (moved directly below Discipline) */}
      <section id="testimonial" className="max-w-md mx-auto px-4 py-0">
        <details className="rounded-lg border border-gray-200 shadow-sm mb-3" onToggle={(e) => setTestimonialMediaOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">{`${displayLabel}'s Testimonial`}</summary>
          <div className="p-2">
            {((snapshot as any)?.meta?.testimonialQuote) ? (
              <div className="mb-3 relative rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50/40 to-white shadow-sm p-4 md:p-5">
                <div aria-hidden className="absolute -top-3 -left-1 text-6xl leading-none text-indigo-200 select-none">“</div>
                <div className="mx-auto max-w-prose">
                  <p className="text-gray-900 italic leading-relaxed">
                    {(snapshot as any).meta.testimonialQuote}
                  </p>
                  <div className="mt-3 text-xs tracking-wide text-gray-600">— {displayLabel}</div>
                </div>
              </div>
            ) : null}
            {(() => {
              const youtubeUrl = (snapshot as any)?.media?.testimonial?.youtubeUrl as string | undefined
              const legacyId = (snapshot as any)?.media?.testimonialYoutubeId as string | undefined
              const getYoutubeId = (u?: string): string | null => {
                if (!u) return null
                try {
                  const url = new URL(u)
                  if (url.hostname.includes('youtu.be')) return url.pathname.slice(1)
                  const id = url.searchParams.get('v')
                  if (id) return id
                  const m = url.pathname.match(/\/shorts\/([^/]+)/)
                  if (m) return m[1]
                } catch {}
                return null
              }
              const vid = getYoutubeId(youtubeUrl) || legacyId || null
              if (!vid) return null
              return (
                <div className="mb-3 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <div className="aspect-video">
                    <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${vid}`} title="Testimonial" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                  </div>
                </div>
              )
            })()}
            {(() => {
              const t = (snapshot as any)?.media?.testimonial
              if (!testimonialMediaOpen) return null
              if (!t) return null
              const groups: Array<{ key: 'front' | 'side' | 'rear'; heading: string }> = [
                { key: 'front', heading: 'Front Body' },
                { key: 'side', heading: 'Side Body' },
                { key: 'rear', heading: 'Rear Body' }
              ]
              // helpers for weight overlays
              const getWeightForWeek = (weekNum: number): number | null => {
                const w = (weeksRawAny as any[])?.find((x: any) => Number(x?.week_number) === weekNum)
                if (!w) return null
                const wt = w?.fields?.weight
                return typeof wt === 'number' ? wt : null
              }
              const getNearestWeightUpTo = (endWeek: number, startWeek: number): number | null => {
                for (let i = endWeek; i >= Math.max(1, startWeek); i--) {
                  const v = getWeightForWeek(i)
                  if (typeof v === 'number') return v
                }
                return null
              }
              const beforeWeightLbs = getWeightForWeek(0)
              const afterWeightLbs = weeksShown > 0 ? getNearestWeightUpTo(weeksShown, weeksStart) : null
              const formatWeightLocal = (lbs: number): string => {
                if (unitSystem === 'metric') {
                  const kg = poundsToKilograms(lbs)
                  const v = typeof kg === 'number' ? kg : lbs
                  return `${v.toFixed(1)} kg`
                }
                return `${lbs.toFixed(1)} lbs`
              }
              // Lazy render on open: rely on surrounding <details>; here we just build content
              return (
                <div className="space-y-3">
                  {groups.map(({ key, heading }) => {
                    const g = (t as any)?.[key] || {}
                    const bl = ((meta as any)?.beforeLabel || '').trim() || 'Before'
                    const al = ((meta as any)?.afterLabel || '').trim() || 'After'
                    const urls: { label: string; which: 'before' | 'after'; url?: string | null }[] = [
                      { label: bl, which: 'before', url: g?.beforeUrl },
                      { label: al, which: 'after', url: g?.afterUrl }
                    ]
                    const bothMissing = !g?.beforeUrl && !g?.afterUrl
                    return (
                      <div key={key}>
                        <div className="text-sm font-medium text-gray-900 mb-1">{heading}</div>
                        <div className="grid grid-cols-2 gap-3 items-stretch">
                          {urls.map(({ label, which, url }) => {
                            const isBefore = which === 'before'
                            const weight = isBefore ? beforeWeightLbs : afterWeightLbs
                            const refKey = `${key}-${which}` as const
                            const pairRef = `${key}-${isBefore ? 'after' : 'before'}` as const
                            const refProp = isBefore
                              ? (key === 'front' ? { ref: frontBeforeRef } : key === 'side' ? { ref: sideBeforeRef } : { ref: rearBeforeRef })
                              : (key === 'front' ? { ref: frontAfterRef } : key === 'side' ? { ref: sideAfterRef } : { ref: rearAfterRef })
                            return (
                              <div key={label} className="relative rounded-lg border border-gray-200 shadow-sm overflow-visible h-full" {...refProp}>
                                <div className="absolute z-10 -top-3 left-1/2 -translate-x-1/2">
                                  <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-xs text-gray-900">{label}</div>
                                </div>
                                {typeof weight === 'number' ? (
                                  <div className="absolute z-10 -bottom-3 left-1/2 -translate-x-1/2">
                                    <div className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-sm font-semibold leading-tight text-gray-900 whitespace-nowrap">{formatWeightLocal(weight)}</div>
                                  </div>
                                ) : null}
                                {url ? (
                                  (/\.mp4($|\?)/i.test(url) ? (
                                    <video src={url} muted playsInline className="w-full h-auto rounded-lg pointer-events-none" controls={false} loop autoPlay preload="metadata" />
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={url} alt={`${heading} ${label}`} className="w-full h-auto rounded-lg" loading="lazy" />
                                  ))
                                ) : (
                                  <div className="w-full flex items-center justify-center bg-gray-100" style={bothMissing ? { aspectRatio: '9 / 18' } : { height: '100%' }} aria-label="Coming soon" data-ph={`t-${key}-${which}`}>
                                    <div className="text-gray-900 text-sm font-medium">Coming Soon!</div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            <div className="mt-3">
              <button onClick={(e) => { e.preventDefault(); scrollToCTA('testimonial_section') }} className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium transform transition duration-200 hover:scale-105 active:scale-95">{CTA_LABEL}</button>
            </div>
          </div>
        </details>
      </section>

      {/* Inline CTA after Charts */}
      <section className="max-w-md mx-auto px-4">
        {(() => {
          const dw = (snapshot.meta as any)?.displayWeeks
          if (dw && typeof dw.start === 'number' && typeof dw.end === 'number' && typeof dw.effectiveEnd === 'number' && dw.effectiveEnd < dw.end) {
            return (
              <div className="text-xs text-gray-600 mb-2">
                Showing weeks {dw.start}–{dw.effectiveEnd} (requested {dw.start}–{dw.end})
              </div>
            )
          }
          return null
        })()}
      </section>

      {/* Removed: legacy optional charts section (now inside pillar modules) */}

      {/* Removed: Fit3D section (public/preview) */}

      {/* Inline CTA after Photos (Hero) removed to keep focus */}

      

      {/* Metabolic/Cardio Testing */}
      <section id="testing" className="max-w-md mx-auto px-4 py-0">
        {(() => {
          const testing = (snapshot as any)?.media?.testing || {}
          const baselineImg = testing?.baselineImageUrl as string | undefined
          const followupImg = testing?.followupImageUrl as string | undefined
          const baselineLink = testing?.baselineReportUrl as string | undefined
          const followupLink = testing?.followupReportUrl as string | undefined

          // If nothing to show, hide section
          if (!baselineImg && !followupImg && !baselineLink && !followupLink) return null

          const isMp4 = (u?: string) => {
            if (!u) return false
            try { return /\.mp4($|\?)/i.test(new URL(u).pathname) } catch { return false }
          }

          const ImageBox = ({ label, url, link }: { label: 'Baseline' | 'Follow-up'; url?: string; link?: string }) => {
            if (!url && !link) return null
            return (
              <div className="mb-3">
                {url ? (
                  <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    {isMp4(url) ? (
                      <video src={url} muted playsInline controls={false} className="w-full h-auto pointer-events-none" loop autoPlay preload="auto" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={label} className="w-full h-auto" />
                    )}
                  </div>
                ) : null}
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center mt-2 px-4 py-3 rounded-md bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition-colors"
                  >
                    {label === 'Baseline' ? 'View Baseline Metabolic Testing Report' : 'View Follow-Up Metabolic Testing Report'}
                  </a>
                ) : null}
              </div>
            )
          }

          return (
            <div className="rounded-lg border border-gray-200 p-3 shadow-sm min-w-0 mb-3">
              <div className="mb-2 flex items-center justify-between rounded-md bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 px-3 py-2 shadow-sm">
                <div className="text-sm md:text-base font-semibold text-gray-900">{firstNameForTitle}'s Metabolic/Cardio Testing</div>
              </div>
              <div>
                <ImageBox label="Baseline" url={baselineImg} link={baselineLink} />
                <ImageBox label="Follow-up" url={followupImg} link={followupLink} />
              </div>
            </div>
          )
        })()}
      </section>

      {/* Extra CTAs removed to keep two key placements */}

      {/* Removed: testimonial here (moved above) */}

      {/* Extra CTAs removed */}

      {/* Booking Section */}
      <section id="cta" className="lead-capture max-w-md mx-auto px-4 pt-0 pb-4">
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="mb-3 rounded-md bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 px-3 py-2 shadow-sm">
            <div className="text-sm md:text-base font-semibold text-gray-900">Schedule a consult</div>
          </div>
          {(() => {
            const base = 'https://www.cnvrsnly.com/widget/booking/1RQQzveFefB7hCunO2cI'
            const params = aliasForTracking
              ? `utm_source=${encodeURIComponent(aliasForTracking)}`
              : ''
            const src = params ? `${base}${base.includes('?') ? '&' : '?'}${params}` : base
            return (
              <iframe src={src} style={{ width: '100%', border: 'none', overflow: 'hidden', height: 700 }} scrolling="no" id="vswnIbVqg5No2YU4nxqn_1759108244711" data-alias={aliasForTracking || ''} />
            )
          })()}
          {/* Guard: ensure params persist if widget rewrites iframe src */}
          <Script
            id="cnvrsnly-param-guard"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
(function(){
  var alias = ${JSON.stringify(aliasForTracking || '')};
  // Prefer alias from inline state via data attr if present
  try {
    var holder = document.getElementById('vswnIbVqg5No2YU4nxqn_1759108244711');
    if (holder && holder.getAttribute) {
      var a = holder.getAttribute('data-alias');
      if (!alias && a) alias = a;
    }
  } catch(e) {}

  function withParams(u){
    try{
      var url = new URL(u, document.baseURI);
      var changed = false;
      if(alias){
        if(!url.searchParams.has('utm_source')){ url.searchParams.set('utm_source', alias); changed = true; }
      }
      return changed ? url.toString() : u;
    }catch(e){ return u; }
  }

  var desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
  if(desc && desc.set){
    var origSet = desc.set;
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      set: function(v){
        if (typeof v === 'string' && v.indexOf('cnvrsnly.com/widget/booking/') !== -1) {
          v = withParams(v);
        }
        return origSet.call(this, v);
      },
      get: desc.get,
      configurable: true
    });
  }

  var ensure = function(){
    try{
      var ifr = document.querySelector('iframe[src*="cnvrsnly.com/widget/booking/"]');
      if (ifr && ifr.src) {
        var fixed = withParams(ifr.src);
        if (fixed !== ifr.src) ifr.src = fixed;
      }
    }catch(e){}
  };
  new MutationObserver(ensure).observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['src']});
  window.addEventListener('load', ensure);
  setTimeout(ensure, 0); setTimeout(ensure, 500); setTimeout(ensure, 2000);
})();
`
            }}
          />
          {/* Ensure UTMs exist on parent URL and respond to fetch-query-params with our UTMs */}
          <Script
            id="booking-parent-utms-and-responder"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
  (function(){
    try {
      var alias = ${JSON.stringify(aliasForTracking || '')};
      function ensureParentUTMs(){
        try {
          if (!alias) return;
          var url = new URL(window.location.href);
          var changed = false;
          if (!url.searchParams.has('utm_source')) { url.searchParams.set('utm_source', alias); changed = true; }
          if (changed && window.history && window.history.replaceState) {
            window.history.replaceState(null, '', url.toString());
            try { console.log('[BookingDiag] parent URL updated with UTMs:', url.toString()); } catch(e) {}
          }
        } catch(e) {}
      }
      function buildParamsFromParent(){
        var obj = {};
        if (alias) obj['utm_source'] = alias;
        return obj;
      }
      function postParamsToIframe(){
        try {
          var ifr = document.getElementById('vswnIbVqg5No2YU4nxqn_1759108244711');
          if (!ifr || !ifr.contentWindow) return;
          var params = buildParamsFromParent();
          if (!params || !params.utm_source) return;
          var parentUrl = window.location.href;
          var ref = document.referrer || '';
          var msg = ['query-params', params, parentUrl, ref, ifr.id];
          ifr.contentWindow.postMessage(msg, '*');
          try { console.log('[BookingDiag] explicit parent->iframe query-params sent:', params); } catch(e) {}
        } catch(e) {}
      }
      ensureParentUTMs();
      // Respond to iframe asking for params
      window.addEventListener('message', function(e){
        try {
          if (Array.isArray(e.data) && e.data[0] === 'fetch-query-params') {
            ensureParentUTMs();
            postParamsToIframe();
          }
        } catch(err) {}
      });
      // Also send once shortly after load to cover timing races
      setTimeout(postParamsToIframe, 300);
      setTimeout(postParamsToIframe, 1200);
    } catch(e) {}
  })();
  `
            }}
          />
          <Script src="https://www.cnvrsnly.com/js/form_embed.js" strategy="afterInteractive" />
        </div>
      </section>

      {/* Spacer to avoid sticky CTA overlap (mobile only, only when visible) */}
      {showStickyCTA ? (
        <div className="md:hidden" style={{ height: 'calc(56px + env(safe-area-inset-bottom)/2)' }} />
      ) : null}

      {/* No global fixed CTA while editing — using per-section CTAs above */}
    </main>
    <div className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transform transition-transform duration-300 ease-in-out ${showStickyCTA ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="bg-blue-600" style={{ paddingTop: 'calc(8px + env(safe-area-inset-bottom)/2)', paddingBottom: 'calc(8px + env(safe-area-inset-bottom)/2)' }}>
        <div className="max-w-md mx-auto px-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-white text-sm font-semibold text-center">Ready to Become the Fittest You?</div>
            <button onClick={(e) => { e.preventDefault(); scrollToCTA('sticky') }} className="bg-white text-blue-600 font-bold text-sm rounded-full px-3 py-2 transform transition duration-200 hover:scale-105 active:scale-95">
              {CTA_LABEL}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}


