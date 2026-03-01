import { useLayoutEffect, useMemo, useRef } from "react";

type Args = {
  editorStore: any;
  addLog?: (msg: string) => void;

  // Current dependency list (kept intentionally identical to EditorShell’s original effect).
  archiveProjectBusy: boolean;
  archiveProjectById: (projectId: string, title: string) => Promise<void> | void;
  createNewProject: (templateTypeId: "regular" | "enhanced") => Promise<void> | void;
  currentProjectId: string | null;
  handleDownloadAll: () => Promise<void> | void;
  handleDownloadPdf: () => Promise<void> | void;
  handleNewCarousel: () => void;
  handleShareAll: () => Promise<void> | void;
  handleSignOut: () => Promise<void> | void;
  isMobile: boolean;
  loadProject: (projectId: string) => Promise<void> | void;
  newProjectTemplateTypeId: "regular" | "enhanced";
  persistCurrentProjectTemplateMappings: (patch: {
    slide1TemplateIdSnapshot?: string | null;
    slide2to5TemplateIdSnapshot?: string | null;
    slide6TemplateIdSnapshot?: string | null;
  }) => Promise<void> | void;
  projectBackgroundColor: string;
  projectTextColor: string;
  projectBackgroundEffectEnabled: boolean;
  projectBackgroundEffectType: "none" | "dots_n8n";
  setProjectBackgroundEffectEnabled: (next: boolean) => void;
  setProjectBackgroundEffectType: (next: "none" | "dots_n8n") => void;
  onSelectTheme: (next: "custom" | "n8n_dots_dark") => Promise<void> | void;
  onResetThemeDefaults: () => Promise<void> | void;
  onChangeEffectTypeThemeAware: (next: "none" | "dots_n8n") => Promise<void> | void;
  projectsDropdownOpen: boolean;
  // Included only to preserve dependency semantics (even if unused in the body).
  saveProjectMetaForProject: any;
  updateProjectColors: (bg: string, text: string) => void;
  saveProjectBackgroundEffectForProject: (args: {
    projectId: string | null;
    enabled: boolean;
    type: "none" | "dots_n8n";
  }) => Promise<void> | void;

  // Captured values used inside actions (kept as-is; not added to deps to avoid behavior changes).
  setProjectTitle: (next: string) => void;
  scheduleDebouncedProjectTitleSave: (args: { projectId: string | null; title: string; debounceMs: number }) => void;
  setNewProjectTemplateTypeId: (next: "regular" | "enhanced") => void;
  setSlides: any;
  setTemplateSettingsOpen: (next: boolean) => void;
  setPromptModalOpen: (next: boolean) => void;
  setPromptModalSection: (next: "prompt" | "emphasis" | "image" | "caption") => void;
  setTemplateEditorOpen: (next: boolean) => void;
  loadTemplatesList: () => Promise<void> | void;
  promptDirtyRef: any;
  poppyPromptDirtyRef: { current: boolean };
  setTemplateTypePrompt: (next: string) => void;
  setTemplateTypeBestPractices: (next: string) => void;
  setTemplateTypeEmphasisPrompt: (next: string) => void;
  setTemplateTypeImageGenPrompt: (next: string) => void;
  setCaptionRegenPrompt: (next: string) => void;
  setHeadlineFontFamily: (next: string) => void;
  setHeadlineFontWeight: (next: number) => void;
  setBodyFontFamily: (next: string) => void;
  setBodyFontWeight: (next: number) => void;
  projectTextColorForUpdate: string;
  projectBackgroundColorForUpdate: string;
  setProjectsDropdownOpen: (next: boolean | ((prev: boolean) => boolean)) => void;
  setMobileDrawerOpen: (next: boolean) => void;
  setSlideStyleModalOpen: (next: boolean) => void;
  setArchiveProjectTarget: (next: { id: string; title: string } | null) => void;
  setArchiveProjectModalOpen: (next: boolean) => void;
  setTemplateTypeMappingSlide1: (next: string | null) => void;
  setTemplateTypeMappingSlide2to5: (next: string | null) => void;
  setTemplateTypeMappingSlide6: (next: string | null) => void;
  currentProjectIdRef: any;
  setProjectMappingSlide1: (next: string | null) => void;
  setProjectMappingSlide2to5: (next: string | null) => void;
  setProjectMappingSlide6: (next: string | null) => void;

  // Bottom panel actions (Phase 5E6-ish): unify bottom panel handlers into `state.actions`
  onChangeHeadlineFontSize: (e: any) => void;
  onClickHeadlineAlign: (align: "left" | "center" | "right") => void;
  onChangeHeadlineRichText: (next: any) => void;
  onChangeBodyFontSize: (e: any) => void;
  onClickBodyAlign: (align: "left" | "center" | "right") => void;
  onChangeBodyRichText: (next: any) => void;
  onClickRegenerateImagePrompt: () => void;
  onChangeAiImagePrompt: (next: string) => void;
  onChangeAiImageGenModel: (next: 'gpt-image-1.5' | 'gemini-3-pro-image-preview') => void;
  onClickToggleAiImageSettings: () => void;
  onChangeAiImageAspectRatio: (next: string) => void;
  onChangeAiImageSize: (next: string) => void;
  onToggleAiImageAutoRemoveBg: () => void;
  onClickGenerateAiImage: () => void;
  onClickGenerateCopy: () => void;
  onSetGenerateCopyUi: (args: { projectId: string; state: "idle" | "running" | "success" | "error"; label?: string; error?: string | null }) => void;
  onClickRetry: () => void;
  onClickRealignText: () => void;
  onClickUndo: () => void;
  onClickToggleOverlays: () => void;
  onClickCopyCaption: () => void;
  onClickRegenerateCaption: () => void;
  onChangeCaption: (next: string) => void;
  onClickCopyOutreachMessage: () => void;
  onChangeOutreachMessage: (next: string) => void;
  setShowDebugPreview: (next: boolean) => void;
  setActiveSlideImageBgRemoval: (nextEnabled: boolean) => void;
  deleteImageForActiveSlide: (source: "menu" | "button") => void;

  // Body Regenerate (Regular only)
  onOpenBodyRegenModal: () => void;
  onCloseBodyRegenModal: () => void;
  fetchBodyRegenAttempts: (args: { projectId: string; slideIndex: number; limit?: number }) => Promise<any[]>;
  onRunBodyRegen: (args: { guidanceText: string | null }) => Promise<{ body: string; bodyStyleRanges: any[] }>;
  onRestoreBodyRegenAttempt: (args: { body: string; bodyStyleRanges: any[] }) => Promise<void> | void;

  // Body Emphasis Styles (Regular only; styles-only)
  onOpenBodyEmphasisModal: () => void;
  onCloseBodyEmphasisModal: () => void;
  fetchBodyEmphasisAttempts: (args: { projectId: string; slideIndex: number; limit?: number }) => Promise<any[]>;
  onRunBodyEmphasisRegen: (args: { guidanceText: string | null }) => Promise<{ bodyStyleRanges: any[] }>;
  onRestoreBodyEmphasisAttempt: (args: { body: string; bodyStyleRanges: any[] }) => Promise<void> | void;

  // Emphasis Styles (All slides; Regular only; styles-only)
  onOpenEmphasisAllModal: () => void;
  onCloseEmphasisAllModal: () => void;
  onRunEmphasisAllRegen: (args: { guidanceText: string | null }) => Promise<void> | void;

  // Image Library modal (Phase 1)
  onOpenImageLibraryModal: () => void;
  onCloseImageLibraryModal: () => void;
  onToggleImageLibraryBgRemovalAtInsert: () => void;
  fetchRecentAssets: (limit?: number) => Promise<any[]>;
  onInsertRecentImage: (asset: { id: string; url: string; storage_bucket?: string | null; storage_path?: string | null; kind?: string | null }) => Promise<void> | void;

  // Ideas modal (Phase 1)
  setIdeasModalOpen: (next: boolean) => void;
  // Saved Poppy prompts library (Phase 3: UI shell only)
  fetchPoppyPromptsLibrary: (args: { templateTypeId: "regular" | "enhanced" }) => Promise<
    Array<{
      id: string;
      title: string;
      prompt: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>
  >;
  createPoppyPrompt: (args: { templateTypeId: "regular" | "enhanced"; title?: string; prompt?: string }) => Promise<any>;
  updatePoppyPrompt: (args: { id: string; title?: string; prompt?: string }) => Promise<any>;
  duplicatePoppyPrompt: (args: { id: string }) => Promise<any>;
  setActivePoppyPrompt: (args: { id: string }) => Promise<any>;
  fetchIdeaSourcesAndIdeas: (includeDismissed?: boolean) => Promise<any[]>;
  fetchIdeasPromptOverride: () => Promise<string>;
  saveIdeasPromptOverride: (next: string) => Promise<string>;
  fetchIdeasPromptAudience: () => Promise<string>;
  saveIdeasPromptAudience: (next: string) => Promise<string>;
  runGenerateIdeas: (args: { sourceTitle: string; sourceUrl: string; topicCount?: number }) => Promise<any>;
  updateIdea: (body:
    | { action: "approve"; ideaId: string }
    | { action: "dismiss"; ideaId: string }
    | { action: "unapprove"; ideaId: string }
    | { action: "reorderApproved"; ideaIds: string[] }
  ) => Promise<any>;
  deleteIdeaSource: (sourceId: string) => Promise<any>;
  createCarouselFromIdea: (args: { ideaId: string; templateTypeId: "regular" | "enhanced" }) => Promise<{ projectId: string }>;
  fetchProjectJobStatus: (args: { projectId: string; jobType?: string }) => Promise<any>;
  fetchIdeaCarouselRuns: (ideaIds: string[]) => Promise<Record<string, { projectId: string; createdAt: string }>>;

  // Accounts (Phase 1: UI shell only)
  setCreateAccountModalOpen: (next: boolean) => void;
  setDeleteAccountModalOpen: (next: boolean) => void;

  // Brand Alignment (Phase 0)
  setBrandAlignmentModalOpen: (next: boolean) => void;
  setBrandAlignmentPrompt: (next: string) => void;
  runBrandAlignmentCheck: (args: { projectId: string }) => Promise<any>;

  // Review / Approval (Phase 2)
  setIsSuperadmin: (next: boolean) => void;
  onOpenShareCarousels: () => void;
  onCloseShareCarousels: () => void;
  onRefreshShareCarousels: () => Promise<void> | void;
  onClickCopyShareCarouselsLink: () => Promise<void> | void;
  onToggleProjectReviewReady: (args: { projectId: string; next: boolean }) => Promise<boolean | void> | void;
  onToggleProjectReviewPosted: (args: { projectId: string; next: boolean }) => Promise<boolean | void> | void;
  onToggleProjectReviewApproved: (args: { projectId: string; next: boolean }) => Promise<boolean | void> | void;
  onToggleProjectReviewScheduled: (args: { projectId: string; next: boolean }) => Promise<boolean | void> | void;
  onChangeProjectReviewSource: (args: { projectId: string; next: string }) => Promise<any> | void;
  onSetSlide1StyleId: (nextStyleId: string | null) => void;

  // Logos (Phase 3C: read-only)
  fetchLogoTags: (args: {
    source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
    limit?: number;
  }) => Promise<
    Array<{ tag: string; count: number }>
  >;
  searchLogoVariants: (args: {
    source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
    q?: string;
    tag?: string | null;
    limit?: number;
  }) => Promise<any[]>;

  searchLogoVariantsGlobal: (args: { q: string; limit?: number }) => Promise<
    Array<{
      source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
      rowsMatched: number;
      tiles: any[];
    }>
  >;

  // Logos (Phase 3D)
  importLogoVariant: (args: {
    source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
    sourceKey: string;
    variantKey: string;
    remoteUrl: string;
  }) => Promise<{
    cached: boolean;
    assetUrl: string;
    storage: { bucket: string; path: string };
  }>;

  // Logos (Phase 3E)
  insertCachedLogoToActiveSlide: (args: {
    url: string;
    storage: { bucket: string; path: string };
    source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
    sourceKey: string;
    variantKey: string;
  }) => Promise<void>;
};

export function useEditorStoreActionsSync(args: Args) {
  const {
    editorStore,
    addLog,
    archiveProjectBusy,
    archiveProjectById,
    createNewProject,
    currentProjectId,
    handleDownloadAll,
    handleDownloadPdf,
    handleNewCarousel,
    handleShareAll,
    handleSignOut,
    isMobile,
    loadProject,
    newProjectTemplateTypeId,
    persistCurrentProjectTemplateMappings,
    projectBackgroundColor,
    projectTextColor,
    projectBackgroundEffectEnabled,
    projectBackgroundEffectType,
    setProjectBackgroundEffectEnabled,
    setProjectBackgroundEffectType,
    onSelectTheme: handleSelectTheme,
    onResetThemeDefaults: handleResetThemeDefaults,
    onChangeEffectTypeThemeAware: handleChangeEffectTypeThemeAware,
    projectsDropdownOpen,
    saveProjectMetaForProject,
    updateProjectColors,
    saveProjectBackgroundEffectForProject,

    setProjectTitle,
    scheduleDebouncedProjectTitleSave,
    setNewProjectTemplateTypeId,
    setSlides,
    setTemplateSettingsOpen,
    setPromptModalOpen,
    setPromptModalSection,
    setTemplateEditorOpen,
    promptDirtyRef,
    poppyPromptDirtyRef,
    setTemplateTypePrompt,
    setTemplateTypeBestPractices,
    setTemplateTypeEmphasisPrompt,
    setTemplateTypeImageGenPrompt,
    setCaptionRegenPrompt,
    setHeadlineFontFamily,
    setHeadlineFontWeight,
    setBodyFontFamily,
    setBodyFontWeight,
    projectTextColorForUpdate,
    projectBackgroundColorForUpdate,
    setProjectsDropdownOpen,
    setMobileDrawerOpen,
    setSlideStyleModalOpen,
    setArchiveProjectTarget,
    setArchiveProjectModalOpen,
    setTemplateTypeMappingSlide1,
    setTemplateTypeMappingSlide2to5,
    setTemplateTypeMappingSlide6,
    currentProjectIdRef,
    setProjectMappingSlide1,
    setProjectMappingSlide2to5,
    setProjectMappingSlide6,

    onChangeHeadlineFontSize,
    onClickHeadlineAlign,
    onChangeHeadlineRichText,
    onChangeBodyFontSize,
    onClickBodyAlign,
    onChangeBodyRichText,
    onClickRegenerateImagePrompt,
    onChangeAiImagePrompt,
    onChangeAiImageGenModel,
    onClickToggleAiImageSettings,
    onChangeAiImageAspectRatio,
    onChangeAiImageSize,
    onToggleAiImageAutoRemoveBg,
    onClickGenerateAiImage,
    onClickGenerateCopy,
    onSetGenerateCopyUi,
    onClickRetry,
    onClickRealignText,
    onClickUndo,
    onClickToggleOverlays,
    onClickCopyCaption,
    onClickRegenerateCaption,
    onChangeCaption,
    onClickCopyOutreachMessage,
    onChangeOutreachMessage,
    onOpenBodyRegenModal,
    onCloseBodyRegenModal,
    fetchBodyRegenAttempts,
    onRunBodyRegen,
    onRestoreBodyRegenAttempt,
    onOpenBodyEmphasisModal,
    onCloseBodyEmphasisModal,
    fetchBodyEmphasisAttempts,
    onRunBodyEmphasisRegen,
    onRestoreBodyEmphasisAttempt,
    onOpenEmphasisAllModal,
    onCloseEmphasisAllModal,
    onRunEmphasisAllRegen,
    setShowDebugPreview,
    setActiveSlideImageBgRemoval,
    deleteImageForActiveSlide,

    onOpenImageLibraryModal,
    onCloseImageLibraryModal,
    onToggleImageLibraryBgRemovalAtInsert,
    fetchRecentAssets,
    onInsertRecentImage,
    setIdeasModalOpen,
    fetchPoppyPromptsLibrary,
    createPoppyPrompt,
    updatePoppyPrompt,
    duplicatePoppyPrompt,
    setActivePoppyPrompt,
    fetchIdeaSourcesAndIdeas,
    fetchIdeasPromptOverride,
    saveIdeasPromptOverride,
    fetchIdeasPromptAudience,
    saveIdeasPromptAudience,
    runGenerateIdeas,
    updateIdea,
    deleteIdeaSource,
    createCarouselFromIdea,
    fetchProjectJobStatus,
    fetchIdeaCarouselRuns,
    setCreateAccountModalOpen,
    setDeleteAccountModalOpen,
    setBrandAlignmentModalOpen,
    setBrandAlignmentPrompt,
    runBrandAlignmentCheck,
    setIsSuperadmin,
    onOpenShareCarousels,
    onCloseShareCarousels,
    onRefreshShareCarousels,
    onClickCopyShareCarouselsLink,
    onToggleProjectReviewReady,
    onToggleProjectReviewPosted,
    onToggleProjectReviewApproved,
    onToggleProjectReviewScheduled,
    onChangeProjectReviewSource,
    onSetSlide1StyleId,
    fetchLogoTags,
    searchLogoVariants,
    searchLogoVariantsGlobal,
    importLogoVariant,
    insertCachedLogoToActiveSlide,
  } = args;

  // Phase 5E: stop mirroring `actions` into the store on every render.
  //
  // Instead:
  // - Keep a stable `actions` object in the store (so components don't re-render just because action closures changed)
  // - Delegate each action call to the latest implementation via a ref (so closures are never stale)
  //
  // This preserves behavior while removing the continuous "actions mirroring" effect.
  const implRef = useRef<any>(null);
  implRef.current = {
    onChangeProjectTitle: (v: string) => {
      setProjectTitle(v);
      // Keep store in sync immediately so the input caret doesn't jump.
      editorStore.setState({ projectTitle: v } as any);
      scheduleDebouncedProjectTitleSave({ projectId: currentProjectId, title: v, debounceMs: 600 });
    },
    onDownloadAll: () => void handleDownloadAll(),
    onDownloadPdf: () => void handleDownloadPdf(),
    onShareAll: () => void handleShareAll(),
    onSignOut: () => void handleSignOut(),

    setIsSuperadmin: (next: boolean) => setIsSuperadmin(next),
    onOpenShareCarousels: () => onOpenShareCarousels(),
    onOpenMobileDrawer: () => {
      try {
        if (isMobile) setMobileDrawerOpen(true);
      } catch {
        // ignore
      }
    },
    onCloseMobileDrawer: () => {
      try {
        if (isMobile) setMobileDrawerOpen(false);
      } catch {
        // ignore
      }
    },
    onOpenSlideStyleModal: () => {
      try {
        setSlideStyleModalOpen(true);
      } catch {
        // ignore
      }
    },
    onCloseSlideStyleModal: () => {
      try {
        setSlideStyleModalOpen(false);
      } catch {
        // ignore
      }
    },
    onSetSlide1StyleId: (nextStyleId: string | null) => {
      try {
        onSetSlide1StyleId(nextStyleId);
      } catch {
        // ignore
      }
    },
    onCloseShareCarousels: () => onCloseShareCarousels(),
    onRefreshShareCarousels: () => onRefreshShareCarousels(),
    onClickCopyShareCarouselsLink: () => onClickCopyShareCarouselsLink(),
    onToggleProjectReviewReady: (a: any) => onToggleProjectReviewReady(a),
    onToggleProjectReviewPosted: (a: any) => onToggleProjectReviewPosted(a),
    onToggleProjectReviewApproved: (a: any) => onToggleProjectReviewApproved(a),
    onToggleProjectReviewScheduled: (a: any) => onToggleProjectReviewScheduled(a),
    onChangeProjectReviewSource: (a: any) => onChangeProjectReviewSource(a),

    onChangeNewProjectTemplateTypeId: (next: "regular" | "enhanced") => {
      setNewProjectTemplateTypeId(next);
      editorStore.setState({ newProjectTemplateTypeId: next } as any);
    },
    onClickNewProject: () => {
      setSlides((prev: any) => prev.map((s: any) => ({ ...s, draftHeadline: "", draftBody: "" })));
      handleNewCarousel();
      void createNewProject(newProjectTemplateTypeId);
    },

    onOpenTemplateSettings: () => {
      setTemplateSettingsOpen(true);
      editorStore.setState({ templateSettingsOpen: true } as any);
    },
    onCloseTemplateSettings: () => {
      setTemplateSettingsOpen(false);
      editorStore.setState({ templateSettingsOpen: false } as any);
    },
    onOpenTemplateEditor: () => {
      setTemplateSettingsOpen(false);
      setPromptModalOpen(false);
      editorStore.setState({ templateSettingsOpen: false, promptModalOpen: false } as any);
      setTemplateEditorOpen(true);
    },
    onRefreshTemplatesList: () => {
      try {
        void args.loadTemplatesList?.();
      } catch {
        // ignore
      }
    },

    onOpenPromptModal: (section: "prompt" | "emphasis" | "image" | "caption") => {
      setPromptModalSection(section);
      setPromptModalOpen(true);
      editorStore.setState({ promptModalSection: section, promptModalOpen: true } as any);
    },
    onClosePromptsModal: () => {
      setPromptModalOpen(false);
      editorStore.setState({ promptModalOpen: false } as any);
    },
    onChangeTemplateTypePrompt: (next: string) => {
      poppyPromptDirtyRef.current = true;
      setTemplateTypePrompt(next);
      // Keep store in sync immediately so the textarea caret doesn't jump.
      editorStore.setState({
        templateTypePrompt: next,
        templateTypePromptPreviewLine: String(next || "").split("\n")[0] || "",
        poppyPromptSaveStatus: "idle",
        poppyPromptSaveError: null,
      } as any);
    },
    onChangeTemplateTypeBestPractices: (next: string) => {
      promptDirtyRef.current = true;
      setTemplateTypeBestPractices(next);
      editorStore.setState({
        templateTypeBestPractices: next,
        templateTypeBestPracticesPreviewLine: String(next || "").split("\n")[0] || "",
      } as any);
    },
    onChangeTemplateTypeEmphasisPrompt: (next: string) => {
      promptDirtyRef.current = true;
      setTemplateTypeEmphasisPrompt(next);
      editorStore.setState({
        templateTypeEmphasisPrompt: next,
        templateTypeEmphasisPromptPreviewLine: String(next || "").split("\n")[0] || "",
      } as any);
    },
    onChangeTemplateTypeImageGenPrompt: (next: string) => {
      promptDirtyRef.current = true;
      setTemplateTypeImageGenPrompt(next);
      editorStore.setState({
        templateTypeImageGenPrompt: next,
        templateTypeImageGenPromptPreviewLine: String(next || "").split("\n")[0] || "",
      } as any);
    },
    onChangeCaptionRegenPrompt: (next: string) => {
      // Different persistence path than template-type settings; use a dedicated dirty ref in EditorShell,
      // but we still keep the store in sync immediately so the textarea caret doesn't jump.
      setCaptionRegenPrompt(next);
      editorStore.setState({ captionRegenPrompt: next } as any);
    },

    onChangeHeadlineFontKey: (raw: string) => {
      const [family, w] = String(raw || "").split("@@");
      const weight = Number(w);
      setHeadlineFontFamily(family || "Inter, sans-serif");
      setHeadlineFontWeight(Number.isFinite(weight) ? weight : 700);
    },
    onChangeBodyFontKey: (raw: string) => {
      const [family, w] = String(raw || "").split("@@");
      const weight = Number(w);
      setBodyFontFamily(family || "Inter, sans-serif");
      setBodyFontWeight(Number.isFinite(weight) ? weight : 400);
    },
    onChangeBackgroundColor: (next: string) => updateProjectColors(next, projectTextColorForUpdate),
    onChangeTextColor: (next: string) => updateProjectColors(projectBackgroundColorForUpdate, next),
    onChangeBackgroundEffectEnabled: (next: boolean) => {
      try {
        console.log("[Editor][BGFX] toggle enabled ->", next, { projectId: currentProjectIdRef.current });
      } catch {
        // ignore
      }
      try {
        addLog?.(`🎛️ BGFX enabled=${next ? "true" : "false"} (project=${String(currentProjectIdRef.current || "")})`);
      } catch {
        // ignore
      }
      // Phase 4: route through the theme-aware effect handler.
      void handleChangeEffectTypeThemeAware(next ? projectBackgroundEffectType : "none");
    },
    onChangeBackgroundEffectType: (next: "none" | "dots_n8n") => {
      void handleChangeEffectTypeThemeAware(next);
    },
    onSelectTheme: (next: "custom" | "n8n_dots_dark") => {
      void handleSelectTheme(next);
    },
    onResetThemeDefaults: () => {
      void handleResetThemeDefaults();
    },

    onToggleProjectsDropdown: () => setProjectsDropdownOpen((v) => !v),
    onLoadProject: (projectId: string) => {
      setProjectsDropdownOpen(false);
      editorStore.setState({ projectsDropdownOpen: false } as any);
      void loadProject(projectId);
      if (isMobile) setMobileDrawerOpen(false);
    },
    onRequestArchive: (target: { id: string; title: string }) => {
      setArchiveProjectTarget(target);
      setArchiveProjectModalOpen(true);
      editorStore.setState({ archiveProjectTarget: target, archiveProjectModalOpen: true } as any);
    },
    onCancelArchive: () => {
      if (archiveProjectBusy) return;
      setArchiveProjectModalOpen(false);
      setArchiveProjectTarget(null);
      editorStore.setState({ archiveProjectModalOpen: false, archiveProjectTarget: null } as any);
    },
    onConfirmArchive: (target: { id: string; title: string }) => {
      void archiveProjectById(target.id, target.title);
    },

    onChangeTemplateTypeMappingSlide1: (next: string | null) => {
      promptDirtyRef.current = true;
      setTemplateTypeMappingSlide1(next);
      if (currentProjectIdRef.current) {
        setProjectMappingSlide1(next);
        void persistCurrentProjectTemplateMappings({ slide1TemplateIdSnapshot: next });
      }
    },
    onChangeTemplateTypeMappingSlide2to5: (next: string | null) => {
      promptDirtyRef.current = true;
      setTemplateTypeMappingSlide2to5(next);
      if (currentProjectIdRef.current) {
        setProjectMappingSlide2to5(next);
        void persistCurrentProjectTemplateMappings({ slide2to5TemplateIdSnapshot: next });
      }
    },
    onChangeTemplateTypeMappingSlide6: (next: string | null) => {
      promptDirtyRef.current = true;
      setTemplateTypeMappingSlide6(next);
      if (currentProjectIdRef.current) {
        setProjectMappingSlide6(next);
        void persistCurrentProjectTemplateMappings({ slide6TemplateIdSnapshot: next });
      }
    },

    onChangeHeadlineFontSize: (e: any) => onChangeHeadlineFontSize(e),
    onClickHeadlineAlign: (a: "left" | "center" | "right") => onClickHeadlineAlign(a),
    onChangeHeadlineRichText: (next: any) => onChangeHeadlineRichText(next),
    onChangeBodyFontSize: (e: any) => onChangeBodyFontSize(e),
    onClickBodyAlign: (a: "left" | "center" | "right") => onClickBodyAlign(a),
    onChangeBodyRichText: (next: any) => onChangeBodyRichText(next),
    onClickRegenerateImagePrompt: () => onClickRegenerateImagePrompt(),
    onChangeAiImagePrompt: (next: string) => onChangeAiImagePrompt(next),
    onChangeAiImageGenModel: (next: 'gpt-image-1.5' | 'gemini-3-pro-image-preview') => onChangeAiImageGenModel(next),
    onClickToggleAiImageSettings: () => onClickToggleAiImageSettings(),
    onChangeAiImageAspectRatio: (next: string) => onChangeAiImageAspectRatio(next),
    onChangeAiImageSize: (next: string) => onChangeAiImageSize(next),
    onToggleAiImageAutoRemoveBg: () => onToggleAiImageAutoRemoveBg(),
    onClickGenerateAiImage: () => onClickGenerateAiImage(),
    onClickGenerateCopy: () => onClickGenerateCopy(),
    onSetGenerateCopyUi: (a: any) => onSetGenerateCopyUi(a),
    onClickRetry: () => onClickRetry(),
    onClickRealignText: () => onClickRealignText(),
    onClickUndo: () => onClickUndo(),
    onClickToggleOverlays: () => onClickToggleOverlays(),
    onClickCopyCaption: () => onClickCopyCaption(),
    onClickRegenerateCaption: () => onClickRegenerateCaption(),
    onChangeCaption: (next: string) => onChangeCaption(next),
    onClickCopyOutreachMessage: () => onClickCopyOutreachMessage(),
    onChangeOutreachMessage: (next: string) => onChangeOutreachMessage(next),
    onOpenBodyRegenModal: () => onOpenBodyRegenModal(),
    onCloseBodyRegenModal: () => onCloseBodyRegenModal(),
    fetchBodyRegenAttempts: (args: any) => fetchBodyRegenAttempts(args),
    onRunBodyRegen: (args: any) => onRunBodyRegen(args),
    onRestoreBodyRegenAttempt: (args: any) => onRestoreBodyRegenAttempt(args),
    onOpenBodyEmphasisModal: () => onOpenBodyEmphasisModal(),
    onCloseBodyEmphasisModal: () => onCloseBodyEmphasisModal(),
    fetchBodyEmphasisAttempts: (args: any) => fetchBodyEmphasisAttempts(args),
    onRunBodyEmphasisRegen: (args: any) => onRunBodyEmphasisRegen(args),
    onRestoreBodyEmphasisAttempt: (args: any) => onRestoreBodyEmphasisAttempt(args),
    onOpenEmphasisAllModal: () => onOpenEmphasisAllModal(),
    onCloseEmphasisAllModal: () => onCloseEmphasisAllModal(),
    onRunEmphasisAllRegen: (args: any) => onRunEmphasisAllRegen(args),
    setShowDebugPreview: (next: boolean) => setShowDebugPreview(next),
    setActiveSlideImageBgRemoval: (nextEnabled: boolean) => setActiveSlideImageBgRemoval(nextEnabled),
    deleteImageForActiveSlide: (source: "menu" | "button") => deleteImageForActiveSlide(source),

    onOpenImageLibraryModal: () => onOpenImageLibraryModal(),
    onCloseImageLibraryModal: () => onCloseImageLibraryModal(),
    onToggleImageLibraryBgRemovalAtInsert: () => onToggleImageLibraryBgRemovalAtInsert(),
    onOpenIdeasModal: () => {
      setIdeasModalOpen(true);
      editorStore.setState({ ideasModalOpen: true } as any);
    },
    onCloseIdeasModal: () => {
      setIdeasModalOpen(false);
      editorStore.setState({ ideasModalOpen: false } as any);
    },

    onOpenCreateAccountModal: () => {
      setCreateAccountModalOpen(true);
      editorStore.setState({ createAccountModalOpen: true } as any);
    },
    onCloseCreateAccountModal: () => {
      setCreateAccountModalOpen(false);
      editorStore.setState({ createAccountModalOpen: false } as any);
    },
    onOpenDeleteAccountModal: () => {
      setDeleteAccountModalOpen(true);
      editorStore.setState({ deleteAccountModalOpen: true } as any);
    },
    onCloseDeleteAccountModal: () => {
      setDeleteAccountModalOpen(false);
      editorStore.setState({ deleteAccountModalOpen: false } as any);
    },
    onOpenOutreachModal: () => {
      editorStore.setState({ outreachModalOpen: true } as any);
    },
    onCloseOutreachModal: () => {
      editorStore.setState({ outreachModalOpen: false } as any);
    },
    onOpenSwipeFileModal: () => {
      editorStore.setState({ swipeFileModalOpen: true } as any);
    },
    onCloseSwipeFileModal: () => {
      editorStore.setState({ swipeFileModalOpen: false } as any);
    },
    onOpenPoppyPromptsLibrary: () => {
      editorStore.setState({ poppyPromptsLibraryOpen: true } as any);
    },
    onClosePoppyPromptsLibrary: () => {
      editorStore.setState({ poppyPromptsLibraryOpen: false } as any);
    },
    hydrateActivePoppyPrompt: (args: { id: string | null; prompt: string }) => {
      const id = String(args?.id || "").trim() || null;
      const prompt = String(args?.prompt || "");
      // This hydration is used when switching the active saved prompt. It should NOT mark dirty.
      poppyPromptDirtyRef.current = false;
      editorStore.setState({
        poppyActivePromptId: id,
        templateTypePrompt: prompt,
        templateTypePromptPreviewLine: String(prompt || "").split("\n")[0] || "",
        poppyPromptSaveStatus: "idle",
        poppyPromptSaveError: null,
      } as any);
    },
    setPoppyPromptsLibraryUi: (next: { status: any; error: any; prompts: any[] }) => {
      editorStore.setState({
        poppyPromptsLibraryStatus: String(next?.status || "idle"),
        poppyPromptsLibraryError: next?.error ? String(next.error) : null,
        poppyPromptsLibraryPrompts: Array.isArray(next?.prompts) ? next.prompts : [],
      } as any);
    },
    fetchPoppyPromptsLibrary: (a: any) => fetchPoppyPromptsLibrary(a),
    createPoppyPrompt: (a: any) => createPoppyPrompt(a),
    updatePoppyPrompt: (a: any) => updatePoppyPrompt(a),
    duplicatePoppyPrompt: (a: any) => duplicatePoppyPrompt(a),
    setActivePoppyPrompt: (a: any) => setActivePoppyPrompt(a),
    onOpenBrandAlignmentModal: () => {
      setBrandAlignmentModalOpen(true);
      editorStore.setState({ brandAlignmentModalOpen: true } as any);
    },
    onCloseBrandAlignmentModal: () => {
      setBrandAlignmentModalOpen(false);
      editorStore.setState({ brandAlignmentModalOpen: false } as any);
    },
    onChangeBrandAlignmentPrompt: (next: string) => {
      setBrandAlignmentPrompt(next);
    },
    onClickRunBrandAlignmentCheck: () => {
      const pid = String(currentProjectIdRef?.current || "").trim();
      if (!pid) return;
      void runBrandAlignmentCheck({ projectId: pid });
    },
    fetchIdeaSourcesAndIdeas: (includeDismissed?: boolean) => fetchIdeaSourcesAndIdeas(includeDismissed),
    fetchIdeasPromptOverride: () => fetchIdeasPromptOverride(),
    saveIdeasPromptOverride: (next: string) => saveIdeasPromptOverride(next),
    fetchIdeasPromptAudience: () => fetchIdeasPromptAudience(),
    saveIdeasPromptAudience: (next: string) => saveIdeasPromptAudience(next),
    runGenerateIdeas: (a: any) => runGenerateIdeas(a),
    updateIdea: (b: any) => updateIdea(b),
    deleteIdeaSource: (sourceId: string) => deleteIdeaSource(sourceId),
    createCarouselFromIdea: (a: any) => createCarouselFromIdea(a),
    fetchProjectJobStatus: (a: any) => fetchProjectJobStatus(a),
    fetchIdeaCarouselRuns: (ideaIds: string[]) => fetchIdeaCarouselRuns(ideaIds),
    fetchRecentAssets: (limit?: number) => fetchRecentAssets(limit),
    onInsertRecentImage: (asset: any) => onInsertRecentImage(asset),
    fetchLogoTags: (a: any) => fetchLogoTags(a),
    searchLogoVariants: (a: any) => searchLogoVariants(a),
    searchLogoVariantsGlobal: (a: any) => searchLogoVariantsGlobal(a),
    importLogoVariant: (a: any) => importLogoVariant(a),
    insertCachedLogoToActiveSlide: (a: any) => insertCachedLogoToActiveSlide(a),
  };

  const stableActions = useMemo(
    () => ({
      onChangeProjectTitle: (v: string) => implRef.current?.onChangeProjectTitle?.(v),
      onDownloadAll: () => implRef.current?.onDownloadAll?.(),
      onDownloadPdf: () => implRef.current?.onDownloadPdf?.(),
      onShareAll: () => implRef.current?.onShareAll?.(),
      onOpenShareCarousels: () => implRef.current?.onOpenShareCarousels?.(),
      onOpenMobileDrawer: () => implRef.current?.onOpenMobileDrawer?.(),
      onCloseMobileDrawer: () => implRef.current?.onCloseMobileDrawer?.(),
      onOpenSlideStyleModal: () => implRef.current?.onOpenSlideStyleModal?.(),
      onCloseSlideStyleModal: () => implRef.current?.onCloseSlideStyleModal?.(),
      onSetSlide1StyleId: (nextStyleId: string | null) => implRef.current?.onSetSlide1StyleId?.(nextStyleId),
      onSignOut: () => implRef.current?.onSignOut?.(),
      setIsSuperadmin: (next: boolean) => implRef.current?.setIsSuperadmin?.(next),
      onCloseShareCarousels: () => implRef.current?.onCloseShareCarousels?.(),
      onRefreshShareCarousels: () => implRef.current?.onRefreshShareCarousels?.(),
      onClickCopyShareCarouselsLink: () => implRef.current?.onClickCopyShareCarouselsLink?.(),
      onToggleProjectReviewReady: (a: any) => implRef.current?.onToggleProjectReviewReady?.(a),
      onToggleProjectReviewPosted: (a: any) => implRef.current?.onToggleProjectReviewPosted?.(a),
      onToggleProjectReviewApproved: (a: any) => implRef.current?.onToggleProjectReviewApproved?.(a),
      onToggleProjectReviewScheduled: (a: any) => implRef.current?.onToggleProjectReviewScheduled?.(a),
      onChangeProjectReviewSource: (a: any) => implRef.current?.onChangeProjectReviewSource?.(a),

      onChangeNewProjectTemplateTypeId: (next: "regular" | "enhanced") =>
        implRef.current?.onChangeNewProjectTemplateTypeId?.(next),
      onClickNewProject: () => implRef.current?.onClickNewProject?.(),

      onOpenTemplateSettings: () => implRef.current?.onOpenTemplateSettings?.(),
      onCloseTemplateSettings: () => implRef.current?.onCloseTemplateSettings?.(),
      onOpenTemplateEditor: () => implRef.current?.onOpenTemplateEditor?.(),
      onRefreshTemplatesList: () => implRef.current?.onRefreshTemplatesList?.(),

      onOpenPromptModal: (section: "prompt" | "emphasis" | "image" | "caption") => implRef.current?.onOpenPromptModal?.(section),
      onClosePromptsModal: () => implRef.current?.onClosePromptsModal?.(),
      onChangeTemplateTypePrompt: (next: string) => implRef.current?.onChangeTemplateTypePrompt?.(next),
      onChangeTemplateTypeBestPractices: (next: string) => implRef.current?.onChangeTemplateTypeBestPractices?.(next),
      onChangeTemplateTypeEmphasisPrompt: (next: string) => implRef.current?.onChangeTemplateTypeEmphasisPrompt?.(next),
      onChangeTemplateTypeImageGenPrompt: (next: string) => implRef.current?.onChangeTemplateTypeImageGenPrompt?.(next),
      onChangeCaptionRegenPrompt: (next: string) => implRef.current?.onChangeCaptionRegenPrompt?.(next),

      onChangeHeadlineFontKey: (raw: string) => implRef.current?.onChangeHeadlineFontKey?.(raw),
      onChangeBodyFontKey: (raw: string) => implRef.current?.onChangeBodyFontKey?.(raw),
      onChangeBackgroundColor: (next: string) => implRef.current?.onChangeBackgroundColor?.(next),
      onChangeTextColor: (next: string) => implRef.current?.onChangeTextColor?.(next),
      onChangeBackgroundEffectEnabled: (next: boolean) => implRef.current?.onChangeBackgroundEffectEnabled?.(next),
      onChangeBackgroundEffectType: (next: "none" | "dots_n8n") => implRef.current?.onChangeBackgroundEffectType?.(next),
      onSelectTheme: (next: "custom" | "n8n_dots_dark") => implRef.current?.onSelectTheme?.(next),
      onResetThemeDefaults: () => implRef.current?.onResetThemeDefaults?.(),

      onToggleProjectsDropdown: () => implRef.current?.onToggleProjectsDropdown?.(),
      onLoadProject: (projectId: string) => implRef.current?.onLoadProject?.(projectId),
      onRequestArchive: (target: { id: string; title: string }) => implRef.current?.onRequestArchive?.(target),
      onCancelArchive: () => implRef.current?.onCancelArchive?.(),
      onConfirmArchive: (target: { id: string; title: string }) => implRef.current?.onConfirmArchive?.(target),

      onChangeTemplateTypeMappingSlide1: (next: string | null) => implRef.current?.onChangeTemplateTypeMappingSlide1?.(next),
      onChangeTemplateTypeMappingSlide2to5: (next: string | null) =>
        implRef.current?.onChangeTemplateTypeMappingSlide2to5?.(next),
      onChangeTemplateTypeMappingSlide6: (next: string | null) => implRef.current?.onChangeTemplateTypeMappingSlide6?.(next),

      onChangeHeadlineFontSize: (e: any) => implRef.current?.onChangeHeadlineFontSize?.(e),
      onClickHeadlineAlign: (a: "left" | "center" | "right") => implRef.current?.onClickHeadlineAlign?.(a),
      onChangeHeadlineRichText: (next: any) => implRef.current?.onChangeHeadlineRichText?.(next),
      onChangeBodyFontSize: (e: any) => implRef.current?.onChangeBodyFontSize?.(e),
      onClickBodyAlign: (a: "left" | "center" | "right") => implRef.current?.onClickBodyAlign?.(a),
      onChangeBodyRichText: (next: any) => implRef.current?.onChangeBodyRichText?.(next),
      onClickRegenerateImagePrompt: () => implRef.current?.onClickRegenerateImagePrompt?.(),
      onChangeAiImagePrompt: (next: string) => implRef.current?.onChangeAiImagePrompt?.(next),
      onChangeAiImageGenModel: (next: 'gpt-image-1.5' | 'gemini-3-pro-image-preview') =>
        implRef.current?.onChangeAiImageGenModel?.(next),
      onClickToggleAiImageSettings: () => implRef.current?.onClickToggleAiImageSettings?.(),
      onChangeAiImageAspectRatio: (next: string) => implRef.current?.onChangeAiImageAspectRatio?.(next),
      onChangeAiImageSize: (next: string) => implRef.current?.onChangeAiImageSize?.(next),
      onToggleAiImageAutoRemoveBg: () => implRef.current?.onToggleAiImageAutoRemoveBg?.(),
      onClickGenerateAiImage: () => implRef.current?.onClickGenerateAiImage?.(),
      onClickGenerateCopy: () => implRef.current?.onClickGenerateCopy?.(),
      onSetGenerateCopyUi: (a: any) => implRef.current?.onSetGenerateCopyUi?.(a),
      onClickRetry: () => implRef.current?.onClickRetry?.(),
      onClickRealignText: () => implRef.current?.onClickRealignText?.(),
      onClickUndo: () => implRef.current?.onClickUndo?.(),
      onClickToggleOverlays: () => implRef.current?.onClickToggleOverlays?.(),
      onClickCopyCaption: () => implRef.current?.onClickCopyCaption?.(),
      onClickRegenerateCaption: () => implRef.current?.onClickRegenerateCaption?.(),
      onChangeCaption: (next: string) => implRef.current?.onChangeCaption?.(next),
      onClickCopyOutreachMessage: () => implRef.current?.onClickCopyOutreachMessage?.(),
      onChangeOutreachMessage: (next: string) => implRef.current?.onChangeOutreachMessage?.(next),
      onOpenBodyRegenModal: () => implRef.current?.onOpenBodyRegenModal?.(),
      onCloseBodyRegenModal: () => implRef.current?.onCloseBodyRegenModal?.(),
      fetchBodyRegenAttempts: (args: any) => implRef.current?.fetchBodyRegenAttempts?.(args) ?? Promise.resolve([]),
      onRunBodyRegen: (args: any) => implRef.current?.onRunBodyRegen?.(args),
      onRestoreBodyRegenAttempt: (args: any) => implRef.current?.onRestoreBodyRegenAttempt?.(args),
      onOpenBodyEmphasisModal: () => implRef.current?.onOpenBodyEmphasisModal?.(),
      onCloseBodyEmphasisModal: () => implRef.current?.onCloseBodyEmphasisModal?.(),
      fetchBodyEmphasisAttempts: (args: any) => implRef.current?.fetchBodyEmphasisAttempts?.(args) ?? Promise.resolve([]),
      onRunBodyEmphasisRegen: (args: any) => implRef.current?.onRunBodyEmphasisRegen?.(args),
      onRestoreBodyEmphasisAttempt: (args: any) => implRef.current?.onRestoreBodyEmphasisAttempt?.(args),
      onOpenEmphasisAllModal: () => implRef.current?.onOpenEmphasisAllModal?.(),
      onCloseEmphasisAllModal: () => implRef.current?.onCloseEmphasisAllModal?.(),
      onRunEmphasisAllRegen: (args: any) => implRef.current?.onRunEmphasisAllRegen?.(args),
      onOpenBrandAlignmentModal: () => implRef.current?.onOpenBrandAlignmentModal?.(),
      onCloseBrandAlignmentModal: () => implRef.current?.onCloseBrandAlignmentModal?.(),
      onChangeBrandAlignmentPrompt: (next: string) => implRef.current?.onChangeBrandAlignmentPrompt?.(next),
      onClickRunBrandAlignmentCheck: () => implRef.current?.onClickRunBrandAlignmentCheck?.(),
      setShowDebugPreview: (next: boolean) => implRef.current?.setShowDebugPreview?.(next),
      setActiveSlideImageBgRemoval: (nextEnabled: boolean) => implRef.current?.setActiveSlideImageBgRemoval?.(nextEnabled),
      deleteImageForActiveSlide: (source: "menu" | "button") => implRef.current?.deleteImageForActiveSlide?.(source),

      onOpenImageLibraryModal: () => implRef.current?.onOpenImageLibraryModal?.(),
      onCloseImageLibraryModal: () => implRef.current?.onCloseImageLibraryModal?.(),
      onToggleImageLibraryBgRemovalAtInsert: () => implRef.current?.onToggleImageLibraryBgRemovalAtInsert?.(),
      onOpenIdeasModal: () => implRef.current?.onOpenIdeasModal?.(),
      onCloseIdeasModal: () => implRef.current?.onCloseIdeasModal?.(),
      onOpenCreateAccountModal: () => implRef.current?.onOpenCreateAccountModal?.(),
      onCloseCreateAccountModal: () => implRef.current?.onCloseCreateAccountModal?.(),
      onOpenDeleteAccountModal: () => implRef.current?.onOpenDeleteAccountModal?.(),
      onCloseDeleteAccountModal: () => implRef.current?.onCloseDeleteAccountModal?.(),
      onOpenOutreachModal: () => implRef.current?.onOpenOutreachModal?.(),
      onCloseOutreachModal: () => implRef.current?.onCloseOutreachModal?.(),
      onOpenSwipeFileModal: () => implRef.current?.onOpenSwipeFileModal?.(),
      onCloseSwipeFileModal: () => implRef.current?.onCloseSwipeFileModal?.(),
      onOpenPoppyPromptsLibrary: () => implRef.current?.onOpenPoppyPromptsLibrary?.(),
      onClosePoppyPromptsLibrary: () => implRef.current?.onClosePoppyPromptsLibrary?.(),
      hydrateActivePoppyPrompt: (args: any) => implRef.current?.hydrateActivePoppyPrompt?.(args),
      setPoppyPromptsLibraryUi: (next: any) => implRef.current?.setPoppyPromptsLibraryUi?.(next),
      fetchPoppyPromptsLibrary: (args: any) => implRef.current?.fetchPoppyPromptsLibrary?.(args) ?? Promise.resolve([]),
      createPoppyPrompt: (args: any) => implRef.current?.createPoppyPrompt?.(args),
      updatePoppyPrompt: (args: any) => implRef.current?.updatePoppyPrompt?.(args),
      duplicatePoppyPrompt: (args: any) => implRef.current?.duplicatePoppyPrompt?.(args),
      setActivePoppyPrompt: (args: any) => implRef.current?.setActivePoppyPrompt?.(args),
      fetchIdeaSourcesAndIdeas: (includeDismissed?: boolean) =>
        implRef.current?.fetchIdeaSourcesAndIdeas?.(includeDismissed) ?? Promise.resolve([]),
      fetchIdeasPromptOverride: () => implRef.current?.fetchIdeasPromptOverride?.() ?? Promise.resolve(""),
      saveIdeasPromptOverride: (next: string) => implRef.current?.saveIdeasPromptOverride?.(next) ?? Promise.resolve(String(next || "")),
      fetchIdeasPromptAudience: () => implRef.current?.fetchIdeasPromptAudience?.() ?? Promise.resolve(""),
      saveIdeasPromptAudience: (next: string) =>
        implRef.current?.saveIdeasPromptAudience?.(next) ?? Promise.resolve(String(next || "")),
      runGenerateIdeas: (a: any) => implRef.current?.runGenerateIdeas?.(a) ?? Promise.resolve({}),
      updateIdea: (b: any) => implRef.current?.updateIdea?.(b) ?? Promise.resolve({}),
      deleteIdeaSource: (sourceId: string) => implRef.current?.deleteIdeaSource?.(sourceId) ?? Promise.resolve({}),
      createCarouselFromIdea: (a: any) => implRef.current?.createCarouselFromIdea?.(a) ?? Promise.resolve({ projectId: "" }),
      fetchProjectJobStatus: (a: any) => implRef.current?.fetchProjectJobStatus?.(a) ?? Promise.resolve({}),
      fetchIdeaCarouselRuns: (ideaIds: string[]) => implRef.current?.fetchIdeaCarouselRuns?.(ideaIds) ?? Promise.resolve({}),
      fetchRecentAssets: (limit?: number) => implRef.current?.fetchRecentAssets?.(limit) ?? Promise.resolve([]),
      onInsertRecentImage: (asset: any) => implRef.current?.onInsertRecentImage?.(asset),
      fetchLogoTags: (a: any) => implRef.current?.fetchLogoTags?.(a) ?? Promise.resolve([]),
      searchLogoVariants: (a: any) => implRef.current?.searchLogoVariants?.(a) ?? Promise.resolve([]),
      searchLogoVariantsGlobal: (a: any) => implRef.current?.searchLogoVariantsGlobal?.(a) ?? Promise.resolve([]),
      importLogoVariant: (a: any) =>
        implRef.current?.importLogoVariant?.(a) ?? Promise.resolve({ cached: true, assetUrl: "", storage: { bucket: "", path: "" } }),
      insertCachedLogoToActiveSlide: (a: any) => implRef.current?.insertCachedLogoToActiveSlide?.(a) ?? Promise.resolve(),
    }),
    []
  );

  useLayoutEffect(() => {
    try {
      const cur = editorStore.getState?.().actions;
      if (cur === stableActions) return;
    } catch {
      // ignore
    }
    editorStore.setState({ actions: stableActions } as any);
  }, [editorStore, stableActions]);
}

