'use client';

import { useCallback, useRef } from 'react';

export function useAutoRealignOnImageRelease(params: {
  currentProjectIdRef: { current: string | null };
  activeSlideIndexRef: { current: number };
}) {
  const { currentProjectIdRef, activeSlideIndexRef } = params;
  const autoRealignAfterImageReleaseTimeoutRef = useRef<number | null>(null);

  const scheduleAutoRealignAfterRelease = useCallback(
    (args: {
      projectIdAtRelease: string;
      slideIndexAtRelease: number;
      templateTypeId: 'regular' | 'enhanced';
      getSlideState: () => { layoutLocked: boolean; autoRealignOnImageRelease: boolean };
      switchingSlides: boolean;
      copyGenerating: boolean;
      realigning: boolean;
      runRealignTextForActiveSlide: (opts: { pushHistory: boolean }) => void;
    }) => {
      try {
        if (autoRealignAfterImageReleaseTimeoutRef.current) {
          window.clearTimeout(autoRealignAfterImageReleaseTimeoutRef.current);
          autoRealignAfterImageReleaseTimeoutRef.current = null;
        }
        autoRealignAfterImageReleaseTimeoutRef.current = window.setTimeout(() => {
          try {
            // Must still be on the same project/slide when the release settles.
            if (currentProjectIdRef.current !== args.projectIdAtRelease) return;
            if (activeSlideIndexRef.current !== args.slideIndexAtRelease) return;
            if (args.templateTypeId !== 'enhanced') return;
            const cur = args.getSlideState();
            if (cur.layoutLocked) return;
            if (!cur.autoRealignOnImageRelease) return;
            if (args.switchingSlides || args.copyGenerating || args.realigning) return;

            // Run the same pipeline as the button, but do NOT push a second history snapshot.
            args.runRealignTextForActiveSlide({ pushHistory: false });
          } catch {
            // ignore
          }
        }, 0);
      } catch {
        // ignore
      }
    },
    [activeSlideIndexRef, currentProjectIdRef]
  );

  return { scheduleAutoRealignAfterRelease };
}

