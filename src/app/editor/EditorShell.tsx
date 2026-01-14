"use client";

import { createRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./EditorShell.module.css";
import dynamic from "next/dynamic";
import { useCarouselEditorEngine } from "../components/health/marketing/ai-carousel/useCarouselEditorEngine";
import type { CarouselTextRequest, TextStyle } from "@/lib/carousel-types";
import type { VisionLayoutDecision } from "@/lib/carousel-types";
import { wrapFlowLayout } from "@/lib/wrap-flow-layout";
import TemplateEditorModal from "../components/health/marketing/ai-carousel/TemplateEditorModal";
import { ensureTypographyFontsLoaded, estimateAvgCharWidthEm } from "../components/health/marketing/ai-carousel/fontMetrics";
import { supabase, useAuth } from "../components/auth/AuthContext";
import { RichTextInput, type InlineStyleRange } from "./RichTextInput";
import { remapRangesByDiff } from "@/lib/text-placement";
import JSZip from "jszip";

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
  const liveLayoutTimeoutsRef = useRef<Record<number, number | null>>({});
  const liveLayoutQueueRef = useRef<number[]>([]);
  const liveLayoutRunningRef = useRef(false);
  const regularCanvasSaveTimeoutRef = useRef<number | null>(null);
  const enhancedCanvasSaveTimeoutRef = useRef<number | null>(null);
  const lastAppliedOverrideKeysRef = useRef<Record<number, string[]>>({});

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
  const [promptModalSection, setPromptModalSection] = useState<"prompt" | "emphasis">("prompt");
  const promptDirtyRef = useRef(false);
  const promptSaveTimeoutRef = useRef<number | null>(null);
  const [promptSaveStatus, setPromptSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copyGenerating, setCopyGenerating] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyProgressState, setCopyProgressState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [copyProgressLabel, setCopyProgressLabel] = useState<string>("");
  const copyProgressPollRef = useRef<number | null>(null);
  const copyProgressResetRef = useRef<number | null>(null);
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
  const [bodyFontSizePx, setBodyFontSizePx] = useState<number>(48);
  const bodyFontSizeDebounceRef = useRef<number | null>(null);
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
  } = useCarouselEditorEngine({ enableLegacyAutoSave: false });

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
    draftBg: string;
    draftText: string;
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
    draftBg: "#ffffff",
    draftText: "#000000",
  });

  const [slides, setSlides] = useState<SlideState[]>(
    () => Array.from({ length: slideCount }, () => initSlide())
  );
  const slidesRef = useRef<SlideState[]>(slides);
  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  // Debounced autosave: active slide headline/body → Supabase (carousel_project_slides)
  const activeDraftHeadline = slides[activeSlideIndex]?.draftHeadline || "";
  const activeDraftBody = slides[activeSlideIndex]?.draftBody || "";
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
    slideSaveTimeoutRef.current = window.setTimeout(() => {
      const headlineVal = templateTypeId === "regular" ? null : (activeDraftHeadline || null);
      void (async () => {
        const ok = await saveSlidePatch(activeSlideIndex, {
          headline: headlineVal,
          body: activeDraftBody || null,
        });
        if (!ok) return;
        // Mark text as clean after a successful save.
        setSlides((prev) =>
          prev.map((s, i) =>
            i !== activeSlideIndex
              ? s
              : {
                  ...s,
                  savedHeadline: templateTypeId === "regular" ? "" : (s.draftHeadline || ""),
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

  // Persist layout snapshots only when an explicit layout action happened (Generate Layout / Realign / Undo).
  useEffect(() => {
    if (!currentProjectId) return;
    if (switchingSlides) return;
    if (!layoutDirtyRef.current) return;
    if (!layoutData?.layout || !inputData) return;

    if (layoutSaveTimeoutRef.current) window.clearTimeout(layoutSaveTimeoutRef.current);
    layoutSaveTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        const ok = await saveSlidePatch(activeSlideIndex, {
          layoutSnapshot: layoutData.layout,
          inputSnapshot: inputData,
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

  const uploadImageForActiveSlide = async (file: File) => {
    if (!currentProjectId) throw new Error("Create or load a project first.");
    if (!file) return;
    if (!Number.isInteger(activeSlideIndex) || activeSlideIndex < 0 || activeSlideIndex > 5) return;

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

      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", currentProjectId);
      fd.append("slideIndex", String(activeSlideIndex));
      // Phase 3: background removal is ON by default for new uploads (toggle lives on selected image).
      fd.append("bgRemovalEnabled", "1");

      const res = await fetch("/api/editor/projects/slides/image/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) throw new Error(j?.error || `Upload failed (${res.status})`);

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

      const tid = computeTemplateIdForSlide(activeSlideIndex);
      const snap = (tid ? templateSnapshots[tid] : null) || null;
      const placement = computeDefaultUploadedImagePlacement(snap, dims.w, dims.h);
      const mask = (j?.mask as any) || null;
      const bgRemovalStatus = String(j?.bgRemovalStatus || "idle");
      const original = j?.original || null;
      const processed = j?.processed || null;

      // Patch the CURRENT active layout snapshot so Realign can see the image and preserve movement.
      const baseLayout = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : { ...EMPTY_LAYOUT };
      const nextLayout = {
        ...baseLayout,
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

      setLayoutData({ success: true, layout: nextLayout, imageUrl: url } as any);
      setSlides((prev) =>
        prev.map((s, i) =>
          i !== activeSlideIndex
            ? s
            : {
                ...s,
                layoutData: { success: true, layout: nextLayout, imageUrl: url } as any,
              }
        )
      );
      slidesRef.current = slidesRef.current.map((s, i) =>
        i !== activeSlideIndex ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: url } as any } as any)
      );

      // Persist to Supabase (per-slide snapshot).
      await saveSlidePatch(activeSlideIndex, { layoutSnapshot: nextLayout });
      addLog(`🖼️ Uploaded image → slide ${activeSlideIndex + 1}`);
    } finally {
      setImageBusy(false);
    }
  };

  const setActiveSlideImageBgRemoval = async (nextEnabled: boolean) => {
    if (!currentProjectId) throw new Error("Create or load a project first.");
    if (!Number.isInteger(activeSlideIndex) || activeSlideIndex < 0 || activeSlideIndex > 5) return;
    const baseLayout = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : null;
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
    setLayoutData((prev: any) => (prev?.layout ? ({ ...prev, layout: nextLayout }) : prev));
    setSlides((prev) => prev.map((s, i) => (i === activeSlideIndex ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout } as any }) : s)));
    slidesRef.current = slidesRef.current.map((s, i) => (i === activeSlideIndex ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout } as any } as any) : s));

    await saveSlidePatch(activeSlideIndex, { layoutSnapshot: nextLayout });

    if (nextEnabled) {
      try {
        const j = await fetchJson("/api/editor/projects/slides/image/reprocess", {
          method: "POST",
          body: JSON.stringify({ projectId: currentProjectId, slideIndex: activeSlideIndex }),
        });
        if (!j?.success) throw new Error(j?.error || "Reprocess failed");

        const processedUrl = String(j?.processed?.url || "");
        const processedPath = String(j?.processed?.path || "");
        const mask = j?.mask || null;
        const bgRemovalStatus = String(j?.bgRemovalStatus || "succeeded");

        const base2 = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : { ...EMPTY_LAYOUT };
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
        setLayoutData((prev: any) => (prev?.layout ? ({ ...prev, layout: nextLayout2, imageUrl: nextImg.url } as any) : prev));
        setSlides((prev) => prev.map((s, i) => (i === activeSlideIndex ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: nextImg.url } as any }) : s)));
        slidesRef.current = slidesRef.current.map((s, i) => (i === activeSlideIndex ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: nextImg.url } as any } as any) : s));
        await saveSlidePatch(activeSlideIndex, { layoutSnapshot: nextLayout2 });
      } catch (e) {
        // Mark failed but keep original visible.
        const base2 = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : null;
        const prevImg = base2?.image ? { ...(base2.image as any) } : null;
        if (!base2 || !prevImg) return;
        const o = (prevImg as any).original || null;
        const failedImg: any = { ...prevImg, bgRemovalEnabled: true, bgRemovalStatus: "failed" };
        if (o?.url) failedImg.url = String(o.url);
        if (o?.storage) failedImg.storage = o.storage;
        if (failedImg.mask) delete failedImg.mask;
        if (failedImg.processed) delete failedImg.processed;
        const nextLayout2 = { ...base2, image: failedImg };
        setLayoutData((prev: any) => (prev?.layout ? ({ ...prev, layout: nextLayout2, imageUrl: failedImg.url } as any) : prev));
        setSlides((prev) => prev.map((s, i) => (i === activeSlideIndex ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: failedImg.url } as any }) : s)));
        slidesRef.current = slidesRef.current.map((s, i) => (i === activeSlideIndex ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: failedImg.url } as any } as any) : s));
        await saveSlidePatch(activeSlideIndex, { layoutSnapshot: nextLayout2 });
      }
    }
  };

  const deleteImageForActiveSlide = async (reason: "menu" | "button") => {
    if (!currentProjectId) return;
    setImageBusy(true);
    closeImageMenu();
    try {
      const curLayout = (layoutData as any)?.layout || null;
      // Best-effort delete from storage
      try {
        await fetchJson("/api/editor/projects/slides/image/delete", {
          method: "POST",
          body: JSON.stringify({ projectId: currentProjectId, slideIndex: activeSlideIndex }),
        });
      } catch (e) {
        // If storage delete fails, still remove from the slide snapshot so the UI unblocks.
        console.warn("[EditorShell] Image storage delete failed:", e);
      }

      const baseLayout = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : { ...EMPTY_LAYOUT };
      const nextLayout = { ...baseLayout };
      if (nextLayout.image) delete (nextLayout as any).image;

      setLayoutData({ success: true, layout: nextLayout, imageUrl: null } as any);
      setSlides((prev) =>
        prev.map((s, i) =>
          i !== activeSlideIndex ? s : { ...s, layoutData: { success: true, layout: nextLayout, imageUrl: null } as any }
        )
      );
      slidesRef.current = slidesRef.current.map((s, i) =>
        i !== activeSlideIndex ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: null } as any } as any)
      );

      await saveSlidePatch(activeSlideIndex, { layoutSnapshot: nextLayout });
      setActiveImageSelected(false);
      addLog(`🗑️ Removed image (slide ${activeSlideIndex + 1}) via ${reason}`);
    } finally {
      setImageBusy(false);
    }
  };

  const handleUserImageChange = (change: { x: number; y: number; width: number; height: number }) => {
    if (!currentProjectId) return;
    // Update in-memory layout snapshot so Realign sees the current image bounds immediately.
    const baseLayout = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : { ...EMPTY_LAYOUT };
    const prevImage = (baseLayout as any)?.image || null;
    if (!prevImage || !prevImage.url) return; // no user image to update

    // Enable Undo for image moves/resizes too. Push only when bounds actually changed.
    try {
      const eps = 0.5;
      const didMove =
        Math.abs(Number(prevImage?.x ?? 0) - Number(change.x ?? 0)) > eps ||
        Math.abs(Number(prevImage?.y ?? 0) - Number(change.y ?? 0)) > eps;
      const didResize =
        Math.abs(Number(prevImage?.width ?? 0) - Number(change.width ?? 0)) > eps ||
        Math.abs(Number(prevImage?.height ?? 0) - Number(change.height ?? 0)) > eps;
      if (didMove || didResize) pushUndoSnapshot();
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
      },
    };

    setLayoutData({ success: true, layout: nextLayout, imageUrl: prevImage.url } as any);
    setSlides((prev) =>
      prev.map((s, i) =>
        i !== activeSlideIndex
          ? s
          : {
              ...s,
              layoutData: { success: true, layout: nextLayout, imageUrl: prevImage.url } as any,
            }
      )
    );
    slidesRef.current = slidesRef.current.map((s, i) =>
      i !== activeSlideIndex
        ? s
        : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: prevImage.url } as any } as any)
    );

    // Debounced persist (500ms) after user finishes moving/resizing the image.
    if (imageMoveSaveTimeoutRef.current) window.clearTimeout(imageMoveSaveTimeoutRef.current);
    imageMoveSaveTimeoutRef.current = window.setTimeout(() => {
      void saveSlidePatch(activeSlideIndex, { layoutSnapshot: nextLayout });
    }, 500);
  };

  const runGenerateCopy = async () => {
    if (!currentProjectId) {
      setCopyError('Create or load a project first.');
      return;
    }
    setCopyError(null);
    setCopyGenerating(true);
    // Progress indicator: poll job status for true step updates (no schema changes).
    if (copyProgressPollRef.current) window.clearInterval(copyProgressPollRef.current);
    if (copyProgressResetRef.current) window.clearTimeout(copyProgressResetRef.current);
    setCopyProgressState("running");
    setCopyProgressLabel("Starting…");
    const stepLabelFor = (progressCode: string) => {
      const code = String(progressCode || "").toLowerCase();
      if (code.includes("poppy")) return "Poppy is Cooking...";
      if (code.includes("parse")) return "Parsing output…";
      if (code.includes("emphasis")) return "Generating emphasis styles…";
      if (code.includes("save")) return "Saving…";
      return "Working…";
    };
    const pollOnce = async () => {
      if (!currentProjectId) return;
      try {
        const j = await fetchJson(`/api/editor/projects/jobs/status?projectId=${encodeURIComponent(currentProjectId)}`, { method: "GET" });
        const job = j?.activeJob || null;
        if (!job) return;
        const status = String(job.status || "");
        const err = String(job.error || "");
        // We reuse `error` while running to store "progress:<step>".
        if ((status === "pending" || status === "running") && err.startsWith("progress:")) {
          setCopyProgressLabel(stepLabelFor(err.slice("progress:".length)));
        } else if (status === "pending") {
          setCopyProgressLabel("Queued…");
        } else if (status === "running") {
          setCopyProgressLabel("Working…");
        } else if (status === "completed") {
          setCopyProgressLabel("Done");
        } else if (status === "failed") {
          setCopyProgressLabel("Error");
        }
      } catch {
        // ignore polling errors; Debug panel has details
      }
    };
    void pollOnce();
    copyProgressPollRef.current = window.setInterval(() => {
      void pollOnce();
    }, 500);
    try {
      addLog(`🤖 Generate Copy start: project=${currentProjectId} type=${templateTypeId.toUpperCase()}`);
      const data = await fetchJson('/api/editor/projects/jobs/generate-copy', {
        method: 'POST',
        body: JSON.stringify({ projectId: currentProjectId }),
      });
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
      setSlides(nextSlides);
      slidesRef.current = nextSlides;
      if (typeof data.caption === 'string') setCaptionDraft(data.caption);
      void refreshProjectsList();
      // Auto-layout all 6 slides sequentially (queued).
      addLog(`📐 Queue live layout for slides 1–6`);
      setCopyProgressLabel("Applying layouts…");
      enqueueLiveLayout([0, 1, 2, 3, 4, 5]);
      setCopyProgressState("success");
    } catch (e: any) {
      setCopyError(e?.message || 'Generate Copy failed');
      addLog(`❌ Generate Copy failed: ${e?.message || "unknown error"}`);
      setCopyProgressState("error");
      setCopyProgressLabel("Error");
    } finally {
      setCopyGenerating(false);
      if (copyProgressPollRef.current) window.clearInterval(copyProgressPollRef.current);
      copyProgressPollRef.current = null;
      // Leave a brief success/error state so users see completion.
      copyProgressResetRef.current = window.setTimeout(() => {
        setCopyProgressState("idle");
        setCopyProgressLabel("");
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

    const headlineAvg = estimateAvgCharWidthEm(headlineFontFamily, headlineFontWeight);
    const bodyAvg = estimateAvgCharWidthEm(bodyFontFamily, bodyFontWeight);

    const { layout, meta } = wrapFlowLayout(params.headline, params.body, imageBounds, {
      ...(inset ? { contentRect: inset } : { margin: 40 }),
      clearancePx: 1,
      lineHeight: 1.2,
      headlineFontSize: 76,
      bodyFontSize: Number.isFinite(bodyFontSizePx as any) ? bodyFontSizePx : 48,
      headlineMinFontSize: 56,
      bodyMinFontSize: Math.max(10, Math.min(36, Number.isFinite(bodyFontSizePx as any) ? bodyFontSizePx : 48)),
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
      layout.textLines = layout.textLines.map((l, idx) => {
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
  }): VisionLayoutDecision | null => {
    const region = getTemplateContentRectRaw(params.templateSnapshot);
    if (!region) return null;

    const bodySize = Number.isFinite(bodyFontSizePx as any) ? Math.max(10, Math.round(bodyFontSizePx)) : 48;
    const imageUrl = (params.image as any)?.url || null;
    const prevLine = params.existingLayout?.textLines?.[0] || null;
    const preservedX = typeof prevLine?.position?.x === "number" ? prevLine.position.x : region.x;
    // For Regular we anchor Y by CENTER so the box grows up/down.
    // - If we already have an anchored snapshot, preserve it.
    // - Otherwise default to center of contentRegion (ignores old top-anchored snapshots).
    const regionCenterY = region.y + (region.height / 2);
    const preservedCenterY =
      prevLine?.positionAnchorY === "center" && typeof prevLine?.position?.y === "number"
        ? prevLine.position.y
        : regionCenterY;
    const preservedWidth = typeof prevLine?.maxWidth === "number" ? prevLine.maxWidth : region.width;

    const layout: VisionLayoutDecision = {
      canvas: { width: 1080, height: 1440 },
      margins: { top: 60, right: 60, bottom: 60, left: 60 },
      textLines: [
        {
          text: params.body || "",
          baseSize: bodySize,
          position: { x: preservedX, y: preservedCenterY },
          // Non-standard field (JSON snapshot only): used by renderer to interpret `position.y` as centerY.
          positionAnchorY: "center",
          textAlign: "left",
          lineHeight: 1.2,
          maxWidth: Math.max(1, preservedWidth),
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

  const enqueueLiveLayout = (indices: number[]) => {
    indices.forEach((i) => {
      if (i < 0 || i >= slideCount) return;
      if (!liveLayoutQueueRef.current.includes(i)) liveLayoutQueueRef.current.push(i);
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
        const slideIndex = liveLayoutQueueRef.current.shift() as number;
        const slide = slidesRef.current[slideIndex] || initSlide();
        const tid = computeTemplateIdForSlide(slideIndex);
        const snap = (tid ? templateSnapshots[tid] : null) || null;
        if (!snap) {
          addLog(`⚠️ Live layout skipped slide ${slideIndex + 1}: missing template snapshot`);
          continue;
        }

        const headline = templateTypeId === "regular" ? "" : (slide.draftHeadline || "");
        const body = slide.draftBody || "";
        if (!String(body).trim() && !String(headline).trim()) {
          addLog(`⏭️ Live layout skipped slide ${slideIndex + 1}: empty text`);
          continue;
        }

        const headlineRanges = Array.isArray(slide.draftHeadlineRanges) ? slide.draftHeadlineRanges : [];
        const bodyRanges = Array.isArray(slide.draftBodyRanges) ? slide.draftBodyRanges : [];

        addLog(
          `📐 Live layout slide ${slideIndex + 1} start: template=${tid || "none"} headlineLen=${headline.length} bodyLen=${body.length} headlineRanges=${headlineRanges.length} bodyRanges=${bodyRanges.length}`
        );

        const image = getExistingImageForSlide(slideIndex);
        const prevInput = (slide as any)?.inputData || null;
        const lineOverridesByKey =
          prevInput && typeof prevInput === "object" && prevInput.lineOverridesByKey && typeof prevInput.lineOverridesByKey === "object"
            ? prevInput.lineOverridesByKey
            : null;

        const nextLayout =
          templateTypeId === "regular"
            ? computeRegularBodyTextboxLayout({
                slideIndex,
                body,
                templateSnapshot: snap,
                image,
                existingLayout: (slide as any)?.layoutData?.layout || null,
                bodyRanges,
              })
            : computeDeterministicLayout({
                slideIndex,
                headline,
                body,
                templateSnapshot: snap,
                image,
                headlineRanges,
                bodyRanges,
                lineOverridesByKey,
              });
        if (!nextLayout) continue;

        const textLineCount = Array.isArray((nextLayout as any)?.textLines) ? (nextLayout as any).textLines.length : 0;
        const styleCount = Array.isArray((nextLayout as any)?.textLines)
          ? (nextLayout as any).textLines.reduce((acc: number, l: any) => acc + (Array.isArray(l?.styles) ? l.styles.length : 0), 0)
          : 0;
        addLog(`✅ Live layout slide ${slideIndex + 1} done: lines=${textLineCount} styles=${styleCount}`);

        const req: any = {
          headline,
          body,
          settings: {
            backgroundColor: projectBackgroundColor || "#ffffff",
            textColor: projectTextColor || "#000000",
            includeImage: false,
          },
          templateId: tid || undefined,
          headlineStyleRanges: headlineRanges,
          bodyStyleRanges: bodyRanges,
          ...(lineOverridesByKey ? { lineOverridesByKey } : {}),
        } satisfies CarouselTextRequest as any;

        const nextLayoutData = {
          success: true,
          layout: nextLayout,
          imageUrl: (image as any)?.url || (slide.layoutData as any)?.imageUrl || null,
        };

        setSlides((prev) =>
          prev.map((s, i) =>
            i !== slideIndex
              ? s
              : {
                  ...s,
                  layoutData: nextLayoutData,
                  inputData: req,
                }
          )
        );
        // Keep ref in sync (so subsequent queued slides use latest).
        slidesRef.current = slidesRef.current.map((s, i) =>
          i !== slideIndex ? s : { ...s, layoutData: nextLayoutData, inputData: req }
        );

        // If this is the active slide, also update the engine so Fabric rerenders immediately.
        if (slideIndex === activeSlideIndex) {
          setLayoutData(nextLayoutData as any);
          setInputData(req as any);
          setLayoutHistory((h) => h || []);
        }

        // Persist snapshots (debounced by layout debounce itself).
        if (currentProjectId) {
          void saveSlidePatch(slideIndex, {
            layoutSnapshot: nextLayout,
            inputSnapshot: req,
          });
        }

        // Yield to the browser between slides to keep UI responsive.
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      liveLayoutRunningRef.current = false;
    }
  };

  const scheduleLiveLayout = (slideIndex: number) => {
    const prev = liveLayoutTimeoutsRef.current[slideIndex];
    if (prev) window.clearTimeout(prev);
    liveLayoutTimeoutsRef.current[slideIndex] = window.setTimeout(() => {
      enqueueLiveLayout([slideIndex]);
    }, LIVE_LAYOUT_DEBOUNCE_MS);
  };

  const scheduleLiveLayoutAll = () => {
    if (bodyFontSizeDebounceRef.current) window.clearTimeout(bodyFontSizeDebounceRef.current);
    bodyFontSizeDebounceRef.current = window.setTimeout(() => {
      enqueueLiveLayout(Array.from({ length: slideCount }, (_, i) => i));
    }, LIVE_LAYOUT_DEBOUNCE_MS);
  };

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

  const handleRegularCanvasTextChange = (change: { lineIndex: number; x: number; y: number; maxWidth: number; text?: string }) => {
    if (templateTypeId !== "regular") return;
    const slideIndex = activeSlideIndex;
    const curSlide = slidesRef.current[slideIndex] || initSlide();
    const baseLayout: any =
      (slideIndex === activeSlideIndex ? (layoutData as any)?.layout : null) ||
      (curSlide as any)?.layoutData?.layout ||
      null;
    if (!baseLayout || !Array.isArray(baseLayout.textLines) || !baseLayout.textLines[change.lineIndex]) return;

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
    const nextLayoutSnap = { ...baseLayout, textLines: nextTextLines } as VisionLayoutDecision;

    const tid = computeTemplateIdForSlide(slideIndex);
    const nextBody = change.text !== undefined ? change.text : (curSlide.draftBody || "");
    const req: any = {
      headline: "",
      body: nextBody,
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
    regularCanvasSaveTimeoutRef.current = window.setTimeout(() => {
      void saveSlidePatch(slideIndex, {
        layoutSnapshot: nextLayoutSnap,
        inputSnapshot: req,
      });
    }, 500);
  };

  const handleEnhancedCanvasTextChange = (change: { lineIndex: number; lineKey?: string; x: number; y: number; maxWidth: number; text?: string }) => {
    if (templateTypeId !== "enhanced") return;
    if (!currentProjectId) return;
    const slideIndex = activeSlideIndex;
    const curSlide = slidesRef.current[slideIndex] || initSlide();
    const baseLayout: any =
      (slideIndex === activeSlideIndex ? (layoutData as any)?.layout : null) ||
      (curSlide as any)?.layoutData?.layout ||
      null;
    if (!baseLayout || !Array.isArray(baseLayout.textLines) || !baseLayout.textLines[change.lineIndex]) return;

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
    enhancedCanvasSaveTimeoutRef.current = window.setTimeout(() => {
      void saveSlidePatch(slideIndex, { layoutSnapshot: nextLayoutSnap, inputSnapshot: nextInputSnap });
    }, 500);
  };

  const loadTemplateTypeEffective = async (type: 'regular' | 'enhanced') => {
    addLog(`🧾 Loading template-type settings: ${type.toUpperCase()}`);
    const data = await fetchJson(`/api/editor/template-types/effective?type=${type}`);
    const effective = data?.effective;
    setTemplateTypePrompt(effective?.prompt || '');
    setTemplateTypeEmphasisPrompt(effective?.emphasisPrompt || '');
    setTemplateTypeMappingSlide1(effective?.slide1TemplateId ?? null);
    setTemplateTypeMappingSlide2to5(effective?.slide2to5TemplateId ?? null);
    setTemplateTypeMappingSlide6(effective?.slide6TemplateId ?? null);
    addLog(
      `✅ Settings loaded: promptLen=${String(effective?.prompt || "").length}, emphasisLen=${String(effective?.emphasisPrompt || "").length}`
    );
    // Reset prompt status on type switch
    setPromptSaveStatus('idle');
    promptDirtyRef.current = false;
  };

  const refreshProjectsList = async () => {
    setProjectsLoading(true);
    try {
      const data = await fetchJson('/api/editor/projects/list');
      setProjects(data.projects || []);
    } finally {
      setProjectsLoading(false);
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
      return {
        ...prev,
        savedHeadline: loadedHeadline,
        savedBody: loadedBody,
        draftHeadline: loadedHeadline,
        draftBody: loadedBody,
        draftHeadlineRanges: Array.isArray(inputSnap?.headlineStyleRanges) ? inputSnap.headlineStyleRanges : [],
        draftBodyRanges: Array.isArray(inputSnap?.bodyStyleRanges) ? inputSnap.bodyStyleRanges : [],
        layoutData: layoutSnap ? { success: true, layout: layoutSnap, imageUrl: null } : null,
        inputData: inputSnap || null,
        layoutHistory: [],
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
      return {
        ...prev,
        savedHeadline: loadedHeadline,
        savedBody: loadedBody,
        draftHeadline: loadedHeadline,
        draftBody: loadedBody,
        draftHeadlineRanges: [],
        draftBodyRanges: [],
        layoutData: null,
        inputData: null,
        layoutHistory: [],
        error: null,
        debugLogs: [],
        debugScreenshot: null,
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

  const savePromptSettings = async () => {
    // Simplified behavior: always write to global defaults (shared across editor users).
    addLog(
      `💾 Saving template-type prompts: type=${templateTypeId.toUpperCase()} promptLen=${templateTypePrompt.length} emphasisLen=${templateTypeEmphasisPrompt.length}`
    );
    await fetchJson('/api/editor/template-types/defaults/update', {
      method: 'POST',
      body: JSON.stringify({
        templateTypeId,
        defaultPrompt: templateTypePrompt,
        defaultEmphasisPrompt: templateTypeEmphasisPrompt,
        slide1TemplateId: templateTypeMappingSlide1,
        slide2to5TemplateId: templateTypeMappingSlide2to5,
        slide6TemplateId: templateTypeMappingSlide6,
      }),
    });
    addLog(`✅ Saved template-type prompts`);
  };

  // Load template type defaults + saved projects on mount/login.
  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      try {
        await loadTemplateTypeEffective(templateTypeId);
      } catch {
        // ignore
      }
      void refreshProjectsList();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load effective settings when template type changes.
  useEffect(() => {
    if (!user?.id) return;
    void loadTemplateTypeEffective(templateTypeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateTypeId, user?.id]);

  // Keep active slide's template snapshot loaded.
  useEffect(() => {
    const tid = computeTemplateIdForSlide(activeSlideIndex);
    void ensureTemplateSnapshot(tid);
    if (tid) {
      // Keep engine template selection in sync for layout endpoints.
      void loadTemplate(tid);
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

  // Mirror engine state into the active slide slot (so switching can restore instantly).
  useEffect(() => {
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== activeSlideIndex) return s;
        const next: SlideState = {
          ...s,
          layoutData,
          inputData,
          layoutHistory,
          error,
          debugLogs,
          debugScreenshot,
        };
        // If engine has inputData (load/generate), refresh drafts for convenience.
        if (inputData) {
          next.draftHeadline = inputData.headline || "";
          next.draftBody = inputData.body || "";
          next.draftBg = inputData.settings?.backgroundColor || "#ffffff";
          next.draftText = inputData.settings?.textColor || "#000000";
        }
        return next;
      })
    );
  }, [
    activeSlideIndex,
    inputData,
    layoutData,
    layoutHistory,
    error,
    debugLogs,
    debugScreenshot,
  ]);

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

    setSwitchingSlides(true);
    try {
      // Best-effort flush pending project/slide saves before switching.
      try {
        if (projectSaveTimeoutRef.current) {
          window.clearTimeout(projectSaveTimeoutRef.current);
          projectSaveTimeoutRef.current = null;
          void saveProjectMeta({ title: projectTitle, caption: captionDraft });
        }
        if (slideSaveTimeoutRef.current) {
          window.clearTimeout(slideSaveTimeoutRef.current);
          slideSaveTimeoutRef.current = null;
          const cur = slidesRef.current[activeSlideIndex] || initSlide();
          // Only flush if text is actually dirty.
          const desiredSavedHeadline = templateTypeId === "regular" ? "" : (cur.savedHeadline || "");
          const desiredSavedBody = cur.savedBody || "";
          if ((cur.draftHeadline || "") !== desiredSavedHeadline || (cur.draftBody || "") !== desiredSavedBody) {
            void (async () => {
              const ok = await saveSlidePatch(activeSlideIndex, {
                headline: templateTypeId === "regular" ? null : (cur.draftHeadline || null),
                body: cur.draftBody || null,
              });
              if (!ok) return;
              setSlides((prev) =>
                prev.map((s, i) =>
                  i !== activeSlideIndex
                    ? s
                    : { ...s, savedHeadline: templateTypeId === "regular" ? "" : (s.draftHeadline || ""), savedBody: s.draftBody || "" }
                )
              );
            })();
          }
        }
        if (layoutSaveTimeoutRef.current) {
          window.clearTimeout(layoutSaveTimeoutRef.current);
          layoutSaveTimeoutRef.current = null;
          if (layoutData?.layout && inputData && layoutDirtyRef.current) {
            void (async () => {
              const ok = await saveSlidePatch(activeSlideIndex, {
                layoutSnapshot: layoutData.layout,
                inputSnapshot: inputData,
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

      const next = slidesRef.current[nextIndex] || initSlide();
      if (next.layoutData || next.inputData) {
        setLayoutData(next.layoutData);
        setInputData(next.inputData);
        setLayoutHistory(next.layoutHistory || []);
      } else {
        handleNewCarousel();
      }
    } finally {
      setSwitchingSlides(false);
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
      <button
        className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm"
        onClick={() => {
          setSlides((prev) => prev.map((s) => ({ ...s, draftHeadline: "", draftBody: "" })));
          handleNewCarousel();
          void createNewProject(templateTypeId);
        }}
        disabled={switchingSlides}
      >
        New Project
      </button>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 uppercase">Template Type</div>
        <select
          className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
          value={templateTypeId}
          onChange={(e) => setTemplateTypeId(e.target.value === "enhanced" ? "enhanced" : "regular")}
          disabled={switchingSlides}
        >
          <option value="regular">Regular</option>
          <option value="enhanced">Enhanced</option>
        </select>
        <div className="text-xs text-slate-500">
          Slide 1: {(currentProjectId ? projectMappingSlide1 : templateTypeMappingSlide1) ? "Template set" : "Not set"} · Slides 2–5:{" "}
          {(currentProjectId ? projectMappingSlide2to5 : templateTypeMappingSlide2to5) ? "Template set" : "Not set"} · Slide 6:{" "}
          {(currentProjectId ? projectMappingSlide6 : templateTypeMappingSlide6) ? "Template set" : "Not set"}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Template Settings</div>
        <button
          className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm"
          onClick={() => setTemplateSettingsOpen(true)}
          disabled={switchingSlides}
          title="Edit template type settings"
        >
          Settings
        </button>
      </div>

      <button
        type="button"
        className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2.5 hover:bg-slate-50"
        onClick={() => {
          setPromptModalSection("prompt");
          setPromptModalOpen(true);
        }}
        title="Edit Poppy Prompt"
      >
        <div className="text-sm font-semibold text-slate-700">Poppy Prompt</div>
        <div className="mt-0.5 text-xs text-slate-500 truncate">
          {`${templateTypeId.toUpperCase()}: ${(templateTypePrompt || "").split("\n")[0] || "Click to edit..."}`}
        </div>
      </button>

      <button
        type="button"
        className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2.5 hover:bg-slate-50"
        onClick={() => {
          setPromptModalSection("emphasis");
          setPromptModalOpen(true);
        }}
        title="Edit Text Styling Prompt"
      >
        <div className="text-sm font-semibold text-slate-700">Text Styling Prompt</div>
        <div className="mt-0.5 text-xs text-slate-500 truncate">
          {`${templateTypeId.toUpperCase()}: ${(templateTypeEmphasisPrompt || "").split("\n")[0] || "Click to edit..."}`}
        </div>
      </button>

      {/* Saved projects */}
      <div className="border-t border-slate-100 pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Saved Projects</div>
          <div className="text-xs text-slate-500">{projects.length}</div>
        </div>
        <button
          onClick={() => setProjectsDropdownOpen(!projectsDropdownOpen)}
          className="w-full h-10 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm flex items-center justify-between px-3"
          disabled={projectsLoading || switchingSlides}
        >
          <span>
            {projectsLoading ? "Loading..." : "Load project…"}
          </span>
          <span className="text-slate-400">{projectsDropdownOpen ? "▴" : "▾"}</span>
        </button>

        {projectsDropdownOpen && (
          <div className="w-full bg-white border border-slate-200 rounded-md shadow-sm max-h-64 overflow-y-auto">
            {projects.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No projects yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50"
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

      {/* Typography (project-wide; canvas-only) */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div className="text-sm font-semibold text-slate-900">Fonts</div>
        <div className="space-y-2">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Headline</div>
            <select
              className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
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
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Body</div>
            <select
              className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
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

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Body Font Size (px)</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-10 w-10 rounded-md border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm disabled:opacity-50"
                onClick={() => {
                  const next = Math.max(10, Math.round((bodyFontSizePx || 48) - 1));
                  setBodyFontSizePx(next);
                  scheduleLiveLayoutAll();
                }}
                disabled={loading || switchingSlides || copyGenerating}
                aria-label="Decrease body font size"
                title="Decrease"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                className="w-28 h-10 rounded-md border border-slate-200 px-3 text-slate-900"
                value={Number.isFinite(bodyFontSizePx as any) ? bodyFontSizePx : 48}
                min={10}
                max={200}
                step={1}
                onChange={(e) => {
                  const raw = e.target.value;
                  const n = Math.round(Number(raw));
                  const next = Number.isFinite(n) ? Math.max(10, Math.min(200, n)) : 48;
                  setBodyFontSizePx(next);
                  scheduleLiveLayoutAll();
                }}
                disabled={loading || switchingSlides || copyGenerating}
              />
              <button
                type="button"
                className="h-10 w-10 rounded-md border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm disabled:opacity-50"
                onClick={() => {
                  const next = Math.min(200, Math.round((bodyFontSizePx || 48) + 1));
                  setBodyFontSizePx(next);
                  scheduleLiveLayoutAll();
                }}
                disabled={loading || switchingSlides || copyGenerating}
                aria-label="Increase body font size"
                title="Increase"
              >
                +
              </button>
              <div className="text-xs text-slate-500">
                Updates all slides
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Effects (project-wide colors) */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div className="text-sm font-semibold text-slate-900">Background Effects</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Background</div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-10 w-14 rounded-md border border-slate-200 bg-white p-1"
                value={projectBackgroundColor || "#ffffff"}
                onChange={(e) => updateProjectColors(e.target.value, projectTextColor)}
                disabled={loading || switchingSlides}
                aria-label="Background color"
              />
              <div className="text-sm text-slate-700 tabular-nums">{projectBackgroundColor || "#ffffff"}</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Text</div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-10 w-14 rounded-md border border-slate-200 bg-white p-1"
                value={projectTextColor || "#000000"}
                onChange={(e) => updateProjectColors(projectBackgroundColor, e.target.value)}
                disabled={loading || switchingSlides}
                aria-label="Text color"
              />
              <div className="text-sm text-slate-700 tabular-nums">{projectTextColor || "#000000"}</div>
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
          <div className="w-9 h-9 rounded-lg bg-slate-900" />
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
              projectSaveTimeoutRef.current = window.setTimeout(() => {
                void saveProjectMeta({ title: v });
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
          <div className="flex flex-col items-center justify-center p-3 md:p-6">
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
                                showLayoutOverlays={templateTypeId !== "regular" ? showLayoutOverlays : false}
                                headlineFontFamily={headlineFontFamily}
                                bodyFontFamily={bodyFontFamily}
                                  headlineFontWeight={headlineFontWeight}
                                  bodyFontWeight={bodyFontWeight}
                                contentPaddingPx={templateTypeId === "regular" ? 0 : 40}
                                clampUserTextToContentRect={templateTypeId !== "regular"}
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
                          showLayoutOverlays={templateTypeId !== "regular" ? showLayoutOverlays : false}
                          headlineFontFamily={headlineFontFamily}
                          bodyFontFamily={bodyFontFamily}
                            headlineFontWeight={headlineFontWeight}
                            bodyFontWeight={bodyFontWeight}
                          contentPaddingPx={templateTypeId === "regular" ? 0 : 40}
                          clampUserTextToContentRect={templateTypeId !== "regular"}
                          clampUserImageToContentRect={false}
                          pushTextOutOfUserImage={templateTypeId !== "regular"}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="w-full flex items-center gap-3">
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
                    className="flex-1 overflow-x-hidden overflow-y-visible"
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
                          {/* Per-slide image upload trigger (active slide only). */}
                          {i === activeSlideIndex && currentProjectId ? (
                            <button
                              type="button"
                              className="absolute left-2 -bottom-10 w-9 h-9 bg-transparent text-slate-900 hover:text-black disabled:opacity-40"
                              title={imageBusy ? "Working…" : "Upload image"}
                              aria-label="Upload image"
                              disabled={imageBusy || switchingSlides || copyGenerating}
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
                              <svg viewBox="0 0 24 24" className="w-9 h-9">
                                <path
                                  fill="currentColor"
                                  d="M19 15a1 1 0 0 1 1 1v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a1 1 0 1 1 2 0v3h12v-3a1 1 0 0 1 1-1ZM12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1Z"
                                />
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
                                        showLayoutOverlays={templateTypeId !== "regular" ? showLayoutOverlays : false}
                                        headlineFontFamily={headlineFontFamily}
                                        bodyFontFamily={bodyFontFamily}
                                          headlineFontWeight={headlineFontWeight}
                                          bodyFontWeight={bodyFontWeight}
                                        contentPaddingPx={templateTypeId === "regular" ? 0 : 40}
                                        clampUserTextToContentRect={templateTypeId !== "regular"}
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
                <div className="md:col-span-2 space-y-3">
                  {templateTypeId !== "regular" ? (
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1">Headline</label>
                      <RichTextInput
                        valueText={slides[activeSlideIndex]?.draftHeadline || ""}
                        valueRanges={slides[activeSlideIndex]?.draftHeadlineRanges || []}
                        onChange={(next) => {
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
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                      />
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1">Body</label>
                    <RichTextInput
                      valueText={slides[activeSlideIndex]?.draftBody || ""}
                      valueRanges={slides[activeSlideIndex]?.draftBodyRanges || []}
                      onChange={(next) => {
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
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                    />
                  </div>

                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <span>Controls</span>
                    <CopyProgressIcon />
                  </div>
                  <button
                    className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                    disabled={!currentProjectId || copyGenerating || switchingSlides}
                    onClick={() => void runGenerateCopy()}
                  >
                    {copyGenerating ? "Generating Copy..." : "Generate Copy"}
                  </button>
                  {activeImageSelected ? (
                    <>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Background removal (recommended)</div>
                            <div className="text-xs text-slate-500">
                              Improves Realign wrapping so text hugs the subject silhouette.
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
                            disabled={imageBusy || switchingSlides || copyGenerating || !currentProjectId}
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
                        <div className="mt-2 text-xs text-slate-600">
                          Status:{" "}
                          <span className="font-semibold">
                            {String((layoutData as any)?.layout?.image?.bgRemovalStatus || (((layoutData as any)?.layout?.image?.bgRemovalEnabled ?? true) ? "idle" : "disabled"))}
                          </span>
                        </div>
                        {String((layoutData as any)?.layout?.image?.bgRemovalStatus || "") === "failed" ? (
                          <button
                            type="button"
                            className="mt-2 w-full h-9 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-semibold shadow-sm disabled:opacity-50"
                            onClick={() => void setActiveSlideImageBgRemoval(true)}
                            disabled={imageBusy || switchingSlides || copyGenerating || !currentProjectId}
                            title="Try background removal again (Phase 2 will run the API call)"
                          >
                            Try again
                          </button>
                        ) : null}
                      </div>
                      <button
                        className="w-full h-10 rounded-lg border border-red-200 bg-white text-red-700 text-sm font-semibold shadow-sm disabled:opacity-50"
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
                        className="w-full h-10 rounded-lg bg-[#6D28D9] text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                        disabled={
                          loading ||
                          switchingSlides ||
                          copyGenerating ||
                          !(slides[activeSlideIndex]?.draftHeadline || "").trim() ||
                          !(slides[activeSlideIndex]?.draftBody || "").trim()
                        }
                        onClick={() => {
                          layoutDirtyRef.current = true;
                          pushUndoSnapshot();
                          enqueueLiveLayout([activeSlideIndex]);
                        }}
                      >
                        {loading ? "Generating..." : "Generate Layout"}
                      </button>

                      <div className="flex items-center gap-2">
                        <select
                          className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3"
                          value={realignmentModel}
                          onChange={(e) => setRealignmentModel(e.target.value as any)}
                          disabled={realigning || copyGenerating}
                        >
                          <option value="gemini-computational">Gemini Computational</option>
                          <option value="gemini">Gemini 3 Vision</option>
                          <option value="claude">Claude Vision</option>
                        </select>
                      </div>

                      <button
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm disabled:opacity-50"
                        onClick={() => {
                          layoutDirtyRef.current = true;
                          // Save a full snapshot BEFORE wiping overrides so Undo truly restores the prior state.
                          pushUndoSnapshot();
                          // Realign should repack line breaks like the original behavior.
                          // Wipe per-line overrides so wrap-flow can start fresh from the current text.
                          wipeLineOverridesForActiveSlide();
                          // Speed: for /editor we can do deterministic wrap-flow locally for the "Computational" option.
                          // The server realign route can be slow due to model calls (styles/vision).
                          if (realignmentModel === "gemini-computational") {
                            enqueueLiveLayout([activeSlideIndex]);
                          } else {
                            void handleRealign({ skipHistory: true });
                          }
                        }}
                        disabled={loading || realigning || !layoutData || switchingSlides || copyGenerating}
                      >
                        {realigning ? "Realigning..." : "Realign Text"}
                      </button>
                    </>
                  ) : null}
                  <button
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm disabled:opacity-50"
                    onClick={() => {
                      layoutDirtyRef.current = true;
                      handleUndo();
                    }}
                    disabled={layoutHistory.length === 0 || realigning || switchingSlides || copyGenerating}
                  >
                    Undo
                  </button>

                  {saveError && <div className="text-xs text-red-600">❌ {saveError}</div>}
                  {error && <div className="text-xs text-red-600">❌ {error}</div>}

                  {error && inputData && (
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
                      <div className="text-sm font-semibold text-red-800">Generation Failed</div>
                      <div className="text-xs text-red-700 mt-1">{error}</div>
                      <button
                        className="mt-2 w-full h-9 rounded-md bg-red-600 text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                        onClick={() => void handleRetry()}
                        disabled={!inputData || loading || switchingSlides}
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                </div>
              </div>

              {/* Caption (UI-only for now) */}
              <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Caption</div>
                  <div className="flex items-center gap-2">
                    {captionCopyStatus === "copied" ? (
                      <span className="text-xs text-emerald-700">Copied</span>
                    ) : captionCopyStatus === "error" ? (
                      <span className="text-xs text-red-600">Copy failed</span>
                    ) : null}
                    <button
                      type="button"
                      className="h-8 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm disabled:opacity-50"
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
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                  rows={3}
                  placeholder="Write a caption..."
                  value={captionDraft}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCaptionDraft(v);
                    if (projectSaveTimeoutRef.current) window.clearTimeout(projectSaveTimeoutRef.current);
                    projectSaveTimeoutRef.current = window.setTimeout(() => {
                      void saveProjectMeta({ caption: v });
                    }, 600);
                  }}
                  disabled={copyGenerating}
                />
              </div>

              <details className="mt-4 rounded-md border border-slate-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-900">
                  Debug
                </summary>
                <div className="px-3 pb-3 space-y-3">
                  {templateTypeId !== "regular" && (
                    <label className="flex items-center gap-2 text-xs text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={showLayoutOverlays}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setShowLayoutOverlays(next);
                          try {
                            addLog(`🧩 Overlays: ${next ? "ON" : "OFF"}`);
                          } catch {
                            // ignore
                          }
                        }}
                      />
                      Show layout overlays (content rect / image bounds / mask)
                    </label>
                  )}
                  {debugScreenshot && (
                    <div>
                      <button
                        className="text-xs text-violet-700 underline"
                        onClick={() => setShowDebugPreview(!showDebugPreview)}
                      >
                        {showDebugPreview ? "Hide" : "Show"} Screenshot
                      </button>
                      {showDebugPreview && (
                        <div className="mt-2 bg-white rounded border border-slate-200 p-2 overflow-auto max-h-64">
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
                    <div className="rounded border border-slate-200 bg-slate-950 p-2 max-h-64 overflow-y-auto font-mono text-[11px] text-green-300">
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
              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-900">Prompt</div>
                <textarea
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                  rows={10}
                  value={templateTypePrompt}
                  onChange={(e) => {
                    promptDirtyRef.current = true;
                    setTemplateTypePrompt(e.target.value);
                  }}
                  placeholder="Enter the prompt for this template type..."
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Slide 1 Template</div>
                  <select
                    className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                    value={templateTypeMappingSlide1 || ""}
                    onChange={(e) => {
                      promptDirtyRef.current = true;
                      setTemplateTypeMappingSlide1(e.target.value || null);
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
                      promptDirtyRef.current = true;
                      setTemplateTypeMappingSlide2to5(e.target.value || null);
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
                      promptDirtyRef.current = true;
                      setTemplateTypeMappingSlide6(e.target.value || null);
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

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Changes auto-save (shared). New projects snapshot these settings. Existing projects keep their snapshot unless recreated.
                </div>
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
                    Used for generating the 6-slide copy for this template type (shared across editor users).
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
                    Controls bold/italic/underline for scannability. It never changes characters—only formatting ranges (shared across editor users).
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


