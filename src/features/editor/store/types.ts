export type TemplateTypeId = "regular" | "enhanced";
export type PromptSection = "prompt" | "emphasis" | "image";

export type EngineSaveStatus = "idle" | "editing" | "saving" | "saved" | "error";
export type SimpleSaveStatus = "idle" | "saving" | "saved" | "error";
export type PromptSaveStatus = "idle" | "saving" | "saved" | "error";

export type TemplateListItem = { id: string; name: string };

export type SavedProjectListItem = {
  id: string;
  title: string;
  template_type_id: string;
  updated_at: string;
};

export type EditorActions = {
  // Top bar
  onChangeProjectTitle: (next: string) => void;
  onDownloadAll: () => void;
  onShareAll: () => void;
  onSignOut: () => void;

  // Project card
  onChangeNewProjectTemplateTypeId: (next: TemplateTypeId) => void;
  onClickNewProject: () => void;

  // Templates + prompts
  onOpenTemplateSettings: () => void;
  onCloseTemplateSettings: () => void;
  onOpenTemplateEditor: () => void;

  onOpenPromptModal: (section: PromptSection) => void;
  onClosePromptsModal: () => void;
  onChangeTemplateTypePrompt: (next: string) => void;
  onChangeTemplateTypeEmphasisPrompt: (next: string) => void;
  onChangeTemplateTypeImageGenPrompt: (next: string) => void;

  // Typography/colors
  onChangeHeadlineFontKey: (nextKey: string) => void;
  onChangeBodyFontKey: (nextKey: string) => void;
  onChangeBackgroundColor: (next: string) => void;
  onChangeTextColor: (next: string) => void;

  // Saved projects
  onToggleProjectsDropdown: () => void;
  onLoadProject: (projectId: string) => void;
  onRequestArchive: (target: { id: string; title: string }) => void;
  onCancelArchive: () => void;
  onConfirmArchive: (target: { id: string; title: string }) => void;

  // Template mappings (template-type overrides)
  onChangeTemplateTypeMappingSlide1: (next: string | null) => void;
  onChangeTemplateTypeMappingSlide2to5: (next: string | null) => void;
  onChangeTemplateTypeMappingSlide6: (next: string | null) => void;
};

export type EditorWorkspaceState = {
  // Layout/template/canvas
  CarouselPreviewVision: any;
  SlideCard: any;
  templateSnapshots: Record<string, any>;
  computeTemplateIdForSlide: (slideIndex: number) => string | null;
  layoutData: any;
  EMPTY_LAYOUT: any;
  slides: any[];
  showLayoutOverlays: boolean;
  addLog?: ((msg: string) => void) | undefined;

  // Image ops
  imageMenuOpen: boolean;
  imageMenuPos: { x: number; y: number } | null;
  imageBusy: boolean;
  hasImageForActiveSlide: () => boolean;
  deleteImageForActiveSlide: (source: "menu" | "button") => void;
  uploadImageForActiveSlide: (file: File) => void;
  handleUserImageChange: (payload: any) => void;

  onUserTextChangeRegular: (change: any) => void;
  onUserTextChangeEnhanced: (change: any) => void;

  // Mobile swipe helpers (kept external so behavior stays identical)
  onMobileViewportPointerDown: (e: any) => void;
  onMobileViewportPointerMove: (e: any) => void;
  onMobileViewportPointerUp: (e: any) => void;
  onMobileViewportPointerCancel: (e: any) => void;

  // Desktop active under-card controls row is passed through (kept in EditorShell for now)
  renderActiveSlideControlsRow: () => any;
};

// Phase 5D: reduce the giant `workspace` mirror into smaller store slices.
export type EditorWorkspaceNavState = {
  slideCount: number;
  activeSlideIndex: number;
  copyGenerating: boolean;
  viewportWidth: number;
  goPrev: () => void;
  goNext: () => void;
  switchToSlide: (nextIndex: number) => Promise<void> | void;
  VIEWPORT_PAD: number;
  translateX: number;
  totalW: number;
};

export type EditorWorkspaceRefsState = {
  viewportRef: any;
  imageFileInputRef: any;
  slideCanvasRefs: any;
  slideRefs: any;
  canvasRef: any;
  lastActiveFabricCanvasRef: any;
  setActiveCanvasNonce: any;
};

export type EditorBottomPanelState = {
  // Core state
  activeSlideIndex: number;
  slideCount: number;
  currentProjectId: string | null;
  loading: boolean;
  switchingSlides: boolean;
  copyGenerating: boolean;
  enhancedLockOn: boolean;

  // Data
  slides: any[];
  layoutData: any;
  inputData: any;
  layoutHistoryLength: number;
  showLayoutOverlays: boolean;

  // Debug/log
  addLog: (msg: string) => void;

  // Headline UI (Enhanced)
  onChangeHeadlineFontSize: (e: any) => void;
  onClickHeadlineAlign: (align: "left" | "center" | "right") => void;
  onChangeHeadlineRichText: (next: any) => void;

  // Body UI
  onChangeBodyFontSize: (e: any) => void;
  onClickBodyAlign: (align: "left" | "center" | "right") => void;
  onChangeBodyRichText: (next: any) => void;

  // AI image prompt card (Enhanced)
  aiImagePromptSaveStatus: "idle" | "saving" | "saved" | "error";
  imagePromptGenerating: boolean;
  imagePromptError: string | null;
  onClickRegenerateImagePrompt: () => void;
  onChangeAiImagePrompt: (next: string) => void;
  onClickGenerateAiImage: () => void;
  aiImageGeneratingThis: boolean;
  aiImageProgressThis: number;
  aiImageStatusThis: string | null;
  aiImageErrorThis: string | null;

  // Controls card
  copyProgressIcon?: any;
  onClickGenerateCopy: () => void;
  copyError: string | null;
  saveError: string | null;
  error: string | null;
  onClickRetry: () => void;

  // Image controls (Enhanced)
  activeImageSelected: boolean;
  imageBusy: boolean;
  aiKey: (projectId: string, slideIndex: number) => string;
  bgRemovalBusyKeys: Set<string>;
  setActiveSlideImageBgRemoval: (nextEnabled: boolean) => void;
  deleteImageForActiveSlide: (source: "menu" | "button") => void;

  // Layout controls
  realigning: boolean;
  onClickRealignText: () => void;
  onClickUndo: () => void;
  onClickToggleOverlays: () => void;

  // Caption
  captionDraft: string;
  captionCopyStatus: "idle" | "copied" | "error";
  onClickCopyCaption: () => void;
  onChangeCaption: (next: string) => void;

  // Debug card
  debugScreenshot: string | null;
  showDebugPreview: boolean;
  setShowDebugPreview: (next: boolean) => void;
  debugLogs: string[];
};

export type EditorState = {
  // Top bar
  titleText: string;
  projectTitle: string;
  projectTitleDisabled: boolean;
  isMobile: boolean;
  topExporting: boolean;

  engineSaveStatus: EngineSaveStatus;
  promptSaveStatus: PromptSaveStatus;
  projectSaveStatus: SimpleSaveStatus;
  slideSaveStatus: SimpleSaveStatus;

  // Project
  currentProjectId: string | null;
  activeSlideIndex: number;
  templateTypeId: TemplateTypeId;
  newProjectTemplateTypeId: TemplateTypeId;
  switchingSlides: boolean;
  loading: boolean;

  // Template card previews
  templateTypePromptPreviewLine: string;
  templateTypeEmphasisPromptPreviewLine: string;
  templateTypeImageGenPromptPreviewLine: string;

  // Modals
  templateSettingsOpen: boolean;
  promptModalOpen: boolean;
  promptModalSection: PromptSection;

  // Prompt values (template-type overrides)
  templateTypePrompt: string;
  templateTypeEmphasisPrompt: string;
  templateTypeImageGenPrompt: string;

  // Template mappings (template-type overrides)
  templateTypeMappingSlide1: string | null;
  templateTypeMappingSlide2to5: string | null;
  templateTypeMappingSlide6: string | null;

  // Templates list (for modals)
  loadingTemplates: boolean;
  templates: TemplateListItem[];

  // Typography
  fontOptions: Array<{ label: string; family: string; weight: number }>;
  headlineFontKey: string;
  bodyFontKey: string;

  // Colors
  projectBackgroundColor: string;
  projectTextColor: string;

  // Saved projects
  projects: SavedProjectListItem[];
  projectsLoading: boolean;
  projectsDropdownOpen: boolean;
  archiveProjectModalOpen: boolean;
  archiveProjectTarget: { id: string; title: string } | null;
  archiveProjectBusy: boolean;

  // Workspace (slides strip/canvas) bindings (Phase 2C)
  workspace: EditorWorkspaceState | null;
  // Workspace slices (Phase 5D): step toward deleting the giant `workspace` mirror.
  workspaceNav: EditorWorkspaceNavState | null;
  workspaceRefs: EditorWorkspaceRefsState | null;

  // Bottom panel bindings (Phase 2D)
  bottomPanel: EditorBottomPanelState | null;

  actions: EditorActions;
};

export type EditorStore = {
  getState: () => EditorState;
  setState: (updater: Partial<EditorState> | ((prev: EditorState) => Partial<EditorState>)) => void;
  subscribe: (listener: () => void) => () => void;
};

