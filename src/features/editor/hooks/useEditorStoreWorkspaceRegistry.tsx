import { useLayoutEffect, useMemo, useRef } from "react";

// Phase 5E5 (part 1): publish workspace slices from a dedicated hook.
// This replaces the workspace portion of the legacy `useEditorStoreWorkspaceSync`.
export function useEditorStoreWorkspaceRegistry(args: any) {
  const {
    editorStore,

    // Workspace gestures / refs / helpers
    isMobile,
    mobileDrawerOpen,
    switchingSlides,
    copyGenerating,
    isEditableTarget,
    mobileGestureRef,
    switchToSlide,
    activeSlideIndex,

    currentProjectId,
    activeSlideIndexRef,
    slidesRef,
    initSlide,
    inputData,
    layoutData,
    setSlides,
    setInputData,
    schedulePersistLayoutAndInput,
    liveLayoutKey,
    liveLayoutTimeoutsRef,
    liveLayoutQueueRef,
    liveLayoutRunIdByKeyRef,
    withLayoutLockedInInput,
    withAutoRealignOnImageReleaseInInput,
    saveSlidePatchForProject,

    // Image menu / upload
    imageBusy,
    imageFileInputRef,
    openImageMenu,
    imageLongPressRef,
    activeImageSelected,
    hasImageForActiveSlide,
    deleteImageForActiveSlide,
    setSelectedStickerAsPrimary,
    uploadImageForActiveSlide,
    handleUserImageChange,
    handleUserExtraImageChange,

    // Canvas inline styling pills
    canvasTextSelection,
    applyCanvasInlineMark,
    clearCanvasInlineMarks,

    // Workspace slice values
    slideCount,
    viewportWidth,
    goPrev,
    goNext,
    viewportRef,
    slideCanvasRefs,
    slideRefs,
    canvasRef,
    lastActiveFabricCanvasRef,
    setActiveCanvasNonce,
    CarouselPreviewVision,
    SlideCard,
    templateSnapshots,
    computeTemplateIdForSlide,
    EMPTY_LAYOUT,
    slides,
    showLayoutOverlays,
    addLog,
    imageMenuOpen,
    imageMenuPos,
    imageMenuInfo,
    VIEWPORT_PAD,
    translateX,
    totalW,
    templateTypeId,
    handleRegularCanvasTextChange,
    handleEnhancedCanvasTextChange,

    // From bottom-panel / jobs
    scheduleLiveLayout,
  } = args as any;

  const workspaceImplRef = useRef<any>(null);
  const stableWorkspaceActions = useMemo(
    () =>
      ({
        computeTemplateIdForSlide: (i: number) => workspaceImplRef.current?.computeTemplateIdForSlide?.(i),
        hasImageForActiveSlide: () => workspaceImplRef.current?.hasImageForActiveSlide?.(),
        deleteImageForActiveSlide: (source: "menu" | "button") => workspaceImplRef.current?.deleteImageForActiveSlide?.(source),
        openImageMenu: (x: number, y: number) => workspaceImplRef.current?.openImageMenu?.(x, y),
        setSelectedStickerAsPrimary: () => workspaceImplRef.current?.setSelectedStickerAsPrimary?.(),
        uploadImageForActiveSlide: (file: File, opts?: { bgRemovalEnabledAtInsert?: boolean }) =>
          workspaceImplRef.current?.uploadImageForActiveSlide?.(file, opts),
        handleUserImageChange: (payload: any) => workspaceImplRef.current?.handleUserImageChange?.(payload),
        handleUserExtraImageChange: (payload: any) => workspaceImplRef.current?.handleUserExtraImageChange?.(payload),
        onUserTextChangeRegular: (change: any) => workspaceImplRef.current?.onUserTextChangeRegular?.(change),
        onUserTextChangeEnhanced: (change: any) => workspaceImplRef.current?.onUserTextChangeEnhanced?.(change),
        onMobileViewportPointerDown: (e: any) => workspaceImplRef.current?.onMobileViewportPointerDown?.(e),
        onMobileViewportPointerMove: (e: any) => workspaceImplRef.current?.onMobileViewportPointerMove?.(e),
        onMobileViewportPointerUp: (e: any) => workspaceImplRef.current?.onMobileViewportPointerUp?.(e),
        onMobileViewportPointerCancel: (e: any) => workspaceImplRef.current?.onMobileViewportPointerCancel?.(e),
        renderActiveSlideControlsRow: () => workspaceImplRef.current?.renderActiveSlideControlsRow?.(),
      }) as any,
    []
  );

  useLayoutEffect(() => {
    const mobilePointerDown = (e: any) => {
      if (!isMobile) return;
      if (mobileDrawerOpen) return;
      if ((e as any).pointerType && (e as any).pointerType !== "touch") return;
      if (switchingSlides || copyGenerating) return;
      if (isEditableTarget(e.target)) return;
      const x = (e as any).clientX ?? 0;
      const y = (e as any).clientY ?? 0;
      mobileGestureRef.current = { mode: "slide", startX: x, startY: y, lastX: x, lastY: y, fired: false };
    };
    const mobilePointerMove = (e: any) => {
      const g = mobileGestureRef.current;
      if (g.mode !== "slide") return;
      const x = (e as any).clientX ?? 0;
      const y = (e as any).clientY ?? 0;
      g.lastX = x;
      g.lastY = y;
      const dx = x - g.startX;
      const dy = y - g.startY;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (g.fired) return;
      if (dx < -60) {
        g.fired = true;
        void switchToSlide(activeSlideIndex + 1);
      } else if (dx > 60) {
        g.fired = true;
        void switchToSlide(activeSlideIndex - 1);
      }
    };
    const mobilePointerUp = () => {
      const g = mobileGestureRef.current;
      if (g.mode === "slide") mobileGestureRef.current.mode = null;
    };
    const mobilePointerCancel = () => {
      const g = mobileGestureRef.current;
      if (g.mode === "slide") mobileGestureRef.current.mode = null;
    };

    const renderActiveSlideControlsRow = () => (
      <div className="absolute left-2 bottom-0 translate-y-10 flex items-center gap-3">
        <button
          type="button"
          className="w-9 h-9 bg-transparent text-slate-900 hover:text-black disabled:opacity-40"
          title={
            !currentProjectId ? "Create or load a project to upload an image" : imageBusy ? "Working…" : "Upload image"
          }
          aria-label="Upload image"
          disabled={!currentProjectId || imageBusy || switchingSlides || copyGenerating}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              // Phase 1: left click opens the Image Library modal (upload/recents/logos).
              editorStore.getState?.().actions?.onOpenImageLibraryModal?.();
            } catch {
              // ignore
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openImageMenu(e.clientX, e.clientY);
          }}
          onPointerDown={(e) => {
            if (imageLongPressRef.current) window.clearTimeout(imageLongPressRef.current);
            const x = (e as any).clientX ?? 0;
            const y = (e as any).clientY ?? 0;
            imageLongPressRef.current = window.setTimeout(() => {
              openImageMenu(x, y);
            }, 520);
          }}
          onPointerUp={() => {
            if (imageLongPressRef.current) window.clearTimeout(imageLongPressRef.current);
            imageLongPressRef.current = null;
          }}
          onPointerCancel={() => {
            if (imageLongPressRef.current) window.clearTimeout(imageLongPressRef.current);
            imageLongPressRef.current = null;
          }}
          onPointerLeave={() => {
            if (imageLongPressRef.current) window.clearTimeout(imageLongPressRef.current);
            imageLongPressRef.current = null;
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-9 h-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="7" width="14" height="12" rx="3" />
            <path d="M7 7l1.2-2h3.6L13 7" />
            <circle cx="10" cy="13" r="3" />
            <path d="M20 4v4" />
            <path d="M18 6h4" />
          </svg>
        </button>

        {templateTypeId === "enhanced" ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={!!slides[activeSlideIndex]?.layoutLocked}
              aria-label="Lock layout"
              className={[
                "relative inline-flex h-8 w-16 items-center rounded-full border transition-colors select-none",
                !currentProjectId || switchingSlides || copyGenerating ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                slides[activeSlideIndex]?.layoutLocked ? "bg-emerald-500 border-emerald-500" : "bg-slate-300 border-slate-300",
              ].join(" ")}
              disabled={!currentProjectId || switchingSlides || copyGenerating}
              title={!currentProjectId ? "Create or load a project to use Lock layout" : "Toggle Lock layout for this slide"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!currentProjectId) return;
                const slideIndex = activeSlideIndexRef.current;
                const prev = slidesRef.current[slideIndex] || initSlide();
                const nextLocked = !prev.layoutLocked;
                const baseInput =
                  (slideIndex === activeSlideIndexRef.current ? (inputData as any) : null) || (prev as any)?.inputData || null;
                const nextInput = withLayoutLockedInInput(baseInput, nextLocked);
                setSlides((arr: any) =>
                  arr.map((s: any, ii: number) => (ii !== slideIndex ? s : ({ ...s, layoutLocked: nextLocked, inputData: nextInput } as any)))
                );
                slidesRef.current = slidesRef.current.map((s: any, ii: number) =>
                  ii !== slideIndex ? s : ({ ...s, layoutLocked: nextLocked, inputData: nextInput } as any)
                );
                if (slideIndex === activeSlideIndexRef.current) setInputData(nextInput as any);
                try {
                  const key = liveLayoutKey(currentProjectId, slideIndex);
                  const t = liveLayoutTimeoutsRef.current[key];
                  if (t) window.clearTimeout(t);
                  liveLayoutTimeoutsRef.current[key] = null;
                  liveLayoutQueueRef.current = liveLayoutQueueRef.current.filter((x: any) => x.key !== key);
                  liveLayoutRunIdByKeyRef.current[key] = (liveLayoutRunIdByKeyRef.current[key] || 0) + 1;
                } catch {
                  // ignore
                }
                schedulePersistLayoutAndInput({
                  projectId: currentProjectId,
                  slideIndex,
                  layoutSnapshot: ((layoutData as any)?.layout || (prev as any)?.layoutData?.layout || null),
                  inputSnapshot: nextInput,
                });
              }}
            >
              <span
                className={[
                  "absolute left-2 text-[10px] font-bold tracking-wide text-white transition-opacity",
                  slides[activeSlideIndex]?.layoutLocked ? "opacity-100" : "opacity-0",
                ].join(" ")}
              >
                ON
              </span>
              <span
                className={[
                  "absolute right-2 text-[10px] font-bold tracking-wide text-slate-700 transition-opacity",
                  slides[activeSlideIndex]?.layoutLocked ? "opacity-0" : "opacity-100",
                ].join(" ")}
              >
                OFF
              </span>
              <span
                className={[
                  "inline-block h-7 w-7 rounded-full bg-white shadow-sm transform transition-transform",
                  slides[activeSlideIndex]?.layoutLocked ? "translate-x-8" : "translate-x-1",
                ].join(" ")}
              />
            </button>
            <div className="text-sm font-semibold text-slate-900 select-none">Lock layout</div>
          </div>
        ) : null}

        {templateTypeId === "enhanced" && activeImageSelected ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={!!slides[activeSlideIndex]?.autoRealignOnImageRelease}
              aria-label="Auto realign on release"
              className={[
                "relative inline-flex h-8 w-16 items-center rounded-full border transition-colors select-none",
                !currentProjectId || switchingSlides || copyGenerating || !!slides[activeSlideIndex]?.layoutLocked
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer",
                slides[activeSlideIndex]?.autoRealignOnImageRelease ? "bg-slate-900 border-slate-900" : "bg-slate-300 border-slate-300",
              ].join(" ")}
              disabled={!currentProjectId || switchingSlides || copyGenerating || !!slides[activeSlideIndex]?.layoutLocked}
              title={
                !currentProjectId
                  ? "Create or load a project to use Auto realign on release"
                  : slides[activeSlideIndex]?.layoutLocked
                    ? "Turn off Lock layout to use Auto realign on release"
                    : "Toggle Auto realign on release"
              }
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!currentProjectId) return;
                const slideIndex = activeSlideIndexRef.current;
                const prev = slidesRef.current[slideIndex] || initSlide();
                if (prev.layoutLocked) return;
                const nextEnabled = !prev.autoRealignOnImageRelease;
                const baseInput =
                  (slideIndex === activeSlideIndexRef.current ? (inputData as any) : null) || (prev as any)?.inputData || null;
                const nextInput = withAutoRealignOnImageReleaseInInput(baseInput, nextEnabled);

                setSlides((arr: any) =>
                  arr.map((s: any, ii: number) =>
                    ii !== slideIndex ? s : ({ ...s, autoRealignOnImageRelease: nextEnabled, inputData: nextInput } as any)
                  )
                );
                slidesRef.current = slidesRef.current.map((s: any, ii: number) =>
                  ii !== slideIndex ? s : ({ ...s, autoRealignOnImageRelease: nextEnabled, inputData: nextInput } as any)
                );
                if (slideIndex === activeSlideIndexRef.current) setInputData(nextInput as any);

                void saveSlidePatchForProject(currentProjectId, slideIndex, { inputSnapshot: nextInput });
              }}
            >
              <span
                className={[
                  "absolute left-2 text-[10px] font-bold tracking-wide text-white transition-opacity",
                  slides[activeSlideIndex]?.autoRealignOnImageRelease ? "opacity-100" : "opacity-0",
                ].join(" ")}
              >
                ON
              </span>
              <span
                className={[
                  "absolute right-2 text-[10px] font-bold tracking-wide text-slate-700 transition-opacity",
                  slides[activeSlideIndex]?.autoRealignOnImageRelease ? "opacity-0" : "opacity-100",
                ].join(" ")}
              >
                OFF
              </span>
              <span
                className={[
                  "inline-block h-7 w-7 rounded-full bg-white shadow-sm transform transition-transform",
                  slides[activeSlideIndex]?.autoRealignOnImageRelease ? "translate-x-8" : "translate-x-1",
                ].join(" ")}
              />
            </button>
            <div className="text-sm font-semibold text-slate-900 select-none">Auto realign on release</div>
          </div>
        ) : null}

        {canvasTextSelection?.active ? (
          <div className="flex items-center gap-2">
            {(() => {
              const disabled = !currentProjectId || switchingSlides || copyGenerating;
              const pillBase = "h-8 px-3 rounded-full border text-sm font-semibold select-none transition-colors";
              const pillOn = "bg-slate-900 border-slate-900 text-white";
              const pillOff = "bg-white border-slate-300 text-slate-900 hover:bg-slate-50";
              const pillDis = "opacity-40 cursor-not-allowed";
              const btn = (on: boolean) => [pillBase, disabled ? pillDis : "cursor-pointer", on ? pillOn : pillOff].join(" ");
              const stop = (e: any) => {
                e.preventDefault();
                e.stopPropagation();
              };
              return (
                <>
                  <button
                    type="button"
                    className={btn(!!canvasTextSelection?.isBold)}
                    disabled={disabled}
                    tabIndex={-1}
                    aria-label="Bold"
                    title="Bold"
                    onMouseDown={stop}
                    onClick={(e) => {
                      stop(e);
                      applyCanvasInlineMark("bold", !canvasTextSelection.isBold);
                    }}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className={btn(!!canvasTextSelection?.isItalic)}
                    disabled={disabled}
                    tabIndex={-1}
                    aria-label="Italic"
                    title="Italic"
                    onMouseDown={stop}
                    onClick={(e) => {
                      stop(e);
                      applyCanvasInlineMark("italic", !canvasTextSelection.isItalic);
                    }}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    className={btn(!!canvasTextSelection?.isUnderline)}
                    disabled={disabled}
                    tabIndex={-1}
                    aria-label="Underline"
                    title="Underline"
                    onMouseDown={stop}
                    onClick={(e) => {
                      stop(e);
                      applyCanvasInlineMark("underline", !canvasTextSelection.isUnderline);
                    }}
                  >
                    <span className="underline underline-offset-2">U</span>
                  </button>
                  <button
                    type="button"
                    className={btn(false)}
                    disabled={disabled}
                    tabIndex={-1}
                    aria-label="Clear text styling"
                    title="Clear (bold/italic/underline)"
                    onMouseDown={stop}
                    onClick={(e) => {
                      stop(e);
                      clearCanvasInlineMarks();
                    }}
                  >
                    Clear
                  </button>
                </>
              );
            })()}
          </div>
        ) : null}
      </div>
    );

    workspaceImplRef.current = {
      computeTemplateIdForSlide,
      hasImageForActiveSlide,
      deleteImageForActiveSlide: (source: "menu" | "button") => void deleteImageForActiveSlide(source),
      openImageMenu,
      setSelectedStickerAsPrimary,
      uploadImageForActiveSlide: (file: File, opts?: { bgRemovalEnabledAtInsert?: boolean }) =>
        void uploadImageForActiveSlide(file, opts),
      handleUserImageChange,
      handleUserExtraImageChange,
      onUserTextChangeRegular: handleRegularCanvasTextChange,
      onUserTextChangeEnhanced: handleEnhancedCanvasTextChange,
      onMobileViewportPointerDown: mobilePointerDown,
      onMobileViewportPointerMove: mobilePointerMove,
      onMobileViewportPointerUp: mobilePointerUp,
      onMobileViewportPointerCancel: mobilePointerCancel,
      renderActiveSlideControlsRow,
    };

    editorStore.setState({
      workspaceNav: {
        slideCount,
        activeSlideIndex,
        copyGenerating,
        viewportWidth,
        goPrev,
        goNext,
        switchToSlide,
        VIEWPORT_PAD,
        translateX,
        totalW,
      },
      workspaceRefs: {
        viewportRef,
        imageFileInputRef,
        slideCanvasRefs,
        slideRefs,
        canvasRef,
        lastActiveFabricCanvasRef,
        setActiveCanvasNonce,
      },
      workspaceUi: {
        CarouselPreviewVision,
        SlideCard,
        templateSnapshots,
        layoutData,
        EMPTY_LAYOUT,
        slides,
        showLayoutOverlays,
        addLog,
        imageMenuOpen,
        imageMenuPos,
        imageMenuInfo,
        imageBusy,
      },
      workspaceActions: stableWorkspaceActions as any,
      workspace: null,
    } as any);
  }, [
    CarouselPreviewVision,
    EMPTY_LAYOUT,
    SlideCard,
    activeImageSelected,
    activeSlideIndex,
    activeSlideIndexRef,
    addLog,
    applyCanvasInlineMark,
    canvasRef,
    canvasTextSelection,
    clearCanvasInlineMarks,
    computeTemplateIdForSlide,
    copyGenerating,
    currentProjectId,
    deleteImageForActiveSlide,
    editorStore,
    goNext,
    goPrev,
    handleEnhancedCanvasTextChange,
    handleRegularCanvasTextChange,
    handleUserImageChange,
    handleUserExtraImageChange,
    hasImageForActiveSlide,
    imageBusy,
    imageFileInputRef,
    imageLongPressRef,
    imageMenuOpen,
    imageMenuInfo,
    imageMenuPos,
    isEditableTarget,
    isMobile,
    lastActiveFabricCanvasRef,
    layoutData,
    liveLayoutKey,
    liveLayoutQueueRef,
    liveLayoutRunIdByKeyRef,
    liveLayoutTimeoutsRef,
    mobileDrawerOpen,
    mobileGestureRef,
    openImageMenu,
    saveSlidePatchForProject,
    schedulePersistLayoutAndInput,
    setActiveCanvasNonce,
    setInputData,
    setSlides,
    slideCanvasRefs,
    slideCount,
    slideRefs,
    slides,
    slidesRef,
    switchingSlides,
    switchToSlide,
    templateSnapshots,
    templateTypeId,
    viewportRef,
    viewportWidth,
    VIEWPORT_PAD,
    translateX,
    totalW,
    withAutoRealignOnImageReleaseInInput,
    withLayoutLockedInInput,
  ]);
}

