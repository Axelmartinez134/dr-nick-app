"use client";

import { useEffect, useMemo, useState } from "react";

export function useHtmlSlidesViewport(params: {
  viewportRef: { current: HTMLDivElement | null };
  slideCount: number;
  activeSlideIndex: number;
}) {
  const { viewportRef, slideCount, activeSlideIndex } = params;

  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setViewportWidth(node.clientWidth);
    });
    observer.observe(node);
    setViewportWidth(node.clientWidth);
    return () => observer.disconnect();
  }, [viewportRef]);

  const CARD_W = 420;
  const GAP = 24;
  const VIEWPORT_PAD = 40;

  const totalW = useMemo(() => slideCount * CARD_W + Math.max(slideCount - 1, 0) * GAP, [slideCount]);

  const translateX = useMemo(() => {
    const viewportContentWidth = Math.max(0, viewportWidth - VIEWPORT_PAD * 2);
    const centerOffset = VIEWPORT_PAD + Math.max(0, (viewportContentWidth - CARD_W) / 2);
    const rawTranslate = centerOffset - activeSlideIndex * (CARD_W + GAP);
    const minTranslate = Math.min(0, viewportContentWidth - totalW);
    const maxTranslate = 0;
    return Math.max(minTranslate, Math.min(maxTranslate, rawTranslate));
  }, [activeSlideIndex, totalW, viewportWidth]);

  return {
    viewportWidth,
    VIEWPORT_PAD,
    CARD_W,
    GAP,
    totalW,
    translateX,
  };
}
