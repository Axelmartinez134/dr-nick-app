import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import Link from 'next/link'
import EditorClient from './EditorClient'

export const dynamic = 'force-dynamic'
export const metadata = {
  robots: { index: false, follow: false }
}

async function loadDraft(draftId: string) {
  const hdr = await headers()
  const proto = hdr.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = hdr.get('host') ?? 'localhost:3000'
  const base = `${proto}://${host}`
  const res = await fetch(`${base}/api/marketing/drafts/${encodeURIComponent(draftId)}`, { cache: 'no-store' })
  if (!res.ok) return null
  return await res.json()
}

export default async function Page({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params
  const draft = await loadDraft(draftId)
  if (!draft) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold mb-2">Draft not found</h1>
          <Link href="/" className="inline-block px-4 py-2 rounded bg-blue-600 text-white">Go Home</Link>
        </div>
      </main>
    )
  }
  return <EditorClient draftId={draftId} initialDraft={draft} />
}


