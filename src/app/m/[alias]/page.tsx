// Server-side page: latest snapshot by alias (no redirect)
import { createClient } from '@supabase/supabase-js'
import { normalizeSnapshot } from '@/app/components/health/marketing/snapshotTypes'
import Link from 'next/link'
import MarketingWeightTrendEChart from '@/app/components/health/marketing/echarts/MarketingWeightTrendEChart'

export const dynamic = 'force-dynamic'

async function fetchSnapshotByAlias(alias: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: aliasRow } = await supabase
    .from('marketing_aliases')
    .select('current_slug')
    .eq('alias', alias)
    .single()

  if (!aliasRow?.current_slug) return null

  const { data: shareRow } = await supabase
    .from('marketing_shares')
    .select('snapshot_json, revoked_at')
    .eq('slug', aliasRow.current_slug)
    .single()

  if (!shareRow || shareRow.revoked_at) return null
  return normalizeSnapshot(shareRow.snapshot_json)
}

export default async function Page({ params }: { params: Promise<{ alias: string }> }) {
  const { alias } = await params
  const snapshot = await fetchSnapshotByAlias(alias)

  if (!snapshot) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold mb-2">This page is not available</h1>
          <p className="text-gray-600 mb-6">Please check back later or return to the home page.</p>
          <Link href="/" className="inline-block px-4 py-2 rounded bg-blue-600 text-white">Go Home</Link>
        </div>
      </main>
    )
  }

  const m = snapshot.metrics
  const meta = snapshot.meta

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="max-w-md mx-auto p-4 text-center">
        <div className="text-sm text-gray-500">{meta.watermarkText || 'The Fittest You'}</div>
        <h1 className="text-xl font-bold mt-1">Become the Fittest Version of Yourself.</h1>
        <div className="mt-1 text-gray-700">{meta.patientLabel}</div>
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

      {/* Weight Trend Chart */}
      <section className="max-w-md mx-auto p-4">
        <div className="rounded border p-2">
          <div className="w-full" style={{ height: 300 }}>
            <MarketingWeightTrendEChart
              data={(snapshot.derived.weightTrend || []).map(([week, value]) => ({ date: '', week_number: week, weight: value })) as any}
              hideTitles={false}
            />
          </div>
        </div>
      </section>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 border-t p-3">
        <div className="max-w-md mx-auto">
          <a href="#cta" className="block w-full text-center px-4 py-3 rounded bg-blue-600 text-white font-medium">Book a consult</a>
        </div>
      </div>
    </main>
  )
}


