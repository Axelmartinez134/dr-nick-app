"use client";

import { useMemo } from "react";
import { useEditorSelector } from "@/features/editor/store";
import { useFabricCanvasBinding } from "@/features/editor/hooks/useFabricCanvasBinding";

export function EditorSlidesRow() {
  const workspaceNav = useEditorSelector((s: any) => (s as any).workspaceNav);
  const workspaceRefs = useEditorSelector((s: any) => (s as any).workspaceRefs);
  const workspaceUi = useEditorSelector((s: any) => (s as any).workspaceUi);
  const workspaceActions = useEditorSelector((s: any) => (s as any).workspaceActions);
  const templateTypeId = useEditorSelector((s) => s.templateTypeId);
  const switchingSlides = useEditorSelector((s) => s.switchingSlides);
  const activeSlideIndexStore = useEditorSelector((s) => s.activeSlideIndex);
  const copyGenerating = useEditorSelector((s: any) => {
    const nav = (s as any).workspaceNav;
    if (nav) return !!nav.copyGenerating;
    return false;
  });
  const isMobile = useEditorSelector((s) => s.isMobile);
  const actions = useEditorSelector((s: any) => (s as any).actions);
  const imageLibraryBgRemovalEnabledAtInsert = useEditorSelector(
    (s: any) => !!(s as any).imageLibraryBgRemovalEnabledAtInsert
  );

  const projectBackgroundColor = useEditorSelector((s) => s.projectBackgroundColor);
  const projectTextColor = useEditorSelector((s) => s.projectTextColor);
  const projectBackgroundEffectEnabled = useEditorSelector((s) => (s as any).projectBackgroundEffectEnabled);
  const projectBackgroundEffectType = useEditorSelector((s) => (s as any).projectBackgroundEffectType);
  const headlineFontKey = useEditorSelector((s) => s.headlineFontKey);
  const bodyFontKey = useEditorSelector((s) => s.bodyFontKey);
  const [headlineFontFamily, headlineFontWeight] = (() => {
    const [family, w] = String(headlineFontKey || "").split("@@");
    const weight = Number(w);
    return [family || "Inter, sans-serif", Number.isFinite(weight) ? weight : 700] as const;
  })();
  const [bodyFontFamily, bodyFontWeight] = (() => {
    const [family, w] = String(bodyFontKey || "").split("@@");
    const weight = Number(w);
    return [family || "Inter, sans-serif", Number.isFinite(weight) ? weight : 400] as const;
  })();

  // IMPORTANT: Hooks must be called unconditionally. `workspace` can be null briefly during boot.
  // So we compute stable fallbacks and call the Fabric binding hook regardless.
  const noop = useMemo(() => () => {}, []);
  const fallbackCanvasRef = useMemo(() => ({ current: null as any }), []);
  const fallbackSlideCanvasRefs = useMemo(() => ({ current: [] as Array<{ current: any }> }), []);
  const fallbackLastActiveFabricCanvasRef = useMemo(() => ({ current: null as any }), []);

  const { bindActiveSlideCanvasMobile, bindActiveSlideCanvasDesktop } = useFabricCanvasBinding({
    canvasRef:
      (workspaceRefs ? (workspaceRefs as any).canvasRef : null) || (fallbackCanvasRef as any),
    slideCanvasRefs:
      (workspaceRefs ? (workspaceRefs as any).slideCanvasRefs : null) || (fallbackSlideCanvasRefs as any),
    lastActiveFabricCanvasRef:
      (workspaceRefs ? (workspaceRefs as any).lastActiveFabricCanvasRef : null) || (fallbackLastActiveFabricCanvasRef as any),
    setActiveCanvasNonce:
      (workspaceRefs ? (workspaceRefs as any).setActiveCanvasNonce : null) || (noop as any),
  });

  if (!workspaceUi || !workspaceActions) return null;

  const {
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
  } = workspaceUi;

  const {
    computeTemplateIdForSlide,
    hasImageForActiveSlide,
    deleteImageForActiveSlide,
    setSelectedStickerAsPrimary,
    openImageMenu,
    uploadImageForActiveSlide,
    handleUserImageChange,
    handleUserExtraImageChange,
    onUserTextChangeRegular,
    onUserTextChangeEnhanced,
    onMobileViewportPointerDown,
    onMobileViewportPointerMove,
    onMobileViewportPointerUp,
    onMobileViewportPointerCancel,
    renderActiveSlideControlsRow,
  } = workspaceActions;

  const nav = workspaceNav || null;
  const effectiveSlideCount =
    (nav && Number.isFinite((nav as any).slideCount) ? Number((nav as any).slideCount) : null) ??
    (Array.isArray(slides) ? slides.length : 0);
  const activeSlideIndex =
    (nav && Number.isFinite((nav as any).activeSlideIndex) ? Number((nav as any).activeSlideIndex) : null) ??
    (Number.isFinite(activeSlideIndexStore as any) ? Number(activeSlideIndexStore) : 0);
  const effectiveViewportWidth =
    (nav && Number.isFinite((nav as any).viewportWidth) ? Number((nav as any).viewportWidth) : null) ??
    540;
  const effectiveGoPrev = (nav ? (nav as any).goPrev : null) || (() => {});
  const effectiveGoNext = (nav ? (nav as any).goNext : null) || (() => {});
  const effectiveSwitchToSlide =
    (nav ? (nav as any).switchToSlide : null) ||
    (() => {
      // no-op
    });
  const effectiveTranslateX =
    (nav && Number.isFinite((nav as any).translateX) ? Number((nav as any).translateX) : null) ??
    0;
  const effectiveTotalW =
    (nav && Number.isFinite((nav as any).totalW) ? Number((nav as any).totalW) : null) ??
    0;
  const effectiveViewportPad =
    (nav && Number.isFinite((nav as any).VIEWPORT_PAD) ? Number((nav as any).VIEWPORT_PAD) : null) ??
    0;

  const refs = workspaceRefs || null;
  const effectiveViewportRef = (refs ? (refs as any).viewportRef : null) || null;
  const effectiveImageFileInputRef = (refs ? (refs as any).imageFileInputRef : null) || null;
  const effectiveSlideCanvasRefs = (refs ? (refs as any).slideCanvasRefs : null) || fallbackSlideCanvasRefs;
  const effectiveSlideRefs = (refs ? (refs as any).slideRefs : null) || [];

  const canGoPrev = activeSlideIndex > 0;
  const canGoNext = activeSlideIndex < effectiveSlideCount - 1;

  return (
    <div className="flex flex-col items-center justify-center md:justify-start p-3 md:px-6 md:pb-6 md:pt-8 md:h-[696px]">
      <div className="w-full max-w-[1400px]">
        {/* Hidden file input for per-slide image upload */}
        <input
          ref={effectiveImageFileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            // Reset input so selecting the same file again triggers onChange.
            e.currentTarget.value = "";
            // Close the modal immediately after file selection (upload continues async).
            actions?.onCloseImageLibraryModal?.();
            uploadImageForActiveSlide(f, { bgRemovalEnabledAtInsert: imageLibraryBgRemovalEnabledAtInsert });
          }}
        />

        {/* Image context menu (active slide only) */}
        {imageMenuOpen && imageMenuPos ? (
          <div
            data-image-menu="1"
            className="fixed z-[200] bg-white border border-slate-200 rounded-lg shadow-xl p-2 w-[200px]"
            style={{ left: imageMenuPos.x, top: imageMenuPos.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-50 text-sm text-slate-900 disabled:opacity-50"
              disabled={imageBusy || !(imageMenuInfo?.hasAnySelectedImage || hasImageForActiveSlide())}
              onClick={() => deleteImageForActiveSlide("menu")}
            >
              Remove image
            </button>
            {imageMenuInfo?.canSetAsPrimary ? (
              <button
                type="button"
                className="mt-1 w-full text-left px-3 py-2 rounded-md hover:bg-slate-50 text-sm text-slate-900 disabled:opacity-50"
                disabled={imageBusy}
                onClick={() => setSelectedStickerAsPrimary()}
              >
                Set as primary
              </button>
            ) : null}
          </div>
        ) : null}

        {isMobile ? (
          <div className="w-full">
            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                className="h-10 px-3 rounded-md bg-white border border-slate-200 shadow-sm text-slate-700 disabled:opacity-50"
                aria-label="Previous"
                onClick={effectiveGoPrev}
                disabled={!canGoPrev || switchingSlides}
              >
                ←
              </button>
              <div className="text-sm font-semibold text-slate-700">
                Slide {activeSlideIndex + 1} / {effectiveSlideCount}
              </div>
              <button
                className="h-10 px-3 rounded-md bg-white border border-slate-200 shadow-sm text-slate-700 disabled:opacity-50"
                aria-label="Next"
                onClick={effectiveGoNext}
                disabled={!canGoNext || switchingSlides}
              >
                →
              </button>
            </div>

            <div
              ref={effectiveViewportRef}
              className="w-full flex items-center justify-center"
              onPointerDown={onMobileViewportPointerDown as any}
              onPointerMove={onMobileViewportPointerMove as any}
              onPointerUp={onMobileViewportPointerUp as any}
              onPointerCancel={onMobileViewportPointerCancel as any}
            >
              {(() => {
                const i = activeSlideIndex;
                const tid = computeTemplateIdForSlide(i);
                const snap = (tid ? templateSnapshots[tid] : null) || null;
                const layoutForThisCard = layoutData?.layout ? (layoutData.layout as any) : EMPTY_LAYOUT;

                // Prefer slice-owned viewport width when available.
                const vw = effectiveViewportWidth;
                const maxW = Math.max(240, Math.min(540, (vw || 540) - 24));
                const scale = Math.max(0.35, Math.min(1, maxW / 540));
                const displayW = Math.round(maxW);
                const displayH = Math.round(720 * scale);

                return (
                  <div style={{ width: displayW, height: displayH, overflow: "hidden" }}>
                    {!tid ? (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                        No template selected
                      </div>
                    ) : !snap ? (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                        Loading template…
                      </div>
                    ) : (
                      <CarouselPreviewVision
                        ref={(node: any) => {
                          bindActiveSlideCanvasMobile(i)(node);
                        }}
                        templateId={tid}
                        slideIndex={i}
                        layout={layoutForThisCard}
                        backgroundColor={projectBackgroundColor}
                        textColor={projectTextColor}
                        backgroundEffectEnabled={projectBackgroundEffectEnabled}
                        backgroundEffectType={projectBackgroundEffectType}
                        templateSnapshot={snap}
                        hasHeadline={templateTypeId !== "regular"}
                        tightUserTextWidth={templateTypeId !== "regular"}
                        onDebugLog={templateTypeId !== "regular" ? addLog : undefined}
                        showLayoutOverlays={showLayoutOverlays}
                        headlineFontFamily={headlineFontFamily}
                        bodyFontFamily={bodyFontFamily}
                        headlineFontWeight={headlineFontWeight}
                        bodyFontWeight={bodyFontWeight}
                        // Regular should use the same safe-area inset as the teal overlay (40px).
                        contentPaddingPx={40}
                        clampUserTextToContentRect={true}
                        clampUserImageToContentRect={false}
                        pushTextOutOfUserImage={templateTypeId !== "regular"}
                        lockTextLayout={templateTypeId === "enhanced" ? !!slides[i]?.layoutLocked : false}
                        displayWidthPx={displayW}
                        displayHeightPx={displayH}
                        onUserTextChange={templateTypeId === "regular" ? onUserTextChangeRegular : onUserTextChangeEnhanced}
                        onUserImageChange={handleUserImageChange}
                        onUserExtraImageChange={handleUserExtraImageChange}
                        onOpenImageMenu={openImageMenu}
                      />
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Hidden render of non-active slides so Download/Share All can export them on mobile. */}
            <div style={{ position: "absolute", left: -100000, top: -100000, width: 1, height: 1, overflow: "hidden" }}>
              {Array.from({ length: effectiveSlideCount }).map((_, i) => {
                if (i === activeSlideIndex) return null;
                const tid = computeTemplateIdForSlide(i);
                const snap = (tid ? templateSnapshots[tid] : null) || null;
                const layoutForThisCard = slides[i]?.layoutData?.layout ? (slides[i].layoutData.layout as any) : EMPTY_LAYOUT;
                if (!tid || !snap) return null;
                return (
                  <CarouselPreviewVision
                    key={i}
                    ref={(effectiveSlideCanvasRefs as any).current?.[i] as any}
                    templateId={tid}
                    slideIndex={i}
                    layout={layoutForThisCard}
                    backgroundColor={projectBackgroundColor}
                    textColor={projectTextColor}
                    backgroundEffectEnabled={projectBackgroundEffectEnabled}
                    backgroundEffectType={projectBackgroundEffectType}
                    templateSnapshot={snap}
                    hasHeadline={templateTypeId !== "regular"}
                    tightUserTextWidth={templateTypeId !== "regular"}
                    showLayoutOverlays={showLayoutOverlays}
                    headlineFontFamily={headlineFontFamily}
                    bodyFontFamily={bodyFontFamily}
                    headlineFontWeight={headlineFontWeight}
                    bodyFontWeight={bodyFontWeight}
                    contentPaddingPx={40}
                    clampUserTextToContentRect={true}
                    clampUserImageToContentRect={false}
                    pushTextOutOfUserImage={templateTypeId !== "regular"}
                    lockTextLayout={templateTypeId === "enhanced" ? !!slides[i]?.layoutLocked : false}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center gap-3 min-h-[648px]">
            <button
              className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700"
              aria-label="Previous"
                onClick={effectiveGoPrev}
              disabled={!canGoPrev || switchingSlides}
            >
              ←
            </button>
            <div
              ref={effectiveViewportRef}
              className="flex-1 overflow-x-hidden overflow-y-hidden pb-10"
                style={{ paddingLeft: effectiveViewportPad, paddingRight: effectiveViewportPad }}
            >
              <div
                className="flex items-center gap-6 px-2 py-6"
                style={{
                    transform: `translateX(${effectiveTranslateX}px)`,
                  transition: "transform 300ms ease",
                    width: effectiveTotalW,
                }}
              >
                {Array.from({ length: effectiveSlideCount }).map((_, i) => (
                  <div
                    key={i}
                    ref={(node) => {
                      const r = (effectiveSlideRefs as any)?.[i];
                      if (r) r.current = node;
                    }}
                    className="relative"
                    role="button"
                    tabIndex={0}
                    aria-label={`Select slide ${i + 1}`}
                    onClick={() => {
                      if (i === activeSlideIndex) return;
                      if (switchingSlides || copyGenerating) return;
                      void effectiveSwitchToSlide(i);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      if (i === activeSlideIndex) return;
                      if (switchingSlides || copyGenerating) return;
                      void effectiveSwitchToSlide(i);
                    }}
                  >
                    {/* Per-slide controls under the active slide (active slide only). */}
                    {i === activeSlideIndex ? renderActiveSlideControlsRow() : null}

                    <SlideCard index={i + 1} active={i === activeSlideIndex}>
                      <div
                        className="w-full h-full flex flex-col items-center justify-start"
                        style={i === activeSlideIndex ? undefined : { pointerEvents: "none" }}
                      >
                        {/* Render at 420x560 without CSS transforms (Fabric hit-testing depends on it). */}
                        <div style={{ width: 420, height: 560, overflow: "hidden" }}>
                          {(() => {
                            const tid = computeTemplateIdForSlide(i);
                            const snap = (tid ? templateSnapshots[tid] : null) || null;
                            const layoutForThisCard =
                              i === activeSlideIndex
                                ? (layoutData?.layout ? (layoutData.layout as any) : EMPTY_LAYOUT)
                                : (slides[i]?.layoutData?.layout ? (slides[i].layoutData.layout as any) : EMPTY_LAYOUT);

                            if (!tid) {
                              return (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                                  No template selected
                                </div>
                              );
                            }
                            if (!snap) {
                              return (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                                  Loading template…
                                </div>
                              );
                            }

                            const refProp =
                              i === activeSlideIndex
                                ? bindActiveSlideCanvasDesktop(i)
                                : (effectiveSlideCanvasRefs as any).current?.[i];

                            return (
                              <CarouselPreviewVision
                                ref={refProp as any}
                                templateId={tid}
                                slideIndex={i}
                                layout={layoutForThisCard}
                                backgroundColor={projectBackgroundColor}
                                textColor={projectTextColor}
                                backgroundEffectEnabled={projectBackgroundEffectEnabled}
                                backgroundEffectType={projectBackgroundEffectType}
                                templateSnapshot={snap}
                                hasHeadline={templateTypeId !== "regular"}
                                tightUserTextWidth={templateTypeId !== "regular"}
                                onDebugLog={templateTypeId !== "regular" ? addLog : undefined}
                                showLayoutOverlays={showLayoutOverlays}
                                headlineFontFamily={headlineFontFamily}
                                bodyFontFamily={bodyFontFamily}
                                headlineFontWeight={headlineFontWeight}
                                bodyFontWeight={bodyFontWeight}
                                contentPaddingPx={40}
                                clampUserTextToContentRect={true}
                                clampUserImageToContentRect={false}
                                pushTextOutOfUserImage={templateTypeId !== "regular"}
                                lockTextLayout={templateTypeId === "enhanced" ? !!slides[i]?.layoutLocked : false}
                                suppressTextInvariantsWhileDraggingUserImage={
                                  templateTypeId === "enhanced"
                                    ? (!!slides[i]?.autoRealignOnImageRelease && !slides[i]?.layoutLocked)
                                    : false
                                }
                                displayWidthPx={420}
                                displayHeightPx={560}
                                onUserTextChange={
                                  i === activeSlideIndex
                                    ? (templateTypeId === "regular" ? onUserTextChangeRegular : onUserTextChangeEnhanced)
                                    : undefined
                                }
                                onUserImageChange={i === activeSlideIndex ? handleUserImageChange : undefined}
                                onUserExtraImageChange={i === activeSlideIndex ? handleUserExtraImageChange : undefined}
                                onOpenImageMenu={i === activeSlideIndex ? openImageMenu : undefined}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    </SlideCard>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700"
              aria-label="Next"
              onClick={effectiveGoNext}
              disabled={!canGoNext || switchingSlides}
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

