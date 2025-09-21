// Server-side page: latest snapshot by alias (no redirect)
import { createClient } from '@supabase/supabase-js'
import { normalizeSnapshot } from '@/app/components/health/marketing/snapshotTypes'
import Link from 'next/link'
import AliasStoryClient from './AliasStoryClient'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

async function fetchSnapshotByAlias(alias: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Resolve alias → current slug
  const { data: aliasRow } = await supabase
    .from('marketing_aliases')
    .select('current_slug')
    .eq('alias', alias)
    .single()

  const slug = aliasRow?.current_slug
  if (!slug) return null

  // Fetch snapshot via internal API (increments view_count, sets cache headers)
  const hdr = await headers()
  const proto = hdr.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = hdr.get('host') ?? 'localhost:3000'
  const baseFromHeaders = `${proto}://${host}`
  const envBase = process.env.NEXT_PUBLIC_BASE_URL
  const base = envBase && /^https?:\/\//.test(envBase) ? envBase : baseFromHeaders

  try {
    const res = await fetch(`${base}/api/marketing/shares/${encodeURIComponent(slug)}`, {
      cache: 'no-store'
    })
    if (res.ok) {
      const json = await res.json()
      return normalizeSnapshot(json)
    }
  } catch {
    // fall through to direct DB read
  }

  // Fallback: direct anon read (no counter increment)
  const { data: shareRow } = await supabase
    .from('marketing_shares')
    .select('snapshot_json, revoked_at')
    .eq('slug', slug)
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

  return <AliasStoryClient snapshot={snapshot} />
}



