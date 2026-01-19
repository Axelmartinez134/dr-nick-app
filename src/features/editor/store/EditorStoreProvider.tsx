import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { createEditorStore } from "./editorStore";
import type { EditorActions, EditorState, EditorStore } from "./types";

const noopActions: EditorActions = {
  onChangeProjectTitle: () => {},
  onDownloadAll: () => {},
  onShareAll: () => {},
  onSignOut: () => {},
  onChangeNewProjectTemplateTypeId: () => {},
  onClickNewProject: () => {},
  onOpenTemplateSettings: () => {},
  onCloseTemplateSettings: () => {},
  onOpenTemplateEditor: () => {},
  onOpenPromptModal: () => {},
  onClosePromptsModal: () => {},
  onChangeTemplateTypePrompt: () => {},
  onChangeTemplateTypeEmphasisPrompt: () => {},
  onChangeTemplateTypeImageGenPrompt: () => {},
  onChangeHeadlineFontKey: () => {},
  onChangeBodyFontKey: () => {},
  onChangeBackgroundColor: () => {},
  onChangeTextColor: () => {},
  onToggleProjectsDropdown: () => {},
  onLoadProject: () => {},
  onRequestArchive: () => {},
  onCancelArchive: () => {},
  onConfirmArchive: () => {},
  onChangeTemplateTypeMappingSlide1: () => {},
  onChangeTemplateTypeMappingSlide2to5: () => {},
  onChangeTemplateTypeMappingSlide6: () => {},

  onChangeHeadlineFontSize: () => {},
  onClickHeadlineAlign: () => {},
  onChangeHeadlineRichText: () => {},
  onChangeBodyFontSize: () => {},
  onClickBodyAlign: () => {},
  onChangeBodyRichText: () => {},
  onClickRegenerateImagePrompt: () => {},
  onChangeAiImagePrompt: () => {},
  onClickGenerateAiImage: () => {},
  onClickGenerateCopy: () => {},
  onClickRetry: () => {},
  onClickRealignText: () => {},
  onClickUndo: () => {},
  onClickToggleOverlays: () => {},
  onClickCopyCaption: () => {},
  onChangeCaption: () => {},
  setShowDebugPreview: () => {},
  setActiveSlideImageBgRemoval: () => {},
  deleteImageForActiveSlide: () => {},
};

const defaultState: EditorState = {
  titleText: "The Fittest You - AI Carousel Generator",
  projectTitle: "Untitled Project",
  projectTitleDisabled: false,
  isMobile: false,
  topExporting: false,
  engineSaveStatus: "idle",
  promptSaveStatus: "idle",
  projectSaveStatus: "idle",
  slideSaveStatus: "idle",
  currentProjectId: null,
  activeSlideIndex: 0,
  templateTypeId: "regular",
  newProjectTemplateTypeId: "enhanced",
  switchingSlides: false,
  loading: false,
  templateTypePromptPreviewLine: "",
  templateTypeEmphasisPromptPreviewLine: "",
  templateTypeImageGenPromptPreviewLine: "",
  templateSettingsOpen: false,
  promptModalOpen: false,
  promptModalSection: "prompt",
  templateTypePrompt: "",
  templateTypeEmphasisPrompt: "",
  templateTypeImageGenPrompt: "",
  templateTypeMappingSlide1: null,
  templateTypeMappingSlide2to5: null,
  templateTypeMappingSlide6: null,
  loadingTemplates: false,
  templates: [],
  fontOptions: [],
  headlineFontKey: "",
  bodyFontKey: "",
  projectBackgroundColor: "#ffffff",
  projectTextColor: "#000000",
  projects: [],
  projectsLoading: false,
  projectsDropdownOpen: false,
  archiveProjectModalOpen: false,
  archiveProjectTarget: null,
  archiveProjectBusy: false,
  workspace: null,
  workspaceNav: null,
  workspaceRefs: null,
  workspaceUi: null,
  workspaceActions: null,
  bottomPanel: null,
  bottomPanelUi: null,
  actions: noopActions,
};

const EditorStoreContext = createContext<EditorStore | null>(null);

export function EditorStoreProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createEditorStore(defaultState), []);
  return <EditorStoreContext.Provider value={store}>{children}</EditorStoreContext.Provider>;
}

export function useEditorStore(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) {
    throw new Error("useEditorStore must be used within EditorStoreProvider");
  }
  return store;
}

