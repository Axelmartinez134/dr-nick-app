"use client";

import { createRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./EditorShell.module.css";
import dynamic from "next/dynamic";
import { useCarouselEditorEngine } from "../components/health/marketing/ai-carousel/useCarouselEditorEngine";
import type { CarouselTextRequest, TextStyle } from "@/lib/carousel-types";
import type { VisionLayoutDecision } from "@/lib/carousel-types";
import { wrapFlowLayout } from "@/lib/wrap-flow-layout";
import TemplateEditorModal from "../components/health/marketing/ai-carousel/TemplateEditorModal";
import { ensureTypographyFontsLoaded, estimateAvgCharWidthEm, estimateAvgCharWidthEmRelaxed } from "../components/health/marketing/ai-carousel/fontMetrics";
import { supabase, useAuth } from "../components/auth/AuthContext";
import { RichTextInput, type InlineStyleRange } from "./RichTextInput";
import { remapRangesByDiff } from "@/lib/text-placement";
import JSZip from "jszip";
import { AdvancedLayoutControls } from "./AdvancedLayoutControls";

// Minimal layout used to render templates even before any text/image layout is generated.
const EMPTY_LAYOUT: any = {
  canvas: { width: 1080, height: 1440 },
  textLines: [],
  margins: { top: 60, right: 60, bottom: 60, left: 60 },
};

function SlideCard({
  index,
  active,
  children,
}: {
  index: number;
  active: boolean;
  children?: React.ReactNode;
}) {
  const isPrimary = index === 1;
  return (
    <div
      className={[
        "relative flex-shrink-0 bg-white rounded-sm shadow-[0_10px_30px_rgba(2,6,23,0.10)] border border-slate-200 overflow-hidden",
        "w-[420px] h-[560px]", // 1080x1440 scaled (3:4)
        active ? "ring-2 ring-violet-500 border-violet-300" : "",
        // Keep non-selected slides fully opaque; selection is indicated via ring only.
        !active ? "cursor-pointer" : "",
      ].join(" ")}
      aria-label={`Slide ${index}`}
    >
      {children ? (
        children
      ) : (
        <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
          {isPrimary ? "Slide 1 (placeholder shell)" : `Slide ${index} (placeholder)`}
        </div>
      )}
    </div>
  );
}

// Fabric-dependent components should be dynamically imported (client-only).
const CarouselPreviewVision = dynamic(
  () => import("../components/health/marketing/ai-carousel/CarouselPreviewVision"),
  {
    ssr: false,
  }
);
const ExportButton = dynamic(
  () => import("../components/health/marketing/ai-carousel/ExportButton"),
  { ssr: false }
);
const TextStylingToolbar = dynamic(
  () => import("../components/health/marketing/ai-carousel/TextStylingToolbar"),
  { ssr: false }
);

export default function EditorShell() {
  const { user, signOut } = useAuth();
  const slideCount = 6;
  const [activeSlideIndex, setActiveSlideIndex] = useState(0); // 0..5
  const [switchingSlides, setSwitchingSlides] = useState(false);
  const [topExporting, setTopExporting] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>("Untitled Project");
  const [templateTypeId, setTemplateTypeId] = useState<"regular" | "enhanced">("regular");
  // UX: Template Type is chosen ONLY when creating a new project (never mutates an existing project).
  // Defaults to Enhanced on each /editor load.
  const [newProjectTemplateTypeId, setNewProjectTemplateTypeId] = useState<"regular" | "enhanced">("enhanced");
  const [templateSettingsOpen, setTemplateSettingsOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; title: string; template_type_id: string; updated_at: string }>>([]);
  const [projectsDropdownOpen, setProjectsDropdownOpen] = useState(false);
  const [projectSaveStatus, setProjectSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const projectSaveTimeoutRef = useRef<number | null>(null);
  const [slideSaveStatus, setSlideSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const slideSaveTimeoutRef = useRef<number | null>(null);
  const layoutDirtyRef = useRef(false);
  const layoutSaveTimeoutRef = useRef<number | null>(null);
  const LIVE_LAYOUT_DEBOUNCE_MS = 500;
  type LiveLayoutWorkItem = {
    key: string; // projectId:slideIndex
    runId: number;
    projectId: string;
    slideIndex: number;
    templateTypeId: "regular" | "enhanced";
    templateId: string | null;
    templateSnapshot: any | null;
    headline: string;
    body: string;
    headlineRanges: any[];
    bodyRanges: any[];
    headlineFontSizePx: number;
    bodyFontSizePx: number;
    headlineTextAlign: "left" | "center" | "right";
    bodyTextAlign: "left" | "center" | "right";
    lineOverridesByKey: any | null;
    // Image + existing layout are used to preserve moves/resizes and wrap around images.
    image: any | null;
    existingLayout: any | null;
    // Settings snapshot for deterministic persistence.
    settings: { backgroundColor: string; textColor: string; includeImage: boolean };
  };
  const liveLayoutKey = (projectId: string, slideIndex: number) => `${projectId}:${slideIndex}`;
  const liveLayoutTimeoutsRef = useRef<Record<string, number | null>>({});
  const liveLayoutQueueRef = useRef<LiveLayoutWorkItem[]>([]);
  const liveLayoutRunIdByKeyRef = useRef<Record<string, number>>({});
  const liveLayoutRunningRef = useRef(false);
  // Phase 3C follow-up: if a project loads with new draft text but stale/missing inputSnapshot/layoutSnapshot,
  // auto-queue live layout for the active slide once its template snapshot is available.
  const liveLayoutAutoFixRunIdByKeyRef = useRef<Record<string, number>>({});
  // Also auto-render non-visited slides on project open so the slide strip isn't blank.
  const liveLayoutAutoFixAllSlidesDoneByProjectRef = useRef<Record<string, boolean>>({});
  const regularCanvasSaveTimeoutRef = useRef<number | null>(null);
  const enhancedCanvasSaveTimeoutRef = useRef<number | null>(null);
  const regularMeasureElRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedOverrideKeysRef = useRef<Record<number, string[]>>({});
  const editorBootstrapDoneRef = useRef(false);
  const initialProjectAutoLoadDoneRef = useRef(false);
  const initialTemplateTypeLoadDoneRef = useRef(false);
  const lastLoadedTemplateTypeIdRef = useRef<"regular" | "enhanced" | null>(null);

  useEffect(() => {
    // Per spec: always default the next-new-project selector to Enhanced on login/open.
    setNewProjectTemplateTypeId("enhanced");
  }, [user?.id]);

  const normalizeLineText = (s: string) => String(s || "").replace(/\s+/g, " ").trim();

  const buildLineKey = (src: any, fallbackIndex: number) => {
    try {
      const block = String(src?.block || "UNK");
      const p = Number.isInteger(src?.paragraphIndex) ? Number(src.paragraphIndex) : 0;
      const parts = Array.isArray(src?.parts) ? src.parts : [];
      const ranges = parts
        .map((x: any) => `${Number(x?.sourceStart ?? -1)}-${Number(x?.sourceEnd ?? -1)}`)
        .join(",");
      if (ranges && !ranges.includes("NaN")) return `${block}:${p}:${ranges}`;
    } catch {
      // ignore
    }
    return `IDX:${fallbackIndex}`;
  };

  // Template type settings (global defaults + per-user overrides)
  const [templateTypePrompt, setTemplateTypePrompt] = useState<string>("");
  const [templateTypeEmphasisPrompt, setTemplateTypeEmphasisPrompt] = useState<string>("");
  const [templateTypeImageGenPrompt, setTemplateTypeImageGenPrompt] = useState<string>("");
  const [templateTypeMappingSlide1, setTemplateTypeMappingSlide1] = useState<string | null>(null);
  const [templateTypeMappingSlide2to5, setTemplateTypeMappingSlide2to5] = useState<string | null>(null);
  const [templateTypeMappingSlide6, setTemplateTypeMappingSlide6] = useState<string | null>(null);

  // Current project snapshots (so projects don't morph unexpectedly)
  const [projectPromptSnapshot, setProjectPromptSnapshot] = useState<string>("");
  const [projectMappingSlide1, setProjectMappingSlide1] = useState<string | null>(null);
  const [projectMappingSlide2to5, setProjectMappingSlide2to5] = useState<string | null>(null);
  const [projectMappingSlide6, setProjectMappingSlide6] = useState<string | null>(null);
  const [templateSnapshots, setTemplateSnapshots] = useState<Record<string, any>>({});

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [promptModalSection, setPromptModalSection] = useState<"prompt" | "emphasis" | "image">("prompt");
  const promptDirtyRef = useRef(false);
  const promptSaveTimeoutRef = useRef<number | null>(null);
  const [promptSaveStatus, setPromptSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Generate Copy UI state is tracked per-project so multiple projects can run concurrently
  // without dumping results into the wrong project when the user switches.
  type CopyUiState = "idle" | "running" | "success" | "error";
  type CopyUi = { state: CopyUiState; label: string; error: string | null };
  const [copyByProject, setCopyByProject] = useState<Record<string, CopyUi>>({});
  const copyRunIdByProjectRef = useRef<Record<string, number>>({});
  const copyPollRefsByProjectRef = useRef<Record<string, number | null>>({});
  const copyResetRefsByProjectRef = useRef<Record<string, number | null>>({});
  // Generate Image Prompts UI state:
  // - bulk (all slides): tracked per-project (same reason as Generate Copy)
  // - regenerate (single slide): tracked per-project+slide key (so switching slides doesn't show the same "Generating..." UI)
  type ImagePromptUi = { generating: boolean; error: string | null };
  const [imagePromptByProject, setImagePromptByProject] = useState<Record<string, ImagePromptUi>>({});
  const imagePromptRunIdByProjectRef = useRef<Record<string, number>>({});
  const imagePromptKey = (projectId: string, slideIndex: number) => `${projectId}:${slideIndex}`;
  const [imagePromptGeneratingKeys, setImagePromptGeneratingKeys] = useState<Set<string>>(new Set());
  const [imagePromptErrorByKey, setImagePromptErrorByKey] = useState<Record<string, string | null>>({});
  const imagePromptRunIdByKeyRef = useRef<Record<string, number>>({});
  const imagePromptSaveTimeoutRef = useRef<number | null>(null);
  const [aiImagePromptSaveStatus, setAiImagePromptSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  // AI Image generation state is tracked per-project+slide key so concurrent projects don't bleed UI.
  const aiKey = (projectId: string, slideIndex: number) => `${projectId}:${slideIndex}`;
  const [aiImageGeneratingKeys, setAiImageGeneratingKeys] = useState<Set<string>>(new Set());
  const [aiImageErrorByKey, setAiImageErrorByKey] = useState<Record<string, string | null>>({});
  const [aiImageProgressByKey, setAiImageProgressByKey] = useState<Record<string, number>>({}); // 0-100 per key
  const [aiImageStatusByKey, setAiImageStatusByKey] = useState<Record<string, string>>({}); // label per key
  const aiImageRunIdByKeyRef = useRef<Record<string, number>>({});
  const aiImageProgressRefsByKeyRef = useRef<Record<string, number | null>>({});
  const aiImagePollRefsByKeyRef = useRef<Record<string, number | null>>({});
  // Phase 3A: image operations (upload/delete/bg-removal) need runId guards too,
  // so stale completions don't overwrite newer image state for the same project+slide.
  const imageOpRunIdByKeyRef = useRef<Record<string, number>>({});
  const getCopyUi = (projectId: string | null): CopyUi => {
    const pid = String(projectId || "").trim();
    if (!pid) return { state: "idle", label: "", error: null };
    return copyByProject[pid] || { state: "idle", label: "", error: null };
  };
  const setCopyUi = (projectId: string, patch: Partial<CopyUi>) => {
    const pid = String(projectId || "").trim();
    if (!pid) return;
    setCopyByProject((prev) => {
      const cur = prev[pid] || { state: "idle" as CopyUiState, label: "", error: null };
      return { ...prev, [pid]: { ...cur, ...patch } };
    });
  };
  const copyUiCurrent = getCopyUi(currentProjectId);
  const copyGenerating = copyUiCurrent.state === "running";
  const copyError = copyUiCurrent.error;
  const copyProgressState = copyUiCurrent.state;
  const copyProgressLabel = copyUiCurrent.label;

  const getImagePromptUi = (projectId: string | null): ImagePromptUi => {
    const pid = String(projectId || "").trim();
    if (!pid) return { generating: false, error: null };
    return imagePromptByProject[pid] || { generating: false, error: null };
  };
  const setImagePromptUi = (projectId: string, patch: Partial<ImagePromptUi>) => {
    const pid = String(projectId || "").trim();
    if (!pid) return;
    setImagePromptByProject((prev) => {
      const cur = prev[pid] || { generating: false, error: null };
      return { ...prev, [pid]: { ...cur, ...patch } };
    });
  };
  const imagePromptUiCurrent = getImagePromptUi(currentProjectId);
  const imagePromptGeneratingAll = imagePromptUiCurrent.generating;
  const imagePromptErrorAll = imagePromptUiCurrent.error;
  const imagePromptKeyCurrent =
    currentProjectId && Number.isInteger(activeSlideIndex) ? imagePromptKey(currentProjectId, activeSlideIndex) : "";
  const imagePromptGeneratingThis = imagePromptKeyCurrent ? imagePromptGeneratingKeys.has(imagePromptKeyCurrent) : false;
  const imagePromptErrorThis = imagePromptKeyCurrent ? (imagePromptErrorByKey[imagePromptKeyCurrent] || null) : null;
  const imagePromptGenerating = imagePromptGeneratingAll || imagePromptGeneratingThis;
  const imagePromptError = imagePromptErrorThis || imagePromptErrorAll;

  const aiKeyCurrent = currentProjectId ? aiKey(currentProjectId, activeSlideIndex) : "";
  const aiImageGeneratingThis = aiKeyCurrent ? aiImageGeneratingKeys.has(aiKeyCurrent) : false;
  const aiImageProgressThis = aiKeyCurrent ? (aiImageProgressByKey[aiKeyCurrent] || 0) : 0;
  const aiImageStatusThis = aiKeyCurrent ? (aiImageStatusByKey[aiKeyCurrent] || "") : "";
  const aiImageErrorThis = aiKeyCurrent ? (aiImageErrorByKey[aiKeyCurrent] || null) : null;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  // Resizable left sidebar (desktop-only)
  const SIDEBAR_MIN = 320;
  const SIDEBAR_MAX = 560;
  const SIDEBAR_DEFAULT = 400;
  const [sidebarWidth, setSidebarWidth] = useState<number>(SIDEBAR_DEFAULT);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileSaveOpen, setMobileSaveOpen] = useState(false);
  const [mobileSaveBusy, setMobileSaveBusy] = useState<number | null>(null); // slide index or null
  const [imageMenuOpen, setImageMenuOpen] = useState(false);
  const [imageMenuPos, setImageMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [bgRemovalBusyKeys, setBgRemovalBusyKeys] = useState<Set<string>>(new Set());
  const [activeImageSelected, setActiveImageSelected] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageLongPressRef = useRef<number | null>(null);
  const imageMoveSaveTimeoutRef = useRef<number | null>(null);
  const mobileGestureRef = useRef<{
    mode: null | "drawer-open" | "drawer-close" | "slide";
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    fired: boolean;
  }>({ mode: null, startX: 0, startY: 0, lastX: 0, lastY: 0, fired: false });
  const sidebarDragRef = useRef<{
    dragging: boolean;
    startX: number;
    startWidth: number;
  }>({ dragging: false, startX: 0, startWidth: SIDEBAR_DEFAULT });
  // Project-wide typography (shared across all slides; canvas-only).
  // NOTE: bodyFontSizePx is now per-slide (draftBodyFontSizePx in SlideState)
  const FONT_OPTIONS = useMemo(
    () => [
      { label: "Inter", family: "Inter, sans-serif", weight: 400 },
      { label: "Poppins", family: "Poppins, sans-serif", weight: 400 },
      { label: "Montserrat (Regular)", family: "Montserrat, sans-serif", weight: 400 },
      { label: "Montserrat (Bold)", family: "Montserrat, sans-serif", weight: 700 },
      { label: "Playfair Display", family: "\"Playfair Display\", serif", weight: 400 },
      { label: "Open Sans (Light)", family: "\"Open Sans\", sans-serif", weight: 300 },
      { label: "Noto Serif (Regular)", family: "\"Noto Serif\", serif", weight: 400 },
      { label: "Droid Serif (Regular)", family: "\"Droid Serif\", serif", weight: 400 },
      { label: "Noto Serif Condensed (Medium)", family: "\"Noto Serif Condensed\", serif", weight: 500 },
    ],
    []
  );

  const fontKey = (family: string, weight: number) => `${family}@@${weight}`;

  const {
    canvasRef,
    loading,
    realigning,
    error,
    layoutData,
    inputData,
    layoutHistory,
    saveStatus,
    saveError,
    debugLogs,
    debugScreenshot,
    showDebugPreview,
    setShowDebugPreview,
    handleRetry,
    realignmentModel,
    setRealignmentModel,
    templates,
    setTemplates,
    loadingTemplates,
    selectedTemplateId,
    selectedTemplateSnapshot,
    setSelectedTemplateId,
    setSelectedTemplateSnapshot,
    templateEditorOpen,
    setTemplateEditorOpen,
    headlineFontFamily,
    bodyFontFamily,
    setHeadlineFontFamily,
    setBodyFontFamily,
    headlineFontWeight,
    bodyFontWeight,
    setHeadlineFontWeight,
    setBodyFontWeight,
    loadTemplate,
    setLayoutData,
    setInputData,
    setLayoutHistory,
    handleGenerate,
    handleRealign,
    handleUndo,
    handleNewCarousel,
    addLog,
    loadTemplatesList,
  } = useCarouselEditorEngine({ enableLegacyAutoSave: false, enableLegacySavedCarouselsOnMount: false, enableTemplatesOnMount: false });

  // Undo snapshots should restore BOTH layout and underlying text/styling state.
  // We push snapshots only for explicit layout actions (Generate Layout / Realign),
  // not for background live-layout as you type.
  const pushUndoSnapshot = useCallback(() => {
    if (!layoutData || !inputData) return;
    setLayoutHistory((prev) => [...(prev || []), { layoutData, inputData }]);
  }, [inputData, layoutData, setLayoutHistory]);

  // Project-wide colors (shared across all slides; affects canvas + generation).
  const [projectBackgroundColor, setProjectBackgroundColor] = useState<string>("#ffffff");
  const [projectTextColor, setProjectTextColor] = useState<string>("#000000");
  const [captionDraft, setCaptionDraft] = useState<string>("");
  const [captionCopyStatus, setCaptionCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [showLayoutOverlays, setShowLayoutOverlays] = useState(false);
  const [showAdvancedLayoutControls, setShowAdvancedLayoutControls] = useState(false);

  // One ref per slide preview canvas so we can export all slides.
  const slideCanvasRefs = useRef<Array<React.RefObject<any>>>(
    Array.from({ length: slideCount }, () => createRef<any>())
  );

  const copyToClipboard = async (text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall back
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  // Prompt text is now per Template Type (Regular/Enhanced) with global defaults + per-user overrides.

  // When a carousel is loaded/generated, sync project colors from it.
  useEffect(() => {
    const bg = inputData?.settings?.backgroundColor;
    const tc = inputData?.settings?.textColor;
    if (bg) setProjectBackgroundColor(bg);
    if (tc) setProjectTextColor(tc);
  }, [inputData]);

  // Regular default: Montserrat Regular for Body (but never override a user-changed selection).
  useEffect(() => {
    if (templateTypeId !== "regular") return;
    const isDefaultInter =
      (bodyFontFamily || "").includes("Inter") &&
      Number(bodyFontWeight) === 400;
    if (!isDefaultInter) return;
    setBodyFontFamily("Montserrat, sans-serif");
    setBodyFontWeight(400);
  }, [templateTypeId, bodyFontFamily, bodyFontWeight, setBodyFontFamily, setBodyFontWeight]);

  type SlideState = {
    layoutData: any | null;
    inputData: any | null;
    layoutHistory: any[];
    error: string | null;
    debugLogs: string[];
    debugScreenshot: string | null;
    // Last-saved text values (used to avoid saving on slide-switch / hydration).
    savedHeadline: string;
    savedBody: string;
    draftHeadline: string;
    draftBody: string;
    draftHeadlineRanges: InlineStyleRange[];
    draftBodyRanges: InlineStyleRange[];
    draftHeadlineFontSizePx: number; // Enhanced only; persisted via input_snapshot.headlineFontSizePx
    draftHeadlineTextAlign: "left" | "center" | "right"; // Enhanced only; persisted via input_snapshot.headlineTextAlign
    draftBodyFontSizePx: number; // Per-slide body font size; persisted via input_snapshot.bodyFontSizePx
    draftBodyTextAlign: "left" | "center" | "right"; // persisted via input_snapshot.bodyTextAlign
    draftBg: string;
    draftText: string;
    // AI Image Prompt (Enhanced only) - per-slide prompt for image generation
    savedAiImagePrompt: string;
    draftAiImagePrompt: string;
  };

  const initSlide = (): SlideState => ({
    layoutData: null,
    inputData: null,
    layoutHistory: [],
    error: null,
    debugLogs: [],
    debugScreenshot: null,
    savedHeadline: "",
    savedBody: "",
    draftHeadline: "",
    draftBody: "",
    draftHeadlineRanges: [],
    draftBodyRanges: [],
    draftHeadlineFontSizePx: 76,
    draftHeadlineTextAlign: "left",
    draftBodyFontSizePx: 48,
    draftBodyTextAlign: "left",
    draftBg: "#ffffff",
    draftText: "#000000",
    savedAiImagePrompt: "",
    draftAiImagePrompt: "",
  });

  const [slides, setSlides] = useState<SlideState[]>(
    () => Array.from({ length: slideCount }, () => initSlide())
  );
  const slidesRef = useRef<SlideState[]>(slides);
  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  // Debug helpers: track the *current* slide/project even inside stale closures.
  const activeSlideIndexRef = useRef<number>(activeSlideIndex);
  useEffect(() => {
    activeSlideIndexRef.current = activeSlideIndex;
  }, [activeSlideIndex]);
  const currentProjectIdRef = useRef<string | null>(currentProjectId);
  useEffect(() => {
    currentProjectIdRef.current = currentProjectId;
  }, [currentProjectId]);

  // Minimal global error capture so Debug panel shows stack traces for rare runtime errors.
  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      try {
        const msg = String(e?.message || "");
        if (!msg.toLowerCase().includes("maximum call stack size exceeded")) return;
        const stack = (e as any)?.error?.stack ? String((e as any).error.stack) : "";
        addLog(`🚨 Runtime error: ${msg}${stack ? `\n${stack}` : ""}`);
      } catch {
        // ignore
      }
    };
    const onRej = (e: PromiseRejectionEvent) => {
      try {
        const reason: any = (e as any)?.reason;
        const msg = String(reason?.message || reason || "");
        if (!msg.toLowerCase().includes("maximum call stack size exceeded")) return;
        const stack = reason?.stack ? String(reason.stack) : "";
        addLog(`🚨 Unhandled rejection: ${msg}${stack ? `\n${stack}` : ""}`);
      } catch {
        // ignore
      }
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave: active slide headline/body → Supabase (carousel_project_slides)
  const activeDraftHeadline = slides[activeSlideIndex]?.draftHeadline || "";
  const activeDraftBody = slides[activeSlideIndex]?.draftBody || "";

  // If the active slide's saved inputSnapshot doesn't match its current draft text (common after background Generate Copy),
  // queue a live layout so the canvas catches up when the user returns to the project.
  useEffect(() => {
    if (!currentProjectId) return;
    if (switchingSlides) return;
    const slideIndex = activeSlideIndex;
    const key = liveLayoutKey(currentProjectId, slideIndex);
    const slide = slidesRef.current[slideIndex];
    if (!slide) return;

    const expectedHeadline = templateTypeId === "regular" ? "" : String(slide.draftHeadline || "");
    const expectedBody = String(slide.draftBody || "");
    if (!expectedHeadline.trim() && !expectedBody.trim()) return;

    // If user is actively typing, a debounced live layout is already scheduled; don't add more.
    try {
      if (liveLayoutTimeoutsRef.current[key]) return;
    } catch {
      // ignore
    }

    const input = (slide as any)?.inputData || null;
    const inputHeadline = String(input?.headline || "");
    const inputBody = String(input?.body || "");
    if (inputHeadline === expectedHeadline && inputBody === expectedBody) return;

    // Wait until this slide's template snapshot is available; otherwise layout will be skipped.
    const tid = computeTemplateIdForSlide(slideIndex);
    if (tid && !templateSnapshots[tid]) return;

    // Throttle: only enqueue once per (project,slide) per mismatch until inputSnapshot updates.
    const runId = (liveLayoutAutoFixRunIdByKeyRef.current[key] || 0) + 1;
    liveLayoutAutoFixRunIdByKeyRef.current[key] = runId;
    if (runId > 3) return;

    addLog(`🛠️ Canvas stale for active slide; queueing live layout (project=${currentProjectId} slide=${slideIndex + 1})`);
    enqueueLiveLayoutForProject(currentProjectId, [slideIndex]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, activeSlideIndex, templateTypeId, templateSnapshots, switchingSlides]);

  // When a project is opened, if some slides have text but no layout snapshot yet, queue live layout for them in the background.
  // This makes the slide strip canvases populate even before you click each slide.
  useEffect(() => {
    if (!currentProjectId) return;
    if (switchingSlides) return;
    const pid = currentProjectId;
    if (liveLayoutAutoFixAllSlidesDoneByProjectRef.current[pid]) return;

    const toQueue: number[] = [];
    let waitingOnSnapshots = false;

    for (let i = 0; i < slideCount; i++) {
      const slide = slidesRef.current[i] || null;
      if (!slide) continue;
      const headline = templateTypeId === "regular" ? "" : String(slide.draftHeadline || "");
      const body = String(slide.draftBody || "");
      if (!headline.trim() && !body.trim()) continue;

      const hasLayout = !!(slide as any)?.layoutData?.layout && Array.isArray(((slide as any).layoutData.layout as any)?.textLines);
      const hasSomeTextLines = hasLayout ? (((slide as any).layoutData.layout as any).textLines?.length || 0) > 0 : false;
      if (hasSomeTextLines) continue;

      const tid = computeTemplateIdForSlide(i);
      // If a slide has text but template mapping isn't ready yet, wait and re-run.
      if (!tid) {
        waitingOnSnapshots = true;
        continue;
      }
      if (!templateSnapshots[tid]) {
        waitingOnSnapshots = true;
        continue;
      }
      toQueue.push(i);
    }

    if (waitingOnSnapshots) return;
    liveLayoutAutoFixAllSlidesDoneByProjectRef.current[pid] = true;
    if (toQueue.length) {
      addLog(`🛠️ Rendering ${toQueue.length} slide(s) with text but no layout yet (project=${pid})`);
      enqueueLiveLayoutForProject(pid, toQueue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentProjectId,
    templateTypeId,
    templateSnapshots,
    switchingSlides,
    // Rerun once project snapshot mapping is hydrated.
    projectMappingSlide1,
    projectMappingSlide2to5,
    projectMappingSlide6,
    templateTypeMappingSlide1,
    templateTypeMappingSlide2to5,
    templateTypeMappingSlide6,
  ]);
  useEffect(() => {
    if (!currentProjectId) return;
    if (switchingSlides) return;
    const cur = slidesRef.current[activeSlideIndex];
    if (!cur) return;
    // Don't save if the user hasn't actually changed text (prevents save-on-slide-switch).
    const desiredSavedHeadline = templateTypeId === "regular" ? "" : (cur.savedHeadline || "");
    const desiredSavedBody = cur.savedBody || "";
    if ((cur.draftHeadline || "") === desiredSavedHeadline && (cur.draftBody || "") === desiredSavedBody) return;
    // Debounced save on every change (overwrite everything model)
    if (slideSaveTimeoutRef.current) window.clearTimeout(slideSaveTimeoutRef.current);
    const projectIdAtSchedule = currentProjectId;
    const slideIndexAtSchedule = activeSlideIndex;
    const typeAtSchedule = templateTypeId;
    const headlineAtSchedule = activeDraftHeadline;
    const bodyAtSchedule = activeDraftBody;
    slideSaveTimeoutRef.current = window.setTimeout(() => {
      const headlineVal = typeAtSchedule === "regular" ? null : (headlineAtSchedule || null);
      void (async () => {
        const ok = await saveSlidePatchForProject(projectIdAtSchedule, slideIndexAtSchedule, {
          headline: headlineVal,
          body: bodyAtSchedule || null,
        });
        if (!ok) return;
        // Mark text as clean after a successful save.
        setSlides((prev) =>
          prev.map((s, i) =>
            i !== slideIndexAtSchedule
              ? s
              : {
                  ...s,
                  savedHeadline: typeAtSchedule === "regular" ? "" : (s.draftHeadline || ""),
                  savedBody: s.draftBody || "",
                }
          )
        );
      })();
    }, 600);
    return () => {
      if (slideSaveTimeoutRef.current) window.clearTimeout(slideSaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, activeSlideIndex, activeDraftHeadline, activeDraftBody, templateTypeId, switchingSlides]);

  // Debounced autosave: active slide AI image prompt → Supabase (carousel_project_slides.ai_image_prompt)
  const activeDraftAiImagePrompt = slides[activeSlideIndex]?.draftAiImagePrompt || "";
  useEffect(() => {
    if (!currentProjectId) return;
    if (switchingSlides) return;
    if (templateTypeId !== 'enhanced') return;
    const cur = slidesRef.current[activeSlideIndex];
    if (!cur) return;
    // Don't save if unchanged
    if ((cur.draftAiImagePrompt || "") === (cur.savedAiImagePrompt || "")) return;
    if (imagePromptSaveTimeoutRef.current) window.clearTimeout(imagePromptSaveTimeoutRef.current);
    const projectIdAtSchedule = currentProjectId;
    const slideIndexAtSchedule = activeSlideIndex;
    const promptAtSchedule = activeDraftAiImagePrompt;
    imagePromptSaveTimeoutRef.current = window.setTimeout(() => {
      void saveSlideAiImagePromptForProject(projectIdAtSchedule, slideIndexAtSchedule, promptAtSchedule);
    }, 600);
    return () => {
      if (imagePromptSaveTimeoutRef.current) window.clearTimeout(imagePromptSaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, activeSlideIndex, activeDraftAiImagePrompt, templateTypeId, switchingSlides]);

  // Persist layout snapshots only when an explicit layout action happened (Generate Layout / Realign / Undo).
  useEffect(() => {
    if (!currentProjectId) return;
    if (switchingSlides) return;
    if (!layoutDirtyRef.current) return;
    if (!layoutData?.layout || !inputData) return;

    if (layoutSaveTimeoutRef.current) window.clearTimeout(layoutSaveTimeoutRef.current);
    const projectIdAtSchedule = currentProjectId;
    const slideIndexAtSchedule = activeSlideIndex;
    const layoutAtSchedule = layoutData.layout;
    const inputAtSchedule = inputData;
    layoutSaveTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        const ok = await saveSlidePatchForProject(projectIdAtSchedule, slideIndexAtSchedule, {
          layoutSnapshot: layoutAtSchedule,
          inputSnapshot: inputAtSchedule,
        });
        if (ok) layoutDirtyRef.current = false;
      })();
    }, 400);

    return () => {
      if (layoutSaveTimeoutRef.current) window.clearTimeout(layoutSaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, activeSlideIndex, layoutData, inputData, switchingSlides]);

  // Enforce project-wide BG/Text across all slide drafts.
  useEffect(() => {
    setSlides((prev) =>
      prev.map((s) => ({ ...s, draftBg: projectBackgroundColor, draftText: projectTextColor }))
    );
  }, [projectBackgroundColor, projectTextColor]);

  const updateProjectColors = (bg: string, text: string) => {
    setProjectBackgroundColor(bg);
    setProjectTextColor(text);
    // Keep engine inputData in sync so autosave persists the colors.
    if (inputData) {
      setInputData({
        ...inputData,
        settings: {
          ...(inputData.settings || {}),
          backgroundColor: bg,
          textColor: text,
        },
      });
    }
  };

  async function getAuthToken(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    } catch {
      return null;
    }
  }

  async function fetchJson(path: string, init?: RequestInit): Promise<any> {
    const token = await getAuthToken();
    const res = await fetch(path, {
      ...(init || {}),
      headers: {
        ...(init?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
    return data;
  }

  // Initial editor state load (single round trip):
  // - Bootstraps starter template if user has none
  // - Loads templates list, projects list, effective template-type settings
  // - Preloads the 3 mapped template definitions for instant preview rendering
  useEffect(() => {
    if (!user?.id) return;
    if (editorBootstrapDoneRef.current) return;
    editorBootstrapDoneRef.current = true;
    void (async () => {
      try {
        const data = await fetchJson('/api/editor/initial-state', {
          method: 'POST',
          body: JSON.stringify({ templateTypeId }),
        });
        if (!data?.success) throw new Error(data?.error || 'Failed to load editor state');

        // Hydrate templates + snapshots
        if (Array.isArray(data.templates)) {
          setTemplates(data.templates);
        }
        if (data.templateSnapshotsById && typeof data.templateSnapshotsById === 'object') {
          setTemplateSnapshots((prev) => ({ ...prev, ...(data.templateSnapshotsById as any) }));
        }

        // Hydrate projects list
        if (Array.isArray(data.projects)) {
          const sortedProjects = [...data.projects].sort(
            (a: any, b: any) => Date.parse(String(b?.updated_at || 0)) - Date.parse(String(a?.updated_at || 0))
          );
          setProjects(sortedProjects);
          // Phase 1/2: auto-load most recent project if any, otherwise auto-create an Enhanced project.
          // Guarded so it can't double-run under StrictMode/dev re-renders.
          if (!initialProjectAutoLoadDoneRef.current) {
            initialProjectAutoLoadDoneRef.current = true;
            if (sortedProjects.length > 0) {
              try {
                await loadProject(String(sortedProjects[0]?.id || ""));
              } catch (e: any) {
                addLog(
                  `⚠️ Auto-load most recent project failed: ${String(e?.message || e || "unknown error")}`
                );
              }
            } else {
              try {
                await createNewProject("enhanced");
              } catch (e: any) {
                addLog(
                  `⚠️ Auto-create Enhanced project failed: ${String(e?.message || e || "unknown error")}`
                );
              }
            }
          }
        }

        // Hydrate effective per-user template-type settings
        const effective = data?.templateType?.effective || null;
        if (effective) {
          setTemplateTypePrompt(String(effective.prompt || ''));
          setTemplateTypeEmphasisPrompt(String(effective.emphasisPrompt || ''));
          setTemplateTypeImageGenPrompt(String(effective.imageGenPrompt || ''));
          setTemplateTypeMappingSlide1(effective.slide1TemplateId ?? null);
          setTemplateTypeMappingSlide2to5(effective.slide2to5TemplateId ?? null);
          setTemplateTypeMappingSlide6(effective.slide6TemplateId ?? null);
          promptDirtyRef.current = false;
          setPromptSaveStatus('idle');
        }

        // Mark template-type as loaded so downstream effects don't refetch on first render.
        initialTemplateTypeLoadDoneRef.current = true;
        lastLoadedTemplateTypeIdRef.current = templateTypeId;

        if (data?.bootstrap?.created) {
          addLog(`🧩 Starter template created for new user`);
        }
      } catch (e: any) {
        addLog(`⚠️ Initial editor load failed: ${String(e?.message || e || 'unknown error')}`);
        // Fallback: best-effort load the two critical things.
        void loadTemplatesList();
        void loadTemplateTypeEffective(templateTypeId);
        void refreshProjectsList();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const uploadImageForActiveSlide = async (file: File) => {
    if (!currentProjectId) throw new Error("Create or load a project first.");
    if (!file) return;
    if (!Number.isInteger(activeSlideIndex) || activeSlideIndex < 0 || activeSlideIndex > 5) return;
    const projectIdAtStart = currentProjectId;
    const slideIndexAtStart = activeSlideIndex;
    const opKey = aiKey(projectIdAtStart, slideIndexAtStart);
    const runId = (imageOpRunIdByKeyRef.current[opKey] || 0) + 1;
    imageOpRunIdByKeyRef.current[opKey] = runId;
    const tidAtStart = computeTemplateIdForSlide(slideIndexAtStart);
    const snapAtStart = (tidAtStart ? templateSnapshots[tidAtStart] : null) || null;
    const baseLayoutAtStart = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : { ...EMPTY_LAYOUT };

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const t = String((file as any)?.type || "");
    if (!allowedTypes.has(t)) {
      throw new Error("Unsupported file type. Please upload JPG, PNG, or WebP.");
    }
    if (Number((file as any)?.size || 0) > 10 * 1024 * 1024) {
      throw new Error("File too large. Max 10MB.");
    }

    setImageBusy(true);
    closeImageMenu();
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated. Please sign in again.");
      if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectIdAtStart);
      fd.append("slideIndex", String(slideIndexAtStart));
      // Phase 3: background removal is ON by default for new uploads (toggle lives on selected image).
      fd.append("bgRemovalEnabled", "1");

      const res = await fetch("/api/editor/projects/slides/image/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) throw new Error(j?.error || `Upload failed (${res.status})`);
      if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

      const url = String(j?.url || "");
      const path = String(j?.path || "");
      if (!url) throw new Error("Upload succeeded but no URL was returned.");

      // Load image dimensions for initial centered placement.
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1 });
        img.onerror = () => resolve({ w: 1, h: 1 });
        img.src = url;
      });
      if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

      const placement = computeDefaultUploadedImagePlacement(snapAtStart, dims.w, dims.h);
      const mask = (j?.mask as any) || null;
      const bgRemovalStatus = String(j?.bgRemovalStatus || "idle");
      const original = j?.original || null;
      const processed = j?.processed || null;

      // Patch the ORIGINAL slide's layout snapshot so Realign can see the image and preserve movement.
      // If the user is still on the same project, prefer the latest in-memory layout for that slide.
      const latestBaseLayout =
        currentProjectIdRef.current === projectIdAtStart
          ? ((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout
              ? { ...((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout as any) }
              : baseLayoutAtStart)
          : baseLayoutAtStart;
      const nextLayout = {
        ...latestBaseLayout,
        image: {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          url,
          storage: { bucket: "carousel-project-images", path },
          bgRemovalEnabled: true,
          bgRemovalStatus,
          ...(original ? { original: { url: String(original.url || ""), storage: original.storage || { bucket: "carousel-project-images", path: String(original.path || "") } } } : {}),
          ...(processed ? { processed: { url: String(processed.url || ""), storage: processed.storage || { bucket: "carousel-project-images", path: String(processed.path || "") } } } : {}),
          ...(mask ? { mask } : {}),
        },
      };

      // Only apply UI updates if the user is still viewing this project.
      if (currentProjectIdRef.current === projectIdAtStart) {
        setSlides((prev) =>
          prev.map((s, i) =>
            i !== slideIndexAtStart
              ? s
              : {
                  ...s,
                  layoutData: { success: true, layout: nextLayout, imageUrl: url } as any,
                }
          )
        );
        slidesRef.current = slidesRef.current.map((s, i) =>
          i !== slideIndexAtStart
            ? s
            : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: url } as any } as any)
        );
        if (activeSlideIndexRef.current === slideIndexAtStart) {
          setLayoutData({ success: true, layout: nextLayout, imageUrl: url } as any);
        }
      }

      // Persist to Supabase (per-slide snapshot).
      await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout });
      addLog(`🖼️ Uploaded image → slide ${slideIndexAtStart + 1}`);
    } finally {
      setImageBusy(false);
    }
  };

  const setActiveSlideImageBgRemoval = async (nextEnabled: boolean) => {
    if (!currentProjectId) throw new Error("Create or load a project first.");
    if (!Number.isInteger(activeSlideIndex) || activeSlideIndex < 0 || activeSlideIndex > 5) return;
    const projectIdAtStart = currentProjectId;
    const slideIndexAtStart = activeSlideIndex;
    const opKey = aiKey(projectIdAtStart, slideIndexAtStart);
    // UI: show busy state per slide while toggling/reprocessing.
    setBgRemovalBusyKeys((prev) => {
      const next = new Set(prev);
      next.add(opKey);
      return next;
    });
    const runId = (imageOpRunIdByKeyRef.current[opKey] || 0) + 1;
    imageOpRunIdByKeyRef.current[opKey] = runId;
    const baseLayoutAtStart = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : null;
    const baseLayout = baseLayoutAtStart;
    const img = baseLayout?.image ? { ...(baseLayout.image as any) } : null;
    if (!img || !String(img?.url || "").trim()) return;

    // Ensure we always keep a pointer to the original upload for retries (Phase 2+).
    const orig = (img as any).original || null;
    if (!orig) {
      (img as any).original = {
        url: String((img as any)?.url || ""),
        storage: (img as any)?.storage || null,
      };
    }

    (img as any).bgRemovalEnabled = !!nextEnabled;
    if (!nextEnabled) {
      // When disabling, revert to original visually and clear mask so wrapping falls back to rectangle.
      (img as any).bgRemovalStatus = "disabled";
      const o = (img as any).original || null;
      if (o?.url) (img as any).url = String(o.url);
      if (o?.storage) (img as any).storage = o.storage;
      if ((img as any).mask) delete (img as any).mask;
      if ((img as any).processed) delete (img as any).processed;
    } else {
      // When enabling, kick off reprocess from stored original and update to processed PNG + server mask.
      (img as any).bgRemovalStatus = "processing";
    }

    const nextLayout = { ...baseLayout, image: img };
    if (currentProjectIdRef.current === projectIdAtStart) {
      setSlides((prev) =>
        prev.map((s, i) =>
          i === slideIndexAtStart ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout } as any }) : s
        )
      );
      slidesRef.current = slidesRef.current.map((s, i) =>
        i === slideIndexAtStart ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout } as any } as any) : s
      );
      if (activeSlideIndexRef.current === slideIndexAtStart) {
        setLayoutData((prev: any) => (prev?.layout ? ({ ...prev, layout: nextLayout }) : prev));
      }
    }

    await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout });
    if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

    if (nextEnabled) {
      try {
        const sourcePath =
          String((img as any)?.original?.storage?.path || (img as any)?.storage?.path || '').trim() || undefined;
        const j = await fetchJson("/api/editor/projects/slides/image/reprocess", {
          method: "POST",
          body: JSON.stringify({ projectId: projectIdAtStart, slideIndex: slideIndexAtStart, path: sourcePath }),
        });
        if (!j?.success) throw new Error(j?.error || "Reprocess failed");
        if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

        const processedUrl = String(j?.processed?.url || "");
        const processedPath = String(j?.processed?.path || "");
        const mask = j?.mask || null;
        const bgRemovalStatus = String(j?.bgRemovalStatus || "succeeded");

        const base2 =
          currentProjectIdRef.current === projectIdAtStart
            ? ((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout
                ? { ...((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout as any) }
                : ({ ...EMPTY_LAYOUT } as any))
            : ({ ...EMPTY_LAYOUT } as any);
        const prevImg = (base2 as any)?.image ? { ...(base2 as any).image } : null;
        if (!prevImg) return;

        const nextImg = {
          ...prevImg,
          bgRemovalEnabled: true,
          bgRemovalStatus,
          url: processedUrl || prevImg.url,
          storage: processedPath ? { bucket: "carousel-project-images", path: processedPath } : prevImg.storage,
          original: j?.original
            ? { url: String(j.original.url || ""), storage: { bucket: "carousel-project-images", path: String(j.original.path || "") } }
            : (prevImg as any).original,
          processed: j?.processed
            ? { url: String(j.processed.url || ""), storage: { bucket: "carousel-project-images", path: String(j.processed.path || "") } }
            : { url: processedUrl, storage: processedPath ? { bucket: "carousel-project-images", path: processedPath } : prevImg.storage },
          ...(mask ? { mask } : {}),
        };
        const nextLayout2 = { ...base2, image: nextImg };
        if (currentProjectIdRef.current === projectIdAtStart) {
          setSlides((prev) =>
            prev.map((s, i) =>
              i === slideIndexAtStart
                ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: nextImg.url } as any })
                : s
            )
          );
          slidesRef.current = slidesRef.current.map((s, i) =>
            i === slideIndexAtStart
              ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: nextImg.url } as any } as any)
              : s
          );
          if (activeSlideIndexRef.current === slideIndexAtStart) {
            setLayoutData((prev: any) =>
              prev?.layout ? ({ ...prev, layout: nextLayout2, imageUrl: nextImg.url } as any) : prev
            );
          }
        }
        await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout2 });
      } catch (e) {
        // Mark failed but keep original visible.
        const base2 =
          currentProjectIdRef.current === projectIdAtStart
            ? ((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout
                ? { ...((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout as any) }
                : null)
            : null;
        const prevImg = base2?.image ? { ...(base2.image as any) } : null;
        if (!base2 || !prevImg) return;
        const o = (prevImg as any).original || null;
        const failedImg: any = { ...prevImg, bgRemovalEnabled: true, bgRemovalStatus: "failed" };
        if (o?.url) failedImg.url = String(o.url);
        if (o?.storage) failedImg.storage = o.storage;
        if (failedImg.mask) delete failedImg.mask;
        if (failedImg.processed) delete failedImg.processed;
        const nextLayout2 = { ...base2, image: failedImg };
        if (currentProjectIdRef.current === projectIdAtStart) {
          setSlides((prev) =>
            prev.map((s, i) =>
              i === slideIndexAtStart
                ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: failedImg.url } as any })
                : s
            )
          );
          slidesRef.current = slidesRef.current.map((s, i) =>
            i === slideIndexAtStart
              ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: failedImg.url } as any } as any)
              : s
          );
          if (activeSlideIndexRef.current === slideIndexAtStart) {
            setLayoutData((prev: any) =>
              prev?.layout ? ({ ...prev, layout: nextLayout2, imageUrl: failedImg.url } as any) : prev
            );
          }
        }
        await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout2 });
      }
    }
    // Clear busy state when the operation completes.
    setBgRemovalBusyKeys((prev) => {
      const next = new Set(prev);
      next.delete(opKey);
      return next;
    });
  };

  const deleteImageForActiveSlide = async (reason: "menu" | "button") => {
    if (!currentProjectId) return;
    if (!Number.isInteger(activeSlideIndex) || activeSlideIndex < 0 || activeSlideIndex > 5) return;
    const projectIdAtStart = currentProjectId;
    const slideIndexAtStart = activeSlideIndex;
    const opKey = aiKey(projectIdAtStart, slideIndexAtStart);
    const runId = (imageOpRunIdByKeyRef.current[opKey] || 0) + 1;
    imageOpRunIdByKeyRef.current[opKey] = runId;
    setImageBusy(true);
    closeImageMenu();
    try {
      // Best-effort delete from storage
      try {
        await fetchJson("/api/editor/projects/slides/image/delete", {
          method: "POST",
          body: JSON.stringify({ projectId: projectIdAtStart, slideIndex: slideIndexAtStart }),
        });
      } catch (e) {
        // If storage delete fails, still remove from the slide snapshot so the UI unblocks.
        console.warn("[EditorShell] Image storage delete failed:", e);
      }
      if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

      const baseLayout =
        currentProjectIdRef.current === projectIdAtStart
          ? ((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout
              ? { ...((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout as any) }
              : ((activeSlideIndexRef.current === slideIndexAtStart && (layoutData as any)?.layout)
                  ? { ...((layoutData as any).layout as any) }
                  : { ...EMPTY_LAYOUT }))
          : { ...EMPTY_LAYOUT };
      const nextLayout = { ...baseLayout };
      if (nextLayout.image) delete (nextLayout as any).image;

      if (currentProjectIdRef.current === projectIdAtStart) {
        setSlides((prev) =>
          prev.map((s, i) =>
            i !== slideIndexAtStart
              ? s
              : { ...s, layoutData: { success: true, layout: nextLayout, imageUrl: null } as any }
          )
        );
        slidesRef.current = slidesRef.current.map((s, i) =>
          i !== slideIndexAtStart
            ? s
            : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: null } as any } as any)
        );
        if (activeSlideIndexRef.current === slideIndexAtStart) {
          setLayoutData({ success: true, layout: nextLayout, imageUrl: null } as any);
        }
      }

      await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout });
      setActiveImageSelected(false);
      addLog(`🗑️ Removed image (slide ${slideIndexAtStart + 1}) via ${reason}`);
    } finally {
      setImageBusy(false);
    }
  };

  const handleUserImageChange = (change: {
    canvasSlideIndex?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    angle?: number;
  }) => {
    if (!currentProjectId) return;
    const slideIndex =
      Number.isInteger((change as any)?.canvasSlideIndex) ? Number((change as any).canvasSlideIndex) : activeSlideIndex;
    if (slideIndex < 0 || slideIndex >= slideCount) return;

    // Update in-memory layout snapshot so Realign sees the current image bounds immediately.
    const currentLayoutState =
      slideIndex === activeSlideIndex ? (layoutData as any) : ((slidesRef.current?.[slideIndex] as any)?.layoutData as any);
    const baseLayout = currentLayoutState?.layout ? { ...currentLayoutState.layout } : { ...EMPTY_LAYOUT };
    const prevImage = (baseLayout as any)?.image || null;
    if (!prevImage || !prevImage.url) return; // no user image to update

    // Enable Undo for image moves/resizes/rotations too. Push only when bounds actually changed.
    try {
      const eps = 0.5;
      const didMove =
        Math.abs(Number(prevImage?.x ?? 0) - Number(change.x ?? 0)) > eps ||
        Math.abs(Number(prevImage?.y ?? 0) - Number(change.y ?? 0)) > eps;
      const didResize =
        Math.abs(Number(prevImage?.width ?? 0) - Number(change.width ?? 0)) > eps ||
        Math.abs(Number(prevImage?.height ?? 0) - Number(change.height ?? 0)) > eps;
      const didRotate =
        Math.abs(Number(prevImage?.angle ?? 0) - Number(change.angle ?? 0)) > eps;
      if (didMove || didResize || didRotate) pushUndoSnapshot();
    } catch {
      pushUndoSnapshot();
    }

    const nextLayout = {
      ...baseLayout,
      image: {
        ...prevImage,
        x: Math.round(Number(change.x) || 0),
        y: Math.round(Number(change.y) || 0),
        width: Math.max(1, Math.round(Number(change.width) || 1)),
        height: Math.max(1, Math.round(Number(change.height) || 1)),
        angle: Number(change.angle) || 0,
      },
    };

    if (slideIndex === activeSlideIndex) {
      setLayoutData({ success: true, layout: nextLayout, imageUrl: prevImage.url } as any);
    }
    setSlides((prev) =>
      prev.map((s, i) =>
        i !== slideIndex
          ? s
          : {
              ...s,
              layoutData: { success: true, layout: nextLayout, imageUrl: prevImage.url } as any,
            }
      )
    );
    slidesRef.current = slidesRef.current.map((s, i) =>
      i !== slideIndex
        ? s
        : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: prevImage.url } as any } as any)
    );

    // Debounced persist (500ms) after user finishes moving/resizing the image.
    if (imageMoveSaveTimeoutRef.current) window.clearTimeout(imageMoveSaveTimeoutRef.current);
    const projectIdAtSchedule = currentProjectId;
    const slideIndexAtSchedule = slideIndex;
    const layoutAtSchedule = nextLayout;
    imageMoveSaveTimeoutRef.current = window.setTimeout(() => {
      void saveSlidePatchForProject(projectIdAtSchedule, slideIndexAtSchedule, { layoutSnapshot: layoutAtSchedule });
    }, 500);
  };

  const runGenerateCopy = async () => {
    if (!currentProjectId) {
      return;
    }
    const projectIdAtStart = currentProjectId;
    const runId = (copyRunIdByProjectRef.current[projectIdAtStart] || 0) + 1;
    copyRunIdByProjectRef.current[projectIdAtStart] = runId;

    setCopyUi(projectIdAtStart, { state: "running", label: "Starting…", error: null });
    // Progress indicator: poll job status for true step updates (no schema changes).
    const prevPoll = copyPollRefsByProjectRef.current[projectIdAtStart];
    if (prevPoll) window.clearInterval(prevPoll);
    copyPollRefsByProjectRef.current[projectIdAtStart] = null;
    const prevReset = copyResetRefsByProjectRef.current[projectIdAtStart];
    if (prevReset) window.clearTimeout(prevReset);
    copyResetRefsByProjectRef.current[projectIdAtStart] = null;
    const stepLabelFor = (progressCode: string) => {
      const code = String(progressCode || "").toLowerCase();
      if (code.includes("poppy")) return "Poppy is Cooking...";
      if (code.includes("parse")) return "Parsing output…";
      if (code.includes("emphasis")) return "Generating emphasis styles…";
      if (code.includes("save")) return "Saving…";
      return "Working…";
    };
    const pollOnce = async () => {
      try {
        // Ignore stale pollers for this project.
        if (copyRunIdByProjectRef.current[projectIdAtStart] !== runId) return;
        const j = await fetchJson(
          `/api/editor/projects/jobs/status?projectId=${encodeURIComponent(projectIdAtStart)}`,
          { method: "GET" }
        );
        const job = j?.activeJob || null;
        if (!job) return;
        const status = String(job.status || "");
        const err = String(job.error || "");
        // We reuse `error` while running to store "progress:<step>".
        if ((status === "pending" || status === "running") && err.startsWith("progress:")) {
          setCopyUi(projectIdAtStart, { label: stepLabelFor(err.slice("progress:".length)) });
        } else if (status === "pending") {
          setCopyUi(projectIdAtStart, { label: "Queued…" });
        } else if (status === "running") {
          setCopyUi(projectIdAtStart, { label: "Working…" });
        } else if (status === "completed") {
          setCopyUi(projectIdAtStart, { label: "Done" });
        } else if (status === "failed") {
          setCopyUi(projectIdAtStart, { label: "Error" });
        }
      } catch {
        // ignore polling errors; Debug panel has details
      }
    };
    void pollOnce();
    copyPollRefsByProjectRef.current[projectIdAtStart] = window.setInterval(() => {
      void pollOnce();
    }, 500);
    try {
      addLog(`🤖 Generate Copy start: project=${projectIdAtStart} type=${templateTypeId.toUpperCase()}`);
      const data = await fetchJson('/api/editor/projects/jobs/generate-copy', {
        method: 'POST',
        body: JSON.stringify({ projectId: projectIdAtStart }),
      });
      // Ignore stale completions for this project.
      if (copyRunIdByProjectRef.current[projectIdAtStart] !== runId) return;
      const typeOut = data?.templateTypeId === "enhanced" ? "enhanced" : "regular";
      addLog(
        `🤖 Generate Copy response: type=${String(typeOut).toUpperCase()} slides=${Array.isArray(data?.slides) ? data.slides.length : 0} captionLen=${String(data?.caption || "").length}`
      );
      const slidesOut = data.slides || [];
      const nextSlides: SlideState[] = Array.from({ length: slideCount }).map((_, i) => {
        const prev = slidesRef.current[i] || initSlide();
        const out = slidesOut[i] || {};
        const nextHeadline = out.headline ?? '';
        const nextBody = out.body ?? '';
        const nextHeadlineRanges = Array.isArray(out.headlineStyleRanges) ? out.headlineStyleRanges : [];
        const nextBodyRanges = Array.isArray(out.bodyStyleRanges) ? out.bodyStyleRanges : [];
        addLog(
          `🧾 Slide ${i + 1} text: headlineLen=${String(nextHeadline).length} bodyLen=${String(nextBody).length} headlineRanges=${nextHeadlineRanges.length} bodyRanges=${nextBodyRanges.length}`
        );

        const previewRanges = (label: string, text: string, ranges: any[]) => {
          if (!Array.isArray(ranges) || !ranges.length || !text) return;
          // Show up to 6 ranges so logs stay readable.
          const max = Math.min(6, ranges.length);
          for (let r = 0; r < max; r++) {
            const rr = ranges[r] || {};
            const start = Number(rr.start);
            const end = Number(rr.end);
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
            const marks = [
              rr.bold ? "bold" : null,
              rr.italic ? "italic" : null,
              rr.underline ? "underline" : null,
            ].filter(Boolean).join("+") || "style";
            const slice = String(text).slice(start, end).replace(/\s+/g, " ").trim();
            addLog(`   ↳ ${label} ${marks}: "${slice}" (${start}-${end})`);
          }
          if (ranges.length > max) addLog(`   ↳ ${label} … +${ranges.length - max} more range(s)`);
        };

        if (typeOut === "enhanced") {
          previewRanges("headline", String(nextHeadline), nextHeadlineRanges);
        }
        previewRanges("body", String(nextBody), nextBodyRanges);

        return {
          ...prev,
          draftHeadline: nextHeadline,
          draftBody: nextBody,
          // Use AI-provided emphasis ranges so the editor + canvas show the final emphasized result immediately.
          // - Regular: body ranges
          // - Enhanced: headline + body ranges
          draftHeadlineRanges: typeOut === "enhanced" ? nextHeadlineRanges : [],
          draftBodyRanges: nextBodyRanges,
          // Mark as dirty vs saved so autosave of text works, but don't show "saving" just from switching.
        };
      });
      // Apply UI updates ONLY if the user is still viewing this same project.
      if (currentProjectIdRef.current === projectIdAtStart) {
        setSlides(nextSlides);
        slidesRef.current = nextSlides;
        if (typeof data.caption === 'string') setCaptionDraft(data.caption);
        void refreshProjectsList();
        // Auto-layout all 6 slides sequentially (queued).
        addLog(`📐 Queue live layout for slides 1–6`);
        setCopyUi(projectIdAtStart, { label: "Applying layouts…" });
        enqueueLiveLayoutForProject(projectIdAtStart, [0, 1, 2, 3, 4, 5]);
        // Generate AI image prompts for Enhanced template type (async, non-blocking)
        if (typeOut === 'enhanced') {
          addLog(`🎨 Triggering AI image prompt generation for Enhanced project`);
          void runGenerateImagePrompts();
        }
      }
      setCopyUi(projectIdAtStart, { state: "success" });
    } catch (e: any) {
      addLog(`❌ Generate Copy failed: ${e?.message || "unknown error"}`);
      setCopyUi(projectIdAtStart, { state: "error", error: e?.message || "Generate Copy failed", label: "Error" });
    } finally {
      const poll = copyPollRefsByProjectRef.current[projectIdAtStart];
      if (poll) window.clearInterval(poll);
      copyPollRefsByProjectRef.current[projectIdAtStart] = null;
      // Leave a brief success/error state so users see completion.
      copyResetRefsByProjectRef.current[projectIdAtStart] = window.setTimeout(() => {
        // Only reset if no newer run started for this project.
        if (copyRunIdByProjectRef.current[projectIdAtStart] !== runId) return;
        setCopyUi(projectIdAtStart, { state: "idle", label: "" });
      }, 1400);
    }
  };

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

  const computeTemplateIdForSlide = (slideIndex: number) => {
    const s1 = currentProjectId ? projectMappingSlide1 : templateTypeMappingSlide1;
    const s25 = currentProjectId ? projectMappingSlide2to5 : templateTypeMappingSlide2to5;
    const s6 = currentProjectId ? projectMappingSlide6 : templateTypeMappingSlide6;
    if (slideIndex === 0) return s1;
    if (slideIndex >= 1 && slideIndex <= 4) return s25;
    return s6;
  };

  const ensureTemplateSnapshot = async (templateId: string | null) => {
    if (!templateId) return;
    if (templateSnapshots[templateId]) return;
    try {
      const { data, error } = await supabase
        .from('carousel_templates')
        .select('id, definition')
        .eq('id', templateId)
        .single();
      if (error || !data) return;
      setTemplateSnapshots((prev) => ({ ...prev, [templateId]: (data as any).definition }));
    } catch {
      // ignore
    }
  };

  const getTemplateContentRectInset = (templateSnapshot: any | null) => {
    const slide0 =
      Array.isArray(templateSnapshot?.slides)
        ? (templateSnapshot.slides.find((s: any) => s?.slideIndex === 0) || templateSnapshot.slides[0])
        : null;
    const region = slide0?.contentRegion;
    if (!region) return null;
    if (
      typeof region.x !== "number" ||
      typeof region.y !== "number" ||
      typeof region.width !== "number" ||
      typeof region.height !== "number"
    ) {
      return null;
    }
    const PAD = 40;
    return {
      x: region.x + PAD,
      y: region.y + PAD,
      width: Math.max(1, region.width - PAD * 2),
      height: Math.max(1, region.height - PAD * 2),
    };
  };

  const getTemplateContentRectRaw = (templateSnapshot: any | null) => {
    const slide0 =
      Array.isArray(templateSnapshot?.slides)
        ? (templateSnapshot.slides.find((s: any) => s?.slideIndex === 0) || templateSnapshot.slides[0])
        : null;
    const region = slide0?.contentRegion;
    if (!region) return null;
    if (
      typeof region.x !== "number" ||
      typeof region.y !== "number" ||
      typeof region.width !== "number" ||
      typeof region.height !== "number"
    ) {
      return null;
    }
    return {
      x: region.x,
      y: region.y,
      width: Math.max(1, region.width),
      height: Math.max(1, region.height),
    };
  };

  const mergeInlineRanges = (ranges: InlineStyleRange[]) => {
    const sorted = [...(ranges || [])]
      .filter((r) => typeof r?.start === "number" && typeof r?.end === "number" && r.end > r.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const out: InlineStyleRange[] = [];
    const same = (a: InlineStyleRange, b: InlineStyleRange) =>
      !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.underline === !!b.underline;
    for (const r of sorted) {
      const prev = out[out.length - 1];
      if (prev && same(prev, r) && r.start <= prev.end) {
        prev.end = Math.max(prev.end, r.end);
        continue;
      }
      out.push({ ...r });
    }
    return out;
  };

  const measureRegularBodyHeightPx = useCallback(
    (text: string, maxWidthPx: number, fontSizePx: number, bodyRanges: InlineStyleRange[]) => {
      if (typeof document === "undefined") return 0;
      const width = Math.max(1, Math.floor(Number(maxWidthPx) || 1));
      const size = Math.max(1, Math.floor(Number(fontSizePx) || 1));
      const hasBold = Array.isArray(bodyRanges) && bodyRanges.some((r) => !!r?.bold);
      const hasItalic = Array.isArray(bodyRanges) && bodyRanges.some((r) => !!r?.italic);
      const weight = hasBold ? 700 : (Number.isFinite(bodyFontWeight as any) ? Number(bodyFontWeight) : 400);
      const family = String(bodyFontFamily || "Inter, sans-serif");
      const style = hasItalic ? "italic" : "normal";

      let el = regularMeasureElRef.current;
      if (!el) {
        el = document.createElement("div");
        el.setAttribute("data-regular-measure", "1");
        el.style.position = "fixed";
        el.style.left = "-100000px";
        el.style.top = "-100000px";
        el.style.visibility = "hidden";
        el.style.pointerEvents = "none";
        el.style.whiteSpace = "pre-wrap";
        el.style.wordBreak = "break-word";
        (el.style as any).overflowWrap = "break-word";
        el.style.padding = "0";
        el.style.margin = "0";
        el.style.border = "0";
        document.body.appendChild(el);
        regularMeasureElRef.current = el;
      }

      el.style.width = `${width}px`;
      el.style.fontFamily = family;
      el.style.fontWeight = String(weight);
      el.style.fontStyle = style;
      el.style.fontSize = `${size}px`;
      el.style.lineHeight = "1.2";
      el.textContent = String(text || "");
      const h = Math.max(0, Math.ceil(el.scrollHeight || 0));
      // Fabric's Textbox height tends to be slightly larger than DOM flow height due to font metric rounding.
      // Add a small buffer to avoid "fits in measurer but overflows in canvas" edge cases.
      const buffer = Math.max(4, Math.ceil(size * 0.25));
      return h + buffer;
    },
    [bodyFontFamily, bodyFontWeight]
  );

  const fitRegularBodyFontSizePx = useCallback(
    (params: { text: string; maxWidthPx: number; maxHeightPx: number; bodyRanges: InlineStyleRange[]; maxFontSizePx?: number }) => {
      const { text, maxWidthPx, maxHeightPx, bodyRanges } = params;
      const maxH = Math.max(1, Math.floor(Number(maxHeightPx) || 1));
      const tol = 2; // allow 1–2px tolerance
      if (typeof document === "undefined") return 48;
      if (!String(text || "").trim()) return 48;

      // Technical floor only (user requested no UX minimum).
      let lo = 8;
      const cap = Number.isFinite(params.maxFontSizePx as any) ? Math.max(8, Math.min(120, Math.floor(Number(params.maxFontSizePx)))) : 56;
      let hi = cap;
      let best = lo;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const h = measureRegularBodyHeightPx(String(text || ""), maxWidthPx, mid, bodyRanges);
        if (h <= (maxH + tol)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return best;
    },
    [measureRegularBodyHeightPx]
  );

  const buildTextStylesForLine = (
    parts: Array<{ lineStart: number; lineEnd: number; sourceStart: number; sourceEnd: number }>,
    ranges: InlineStyleRange[]
  ): TextStyle[] => {
    const merged = mergeInlineRanges(ranges);
    if (!parts?.length || !merged.length) return [];
    const out: TextStyle[] = [];
    for (const p of parts) {
      for (const r of merged) {
        const a = Math.max(p.sourceStart, r.start);
        const b = Math.min(p.sourceEnd, r.end);
        if (b <= a) continue;
        const start = p.lineStart + (a - p.sourceStart);
        const end = p.lineStart + (b - p.sourceStart);
        const style: TextStyle = { start, end };
        if (r.bold) style.fontWeight = "bold";
        if (r.italic) style.fontStyle = "italic";
        if (r.underline) style.underline = true;
        out.push(style);
      }
    }
    return out;
  };

  const getExistingImageForSlide = (slideIndex: number) => {
    // Prefer the active canvas measurement (source of truth if user dragged/resized).
    if (slideIndex === activeSlideIndex) {
      const pos = (canvasRef.current as any)?.getImagePosition?.();
      if (pos && typeof pos.x === "number") {
        const url =
          (layoutData as any)?.layout?.image?.url ||
          (layoutData as any)?.imageUrl ||
          null;
        const mask = (layoutData as any)?.layout?.image?.mask || null;
        const storage = (layoutData as any)?.layout?.image?.storage || null;
        return { ...pos, url, ...(mask ? { mask } : {}), ...(storage ? { storage } : {}) };
      }
    }
    const img = (slidesRef.current[slideIndex] as any)?.layoutData?.layout?.image;
    if (img && typeof img.x === "number") return img;
    return null;
  };

  const computeDeterministicLayout = (params: {
    slideIndex: number;
    headline: string;
    body: string;
    templateSnapshot: any;
    image: any | null;
    headlineRanges?: InlineStyleRange[];
    bodyRanges?: InlineStyleRange[];
    lineOverridesByKey?: Record<string, any> | null;
    headlineFontSizePx?: number;
    bodyFontSizePx?: number;
    headlineTextAlign?: "left" | "center" | "right";
    bodyTextAlign?: "left" | "center" | "right";
  }): VisionLayoutDecision | null => {
    const inset = getTemplateContentRectInset(params.templateSnapshot);
    const imageBounds = params.image
      ? {
          x: Number(params.image.x) || 0,
          y: Number(params.image.y) || 0,
          width: Number(params.image.width) || 0,
          height: Number(params.image.height) || 0,
        }
      : {
          // "No image" mode: put a tiny blocked rect far off-canvas so it never affects placement.
          x: -100000,
          y: -100000,
          width: 1,
          height: 1,
        };

    // Loosen conservatism to pack lines tighter, then validate using real pixel measurement and retry if needed.
    const headlineAvgBase = estimateAvgCharWidthEmRelaxed(headlineFontFamily, headlineFontWeight);
    const bodyAvgBase = estimateAvgCharWidthEmRelaxed(bodyFontFamily, bodyFontWeight);

    const canMeasure = typeof document !== "undefined";
    const measureWidthPx = (() => {
      if (!canMeasure) return (_text: string, _font: { family: string; weight: number; italic?: boolean; sizePx: number }) => 0;
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d");
      if (!ctx) return (_text: string, _font: { family: string; weight: number; italic?: boolean; sizePx: number }) => 0;
      return (text: string, font: { family: string; weight: number; italic?: boolean; sizePx: number }) => {
        const w = Number.isFinite(font.weight as any) ? font.weight : 400;
        const style = font.italic ? "italic" : "normal";
        ctx.font = `${style} ${w} ${Math.max(1, Math.round(font.sizePx))}px ${font.family}`;
        return ctx.measureText(String(text || "")).width;
      };
    })();

    const hasOverlapRange = (
      parts: Array<{ sourceStart: number; sourceEnd: number }>,
      ranges: InlineStyleRange[],
      key: "bold" | "italic"
    ) => {
      if (!Array.isArray(ranges) || ranges.length === 0) return false;
      for (const p of parts) {
        const a0 = Number(p?.sourceStart ?? -1);
        const b0 = Number(p?.sourceEnd ?? -1);
        if (!Number.isFinite(a0) || !Number.isFinite(b0) || b0 <= a0) continue;
        for (const r of ranges) {
          if (!(r as any)?.[key]) continue;
          const a = Number((r as any).start ?? -1);
          const b = Number((r as any).end ?? -1);
          if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue;
          if (Math.min(b0, b) > Math.max(a0, a)) return true;
        }
      }
      return false;
    };

    const validateNoOverflow = (layout: any, meta: any) => {
      if (!canMeasure) return true;
      if (!layout || !Array.isArray(layout.textLines) || !meta || !Array.isArray(meta.lineSources)) return true;
      const headlineRanges = Array.isArray(params.headlineRanges) ? params.headlineRanges : [];
      const bodyRanges = Array.isArray(params.bodyRanges) ? params.bodyRanges : [];
      for (let i = 0; i < layout.textLines.length; i++) {
        const line = layout.textLines[i] as any;
        const src = meta.lineSources[i] as any;
        const block = (src?.block === "HEADLINE" ? "HEADLINE" : "BODY") as "HEADLINE" | "BODY";
        const parts = Array.isArray(src?.parts) ? src.parts : [];
        const ranges = block === "HEADLINE" ? headlineRanges : bodyRanges;
        const bold = hasOverlapRange(parts, ranges, "bold");
        const italic = hasOverlapRange(parts, ranges, "italic");
        const family = block === "HEADLINE" ? headlineFontFamily : bodyFontFamily;
        const baseWeight = block === "HEADLINE" ? headlineFontWeight : bodyFontWeight;
        const weight = bold ? 700 : (Number.isFinite(baseWeight as any) ? Number(baseWeight) : 400);
        const sizePx = Number(line?.baseSize ?? (block === "HEADLINE" ? 76 : 48));
        const maxWidth = Number(line?.maxWidth ?? 0);
        if (!Number.isFinite(maxWidth) || maxWidth <= 0) continue;
        const w = measureWidthPx(String(line?.text || ""), { family, weight, italic, sizePx });
        if (w > (maxWidth + 1.0)) return false;
      }
      return true;
    };

    const wrapOnce = (headlineAvg: number, bodyAvg: number) => {
      const headlineSizePx = Math.max(24, Math.min(120, Math.round(Number(params.headlineFontSizePx) || 76)));
      const bodySizePx = Math.max(24, Math.min(120, Math.round(Number(params.bodyFontSizePx) || 48)));
      return wrapFlowLayout(params.headline, params.body, imageBounds, {
        ...(inset ? { contentRect: inset } : { margin: 40 }),
        clearancePx: 1,
        lineHeight: 1.2,
        headlineFontSize: headlineSizePx,
        bodyFontSize: bodySizePx,
        // Only allow auto-shrink down to 56 unless the user explicitly chose smaller.
        headlineMinFontSize: Math.min(56, headlineSizePx),
        bodyMinFontSize: Math.max(10, Math.min(36, bodySizePx)),
        blockGapPx: 24,
        laneTieBreak: "right",
        bodyPreferSideLane: true,
        minUsableLaneWidthPx: 300,
        skinnyLaneWidthPx: 380,
        minBelowSpacePx: 240,
        headlineAvgCharWidthEm: headlineAvg,
        bodyAvgCharWidthEm: bodyAvg,
        imageAlphaMask: (params.image as any)?.bgRemovalEnabled === false ? undefined : (params.image as any)?.mask || undefined,
      });
    };

    // Always produce a candidate layout; then retry slightly more conservatively if overflow is detected.
    let chosen = wrapOnce(headlineAvgBase, bodyAvgBase) as any;
    const factors = [1.03, 1.06, 1.09];
    if (!validateNoOverflow(chosen.layout, chosen.meta)) {
      for (const f of factors) {
        const attempt = wrapOnce(headlineAvgBase * f, bodyAvgBase * f) as any;
        chosen = attempt;
        if (validateNoOverflow(attempt.layout, attempt.meta)) break;
      }
      if (!validateNoOverflow(chosen.layout, chosen.meta)) {
        // Fallback: revert to the original conservative estimator if relaxed packing would overflow.
        chosen = wrapOnce(
          estimateAvgCharWidthEm(headlineFontFamily, headlineFontWeight),
          estimateAvgCharWidthEm(bodyFontFamily, bodyFontWeight)
        ) as any;
      }
    }

    const { layout, meta } = chosen;

    // Apply per-slide block alignment overrides (Google-Docs-like: paragraph setting).
    // IMPORTANT: `CarouselPreviewVision` treats `position.x` as the Fabric object's LEFT, so we must NOT
    // shift x for center/right. Instead, keep the box position fixed (within the content/lane) and only
    // change `textAlign`, which aligns text within the box (like Docs aligns within margins).
    const alignHeadline = (params.headlineTextAlign || "left") as "left" | "center" | "right";
    const alignBody = (params.bodyTextAlign || "left") as "left" | "center" | "right";
    const applyAlign = (l: any, targetAlign: "left" | "center" | "right") => ({ ...l, textAlign: targetAlign });
    if (Array.isArray(meta?.lineSources) && Array.isArray(layout?.textLines)) {
      layout.textLines = layout.textLines.map((l: any, idx: number) => {
        const src = meta.lineSources?.[idx] as any;
        const block = (src?.block === "HEADLINE" ? "HEADLINE" : "BODY") as "HEADLINE" | "BODY";
        const target = block === "HEADLINE" ? alignHeadline : alignBody;
        return applyAlign(l, target);
      });
    }

    // Phase 4: attach stable line keys and apply per-line overrides (x/y/maxWidth) keyed by source ranges.
    const overridesByKey = (params.lineOverridesByKey && typeof params.lineOverridesByKey === "object")
      ? params.lineOverridesByKey
      : null;
    if (Array.isArray(meta?.lineSources) && Array.isArray(layout?.textLines)) {
      const usedKeys: string[] = [];
      const usedOverrideKeys = new Set<string>();
      const inset = getTemplateContentRectInset(params.templateSnapshot) || null;
      const clampToInset = (l: any) => {
        if (!inset) return l;
        const w = Math.max(1, Number(l.maxWidth || 1));
        const h = Math.max(1, Number(l.baseSize || 0) * Number(l.lineHeight || 1.2));
        const xMin = inset.x;
        const yMin = inset.y;
        const xMax = inset.x + inset.width - w;
        const yMax = inset.y + inset.height - h;
        const nx = Math.max(xMin, Math.min(xMax, Number(l.position?.x ?? 0)));
        const ny = Math.max(yMin, Math.min(yMax, Number(l.position?.y ?? 0)));
        return { ...l, position: { x: nx, y: ny } };
      };

      // Fallback: also allow matching by normalized line text if keys shifted.
      const overrideList = overridesByKey ? Object.entries(overridesByKey).map(([k, v]) => ({ k, v })) : [];
      const byText = new Map<string, Array<{ k: string; v: any }>>();
      for (const ov of overrideList) {
        const t = normalizeLineText(String(ov.v?.lineText || ov.v?.text || ""));
        if (!t) continue;
        const arr = byText.get(t) || [];
        arr.push(ov);
        byText.set(t, arr);
      }

      layout.textLines = layout.textLines.map((l: any, idx: number) => {
        const src = meta.lineSources?.[idx];
        const key = buildLineKey(src, idx);
        usedKeys.push(key);
        let next = { ...l, lineKey: key, block: src?.block || "BODY" };

        if (overridesByKey) {
          const direct = overridesByKey[key];
          if (direct && typeof direct === "object") {
            usedOverrideKeys.add(key);
            const hasTextOverride = typeof (direct as any).text === "string";
            next = {
              ...next,
              position: { x: Number(direct.x) || next.position.x, y: Number(direct.y) || next.position.y },
              maxWidth: Math.max(1, Number(direct.maxWidth) || next.maxWidth || 1),
              ...(hasTextOverride ? { text: String((direct as any).text || ""), styles: [] } : {}),
            };
          } else {
            const t = normalizeLineText(String(next.text || ""));
            const cands = t ? (byText.get(t) || []) : [];
            if (cands.length > 0) {
              // Choose closest hintStart if present, otherwise first unused.
              const curStart = Number((src?.parts?.[0] as any)?.sourceStart ?? -1);
              const pick = cands
                .filter((c) => !usedOverrideKeys.has(c.k))
                .sort((a, b) => {
                  const ha = Number(a.v?.hintStart ?? -1);
                  const hb = Number(b.v?.hintStart ?? -1);
                  if (curStart >= 0 && ha >= 0 && hb >= 0) return Math.abs(ha - curStart) - Math.abs(hb - curStart);
                  return 0;
                })[0];
              if (pick) {
                usedOverrideKeys.add(pick.k);
                const hasTextOverride = typeof (pick.v as any)?.text === "string";
                next = {
                  ...next,
                  position: { x: Number(pick.v.x) || next.position.x, y: Number(pick.v.y) || next.position.y },
                  maxWidth: Math.max(1, Number(pick.v.maxWidth) || next.maxWidth || 1),
                  ...(hasTextOverride ? { text: String((pick.v as any).text || ""), styles: [] } : {}),
                };
              }
            }
          }
        }

        return clampToInset(next);
      });

      lastAppliedOverrideKeysRef.current[params.slideIndex] = Array.from(usedOverrideKeys);
    }

    // Apply inline style ranges (bold/italic/underline) to the computed line objects.
    if (Array.isArray(meta?.lineSources) && Array.isArray(layout?.textLines)) {
      const headlineRanges = params.headlineRanges || [];
      const bodyRanges = params.bodyRanges || [];
      layout.textLines = layout.textLines.map((l: any, idx: number) => {
        const src = meta.lineSources?.[idx];
        if (!src?.parts) return l;
        const ranges = src.block === "HEADLINE" ? headlineRanges : bodyRanges;
        return { ...l, block: src.block, styles: buildTextStylesForLine(src.parts, ranges) };
      });
    }

    // Preserve any existing image URL if present.
    if ((params.image as any)?.url && layout.image) {
      (layout.image as any).url = (params.image as any).url;
    }
    // Preserve editor-specific image metadata (mask + bg removal fields + storage pointers) so
    // live-layout/Realign (computational) doesn't "forget" the image state and regress UI to idle.
    if (params.image && layout.image) {
      const keys = ["mask", "storage", "bgRemovalEnabled", "bgRemovalStatus", "original", "processed"] as const;
      for (const k of keys) {
        if (typeof (params.image as any)?.[k] !== "undefined") {
          (layout.image as any)[k] = (params.image as any)[k];
        }
      }
    }
    return layout;
  };

  const computeRegularBodyTextboxLayout = (params: {
    slideIndex: number;
    body: string;
    templateSnapshot: any;
    image: any | null;
    existingLayout?: any | null;
    bodyRanges?: InlineStyleRange[];
    bodyFontSizePx?: number;
  }): VisionLayoutDecision | null => {
    // Regular should fit inside the SAME "safe area" shown by the teal overlay (allowed/inset rect),
    // not the raw contentRegion.
    const region = getTemplateContentRectInset(params.templateSnapshot);
    if (!region) return null;

    const imageUrl = (params.image as any)?.url || null;
    const prevLine = params.existingLayout?.textLines?.[0] || null;

    const requestedBodySize = Math.max(24, Math.min(120, Math.round(Number(params.bodyFontSizePx) || 48)));
    const rawX = typeof prevLine?.position?.x === "number" ? prevLine.position.x : region.x;
    // For Regular we anchor Y by CENTER so the box grows up/down.
    // - If we already have an anchored snapshot, preserve it.
    // - Otherwise default to center of contentRegion (ignores old top-anchored snapshots).
    const regionCenterY = region.y + (region.height / 2);
    const preservedCenterY =
      prevLine?.positionAnchorY === "center" && typeof prevLine?.position?.y === "number"
        ? prevLine.position.y
        : regionCenterY;
    const rawW = typeof prevLine?.maxWidth === "number" ? prevLine.maxWidth : region.width;

    // Clamp x/width to remain inside contentRegion.
    const x = Math.max(region.x, Math.min(region.x + region.width - 1, Number(rawX) || region.x));
    const maxW = Math.max(1, Math.floor((region.x + region.width) - x));
    const width = Math.max(1, Math.min(maxW, Math.floor(Number(rawW) || region.width)));

    // Largest size that fits the contentRegion vertically (tolerant by 1–2px).
    const fittedSize =
      typeof document === "undefined"
        ? requestedBodySize
        : fitRegularBodyFontSizePx({
            text: String(params.body || ""),
            maxWidthPx: width,
            maxHeightPx: region.height,
            bodyRanges: params.bodyRanges || [],
            // Regular max is 56px; shrink as needed.
            maxFontSizePx: 56,
          });
    const bodySize = Math.max(8, Math.min(120, Math.round(Number(fittedSize) || requestedBodySize)));

    // Clamp centerY so the wrapped textbox stays inside the contentRegion even after resizing text.
    // NOTE: y is stored as centerY for Regular (positionAnchorY="center").
    const measuredH =
      typeof document === "undefined"
        ? Math.max(1, Math.round(bodySize * 1.2))
        : measureRegularBodyHeightPx(String(params.body || ""), width, bodySize, params.bodyRanges || []);
    const halfH = Math.max(1, Math.floor(measuredH / 2));
    const minCenterY = region.y + halfH;
    const maxCenterY = (region.y + region.height) - halfH;
    const centerY =
      Number.isFinite(preservedCenterY as any)
        ? Math.max(minCenterY, Math.min(maxCenterY, Number(preservedCenterY)))
        : (region.y + region.height / 2);

    const layout: VisionLayoutDecision = {
      canvas: { width: 1080, height: 1440 },
      margins: { top: 60, right: 60, bottom: 60, left: 60 },
      textLines: [
        {
          text: params.body || "",
          baseSize: bodySize,
          position: { x, y: centerY },
          // Non-standard field (JSON snapshot only): used by renderer to interpret `position.y` as centerY.
          positionAnchorY: "center",
          textAlign: "left",
          lineHeight: 1.2,
          maxWidth: width,
          styles: buildTextStylesForLine(
            [
              {
                lineStart: 0,
                lineEnd: String(params.body || "").length,
                sourceStart: 0,
                sourceEnd: String(params.body || "").length,
              },
            ],
            params.bodyRanges || []
          ),
        },
      ],
      ...(params.image && imageUrl
        ? {
            image: {
              x: Number((params.image as any).x) || 0,
              y: Number((params.image as any).y) || 0,
              width: Number((params.image as any).width) || 0,
              height: Number((params.image as any).height) || 0,
              url: String(imageUrl),
            },
          }
        : {}),
    };

    return layout;
  };

  const enqueueLiveLayoutForProject = (projectId: string, indices: number[]) => {
    const pid = String(projectId || "").trim();
    if (!pid) return;
    indices.forEach((i) => {
      if (i < 0 || i >= slideCount) return;
      const key = liveLayoutKey(pid, i);
      const runId = (liveLayoutRunIdByKeyRef.current[key] || 0) + 1;
      liveLayoutRunIdByKeyRef.current[key] = runId;

      // Snapshot the slide state and template snapshot NOW so background processing can't bleed across projects.
      const slide = slidesRef.current[i] || initSlide();
      const tid = computeTemplateIdForSlide(i);
      const snap = (tid ? templateSnapshots[tid] : null) || null;

      const templateTypeAtSchedule = templateTypeId;
      const headline = templateTypeAtSchedule === "regular" ? "" : (slide.draftHeadline || "");
      const body = slide.draftBody || "";
      const headlineRanges = Array.isArray(slide.draftHeadlineRanges) ? slide.draftHeadlineRanges : [];
      const bodyRanges = Array.isArray(slide.draftBodyRanges) ? slide.draftBodyRanges : [];
      const headlineFontSizePx =
        Number.isFinite((slide as any)?.draftHeadlineFontSizePx as any)
          ? Math.max(24, Math.min(120, Math.round(Number((slide as any).draftHeadlineFontSizePx))))
          : 76;
      const _hAlign = (slide as any)?.draftHeadlineTextAlign;
      const headlineTextAlign: "left" | "center" | "right" =
        _hAlign === "center" || _hAlign === "right" ? _hAlign : "left";
      const bodyFontSizePxSnap =
        Number.isFinite((slide as any)?.draftBodyFontSizePx as any)
          ? Math.max(24, Math.min(120, Math.round(Number((slide as any).draftBodyFontSizePx))))
          : 48;
      const _bAlign = (slide as any)?.draftBodyTextAlign;
      const bodyTextAlign: "left" | "center" | "right" = _bAlign === "center" || _bAlign === "right" ? _bAlign : "left";

      const prevInput = (slide as any)?.inputData || null;
      const lineOverridesByKey =
        prevInput && typeof prevInput === "object" && prevInput.lineOverridesByKey && typeof prevInput.lineOverridesByKey === "object"
          ? prevInput.lineOverridesByKey
          : null;

      const existingLayout = (slide as any)?.layoutData?.layout || null;
      const image = existingLayout && typeof existingLayout === "object" ? (existingLayout as any).image || null : null;

      const item: LiveLayoutWorkItem = {
        key,
        runId,
        projectId: pid,
        slideIndex: i,
        templateTypeId: templateTypeAtSchedule,
        templateId: tid || null,
        templateSnapshot: snap,
        headline,
        body,
        headlineRanges,
        bodyRanges,
        headlineFontSizePx,
        bodyFontSizePx: bodyFontSizePxSnap,
        headlineTextAlign,
        bodyTextAlign,
        lineOverridesByKey,
        image,
        existingLayout,
        settings: {
          backgroundColor: projectBackgroundColor || "#ffffff",
          textColor: projectTextColor || "#000000",
          includeImage: false,
        },
      };

      // De-dupe: remove any older queued item for same key (we keep only the newest snapshot).
      liveLayoutQueueRef.current = liveLayoutQueueRef.current.filter((x) => x.key !== key);
      liveLayoutQueueRef.current.push(item);
    });
    void processLiveLayoutQueue();
  };

  const processLiveLayoutQueue = async () => {
    if (liveLayoutRunningRef.current) return;
    liveLayoutRunningRef.current = true;
    try {
      // Ensure fonts (including italic/bold variants) are loaded before measuring/wrapping.
      // This prevents Fabric from falling back mid-render (which causes odd spacing/kerning and unexpected wraps).
      await ensureTypographyFontsLoaded({
        headlineFontFamily,
        headlineFontWeight,
        bodyFontFamily,
        bodyFontWeight,
      });

      while (liveLayoutQueueRef.current.length > 0) {
        const item = liveLayoutQueueRef.current.shift() as LiveLayoutWorkItem;
        const slideIndex = item.slideIndex;
        const pid = item.projectId;
        const key = item.key;
        // Ignore stale completions for this project+slide.
        if (liveLayoutRunIdByKeyRef.current[key] !== item.runId) continue;

        const snap = item.templateSnapshot;
        const tid = item.templateId;
        if (!snap) {
          addLog(`⚠️ Live layout skipped slide ${slideIndex + 1}: missing template snapshot`);
          continue;
        }

        const headline = item.headline || "";
        const body = item.body || "";
        if (!String(body).trim() && !String(headline).trim()) {
          addLog(`⏭️ Live layout skipped slide ${slideIndex + 1}: empty text`);
          continue;
        }

        addLog(
          `📐 Live layout slide ${slideIndex + 1} start: project=${pid} template=${tid || "none"} headlineLen=${headline.length} bodyLen=${body.length} headlineRanges=${item.headlineRanges.length} bodyRanges=${item.bodyRanges.length}`
        );

        const headlineTextAlign: "left" | "center" | "right" =
          item.headlineTextAlign === "center" || item.headlineTextAlign === "right" ? item.headlineTextAlign : "left";
        const bodyTextAlign: "left" | "center" | "right" =
          item.bodyTextAlign === "center" || item.bodyTextAlign === "right" ? item.bodyTextAlign : "left";

        const nextLayout =
          item.templateTypeId === "regular"
            ? computeRegularBodyTextboxLayout({
                slideIndex,
                body,
                templateSnapshot: snap,
                image: item.image,
                existingLayout: item.existingLayout,
                bodyRanges: item.bodyRanges,
                bodyFontSizePx: item.bodyFontSizePx,
              })
            : computeDeterministicLayout({
                slideIndex,
                headline,
                body,
                templateSnapshot: snap,
                image: item.image,
                headlineRanges: item.headlineRanges,
                bodyRanges: item.bodyRanges,
                lineOverridesByKey: item.lineOverridesByKey,
                headlineFontSizePx: item.headlineFontSizePx,
                bodyFontSizePx: item.bodyFontSizePx,
                headlineTextAlign,
                bodyTextAlign,
              });
        if (!nextLayout) continue;

        const effectiveBodyFontSizePx =
          item.templateTypeId === "regular"
            ? Number((nextLayout as any)?.textLines?.[0]?.baseSize ?? item.bodyFontSizePx ?? 48)
            : item.bodyFontSizePx;

        const textLineCount = Array.isArray((nextLayout as any)?.textLines) ? (nextLayout as any).textLines.length : 0;
        const styleCount = Array.isArray((nextLayout as any)?.textLines)
          ? (nextLayout as any).textLines.reduce((acc: number, l: any) => acc + (Array.isArray(l?.styles) ? l.styles.length : 0), 0)
          : 0;
        addLog(`✅ Live layout slide ${slideIndex + 1} done: lines=${textLineCount} styles=${styleCount}`);

        const req: any = {
          headline,
          body,
          headlineFontSizePx: item.headlineFontSizePx,
          bodyFontSizePx: effectiveBodyFontSizePx,
          headlineTextAlign,
          bodyTextAlign,
          settings: item.settings,
          templateId: tid || undefined,
          headlineStyleRanges: item.headlineRanges,
          bodyStyleRanges: item.bodyRanges,
          ...(item.lineOverridesByKey ? { lineOverridesByKey: item.lineOverridesByKey } : {}),
        } satisfies CarouselTextRequest as any;

        const nextLayoutData = {
          success: true,
          layout: nextLayout,
          imageUrl: (item.image as any)?.url || null,
        };

        // Only apply in-memory/UI updates if we're still viewing this project.
        if (currentProjectIdRef.current === pid) {
          setSlides((prev) =>
            prev.map((s, i) =>
              i !== slideIndex
                ? s
                : {
                    ...s,
                    layoutData: nextLayoutData,
                    inputData: req,
                    ...(item.templateTypeId === "regular" ? { draftBodyFontSizePx: effectiveBodyFontSizePx } : {}),
                  }
            )
          );
          slidesRef.current = slidesRef.current.map((s, i) =>
            i !== slideIndex
              ? s
              : {
                  ...s,
                  layoutData: nextLayoutData,
                  inputData: req,
                  ...(item.templateTypeId === "regular" ? { draftBodyFontSizePx: effectiveBodyFontSizePx } : {}),
                }
          );
          // If this is the active slide, also update the engine so Fabric rerenders immediately.
          if (slideIndex === activeSlideIndexRef.current) {
            setLayoutData(nextLayoutData as any);
            setInputData(req as any);
            setLayoutHistory((h) => h || []);
          }
        }

        // Always persist to the original project+slide.
        void saveSlidePatchForProject(pid, slideIndex, {
          layoutSnapshot: nextLayout,
          inputSnapshot: req,
        });

        // Yield to the browser between slides to keep UI responsive.
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      liveLayoutRunningRef.current = false;
    }
  };

  const scheduleLiveLayout = (slideIndex: number) => {
    if (!currentProjectId) return;
    const pid = currentProjectId;
    const key = liveLayoutKey(pid, slideIndex);
    const prev = liveLayoutTimeoutsRef.current[key];
    if (prev) window.clearTimeout(prev);
    liveLayoutTimeoutsRef.current[key] = window.setTimeout(() => {
      enqueueLiveLayoutForProject(pid, [slideIndex]);
    }, LIVE_LAYOUT_DEBOUNCE_MS);
  };

  // NOTE: scheduleLiveLayoutAll was removed since body font size is now per-slide

  const wipeLineOverridesForActiveSlide = (): { nextInput: any | null } => {
    if (templateTypeId !== "enhanced") return { nextInput: null };
    if (!currentProjectId) return { nextInput: null };
    const slideIndex = activeSlideIndex;
    const curSlide = slidesRef.current[slideIndex] || initSlide();
    const cur = (slideIndex === activeSlideIndex ? inputData : null) || (curSlide as any)?.inputData || null;
    if (!cur || typeof cur !== "object") return { nextInput: null };
    if (!(cur as any).lineOverridesByKey) return { nextInput: null };

    const next = { ...(cur as any) };
    try {
      delete (next as any).lineOverridesByKey;
    } catch {
      // ignore
    }

    setSlides((prev) =>
      prev.map((s, i) => (i !== slideIndex ? s : ({ ...s, inputData: next } as any)))
    );
    slidesRef.current = slidesRef.current.map((s, i) => (i !== slideIndex ? s : ({ ...s, inputData: next } as any)));
    if (slideIndex === activeSlideIndex) setInputData(next as any);

    // Persist wipe (best-effort, async) so Realign starts fresh next time too.
    void saveSlidePatch(slideIndex, { inputSnapshot: next });

    return { nextInput: next };
  };

  const handleRegularCanvasTextChange = (change: {
    canvasSlideIndex?: number;
    lineIndex: number;
    x: number;
    y: number;
    maxWidth: number;
    text?: string;
  }) => {
    if (templateTypeId !== "regular") return;
    const slideIndex =
      Number.isInteger((change as any)?.canvasSlideIndex) ? Number((change as any).canvasSlideIndex) : activeSlideIndex;
    if (slideIndex < 0 || slideIndex >= slideCount) return;
    const curSlide = slidesRef.current[slideIndex] || initSlide();
    // IMPORTANT: Use slidesRef (sync) as the base layout so rapid consecutive moves don't overwrite each other
    // due to async React state updates (layoutData).
    const baseLayout: any =
      (curSlide as any)?.layoutData?.layout ||
      (slideIndex === activeSlideIndex ? (layoutData as any)?.layout : null) ||
      null;
    if (!baseLayout || !Array.isArray(baseLayout.textLines) || !baseLayout.textLines[change.lineIndex]) return;

    // If there is a pending debounced live-layout for this slide (e.g., from recent typing),
    // cancel it so a full reflow can't immediately overwrite this manual move on release.
    try {
      const t = currentProjectId ? liveLayoutTimeoutsRef.current[liveLayoutKey(currentProjectId, slideIndex)] : null;
      if (t) window.clearTimeout(t);
      if (currentProjectId) liveLayoutTimeoutsRef.current[liveLayoutKey(currentProjectId, slideIndex)] = null;
      if (currentProjectId) {
        const k = liveLayoutKey(currentProjectId, slideIndex);
        liveLayoutQueueRef.current = liveLayoutQueueRef.current.filter((x) => x.key !== k);
        // Also invalidate any in-flight work item for this key.
        liveLayoutRunIdByKeyRef.current[k] = (liveLayoutRunIdByKeyRef.current[k] || 0) + 1;
      }
    } catch {
      // ignore
    }

    // Enable Undo after on-canvas commits (move/resize/text edit). Only push when something truly changed.
    try {
      const curLine = baseLayout.textLines?.[change.lineIndex] as any;
      const eps = 0.5;
      const didMove =
        Math.abs(Number(curLine?.position?.x ?? 0) - Number(change.x ?? 0)) > eps ||
        Math.abs(Number(curLine?.position?.y ?? 0) - Number(change.y ?? 0)) > eps;
      const didResize = Math.abs(Number(curLine?.maxWidth ?? 0) - Number(change.maxWidth ?? 0)) > eps;
      const didEditText = typeof change.text === "string" && String(change.text) !== String(curLine?.text ?? "");
      if (didMove || didResize || didEditText) pushUndoSnapshot();
    } catch {
      // If diffing fails for any reason, err on the side of enabling Undo.
      pushUndoSnapshot();
    }

    const nextTextLines = baseLayout.textLines.map((l: any, idx: number) => {
      if (idx !== change.lineIndex) return l;
      return {
        ...l,
        text: change.text !== undefined ? change.text : l.text,
        position: { x: change.x, y: change.y },
        maxWidth: Math.max(1, Number(change.maxWidth) || l.maxWidth || 1),
      };
    });
    // Regular: shrink-to-fit after release (do NOT run full reflow here; preserve manual move/resize).
    let nextLayoutSnap = { ...baseLayout, textLines: nextTextLines } as VisionLayoutDecision;
    let fittedSizeForUi = Number((curSlide as any)?.draftBodyFontSizePx ?? 48);
    try {
      const tidForFit = computeTemplateIdForSlide(slideIndex);
      const snapForFit = tidForFit ? templateSnapshots[tidForFit] : null;
      const region = getTemplateContentRectInset(snapForFit || null);
      const nextBodyForFit = change.text !== undefined ? String(change.text || "") : String(curSlide.draftBody || "");
      const line0 = (nextLayoutSnap as any)?.textLines?.[0] || null;
      if (region && line0) {
        const rawX = Number(line0?.position?.x ?? region.x) || region.x;
        const x = Math.max(region.x, Math.min(region.x + region.width - 1, rawX));
        const maxW = Math.max(1, Math.floor((region.x + region.width) - x));
        const width = Math.max(1, Math.min(maxW, Math.floor(Number(line0?.maxWidth ?? region.width) || region.width)));
        const fitted = fitRegularBodyFontSizePx({
          text: nextBodyForFit,
          maxWidthPx: width,
          maxHeightPx: region.height,
          bodyRanges: Array.isArray(curSlide.draftBodyRanges) ? curSlide.draftBodyRanges : [],
          // Regular max is 56px; shrink as needed.
          maxFontSizePx: 56,
        });
        const measuredH = measureRegularBodyHeightPx(
          nextBodyForFit,
          width,
          fitted,
          Array.isArray(curSlide.draftBodyRanges) ? curSlide.draftBodyRanges : []
        );
        const halfH = Math.max(1, Math.floor(measuredH / 2));
        const minCenterY = region.y + halfH;
        const maxCenterY = (region.y + region.height) - halfH;
        const rawCenterY = Number(line0?.position?.y ?? (region.y + region.height / 2));
        const centerY = Math.max(minCenterY, Math.min(maxCenterY, rawCenterY));
        fittedSizeForUi = fitted;
        nextLayoutSnap = {
          ...nextLayoutSnap,
          textLines: [
            {
              ...line0,
              position: { ...(line0.position || {}), x, y: centerY },
              maxWidth: width,
              baseSize: fitted,
            },
          ],
        } as any;
      }
    } catch {
      // ignore
    }

    const tid = computeTemplateIdForSlide(slideIndex);
    const nextBody = change.text !== undefined ? change.text : (curSlide.draftBody || "");
    const req: any = {
      headline: "",
      body: nextBody,
      bodyFontSizePx: fittedSizeForUi,
      settings: {
        backgroundColor: projectBackgroundColor || "#ffffff",
        textColor: projectTextColor || "#000000",
        includeImage: false,
      },
      templateId: tid || undefined,
      headlineStyleRanges: Array.isArray(curSlide.draftHeadlineRanges) ? curSlide.draftHeadlineRanges : [],
      bodyStyleRanges: Array.isArray(curSlide.draftBodyRanges) ? curSlide.draftBodyRanges : [],
    } satisfies CarouselTextRequest as any;

    // Update local state so subsequent live-layout runs preserve the dragged position.
    setSlides((prev) =>
      prev.map((s, i) =>
        i !== slideIndex
          ? s
          : {
              ...s,
              draftBody: change.text !== undefined ? nextBody : s.draftBody,
              draftBodyFontSizePx: fittedSizeForUi,
              layoutData: { success: true, layout: nextLayoutSnap, imageUrl: (s as any)?.layoutData?.imageUrl || null },
              inputData: req,
            }
      )
    );
    slidesRef.current = slidesRef.current.map((s, i) =>
      i !== slideIndex
        ? s
        : {
            ...s,
            draftBody: change.text !== undefined ? nextBody : (s.draftBody || ""),
            draftBodyFontSizePx: fittedSizeForUi,
            layoutData: { success: true, layout: nextLayoutSnap, imageUrl: (s as any)?.layoutData?.imageUrl || null },
            inputData: req,
          }
    );

    // If active, also update the engine so Fabric rerenders immediately.
    if (slideIndex === activeSlideIndex) {
      setLayoutData({ success: true, layout: nextLayoutSnap, imageUrl: (layoutData as any)?.imageUrl || null } as any);
      setInputData(req as any);
    }

    // Debounced persist.
    if (!currentProjectId) return;
    if (regularCanvasSaveTimeoutRef.current) window.clearTimeout(regularCanvasSaveTimeoutRef.current);
    const projectIdAtSchedule = currentProjectId;
    const slideIndexAtSchedule = slideIndex;
    const layoutAtSchedule = nextLayoutSnap;
    const inputAtSchedule = req;
    regularCanvasSaveTimeoutRef.current = window.setTimeout(() => {
      void saveSlidePatchForProject(projectIdAtSchedule, slideIndexAtSchedule, {
        layoutSnapshot: layoutAtSchedule,
        inputSnapshot: inputAtSchedule,
      });
    }, 500);
  };

  const handleEnhancedCanvasTextChange = (change: {
    canvasSlideIndex?: number;
    lineIndex: number;
    lineKey?: string;
    x: number;
    y: number;
    maxWidth: number;
    text?: string;
  }) => {
    if (templateTypeId !== "enhanced") return;
    if (!currentProjectId) return;
    const slideIndex =
      Number.isInteger((change as any)?.canvasSlideIndex) ? Number((change as any).canvasSlideIndex) : activeSlideIndex;
    if (slideIndex < 0 || slideIndex >= slideCount) return;
    const curSlide = slidesRef.current[slideIndex] || initSlide();
    // IMPORTANT: Use slidesRef (sync) as the base layout so rapid consecutive moves don't overwrite each other
    // due to async React state updates (layoutData).
    const baseLayout: any =
      (curSlide as any)?.layoutData?.layout ||
      (slideIndex === activeSlideIndex ? (layoutData as any)?.layout : null) ||
      null;
    if (!baseLayout || !Array.isArray(baseLayout.textLines) || !baseLayout.textLines[change.lineIndex]) return;

    // If there is a pending debounced live-layout for this slide (e.g., from recent typing),
    // cancel it so a full reflow can't immediately overwrite this manual move on release.
    try {
      const t = currentProjectId ? liveLayoutTimeoutsRef.current[liveLayoutKey(currentProjectId, slideIndex)] : null;
      if (t) window.clearTimeout(t);
      if (currentProjectId) liveLayoutTimeoutsRef.current[liveLayoutKey(currentProjectId, slideIndex)] = null;
      if (currentProjectId) {
        const k = liveLayoutKey(currentProjectId, slideIndex);
        liveLayoutQueueRef.current = liveLayoutQueueRef.current.filter((x) => x.key !== k);
        liveLayoutRunIdByKeyRef.current[k] = (liveLayoutRunIdByKeyRef.current[k] || 0) + 1;
      }
    } catch {
      // ignore
    }

    const changeKey =
      change?.lineKey ||
      (baseLayout.textLines?.[change.lineIndex] as any)?.lineKey ||
      null;

    // Enable Undo after on-canvas commits (move/resize/text edit). Only push when something truly changed.
    try {
      const eps = 0.5;
      const idxByKey =
        changeKey && Array.isArray(baseLayout.textLines)
          ? baseLayout.textLines.findIndex((l: any) => String((l as any)?.lineKey || "") === String(changeKey))
          : -1;
      const targetIdx = idxByKey >= 0 ? idxByKey : change.lineIndex;
      const curLine = baseLayout.textLines?.[targetIdx] as any;
      const didMove =
        Math.abs(Number(curLine?.position?.x ?? 0) - Number(change.x ?? 0)) > eps ||
        Math.abs(Number(curLine?.position?.y ?? 0) - Number(change.y ?? 0)) > eps;
      const didResize = Math.abs(Number(curLine?.maxWidth ?? 0) - Number(change.maxWidth ?? 0)) > eps;
      const didEditText = typeof change.text === "string" && String(change.text) !== String(curLine?.text ?? "");
      if (didMove || didResize || didEditText) pushUndoSnapshot();
    } catch {
      // If diffing fails for any reason, err on the side of enabling Undo.
      pushUndoSnapshot();
    }

    const nextTextLines = baseLayout.textLines.map((l: any, idx: number) => {
      const lk = (l as any)?.lineKey;
      const hit = (changeKey && lk && lk === changeKey) || idx === change.lineIndex;
      if (!hit) return l;
      return {
        ...l,
        text: change.text !== undefined ? change.text : l.text,
        position: { x: change.x, y: change.y },
        maxWidth: Math.max(1, Number(change.maxWidth) || l.maxWidth || 1),
      };
    });
    const nextLayoutSnap = { ...baseLayout, textLines: nextTextLines } as VisionLayoutDecision;

    // Phase 4: persist per-line overrides keyed by stable lineKey into input_snapshot.
    const curInput: any = (slideIndex === activeSlideIndex ? inputData : null) || (curSlide as any)?.inputData || null;
    const prevOverrides = (curInput && typeof curInput === "object" && curInput.lineOverridesByKey && typeof curInput.lineOverridesByKey === "object")
      ? curInput.lineOverridesByKey
      : {};
    const line = nextLayoutSnap.textLines?.[change.lineIndex] as any;
    const lineText = normalizeLineText(String(line?.text || ""));
    const hintStart = (() => {
      const l0 = baseLayout.textLines?.[change.lineIndex] as any;
      const s = Number(l0?.__hintStart ?? l0?.hintStart ?? -1);
      return Number.isFinite(s) ? s : undefined;
    })();
    const overrideKey = String(changeKey || `IDX:${change.lineIndex}`);
    const nextOverridesByKey = {
      ...prevOverrides,
      [overrideKey]: {
        x: Number(change.x) || 0,
        y: Number(change.y) || 0,
        maxWidth: Math.max(1, Number(change.maxWidth) || 1),
        lineText,
        ...(typeof hintStart === "number" ? { hintStart } : {}),
      },
    };

    // Canvas edits are the source-of-truth now.
    // - Do NOT persist per-line text overrides (they fight Realign repacking).
    // - When a line's text changes, rebuild the ENTIRE block (headline/body) from the current lines.
    const editedLine = nextTextLines?.[change.lineIndex] as any;
    const editedBlock: "HEADLINE" | "BODY" = (editedLine?.block === "HEADLINE" ? "HEADLINE" : "BODY");
    const didEditText = typeof change.text === "string";

    const rebuildBlock = (block: "HEADLINE" | "BODY") =>
      nextTextLines
        .filter((l: any) => (l?.block === "HEADLINE" ? "HEADLINE" : "BODY") === block)
        .map((l: any) => String(l?.text || "").trim())
        .filter((s: string) => !!s)
        .join(" ");

    // Only rewrite headline/body source-of-truth when the user actually edited text (not when dragging).
    const nextHeadlineText = didEditText
      ? rebuildBlock("HEADLINE")
      : String((curInput && typeof curInput === "object" ? (curInput as any).headline : null) ?? (curSlide.draftHeadline || ""));
    const nextBodyText = didEditText
      ? rebuildBlock("BODY")
      : String((curInput && typeof curInput === "object" ? (curInput as any).body : null) ?? (curSlide.draftBody || ""));

    // v1 styling behavior: if the user edits a block on-canvas, drop styling ranges for that block.
    const prevHeadlineRanges = Array.isArray(curSlide.draftHeadlineRanges) ? curSlide.draftHeadlineRanges : [];
    const prevBodyRanges = Array.isArray(curSlide.draftBodyRanges) ? curSlide.draftBodyRanges : [];
    const prevHeadlineText = String((curInput && typeof curInput === "object" ? (curInput as any).headline : null) ?? (curSlide.draftHeadline || ""));
    const prevBodyText = String((curInput && typeof curInput === "object" ? (curInput as any).body : null) ?? (curSlide.draftBody || ""));

    const nextHeadlineRanges =
      didEditText && editedBlock === "HEADLINE"
        ? remapRangesByDiff({ oldText: prevHeadlineText, newText: nextHeadlineText, ranges: prevHeadlineRanges })
        : prevHeadlineRanges;
    const nextBodyRanges =
      didEditText && editedBlock === "BODY"
        ? remapRangesByDiff({ oldText: prevBodyText, newText: nextBodyText, ranges: prevBodyRanges })
        : prevBodyRanges;

    // Best-effort cleanup: once we move to block-level text as source-of-truth, strip any legacy per-line
    // text overrides so they don't fight future repacks.
    if (didEditText) {
      try {
        for (const k of Object.keys(nextOverridesByKey || {})) {
          if ((nextOverridesByKey as any)?.[k] && typeof (nextOverridesByKey as any)[k] === "object") {
            delete (nextOverridesByKey as any)[k].text;
          }
        }
      } catch {
        // ignore
      }
    }

    const nextInputSnap = {
      ...(curInput && typeof curInput === "object" ? curInput : {}),
      ...(didEditText ? { headline: nextHeadlineText, body: nextBodyText } : {}),
      ...(didEditText
        ? { headlineStyleRanges: nextHeadlineRanges, bodyStyleRanges: nextBodyRanges }
        : {}),
      lineOverridesByKey: nextOverridesByKey,
    };

    // Keep state in sync so the current slide preserves the nudged position immediately.
    setSlides((prev) =>
      prev.map((s, i) =>
        i !== slideIndex
          ? s
          : {
              ...s,
              draftHeadline: didEditText ? nextHeadlineText : s.draftHeadline,
              draftBody: didEditText ? nextBodyText : s.draftBody,
              draftHeadlineRanges: nextHeadlineRanges,
              draftBodyRanges: nextBodyRanges,
              layoutData: { success: true, layout: nextLayoutSnap, imageUrl: (s as any)?.layoutData?.imageUrl || null } as any,
              inputData: nextInputSnap,
            }
      )
    );
    slidesRef.current = slidesRef.current.map((s, i) =>
      i !== slideIndex
        ? s
        : ({
            ...s,
            draftHeadline: didEditText ? nextHeadlineText : (s as any).draftHeadline,
            draftBody: didEditText ? nextBodyText : (s as any).draftBody,
            draftHeadlineRanges: nextHeadlineRanges,
            draftBodyRanges: nextBodyRanges,
            layoutData: { success: true, layout: nextLayoutSnap, imageUrl: (s as any)?.layoutData?.imageUrl || null } as any,
            inputData: nextInputSnap,
          } as any)
    );

    if (slideIndex === activeSlideIndex) {
      setLayoutData({ success: true, layout: nextLayoutSnap, imageUrl: (layoutData as any)?.imageUrl || null } as any);
      setInputData(nextInputSnap as any);
    }

    // Debounced persist.
    if (enhancedCanvasSaveTimeoutRef.current) window.clearTimeout(enhancedCanvasSaveTimeoutRef.current);
    const projectIdAtSchedule = currentProjectId;
    const slideIndexAtSchedule = slideIndex;
    const layoutAtSchedule = nextLayoutSnap;
    const inputAtSchedule = nextInputSnap;
    enhancedCanvasSaveTimeoutRef.current = window.setTimeout(() => {
      void saveSlidePatchForProject(projectIdAtSchedule, slideIndexAtSchedule, {
        layoutSnapshot: layoutAtSchedule,
        inputSnapshot: inputAtSchedule,
      });
    }, 500);
  };

  const loadTemplateTypeEffective = async (type: 'regular' | 'enhanced') => {
    addLog(`🧾 Loading template-type settings: ${type.toUpperCase()}`);
    const data = await fetchJson(`/api/editor/template-types/effective?type=${type}`);
    const effective = data?.effective;
    setTemplateTypePrompt(effective?.prompt || '');
    setTemplateTypeEmphasisPrompt(effective?.emphasisPrompt || '');
    setTemplateTypeImageGenPrompt(effective?.imageGenPrompt || '');
    setTemplateTypeMappingSlide1(effective?.slide1TemplateId ?? null);
    setTemplateTypeMappingSlide2to5(effective?.slide2to5TemplateId ?? null);
    setTemplateTypeMappingSlide6(effective?.slide6TemplateId ?? null);
    addLog(
      `✅ Settings loaded: promptLen=${String(effective?.prompt || "").length}, emphasisLen=${String(effective?.emphasisPrompt || "").length}, imageGenLen=${String(effective?.imageGenPrompt || "").length}`
    );
    // Reset prompt status on type switch
    setPromptSaveStatus('idle');
    promptDirtyRef.current = false;
  };

  const refreshProjectsList = async () => {
    setProjectsLoading(true);
    try {
      const data = await fetchJson('/api/editor/projects/list');
      const next = Array.isArray(data.projects) ? data.projects : [];
      const sorted = [...next].sort(
        (a: any, b: any) => Date.parse(String(b?.updated_at || 0)) - Date.parse(String(a?.updated_at || 0))
      );
      setProjects(sorted);
    } finally {
      setProjectsLoading(false);
    }
  };

  const projectMappingSaveRunIdRef = useRef(0);
  const persistCurrentProjectTemplateMappings = async (patch: {
    slide1TemplateIdSnapshot?: string | null;
    slide2to5TemplateIdSnapshot?: string | null;
    slide6TemplateIdSnapshot?: string | null;
  }) => {
    const projectIdAtStart = currentProjectIdRef.current;
    if (!projectIdAtStart) return;
    const runId = (projectMappingSaveRunIdRef.current || 0) + 1;
    projectMappingSaveRunIdRef.current = runId;
    try {
      addLog(
        `🧩 Applying template mappings to current project: ${projectIdAtStart} ` +
          `(s1=${patch.slide1TemplateIdSnapshot ?? "—"}, s25=${patch.slide2to5TemplateIdSnapshot ?? "—"}, s6=${patch.slide6TemplateIdSnapshot ?? "—"})`
      );
      const res = await fetchJson('/api/editor/projects/update-mappings', {
        method: 'POST',
        body: JSON.stringify({ projectId: projectIdAtStart, ...patch }),
      });
      if (projectMappingSaveRunIdRef.current !== runId) return;
      if (currentProjectIdRef.current !== projectIdAtStart) return;
      const p = res?.project || null;
      if (!p) return;
      setProjectMappingSlide1(p.slide1_template_id_snapshot ?? null);
      setProjectMappingSlide2to5(p.slide2_5_template_id_snapshot ?? null);
      setProjectMappingSlide6(p.slide6_template_id_snapshot ?? null);
      void refreshProjectsList();
      addLog(`✅ Applied template mappings to project`);
    } catch (e: any) {
      addLog(`❌ Apply template mappings failed: ${String(e?.message || e || 'unknown error')}`);
    }
  };

  const loadProject = async (projectId: string) => {
    const data = await fetchJson(`/api/editor/projects/load?id=${encodeURIComponent(projectId)}`, { method: 'GET' });
    const project = data.project;
    const loadedSlides = data.slides || [];
    setCurrentProjectId(project.id);
    setProjectTitle(project.title || 'Untitled Project');
    setTemplateTypeId(project.template_type_id === 'enhanced' ? 'enhanced' : 'regular');
    setCaptionDraft(project.caption || '');

    // Apply snapshot mapping for render/layout to avoid morphing
    setProjectMappingSlide1(project.slide1_template_id_snapshot ?? null);
    setProjectMappingSlide2to5(project.slide2_5_template_id_snapshot ?? null);
    setProjectMappingSlide6(project.slide6_template_id_snapshot ?? null);
    setProjectPromptSnapshot(project.prompt_snapshot || '');

    const nextSlides: SlideState[] = Array.from({ length: slideCount }).map((_, i) => {
      const prev = slidesRef.current[i] || initSlide();
      const row = loadedSlides.find((r: any) => r.slide_index === i);
      const layoutSnap = row?.layout_snapshot ?? null;
      const inputSnap = row?.input_snapshot ?? null;
      const loadedHeadline = row?.headline || '';
      const loadedBody = row?.body || '';
      const loadedAiImagePrompt = row?.ai_image_prompt || '';
      return {
        ...prev,
        savedHeadline: loadedHeadline,
        savedBody: loadedBody,
        draftHeadline: loadedHeadline,
        draftBody: loadedBody,
        draftHeadlineRanges: Array.isArray(inputSnap?.headlineStyleRanges) ? inputSnap.headlineStyleRanges : [],
        draftBodyRanges: Array.isArray(inputSnap?.bodyStyleRanges) ? inputSnap.bodyStyleRanges : [],
        draftHeadlineFontSizePx: Number.isFinite((inputSnap as any)?.headlineFontSizePx as any)
          ? Math.max(24, Math.min(120, Math.round(Number((inputSnap as any).headlineFontSizePx))))
          : 76,
          draftHeadlineTextAlign: (String((inputSnap as any)?.headlineTextAlign || "left") === "center"
            ? "center"
            : String((inputSnap as any)?.headlineTextAlign || "left") === "right"
              ? "right"
              : "left"),
          draftBodyFontSizePx: Number.isFinite((inputSnap as any)?.bodyFontSizePx as any)
            ? Math.max(24, Math.min(120, Math.round(Number((inputSnap as any).bodyFontSizePx))))
            : 48,
          draftBodyTextAlign: (String((inputSnap as any)?.bodyTextAlign || "left") === "center"
            ? "center"
            : String((inputSnap as any)?.bodyTextAlign || "left") === "right"
              ? "right"
              : "left"),
        layoutData: layoutSnap ? { success: true, layout: layoutSnap, imageUrl: null } : null,
        inputData: inputSnap || null,
        layoutHistory: [],
        savedAiImagePrompt: loadedAiImagePrompt,
        draftAiImagePrompt: loadedAiImagePrompt,
      };
    });
    setSlides(nextSlides);
    slidesRef.current = nextSlides;
    setActiveSlideIndex(0);
    // Restore slide 1 (index 0) snapshots into the engine immediately.
    if (nextSlides[0]?.layoutData && nextSlides[0]?.inputData) {
      setLayoutData(nextSlides[0].layoutData);
      setInputData(nextSlides[0].inputData);
      setLayoutHistory(nextSlides[0].layoutHistory || []);
    } else {
      handleNewCarousel();
    }
  };

  const createNewProject = async (type: 'regular' | 'enhanced') => {
    const data = await fetchJson('/api/editor/projects/create', {
      method: 'POST',
      body: JSON.stringify({ templateTypeId: type, title: 'Untitled Project' }),
    });
    const project = data.project;
    const slidesRows = data.slides || [];
    setCurrentProjectId(project.id);
    setProjectTitle(project.title || 'Untitled Project');
    setTemplateTypeId(project.template_type_id === 'enhanced' ? 'enhanced' : 'regular');
    setCaptionDraft(project.caption || '');
    setProjectPromptSnapshot(project.prompt_snapshot || '');
    setProjectMappingSlide1(project.slide1_template_id_snapshot ?? null);
    setProjectMappingSlide2to5(project.slide2_5_template_id_snapshot ?? null);
    setProjectMappingSlide6(project.slide6_template_id_snapshot ?? null);
    const nextSlides: SlideState[] = Array.from({ length: slideCount }).map((_, i) => {
      const prev = slidesRef.current[i] || initSlide();
      const row = slidesRows.find((r: any) => r.slide_index === i);
      const loadedHeadline = row?.headline || '';
      const loadedBody = row?.body || '';
      const loadedAiImagePrompt = row?.ai_image_prompt || '';
      return {
        ...prev,
        savedHeadline: loadedHeadline,
        savedBody: loadedBody,
        draftHeadline: loadedHeadline,
        draftBody: loadedBody,
        draftHeadlineRanges: [],
        draftBodyRanges: [],
        draftHeadlineFontSizePx: 76,
        draftHeadlineTextAlign: "left",
        draftBodyFontSizePx: 48,
        draftBodyTextAlign: "left",
        layoutData: null,
        inputData: null,
        layoutHistory: [],
        error: null,
        debugLogs: [],
        debugScreenshot: null,
        savedAiImagePrompt: loadedAiImagePrompt,
        draftAiImagePrompt: loadedAiImagePrompt,
      };
    });
    setSlides(nextSlides);
    slidesRef.current = nextSlides;
    setActiveSlideIndex(0);
    setProjectsDropdownOpen(false);
    await refreshProjectsList();
    handleNewCarousel();
  };

  const saveProjectMeta = async (patch: { title?: string; caption?: string | null }) => {
    if (!currentProjectId) return;
    setProjectSaveStatus('saving');
    try {
      await fetchJson('/api/editor/projects/update', {
        method: 'POST',
        body: JSON.stringify({ projectId: currentProjectId, ...patch }),
      });
      setProjectSaveStatus('saved');
      window.setTimeout(() => setProjectSaveStatus('idle'), 1200);
    } catch {
      setProjectSaveStatus('error');
      window.setTimeout(() => setProjectSaveStatus('idle'), 2000);
    }
  };

  // Phase 1 (stale-context fix groundwork): project-scoped save helpers.
  // These do NOT use `currentProjectId`; callers pass the intended project explicitly.
  // No call sites use these yet (Phase 2 will), so behavior is unchanged for now.
  const saveProjectMetaForProject = async (
    projectId: string,
    patch: { title?: string; caption?: string | null }
  ) => {
    const pid = String(projectId || "").trim();
    if (!pid) return;
    setProjectSaveStatus('saving');
    try {
      await fetchJson('/api/editor/projects/update', {
        method: 'POST',
        body: JSON.stringify({ projectId: pid, ...patch }),
      });
      setProjectSaveStatus('saved');
      window.setTimeout(() => setProjectSaveStatus('idle'), 1200);
    } catch {
      setProjectSaveStatus('error');
      window.setTimeout(() => setProjectSaveStatus('idle'), 2000);
    }
  };

  const saveSlidePatch = async (
    slideIndex: number,
    patch: {
      headline?: string | null;
      body?: string | null;
      layoutSnapshot?: any | null;
      inputSnapshot?: any | null;
    }
  ): Promise<boolean> => {
    if (!currentProjectId) return false;
    setSlideSaveStatus('saving');
    try {
      addLog(
        `🧩 Persist slide ${slideIndex + 1}: ${Object.keys(patch)
          .filter((k) => (patch as any)[k] !== undefined)
          .join(", ")}`
      );
      await fetchJson('/api/editor/projects/slides/update', {
        method: 'POST',
        body: JSON.stringify({ projectId: currentProjectId, slideIndex, ...patch }),
      });
      setSlideSaveStatus('saved');
      window.setTimeout(() => setSlideSaveStatus('idle'), 1200);
      addLog(`✅ Persisted slide ${slideIndex + 1}`);
      return true;
    } catch {
      setSlideSaveStatus('error');
      window.setTimeout(() => setSlideSaveStatus('idle'), 2000);
      addLog(`❌ Persist slide ${slideIndex + 1} failed`);
      return false;
    }
  };

  // Phase 1 (stale-context fix groundwork): project-scoped slide save helper.
  // No call sites use this yet (Phase 2 will), so behavior is unchanged for now.
  const saveSlidePatchForProject = async (
    projectId: string,
    slideIndex: number,
    patch: {
      headline?: string | null;
      body?: string | null;
      layoutSnapshot?: any | null;
      inputSnapshot?: any | null;
    }
  ): Promise<boolean> => {
    const pid = String(projectId || "").trim();
    if (!pid) return false;
    setSlideSaveStatus('saving');
    try {
      addLog(
        `🧩 Persist slide ${slideIndex + 1}: ${Object.keys(patch)
          .filter((k) => (patch as any)[k] !== undefined)
          .join(", ")}`
      );
      await fetchJson('/api/editor/projects/slides/update', {
        method: 'POST',
        body: JSON.stringify({ projectId: pid, slideIndex, ...patch }),
      });
      setSlideSaveStatus('saved');
      window.setTimeout(() => setSlideSaveStatus('idle'), 1200);
      addLog(`✅ Persisted slide ${slideIndex + 1}`);
      return true;
    } catch {
      setSlideSaveStatus('error');
      window.setTimeout(() => setSlideSaveStatus('idle'), 2000);
      addLog(`❌ Persist slide ${slideIndex + 1} failed`);
      return false;
    }
  };

  const savePromptSettings = async () => {
    // Per-user customization is stored in `carousel_template_type_overrides`.
    addLog(
      `💾 Saving per-user template-type settings: type=${templateTypeId.toUpperCase()} promptLen=${templateTypePrompt.length} emphasisLen=${templateTypeEmphasisPrompt.length} imageGenLen=${templateTypeImageGenPrompt.length}`
    );
    await fetchJson('/api/editor/template-types/overrides/upsert', {
      method: 'POST',
      body: JSON.stringify({
        templateTypeId,
        promptOverride: templateTypePrompt,
        emphasisPromptOverride: templateTypeEmphasisPrompt,
        imageGenPromptOverride: templateTypeImageGenPrompt,
        slide1TemplateIdOverride: templateTypeMappingSlide1,
        slide2to5TemplateIdOverride: templateTypeMappingSlide2to5,
        slide6TemplateIdOverride: templateTypeMappingSlide6,
      }),
    });
    addLog(`✅ Saved per-user template-type settings`);
  };

  // Save AI image prompt for a single slide
  const saveSlideAiImagePrompt = async (slideIndex: number, prompt: string) => {
    if (!currentProjectId) return false;
    setAiImagePromptSaveStatus("saving");
    try {
      addLog(`💾 Saving AI image prompt for slide ${slideIndex + 1}`);
      await fetchJson('/api/editor/projects/slides/update', {
        method: 'POST',
        body: JSON.stringify({
          projectId: currentProjectId,
          slideIndex,
          aiImagePrompt: prompt,
        }),
      });
      // Update saved state
      setSlides((prev) =>
        prev.map((s, i) =>
          i !== slideIndex ? s : { ...s, savedAiImagePrompt: prompt }
        )
      );
      addLog(`✅ Saved AI image prompt for slide ${slideIndex + 1}`);
      setAiImagePromptSaveStatus("saved");
      window.setTimeout(() => setAiImagePromptSaveStatus("idle"), 1200);
      return true;
    } catch (e) {
      addLog(`❌ Failed to save AI image prompt for slide ${slideIndex + 1}`);
      setAiImagePromptSaveStatus("idle");
      return false;
    }
  };

  // Phase 2 (finish): project-scoped AI image prompt save (debounced callers capture pid).
  const saveSlideAiImagePromptForProject = async (
    projectId: string,
    slideIndex: number,
    prompt: string
  ) => {
    const pid = String(projectId || "").trim();
    if (!pid) return false;
    const shouldShowUi = currentProjectIdRef.current === pid;
    if (shouldShowUi) setAiImagePromptSaveStatus("saving");
    try {
      addLog(`💾 Saving AI image prompt for slide ${slideIndex + 1} (project ${pid})`);
      await fetchJson('/api/editor/projects/slides/update', {
        method: 'POST',
        body: JSON.stringify({
          projectId: pid,
          slideIndex,
          aiImagePrompt: prompt,
        }),
      });
      // Only update visible UI state if we're still viewing that project.
      if (shouldShowUi) {
        setSlides((prev) =>
          prev.map((s, i) => (i !== slideIndex ? s : { ...s, savedAiImagePrompt: prompt }))
        );
        setAiImagePromptSaveStatus("saved");
        window.setTimeout(() => setAiImagePromptSaveStatus("idle"), 1200);
      }
      addLog(`✅ Saved AI image prompt for slide ${slideIndex + 1} (project ${pid})`);
      return true;
    } catch {
      addLog(`❌ Failed to save AI image prompt for slide ${slideIndex + 1} (project ${pid})`);
      if (shouldShowUi) setAiImagePromptSaveStatus("idle");
      return false;
    }
  };

  // Generate AI image prompts for all slides (called after Generate Copy)
  const runGenerateImagePrompts = async (slideIndexOverride?: number) => {
    if (!currentProjectId) return;
    if (templateTypeId !== 'enhanced') return;
    const projectIdAtStart = currentProjectId;
    const isSingleSlide = slideIndexOverride !== undefined;
    const key = isSingleSlide ? imagePromptKey(projectIdAtStart, slideIndexOverride as number) : "";
    let runIdStarted: number | null = null;
    if (isSingleSlide) {
      const runId = (imagePromptRunIdByKeyRef.current[key] || 0) + 1;
      imagePromptRunIdByKeyRef.current[key] = runId;
      runIdStarted = runId;
      setImagePromptGeneratingKeys((prev) => new Set(prev).add(key));
      setImagePromptErrorByKey((prev) => ({ ...prev, [key]: null }));
    } else {
      const runId = (imagePromptRunIdByProjectRef.current[projectIdAtStart] || 0) + 1;
      imagePromptRunIdByProjectRef.current[projectIdAtStart] = runId;
      runIdStarted = runId;
      setImagePromptUi(projectIdAtStart, { generating: true, error: null });
    }
    try {
      addLog(`🎨 Generating AI image prompts for project ${projectIdAtStart}${slideIndexOverride !== undefined ? ` (slide ${slideIndexOverride + 1} only)` : ''}`);
      const bodyPayload: any = { projectId: projectIdAtStart };
      if (slideIndexOverride !== undefined) {
        bodyPayload.slideIndex = slideIndexOverride;
      }
      const data = await fetchJson('/api/editor/projects/jobs/generate-image-prompts', {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
      // Ignore stale completions.
      if (isSingleSlide) {
        if (imagePromptRunIdByKeyRef.current[key] !== runIdStarted) return;
      } else {
        if (imagePromptRunIdByProjectRef.current[projectIdAtStart] !== runIdStarted) return;
      }
      const prompts = data.prompts || [];
      addLog(`🎨 Received ${prompts.length} AI image prompts`);
      // Update slides with new prompts
      // Apply UI updates ONLY if the user is still viewing this same project.
      if (currentProjectIdRef.current === projectIdAtStart) {
        setSlides((prev) =>
          prev.map((s, i) => {
            const newPrompt = prompts[i] || '';
            if (slideIndexOverride !== undefined && i !== slideIndexOverride) return s;
            if (!newPrompt) return s;
            return {
              ...s,
              savedAiImagePrompt: newPrompt,
              draftAiImagePrompt: newPrompt,
            };
          })
        );
      }
    } catch (e: any) {
      addLog(`❌ Failed to generate AI image prompts: ${e?.message || 'unknown error'}`);
      if (isSingleSlide) {
        if (imagePromptRunIdByKeyRef.current[key] === runIdStarted) {
          setImagePromptErrorByKey((prev) => ({ ...prev, [key]: e?.message || 'Failed to regenerate image prompt' }));
        }
      } else {
        if (imagePromptRunIdByProjectRef.current[projectIdAtStart] === runIdStarted) {
          setImagePromptUi(projectIdAtStart, { error: e?.message || 'Failed to generate image prompts' });
        }
      }
    } finally {
      if (isSingleSlide) {
        if (imagePromptRunIdByKeyRef.current[key] === runIdStarted) {
          setImagePromptGeneratingKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      } else {
        // Only clear generating if no newer run started.
        if (imagePromptRunIdByProjectRef.current[projectIdAtStart] === runIdStarted) {
          setImagePromptUi(projectIdAtStart, { generating: false });
        }
      }
    }
  };

  // Helper: Convert progress code to user-friendly label
  const getAiImageStatusLabel = (progressCode: string): string => {
    const code = String(progressCode || '').toLowerCase();
    if (code.includes('generating')) return 'Generating image with AI...';
    if (code.includes('removebg')) return 'Removing background...';
    if (code.includes('uploading')) return 'Uploading...';
    return 'Working...';
  };

  // Generate AI image from the prompt and place it on the active slide
  const runGenerateAiImage = async (slideIdx?: number) => {
    const targetSlide = slideIdx ?? activeSlideIndex;

    if (!currentProjectId) {
      return;
    }
    if (templateTypeId !== 'enhanced') {
      return;
    }
    const projectIdAtStart = currentProjectId;
    const key = aiKey(projectIdAtStart, targetSlide);
    const prompt = slides[targetSlide]?.draftAiImagePrompt || '';
    if (!prompt || prompt.trim().length < 10) {
      setAiImageErrorByKey((prev) => ({ ...prev, [key]: 'Please enter or generate an image prompt first (min 10 characters).' }));
      return;
    }

    // Mark this slide as generating
    const runId = (aiImageRunIdByKeyRef.current[key] || 0) + 1;
    aiImageRunIdByKeyRef.current[key] = runId;
    setAiImageGeneratingKeys((prev) => new Set(prev).add(key));
    setAiImageErrorByKey((prev) => ({ ...prev, [key]: null }));
    setAiImageProgressByKey((prev) => ({ ...prev, [key]: 0 }));
    setAiImageStatusByKey((prev) => ({ ...prev, [key]: 'Starting...' }));

    // Start progress animation (smooth progress over 90 seconds)
    if (aiImageProgressRefsByKeyRef.current[key]) window.clearInterval(aiImageProgressRefsByKeyRef.current[key]!);
    const startTime = Date.now();
    const totalDuration = 90000; // 90 seconds
    aiImageProgressRefsByKeyRef.current[key] = window.setInterval(() => {
      if (aiImageRunIdByKeyRef.current[key] !== runId) return;
      const elapsed = Date.now() - startTime;
      const progress = Math.min(95, (elapsed / totalDuration) * 100); // Max 95% until complete
      setAiImageProgressByKey((prev) => ({ ...prev, [key]: progress }));
    }, 200);

    // Start polling for job status
    if (aiImagePollRefsByKeyRef.current[key]) window.clearInterval(aiImagePollRefsByKeyRef.current[key]!);
    const pollStatus = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const statusRes = await fetch(
          `/api/editor/projects/jobs/status?projectId=${encodeURIComponent(projectIdAtStart)}&jobType=generate-ai-image&slideIndex=${targetSlide}`,
          { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
        );
        const statusData = await statusRes.json().catch(() => ({}));
        const job = statusData?.activeJob || null;
        if (job && job.error && String(job.error).startsWith('progress:')) {
          const progressCode = job.error.slice('progress:'.length);
          // Ignore stale pollers for this key.
          if (aiImageRunIdByKeyRef.current[key] !== runId) return;
          setAiImageStatusByKey((prev) => ({ ...prev, [key]: getAiImageStatusLabel(progressCode) }));
        }
      } catch {
        // Ignore polling errors
      }
    };
    void pollStatus();
    aiImagePollRefsByKeyRef.current[key] = window.setInterval(pollStatus, 500);

    try {
      addLog(`🖼️ Generating AI image for slide ${targetSlide + 1}...`);
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated. Please sign in again.");

      const res = await fetch('/api/editor/projects/jobs/generate-ai-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: projectIdAtStart,
          slideIndex: targetSlide,
          prompt: prompt.trim(),
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) {
        throw new Error(j?.error || `Image generation failed (${res.status})`);
      }
      // Ignore stale completions for this key.
      if (aiImageRunIdByKeyRef.current[key] !== runId) return;

      const url = String(j?.url || '');
      const path = String(j?.path || '');
      if (!url) throw new Error('Image generated but no URL returned.');

      addLog(`✅ AI image generated: ${url.substring(0, 80)}...`);
      setAiImageStatusByKey((prev) => ({ ...prev, [key]: 'Done' }));

      // Load image dimensions for placement
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1 });
        img.onerror = () => resolve({ w: 1, h: 1 });
        img.src = url;
      });

      const tid = computeTemplateIdForSlide(targetSlide);
      const snap = (tid ? templateSnapshots[tid] : null) || null;
      const placement = computeDefaultUploadedImagePlacement(snap, dims.w, dims.h);
      const mask = (j?.mask as any) || null;
      const bgRemovalStatus = String(j?.bgRemovalStatus || 'succeeded');
      const original = j?.original || null;
      const processed = j?.processed || null;

      // Update layout with new AI-generated image (replaces any existing image)
      const isActiveTarget =
        currentProjectIdRef.current === projectIdAtStart && activeSlideIndexRef.current === targetSlide;
      const currentLayout = isActiveTarget
        ? layoutData
        : (slidesRef.current?.[targetSlide] as any)?.layoutData;
      const baseLayout = (currentLayout as any)?.layout ? { ...(currentLayout as any).layout } : { ...EMPTY_LAYOUT };
      const nextLayout = {
        ...baseLayout,
        image: {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          url,
          storage: { bucket: 'carousel-project-images', path },
          bgRemovalEnabled: true,
          bgRemovalStatus,
          ...(original ? { original: { url: String(original.url || ''), storage: original.storage || { bucket: 'carousel-project-images', path: String(original.path || '') } } } : {}),
          ...(processed ? { processed: { url: String(processed.url || ''), storage: processed.storage || { bucket: 'carousel-project-images', path: String(processed.path || '') } } } : {}),
          ...(mask ? { mask } : {}),
          isAiGenerated: true, // Mark as AI-generated
        },
      };

      // Only update global layoutData if this is the active slide
      if (isActiveTarget) {
        setLayoutData({ success: true, layout: nextLayout, imageUrl: url } as any);
      }
      // Apply UI updates ONLY if the user is still viewing this same project.
      if (currentProjectIdRef.current === projectIdAtStart) {
        setSlides((prev) =>
          prev.map((s, i) =>
            i !== targetSlide
              ? s
              : {
                  ...s,
                  layoutData: { success: true, layout: nextLayout, imageUrl: url } as any,
                }
          )
        );
        slidesRef.current = slidesRef.current.map((s, i) =>
          i !== targetSlide ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: url } as any } as any)
        );
      }

      // Persist to Supabase
      await saveSlidePatchForProject(projectIdAtStart, targetSlide, { layoutSnapshot: nextLayout });
      addLog(`🖼️ AI image placed on slide ${targetSlide + 1}`);

      // Complete progress
      setAiImageProgressByKey((prev) => ({ ...prev, [key]: 100 }));
    } catch (e: any) {
      addLog(`❌ AI image generation failed: ${e?.message || 'unknown error'}`);
      setAiImageErrorByKey((prev) => ({ ...prev, [key]: e?.message || 'Image generation failed. Please contact Dr. Nick.' }));
    } finally {
      // Stop polling
      if (aiImagePollRefsByKeyRef.current[key]) {
        window.clearInterval(aiImagePollRefsByKeyRef.current[key]!);
        aiImagePollRefsByKeyRef.current[key] = null;
      }
      // Stop progress animation
      if (aiImageProgressRefsByKeyRef.current[key]) {
        window.clearInterval(aiImageProgressRefsByKeyRef.current[key]!);
        aiImageProgressRefsByKeyRef.current[key] = null;
      }
      // Brief delay before resetting to show 100% or error state
      window.setTimeout(() => {
        // Only reset if no newer run started for this key.
        if (aiImageRunIdByKeyRef.current[key] !== runId) return;
        setAiImageGeneratingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setAiImageProgressByKey((prev) => ({ ...prev, [key]: 0 }));
        setAiImageStatusByKey((prev) => ({ ...prev, [key]: '' }));
      }, 800);
    }
  };

  // Load template type defaults + saved projects on mount/login.
  useEffect(() => {
    if (!user?.id) return;
    // Initial state is loaded via `/api/editor/initial-state`; avoid redundant round trips.
    if (editorBootstrapDoneRef.current) return;
    if (initialTemplateTypeLoadDoneRef.current) return;
    initialTemplateTypeLoadDoneRef.current = true;
    lastLoadedTemplateTypeIdRef.current = templateTypeId;
    void Promise.allSettled([loadTemplateTypeEffective(templateTypeId), refreshProjectsList()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load effective settings when template type changes.
  useEffect(() => {
    if (!user?.id) return;
    if (!initialTemplateTypeLoadDoneRef.current) return;
    if (lastLoadedTemplateTypeIdRef.current === templateTypeId) return;
    lastLoadedTemplateTypeIdRef.current = templateTypeId;
    void loadTemplateTypeEffective(templateTypeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateTypeId, user?.id]);

  // Keep active slide's template snapshot loaded.
  useEffect(() => {
    const tid = computeTemplateIdForSlide(activeSlideIndex);
    void ensureTemplateSnapshot(tid);
    if (tid) {
      const snap = templateSnapshots[tid] || null;
      if (snap) {
        setSelectedTemplateId(tid);
        setSelectedTemplateSnapshot(snap as any);
      } else {
        // Keep engine template selection in sync for layout endpoints.
        void loadTemplate(tid);
      }
    } else {
      setSelectedTemplateId(null);
      setSelectedTemplateSnapshot(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlideIndex, currentProjectId, projectMappingSlide1, projectMappingSlide2to5, projectMappingSlide6, templateTypeMappingSlide1, templateTypeMappingSlide2to5, templateTypeMappingSlide6]);

  // Preload the 3 templates needed for the currently selected Template Type / project snapshot,
  // so slides 1–6 can render their template visuals immediately.
  useEffect(() => {
    const ids = [
      computeTemplateIdForSlide(0),
      computeTemplateIdForSlide(1),
      computeTemplateIdForSlide(5),
    ].filter(Boolean) as string[];
    const uniq = Array.from(new Set(ids));
    uniq.forEach((id) => void ensureTemplateSnapshot(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, projectMappingSlide1, projectMappingSlide2to5, projectMappingSlide6, templateTypeMappingSlide1, templateTypeMappingSlide2to5, templateTypeMappingSlide6]);

  // Close the prompt modal on Escape.
  useEffect(() => {
    if (!promptModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPromptModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [promptModalOpen]);

  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const emphasisTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!promptModalOpen) return;
    // Focus the correct textarea based on which button opened the modal.
    window.setTimeout(() => {
      const el = promptModalSection === "emphasis" ? emphasisTextareaRef.current : promptTextareaRef.current;
      if (!el) return;
      try {
        el.focus();
        el.scrollIntoView({ block: "center" });
      } catch {
        // ignore
      }
    }, 0);
  }, [promptModalOpen, promptModalSection]);

  // Debounced autosave: template type prompt + mapping → overrides/global (depending on scope)
  useEffect(() => {
    if (!user?.id) return;
    if (!promptDirtyRef.current) return;
    if (promptSaveTimeoutRef.current) window.clearTimeout(promptSaveTimeoutRef.current);
    promptSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        setPromptSaveStatus('saving');
        await savePromptSettings();
        setPromptSaveStatus('saved');
        promptDirtyRef.current = false;
        window.setTimeout(() => setPromptSaveStatus('idle'), 1200);
      } catch (e) {
        console.warn('[EditorShell] Failed to save prompt settings:', e);
        setPromptSaveStatus('error');
        window.setTimeout(() => setPromptSaveStatus('idle'), 2000);
      }
    }, 600);
    return () => {
      if (promptSaveTimeoutRef.current) window.clearTimeout(promptSaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    templateTypeId,
    templateTypePrompt,
    templateTypeEmphasisPrompt,
    templateTypeImageGenPrompt,
    templateTypeMappingSlide1,
    templateTypeMappingSlide2to5,
    templateTypeMappingSlide6,
  ]);

  // Load/persist sidebar width locally (best-effort)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("editor.sidebarWidth");
      if (!raw) return;
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      const clamped = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.round(n)));
      setSidebarWidth(clamped);
      sidebarDragRef.current.startWidth = clamped;
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("editor.sidebarWidth", String(sidebarWidth));
    } catch {
      // ignore
    }
  }, [sidebarWidth]);

  const onSidebarResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Left click / primary only
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    sidebarDragRef.current.dragging = true;
    sidebarDragRef.current.startX = e.clientX;
    sidebarDragRef.current.startWidth = sidebarWidth;

    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: PointerEvent) => {
      if (!sidebarDragRef.current.dragging) return;
      const dx = ev.clientX - sidebarDragRef.current.startX;
      const next = Math.max(
        SIDEBAR_MIN,
        Math.min(SIDEBAR_MAX, Math.round(sidebarDragRef.current.startWidth + dx))
      );
      setSidebarWidth(next);
    };

    const end = () => {
      sidebarDragRef.current.dragging = false;
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  // Mirror engine *debug state* into the active slide slot.
  // IMPORTANT: We intentionally do NOT mirror `layoutData` / `inputData` here.
  // Those can be stale during slide switches and were causing UI-only "bleed" where slide 1 visuals
  // appear on slide 2/3 without any DB changes. Layout/input are updated by explicit per-action updates
  // and by the `switchToSlide` snapshot path.
  useEffect(() => {
    setSlides((prev) =>
      prev.map((s, i) =>
        i !== activeSlideIndex
          ? s
          : ({
              ...s,
              layoutHistory,
              error,
              debugLogs,
              debugScreenshot,
            } as any)
      )
    );
  }, [activeSlideIndex, layoutHistory, error, debugLogs, debugScreenshot]);

  const slideRefs = useMemo(
    () =>
      Array.from({ length: slideCount }).map(() => ({
        current: null as HTMLDivElement | null,
      })),
    [slideCount]
  );

  const canGoPrev = activeSlideIndex > 0;
  const canGoNext = activeSlideIndex < slideCount - 1;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportWidth(el.clientWidth);
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Window width for mobile/desktop UI decisions (more reliable than viewportRef during first paint).
  useEffect(() => {
    const read = () => setWindowWidth(typeof window !== "undefined" ? window.innerWidth : 0);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // Track whether the active canvas selection is the user image, so we can show a Delete button.
  useEffect(() => {
    const c = (canvasRef as any)?.current?.canvas;
    if (!c || typeof c.on !== "function") return;
    const onSel = () => syncActiveImageSelected();
    try {
      c.on("selection:created", onSel);
      c.on("selection:updated", onSel);
      c.on("selection:cleared", onSel);
      c.on("mouse:down", onSel);
    } catch {
      // ignore
    }
    // Initialize
    onSel();
    return () => {
      try {
        c.off("selection:created", onSel);
        c.off("selection:updated", onSel);
        c.off("selection:cleared", onSel);
        c.off("mouse:down", onSel);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlideIndex, (layoutData as any)?.layout]);

  // Close the image menu on outside click or Escape.
  useEffect(() => {
    if (!imageMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-image-menu='1']")) return;
      closeImageMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeImageMenu();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageMenuOpen]);

  // Slide strip translation: no manual scrolling; arrows move slides.
  // We center the active slide in the viewport.
  const CARD_W = 420;
  const GAP = 24; // gap-6
  // Inner gutter so shadows/rings don't get clipped by overflow-x-hidden at the viewport edges.
  const VIEWPORT_PAD = 40;
  const totalW = slideCount * CARD_W + (slideCount - 1) * GAP;
  const viewportContentWidth = Math.max(0, viewportWidth - VIEWPORT_PAD * 2);
  const centerOffset = VIEWPORT_PAD + Math.max(0, (viewportContentWidth - CARD_W) / 2);
  const rawTranslate = centerOffset - activeSlideIndex * (CARD_W + GAP);
  const minTranslate = Math.min(0, viewportContentWidth - totalW);
  const maxTranslate = 0;
  const translateX = Math.max(minTranslate, Math.min(maxTranslate, rawTranslate));
  const isMobile = (windowWidth || viewportWidth) > 0 && (windowWidth || viewportWidth) < 768; // tailwind "md" breakpoint

  const isEditableTarget = (target: any) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.closest?.('[data-rte-root="1"]')) return true;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return true;
    if ((el as any).isContentEditable) return true;
    return false;
  };

  const computeDefaultUploadedImagePlacement = (templateSnapshot: any | null, imageW: number, imageH: number) => {
    const region = getTemplateContentRectRaw(templateSnapshot);
    const outer = region || { x: 0, y: 0, width: 1080, height: 1440 };
    // Keep inside content region with a bit of padding.
    const PAD = 40;
    const inset = {
      x: outer.x + PAD,
      y: outer.y + PAD,
      width: Math.max(1, outer.width - PAD * 2),
      height: Math.max(1, outer.height - PAD * 2),
    };
    const maxW = inset.width * 0.7;
    const maxH = inset.height * 0.7;
    const iw = Math.max(1, Number(imageW) || 1);
    const ih = Math.max(1, Number(imageH) || 1);
    const scale = Math.min(maxW / iw, maxH / ih, 1);
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    const x = Math.round(inset.x + (inset.width - w) / 2);
    const y = Math.round(inset.y + (inset.height - h) / 2);
    return { x, y, width: w, height: h };
  };

  const openImageMenu = (x: number, y: number) => {
    setImageMenuPos({ x, y });
    setImageMenuOpen(true);
  };

  const closeImageMenu = () => {
    setImageMenuOpen(false);
    setImageMenuPos(null);
  };

  const hasImageForActiveSlide = () => {
    const curLayout = (layoutData as any)?.layout || null;
    const url = curLayout?.image?.url || null;
    return !!String(url || "").trim();
  };

  const syncActiveImageSelected = () => {
    try {
      const c = (canvasRef as any)?.current?.canvas;
      const obj = c?.getActiveObject?.() || null;
      const role = obj?.data?.role || null;
      setActiveImageSelected(role === "user-image");
    } catch {
      setActiveImageSelected(false);
    }
  };

  const switchToSlide = async (nextIndex: number) => {
    if (switchingSlides) return;
    if (nextIndex < 0 || nextIndex >= slideCount) return;
    if (nextIndex === activeSlideIndex) return;

    // Phase 3B: capture ids to avoid stale saves if state changes mid-flush.
    const projectIdAtStart = currentProjectId;
    const slideIndexAtStart = activeSlideIndex;
    const templateTypeAtStart = templateTypeId;
    const projectTitleAtStart = projectTitle;
    const captionAtStart = captionDraft;

    setSwitchingSlides(true);
    try {
      addLog(
        `🧭 switchToSlide start: project=${currentProjectId || "none"} from=${activeSlideIndex + 1} to=${nextIndex + 1} type=${templateTypeId}`
      );
      try {
        const curInput = (inputData as any) || null;
        const h = String(curInput?.headline || "").slice(0, 30).replace(/\s+/g, " ").trim();
        const b = String(curInput?.body || "").slice(0, 30).replace(/\s+/g, " ").trim();
        addLog(
          `🧭 engine before switch: hasLayout=${layoutData?.layout ? "1" : "0"} hasInput=${curInput ? "1" : "0"} headline="${h}" body="${b}"`
        );
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
    try {
      // Best-effort flush pending project/slide saves before switching.
      try {
        if (projectSaveTimeoutRef.current) {
          window.clearTimeout(projectSaveTimeoutRef.current);
          projectSaveTimeoutRef.current = null;
          if (projectIdAtStart) {
            void saveProjectMetaForProject(projectIdAtStart, { title: projectTitleAtStart, caption: captionAtStart });
          }
        }
        if (slideSaveTimeoutRef.current) {
          window.clearTimeout(slideSaveTimeoutRef.current);
          slideSaveTimeoutRef.current = null;
          const cur = slidesRef.current[slideIndexAtStart] || initSlide();
          // Only flush if text is actually dirty.
          const desiredSavedHeadline = templateTypeAtStart === "regular" ? "" : (cur.savedHeadline || "");
          const desiredSavedBody = cur.savedBody || "";
          if ((cur.draftHeadline || "") !== desiredSavedHeadline || (cur.draftBody || "") !== desiredSavedBody) {
            void (async () => {
              if (!projectIdAtStart) return;
              const ok = await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, {
                headline: templateTypeAtStart === "regular" ? null : (cur.draftHeadline || null),
                body: cur.draftBody || null,
              });
              if (!ok) return;
              // Only update visible UI if we're still viewing this project.
              if (currentProjectIdRef.current === projectIdAtStart) {
                setSlides((prev) =>
                  prev.map((s, i) =>
                    i !== slideIndexAtStart
                      ? s
                      : {
                          ...s,
                          savedHeadline: templateTypeAtStart === "regular" ? "" : (s.draftHeadline || ""),
                          savedBody: s.draftBody || "",
                        }
                  )
                );
              }
            })();
          }
        }
        if (layoutSaveTimeoutRef.current) {
          window.clearTimeout(layoutSaveTimeoutRef.current);
          layoutSaveTimeoutRef.current = null;
          if (layoutData?.layout && inputData && layoutDirtyRef.current) {
            void (async () => {
              if (!projectIdAtStart) return;
              const layoutAtStart = layoutData.layout;
              const inputAtStart = inputData;
              const ok = await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, {
                layoutSnapshot: layoutAtStart,
                inputSnapshot: inputAtStart,
              });
              if (ok) layoutDirtyRef.current = false;
            })();
          }
        }
      } catch {
        // ignore
      }

      // Snapshot current engine state into the current slide slot.
      setSlides((prev) =>
        prev.map((s, i) =>
          i === activeSlideIndex
            ? {
                ...s,
                layoutData,
                inputData,
                layoutHistory,
                error,
                debugLogs,
                debugScreenshot,
              }
            : s
        )
      );

      setActiveSlideIndex(nextIndex);
      try {
        addLog(`🧭 switchToSlide setActiveSlideIndex: now=${nextIndex + 1}`);
        try {
          const curInput2 = (inputData as any) || null;
          const h2 = String(curInput2?.headline || "").slice(0, 30).replace(/\s+/g, " ").trim();
          const b2 = String(curInput2?.body || "").slice(0, 30).replace(/\s+/g, " ").trim();
          addLog(
            `🧭 engine after setActiveSlideIndex: hasLayout=${layoutData?.layout ? "1" : "0"} hasInput=${curInput2 ? "1" : "0"} headline="${h2}" body="${b2}"`
          );
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }

      const next = slidesRef.current[nextIndex] || initSlide();
      try {
        const nh = String((next as any)?.draftHeadline || "").slice(0, 30).replace(/\s+/g, " ").trim();
        const nb = String((next as any)?.draftBody || "").slice(0, 30).replace(/\s+/g, " ").trim();
        addLog(
          `🧭 next slide snapshot: hasLayout=${(next as any)?.layoutData?.layout ? "1" : "0"} hasInput=${(next as any)?.inputData ? "1" : "0"} draftHeadline="${nh}" draftBody="${nb}"`
        );
      } catch {
        // ignore
      }
      if (next.layoutData || next.inputData) {
        setLayoutData(next.layoutData);
        setInputData(next.inputData);
        setLayoutHistory(next.layoutHistory || []);
        try {
          addLog(`🧭 engine restored from slide snapshot: slide=${nextIndex + 1}`);
        } catch {
          // ignore
        }
      } else {
        handleNewCarousel();
        try {
          addLog(`🧭 engine reset (handleNewCarousel): slide=${nextIndex + 1}`);
        } catch {
          // ignore
        }
      }
    } finally {
      setSwitchingSlides(false);
      try {
        addLog(`🧭 switchToSlide done: active=${nextIndex + 1}`);
      } catch {
        // ignore
      }
    }
  };

  const goPrev = () => void switchToSlide(activeSlideIndex - 1);
  const goNext = () => void switchToSlide(activeSlideIndex + 1);

  const handleTopDownload = async () => {
    // Replaced by "Download All" ZIP in the top bar (kept function name for minimal UI churn).
    void handleDownloadAll();
  };

  const sanitizeFileName = (s: string) => {
    const base = String(s || "").trim() || "Project";
    // Remove characters that are invalid in common filesystems.
    const cleaned = base.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
    return cleaned.slice(0, 80) || "Project";
  };

  const getNextBundleName = (baseName: string) => {
    try {
      const key = `editor.downloadAll.bundleIndex:${baseName}`;
      const raw = localStorage.getItem(key);
      const n = raw ? Number(raw) : 0;
      const next = Number.isFinite(n) && n > 0 ? n : 0;
      const name = next === 0 ? baseName : `${baseName}_${next}`;
      localStorage.setItem(key, String(next + 1));
      return name;
    } catch {
      // Fallback to timestamp if localStorage is unavailable.
      return `${baseName}_${Date.now()}`;
    }
  };

  const getFabricCanvasFromHandle = (handle: any) => {
    return handle?.canvas || handle || null;
  };

  const exportFabricCanvasPngBlob = async (handle: any) => {
    const fabricCanvas = getFabricCanvasFromHandle(handle);
    if (!fabricCanvas || typeof fabricCanvas.toDataURL !== "function") {
      throw new Error("Canvas not ready");
    }
    const currentZoom = fabricCanvas.getZoom?.() ?? 1;
    try {
      try {
        fabricCanvas.discardActiveObject?.();
      } catch {
        // ignore
      }
      fabricCanvas.setZoom?.(1);
      fabricCanvas.renderAll?.();
      await new Promise((r) => setTimeout(r, 80));
      const dataURL = fabricCanvas.toDataURL({
        format: "png",
        quality: 1.0,
        multiplier: 1,
      });
      const res = await fetch(dataURL);
      return await res.blob();
    } finally {
      fabricCanvas.setZoom?.(currentZoom);
      fabricCanvas.renderAll?.();
    }
  };

  const handleDownloadAll = async (opts?: { allowWhenExporting?: boolean }) => {
    if (topExporting && !opts?.allowWhenExporting) return;
    setTopExporting(true);
    try {
      const baseName = sanitizeFileName(projectTitle);
      const bundleName = getNextBundleName(baseName);

      // Ensure all slide canvases are mounted.
      const handles = slideCanvasRefs.current.map((r) => r.current);
      if (handles.some((h) => !getFabricCanvasFromHandle(h))) {
        alert("Slides are still rendering. Please wait a moment and try again.");
        return;
      }

      const zip = new JSZip();
      const folder = zip.folder(bundleName) || zip;

      for (let i = 0; i < slideCount; i++) {
        const blob = await exportFabricCanvasPngBlob(handles[i]);
        folder.file(`slide-${i + 1}.png`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.download = `${bundleName}.zip`;
      link.href = url;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e: any) {
      console.error("[Editor] Download All failed:", e);
      alert(e?.message || "Download failed. Please try again.");
    } finally {
      setTopExporting(false);
    }
  };

  const shareSingleSlide = async (slideIndex: number) => {
    const handle = slideCanvasRefs.current[slideIndex]?.current;
    if (!getFabricCanvasFromHandle(handle)) {
      alert("Slide is still rendering. Please wait a moment and try again.");
      return;
    }
    if (typeof navigator === "undefined" || typeof (navigator as any).share !== "function") {
      alert("Sharing is not supported on this device/browser.");
      return;
    }
    setMobileSaveBusy(slideIndex);
    try {
      const baseName = sanitizeFileName(projectTitle);
      const blob = await exportFabricCanvasPngBlob(handle);
      const file = new File([blob], `${baseName}-slide-${slideIndex + 1}.png`, { type: "image/png" });
      const canShareSingle =
        typeof (navigator as any).canShare !== "function" || (navigator as any).canShare({ files: [file] });
      if (!canShareSingle) {
        alert("Sharing files is not supported on this device/browser.");
        return;
      }
      await (navigator as any).share({
        title: baseName,
        text: `Slide ${slideIndex + 1}`,
        files: [file],
      });
    } catch (e: any) {
      if (String(e?.name || "").toLowerCase().includes("abort")) return;
      alert("Share failed. Please try again.");
    } finally {
      setMobileSaveBusy(null);
    }
  };

  const handleShareAll = async () => {
    if (topExporting) return;
    setTopExporting(true);
    try {
      const baseName = sanitizeFileName(projectTitle);
      const bundleName = getNextBundleName(baseName);
      const handles = slideCanvasRefs.current.map((r) => r.current);
      if (handles.some((h) => !getFabricCanvasFromHandle(h))) {
        alert("Slides are still rendering. Please wait a moment and try again.");
        return;
      }

      if (typeof navigator === "undefined" || typeof (navigator as any).share !== "function") {
        // No share sheet at all -> fallback to ZIP (Files app).
        await handleDownloadAll({ allowWhenExporting: true });
        return;
      }

      // Capability probe: generate ONE file and see if multi-file share is supported via canShare().
      // If it isn't, we prefer a per-slide Save flow (no ZIP) on mobile.
      const blob0 = await exportFabricCanvasPngBlob(handles[0]);
      const file0 = new File([blob0], `${bundleName}-slide-1.png`, { type: "image/png" });
      const canShareSingle =
        typeof (navigator as any).canShare !== "function" || (navigator as any).canShare({ files: [file0] });
      if (!canShareSingle) {
        await handleDownloadAll({ allowWhenExporting: true });
        return;
      }

      const canShareMulti =
        typeof (navigator as any).canShare === "function" ? (navigator as any).canShare({ files: [file0, file0] }) : false;

      if (!canShareMulti) {
        // Mobile-friendly fallback: per-slide share UI (no ZIP).
        setMobileSaveOpen(true);
        return;
      }

      // Multi-file sharing supported -> generate the rest and share all.
      const files: File[] = [file0];
      for (let i = 1; i < slideCount; i++) {
        const blob = await exportFabricCanvasPngBlob(handles[i]);
        files.push(new File([blob], `${bundleName}-slide-${i + 1}.png`, { type: "image/png" }));
      }

      await (navigator as any).share({ title: bundleName, text: bundleName, files });
    } catch (e: any) {
      console.error("[Editor] Share All failed:", e);
      // If user cancels share, don't show an error.
      if (String(e?.name || "").toLowerCase().includes("abort")) return;
      alert("Save failed. Please try again.");
    } finally {
      setTopExporting(false);
    }
  };

  const activeSlideTitle = projectTitle;

  const handleSignOut = async () => {
    await signOut();
  };

  const StatusPill = () => {
    const status = saveStatus;
    if (status === "idle") return null;
    const base = "px-3 py-1 rounded-full text-xs font-semibold border";
    if (status === "editing") return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>Editing…</span>;
    if (status === "saving") return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Saving…</span>;
    if (status === "saved") return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Saved ✓</span>;
    if (status === "error") return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Save Failed</span>;
    return null;
  };

  const PromptStatusPill = () => {
    if (promptSaveStatus === "idle") return null;
    const base = "px-3 py-1 rounded-full text-xs font-semibold border";
    if (promptSaveStatus === "saving") {
      return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Poppy Prompt: Saving…</span>;
    }
    if (promptSaveStatus === "saved") {
      return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Poppy Prompt: Saved ✓</span>;
    }
    return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Poppy Prompt: Save Failed</span>;
  };

  const ProjectStatusPill = () => {
    if (projectSaveStatus === "idle" && slideSaveStatus === "idle") return null;
    const base = "px-3 py-1 rounded-full text-xs font-semibold border";
    const status = projectSaveStatus === "saving" || slideSaveStatus === "saving"
      ? "saving"
      : projectSaveStatus === "error" || slideSaveStatus === "error"
      ? "error"
      : projectSaveStatus === "saved" || slideSaveStatus === "saved"
      ? "saved"
      : "idle";
    if (status === "saving") return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Saving…</span>;
    if (status === "saved") return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Saved ✓</span>;
    if (status === "error") return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Save Failed</span>;
    return null;
  };

  const SidebarInner = (
    <div className="p-4 space-y-4 overflow-auto">
      {/* Project Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white text-sm flex items-center justify-center">➕</span>
          <span className="text-sm font-semibold text-slate-900">Project</span>
        </div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Current project type:{" "}
            <span className="font-semibold uppercase">{templateTypeId}</span>
          </div>
          <div className="text-xs text-slate-600">
            New project type:
          </div>
        </div>
        <select
          className="mb-3 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
          value={newProjectTemplateTypeId}
          onChange={(e) => setNewProjectTemplateTypeId(e.target.value === "regular" ? "regular" : "enhanced")}
          disabled={switchingSlides}
          title="Choose the type for the next new project (does not change the current project)"
        >
          <option value="enhanced">Enhanced</option>
          <option value="regular">Regular</option>
        </select>
        <button
          className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-md hover:shadow-lg transition-shadow disabled:opacity-50"
          onClick={() => {
            setSlides((prev) => prev.map((s) => ({ ...s, draftHeadline: "", draftBody: "" })));
            handleNewCarousel();
            void createNewProject(newProjectTemplateTypeId);
          }}
          disabled={switchingSlides}
        >
          New Project
        </button>
      </div>

      {/* Saved Projects Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500 text-white text-sm flex items-center justify-center">💾</span>
            <span className="text-sm font-semibold text-slate-900">Saved Projects</span>
          </div>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{projects.length}</span>
        </div>
        <button
          onClick={() => setProjectsDropdownOpen(!projectsDropdownOpen)}
          className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium shadow-sm flex items-center justify-between px-3 hover:bg-slate-50 transition-colors"
          disabled={projectsLoading || switchingSlides}
        >
          <span>
            {projectsLoading
              ? "Loading..."
              : currentProjectId
                ? (projectTitle || "Untitled Project")
                : "Load project…"}
          </span>
          <span className="text-slate-400">{projectsDropdownOpen ? "▴" : "▾"}</span>
        </button>

        {projectsDropdownOpen && (
          <div className="mt-2 w-full bg-white border border-slate-200 rounded-lg shadow-sm max-h-64 overflow-y-auto">
            {projects.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No projects yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      setProjectsDropdownOpen(false);
                      void loadProject(p.id);
                      if (isMobile) setMobileDrawerOpen(false);
                    }}
                  >
                    <div className="text-sm font-medium text-slate-900 truncate">{p.title}</div>
                    <div className="text-xs text-slate-500 truncate">
                      Type: {p.template_type_id}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Updated: {new Date(p.updated_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Template Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm flex items-center justify-center">🎨</span>
            <span className="text-sm font-semibold text-slate-900">Template</span>
          </div>
          <button
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors"
            onClick={() => setTemplateSettingsOpen(true)}
            disabled={switchingSlides}
            title="Edit template type settings"
          >
            Edit Template
          </button>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 hover:bg-slate-50 transition-colors"
            onClick={() => {
              setPromptModalSection("prompt");
              setPromptModalOpen(true);
            }}
            title="Edit Poppy Prompt"
          >
            <div className="text-xs font-semibold text-slate-700">Poppy Prompt</div>
            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
              {(templateTypePrompt || "").split("\n")[0] || "Click to edit..."}
            </div>
          </button>

          <button
            type="button"
            className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 hover:bg-slate-50 transition-colors"
            onClick={() => {
              setPromptModalSection("emphasis");
              setPromptModalOpen(true);
            }}
            title="Edit Text Styling Prompt"
          >
            <div className="text-xs font-semibold text-slate-700">Text Styling Prompt</div>
            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
              {(templateTypeEmphasisPrompt || "").split("\n")[0] || "Click to edit..."}
            </div>
          </button>

          {templateTypeId === "enhanced" && (
            <button
              type="button"
              className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 hover:bg-slate-50 transition-colors"
              onClick={() => {
                setPromptModalSection("image");
                setPromptModalOpen(true);
              }}
              title="Edit Image Generation Prompt"
            >
              <div className="text-xs font-semibold text-slate-700">Image Generation Prompt</div>
              <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                {(templateTypeImageGenPrompt || "").split("\n")[0] || "Click to edit..."}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Typography Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-slate-700 text-white text-xs font-bold flex items-center justify-center">Aa</span>
          <span className="text-sm font-semibold text-slate-900">Typography (Global)</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Headline Font</div>
            <select
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
              value={fontKey(headlineFontFamily, headlineFontWeight)}
              onChange={(e) => {
                const raw = e.target.value || "";
                const [family, w] = raw.split("@@");
                const weight = Number(w);
                setHeadlineFontFamily(family || "Inter, sans-serif");
                setHeadlineFontWeight(Number.isFinite(weight) ? weight : 700);
              }}
            >
              {FONT_OPTIONS.map((o) => (
                <option key={fontKey(o.family, o.weight)} value={fontKey(o.family, o.weight)}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Body Font</div>
            <select
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
              value={fontKey(bodyFontFamily, bodyFontWeight)}
              onChange={(e) => {
                const raw = e.target.value || "";
                const [family, w] = raw.split("@@");
                const weight = Number(w);
                setBodyFontFamily(family || "Inter, sans-serif");
                setBodyFontWeight(Number.isFinite(weight) ? weight : 400);
              }}
            >
              {FONT_OPTIONS.map((o) => (
                <option key={fontKey(o.family, o.weight)} value={fontKey(o.family, o.weight)}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Colors Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 text-white text-sm flex items-center justify-center">🖌️</span>
          <span className="text-sm font-semibold text-slate-900">Colors</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Background</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                value={projectBackgroundColor || "#ffffff"}
                onChange={(e) => updateProjectColors(e.target.value, projectTextColor)}
                disabled={loading || switchingSlides}
                aria-label="Background color"
              />
              <div className="text-xs text-slate-600 tabular-nums">{projectBackgroundColor || "#ffffff"}</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Text</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                value={projectTextColor || "#000000"}
                onChange={(e) => updateProjectColors(projectBackgroundColor, e.target.value)}
                disabled={loading || switchingSlides}
                aria-label="Text color"
              />
              <div className="text-xs text-slate-600 tabular-nums">{projectTextColor || "#000000"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar (visual only for now) */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white select-none">
            🎠
          </div>
          <div className="text-sm font-semibold text-slate-900">
            The Fittest You - AI Carousel Generator
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <input
            className="h-9 w-[320px] max-w-[40vw] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
            value={activeSlideTitle}
            onChange={(e) => {
              const v = e.target.value;
              setProjectTitle(v);
              if (projectSaveTimeoutRef.current) window.clearTimeout(projectSaveTimeoutRef.current);
              const projectIdAtSchedule = currentProjectId;
              projectSaveTimeoutRef.current = window.setTimeout(() => {
                if (!projectIdAtSchedule) return;
                void saveProjectMetaForProject(projectIdAtSchedule, { title: v });
              }, 600);
            }}
            placeholder="Untitled Project"
            disabled={switchingSlides}
            title="Project title"
          />
          <ProjectStatusPill />
          <PromptStatusPill />
          {!isMobile ? (
            <button
              className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
              onClick={() => void handleDownloadAll()}
              disabled={topExporting}
              title="Download all 6 slides as a ZIP"
            >
              {topExporting ? "Preparing..." : "Download All"}
            </button>
          ) : (
            <button
              className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
              onClick={() => void handleShareAll()}
              disabled={topExporting}
              title="Download all slides (saves to Photos when supported)"
            >
              {topExporting ? "Preparing..." : "Download All"}
            </button>
          )}
          <button
            onClick={() => void handleSignOut()}
            className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm transition-colors"
            title="Sign out"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left sidebar */}
        {!isMobile ? (
          <aside
            className="relative bg-white border-r border-slate-200 flex flex-col shrink-0"
            style={{ width: sidebarWidth }}
          >
            {SidebarInner}

            {/* Resize handle */}
            <div
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize"
              onPointerDown={onSidebarResizePointerDown}
              className="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-slate-200/60 active:bg-slate-300/60"
            />
          </aside>
        ) : null}

        {/* Workspace */}
        <main
          className={`flex-1 min-w-0 overflow-y-auto ${styles.workspace}`}
          onPointerDown={(e) => {
            if (!isMobile) return;
            if (mobileDrawerOpen) return;
            // Edge swipe to open drawer (manual-only; no automatic open otherwise)
            if ((e as any).pointerType && (e as any).pointerType !== "touch") return;
            if (isEditableTarget(e.target)) return;
            const x = (e as any).clientX ?? 0;
            const y = (e as any).clientY ?? 0;
            if (x > 20) return;
            mobileGestureRef.current = { mode: "drawer-open", startX: x, startY: y, lastX: x, lastY: y, fired: false };
          }}
          onPointerMove={(e) => {
            if (!isMobile) return;
            const g = mobileGestureRef.current;
            if (g.mode !== "drawer-open") return;
            const x = (e as any).clientX ?? 0;
            const y = (e as any).clientY ?? 0;
            g.lastX = x;
            g.lastY = y;
            const dx = x - g.startX;
            const dy = y - g.startY;
            if (Math.abs(dy) > Math.abs(dx)) return; // likely scroll
            if (!g.fired && dx > 60) {
              g.fired = true;
              setMobileDrawerOpen(true);
            }
          }}
          onPointerUp={() => {
            if (!isMobile) return;
            const g = mobileGestureRef.current;
            if (g.mode === "drawer-open") {
              mobileGestureRef.current.mode = null;
            }
          }}
          onPointerCancel={() => {
            if (!isMobile) return;
            const g = mobileGestureRef.current;
            if (g.mode === "drawer-open") {
              mobileGestureRef.current.mode = null;
            }
          }}
        >
          {/* Mobile: manual left drawer */}
          {isMobile ? (
            <>
              {/* Open handle */}
              {!mobileDrawerOpen ? (
                <button
                  type="button"
                  className="fixed left-2 top-24 z-40 h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700"
                  onClick={() => setMobileDrawerOpen(true)}
                  aria-label="Open menu"
                  title="Open menu"
                >
                  ☰
                </button>
              ) : null}

              {/* Backdrop */}
              {mobileDrawerOpen ? (
                <button
                  type="button"
                  className="fixed inset-0 z-40 bg-black/40"
                  aria-label="Close menu"
                  onClick={() => setMobileDrawerOpen(false)}
                />
              ) : null}

              {/* Drawer */}
              <aside
                className="fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200 shadow-xl"
                style={{
                  width: "min(88vw, 420px)",
                  transform: mobileDrawerOpen ? "translateX(0)" : "translateX(-110%)",
                  transition: "transform 200ms ease",
                }}
                onPointerDown={(e) => {
                  if ((e as any).pointerType && (e as any).pointerType !== "touch") return;
                  const x = (e as any).clientX ?? 0;
                  const y = (e as any).clientY ?? 0;
                  mobileGestureRef.current = { mode: "drawer-close", startX: x, startY: y, lastX: x, lastY: y, fired: false };
                }}
                onPointerMove={(e) => {
                  const g = mobileGestureRef.current;
                  if (g.mode !== "drawer-close") return;
                  const x = (e as any).clientX ?? 0;
                  const y = (e as any).clientY ?? 0;
                  g.lastX = x;
                  g.lastY = y;
                  const dx = x - g.startX;
                  const dy = y - g.startY;
                  if (Math.abs(dy) > Math.abs(dx)) return;
                  if (!g.fired && dx < -60) {
                    g.fired = true;
                    setMobileDrawerOpen(false);
                  }
                }}
                onPointerUp={() => {
                  const g = mobileGestureRef.current;
                  if (g.mode === "drawer-close") mobileGestureRef.current.mode = null;
                }}
                onPointerCancel={() => {
                  const g = mobileGestureRef.current;
                  if (g.mode === "drawer-close") mobileGestureRef.current.mode = null;
                }}
              >
                <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
                  <div className="text-sm font-semibold text-slate-900">Menu</div>
                  <button
                    type="button"
                    className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm"
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    Close
                  </button>
                </div>
                {SidebarInner}
              </aside>

              {/* Mobile "Save slides" panel (per-slide share) */}
              {mobileSaveOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[60] bg-black/50"
                    aria-label="Close save panel"
                    onClick={() => setMobileSaveOpen(false)}
                  />
                  <div
                    className="fixed left-1/2 top-1/2 z-[70] w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">Save slides</div>
                      <button
                        type="button"
                        className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm"
                        onClick={() => setMobileSaveOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="text-sm text-slate-700">
                        Your browser can’t save all 6 images at once. Tap each slide below to open the Share Sheet, then choose <b>Save Image</b>/<b>Save to Photos</b>.
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: slideCount }).map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            className="h-11 rounded-md bg-[#6D28D9] text-white text-sm font-semibold disabled:opacity-50"
                            disabled={mobileSaveBusy !== null || topExporting}
                            onClick={() => void shareSingleSlide(i)}
                          >
                            {mobileSaveBusy === i ? "Preparing..." : `Save Slide ${i + 1}`}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="w-full h-11 rounded-md border border-slate-200 bg-white text-slate-700 text-sm font-semibold disabled:opacity-50"
                        disabled={topExporting}
                        onClick={() => void handleDownloadAll()}
                        title="Fallback: downloads a ZIP to the Files app"
                      >
                        Download ZIP (Files)
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
          {/* Slides row */}
          {/* Lock desktop slide-row height to prevent layout shift while Fabric/templates load. */}
          {/* Slightly bias padding to the top so slides sit a touch lower without moving the bottom panel. */}
          <div className="flex flex-col items-center justify-center md:justify-start p-3 md:px-6 md:pb-6 md:pt-8 md:h-[696px]">
            <div className="w-full max-w-[1400px]">
              {/* Hidden file input for per-slide image upload */}
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  // Reset input so selecting the same file again triggers onChange.
                  e.currentTarget.value = "";
                  void uploadImageForActiveSlide(f);
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
                    disabled={imageBusy || !hasImageForActiveSlide()}
                    onClick={() => void deleteImageForActiveSlide("menu")}
                  >
                    Remove image
                  </button>
                </div>
              ) : null}

              {isMobile ? (
                <div className="w-full">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <button
                      className="h-10 px-3 rounded-md bg-white border border-slate-200 shadow-sm text-slate-700 disabled:opacity-50"
                      aria-label="Previous"
                      onClick={goPrev}
                      disabled={!canGoPrev || switchingSlides}
                    >
                      ←
                    </button>
                    <div className="text-sm font-semibold text-slate-700">
                      Slide {activeSlideIndex + 1} / {slideCount}
                    </div>
                    <button
                      className="h-10 px-3 rounded-md bg-white border border-slate-200 shadow-sm text-slate-700 disabled:opacity-50"
                      aria-label="Next"
                      onClick={goNext}
                      disabled={!canGoNext || switchingSlides}
                    >
                      →
                    </button>
                  </div>

                  <div
                    ref={viewportRef}
                    className="w-full flex items-center justify-center"
                    onPointerDown={(e) => {
                      if (!isMobile) return;
                      if (mobileDrawerOpen) return;
                      if ((e as any).pointerType && (e as any).pointerType !== "touch") return;
                      if (switchingSlides || copyGenerating) return;
                      if (isEditableTarget(e.target)) return;
                      const x = (e as any).clientX ?? 0;
                      const y = (e as any).clientY ?? 0;
                      mobileGestureRef.current = { mode: "slide", startX: x, startY: y, lastX: x, lastY: y, fired: false };
                    }}
                    onPointerMove={(e) => {
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
                    }}
                    onPointerUp={() => {
                      const g = mobileGestureRef.current;
                      if (g.mode === "slide") mobileGestureRef.current.mode = null;
                    }}
                    onPointerCancel={() => {
                      const g = mobileGestureRef.current;
                      if (g.mode === "slide") mobileGestureRef.current.mode = null;
                    }}
                  >
                    {(() => {
                      const i = activeSlideIndex;
                      const tid = computeTemplateIdForSlide(i);
                      const snap = (tid ? templateSnapshots[tid] : null) || null;
                      const layoutForThisCard =
                        layoutData?.layout ? (layoutData.layout as any) : EMPTY_LAYOUT;

                      const maxW = Math.max(240, Math.min(540, (viewportWidth || 540) - 24));
                      const scale = Math.max(0.35, Math.min(1, maxW / 540));

                      const displayW = Math.round(maxW);
                      const displayH = Math.round(720 * scale);

                      return (
                        <div style={{ width: displayW, height: displayH, overflow: "hidden" }}>
                            {!tid ? (
                              <div className="w-[540px] h-[720px] flex items-center justify-center text-slate-400 text-sm">
                                No template selected
                              </div>
                            ) : !snap ? (
                              <div className="w-[540px] h-[720px] flex items-center justify-center text-slate-400 text-sm">
                                Loading template…
                              </div>
                            ) : (
                              <CarouselPreviewVision
                                ref={(node: any) => {
                                  (canvasRef as any).current = node;
                                  slideCanvasRefs.current[i]!.current = node;
                                }}
                                templateId={tid}
                                slideIndex={i}
                                layout={layoutForThisCard}
                                backgroundColor={projectBackgroundColor}
                                textColor={projectTextColor}
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
                                displayWidthPx={displayW}
                                displayHeightPx={displayH}
                                onUserTextChange={
                                  templateTypeId === "regular"
                                    ? handleRegularCanvasTextChange
                                    : handleEnhancedCanvasTextChange
                                }
                                onUserImageChange={handleUserImageChange}
                              />
                            )}
                        </div>
                      );
                    })()}
                  </div>
                  {/* Hidden render of non-active slides so Download/Share All can export them on mobile. */}
                  <div style={{ position: "absolute", left: -100000, top: -100000, width: 1, height: 1, overflow: "hidden" }}>
                    {Array.from({ length: slideCount }).map((_, i) => {
                      if (i === activeSlideIndex) return null;
                      const tid = computeTemplateIdForSlide(i);
                      const snap = (tid ? templateSnapshots[tid] : null) || null;
                      const layoutForThisCard =
                        slides[i]?.layoutData?.layout ? (slides[i].layoutData.layout as any) : EMPTY_LAYOUT;
                      if (!tid || !snap) return null;
                      return (
                        <CarouselPreviewVision
                          key={i}
                          ref={slideCanvasRefs.current[i] as any}
                          templateId={tid}
                          slideIndex={i}
                          layout={layoutForThisCard}
                          backgroundColor={projectBackgroundColor}
                          textColor={projectTextColor}
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
                    onClick={goPrev}
                    disabled={!canGoPrev || switchingSlides}
                  >
                    ←
                  </button>
                  <div
                    ref={viewportRef}
                    // IMPORTANT: prevent vertical scroll/overflow in the dotted workspace.
                    // The upload icon is intentionally positioned slightly below the slide card.
                    // We reserve a small bottom gutter so the icon stays visible without increasing scroll height.
                    className="flex-1 overflow-x-hidden overflow-y-hidden pb-10"
                    style={{ paddingLeft: VIEWPORT_PAD, paddingRight: VIEWPORT_PAD }}
                  >
                    <div
                      className="flex items-center gap-6 px-2 py-6"
                      style={{
                        transform: `translateX(${translateX}px)`,
                        transition: "transform 300ms ease",
                        width: totalW,
                      }}
                    >
                      {Array.from({ length: slideCount }).map((_, i) => (
                        <div
                          key={i}
                          ref={(node) => {
                            slideRefs[i].current = node;
                          }}
                          className="relative"
                          role="button"
                          tabIndex={0}
                          aria-label={`Select slide ${i + 1}`}
                          onClick={() => {
                            if (i === activeSlideIndex) return;
                            if (switchingSlides || copyGenerating) return;
                            void switchToSlide(i);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            if (i === activeSlideIndex) return;
                            if (switchingSlides || copyGenerating) return;
                            void switchToSlide(i);
                          }}
                        >
                          {/* Per-slide image upload trigger (active slide only). Render immediately; disable until a project exists. */}
                          {i === activeSlideIndex ? (
                            <button
                              type="button"
                              // Use translate (not negative bottom) to avoid affecting scroll/overflow metrics when the icon mounts.
                              className="absolute left-2 bottom-0 translate-y-10 w-9 h-9 bg-transparent text-slate-900 hover:text-black disabled:opacity-40"
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
                                // Long-press to open menu
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
                                {/* Camera body */}
                                <rect x="3" y="7" width="14" height="12" rx="3" />
                                {/* Camera top bump */}
                                <path d="M7 7l1.2-2h3.6L13 7" />
                                {/* Lens */}
                                <circle cx="10" cy="13" r="3" />
                                {/* Plus (add photo) */}
                                <path d="M20 4v4" />
                                <path d="M18 6h4" />
                              </svg>
                            </button>
                          ) : null}
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
                                        <div className="w-[540px] h-[720px] flex items-center justify-center text-slate-400 text-sm">
                                          No template selected
                                        </div>
                                      );
                                    }
                                    if (!snap) {
                                      return (
                                        <div className="w-[540px] h-[720px] flex items-center justify-center text-slate-400 text-sm">
                                          Loading template…
                                        </div>
                                      );
                                    }

                                    const refProp =
                                      i === activeSlideIndex
                                        ? (node: any) => {
                                            (canvasRef as any).current = node;
                                            slideCanvasRefs.current[i]!.current = node;
                                          }
                                        : slideCanvasRefs.current[i];

                                    return (
                                      <CarouselPreviewVision
                                        ref={refProp as any}
                                        templateId={tid}
                                        slideIndex={i}
                                        layout={layoutForThisCard}
                                        backgroundColor={projectBackgroundColor}
                                        textColor={projectTextColor}
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
                                        displayWidthPx={420}
                                        displayHeightPx={560}
                                        onUserTextChange={
                                          i === activeSlideIndex
                                            ? (templateTypeId === "regular" ? handleRegularCanvasTextChange : handleEnhancedCanvasTextChange)
                                            : undefined
                                        }
                                        onUserImageChange={
                                          i === activeSlideIndex ? handleUserImageChange : undefined
                                        }
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
                    onClick={goNext}
                    disabled={!canGoNext || switchingSlides}
                  >
                    →
                  </button>
                </div>
              )}
            </div>
            {/* Text styling toolbar (kept outside SlideCard so it never affects slide sizing/clipping) */}
            {layoutData?.layout && inputData ? (
              <div className="mt-4 flex justify-center">
                <TextStylingToolbar fabricCanvas={canvasRef.current?.canvas} />
              </div>
            ) : null}
          </div>

          {/* Bottom panel */}
          <section className="bg-white border-t border-slate-200">
            <div className="max-w-[1400px] mx-auto px-6 py-4">
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-4">
                  {/* Headline Card (Enhanced only) */}
                  {templateTypeId !== "regular" ? (
                    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-slate-900 text-white text-sm font-bold flex items-center justify-center">H</span>
                          <label className="text-sm font-semibold text-slate-900">Headline</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={24}
                            max={120}
                            step={1}
                            className="w-16 h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 text-center"
                            value={Number(slides[activeSlideIndex]?.draftHeadlineFontSizePx ?? 76)}
                            disabled={loading || switchingSlides || copyGenerating}
                            onChange={(e) => {
                              const raw = Number((e.target as any).value);
                              const nextSize = Number.isFinite(raw) ? Math.max(24, Math.min(120, Math.round(raw))) : 76;
                              pushUndoSnapshot();
                              setSlides((prev) =>
                                prev.map((s, i) =>
                                  i !== activeSlideIndex
                                    ? s
                                    : ({
                                        ...s,
                                        draftHeadlineFontSizePx: nextSize,
                                        inputData: s.inputData && typeof s.inputData === "object"
                                          ? { ...(s.inputData as any), headlineFontSizePx: nextSize }
                                          : s.inputData,
                                      } as any)
                                )
                              );
                              slidesRef.current = slidesRef.current.map((s, i) =>
                                i !== activeSlideIndex
                                  ? s
                                  : ({
                                      ...s,
                                      draftHeadlineFontSizePx: nextSize,
                                      inputData: (s as any).inputData && typeof (s as any).inputData === "object"
                                        ? { ...((s as any).inputData as any), headlineFontSizePx: nextSize }
                                        : (s as any).inputData,
                                    } as any)
                              );
                              scheduleLiveLayout(activeSlideIndex);
                            }}
                            title="Font size (24–120px)"
                          />
                          <div className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden shadow-sm">
                            {(["left", "center", "right"] as const).map((a) => {
                              const active = (slides[activeSlideIndex]?.draftHeadlineTextAlign || "left") === a;
                              const label = a === "left" ? "L" : a === "center" ? "C" : "R";
                              return (
                                <button
                                  key={a}
                                  type="button"
                                  className={[
                                    "h-8 w-8 text-xs font-semibold transition-colors",
                                    active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
                                  ].join(" ")}
                                  disabled={loading || switchingSlides || copyGenerating}
                                  title={a === "left" ? "Align Left" : a === "center" ? "Align Center" : "Align Right"}
                                  onClick={() => {
                                    const nextAlign = a;
                                    pushUndoSnapshot();
                                    setSlides((prev) =>
                                      prev.map((s, i) =>
                                        i !== activeSlideIndex
                                          ? s
                                          : ({
                                              ...s,
                                              draftHeadlineTextAlign: nextAlign,
                                              inputData: s.inputData && typeof s.inputData === "object"
                                                ? { ...(s.inputData as any), headlineTextAlign: nextAlign }
                                                : s.inputData,
                                            } as any)
                                      )
                                    );
                                    slidesRef.current = slidesRef.current.map((s, i) =>
                                      i !== activeSlideIndex
                                        ? s
                                        : ({
                                            ...s,
                                            draftHeadlineTextAlign: nextAlign,
                                            inputData: (s as any).inputData && typeof (s as any).inputData === "object"
                                              ? { ...((s as any).inputData as any), headlineTextAlign: nextAlign }
                                              : (s as any).inputData,
                                          } as any)
                                    );
                                    if (currentProjectId) enqueueLiveLayoutForProject(currentProjectId, [activeSlideIndex]);
                                  }}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <RichTextInput
                        key={`rte-headline:${currentProjectId || "none"}:${activeSlideIndex}`}
                        valueText={slides[activeSlideIndex]?.draftHeadline || ""}
                        valueRanges={slides[activeSlideIndex]?.draftHeadlineRanges || []}
                        onDebugLog={addLog}
                        debugId={`headline proj=${currentProjectId || "none"} slide=${activeSlideIndex + 1}`}
                        onChange={(next) => {
                          // Log ONLY if this handler is firing after project/slide changed (stale closure symptom).
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
                          setSlides((prev) =>
                            prev.map((s, i) =>
                              i === activeSlideIndex
                                ? { ...s, draftHeadline: next.text, draftHeadlineRanges: next.ranges }
                                : s
                            )
                          );
                          scheduleLiveLayout(activeSlideIndex);
                        }}
                        disabled={loading || switchingSlides || copyGenerating}
                        placeholder="Enter headline..."
                        minHeightPx={40}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm"
                      />
                    </div>
                  ) : null}

                  {/* Body Card */}
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-700 text-white text-sm font-bold flex items-center justify-center">¶</span>
                        <label className="text-sm font-semibold text-slate-900">Body</label>
                      </div>
                      {templateTypeId !== "regular" ? (
                        <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={24}
                          max={120}
                          step={1}
                          className="w-16 h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 text-center"
                          value={Number(slides[activeSlideIndex]?.draftBodyFontSizePx ?? 48)}
                          disabled={loading || switchingSlides || copyGenerating}
                          onChange={(e) => {
                            const raw = Number((e.target as any).value);
                            const nextSize = Number.isFinite(raw) ? Math.max(24, Math.min(120, Math.round(raw))) : 48;
                            pushUndoSnapshot();
                            setSlides((prev) =>
                              prev.map((s, i) =>
                                i !== activeSlideIndex
                                  ? s
                                  : ({
                                      ...s,
                                      draftBodyFontSizePx: nextSize,
                                      inputData: s.inputData && typeof s.inputData === "object"
                                        ? { ...(s.inputData as any), bodyFontSizePx: nextSize }
                                        : s.inputData,
                                    } as any)
                              )
                            );
                            slidesRef.current = slidesRef.current.map((s, i) =>
                              i !== activeSlideIndex
                                ? s
                                : ({
                                    ...s,
                                    draftBodyFontSizePx: nextSize,
                                    inputData: (s as any).inputData && typeof (s as any).inputData === "object"
                                      ? { ...((s as any).inputData as any), bodyFontSizePx: nextSize }
                                      : (s as any).inputData,
                                  } as any)
                            );
                            scheduleLiveLayout(activeSlideIndex);
                          }}
                          title="Font size (24–120px)"
                        />
                        <div className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden shadow-sm">
                          {(["left", "center", "right"] as const).map((a) => {
                            const active = (slides[activeSlideIndex]?.draftBodyTextAlign || "left") === a;
                            const label = a === "left" ? "L" : a === "center" ? "C" : "R";
                            return (
                              <button
                                key={a}
                                type="button"
                                className={[
                                  "h-8 w-8 text-xs font-semibold transition-colors",
                                  active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
                                ].join(" ")}
                                disabled={loading || switchingSlides || copyGenerating}
                                title={a === "left" ? "Align Left" : a === "center" ? "Align Center" : "Align Right"}
                                onClick={() => {
                                  const nextAlign = a;
                                  pushUndoSnapshot();
                                  setSlides((prev) =>
                                    prev.map((s, i) =>
                                      i !== activeSlideIndex
                                        ? s
                                        : ({
                                            ...s,
                                            draftBodyTextAlign: nextAlign,
                                            inputData: s.inputData && typeof s.inputData === "object"
                                              ? { ...(s.inputData as any), bodyTextAlign: nextAlign }
                                              : s.inputData,
                                          } as any)
                                    )
                                  );
                                  slidesRef.current = slidesRef.current.map((s, i) =>
                                    i !== activeSlideIndex
                                      ? s
                                      : ({
                                          ...s,
                                          draftBodyTextAlign: nextAlign,
                                          inputData: (s as any).inputData && typeof (s as any).inputData === "object"
                                            ? { ...((s as any).inputData as any), bodyTextAlign: nextAlign }
                                            : (s as any).inputData,
                                        } as any)
                                  );
                                  if (currentProjectId) enqueueLiveLayoutForProject(currentProjectId, [activeSlideIndex]);
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        </div>
                      ) : null}
                    </div>
                    <RichTextInput
                      key={`rte-body:${currentProjectId || "none"}:${activeSlideIndex}`}
                      valueText={slides[activeSlideIndex]?.draftBody || ""}
                      valueRanges={slides[activeSlideIndex]?.draftBodyRanges || []}
                      onDebugLog={addLog}
                      debugId={`body proj=${currentProjectId || "none"} slide=${activeSlideIndex + 1}`}
                      onChange={(next) => {
                        // Log ONLY if this handler is firing after project/slide changed (stale closure symptom).
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
                        setSlides((prev) =>
                          prev.map((s, i) =>
                            i === activeSlideIndex
                              ? { ...s, draftBody: next.text, draftBodyRanges: next.ranges }
                              : s
                          )
                        );
                        scheduleLiveLayout(activeSlideIndex);
                      }}
                      disabled={loading || switchingSlides || copyGenerating}
                      placeholder="Enter body..."
                      minHeightPx={96}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm"
                    />
                  </div>

                  {/* AI Image Prompt Card (Enhanced only) */}
                  {templateTypeId === "enhanced" && (
                    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white text-sm flex items-center justify-center">🎨</span>
                          <label className="text-sm font-semibold text-slate-900">AI Image Prompt</label>
                          {aiImagePromptSaveStatus === "saving" && (
                            <span className="text-xs text-slate-500">Saving...</span>
                          )}
                          {aiImagePromptSaveStatus === "saved" && (
                            <span className="text-xs text-emerald-600">Saved ✓</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
                          onClick={() => void runGenerateImagePrompts(activeSlideIndex)}
                          disabled={imagePromptGenerating || !currentProjectId || copyGenerating || switchingSlides}
                          title="Regenerate AI image prompt for this slide"
                        >
                          {imagePromptGenerating ? "Generating..." : "Regenerate"}
                        </button>
                      </div>
                      <textarea
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 text-sm shadow-sm"
                        rows={4}
                        value={slides[activeSlideIndex]?.draftAiImagePrompt || ""}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setSlides((prev) =>
                            prev.map((s, i) =>
                              i === activeSlideIndex
                                ? { ...s, draftAiImagePrompt: newValue }
                                : s
                            )
                          );
                        }}
                        disabled={loading || switchingSlides || copyGenerating || imagePromptGenerating}
                        placeholder="AI-generated image prompt will appear here after Generate Copy..."
                      />
                      {imagePromptError && (
                        <div className="mt-2 text-xs text-red-600">
                          {imagePromptError}
                        </div>
                      )}

                      {/* Generate Image Button with Progress Bar */}
                      <div className="mt-4">
                        <button
                          className="w-full h-12 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50 relative overflow-hidden transition-shadow"
                          disabled={
                            !currentProjectId ||
                            aiImageGeneratingThis ||
                            copyGenerating ||
                            switchingSlides ||
                            imagePromptGenerating ||
                            !(slides[activeSlideIndex]?.draftAiImagePrompt || '').trim()
                          }
                          onClick={() => void runGenerateAiImage()}
                        >
                          {aiImageGeneratingThis ? (
                            <>
                              {/* Progress bar background */}
                              <div
                                className="absolute inset-0 bg-gradient-to-r from-purple-700 to-blue-700 transition-all duration-200"
                                style={{ width: `${aiImageProgressThis || 0}%` }}
                              />
                              <span className="relative z-10 flex flex-col items-center justify-center leading-tight">
                                <span className="text-xs opacity-90">
                                  {aiImageStatusThis || 'Working...'}
                                </span>
                                <span className="text-sm font-bold">
                                  {Math.round(aiImageProgressThis || 0)}%
                                </span>
                              </span>
                            </>
                          ) : (
                            "🎨 Generate Image"
                          )}
                        </button>
                        {aiImageErrorThis && (
                          <div className="mt-2 text-xs text-red-600">
                            {aiImageErrorThis}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-slate-500 text-center">
                          Uses AI to create an image matching this prompt. Takes 90 seconds to 2 minutes.
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Controls Card */}
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-7 h-7 rounded-lg bg-slate-600 text-white text-sm flex items-center justify-center">⚙️</span>
                    <span className="text-sm font-semibold text-slate-900">Controls</span>
                    <CopyProgressIcon />
                  </div>
                  <div className="space-y-3">
                    <button
                      className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-md hover:shadow-lg transition-shadow disabled:opacity-50"
                      disabled={!currentProjectId || copyGenerating || switchingSlides}
                      onClick={() => void runGenerateCopy()}
                    >
                      {copyGenerating ? "Generating Copy..." : "Generate Copy"}
                    </button>
                    {activeImageSelected ? (
                      <>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                          {(() => {
                            const pid = currentProjectId;
                            const key = pid ? aiKey(pid, activeSlideIndex) : "";
                            const busy = key ? bgRemovalBusyKeys.has(key) : false;
                            const enabled = ((layoutData as any)?.layout?.image?.bgRemovalEnabled ?? true) as boolean;
                            const statusRaw = String((layoutData as any)?.layout?.image?.bgRemovalStatus || (enabled ? "idle" : "disabled"));
                            const statusLabel =
                              busy
                                ? (enabled ? "processing" : "saving")
                                : statusRaw;
                            return (
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="text-xs text-slate-500">
                                  BG removal:{" "}
                                  <span className="font-semibold text-slate-800">{statusLabel}</span>
                                </div>
                                {busy ? (
                                  <div className="text-[11px] text-slate-500">
                                    Working…
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Background removal</div>
                              <div className="text-xs text-slate-500">
                                Improves text wrapping around subject.
                              </div>
                            </div>
                            <button
                              type="button"
                              className={[
                                "h-8 w-14 rounded-full transition-colors",
                                ((layoutData as any)?.layout?.image?.bgRemovalEnabled ?? true) ? "bg-black" : "bg-slate-300",
                              ].join(" ")}
                              onClick={() => {
                                const cur = ((layoutData as any)?.layout?.image?.bgRemovalEnabled ?? true) as boolean;
                                void setActiveSlideImageBgRemoval(!cur);
                              }}
                              disabled={
                                imageBusy ||
                                switchingSlides ||
                                copyGenerating ||
                                !currentProjectId ||
                                (currentProjectId ? bgRemovalBusyKeys.has(aiKey(currentProjectId, activeSlideIndex)) : false)
                              }
                              title="Toggle background removal for this image (persists per slide)"
                            >
                              <span
                                className={[
                                  "block h-7 w-7 rounded-full bg-white shadow-sm translate-x-0 transition-transform",
                                  ((layoutData as any)?.layout?.image?.bgRemovalEnabled ?? true) ? "translate-x-6" : "translate-x-1",
                                ].join(" ")}
                              />
                            </button>
                          </div>
                          {String((layoutData as any)?.layout?.image?.bgRemovalStatus || "") === "failed" ? (
                            <button
                              type="button"
                              className="mt-2 w-full h-9 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-semibold shadow-sm disabled:opacity-50"
                              onClick={() => void setActiveSlideImageBgRemoval(true)}
                              disabled={
                                imageBusy ||
                                switchingSlides ||
                                copyGenerating ||
                                !currentProjectId ||
                                (currentProjectId ? bgRemovalBusyKeys.has(aiKey(currentProjectId, activeSlideIndex)) : false)
                              }
                              title="Try background removal again"
                            >
                              {currentProjectId && bgRemovalBusyKeys.has(aiKey(currentProjectId, activeSlideIndex)) ? "Processing…" : "Try again"}
                            </button>
                          ) : null}
                        </div>
                        <button
                          className="w-full h-10 rounded-lg border border-red-200 bg-white text-red-700 text-sm font-semibold shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                          onClick={() => void deleteImageForActiveSlide("button")}
                          disabled={imageBusy || switchingSlides || copyGenerating || !currentProjectId}
                          title="Delete the selected image from this slide"
                        >
                          {imageBusy ? "Working…" : "Delete Image"}
                        </button>
                      </>
                    ) : null}
                    {copyError ? <div className="text-xs text-red-600">❌ {copyError}</div> : null}
                    {templateTypeId !== "regular" ? (
                      <>
                        <button
                          className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                          onClick={() => {
                            layoutDirtyRef.current = true;
                            pushUndoSnapshot();
                            setSlides((prev) =>
                              prev.map((s, i) =>
                                i !== activeSlideIndex
                                  ? s
                                  : ({
                                      ...s,
                                      draftHeadlineTextAlign: "left",
                                      draftBodyTextAlign: "left",
                                      inputData: (s as any).inputData && typeof (s as any).inputData === "object"
                                        ? { ...((s as any).inputData as any), headlineTextAlign: "left", bodyTextAlign: "left" }
                                        : (s as any).inputData,
                                    } as any)
                              )
                            );
                            slidesRef.current = slidesRef.current.map((s, i) =>
                              i !== activeSlideIndex
                                ? s
                                : ({
                                    ...s,
                                    draftHeadlineTextAlign: "left",
                                    draftBodyTextAlign: "left",
                                    inputData: (s as any).inputData && typeof (s as any).inputData === "object"
                                      ? { ...((s as any).inputData as any), headlineTextAlign: "left", bodyTextAlign: "left" }
                                      : (s as any).inputData,
                                  } as any)
                            );
                            wipeLineOverridesForActiveSlide();
                            if (realignmentModel === "gemini-computational") {
                              if (currentProjectId) enqueueLiveLayoutForProject(currentProjectId, [activeSlideIndex]);
                            } else {
                              void handleRealign({ skipHistory: true });
                            }
                          }}
                          disabled={loading || realigning || !layoutData || switchingSlides || copyGenerating}
                        >
                          {realigning ? "Realigning..." : "Realign Text"}
                        </button>

                        {/* Advanced Layout Controls - Hidden per user request */}
                        {/* <AdvancedLayoutControls ... /> */}
                      </>
                    ) : null}
                    <button
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                      onClick={() => {
                        layoutDirtyRef.current = true;
                        handleUndo();
                      }}
                      disabled={layoutHistory.length === 0 || realigning || switchingSlides || copyGenerating}
                    >
                      Undo
                    </button>

                    <button
                      className={[
                        "w-full h-10 rounded-lg text-sm font-semibold shadow-sm transition-all border",
                        showLayoutOverlays
                          ? "bg-gradient-to-b from-slate-600 to-slate-700 text-white border-slate-500 hover:from-slate-500 hover:to-slate-600"
                          : "bg-gradient-to-b from-slate-100 to-slate-200 text-slate-600 border-slate-300 hover:from-slate-50 hover:to-slate-100",
                      ].join(" ")}
                      onClick={() => {
                        const next = !showLayoutOverlays;
                        setShowLayoutOverlays(next);
                        try {
                          addLog(`🧩 Overlays: ${next ? "ON" : "OFF"}`);
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      {showLayoutOverlays ? "Hide Layout Overlays" : "Show Layout Overlays"}
                    </button>

                    {saveError && <div className="text-xs text-red-600">❌ {saveError}</div>}
                    {error && <div className="text-xs text-red-600">❌ {error}</div>}

                    {error && inputData && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="text-sm font-semibold text-red-800">Generation Failed</div>
                        <div className="text-xs text-red-700 mt-1">{error}</div>
                        <button
                          className="mt-2 w-full h-9 rounded-lg bg-red-600 text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                          onClick={() => void handleRetry()}
                          disabled={!inputData || loading || switchingSlides}
                        >
                          Try Again
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Caption Card */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-amber-500 text-white text-sm flex items-center justify-center">✍️</span>
                    <span className="text-sm font-semibold text-slate-900">Caption</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {captionCopyStatus === "copied" ? (
                      <span className="text-xs text-emerald-700 font-medium">Copied!</span>
                    ) : captionCopyStatus === "error" ? (
                      <span className="text-xs text-red-600 font-medium">Copy failed</span>
                    ) : null}
                    <button
                      type="button"
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                      onClick={async () => {
                        const ok = await copyToClipboard(captionDraft || "");
                        setCaptionCopyStatus(ok ? "copied" : "error");
                        window.setTimeout(() => setCaptionCopyStatus("idle"), 1200);
                      }}
                      disabled={copyGenerating}
                      title="Copy caption to clipboard"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <textarea
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm"
                  rows={3}
                  placeholder="Write a caption..."
                  value={captionDraft}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCaptionDraft(v);
                    if (projectSaveTimeoutRef.current) window.clearTimeout(projectSaveTimeoutRef.current);
                    const projectIdAtSchedule = currentProjectId;
                    projectSaveTimeoutRef.current = window.setTimeout(() => {
                      if (!projectIdAtSchedule) return;
                      void saveProjectMetaForProject(projectIdAtSchedule, { caption: v });
                    }, 600);
                  }}
                  disabled={copyGenerating}
                />
              </div>

              {/* Debug Card */}
              <details className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-sm group">
                <summary className="cursor-pointer px-4 py-3 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-slate-500 text-white text-sm flex items-center justify-center">🔧</span>
                  <span className="text-sm font-semibold text-slate-900">Debug</span>
                  <span className="ml-auto text-xs text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  {debugScreenshot && (
                    <div>
                      <button
                        className="text-xs text-violet-700 font-medium hover:underline"
                        onClick={() => setShowDebugPreview(!showDebugPreview)}
                      >
                        {showDebugPreview ? "Hide" : "Show"} Screenshot
                      </button>
                      {showDebugPreview && (
                        <div className="mt-2 bg-white rounded-lg border border-slate-200 p-2 overflow-auto max-h-64 shadow-sm">
                          <img
                            src={debugScreenshot}
                            alt="Screenshot sent to Claude Vision"
                            className="max-w-full h-auto mx-auto"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {debugLogs.length > 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-950 p-3 max-h-64 overflow-y-auto font-mono text-[11px] text-green-300 shadow-inner">
                      {debugLogs.map((log, idx) => (
                        <div key={idx} className="mb-1">
                          {log}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">No debug logs yet.</div>
                  )}
                </div>
              </details>
            </div>
          </section>
        </main>
      </div>

      <TemplateEditorModal
        open={templateEditorOpen}
        onClose={() => setTemplateEditorOpen(false)}
        templates={templates}
        // In /editor we want Template Editor to default to "Select Template" each open.
        // The mapped templates still render in the slide strip; this only affects the modal's initial selection.
        currentTemplateId={null}
        currentTemplateSnapshot={null}
        onTemplateSaved={(templateId, nextDefinition) => {
          setSelectedTemplateId(templateId);
          setSelectedTemplateSnapshot(nextDefinition);
          // IMPORTANT: keep the /editor template snapshot cache in sync so:
          // - slide strip canvases rerender immediately
          // - reopening Template Editor shows the latest version (no stale cache)
          setTemplateSnapshots((prev) => ({ ...prev, [templateId]: nextDefinition as any }));
          addLog(`✅ Template updated (snapshot refreshed): ${templateId}`);
        }}
        onRefreshTemplates={loadTemplatesList}
      />

      {/* Template Settings modal */}
      {templateSettingsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6"
          onMouseDown={(e) => {
            // Only close on true backdrop clicks (not inside the panel).
            if (e.target === e.currentTarget) setTemplateSettingsOpen(false);
          }}
        >
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="text-base font-semibold text-slate-900">
                Template Settings ({templateTypeId === "enhanced" ? "Enhanced" : "Regular"})
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => setTemplateSettingsOpen(false)}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="mt-2 grid grid-cols-1 gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Slide 1 Template</div>
                  <select
                    className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                    value={templateTypeMappingSlide1 || ""}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      promptDirtyRef.current = true;
                      setTemplateTypeMappingSlide1(next);
                      // Also apply to the currently loaded project so visuals update immediately.
                      if (currentProjectIdRef.current) {
                        setProjectMappingSlide1(next);
                        void persistCurrentProjectTemplateMappings({ slide1TemplateIdSnapshot: next });
                      }
                    }}
                    disabled={loadingTemplates}
                  >
                    <option value="">{loadingTemplates ? "Loading..." : "Select template…"}</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Slides 2–5 Template</div>
                  <select
                    className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                    value={templateTypeMappingSlide2to5 || ""}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      promptDirtyRef.current = true;
                      setTemplateTypeMappingSlide2to5(next);
                      // Also apply to the currently loaded project so visuals update immediately.
                      if (currentProjectIdRef.current) {
                        setProjectMappingSlide2to5(next);
                        void persistCurrentProjectTemplateMappings({ slide2to5TemplateIdSnapshot: next });
                      }
                    }}
                    disabled={loadingTemplates}
                  >
                    <option value="">{loadingTemplates ? "Loading..." : "Select template…"}</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Slide 6 Template</div>
                  <select
                    className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                    value={templateTypeMappingSlide6 || ""}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      promptDirtyRef.current = true;
                      setTemplateTypeMappingSlide6(next);
                      // Also apply to the currently loaded project so visuals update immediately.
                      if (currentProjectIdRef.current) {
                        setProjectMappingSlide6(next);
                        void persistCurrentProjectTemplateMappings({ slide6TemplateIdSnapshot: next });
                      }
                    }}
                    disabled={loadingTemplates}
                  >
                    <option value="">{loadingTemplates ? "Loading..." : "Select template…"}</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end">
                <button
                  className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm"
                  onClick={() => {
                    // Avoid two stacked modals; template editor should be the only open overlay.
                    setTemplateSettingsOpen(false);
                    setPromptModalOpen(false);
                    setTemplateEditorOpen(true);
                  }}
                  title="Open Template Editor"
                >
                  Template Editor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompts modal (quick edit) */}
      {promptModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPromptModalOpen(false);
          }}
        >
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="text-base font-semibold text-slate-900">
                Prompts ({templateTypeId === "enhanced" ? "Enhanced" : "Regular"})
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => setPromptModalOpen(false)}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Poppy Prompt</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Used for generating the 6-slide copy for this template type (saved per user).
                  </div>
                  <textarea
                    ref={promptTextareaRef}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                    rows={10}
                    value={templateTypePrompt}
                    onChange={(e) => {
                      promptDirtyRef.current = true;
                      setTemplateTypePrompt(e.target.value);
                    }}
                    placeholder="Enter the Poppy prompt for this template type..."
                  />
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Text Styling Prompt</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Controls bold/italic/underline for scannability. It never changes characters—only formatting ranges (saved per user).
                  </div>
                  <textarea
                    ref={emphasisTextareaRef}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                    rows={10}
                    value={templateTypeEmphasisPrompt}
                    onChange={(e) => {
                      promptDirtyRef.current = true;
                      setTemplateTypeEmphasisPrompt(e.target.value);
                    }}
                    placeholder="Enter the text styling prompt for this template type..."
                  />
                </div>

                {templateTypeId === "enhanced" && (
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Image Generation Prompt</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      System prompt sent to Claude for generating per-slide image prompts. Used when "Generate Copy" is clicked (Enhanced only).
                    </div>
                    <textarea
                      className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                      rows={10}
                      value={templateTypeImageGenPrompt}
                      onChange={(e) => {
                        promptDirtyRef.current = true;
                        setTemplateTypeImageGenPrompt(e.target.value);
                      }}
                      placeholder="Enter the image generation prompt for this template type..."
                    />
                  </div>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Auto-saves as you type. Press <span className="font-mono">Esc</span> to close.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


