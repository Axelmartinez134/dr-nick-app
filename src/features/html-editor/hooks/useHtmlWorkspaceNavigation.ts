"use client";

import { useCallback, useMemo } from "react";

export function useHtmlWorkspaceNavigation(params: {
  slideCount: number;
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
}) {
  const { slideCount, activeSlideIndex, onSelectSlide } = params;

  const switchToSlide = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(nextIndex, Math.max(slideCount - 1, 0)));
      if (clamped === activeSlideIndex) return;
      onSelectSlide(clamped);
    },
    [activeSlideIndex, onSelectSlide, slideCount]
  );

  const goPrev = useCallback(() => {
    switchToSlide(activeSlideIndex - 1);
  }, [activeSlideIndex, switchToSlide]);

  const goNext = useCallback(() => {
    switchToSlide(activeSlideIndex + 1);
  }, [activeSlideIndex, switchToSlide]);

  const canGoPrev = useMemo(() => activeSlideIndex > 0, [activeSlideIndex]);
  const canGoNext = useMemo(() => activeSlideIndex < slideCount - 1, [activeSlideIndex, slideCount]);

  return {
    canGoPrev,
    canGoNext,
    switchToSlide,
    goPrev,
    goNext,
  };
}
