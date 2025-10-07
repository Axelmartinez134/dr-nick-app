import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import Link from 'next/link'
import { normalizeSnapshot } from '@/app/components/health/marketing/snapshotTypes'
import AliasStoryClient from '@/app/[alias]/AliasStoryClient'
import MarketingFooter from '@/app/components/health/marketing/MarketingFooter'

export const dynamic = 'force-dynamic'
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

async function fetchSnapshotViaApi(slug: string): Promise<{ snapshot: any | null; revoked: boolean }>
{
  const hdr = await headers()
  const proto = hdr.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = hdr.get('host') ?? 'localhost:3000'
  const baseFromHeaders = `${proto}://${host}`
  const envBase = process.env.NEXT_PUBLIC_BASE_URL
  const base = envBase && /^https?:\/\//.test(envBase) ? envBase : baseFromHeaders

  try {
    const res = await fetch(`${base}/api/marketing/shares/${encodeURIComponent(slug)}`, { cache: 'no-store' })
    if (res.status === 410) return { snapshot: null, revoked: true }
    if (!res.ok) return { snapshot: null, revoked: false }
    const json = await res.json()
    return { snapshot: normalizeSnapshot(json), revoked: false }
  } catch {
    return { snapshot: null, revoked: false }
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> })
{
  const { slug } = await params
  const { snapshot, revoked } = await fetchSnapshotViaApi(slug)

  if (revoked) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold mb-2">This version was revoked</h1>
          <p className="text-gray-600 mb-6">Ask the owner for a newer link or visit their alias page.</p>
          <Link href="/" className="inline-block px-4 py-2 rounded bg-blue-600 text-white">Go Home</Link>
        </div>
      </main>
    )
  }

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

  return (
    <>
      <AliasStoryClient snapshot={snapshot} shareSlug={slug} pageType="version" />
      <MarketingFooter year={2025} />
    </>
  )
}


