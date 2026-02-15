import { useCallback } from "react";
import type { CarouselTextRequest } from "@/lib/carousel-types";
import { ensureTypographyFontsLoaded } from "@/app/components/health/marketing/ai-carousel/fontMetrics";

type LiveLayoutWorkItem = {
  key: string; // projectId:slideIndex
  runId: number;
  projectId: string;
  slideIndex: number;
  templateTypeId: "regular" | "enhanced";
  templateId: string | null;
  templateSnapshot: any | null;
  headline: string;
  body: string;
  headlineRanges: any[];
  bodyRanges: any[];
  headlineFontSizePx: number;
  bodyFontSizePx: number;
  headlineTextAlign: "left" | "center" | "right";
  bodyTextAlign: "left" | "center" | "right";
  lineOverridesByKey: any | null;
  image: any | null;
  existingLayout: any | null;
  settings: {
    backgroundColor: string;
    textColor: string;
    includeImage: boolean;
  };
};

export function useLiveLayoutQueue(params: {
  // Identity + mode
  slideCount: number;
  templateTypeId: "regular" | "enhanced";
  currentProjectId: string | null;
  currentProjectIdRef: { current: string | null };
  activeSlideIndex: number;
  activeSlideIndexRef: { current: number };
  realignmentModel: string;

  // State + setters
  slidesRef: { current: any[] };
  initSlide: () => any;
  setSlides: (updater: any) => void;
  layoutData: any;
  inputData: any;
  setLayoutData: (next: any) => void;
  setInputData: (next: any) => void;
  setLayoutHistory: (updater: any) => void;

  // Persistence + logging
  saveSlidePatchForProject: (projectId: string, slideIndex: number, patch: any) => Promise<any> | any;
  schedulePersistLayoutAndInput: (args: any) => void;
  addLog: (msg: string) => void;

  // Typography + colors
  headlineFontFamily: string;
  headlineFontWeight: number;
  bodyFontFamily: string;
  bodyFontWeight: number;
  projectBackgroundColor: string;
  projectTextColor: string;

  // Live layout infra (kept in EditorShell; hook wires logic)
  LIVE_LAYOUT_DEBOUNCE_MS: number;
  liveLayoutKey: (projectId: string, slideIndex: number) => string;
  liveLayoutTimeoutsRef: { current: Record<string, number | null> };
  liveLayoutQueueRef: { current: LiveLayoutWorkItem[] };
  liveLayoutRunIdByKeyRef: { current: Record<string, number> };
  liveLayoutRunningRef: { current: boolean };

  // Template lookups
  computeTemplateIdForSlide: (slideIndex: number) => string | null;
  templateSnapshots: Record<string, any>;

  // Layout computation (provided by EditorShell)
  computeDeterministicLayoutRef: { current: ((params: any) => any) | null };
  computeRegularBodyTextboxLayoutRef: { current: ((params: any) => any) | null };

  // Realign integration (legacy engine path)
  handleRealign: (opts: { skipHistory: boolean }) => Promise<void> | void;
  layoutDirtyRef: { current: boolean };
  pushUndoSnapshot: () => void;
}) {
  const {
    slideCount,
    templateTypeId,
    currentProjectId,
    currentProjectIdRef,
    activeSlideIndex,
    activeSlideIndexRef,
    realignmentModel,
    slidesRef,
    initSlide,
    setSlides,
    layoutData,
    inputData,
    setLayoutData,
    setInputData,
    setLayoutHistory,
    saveSlidePatchForProject,
    schedulePersistLayoutAndInput,
    addLog,
    headlineFontFamily,
    headlineFontWeight,
    bodyFontFamily,
    bodyFontWeight,
    projectBackgroundColor,
    projectTextColor,
    LIVE_LAYOUT_DEBOUNCE_MS,
    liveLayoutKey,
    liveLayoutTimeoutsRef,
    liveLayoutQueueRef,
    liveLayoutRunIdByKeyRef,
    liveLayoutRunningRef,
    computeTemplateIdForSlide,
    templateSnapshots,
    computeDeterministicLayoutRef,
    computeRegularBodyTextboxLayoutRef,
    handleRealign,
    layoutDirtyRef,
    pushUndoSnapshot,
  } = params;

  const processLiveLayoutQueue = useCallback(async () => {
    if (liveLayoutRunningRef.current) return;
    liveLayoutRunningRef.current = true;
    try {
      // Ensure fonts (including italic/bold variants) are loaded before measuring/wrapping.
      // This prevents Fabric from falling back mid-render (which causes odd spacing/kerning and unexpected wraps).
      await ensureTypographyFontsLoaded({
        headlineFontFamily,
        headlineFontWeight,
        bodyFontFamily,
        bodyFontWeight,
      });

      while (liveLayoutQueueRef.current.length > 0) {
        const item = liveLayoutQueueRef.current.shift() as LiveLayoutWorkItem;
        const slideIndex = item.slideIndex;
        const pid = item.projectId;
        const key = item.key;
        // Ignore stale completions for this project+slide.
        if (liveLayoutRunIdByKeyRef.current[key] !== item.runId) continue;

        // Enhanced Lock Layout: if the slide is currently locked, do not apply/persist auto-reflow results.
        // (User explicitly chose to keep positions stable.)
        try {
          const cur = slidesRef.current[slideIndex] || null;
          if (item.templateTypeId === "enhanced" && !!(cur as any)?.layoutLocked) {
            addLog(`🔒 Live layout skipped slide ${slideIndex + 1}: layout is locked`);
            continue;
          }
        } catch {
          // ignore
        }

        const snap = item.templateSnapshot;
        const tid = item.templateId;
        if (!snap) {
          addLog(`⚠️ Live layout skipped slide ${slideIndex + 1}: missing template snapshot`);
          continue;
        }

        const headline = item.headline || "";
        const body = item.body || "";
        if (!String(body).trim() && !String(headline).trim()) {
          addLog(`⏭️ Live layout skipped slide ${slideIndex + 1}: empty text`);
          continue;
        }

        addLog(
          `📐 Live layout slide ${slideIndex + 1} start: project=${pid} template=${tid || "none"} headlineLen=${headline.length} bodyLen=${body.length} headlineRanges=${item.headlineRanges.length} bodyRanges=${item.bodyRanges.length}`
        );

        const headlineTextAlign: "left" | "center" | "right" =
          item.headlineTextAlign === "center" || item.headlineTextAlign === "right" ? item.headlineTextAlign : "left";
        const bodyTextAlign: "left" | "center" | "right" =
          item.bodyTextAlign === "center" || item.bodyTextAlign === "right" ? item.bodyTextAlign : "left";

        const computeRegular = computeRegularBodyTextboxLayoutRef.current;
        const computeDeterministic = computeDeterministicLayoutRef.current;
        if (!computeRegular || !computeDeterministic) {
          addLog(`⚠️ Live layout skipped slide ${slideIndex + 1}: layout functions not ready`);
          continue;
        }

        const nextLayoutRaw =
          item.templateTypeId === "regular"
            ? computeRegular({
                slideIndex,
                body,
                templateSnapshot: snap,
                image: item.image,
                existingLayout: item.existingLayout,
                bodyRanges: item.bodyRanges,
                bodyFontSizePx: item.bodyFontSizePx,
              })
            : computeDeterministic({
                slideIndex,
                headline,
                body,
                templateSnapshot: snap,
                image: item.image,
                headlineRanges: item.headlineRanges,
                bodyRanges: item.bodyRanges,
                lineOverridesByKey: item.lineOverridesByKey,
                headlineFontSizePx: item.headlineFontSizePx,
                bodyFontSizePx: item.bodyFontSizePx,
                headlineTextAlign,
                bodyTextAlign,
              });
        if (!nextLayoutRaw) continue;

        // IMPORTANT (Regular only): ensure a NEW layout object reference.
        // Regular layout computation may reuse/mutate an existing layout object; if the reference
        // doesn't change, the canvas renderer's `[layout]` effect won't fire and text won't appear
        // until a slide switch forces a rerender.
        const nextLayout =
          item.templateTypeId === "regular" && typeof nextLayoutRaw === "object" && nextLayoutRaw
            ? ({
                ...(nextLayoutRaw as any),
                textLines: Array.isArray((nextLayoutRaw as any).textLines) ? [...(nextLayoutRaw as any).textLines] : (nextLayoutRaw as any).textLines,
              } as any)
            : nextLayoutRaw;

        // Phase multi-image: Preserve the latest extraImages[] so debounced live-layout cannot clobber sticker geometry.
        // IMPORTANT: Use the *current* slide layout at process-time (not the queued snapshot), because users may have
        // moved/resized stickers after the work item was enqueued.
        try {
          const curSlideNow = slidesRef.current?.[slideIndex] || null;
          const existingNow =
            (curSlideNow as any)?.layoutData?.layout ||
            (slideIndex === activeSlideIndexRef.current ? (layoutData as any)?.layout : null) ||
            (item as any)?.existingLayout ||
            null;
          const extraNow = (existingNow && Array.isArray((existingNow as any).extraImages)) ? ((existingNow as any).extraImages as any[]) : null;
          if (extraNow && extraNow.length) {
            (nextLayout as any).extraImages = extraNow;
          }
        } catch {
          // ignore
        }

        const effectiveBodyFontSizePx =
          item.templateTypeId === "regular"
            ? Number((nextLayout as any)?.textLines?.[0]?.baseSize ?? item.bodyFontSizePx ?? 48)
            : item.bodyFontSizePx;

        const textLineCount = Array.isArray((nextLayout as any)?.textLines) ? (nextLayout as any).textLines.length : 0;
        const styleCount = Array.isArray((nextLayout as any)?.textLines)
          ? (nextLayout as any).textLines.reduce((acc: number, l: any) => acc + (Array.isArray(l?.styles) ? l.styles.length : 0), 0)
          : 0;
        addLog(`✅ Live layout slide ${slideIndex + 1} done: lines=${textLineCount} styles=${styleCount}`);

        const req: any = {
          headline,
          body,
          headlineFontSizePx: item.headlineFontSizePx,
          bodyFontSizePx: effectiveBodyFontSizePx,
          headlineTextAlign,
          bodyTextAlign,
          settings: item.settings,
          templateId: tid || undefined,
          headlineStyleRanges: item.headlineRanges,
          bodyStyleRanges: item.bodyRanges,
          ...(item.lineOverridesByKey ? { lineOverridesByKey: item.lineOverridesByKey } : {}),
        } satisfies CarouselTextRequest as any;

        const nextLayoutData = {
          success: true,
          layout: nextLayout,
          imageUrl: (item.image as any)?.url || null,
        };

        // Only apply in-memory/UI updates if we're still viewing this project.
        if (currentProjectIdRef.current === pid) {
          setSlides((prev: any[]) =>
            prev.map((s, i) =>
              i !== slideIndex
                ? s
                : {
                    ...s,
                    layoutData: nextLayoutData,
                    inputData: req,
                    ...(item.templateTypeId === "regular" ? { draftBodyFontSizePx: effectiveBodyFontSizePx } : {}),
                  }
            )
          );
          slidesRef.current = slidesRef.current.map((s: any, i: number) =>
            i !== slideIndex
              ? s
              : {
                  ...s,
                  layoutData: nextLayoutData,
                  inputData: req,
                  ...(item.templateTypeId === "regular" ? { draftBodyFontSizePx: effectiveBodyFontSizePx } : {}),
                }
          );
          // If this is the active slide, also update the engine so Fabric rerenders immediately.
          if (slideIndex === activeSlideIndexRef.current) {
            setLayoutData(nextLayoutData as any);
            setInputData(req as any);
            setLayoutHistory((h: any) => h || []);
          }
        }

        // Always persist to the original project+slide.
        void saveSlidePatchForProject(pid, slideIndex, {
          layoutSnapshot: nextLayout,
          inputSnapshot: req,
        });

        // Yield to the browser between slides to keep UI responsive.
        await new Promise((r) => setTimeout(r, 0));
      }

      // Safety sync: ensure the engine reflects the currently active slide's latest snapshots.
      // This prevents edge cases where live-layout updates slide snapshots but the active canvas
      // doesn't refresh until the user switches slides.
      try {
        const pidNow = String(currentProjectIdRef.current || "").trim();
        if (pidNow) {
          const si = Math.max(0, Math.min(slideCount - 1, Number(activeSlideIndexRef.current || 0)));
          const sNow: any = slidesRef.current?.[si] || null;
          if (sNow?.layoutData || sNow?.inputData) {
            if (sNow.layoutData) setLayoutData(sNow.layoutData as any);
            if (sNow.inputData) setInputData(sNow.inputData as any);
            setLayoutHistory((h: any) => h || []);
          }
        }
      } catch {
        // ignore
      }
    } finally {
      liveLayoutRunningRef.current = false;
    }
  }, [
    activeSlideIndexRef,
    addLog,
    bodyFontFamily,
    bodyFontWeight,
    computeDeterministicLayoutRef,
    computeRegularBodyTextboxLayoutRef,
    currentProjectIdRef,
    headlineFontFamily,
    headlineFontWeight,
    liveLayoutQueueRef,
    liveLayoutRunIdByKeyRef,
    liveLayoutRunningRef,
    saveSlidePatchForProject,
    setInputData,
    setLayoutData,
    setLayoutHistory,
    setSlides,
    slidesRef,
  ]);

  const enqueueLiveLayoutForProject = useCallback(
    (projectId: string, indices: number[]) => {
      const pid = String(projectId || "").trim();
      if (!pid) return;
      indices.forEach((i) => {
        if (i < 0 || i >= slideCount) return;
        const key = liveLayoutKey(pid, i);
        const runId = (liveLayoutRunIdByKeyRef.current[key] || 0) + 1;
        liveLayoutRunIdByKeyRef.current[key] = runId;

        // Snapshot the slide state and template snapshot NOW so background processing can't bleed across projects.
        const slide = slidesRef.current[i] || initSlide();
        const tid = computeTemplateIdForSlide(i);
        const snap = (tid ? templateSnapshots[tid] : null) || null;

        const templateTypeAtSchedule = templateTypeId;
        const headline = templateTypeAtSchedule === "regular" ? "" : (slide.draftHeadline || "");
        const body = slide.draftBody || "";
        const headlineRanges = Array.isArray(slide.draftHeadlineRanges) ? slide.draftHeadlineRanges : [];
        const bodyRanges = Array.isArray(slide.draftBodyRanges) ? slide.draftBodyRanges : [];
        const headlineFontSizePx =
          Number.isFinite((slide as any)?.draftHeadlineFontSizePx as any)
            ? Math.max(24, Math.min(120, Math.round(Number((slide as any).draftHeadlineFontSizePx))))
            : 76;
        const _hAlign = (slide as any)?.draftHeadlineTextAlign;
        const headlineTextAlign: "left" | "center" | "right" = _hAlign === "center" || _hAlign === "right" ? _hAlign : "left";
        const bodyFontSizePxSnap =
          Number.isFinite((slide as any)?.draftBodyFontSizePx as any)
            ? Math.max(24, Math.min(120, Math.round(Number((slide as any).draftBodyFontSizePx))))
            : 48;
        const _bAlign = (slide as any)?.draftBodyTextAlign;
        const bodyTextAlign: "left" | "center" | "right" = _bAlign === "center" || _bAlign === "right" ? _bAlign : "left";

        const prevInput = (slide as any)?.inputData || null;
        const lineOverridesByKey =
          prevInput && typeof prevInput === "object" && prevInput.lineOverridesByKey && typeof prevInput.lineOverridesByKey === "object"
            ? prevInput.lineOverridesByKey
            : null;

        const existingLayout = (slide as any)?.layoutData?.layout || null;
        const image = existingLayout && typeof existingLayout === "object" ? (existingLayout as any).image || null : null;

        const item: LiveLayoutWorkItem = {
          key,
          runId,
          projectId: pid,
          slideIndex: i,
          templateTypeId: templateTypeAtSchedule,
          templateId: tid || null,
          templateSnapshot: snap,
          headline,
          body,
          headlineRanges,
          bodyRanges,
          headlineFontSizePx,
          bodyFontSizePx: bodyFontSizePxSnap,
          headlineTextAlign,
          bodyTextAlign,
          lineOverridesByKey,
          image,
          existingLayout,
          settings: {
            backgroundColor: projectBackgroundColor || "#ffffff",
            textColor: projectTextColor || "#000000",
            includeImage: false,
          },
        };

        // De-dupe: remove any older queued item for same key (we keep only the newest snapshot).
        liveLayoutQueueRef.current = liveLayoutQueueRef.current.filter((x) => x.key !== key);
        liveLayoutQueueRef.current.push(item);
      });
      void processLiveLayoutQueue();
    },
    [
      computeTemplateIdForSlide,
      initSlide,
      liveLayoutKey,
      liveLayoutQueueRef,
      liveLayoutRunIdByKeyRef,
      processLiveLayoutQueue,
      projectBackgroundColor,
      projectTextColor,
      slideCount,
      slidesRef,
      templateSnapshots,
      templateTypeId,
    ]
  );

  const scheduleLiveLayout = useCallback(
    (slideIndex: number) => {
      if (!currentProjectId) return;
      const pid = currentProjectId;
      const key = liveLayoutKey(pid, slideIndex);
      const prev = liveLayoutTimeoutsRef.current[key];
      const draftHeadlineNow = templateTypeId === "regular" ? "" : String((slidesRef.current?.[slideIndex] as any)?.draftHeadline || "");
      const debugNL = draftHeadlineNow.includes("\n");
      try {
        if (debugNL) {
          addLog(
            `⏱️ scheduleLiveLayout slide ${slideIndex + 1}: key=${key} prevTimer=${prev ? "1" : "0"} ` +
              `debounceMs=${LIVE_LAYOUT_DEBOUNCE_MS} locked=${(slidesRef.current?.[slideIndex] as any)?.layoutLocked ? "1" : "0"}`
          );
        }
      } catch {
        // ignore
      }
      if (prev) window.clearTimeout(prev);
      liveLayoutTimeoutsRef.current[key] = window.setTimeout(() => {
        try {
          if (debugNL) addLog(`⏱️ scheduleLiveLayout fire slide ${slideIndex + 1}: key=${key}`);
        } catch {
          // ignore
        }
        // Enhanced Lock Layout: never auto-reflow a slide that is currently locked
        // (unless there is no layout yet, in which case we allow the initial layout to be generated).
        try {
          if (templateTypeId === "enhanced") {
            const s = slidesRef.current[slideIndex] || null;
            const locked = !!(s as any)?.layoutLocked;
            const hasLayout = !!(
              (slideIndex === activeSlideIndexRef.current ? (layoutData as any)?.layout : null) || (s as any)?.layoutData?.layout
            );
            if (locked && hasLayout) {
              try {
                if (debugNL) addLog(`⏱️ scheduleLiveLayout skip slide ${slideIndex + 1}: locked=1 hasLayout=1`);
              } catch {
                // ignore
              }
              return;
            }
          }
        } catch {
          // ignore
        }
        enqueueLiveLayoutForProject(pid, [slideIndex]);
      }, LIVE_LAYOUT_DEBOUNCE_MS);
    },
    [
      LIVE_LAYOUT_DEBOUNCE_MS,
      activeSlideIndexRef,
      currentProjectId,
      enqueueLiveLayoutForProject,
      layoutData,
      liveLayoutKey,
      liveLayoutTimeoutsRef,
      addLog,
      slidesRef,
      templateTypeId,
    ]
  );

  const wipeLineOverridesForActiveSlide = useCallback((): { nextInput: any | null } => {
    if (templateTypeId !== "enhanced") return { nextInput: null };
    if (!currentProjectId) return { nextInput: null };
    const slideIndex = activeSlideIndex;
    const curSlide = slidesRef.current[slideIndex] || initSlide();
    const cur = (slideIndex === activeSlideIndex ? inputData : null) || (curSlide as any)?.inputData || null;
    if (!cur || typeof cur !== "object") return { nextInput: null };
    if (!(cur as any).lineOverridesByKey) return { nextInput: null };

    const next = { ...(cur as any) };
    try {
      delete (next as any).lineOverridesByKey;
    } catch {
      // ignore
    }

    setSlides((prev: any[]) => prev.map((s, i) => (i !== slideIndex ? s : ({ ...s, inputData: next } as any))));
    slidesRef.current = slidesRef.current.map((s: any, i: number) => (i !== slideIndex ? s : ({ ...s, inputData: next } as any)));
    if (slideIndex === activeSlideIndex) setInputData(next as any);

    // Persist wipe (best-effort, async) so Realign starts fresh next time too.
    if (currentProjectId) {
      void saveSlidePatchForProject(currentProjectId, slideIndex, { inputSnapshot: next });
    }

    return { nextInput: next };
  }, [
    activeSlideIndex,
    currentProjectId,
    initSlide,
    inputData,
    saveSlidePatchForProject,
    setInputData,
    setSlides,
    slidesRef,
    templateTypeId,
  ]);

  const runRealignTextForActiveSlide = useCallback(
    (opts: { pushHistory: boolean }) => {
      const slideIndex = activeSlideIndexRef.current;
      layoutDirtyRef.current = true;
      if (opts.pushHistory) pushUndoSnapshot();

      setSlides((prev: any[]) =>
        prev.map((s, i) =>
          i !== slideIndex
            ? s
            : ({
                ...s,
                draftHeadlineTextAlign: "left",
                draftBodyTextAlign: "left",
                inputData:
                  (s as any).inputData && typeof (s as any).inputData === "object"
                    ? { ...((s as any).inputData as any), headlineTextAlign: "left", bodyTextAlign: "left" }
                    : (s as any).inputData,
              } as any)
        )
      );
      slidesRef.current = slidesRef.current.map((s: any, i: number) =>
        i !== slideIndex
          ? s
          : ({
              ...s,
              draftHeadlineTextAlign: "left",
              draftBodyTextAlign: "left",
              inputData:
                (s as any).inputData && typeof (s as any).inputData === "object"
                  ? { ...((s as any).inputData as any), headlineTextAlign: "left", bodyTextAlign: "left" }
                  : (s as any).inputData,
            } as any)
      );

      wipeLineOverridesForActiveSlide();

      if (realignmentModel === "gemini-computational") {
        if (currentProjectId && !(slidesRef.current[slideIndex] as any)?.layoutLocked) {
          enqueueLiveLayoutForProject(currentProjectId, [slideIndex]);
        }
      } else {
        void handleRealign({ skipHistory: true });
      }
    },
    [
      activeSlideIndexRef,
      currentProjectId,
      enqueueLiveLayoutForProject,
      handleRealign,
      layoutDirtyRef,
      pushUndoSnapshot,
      realignmentModel,
      setSlides,
      slidesRef,
      wipeLineOverridesForActiveSlide,
    ]
  );

  return {
    enqueueLiveLayoutForProject,
    scheduleLiveLayout,
    processLiveLayoutQueue,
    wipeLineOverridesForActiveSlide,
    runRealignTextForActiveSlide,
  };
}

