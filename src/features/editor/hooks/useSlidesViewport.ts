import { useEffect, useMemo, useState } from "react";

export function useSlidesViewport(params: {
  viewportRef: { current: HTMLDivElement | null };
  slideCount: number;
  activeSlideIndex: number;
}) {
  const { viewportRef, slideCount, activeSlideIndex } = params;

  const [viewportWidth, setViewportWidth] = useState(0);
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportWidth(el.clientWidth);
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [viewportRef]);

  // Window width for mobile/desktop UI decisions (more reliable than viewportRef during first paint).
  useEffect(() => {
    const read = () => setWindowWidth(typeof window !== "undefined" ? window.innerWidth : 0);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // Slide strip translation: no manual scrolling; arrows move slides.
  // We center the active slide in the viewport.
  const CARD_W = 420;
  const GAP = 24; // gap-6
  // Inner gutter so shadows/rings don't get clipped by overflow-x-hidden at the viewport edges.
  const VIEWPORT_PAD = 40;

  const totalW = useMemo(() => slideCount * CARD_W + (slideCount - 1) * GAP, [slideCount]);

  const translateX = useMemo(() => {
    const viewportContentWidth = Math.max(0, viewportWidth - VIEWPORT_PAD * 2);
    const centerOffset = VIEWPORT_PAD + Math.max(0, (viewportContentWidth - CARD_W) / 2);
    const rawTranslate = centerOffset - activeSlideIndex * (CARD_W + GAP);
    const minTranslate = Math.min(0, viewportContentWidth - totalW);
    const maxTranslate = 0;
    return Math.max(minTranslate, Math.min(maxTranslate, rawTranslate));
  }, [activeSlideIndex, totalW, viewportWidth]);

  const isMobile = useMemo(() => {
    const w = (windowWidth || viewportWidth) > 0 ? (windowWidth || viewportWidth) : 0;
    return w > 0 && w < 768; // tailwind "md" breakpoint
  }, [viewportWidth, windowWidth]);

  return { viewportWidth, isMobile, VIEWPORT_PAD, totalW, translateX };
}

