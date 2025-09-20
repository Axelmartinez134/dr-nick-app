// Server-side page: render a specific immutable snapshot by slug
import { createClient } from '@supabase/supabase-js'
import { normalizeSnapshot } from '@/app/components/health/marketing/snapshotTypes'

export const dynamic = 'force-dynamic'

async function fetchSnapshotBySlug(slug: string) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !ANON_KEY) return null
  const supabase = createClient(SUPABASE_URL, ANON_KEY)

  const { data: row } = await supabase
    .from('marketing_shares')
    .select('snapshot_json, revoked_at')
    .eq('slug', slug)
    .single()

  if (!row || row.revoked_at) return null
  return normalizeSnapshot(row.snapshot_json)
}

export default async function Page({ params }: { params: { slug: string } }) {
  const snapshot = await fetchSnapshotBySlug(params.slug)

  if (!snapshot) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold mb-2">This version is not available</h1>
          <p className="text-gray-600 mb-6">It may have been revoked or never existed.</p>
          <a href="/" className="inline-block px-4 py-2 rounded bg-blue-600 text-white">Go Home</a>
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

      {/* Placeholder for chart(s) – we will wire real charts in the next slice */}
      <section className="max-w-md mx-auto p-4">
        <div className="rounded border p-4 text-center text-gray-600">
          Versioned page — charts will render here next.
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


