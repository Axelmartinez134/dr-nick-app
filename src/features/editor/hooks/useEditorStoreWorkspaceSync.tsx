import { useLayoutEffect } from "react";

type Args = {
  editorStore: any;

  // Values used by CopyProgressIcon
  copyProgressState: "idle" | "running" | "success" | "error";
  copyProgressLabel: string;

  // Workspace gestures / refs / helpers
  isMobile: boolean;
  mobileDrawerOpen: boolean;
  switchingSlides: boolean;
  copyGenerating: boolean;
  isEditableTarget: (el: any) => boolean;
  mobileGestureRef: any;
  switchToSlide: (index: number) => Promise<void> | void;
  activeSlideIndex: number;

  currentProjectId: string | null;
  activeSlideIndexRef: any;
  slidesRef: any;
  initSlide: () => any;
  inputData: any;
  layoutData: any;
  setSlides: any;
  setInputData: (next: any) => void;
  schedulePersistLayoutAndInput: (args: any) => void;
  liveLayoutKey: (projectId: string, slideIndex: number) => string;
  liveLayoutTimeoutsRef: any;
  liveLayoutQueueRef: any;
  liveLayoutRunIdByKeyRef: any;
  withLayoutLockedInInput: (base: any, locked: boolean) => any;
  withAutoRealignOnImageReleaseInInput: (base: any, enabled: boolean) => any;
  saveSlidePatchForProject: (projectId: string, slideIndex: number, patch: any) => Promise<any> | any;
  scheduleLiveLayout: (slideIndex: number) => void;

  // Image menu / upload
  imageBusy: boolean;
  imageFileInputRef: any;
  openImageMenu: (x: number, y: number) => void;
  imageLongPressRef: any;
  activeImageSelected: boolean;
  hasImageForActiveSlide: () => boolean;
  imageMenuOpen: boolean;
  imageMenuPos: any;
  deleteImageForActiveSlide: (source: "menu" | "button") => Promise<void> | void;
  uploadImageForActiveSlide: (file: File) => Promise<void> | void;
  handleUserImageChange: (e: any) => void;

  // Canvas inline styling pills
  canvasTextSelection: any;
  applyCanvasInlineMark: (mark: "bold" | "italic" | "underline", enabled: boolean) => void;
  clearCanvasInlineMarks: () => void;

  // Store top-level fields
  titleText: string;
  projectTitle: string;
  topExporting: boolean;
  saveStatus: any;
  promptSaveStatus: any;
  projectSaveStatus: any;
  slideSaveStatus: any;
  templateTypeId: "regular" | "enhanced";
  newProjectTemplateTypeId: "regular" | "enhanced";
  loading: boolean;
  templateTypePrompt: string;
  templateTypeEmphasisPrompt: string;
  templateTypeImageGenPrompt: string;
  templateSettingsOpen: boolean;
  promptModalOpen: boolean;
  promptModalSection: any;
  templateTypeMappingSlide1: string | null;
  templateTypeMappingSlide2to5: string | null;
  templateTypeMappingSlide6: string | null;
  loadingTemplates: boolean;
  templates: any[];
  FONT_OPTIONS: any;
  headlineFontFamily: string;
  headlineFontWeight: number;
  bodyFontFamily: string;
  bodyFontWeight: number;
  fontKey: (family: string, weight: number) => string;
  projectBackgroundColor: string;
  projectTextColor: string;
  projects: any[];
  projectsLoading: boolean;
  projectsDropdownOpen: boolean;
  archiveProjectModalOpen: boolean;
  archiveProjectTarget: any;
  archiveProjectBusy: boolean;

  // Workspace slice values
  slideCount: number;
  viewportWidth: number;
  goPrev: () => void;
  goNext: () => void;
  viewportRef: any;
  slideCanvasRefs: any;
  slideRefs: any;
  canvasRef: any;
  lastActiveFabricCanvasRef: any;
  setActiveCanvasNonce: (x: number) => void;
  CarouselPreviewVision: any;
  SlideCard: any;
  templateSnapshots: any;
  computeTemplateIdForSlide: (slideIndex: number) => string | null;
  EMPTY_LAYOUT: any;
  slides: any[];
  showLayoutOverlays: boolean;
  addLog: (msg: string) => void;
  VIEWPORT_PAD: number;
  translateX: number;
  totalW: number;
  handleRegularCanvasTextChange: (next: any) => void;
  handleEnhancedCanvasTextChange: (next: any) => void;

  // Bottom panel slice values + helpers
  enhancedLockOn: boolean;
  layoutHistory: any[];
  pushUndoSnapshot: () => void;
  currentProjectIdRef: any;
  enqueueLiveLayoutForProject: (projectId: string, indices: number[]) => void;
  rangesEqual: (a: any[], b: any[]) => boolean;
  isPunctuationOnlyChange: (prev: string, next: string) => boolean;
  wrapBlockIntoExistingLinesNoMove: (args: any) => any;
  applyInlineStylesToExistingLayout: (args: any) => any;
  setLayoutData: (next: any) => void;
  scheduleDebouncedCaptionSave: (args: { projectId: string | null; caption: string; debounceMs: number }) => void;
  captionDraft: string;
  captionCopyStatus: "idle" | "copied" | "error";
  setCaptionDraft: (next: string) => void;
  setCaptionCopyStatus: (next: "idle" | "copied" | "error") => void;
  copyToClipboard: (text: string) => Promise<boolean>;
  aiImagePromptSaveStatus: any;
  imagePromptGenerating: boolean;
  imagePromptError: any;
  runGenerateImagePrompts: (slideIndex: number) => Promise<void> | void;
  runGenerateAiImage: () => Promise<void> | void;
  aiImageGeneratingThis: boolean;
  aiImageProgressThis: number | null;
  aiImageStatusThis: any;
  aiImageErrorThis: any;
  runGenerateCopy: () => Promise<void> | void;
  copyError: any;
  saveError: any;
  error: any;
  handleRetry: () => void;
  layoutDirtyRef: any;
  handleUndo: () => void;
  setShowLayoutOverlays: (next: boolean) => void;
  debugScreenshot: any;
  showDebugPreview: boolean;
  setShowDebugPreview: (next: boolean) => void;
  debugLogs: any[];
  aiKey: (projectId: string, slideIndex: number) => string;
  bgRemovalBusyKeys: any;
  setActiveSlideImageBgRemoval: (nextEnabled: boolean) => Promise<void> | void;
  realigning: boolean;
  runRealignTextForActiveSlide: (opts: { pushHistory: boolean }) => void;
};

export function useEditorStoreWorkspaceSync(args: any) {
  const {
    editorStore,
    copyProgressState,
    copyProgressLabel,
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
    scheduleLiveLayout,
    imageBusy,
    imageFileInputRef,
    openImageMenu,
    imageLongPressRef,
    activeImageSelected,
    hasImageForActiveSlide,
    imageMenuOpen,
    imageMenuPos,
    deleteImageForActiveSlide,
    uploadImageForActiveSlide,
    handleUserImageChange,
    canvasTextSelection,
    applyCanvasInlineMark,
    clearCanvasInlineMarks,
    titleText,
    projectTitle,
    topExporting,
    saveStatus,
    promptSaveStatus,
    projectSaveStatus,
    slideSaveStatus,
    templateTypeId,
    newProjectTemplateTypeId,
    loading,
    templateTypePrompt,
    templateTypeEmphasisPrompt,
    templateTypeImageGenPrompt,
    templateSettingsOpen,
    promptModalOpen,
    promptModalSection,
    templateTypeMappingSlide1,
    templateTypeMappingSlide2to5,
    templateTypeMappingSlide6,
    loadingTemplates,
    templates,
    FONT_OPTIONS,
    headlineFontFamily,
    headlineFontWeight,
    bodyFontFamily,
    bodyFontWeight,
    fontKey,
    projectBackgroundColor,
    projectTextColor,
    projects,
    projectsLoading,
    projectsDropdownOpen,
    archiveProjectModalOpen,
    archiveProjectTarget,
    archiveProjectBusy,
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
    VIEWPORT_PAD,
    translateX,
    totalW,
    handleRegularCanvasTextChange,
    handleEnhancedCanvasTextChange,
    enhancedLockOn,
    layoutHistory,
    pushUndoSnapshot,
    currentProjectIdRef,
    enqueueLiveLayoutForProject,
    rangesEqual,
    isPunctuationOnlyChange,
    wrapBlockIntoExistingLinesNoMove,
    applyInlineStylesToExistingLayout,
    setLayoutData,
    scheduleDebouncedCaptionSave,
    captionDraft,
    captionCopyStatus,
    setCaptionDraft,
    setCaptionCopyStatus,
    copyToClipboard,
    aiImagePromptSaveStatus,
    imagePromptGenerating,
    imagePromptError,
    runGenerateImagePrompts,
    runGenerateAiImage,
    aiImageGeneratingThis,
    aiImageProgressThis,
    aiImageStatusThis,
    aiImageErrorThis,
    runGenerateCopy,
    copyError,
    saveError,
    error,
    handleRetry,
    layoutDirtyRef,
    handleUndo,
    setShowLayoutOverlays,
    debugScreenshot,
    showDebugPreview,
    setShowDebugPreview,
    debugLogs,
    aiKey,
    bgRemovalBusyKeys,
    setActiveSlideImageBgRemoval,
    realigning,
    runRealignTextForActiveSlide,
  } = args as Args;

  const CopyProgressIcon = () => {
    if (copyProgressState === "idle") return null;
    const title =
      copyProgressState === "running"
        ? (copyProgressLabel || "Working…")
        : copyProgressState === "success"
          ? "Done"
          : "Error";
    if (copyProgressState === "running") {
      return (
        <span className="inline-flex items-center gap-2" title={title} aria-label={title}>
          <span className="inline-flex items-center justify-center w-4 h-4">
            <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
          </span>
          <span className="text-xs font-medium text-slate-500">{title}</span>
        </span>
      );
    }
    if (copyProgressState === "success") {
      return (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] leading-none"
          title={title}
          aria-label={title}
        >
          ✓
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white text-[10px] leading-none"
        title={title}
        aria-label={title}
      >
        !
      </span>
    );
  };

  useLayoutEffect(() => {
    // Phase 2C: provide workspace bindings (slides strip/canvas row) to the store
    // so `EditorSlidesRow` can read them without prop drilling.
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
            !currentProjectId
              ? "Create or load a project to upload an image"
              : imageBusy
                ? "Working…"
                : "Upload image"
          }
          aria-label="Upload image"
          disabled={!currentProjectId || imageBusy || switchingSlides || copyGenerating}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            imageFileInputRef.current?.click();
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
                  arr.map((s: any, ii: number) =>
                    ii !== slideIndex ? s : ({ ...s, layoutLocked: nextLocked, inputData: nextInput } as any)
                  )
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

    editorStore.setState({
      titleText,
      projectTitle,
      projectTitleDisabled: switchingSlides,
      isMobile,
      topExporting,
      engineSaveStatus: saveStatus as any,
      promptSaveStatus,
      projectSaveStatus,
      slideSaveStatus,
      currentProjectId,
      templateTypeId,
      newProjectTemplateTypeId,
      switchingSlides,
      loading,
      templateTypePromptPreviewLine: (templateTypePrompt || "").split("\n")[0] || "",
      templateTypeEmphasisPromptPreviewLine: (templateTypeEmphasisPrompt || "").split("\n")[0] || "",
      templateTypeImageGenPromptPreviewLine: (templateTypeImageGenPrompt || "").split("\n")[0] || "",
      templateSettingsOpen,
      promptModalOpen,
      promptModalSection,
      templateTypePrompt,
      templateTypeEmphasisPrompt,
      templateTypeImageGenPrompt,
      templateTypeMappingSlide1,
      templateTypeMappingSlide2to5,
      templateTypeMappingSlide6,
      loadingTemplates,
      templates: (Array.isArray(templates) ? templates : []).map((t: any) => ({ id: String(t?.id || ""), name: String(t?.name || "") })),
      fontOptions: FONT_OPTIONS,
      headlineFontKey: fontKey(headlineFontFamily, headlineFontWeight),
      bodyFontKey: fontKey(bodyFontFamily, bodyFontWeight),
      projectBackgroundColor,
      projectTextColor,
      projects,
      projectsLoading,
      projectsDropdownOpen,
      archiveProjectModalOpen,
      archiveProjectTarget,
      archiveProjectBusy,
      workspace: {
        slideCount,
        activeSlideIndex,
        copyGenerating,
        viewportWidth,
        goPrev,
        goNext,
        switchToSlide,
        viewportRef,
        imageFileInputRef,
        slideCanvasRefs,
        slideRefs,
        canvasRef,
        lastActiveFabricCanvasRef,
        setActiveCanvasNonce,
        CarouselPreviewVision,
        SlideCard,
        templateSnapshots,
        computeTemplateIdForSlide,
        layoutData,
        EMPTY_LAYOUT,
        slides,
        showLayoutOverlays,
        addLog,
        VIEWPORT_PAD,
        translateX,
        totalW,
        imageMenuOpen,
        imageMenuPos,
        imageBusy,
        hasImageForActiveSlide,
        deleteImageForActiveSlide: (source: "menu" | "button") => void deleteImageForActiveSlide(source),
        uploadImageForActiveSlide: (file: File) => void uploadImageForActiveSlide(file),
        handleUserImageChange,
        onUserTextChangeRegular: handleRegularCanvasTextChange,
        onUserTextChangeEnhanced: handleEnhancedCanvasTextChange,
        onMobileViewportPointerDown: mobilePointerDown,
        onMobileViewportPointerMove: mobilePointerMove,
        onMobileViewportPointerUp: mobilePointerUp,
        onMobileViewportPointerCancel: mobilePointerCancel,
        renderActiveSlideControlsRow,
      },
      bottomPanel: {
        activeSlideIndex,
        slideCount,
        currentProjectId,
        loading,
        switchingSlides,
        copyGenerating,
        enhancedLockOn,
        slides,
        layoutData,
        inputData,
        layoutHistoryLength: layoutHistory.length,
        showLayoutOverlays,
        addLog,

        onChangeHeadlineFontSize: (e: any) => {
          const raw = Number((e.target as any).value);
          const nextSize = Number.isFinite(raw) ? Math.max(24, Math.min(120, Math.round(raw))) : 76;
          pushUndoSnapshot();
          setSlides((prev: any) =>
            prev.map((s: any, i: number) =>
              i !== activeSlideIndex
                ? s
                : ({
                    ...s,
                    draftHeadlineFontSizePx: nextSize,
                    inputData:
                      s.inputData && typeof s.inputData === "object"
                        ? { ...(s.inputData as any), headlineFontSizePx: nextSize }
                        : s.inputData,
                  } as any)
            )
          );
          slidesRef.current = slidesRef.current.map((s: any, i: number) =>
            i !== activeSlideIndex
              ? s
              : ({
                  ...s,
                  draftHeadlineFontSizePx: nextSize,
                  inputData:
                    (s as any).inputData && typeof (s as any).inputData === "object"
                      ? { ...((s as any).inputData as any), headlineFontSizePx: nextSize }
                      : (s as any).inputData,
                } as any)
          );
          if (!enhancedLockOn) scheduleLiveLayout(activeSlideIndex);
        },
        onClickHeadlineAlign: (a: "left" | "center" | "right") => {
          const nextAlign = a;
          pushUndoSnapshot();
          setSlides((prev: any) =>
            prev.map((s: any, i: number) =>
              i !== activeSlideIndex
                ? s
                : ({
                    ...s,
                    draftHeadlineTextAlign: nextAlign,
                    inputData:
                      s.inputData && typeof s.inputData === "object"
                        ? { ...(s.inputData as any), headlineTextAlign: nextAlign }
                        : s.inputData,
                  } as any)
            )
          );
          slidesRef.current = slidesRef.current.map((s: any, i: number) =>
            i !== activeSlideIndex
              ? s
              : ({
                  ...s,
                  draftHeadlineTextAlign: nextAlign,
                  inputData:
                    (s as any).inputData && typeof (s as any).inputData === "object"
                      ? { ...((s as any).inputData as any), headlineTextAlign: nextAlign }
                      : (s as any).inputData,
                } as any)
          );
          if (!enhancedLockOn && currentProjectId && !(slidesRef.current[activeSlideIndex] as any)?.layoutLocked) {
            enqueueLiveLayoutForProject(currentProjectId, [activeSlideIndex]);
          }
        },
        onChangeHeadlineRichText: (next: any) => {
          try {
            const nowProj = currentProjectIdRef.current || "none";
            const nowSlide = activeSlideIndexRef.current + 1;
            const srcProj = currentProjectId || "none";
            const srcSlide = activeSlideIndex + 1;
            if (nowProj !== srcProj || nowSlide !== srcSlide) {
              addLog(
                `🚨 RTE MISMATCH headline: src proj=${srcProj} slide=${srcSlide} -> now proj=${nowProj} slide=${nowSlide} (len=${String(next.text || "").length})`
              );
            }
          } catch {
            // ignore
          }
          const slideIndexNow = activeSlideIndexRef.current;
          const cur = slidesRef.current[slideIndexNow] || initSlide();
          const prevText = String(cur.draftHeadline || "");
          const prevRanges = Array.isArray(cur.draftHeadlineRanges) ? cur.draftHeadlineRanges : [];
          const nextText = String(next.text || "");
          const nextRanges = Array.isArray(next.ranges) ? next.ranges : [];
          const isFormattingOnly = nextText === prevText && !rangesEqual(prevRanges, nextRanges);
          const isPuncOnly = nextText !== prevText && isPunctuationOnlyChange(prevText, nextText);
          const locked = templateTypeId === "enhanced" ? !!cur.layoutLocked : false;

          setSlides((prev: any) =>
            prev.map((s: any, i: number) => (i === slideIndexNow ? { ...s, draftHeadline: nextText, draftHeadlineRanges: nextRanges } : s))
          );
          slidesRef.current = slidesRef.current.map((s: any, i: number) =>
            i === slideIndexNow ? ({ ...s, draftHeadline: nextText, draftHeadlineRanges: nextRanges } as any) : s
          );

          if (templateTypeId === "enhanced" && (locked || isFormattingOnly || isPuncOnly)) {
            const baseSlide = slidesRef.current[slideIndexNow] || initSlide();
            const baseLayout =
              (slideIndexNow === activeSlideIndexRef.current ? (layoutData as any)?.layout : null) ||
              (baseSlide as any)?.layoutData?.layout ||
              null;
            const baseInput =
              (slideIndexNow === activeSlideIndexRef.current ? (inputData as any) : null) || (baseSlide as any)?.inputData || null;
            if (baseLayout) {
              const headlineRanges = nextRanges;
              const bodyRanges = Array.isArray(baseSlide.draftBodyRanges) ? baseSlide.draftBodyRanges : [];
              const updatedInput = withLayoutLockedInInput(
                {
                  ...(baseInput && typeof baseInput === "object" ? baseInput : {}),
                  headline: nextText,
                  headlineStyleRanges: headlineRanges,
                  bodyStyleRanges: bodyRanges,
                },
                locked
              );

              let nextLayout = baseLayout;
              if (locked || isPuncOnly) {
                const wrapped = wrapBlockIntoExistingLinesNoMove({
                  layout: baseLayout,
                  block: "HEADLINE",
                  text: nextText,
                  ranges: headlineRanges,
                });
                nextLayout = wrapped.layout;
              } else {
                const applied = applyInlineStylesToExistingLayout({
                  layout: baseLayout,
                  headlineRanges,
                  bodyRanges,
                });
                nextLayout = applied.layout;
              }

              const nextLayoutData = { success: true, layout: nextLayout, imageUrl: (layoutData as any)?.imageUrl || null } as any;
              setSlides((prev: any) =>
                prev.map((s: any, i: number) =>
                  i !== slideIndexNow ? s : ({ ...s, layoutData: nextLayoutData, inputData: updatedInput } as any)
                )
              );
              slidesRef.current = slidesRef.current.map((s: any, i: number) =>
                i !== slideIndexNow ? s : ({ ...s, layoutData: nextLayoutData, inputData: updatedInput } as any)
              );
              if (slideIndexNow === activeSlideIndexRef.current) {
                setLayoutData(nextLayoutData);
                setInputData(updatedInput as any);
              }
              schedulePersistLayoutAndInput({
                projectId: currentProjectIdRef.current,
                slideIndex: slideIndexNow,
                layoutSnapshot: nextLayout,
                inputSnapshot: updatedInput,
              });
              return;
            }
          }
          scheduleLiveLayout(slideIndexNow);
        },

        onChangeBodyFontSize: (e: any) => {
          const raw = Number((e.target as any).value);
          const nextSize = Number.isFinite(raw) ? Math.max(24, Math.min(120, Math.round(raw))) : 48;
          pushUndoSnapshot();
          setSlides((prev: any) =>
            prev.map((s: any, i: number) =>
              i !== activeSlideIndex
                ? s
                : ({
                    ...s,
                    draftBodyFontSizePx: nextSize,
                    inputData:
                      s.inputData && typeof s.inputData === "object"
                        ? { ...(s.inputData as any), bodyFontSizePx: nextSize }
                        : s.inputData,
                  } as any)
            )
          );
          slidesRef.current = slidesRef.current.map((s: any, i: number) =>
            i !== activeSlideIndex
              ? s
              : ({
                  ...s,
                  draftBodyFontSizePx: nextSize,
                  inputData:
                    (s as any).inputData && typeof (s as any).inputData === "object"
                      ? { ...((s as any).inputData as any), bodyFontSizePx: nextSize }
                      : (s as any).inputData,
                } as any)
          );
          if (!enhancedLockOn) scheduleLiveLayout(activeSlideIndex);
        },
        onClickBodyAlign: (a: "left" | "center" | "right") => {
          const nextAlign = a;
          pushUndoSnapshot();
          setSlides((prev: any) =>
            prev.map((s: any, i: number) =>
              i !== activeSlideIndex
                ? s
                : ({
                    ...s,
                    draftBodyTextAlign: nextAlign,
                    inputData:
                      s.inputData && typeof s.inputData === "object"
                        ? { ...(s.inputData as any), bodyTextAlign: nextAlign }
                        : s.inputData,
                  } as any)
            )
          );
          slidesRef.current = slidesRef.current.map((s: any, i: number) =>
            i !== activeSlideIndex
              ? s
              : ({
                  ...s,
                  draftBodyTextAlign: nextAlign,
                  inputData:
                    (s as any).inputData && typeof (s as any).inputData === "object"
                      ? { ...((s as any).inputData as any), bodyTextAlign: nextAlign }
                      : (s as any).inputData,
                } as any)
          );
          if (!enhancedLockOn && currentProjectId && !(slidesRef.current[activeSlideIndex] as any)?.layoutLocked) {
            enqueueLiveLayoutForProject(currentProjectId, [activeSlideIndex]);
          }
        },
        onChangeBodyRichText: (next: any) => {
          try {
            const nowProj = currentProjectIdRef.current || "none";
            const nowSlide = activeSlideIndexRef.current + 1;
            const srcProj = currentProjectId || "none";
            const srcSlide = activeSlideIndex + 1;
            if (nowProj !== srcProj || nowSlide !== srcSlide) {
              addLog(
                `🚨 RTE MISMATCH body: src proj=${srcProj} slide=${srcSlide} -> now proj=${nowProj} slide=${nowSlide} (len=${String(next.text || "").length})`
              );
            }
          } catch {
            // ignore
          }
          const slideIndexNow = activeSlideIndexRef.current;
          const cur = slidesRef.current[slideIndexNow] || initSlide();
          const prevText = String(cur.draftBody || "");
          const prevRanges = Array.isArray(cur.draftBodyRanges) ? cur.draftBodyRanges : [];
          const nextText = String(next.text || "");
          const nextRanges = Array.isArray(next.ranges) ? next.ranges : [];
          const isFormattingOnly = nextText === prevText && !rangesEqual(prevRanges, nextRanges);
          const isPuncOnly = nextText !== prevText && isPunctuationOnlyChange(prevText, nextText);
          const locked = templateTypeId === "enhanced" ? !!cur.layoutLocked : false;

          setSlides((prev: any) =>
            prev.map((s: any, i: number) => (i === slideIndexNow ? { ...s, draftBody: nextText, draftBodyRanges: nextRanges } : s))
          );
          slidesRef.current = slidesRef.current.map((s: any, i: number) =>
            i === slideIndexNow ? ({ ...s, draftBody: nextText, draftBodyRanges: nextRanges } as any) : s
          );

          if (templateTypeId === "enhanced" && (locked || isFormattingOnly || isPuncOnly)) {
            const baseSlide = slidesRef.current[slideIndexNow] || initSlide();
            const baseLayout =
              (slideIndexNow === activeSlideIndexRef.current ? (layoutData as any)?.layout : null) ||
              (baseSlide as any)?.layoutData?.layout ||
              null;
            const baseInput =
              (slideIndexNow === activeSlideIndexRef.current ? (inputData as any) : null) || (baseSlide as any)?.inputData || null;
            if (baseLayout) {
              const headlineRanges = Array.isArray(baseSlide.draftHeadlineRanges) ? baseSlide.draftHeadlineRanges : [];
              const bodyRanges = nextRanges;
              const updatedInput = withLayoutLockedInInput(
                {
                  ...(baseInput && typeof baseInput === "object" ? baseInput : {}),
                  body: nextText,
                  headlineStyleRanges: headlineRanges,
                  bodyStyleRanges: bodyRanges,
                },
                locked
              );

              let nextLayout = baseLayout;
              if (locked || isPuncOnly) {
                const wrapped = wrapBlockIntoExistingLinesNoMove({
                  layout: baseLayout,
                  block: "BODY",
                  text: nextText,
                  ranges: bodyRanges,
                });
                nextLayout = wrapped.layout;
              } else {
                const applied = applyInlineStylesToExistingLayout({
                  layout: baseLayout,
                  headlineRanges,
                  bodyRanges,
                });
                nextLayout = applied.layout;
              }

              const nextLayoutData = { success: true, layout: nextLayout, imageUrl: (layoutData as any)?.imageUrl || null } as any;
              setSlides((prev: any) =>
                prev.map((s: any, i: number) =>
                  i !== slideIndexNow ? s : ({ ...s, layoutData: nextLayoutData, inputData: updatedInput } as any)
                )
              );
              slidesRef.current = slidesRef.current.map((s: any, i: number) =>
                i !== slideIndexNow ? s : ({ ...s, layoutData: nextLayoutData, inputData: updatedInput } as any)
              );
              if (slideIndexNow === activeSlideIndexRef.current) {
                setLayoutData(nextLayoutData);
                setInputData(updatedInput as any);
              }
              schedulePersistLayoutAndInput({
                projectId: currentProjectIdRef.current,
                slideIndex: slideIndexNow,
                layoutSnapshot: nextLayout,
                inputSnapshot: updatedInput,
              });
              return;
            }
          }
          scheduleLiveLayout(slideIndexNow);
        },

        aiImagePromptSaveStatus,
        imagePromptGenerating,
        imagePromptError,
        onClickRegenerateImagePrompt: () => void runGenerateImagePrompts(activeSlideIndex),
        onChangeAiImagePrompt: (newValue: string) => {
          setSlides((prev: any) => prev.map((s: any, i: number) => (i === activeSlideIndex ? { ...s, draftAiImagePrompt: newValue } : s)));
        },
        onClickGenerateAiImage: () => void runGenerateAiImage(),
        aiImageGeneratingThis,
        aiImageProgressThis: aiImageProgressThis || 0,
        aiImageStatusThis,
        aiImageErrorThis,

        copyProgressIcon: <CopyProgressIcon />,
        onClickGenerateCopy: () => void runGenerateCopy(),
        copyError,
        saveError: saveError || null,
        error: error || null,
        onClickRetry: () => void handleRetry(),

        activeImageSelected,
        imageBusy,
        aiKey,
        bgRemovalBusyKeys,
        setActiveSlideImageBgRemoval: (nextEnabled: boolean) => void setActiveSlideImageBgRemoval(nextEnabled),
        deleteImageForActiveSlide: (source: "menu" | "button") => void deleteImageForActiveSlide(source),

        realigning,
        onClickRealignText: () => runRealignTextForActiveSlide({ pushHistory: true }),
        onClickUndo: () => {
          layoutDirtyRef.current = true;
          handleUndo();
        },
        onClickToggleOverlays: () => {
          const next = !showLayoutOverlays;
          setShowLayoutOverlays(next);
          try {
            addLog(`🧩 Overlays: ${next ? "ON" : "OFF"}`);
          } catch {
            // ignore
          }
        },

        captionDraft: captionDraft || "",
        captionCopyStatus,
        onClickCopyCaption: async () => {
          const ok = await copyToClipboard(captionDraft || "");
          setCaptionCopyStatus(ok ? "copied" : "error");
          window.setTimeout(() => setCaptionCopyStatus("idle"), 1200);
        },
        onChangeCaption: (v: string) => {
          setCaptionDraft(v);
          // Keep store in sync immediately so the textarea caret doesn't jump.
          editorStore.setState((prev: any) => ({
            bottomPanel: prev?.bottomPanel ? { ...prev.bottomPanel, captionDraft: v } : prev?.bottomPanel,
          }));
          scheduleDebouncedCaptionSave({ projectId: currentProjectId, caption: v, debounceMs: 600 });
        },

        debugScreenshot: debugScreenshot || null,
        showDebugPreview,
        setShowDebugPreview,
        debugLogs: Array.isArray(debugLogs) ? debugLogs : [],
      } as any,
    } as any);
  }, [
    FONT_OPTIONS,
    archiveProjectBusy,
    archiveProjectModalOpen,
    archiveProjectTarget,
    activeSlideIndex,
    addLog,
    canvasRef,
    CarouselPreviewVision,
    computeTemplateIdForSlide,
    copyGenerating,
    currentProjectId,
    deleteImageForActiveSlide,
    editorStore,
    goNext,
    goPrev,
    handleRegularCanvasTextChange,
    handleEnhancedCanvasTextChange,
    handleUserImageChange,
    hasImageForActiveSlide,
    imageBusy,
    imageFileInputRef,
    imageMenuOpen,
    imageMenuPos,
    headlineFontFamily,
    headlineFontWeight,
    isMobile,
    lastActiveFabricCanvasRef,
    layoutData,
    loading,
    loadingTemplates,
    newProjectTemplateTypeId,
    projectBackgroundColor,
    projectSaveStatus,
    projectTextColor,
    projectTitle,
    projects,
    projectsDropdownOpen,
    projectsLoading,
    promptModalOpen,
    promptModalSection,
    promptSaveStatus,
    saveStatus,
    slideSaveStatus,
    slideCanvasRefs,
    slideCount,
    slideRefs,
    slides,
    switchingSlides,
    templateSettingsOpen,
    templateTypeEmphasisPrompt,
    templateTypeId,
    templateTypeImageGenPrompt,
    templateTypeMappingSlide1,
    templateTypeMappingSlide2to5,
    templateTypeMappingSlide6,
    templateTypePrompt,
    templateSnapshots,
    templates,
    topExporting,
    bodyFontFamily,
    bodyFontWeight,
    setActiveCanvasNonce,
    SlideCard,
    viewportRef,
    showLayoutOverlays,
    viewportWidth,
    VIEWPORT_PAD,
    translateX,
    totalW,
  ]);
}

