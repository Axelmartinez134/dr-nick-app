import { headers } from 'next/headers'

export default async function Head({ params }: { params: Promise<{ alias: string }> }) {
  const { alias } = await params
  // Resolve alias → slug → snapshot via internal API (server-side)
  const hdr = await headers()
  const proto = hdr.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = hdr.get('host') ?? 'localhost:3000'
  const baseFromHeaders = `${proto}://${host}`
  const envBase = process.env.NEXT_PUBLIC_BASE_URL
  const base = envBase && /^https?:\/\//.test(envBase) ? envBase : baseFromHeaders

  let beforeUrl: string | null = null
  let afterUrl: string | null = null
  try {
    const aliasRes = await fetch(`${base}/api/marketing/aliases/${encodeURIComponent(alias)}`, { cache: 'no-store' })
    const aliasJson = aliasRes.ok ? await aliasRes.json() : null
    const slug = aliasJson?.slug || null
    if (slug) {
      const snapRes = await fetch(`${base}/api/marketing/shares/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      if (snapRes.ok) {
        const snap = await snapRes.json()
        const media = snap?.media || {}
        beforeUrl = typeof media.beforePhotoUrl === 'string' ? media.beforePhotoUrl : null
        afterUrl = typeof media.afterPhotoUrl === 'string' ? media.afterPhotoUrl : null
      }
    }
  } catch {}

  return (
    <>
      {beforeUrl ? <link rel="preload" as="image" href={beforeUrl} /> : null}
      {afterUrl ? <link rel="preload" as="image" href={afterUrl} /> : null}
    </>
  )
}


