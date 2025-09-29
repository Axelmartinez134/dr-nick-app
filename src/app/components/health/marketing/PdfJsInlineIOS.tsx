'use client'

import { useEffect, useRef, useState } from 'react'

type PdfJsModule = any

export default function PdfJsInlineIOS({ url, className = '' }: { url: string; className?: string }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lastWidthRef = useRef<number>(0)

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | null = null

    const render = async () => {
      try {
        setIsLoading(true)
        setError(null)
        // Load pdf.js from CDN at runtime to avoid bundling Node-specific code
        await new Promise<void>((resolve, reject) => {
          if ((window as any).pdfjsLib) return resolve()
          const s = document.createElement('script')
          s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'
          s.async = true
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('Failed to load PDF.js script'))
          document.head.appendChild(s)
        })

        const pdfjsLib: PdfJsModule = (window as any).pdfjsLib || (window as any).pdfjsLibGlobal
        if (!pdfjsLib) throw new Error('PDF.js failed to initialize')
        ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'

        const container = containerRef.current
        if (!container) return
        container.innerHTML = ''

        const doc = await pdfjsLib.getDocument({ url }).promise
        if (cancelled) return

        const renderAllPages = async () => {
          if (!container) return
          container.innerHTML = ''
          const wrapper = wrapperRef.current
          const containerWidth = Math.max(1, (wrapper?.clientWidth || container.clientWidth))
          const prevScrollTop = wrapper ? wrapper.scrollTop : 0

          for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
            const page = await doc.getPage(pageNum)
            const unscaled = page.getViewport({ scale: 1 })
            const scale = containerWidth / unscaled.width
            const viewport = page.getViewport({ scale })

            const canvas = document.createElement('canvas')
            canvas.width = Math.floor(viewport.width)
            canvas.height = Math.floor(viewport.height)
            canvas.style.width = '100%'
            canvas.style.height = `${Math.floor(viewport.height)}px`
            canvas.className = 'block'

            const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
            await page.render({ canvasContext: ctx, viewport }).promise

            container.appendChild(canvas)
          }

          if (wrapper) wrapper.scrollTop = prevScrollTop
        }

        await renderAllPages()
        setIsLoading(false)

        // Re-render only when width actually changes (avoid iOS browser chrome height jitters)
        let resizeTimer: any
        const schedule = () => {
          if (resizeTimer) window.clearTimeout(resizeTimer)
          resizeTimer = window.setTimeout(() => {
            renderAllPages().catch(() => {})
          }, 200)
        }
        const startWidthObserver = () => {
          const wrapper = wrapperRef.current
          if (!wrapper) return () => {}
          lastWidthRef.current = Math.round(wrapper.clientWidth)
          if (typeof (window as any).ResizeObserver !== 'undefined') {
            const ro = new (window as any).ResizeObserver((entries: any[]) => {
              const w = Math.round(entries[0]?.contentRect?.width || wrapper.clientWidth)
              if (Math.abs(w - lastWidthRef.current) <= 1) return
              lastWidthRef.current = w
              schedule()
            })
            ro.observe(wrapper)
            return () => ro.disconnect()
          }
          const onResize = () => {
            const w = Math.round(wrapper.clientWidth)
            if (Math.abs(w - lastWidthRef.current) <= 1) return
            lastWidthRef.current = w
            schedule()
          }
          window.addEventListener('resize', onResize)
          return () => window.removeEventListener('resize', onResize)
        }
        cleanup = startWidthObserver()
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load PDF')
        setIsLoading(false)
      }
    }

    render()

    return () => {
      cancelled = true
      if (cleanup) cleanup()
    }
  }, [url])

  return (
    <div ref={wrapperRef} className={className} style={{ WebkitOverflowScrolling: 'touch' as any }}>
      <div ref={containerRef} className="w-full" />
      {isLoading ? (
        <div className="text-center text-sm text-gray-600 mt-2">Loading…</div>
      ) : null}
      {error ? (
        <div className="text-center text-sm text-red-600 mt-2">{error}</div>
      ) : null}
    </div>
  )
}


