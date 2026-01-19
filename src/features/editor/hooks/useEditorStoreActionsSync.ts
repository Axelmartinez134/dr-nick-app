import { useLayoutEffect } from "react";

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
  } = args;

  // Phase 2B: store-driven UI (components read from store; behavior remains in EditorShell).
  // NOTE: dependency list is intentionally kept identical to the pre-extraction code.
  useLayoutEffect(() => {
    editorStore.setState({
      actions: {
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
      },
    } as any);
  }, [
    archiveProjectBusy,
    archiveProjectById,
    createNewProject,
    currentProjectId,
    editorStore,
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
  ]);
}

