'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import type { SnapshotJson } from '@/app/components/health/marketing/snapshotTypes'
import { CTA_LABEL, TAGLINE } from '@/app/components/health/marketing/marketingConfig'
import { poundsToKilograms } from '@/app/components/health/unitUtils'
import dynamic from 'next/dynamic'
const MarketingWeightTrendEChart = dynamic(() => import('@/app/components/health/marketing/echarts/MarketingWeightTrendEChart'), { ssr: false })
const MarketingWeightProjectionEChart = dynamic(() => import('@/app/components/health/marketing/echarts/MarketingWeightProjectionEChart'), { ssr: false })
const ClientPlateauPreventionChart = dynamic(() => import('@/app/components/health/charts/PlateauPreventionChart'), { ssr: false })
const MarketingWaistTrendChart = dynamic(() => import('@/app/components/health/marketing/charts/MarketingWaistTrendChart'), { ssr: false })
const MarketingSleepConsistencyChart = dynamic(() => import('@/app/components/health/marketing/charts/MarketingSleepConsistencyChart'), { ssr: false })
const MarketingMorningFatBurnChart = dynamic(() => import('@/app/components/health/marketing/charts/MarketingMorningFatBurnChart'), { ssr: false })
const MarketingBodyFatPercentageChart = dynamic(() => import('@/app/components/health/marketing/charts/MarketingBodyFatPercentageChart'), { ssr: false })
const PdfJsInlineIOS = dynamic(() => import('@/app/components/health/marketing/PdfJsInlineIOS'), { ssr: false })

type UnitSystem = 'imperial' | 'metric'

export default function AliasStoryClient({ snapshot, shareSlug, pageType = 'alias' }: { snapshot: SnapshotJson; shareSlug?: string; pageType?: 'alias' | 'version' }) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')
  const [showStickyCTA, setShowStickyCTA] = useState(false)

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

  const scrollToCTA = () => {
    try { reportClick('sticky') } catch {}
    const el = document.getElementById('cta')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
    ? `${totalLossPctNum.toFixed(1)}%${weeksShown > 0 ? `\u00A0•\u00A0${weeksShown} weeks` : ''}`
    : '—'

  return (
    <>
    <main className="min-h-screen bg-white pb-24">
      {/* Brand Bar */}
      <div className="w-full bg-blue-600 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto px-4 py-3 text-center">
          <div className="font-semibold tracking-wide">Data driven health guided by an actual MD.</div>
        </div>
      </div>
      {/* Header */}
      <header className="max-w-md mx-auto p-4 text-center">
        <div className="text-xs text-gray-700">Board‑certified • 1:1 coaching • Science‑backed</div>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{displayLabel}</h1>
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

        if (!left && !right) return null

        const render = (u: string) => (
          <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {isMp4(u) ? (
              <video src={u} muted loop playsInline autoPlay preload="auto" controls={false} className="w-full h-auto pointer-events-none" />
            ) : (
              <img src={u} alt="Hero" loading="eager" fetchPriority="high" className="w-full h-auto" />
            )}
          </div>
        )

        // Decide where labels should render (only on actual before/after images)
        const showBeforeLabelOnLeft = !!beforeUrl && !!left && left === beforeUrl
        const showAfterLabelOnRight = !!afterUrl && !!right && right === afterUrl

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
            <div className="grid grid-cols-2 gap-3 items-start">
              <div className="relative">
                {showBeforeLabelOnLeft ? (
                  <div className="absolute z-10 -top-3 left-1/2 -translate-x-1/2">
                    <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-xs text-gray-900">Before</div>
                  </div>
                ) : null}
                {showBeforeLabelOnLeft && typeof leftWeightLbs === 'number' ? (
                  <div className="absolute z-10 -bottom-3 left-1/2 -translate-x-1/2">
                    <div className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-sm font-semibold leading-tight text-gray-900 whitespace-nowrap">{formatWeight(leftWeightLbs)}</div>
                  </div>
                ) : null}
                {left ? render(left) : null}
              </div>
              <div className="relative">
                {showAfterLabelOnRight ? (
                  <div className="absolute z-10 -top-3 left-1/2 -translate-x-1/2">
                    <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-xs text-gray-900">After</div>
                  </div>
                ) : null}
                {showAfterLabelOnRight && typeof rightWeightLbs === 'number' ? (
                  <div className="absolute z-10 -bottom-3 left-1/2 -translate-x-1/2">
                    <div className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-sm font-semibold leading-tight text-gray-900 whitespace-nowrap">{formatWeight(rightWeightLbs)}</div>
                  </div>
                ) : null}
                {right ? render(right) : null}
              </div>
            </div>
          </section>
        )
      })()}

      {/* Compliance cards */}
      <section className="max-w-md mx-auto p-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700">Total Loss %</div>
          <div className="text-xl font-bold text-gray-900 whitespace-nowrap overflow-visible">
            {totalLossDisplay}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700">Weekly Loss %</div>
          <div className="text-xl font-bold text-gray-900">{typeof m.weeklyLossPct === 'number' ? m.weeklyLossPct.toFixed(2) : '—'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700">Avg Nutrition %</div>
          <div className="text-xl font-bold text-gray-900">{typeof m.avgNutritionCompliancePct === 'number' ? m.avgNutritionCompliancePct.toFixed(2) : '—'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-xs text-gray-700">Avg Exercise Days</div>
          <div className="text-xl font-bold text-gray-900">{typeof m.avgPurposefulExerciseDays === 'number' ? m.avgPurposefulExerciseDays.toFixed(2) : '—'}</div>
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
            <p className="text-sm text-gray-700 mb-3">Build metabolic flexibility so your body prefers fat as a fuel and your rate of loss stays on track.</p>
            {chartsEnabled.plateauWeight && Array.isArray(snapshot.derived.weightTrend) && (snapshot.derived.weightTrend as any[]).length > 0 && (
            <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
              <div className="w-full">
                <ClientPlateauPreventionChart
                  data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
                />
              </div>
            </div>
            )}

            {chartsEnabled.morningFatBurnTrend && Array.isArray(snapshot.derived.morningFatBurnTrend) && (snapshot.derived.morningFatBurnTrend as any[]).length > 0 && (
            <div className="rounded-lg border border-gray-200 mt-4 shadow-sm">
              <div className="p-2">
                <div className="mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">🔥 Morning Fat Oxidation %</h3>
                  <p className="text-sm text-gray-700">Higher percentages over time means that your body is responding to my weekly changes to your macronutrient recommendations and to your habit changes, and that metabolic adaptation is progressing accordingly.</p>
                </div>
                <MarketingMorningFatBurnChart
                  data={(snapshot.derived.morningFatBurnTrend || []).map(([week, value]) => ({ date: '', week_number: week, morning_fat_burn_percent: value })) as any}
                  isAnimating={false}
                  animationDuration={0}
                  onAnimationComplete={() => {}}
                  hideTitles={true}
                />
                <div className="mt-3 text-xs text-gray-500">
                  <p>• Measured weekly through metabolic analysis</p>
                  <p>• Higher percentages over time indicate your body is responding to Dr. Nick's program changes</p>
                  <p>• Shows how well your body burns fat in a fasted state</p>
                </div>
              </div>
            </div>
            )}

            {chartsEnabled.bodyFatTrend && Array.isArray(snapshot.derived.bodyFatTrend) && (snapshot.derived.bodyFatTrend as any[]).length > 0 && (
            <div className="rounded-lg border border-gray-200 mt-4 shadow-sm">
              <div className="p-2">
                <div className="mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">📊 Body Fat Percentage</h3>
                  <p className="text-sm text-gray-700">Your body fat percentage tracks changes in body composition beyond just weight. This precise measurement shows how much of your weight loss comes from fat versus muscle, helping optimize your program for the best results.</p>
                </div>
                <MarketingBodyFatPercentageChart
                  data={(snapshot.derived.bodyFatTrend || []).map(([week, value]) => ({ date: '', week_number: week, body_fat_percentage: value })) as any}
                  isAnimating={false}
                  animationDuration={0}
                  onAnimationComplete={() => {}}
                  hideTitles={true}
                />
                <div className="mt-3 text-xs text-gray-700">
                  <p>• Measured using the most precise testing methodology Dr. Nick has determined available in your situation</p>
                  <p>• Scheduled periodically based on your progress milestones</p>
                  <p>• More accurate than weight alone for tracking fat loss</p>
                </div>
              </div>
            </div>
            )}

            <div className="mt-3">
              <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium">{CTA_LABEL}</a>
            </div>
          </div>
        </details>

        {/* 🥗 Dietary Protocol */}
        <details className="rounded-lg border border-gray-200 shadow-sm mb-3">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">🥗 Dietary Protocol</summary>
          <div className="p-2">
            <p className="text-sm text-gray-700 mb-3">Dialed-in macros and consistency keep your actual results aligned with projections.</p>
            {chartsEnabled.projection && Array.isArray(snapshot.derived.weightTrend) && (snapshot.derived.weightTrend as any[]).length > 0 && (
            <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
              <div className="mb-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">📊 Weight Loss Trend vs. Projections</h3>
                <p className="text-sm text-gray-700">Compare actual progress against four projection rates.</p>
              </div>
              <div className="w-full" style={{ height: 300 }}>
                <MarketingWeightProjectionEChart
                  data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
                  hideTitles={true}
                  unitSystem={unitSystem}
                />
              </div>
              <div className="mt-2 text-xs text-gray-700 flex flex-wrap gap-4">
                <div className="flex items-center gap-2"><span className="inline-block w-4 h-1 bg-red-500" />Actual Weight ({unitSystem === 'metric' ? 'kg' : 'lbs'})</div>
                <div className="flex items-center gap-2"><span className="inline-block w-4 h-1 bg-emerald-500" />0.5% loss/wk</div>
                <div className="flex items-center gap-2"><span className="inline-block w-4 h-1 bg-blue-600" />1.0% loss/wk</div>
                <div className="flex items-center gap-2"><span className="inline-block w-4 h-1 bg-violet-600" />1.5% loss/wk</div>
                <div className="flex items-center gap-2"><span className="inline-block w-4 h-1 bg-amber-500" />2.0% loss/wk</div>
              </div>
            </div>
            )}

            {chartsEnabled.weightTrend && Array.isArray(snapshot.derived.weightTrend) && (snapshot.derived.weightTrend as any[]).length > 0 && (
            <div className="rounded-lg border border-gray-200 p-3 mt-4 shadow-sm">
              <div className="mb-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">⚖️ Weight Trend Analysis</h3>
                <p className="text-sm text-gray-700">Track weekly weight with a clear trend line indicating overall direction.</p>
              </div>
              <div className="w-full" style={{ height: 300 }}>
                <MarketingWeightTrendEChart
                  data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
                  hideTitles={false}
                  unitSystem={unitSystem}
                />
              </div>
              <div className="mt-3 text-xs text-gray-600">
                <p>• Weekly fluctuations are normal; follow the trend.</p>
              </div>
            </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
                <div className="text-xs text-gray-700">Avg Nutrition %</div>
                <div className="text-xl font-bold text-gray-900">{typeof m.avgNutritionCompliancePct === 'number' ? m.avgNutritionCompliancePct.toFixed(2) : '—'}</div>
              </div>
            </div>

            <div className="mt-3">
              <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium">{CTA_LABEL}</a>
            </div>
          </div>
        </details>

        {/* 🏋️ Fitness Optimized */}
        <details className="rounded-lg border border-gray-200 shadow-sm mb-3">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">🏋️ Fitness Optimized</summary>
          <div className="p-2">
            <p className="text-sm text-gray-700 mb-3">Build capacity and protect lean mass while measurements reflect healthier body composition.</p>
            {chartsEnabled.waistTrend && Array.isArray(snapshot.derived.waistTrend) && (snapshot.derived.waistTrend as any[]).length > 0 && (
            <div className="rounded-lg border border-gray-200 shadow-sm">
              <div className="p-2">
                <div className="mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">📏 Waist Trend Analysis</h3>
                  <p className="text-sm text-gray-700">Tracks waist circumference changes over time. Often more reliable than weight for measuring body composition changes and fat loss progress.</p>
                </div>
                <MarketingWaistTrendChart
                  data={(snapshot.derived.waistTrend || []).map(([week, value]) => ({ date: '', week_number: week, waist: value })) as any}
                  isAnimating={false}
                  animationDuration={0}
                  onAnimationComplete={() => {}}
                  hideTitles={true}
                />
                <div className="mt-3 text-xs text-gray-700">
                  <p>• Often more accurate than weight for fat loss tracking</p>
                  <p>• Dark black trend line shows overall waist measurement change direction</p>
                  <p>• Always measure at the horizontal level of your belly button with your stomoch 100% relaxed.</p>
                </div>
              </div>
            </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
                <div className="text-xs text-gray-700">Avg Exercise Days</div>
                <div className="text-xl font-bold text-gray-900">{typeof m.avgPurposefulExerciseDays === 'number' ? m.avgPurposefulExerciseDays.toFixed(2) : '—'}</div>
              </div>
            </div>

            <div className="mt-3">
              <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium">{CTA_LABEL}</a>
            </div>
          </div>
        </details>

        {/* ⚡ Discipline */}
        <details className="rounded-lg border border-gray-200 shadow-sm">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">⚡ Discipline</summary>
          <div className="p-2">
            <p className="text-sm text-gray-700 mb-3">Consistency compounds—better sleep and nutrition adherence accelerate results.</p>
            {chartsEnabled.sleepTrend && Array.isArray(snapshot.derived.sleepTrend) && (snapshot.derived.sleepTrend as any[]).length > 0 && (
            <div className="rounded-lg border border-gray-200 shadow-sm">
              <div className="p-2">
                <div className="mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">😴 Sleep Consistency & Recovery</h3>
                  <p className="text-sm text-gray-700">Weekly sleep quality scores from biometric analysis (added by Dr. Nick)</p>
                </div>
                <MarketingSleepConsistencyChart
                  data={(snapshot.derived.sleepTrend || []).map(([week, value]) => ({ date: '', week_number: week, sleep_consistency_score: value })) as any}
                  isAnimating={false}
                  animationDuration={0}
                  onAnimationComplete={() => {}}
                  hideTitles={true}
                />
                <div className="mt-3 text-xs text-gray-700">
                  <p>• Data sourced from biometric analysis by Dr. Nick</p>
                  <p>• Dark black trend line shows overall sleep consistency direction</p>
                  <p>• Higher scores indicate better sleep consistency and recovery</p>
                  <p>• Sleep consistency directly impacts weight loss and overall progress</p>
                </div>
              </div>
            </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
                <div className="text-xs text-gray-700">Avg Nutrition %</div>
                <div className="text-xl font-bold text-gray-900">{typeof m.avgNutritionCompliancePct === 'number' ? m.avgNutritionCompliancePct.toFixed(2) : '—'}</div>
              </div>
            </div>

            <div className="mt-3">
              <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium">{CTA_LABEL}</a>
            </div>
          </div>
        </details>
      </section>

      {/* Testimonial (moved directly below Discipline) */}
      <section id="testimonial" className="max-w-md mx-auto px-4 pb-4 pt-0">
        <details className="rounded-lg border border-gray-200 shadow-sm">
          <summary className="p-3 cursor-pointer select-none text-gray-900 font-semibold">{`${displayLabel}'s testimonial`}</summary>
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
              if (!t) return null
              const items: { label: string; url: string }[] = []
              if (typeof t.beforeUrl === 'string' && t.beforeUrl) items.push({ label: 'Before', url: t.beforeUrl })
              if (typeof t.afterUrl === 'string' && t.afterUrl) items.push({ label: 'After', url: t.afterUrl })
              if (items.length === 0) return null
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
              const listClass = items.length === 1 ? 'flex justify-center' : 'grid grid-cols-2 gap-3'
              return (
                <div className={listClass}>
                  {items.map(({ label, url }) => {
                    const isBefore = label === 'Before'
                    const weight = isBefore ? beforeWeightLbs : afterWeightLbs
                    return (
                      <div key={label} className="relative rounded-lg border border-gray-200 shadow-sm overflow-visible">
                        <div className="absolute z-10 -top-3 left-1/2 -translate-x-1/2">
                          <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-xs text-gray-900">{label}</div>
                        </div>
                        {typeof weight === 'number' ? (
                          <div className="absolute z-10 -bottom-3 left-1/2 -translate-x-1/2">
                            <div className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-sm font-semibold leading-tight text-gray-900 whitespace-nowrap">{formatWeightLocal(weight)}</div>
                          </div>
                        ) : null}
                        {/\.mp4($|\?)/i.test(url) ? (
                          <video src={url} muted loop playsInline autoPlay className="w-full h-auto rounded-lg" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={label} className="w-full h-auto rounded-lg" />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
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

      

      {/* Metabolic/Cardio Testing (PDF) */}
      <section id="testing" className="max-w-md mx-auto p-4">
        {((snapshot as any)?.media?.testing?.pdfUrl) ? (
          <div className="rounded-lg border border-gray-200 p-3 shadow-sm min-w-0">
            {(() => {
              const pdfUrl = (snapshot as any).media.testing.pdfUrl as string
              const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
              const isIOS = /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
              return (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm text-gray-900">{firstNameForTitle}'s Metabolic/Cardio Testing</div>
                    <a href={pdfUrl} target="_blank" rel="noopener" className="text-sm text-blue-600 underline">Open PDF in a new tab</a>
                  </div>
                  <div className="overflow-x-hidden">
                    {isIOS ? (
                      <PdfJsInlineIOS url={pdfUrl} className="block w-full max-w-full h-[65vh] md:h-[700px] overflow-auto" />
                    ) : (
                      <object
                        key={pdfUrl}
                        data={pdfUrl}
                        type="application/pdf"
                        className="block w-full max-w-full h-[65vh] md:h-[700px]"
                      >
                        <iframe
                          key={pdfUrl}
                          src={pdfUrl}
                          className="block w-full max-w-full h-[65vh] md:h-[700px]"
                          title="Metabolic/Cardio Testing"
                          scrolling="yes"
                          style={{ WebkitOverflowScrolling: 'touch' as any }}
                        />
                      </object>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        ) : null}
      </section>

      {/* Extra CTAs removed to keep two key placements */}

      {/* Removed: testimonial here (moved above) */}

      {/* Extra CTAs removed */}

      {/* Booking Section */}
      <section id="cta" className="lead-capture max-w-md mx-auto p-4">
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="text-sm text-gray-900 mb-2">Schedule a consult</div>
          <iframe src="https://www.cnvrsnly.com/widget/booking/1RQQzveFefB7hCunO2cI" style={{ width: '100%', border: 'none', overflow: 'hidden', height: 700 }} scrolling="no" id="vswnIbVqg5No2YU4nxqn_1759108244711" />
          <Script src="https://www.cnvrsnly.com/js/form_embed.js" strategy="afterInteractive" />
        </div>
      </section>

      {/* No global fixed CTA while editing — using per-section CTAs above */}
    </main>
    <div className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transform transition-transform duration-300 ease-in-out ${showStickyCTA ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="bg-blue-600" style={{ paddingTop: 'calc(8px + env(safe-area-inset-bottom)/2)', paddingBottom: 'calc(8px + env(safe-area-inset-bottom)/2)' }}>
        <div className="max-w-md mx-auto px-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-white text-sm font-semibold text-center">Ready to Become the Fittest You?</div>
            <button onClick={scrollToCTA} className="bg-white text-blue-600 font-bold text-sm rounded-full px-3 py-2 transform transition duration-200 hover:scale-105 active:scale-95">
              {CTA_LABEL}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}


