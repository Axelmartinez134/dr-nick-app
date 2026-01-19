import { useLayoutEffect, useMemo, useRef } from "react";

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

  // Phase 5E3: expose bottom panel via slices (ui + actions) instead of one large blob.
  // We keep handlers stable (ref-dispatch) to avoid stale closures and reduce rerenders.
  const bottomPanelImplRef = useRef<any>(null);

  const stableBottomPanelActions = useMemo(
    () =>
      ({
        onChangeHeadlineFontSize: (e: any) => bottomPanelImplRef.current?.onChangeHeadlineFontSize?.(e),
        onClickHeadlineAlign: (a: "left" | "center" | "right") => bottomPanelImplRef.current?.onClickHeadlineAlign?.(a),
        onChangeHeadlineRichText: (next: any) => bottomPanelImplRef.current?.onChangeHeadlineRichText?.(next),
        onChangeBodyFontSize: (e: any) => bottomPanelImplRef.current?.onChangeBodyFontSize?.(e),
        onClickBodyAlign: (a: "left" | "center" | "right") => bottomPanelImplRef.current?.onClickBodyAlign?.(a),
        onChangeBodyRichText: (next: any) => bottomPanelImplRef.current?.onChangeBodyRichText?.(next),
        onClickRegenerateImagePrompt: () => bottomPanelImplRef.current?.onClickRegenerateImagePrompt?.(),
        onChangeAiImagePrompt: (v: string) => bottomPanelImplRef.current?.onChangeAiImagePrompt?.(v),
        onClickGenerateAiImage: () => bottomPanelImplRef.current?.onClickGenerateAiImage?.(),
        onClickGenerateCopy: () => bottomPanelImplRef.current?.onClickGenerateCopy?.(),
        onClickRetry: () => bottomPanelImplRef.current?.onClickRetry?.(),
        onClickRealignText: () => bottomPanelImplRef.current?.onClickRealignText?.(),
        onClickUndo: () => bottomPanelImplRef.current?.onClickUndo?.(),
        onClickToggleOverlays: () => bottomPanelImplRef.current?.onClickToggleOverlays?.(),
        onClickCopyCaption: () => bottomPanelImplRef.current?.onClickCopyCaption?.(),
        onChangeCaption: (v: string) => bottomPanelImplRef.current?.onChangeCaption?.(v),
        setShowDebugPreview: (next: boolean) => bottomPanelImplRef.current?.setShowDebugPreview?.(next),
        setActiveSlideImageBgRemoval: (nextEnabled: boolean) => bottomPanelImplRef.current?.setActiveSlideImageBgRemoval?.(nextEnabled),
        deleteImageForActiveSlide: (source: "menu" | "button") => bottomPanelImplRef.current?.deleteImageForActiveSlide?.(source),
      }) as any,
    []
  );

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
    editorStore.setState({
      bottomPanelUi: {
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
        aiImagePromptSaveStatus,
        imagePromptGenerating,
        imagePromptError,
        aiImageGeneratingThis,
        aiImageProgressThis: aiImageProgressThis || 0,
        aiImageStatusThis,
        aiImageErrorThis,
        copyProgressIcon: <CopyProgressIcon />,
        copyError,
        saveError: saveError || null,
        error: error || null,
        activeImageSelected,
        imageBusy,
        aiKey,
        bgRemovalBusyKeys,
        captionDraft: captionDraft || "",
        captionCopyStatus,
        debugScreenshot: debugScreenshot || null,
        showDebugPreview,
        debugLogs: Array.isArray(debugLogs) ? debugLogs : [],
      } as any,
      bottomPanelActions: stableBottomPanelActions as any,
      bottomPanel: ((bottomPanelImplRef.current = {
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
            bottomPanelUi: prev?.bottomPanelUi ? { ...prev.bottomPanelUi, captionDraft: v } : prev?.bottomPanelUi,
          }));
          scheduleDebouncedCaptionSave({ projectId: currentProjectId, caption: v, debounceMs: 600 });
        },

        debugScreenshot: debugScreenshot || null,
        showDebugPreview,
        setShowDebugPreview,
        debugLogs: Array.isArray(debugLogs) ? debugLogs : [],
      } as any), null),
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

