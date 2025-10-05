// Server-side asset pinning helper for snapshot publish
// Copies selected media into marketing-assets/{slug}/... and returns pinned URLs

import { SnapshotMedia } from './snapshotTypes'

const BUCKET = 'marketing-assets'

export interface SelectedMedia {
  beforePhotoUrl?: string | null
  afterPhotoUrl?: string | null
  loopVideoUrl?: string | null
  fit3d?: { images?: string[]; youtubeId?: string | null }
  testing?: { pdfUrl?: string | null; linkUrl?: string | null; callouts?: { tdeeStart?: number | null; tdeeEnd?: number | null; bfStart?: number | null; bfEnd?: number | null } }
  testimonialYoutubeId?: string | null
  testimonial?: {
    front?: { beforeUrl?: string | null; afterUrl?: string | null }
    side?: { beforeUrl?: string | null; afterUrl?: string | null }
    rear?: { beforeUrl?: string | null; afterUrl?: string | null }
    youtubeUrl?: string | null
  }
}

function guessExtFromUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback
  try {
    const u = new URL(url)
    const pathname = u.pathname
    const m = pathname.match(/\.([a-zA-Z0-9]+)$/)
    return m ? m[1].toLowerCase() : fallback
  } catch {
    return fallback
  }
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'mp4':
      return 'video/mp4'
    case 'pdf':
      return 'application/pdf'
    default:
      return 'application/octet-stream'
  }
}

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

async function copyUrlToBucket(
  supabase: any,
  sourceUrl: string,
  destPath: string
): Promise<string | null> {
  try {
    const ok = await headOk(sourceUrl)
    if (!ok) return null

    const res = await fetch(sourceUrl)
    if (!res.ok) return null

    const buf = await res.arrayBuffer()
    const ext = guessExtFromUrl(sourceUrl, 'bin')
    const contentType = contentTypeForExt(ext)

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(destPath, new Uint8Array(buf), { contentType, upsert: true })

    if (error) return null

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(destPath)
    return data.publicUrl || null
  } catch {
    return null
  }
}

export async function pinAssets(
  supabase: any,
  slug: string,
  selected: SelectedMedia
): Promise<SnapshotMedia> {
  const base = `/${slug}`.replace(/\/+/, '/')

  // Before photo
  let beforePhotoUrl: string | null | undefined = null
  if (selected.beforePhotoUrl) {
    const ext = guessExtFromUrl(selected.beforePhotoUrl, 'webp')
    beforePhotoUrl = await copyUrlToBucket(
      supabase,
      selected.beforePhotoUrl,
      `${slug}/photos/before.${ext}`
    )
  }

  // After photo
  let afterPhotoUrl: string | null | undefined = null
  if (selected.afterPhotoUrl) {
    const ext = guessExtFromUrl(selected.afterPhotoUrl, 'webp')
    afterPhotoUrl = await copyUrlToBucket(
      supabase,
      selected.afterPhotoUrl,
      `${slug}/photos/after.${ext}`
    )
  }

  // Loop video
  let loopVideoUrl: string | null | undefined = null
  if (selected.loopVideoUrl) {
    const ext = guessExtFromUrl(selected.loopVideoUrl, 'mp4')
    loopVideoUrl = await copyUrlToBucket(
      supabase,
      selected.loopVideoUrl,
      `${slug}/videos/loop.${ext}`
    )
  }

  // Fit3D images
  const pinnedFit3dImages: string[] = []
  if (selected.fit3d?.images && selected.fit3d.images.length > 0) {
    let idx = 1
    for (const img of selected.fit3d.images) {
      if (!img) continue
      const ext = guessExtFromUrl(img, 'webp')
      const u = await copyUrlToBucket(
        supabase,
        img,
        `${slug}/fit3d/${String(idx).padStart(2, '0')}.${ext}`
      )
      if (u) pinnedFit3dImages.push(u)
      idx++
    }
  }

  // Testing link (no pinning); retain legacy pdf pinning if provided
  let testingPdfUrl: string | null | undefined = null
  if (selected.testing?.pdfUrl) {
    const pdfPinned = await copyUrlToBucket(
      supabase,
      selected.testing.pdfUrl,
      `${slug}/testing/metabolic-cardio.pdf`
    )
    if (pdfPinned) {
      testingPdfUrl = `${pdfPinned}?v=${Date.now()}`
    } else {
      testingPdfUrl = null
    }
  }
  const testingLinkUrl: string | null = selected.testing?.linkUrl ?? selected.testing?.pdfUrl ?? null

  // Testimonial nested before/after (front/side/rear)
  const pinTestimonialGroup = async (
    groupKey: 'front' | 'side' | 'rear',
    group: { beforeUrl?: string | null; afterUrl?: string | null } | undefined | null
  ): Promise<{ beforeUrl?: string | null; afterUrl?: string | null }> => {
    const out: { beforeUrl?: string | null; afterUrl?: string | null } = {}
    if (group?.beforeUrl) {
      const ext = guessExtFromUrl(group.beforeUrl, 'webp')
      out.beforeUrl = await copyUrlToBucket(
        supabase,
        group.beforeUrl,
        `${slug}/testimonial/${groupKey}/before.${ext}`
      )
    } else if (group?.beforeUrl === null) {
      out.beforeUrl = null
    }
    if (group?.afterUrl) {
      const ext = guessExtFromUrl(group.afterUrl, 'webp')
      out.afterUrl = await copyUrlToBucket(
        supabase,
        group.afterUrl,
        `${slug}/testimonial/${groupKey}/after.${ext}`
      )
    } else if (group?.afterUrl === null) {
      out.afterUrl = null
    }
    return out
  }

  const testimonialFront = await pinTestimonialGroup('front', selected.testimonial?.front)
  const testimonialSide = await pinTestimonialGroup('side', selected.testimonial?.side)
  const testimonialRear = await pinTestimonialGroup('rear', selected.testimonial?.rear)

  const media: SnapshotMedia = {
    beforePhotoUrl: beforePhotoUrl ?? null,
    afterPhotoUrl: afterPhotoUrl ?? null,
    loopVideoUrl: loopVideoUrl ?? null,
    fit3d: {
      images: pinnedFit3dImages,
      youtubeId: selected.fit3d?.youtubeId ?? null
    },
    testing: {
      pdfUrl: testingPdfUrl ?? null,
      linkUrl: testingLinkUrl ?? null,
      callouts: selected.testing?.callouts ?? {}
    },
    testimonialYoutubeId: selected.testimonialYoutubeId ?? null,
    testimonial: {
      front: testimonialFront,
      side: testimonialSide,
      rear: testimonialRear,
      youtubeUrl: selected.testimonial?.youtubeUrl ?? null
    }
  }

  return media
}


