export type TemplateTypeId = "regular" | "enhanced";
export type PromptSection = "prompt" | "emphasis" | "image" | "caption";
export type ProjectBackgroundEffectType = "none" | "dots_n8n";

// Phase 4: Theme ids are lightweight strings (registry-backed for now).
export type ProjectThemeId = "n8n_dots_dark";

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
  onDownloadPdf: () => void;
  onShareAll: () => void;
  onOpenShareCarousels: () => void;
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
  onChangeCaptionRegenPrompt: (next: string) => void;

  // Typography/colors
  onChangeHeadlineFontKey: (nextKey: string) => void;
  onChangeBodyFontKey: (nextKey: string) => void;
  onChangeBackgroundColor: (next: string) => void;
  onChangeTextColor: (next: string) => void;
  onChangeBackgroundEffectEnabled: (next: boolean) => void;
  onChangeBackgroundEffectType: (next: ProjectBackgroundEffectType) => void;
  onSelectTheme: (next: "custom" | ProjectThemeId) => void;
  onResetThemeDefaults: () => void;

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

  // Bottom panel + slide-level controls
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
  onClickRegenerateCaption: () => void;
  onChangeCaption: (next: string) => void;

  // Brand Alignment (Phase 0)
  onOpenBrandAlignmentModal: () => void;
  onCloseBrandAlignmentModal: () => void;
  onChangeBrandAlignmentPrompt: (next: string) => void;

  // Review / Approval (Phase 2)
  setIsSuperadmin: (next: boolean) => void;
  onCloseShareCarousels: () => void;
  onRefreshShareCarousels: () => Promise<void> | void;
  onClickCopyShareCarouselsLink: () => Promise<void> | void;
  onToggleProjectReviewReady: (args: { projectId: string; next: boolean }) => Promise<boolean | void> | void;
  onToggleProjectReviewPosted: (args: { projectId: string; next: boolean }) => Promise<boolean | void> | void;
  onToggleProjectReviewApproved: (args: { projectId: string; next: boolean }) => Promise<boolean | void> | void;
  onToggleProjectReviewScheduled: (args: { projectId: string; next: boolean }) => Promise<boolean | void> | void;
  onChangeProjectReviewSource: (args: { projectId: string; next: string }) => Promise<boolean | void> | void;

  setShowDebugPreview: (next: boolean) => void;

  setActiveSlideImageBgRemoval: (nextEnabled: boolean) => void;
  deleteImageForActiveSlide: (source: "menu" | "button") => void;

  // Image Library modal (Phase 1)
  onOpenImageLibraryModal: () => void;
  onCloseImageLibraryModal: () => void;
  onToggleImageLibraryBgRemovalAtInsert: () => void;

  // Ideas modal (Phase 1)
  onOpenIdeasModal: () => void;
  onCloseIdeasModal: () => void;

  // Accounts (Phase 1: UI shell only)
  onOpenCreateAccountModal: () => void;
  onCloseCreateAccountModal: () => void;
  onOpenDeleteAccountModal: () => void;
  onCloseDeleteAccountModal: () => void;
  // Brand Alignment (Phase 1)
  onClickRunBrandAlignmentCheck: () => void;
  fetchIdeaSourcesAndIdeas: (includeDismissed?: boolean) => Promise<
    Array<{
      id: string;
      sourceTitle: string;
      sourceUrl: string;
      lastGeneratedAt: string | null;
      createdAt: string | null;
      updatedAt: string | null;
      ideas: Array<{
        id: string;
        source_id: string;
        run_id: string;
        title: string;
        bullets: any;
        status: string;
        approved_sort_index: number | null;
        created_at: string;
        updated_at: string;
      }>;
    }>
  >;

  // Ideas (Phase 2)
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
  createCarouselFromIdea: (args: { ideaId: string; templateTypeId: TemplateTypeId }) => Promise<{ projectId: string }>;
  fetchProjectJobStatus: (args: { projectId: string; jobType?: string }) => Promise<any>;
  fetchIdeaCarouselRuns: (ideaIds: string[]) => Promise<Record<string, { projectId: string; createdAt: string }>>;

  // Image Library recents (Phase 2)
  fetchRecentAssets: (limit?: number) => Promise<
    Array<{
      id: string;
      url: string;
      storage_bucket: string | null;
      storage_path: string | null;
      kind: string;
      last_used_at: string;
      use_count: number;
    }>
  >;
  onInsertRecentImage: (asset: {
    id: string;
    url: string;
    storage_bucket?: string | null;
    storage_path?: string | null;
    kind?: string | null;
  }) => Promise<void> | void;

  // Logos (Phase 3C: read-only)
  fetchLogoTags: (args: {
    source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
    limit?: number;
  }) => Promise<Array<{ tag: string; count: number }>>;
  searchLogoVariants: (args: {
    source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
    q?: string;
    tag?: string | null;
    limit?: number;
  }) => Promise<
    Array<{
      source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
      sourceKey: string;
      title: string;
      websiteDomain: string | null;
      tags: string[];
      variantKey: string;
      remoteUrl: string;
      format: 'svg' | 'other';
    }>
  >;

  // Logos (Global search: all providers; grouped by provider; hard cap 20 total tiles)
  searchLogoVariantsGlobal: (args: { q: string; limit?: number }) => Promise<
    Array<{
      source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
      rowsMatched: number;
      tiles: Array<{
        source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
        sourceKey: string;
        title: string;
        websiteDomain: string | null;
        tags: string[];
        variantKey: string;
        remoteUrl: string;
        format: 'svg' | 'other';
      }>;
    }>
  >;

  // Logos (Phase 3D: import + global cache; still no insertion)
  importLogoVariant: (args: {
    source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
    sourceKey: string;
    variantKey: string;
    remoteUrl: string;
  }) => Promise<{ cached: boolean; assetUrl: string; storage: { bucket: string; path: string } }>;

  // Logos (Phase 3E: insert into canvas + recents)
  insertCachedLogoToActiveSlide: (args: {
    url: string;
    storage: { bucket: string; path: string };
    source: 'vectorlogozone' | 'lobe-icons' | 'developer-icons' | 'svgporn' | 'gilbarbara' | 'simple-icons';
    sourceKey: string;
    variantKey: string;
  }) => Promise<void>;
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
  uploadImageForActiveSlide: (file: File, opts?: { bgRemovalEnabledAtInsert?: boolean }) => void;
  handleUserImageChange: (payload: any) => void;
  handleUserExtraImageChange: (payload: any) => void;

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

// Phase 5E4: replace `workspace` blob mirroring with smaller slices.
export type EditorWorkspaceUiState = {
  CarouselPreviewVision: any;
  SlideCard: any;
  templateSnapshots: Record<string, any>;
  layoutData: any;
  EMPTY_LAYOUT: any;
  slides: any[];
  showLayoutOverlays: boolean;
  addLog?: ((msg: string) => void) | undefined;

  // Image menu / busy state
  imageMenuOpen: boolean;
  imageMenuPos: { x: number; y: number } | null;
  imageMenuInfo?: {
    hasAnySelectedImage: boolean;
    selectedStickerIds: string[];
    selectedPrimary: boolean;
    canSetAsPrimary: boolean;
    singleStickerId: string | null;
  } | null;
  imageBusy: boolean;
};

export type EditorWorkspaceActionsState = {
  computeTemplateIdForSlide: (slideIndex: number) => string | null;

  hasImageForActiveSlide: () => boolean;
  deleteImageForActiveSlide: (source: "menu" | "button") => void;
  uploadImageForActiveSlide: (file: File) => void;
  handleUserImageChange: (payload: any) => void;
  handleUserExtraImageChange: (payload: any) => void;
  openImageMenu: (x: number, y: number) => void;
  setSelectedStickerAsPrimary: () => void;

  onUserTextChangeRegular: (change: any) => void;
  onUserTextChangeEnhanced: (change: any) => void;

  onMobileViewportPointerDown: (e: any) => void;
  onMobileViewportPointerMove: (e: any) => void;
  onMobileViewportPointerUp: (e: any) => void;
  onMobileViewportPointerCancel: (e: any) => void;

  renderActiveSlideControlsRow: () => any;
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
  captionRegenGenerating: boolean;
  captionRegenError: string | null;
  onClickCopyCaption: () => void;
  onClickRegenerateCaption: () => void;
  onChangeCaption: (next: string) => void;

  // Debug card
  debugScreenshot: string | null;
  showDebugPreview: boolean;
  setShowDebugPreview: (next: boolean) => void;
  debugLogs: string[];
};

// Phase 5E3: replace `bottomPanel` blob mirroring with smaller slices.
export type EditorBottomPanelUiState = {
  // Core state
  activeSlideIndex: number;
  slideCount: number;
  currentProjectId: string | null;
  loading: boolean;
  switchingSlides: boolean;
  copyGenerating: boolean;
  enhancedLockOn: boolean;

  // Data needed for rendering
  slides: any[];
  layoutData: any;
  inputData: any;
  layoutHistoryLength: number;
  showLayoutOverlays: boolean;

  // Debug/log
  addLog: (msg: string) => void;

  // AI image prompt card (Enhanced)
  aiImagePromptSaveStatus: "idle" | "saving" | "saved" | "error";
  imagePromptGenerating: boolean;
  imagePromptError: string | null;
  aiImageGeneratingThis: boolean;
  aiImageProgressThis: number;
  aiImageStatusThis: string | null;
  aiImageErrorThis: string | null;

  // Controls card
  copyProgressIcon?: any;
  copyError: string | null;
  saveError: string | null;
  error: string | null;

  // Image controls (Enhanced)
  activeImageSelected: boolean;
  imageBusy: boolean;
  aiKey: (projectId: string, slideIndex: number) => string;
  bgRemovalBusyKeys: Set<string>;

  // Caption
  captionDraft: string;
  captionCopyStatus: "idle" | "copied" | "error";
  captionRegenGenerating: boolean;
  captionRegenError: string | null;

  // Debug card
  debugScreenshot: string | null;
  showDebugPreview: boolean;
  debugLogs: string[];
};

export type EditorState = {
  // Top bar
  titleText: string;
  projectTitle: string;
  projectTitleDisabled: boolean;
  isMobile: boolean;
  isSuperadmin: boolean;
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
  imageLibraryModalOpen: boolean;
  imageLibraryBgRemovalEnabledAtInsert: boolean;
  ideasModalOpen: boolean;
  createAccountModalOpen: boolean;
  deleteAccountModalOpen: boolean;
  brandAlignmentModalOpen: boolean;
  shareCarouselsModalOpen: boolean;

  // Review / Approval (project-level; for the currently loaded project)
  reviewReady: boolean;
  reviewPosted: boolean;
  reviewApproved: boolean;
  reviewScheduled: boolean;
  reviewComment: string;
  reviewSource: string;

  // Share Carousels modal data (superadmin-only)
  shareCarouselsLinkPath: string | null;
  shareCarouselsLinkLoading: boolean;
  shareCarouselsLinkError: string | null;
  shareCarouselsProjectsLoading: boolean;
  shareCarouselsProjectsError: string | null;
  shareCarouselsProjects: Array<{
    id: string;
    title: string;
    updated_at: string;
    review_ready: boolean;
    review_posted: boolean;
    review_approved: boolean;
    review_scheduled: boolean;
  }>;
  shareCarouselsSavingIds: Set<string>;

  // Prompt values (template-type overrides)
  templateTypePrompt: string;
  templateTypeEmphasisPrompt: string;
  templateTypeImageGenPrompt: string;
  // Caption regen prompt (global per-user; stored on editor_users)
  captionRegenPrompt: string;
  captionRegenPromptSaveStatus: PromptSaveStatus;
  captionRegenPromptSaveError: string | null;
  // Brand alignment prompt (per-account)
  brandAlignmentPrompt: string;
  brandAlignmentPromptSaveStatus: PromptSaveStatus;
  brandAlignmentPromptSaveError: string | null;
  brandAlignmentRunStatus: "idle" | "running" | "done" | "error";
  brandAlignmentRunError: string | null;
  brandAlignmentLatestResult: any | null;
  // Brand alignment run history (Phase 2)
  brandAlignmentRunsStatus: "idle" | "loading" | "done" | "error";
  brandAlignmentRunsError: string | null;
  brandAlignmentRuns: any[];

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
  projectBackgroundEffectEnabled: boolean;
  projectBackgroundEffectType: ProjectBackgroundEffectType;
  projectBackgroundEffectSettings: any;

  // Theme provenance (project-wide; persisted on carousel_projects)
  themeIdLastApplied: string | null;
  themeIsCustomized: boolean;
  themeDefaultsSnapshot: any | null;
  lastManualBackgroundColor: string | null;
  lastManualTextColor: string | null;

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
  // Workspace slices (Phase 5E4): step toward deleting the `workspace` blob mirror.
  workspaceUi: EditorWorkspaceUiState | null;
  workspaceActions: EditorWorkspaceActionsState | null;

  // Bottom panel bindings (Phase 2D)
  bottomPanel: EditorBottomPanelState | null;
  // Bottom panel slices (Phase 5E3): step toward deleting the `bottomPanel` blob mirror.
  bottomPanelUi: EditorBottomPanelUiState | null;

  actions: EditorActions;
};

export type EditorStore = {
  getState: () => EditorState;
  setState: (updater: Partial<EditorState> | ((prev: EditorState) => Partial<EditorState>)) => void;
  subscribe: (listener: () => void) => () => void;
};

