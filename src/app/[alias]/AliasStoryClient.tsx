'use client'

import { useEffect, useState } from 'react'
import type { SnapshotJson } from '@/app/components/health/marketing/snapshotTypes'
import dynamic from 'next/dynamic'
const MarketingWeightTrendEChart = dynamic(() => import('@/app/components/health/marketing/echarts/MarketingWeightTrendEChart'), { ssr: false })
const MarketingWeightProjectionEChart = dynamic(() => import('@/app/components/health/marketing/echarts/MarketingWeightProjectionEChart'), { ssr: false })
const MarketingPlateauPreventionEChart = dynamic(() => import('@/app/components/health/marketing/echarts/MarketingPlateauPreventionEChart'), { ssr: false })

type UnitSystem = 'imperial' | 'metric'

export default function AliasStoryClient({ snapshot }: { snapshot: SnapshotJson }) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial')
  const [inlineCtaVisible, setInlineCtaVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const anyVisible = entries.some((e) => e.isIntersecting)
      setInlineCtaVisible(anyVisible)
    }, { root: null, rootMargin: '0px 0px -20% 0px', threshold: 0.01 })

    const nodes = document.querySelectorAll('.inline-cta-sentinel')
    nodes.forEach((n) => observer.observe(n))
    return () => {
      nodes.forEach((n) => observer.unobserve(n))
      observer.disconnect()
    }
  }, [])

  const m = snapshot.metrics
  const meta = snapshot.meta

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="max-w-md mx-auto p-4 text-center">
        <div className="text-sm text-gray-500">{meta.watermarkText || 'The Fittest You'}</div>
        <h1 className="text-xl font-bold mt-1">Become the Fittest Version of Yourself.</h1>
        <div className="mt-1 text-gray-700">{meta.patientLabel}</div>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <button
            className={`px-3 py-1 rounded border ${unitSystem === 'imperial' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
            onClick={() => setUnitSystem('imperial')}
          >
            Imperial
          </button>
          <button
            className={`px-3 py-1 rounded border ${unitSystem === 'metric' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300'}`}
            onClick={() => setUnitSystem('metric')}
          >
            Metric
          </button>
        </div>
      </header>

      {/* Compliance cards */}
      <section className="max-w-md mx-auto p-4 grid grid-cols-2 gap-3">
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Total Loss %</div>
          <div className="text-lg font-semibold">{m.totalLossPct ?? '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Weekly Loss %</div>
          <div className="text-lg font-semibold">{m.weeklyLossPct ?? '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Avg Nutrition %</div>
          <div className="text-lg font-semibold">{m.avgNutritionCompliancePct ?? '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-gray-500">Avg Exercise Days</div>
          <div className="text-lg font-semibold">{m.avgPurposefulExerciseDays ?? '—'}</div>
        </div>
      </section>

      {/* Inline CTA after summary cards */}
      <section className="max-w-md mx-auto px-4">
        <div id="cta" className="inline-cta-sentinel mt-2">
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium">Book a consult</a>
        </div>
      </section>

      {/* Charts */}
      <section id="charts" className="max-w-md mx-auto p-4">
        <div className="rounded border p-2">
          <div className="w-full" style={{ height: 300 }}>
            <MarketingWeightTrendEChart
              data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
              hideTitles={false}
              unitSystem={unitSystem}
            />
          </div>
        </div>
      </section>

      {/* Weight Projection Chart (optional collapsed) */}
      <section className="max-w-md mx-auto p-4">
        <details className="rounded border">
          <summary className="p-2 cursor-pointer select-none">Weight Projection</summary>
          <div className="p-2">
            <div className="w-full" style={{ height: 300 }}>
              <MarketingWeightProjectionEChart
                data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
                hideTitles={false}
              unitSystem={unitSystem}
              />
            </div>
          </div>
        </details>
      </section>

      {/* Plateau Prevention — Weight (optional collapsed) */}
      <section className="max-w-md mx-auto p-4">
        <details className="rounded border">
          <summary className="p-2 cursor-pointer select-none">Plateau Prevention — Weight</summary>
          <div className="p-2">
            <div className="w-full" style={{ height: 300 }}>
              <MarketingPlateauPreventionEChart
                data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
                hideTitles={false}
              />
            </div>
          </div>
        </details>
      </section>

      {/* Photos placeholder */}
      <section id="photos" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Photos section coming soon</div>
      </section>

      {/* Fit3D placeholder */}
      <section id="fit3d" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Fit3D section coming soon</div>
      </section>

      {/* Testing placeholder */}
      <section id="testing" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Testing (DocSend) section coming soon</div>
      </section>

      {/* Testimonial placeholder */}
      <section id="testimonial" className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-gray-600">Testimonial section coming soon</div>
      </section>

      {/* Sticky CTA */}
      <div className={`fixed bottom-0 left-0 right-0 bg-white/90 border-t p-3 transition-opacity ${inlineCtaVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="max-w-md mx-auto">
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium">Book a consult</a>
        </div>
      </div>
    </main>
  )
}


