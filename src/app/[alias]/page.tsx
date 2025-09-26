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
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !ANON_KEY) return null
  const supabase = createClient(SUPABASE_URL, ANON_KEY)

  // Resolve alias → current slug
  // Resolve alias to slug via internal API to avoid Supabase client chunking on server
  const hdr = await headers()
  const proto = hdr.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = hdr.get('host') ?? 'localhost:3000'
  const baseFromHeaders = `${proto}://${host}`
  const envBase = process.env.NEXT_PUBLIC_BASE_URL
  const base = envBase && /^https?:\/\//.test(envBase) ? envBase : baseFromHeaders
  const aliasRes = await fetch(`${base}/api/marketing/aliases/${encodeURIComponent(alias)}`, { cache: 'no-store' })
  const aliasJson = aliasRes.ok ? await aliasRes.json() : null
  const slug = aliasJson?.slug
  if (!slug) return null

  // Fetch snapshot via internal API (increments view_count, sets cache headers)
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

  // Pass resolved slug to the client for analytics (CTA clicks)
  // We re-use the alias API result to avoid re-resolving on the client
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hdr = await headers()
  const proto = hdr.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = hdr.get('host') ?? 'localhost:3000'
  const baseFromHeaders = `${proto}://${host}`
  const envBase = process.env.NEXT_PUBLIC_BASE_URL
  const base = envBase && /^https?:\/\//.test(envBase) ? envBase : baseFromHeaders
  const aliasRes = await fetch(`${base}/api/marketing/aliases/${encodeURIComponent(alias)}`, { cache: 'no-store' })
  const aliasJson = aliasRes.ok ? await aliasRes.json() : null
  const shareSlug = aliasJson?.slug || null

  return <AliasStoryClient snapshot={snapshot} shareSlug={shareSlug || undefined} />
}



