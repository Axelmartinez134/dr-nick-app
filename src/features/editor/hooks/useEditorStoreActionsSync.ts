import { useLayoutEffect, useMemo, useRef } from "react";

type Args = {
  editorStore: any;

  // Current dependency list (kept intentionally identical to EditorShell’s original effect).
  archiveProjectBusy: boolean;
  archiveProjectById: (projectId: string, title: string) => Promise<void> | void;
  createNewProject: (templateTypeId: "regular" | "enhanced") => Promise<void> | void;
  currentProjectId: string | null;
  handleDownloadAll: () => Promise<void> | void;
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
  projectsDropdownOpen: boolean;
  // Included only to preserve dependency semantics (even if unused in the body).
  saveProjectMetaForProject: any;
  updateProjectColors: (bg: string, text: string) => void;

  // Captured values used inside actions (kept as-is; not added to deps to avoid behavior changes).
  setProjectTitle: (next: string) => void;
  scheduleDebouncedProjectTitleSave: (args: { projectId: string | null; title: string; debounceMs: number }) => void;
  setNewProjectTemplateTypeId: (next: "regular" | "enhanced") => void;
  setSlides: any;
  setTemplateSettingsOpen: (next: boolean) => void;
  setPromptModalOpen: (next: boolean) => void;
  setPromptModalSection: (next: "prompt" | "emphasis" | "image") => void;
  setTemplateEditorOpen: (next: boolean) => void;
  promptDirtyRef: any;
  setTemplateTypePrompt: (next: string) => void;
  setTemplateTypeEmphasisPrompt: (next: string) => void;
  setTemplateTypeImageGenPrompt: (next: string) => void;
  setHeadlineFontFamily: (next: string) => void;
  setHeadlineFontWeight: (next: number) => void;
  setBodyFontFamily: (next: string) => void;
  setBodyFontWeight: (next: number) => void;
  projectTextColorForUpdate: string;
  projectBackgroundColorForUpdate: string;
  setProjectsDropdownOpen: (next: boolean | ((prev: boolean) => boolean)) => void;
  setMobileDrawerOpen: (next: boolean) => void;
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
  onClickGenerateAiImage: () => void;
  onClickGenerateCopy: () => void;
  onClickRetry: () => void;
  onClickRealignText: () => void;
  onClickUndo: () => void;
  onClickToggleOverlays: () => void;
  onClickCopyCaption: () => void;
  onChangeCaption: (next: string) => void;
  setShowDebugPreview: (next: boolean) => void;
  setActiveSlideImageBgRemoval: (nextEnabled: boolean) => void;
  deleteImageForActiveSlide: (source: "menu" | "button") => void;
};

export function useEditorStoreActionsSync(args: Args) {
  const {
    editorStore,
    archiveProjectBusy,
    archiveProjectById,
    createNewProject,
    currentProjectId,
    handleDownloadAll,
    handleNewCarousel,
    handleShareAll,
    handleSignOut,
    isMobile,
    loadProject,
    newProjectTemplateTypeId,
    persistCurrentProjectTemplateMappings,
    projectBackgroundColor,
    projectTextColor,
    projectsDropdownOpen,
    saveProjectMetaForProject,
    updateProjectColors,

    setProjectTitle,
    scheduleDebouncedProjectTitleSave,
    setNewProjectTemplateTypeId,
    setSlides,
    setTemplateSettingsOpen,
    setPromptModalOpen,
    setPromptModalSection,
    setTemplateEditorOpen,
    promptDirtyRef,
    setTemplateTypePrompt,
    setTemplateTypeEmphasisPrompt,
    setTemplateTypeImageGenPrompt,
    setHeadlineFontFamily,
    setHeadlineFontWeight,
    setBodyFontFamily,
    setBodyFontWeight,
    projectTextColorForUpdate,
    projectBackgroundColorForUpdate,
    setProjectsDropdownOpen,
    setMobileDrawerOpen,
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
    onClickGenerateAiImage,
    onClickGenerateCopy,
    onClickRetry,
    onClickRealignText,
    onClickUndo,
    onClickToggleOverlays,
    onClickCopyCaption,
    onChangeCaption,
    setShowDebugPreview,
    setActiveSlideImageBgRemoval,
    deleteImageForActiveSlide,
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
    onShareAll: () => void handleShareAll(),
    onSignOut: () => void handleSignOut(),

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

    onOpenPromptModal: (section: "prompt" | "emphasis" | "image") => {
      setPromptModalSection(section);
      setPromptModalOpen(true);
      editorStore.setState({ promptModalSection: section, promptModalOpen: true } as any);
    },
    onClosePromptsModal: () => {
      setPromptModalOpen(false);
      editorStore.setState({ promptModalOpen: false } as any);
    },
    onChangeTemplateTypePrompt: (next: string) => {
      promptDirtyRef.current = true;
      setTemplateTypePrompt(next);
      // Keep store in sync immediately so the textarea caret doesn't jump.
      editorStore.setState({
        templateTypePrompt: next,
        templateTypePromptPreviewLine: String(next || "").split("\n")[0] || "",
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
    onClickGenerateAiImage: () => onClickGenerateAiImage(),
    onClickGenerateCopy: () => onClickGenerateCopy(),
    onClickRetry: () => onClickRetry(),
    onClickRealignText: () => onClickRealignText(),
    onClickUndo: () => onClickUndo(),
    onClickToggleOverlays: () => onClickToggleOverlays(),
    onClickCopyCaption: () => onClickCopyCaption(),
    onChangeCaption: (next: string) => onChangeCaption(next),
    setShowDebugPreview: (next: boolean) => setShowDebugPreview(next),
    setActiveSlideImageBgRemoval: (nextEnabled: boolean) => setActiveSlideImageBgRemoval(nextEnabled),
    deleteImageForActiveSlide: (source: "menu" | "button") => deleteImageForActiveSlide(source),
  };

  const stableActions = useMemo(
    () => ({
      onChangeProjectTitle: (v: string) => implRef.current?.onChangeProjectTitle?.(v),
      onDownloadAll: () => implRef.current?.onDownloadAll?.(),
      onShareAll: () => implRef.current?.onShareAll?.(),
      onSignOut: () => implRef.current?.onSignOut?.(),

      onChangeNewProjectTemplateTypeId: (next: "regular" | "enhanced") =>
        implRef.current?.onChangeNewProjectTemplateTypeId?.(next),
      onClickNewProject: () => implRef.current?.onClickNewProject?.(),

      onOpenTemplateSettings: () => implRef.current?.onOpenTemplateSettings?.(),
      onCloseTemplateSettings: () => implRef.current?.onCloseTemplateSettings?.(),
      onOpenTemplateEditor: () => implRef.current?.onOpenTemplateEditor?.(),

      onOpenPromptModal: (section: "prompt" | "emphasis" | "image") => implRef.current?.onOpenPromptModal?.(section),
      onClosePromptsModal: () => implRef.current?.onClosePromptsModal?.(),
      onChangeTemplateTypePrompt: (next: string) => implRef.current?.onChangeTemplateTypePrompt?.(next),
      onChangeTemplateTypeEmphasisPrompt: (next: string) => implRef.current?.onChangeTemplateTypeEmphasisPrompt?.(next),
      onChangeTemplateTypeImageGenPrompt: (next: string) => implRef.current?.onChangeTemplateTypeImageGenPrompt?.(next),

      onChangeHeadlineFontKey: (raw: string) => implRef.current?.onChangeHeadlineFontKey?.(raw),
      onChangeBodyFontKey: (raw: string) => implRef.current?.onChangeBodyFontKey?.(raw),
      onChangeBackgroundColor: (next: string) => implRef.current?.onChangeBackgroundColor?.(next),
      onChangeTextColor: (next: string) => implRef.current?.onChangeTextColor?.(next),

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
      onClickGenerateAiImage: () => implRef.current?.onClickGenerateAiImage?.(),
      onClickGenerateCopy: () => implRef.current?.onClickGenerateCopy?.(),
      onClickRetry: () => implRef.current?.onClickRetry?.(),
      onClickRealignText: () => implRef.current?.onClickRealignText?.(),
      onClickUndo: () => implRef.current?.onClickUndo?.(),
      onClickToggleOverlays: () => implRef.current?.onClickToggleOverlays?.(),
      onClickCopyCaption: () => implRef.current?.onClickCopyCaption?.(),
      onChangeCaption: (next: string) => implRef.current?.onChangeCaption?.(next),
      setShowDebugPreview: (next: boolean) => implRef.current?.setShowDebugPreview?.(next),
      setActiveSlideImageBgRemoval: (nextEnabled: boolean) => implRef.current?.setActiveSlideImageBgRemoval?.(nextEnabled),
      deleteImageForActiveSlide: (source: "menu" | "button") => implRef.current?.deleteImageForActiveSlide?.(source),
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

