"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./EditorShell.module.css";
import dynamic from "next/dynamic";
import { useCarouselEditorEngine } from "../components/health/marketing/ai-carousel/useCarouselEditorEngine";
import type { CarouselTextRequest, TextStyle } from "@/lib/carousel-types";
import type { VisionLayoutDecision } from "@/lib/carousel-types";
import { wrapFlowLayout } from "@/lib/wrap-flow-layout";
import TemplateEditorModal from "../components/health/marketing/ai-carousel/TemplateEditorModal";
import { supabase, useAuth } from "../components/auth/AuthContext";
import { RichTextInput, type InlineStyleRange } from "./RichTextInput";

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
        !active ? "opacity-75" : "",
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

  // Template type settings (global defaults + per-user overrides)
  const [templateTypePrompt, setTemplateTypePrompt] = useState<string>("");
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
  const promptDirtyRef = useRef(false);
  const promptSaveTimeoutRef = useRef<number | null>(null);
  const [promptSaveStatus, setPromptSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copyGenerating, setCopyGenerating] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  // Resizable left sidebar (desktop-only)
  const SIDEBAR_MIN = 320;
  const SIDEBAR_MAX = 560;
  const SIDEBAR_DEFAULT = 400;
  const [sidebarWidth, setSidebarWidth] = useState<number>(SIDEBAR_DEFAULT);
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

  // Project-wide colors (shared across all slides; affects canvas + generation).
  const [projectBackgroundColor, setProjectBackgroundColor] = useState<string>("#ffffff");
  const [projectTextColor, setProjectTextColor] = useState<string>("#000000");
  const [captionDraft, setCaptionDraft] = useState<string>("");

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

  const runGenerateCopy = async () => {
    if (!currentProjectId) {
      setCopyError('Create or load a project first.');
      return;
    }
    setCopyError(null);
    setCopyGenerating(true);
    try {
      const data = await fetchJson('/api/editor/projects/jobs/generate-copy', {
        method: 'POST',
        body: JSON.stringify({ projectId: currentProjectId }),
      });
      const slidesOut = data.slides || [];
      const nextSlides: SlideState[] = Array.from({ length: slideCount }).map((_, i) => {
        const prev = slidesRef.current[i] || initSlide();
        const out = slidesOut[i] || {};
        const nextHeadline = out.headline ?? '';
        const nextBody = out.body ?? '';
        return {
          ...prev,
          draftHeadline: nextHeadline,
          draftBody: nextBody,
          // Fresh copy should start unformatted (style ranges cleared).
          draftHeadlineRanges: [],
          draftBodyRanges: [],
          // Mark as dirty vs saved so autosave of text works, but don't show "saving" just from switching.
        };
      });
      setSlides(nextSlides);
      slidesRef.current = nextSlides;
      if (typeof data.caption === 'string') setCaptionDraft(data.caption);
      void refreshProjectsList();
      // Auto-layout all 6 slides sequentially (queued).
      enqueueLiveLayout([0, 1, 2, 3, 4, 5]);
    } catch (e: any) {
      setCopyError(e?.message || 'Generate Copy failed');
    } finally {
      setCopyGenerating(false);
    }
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
        return { ...pos, url };
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
    });

    // Apply inline style ranges (bold/italic/underline) to the computed line objects.
    if (Array.isArray(meta?.lineSources) && Array.isArray(layout?.textLines)) {
      const headlineRanges = params.headlineRanges || [];
      const bodyRanges = params.bodyRanges || [];
      layout.textLines = layout.textLines.map((l, idx) => {
        const src = meta.lineSources?.[idx];
        if (!src?.parts) return l;
        const ranges = src.block === "HEADLINE" ? headlineRanges : bodyRanges;
        return { ...l, styles: buildTextStylesForLine(src.parts, ranges) };
      });
    }

    // Preserve any existing image URL if present.
    if ((params.image as any)?.url && layout.image) {
      (layout.image as any).url = (params.image as any).url;
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
      while (liveLayoutQueueRef.current.length > 0) {
        const slideIndex = liveLayoutQueueRef.current.shift() as number;
        const slide = slidesRef.current[slideIndex] || initSlide();
        const tid = computeTemplateIdForSlide(slideIndex);
        const snap = (tid ? templateSnapshots[tid] : null) || null;
        if (!snap) continue;

        const headline = templateTypeId === "regular" ? "" : (slide.draftHeadline || "");
        const body = slide.draftBody || "";
        if (!String(body).trim() && !String(headline).trim()) {
          continue;
        }

        const headlineRanges = Array.isArray(slide.draftHeadlineRanges) ? slide.draftHeadlineRanges : [];
        const bodyRanges = Array.isArray(slide.draftBodyRanges) ? slide.draftBodyRanges : [];

        const image = getExistingImageForSlide(slideIndex);
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
              });
        if (!nextLayout) continue;

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

  const handleRegularCanvasTextChange = (change: { lineIndex: number; x: number; y: number; maxWidth: number; text?: string }) => {
    if (templateTypeId !== "regular") return;
    const slideIndex = activeSlideIndex;
    const curSlide = slidesRef.current[slideIndex] || initSlide();
    const baseLayout: any =
      (slideIndex === activeSlideIndex ? (layoutData as any)?.layout : null) ||
      (curSlide as any)?.layoutData?.layout ||
      null;
    if (!baseLayout || !Array.isArray(baseLayout.textLines) || !baseLayout.textLines[change.lineIndex]) return;

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

  const loadTemplateTypeEffective = async (type: 'regular' | 'enhanced') => {
    const data = await fetchJson(`/api/editor/template-types/effective?type=${type}`);
    const effective = data?.effective;
    setTemplateTypePrompt(effective?.prompt || '');
    setTemplateTypeMappingSlide1(effective?.slide1TemplateId ?? null);
    setTemplateTypeMappingSlide2to5(effective?.slide2to5TemplateId ?? null);
    setTemplateTypeMappingSlide6(effective?.slide6TemplateId ?? null);
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
      await fetchJson('/api/editor/projects/slides/update', {
        method: 'POST',
        body: JSON.stringify({ projectId: currentProjectId, slideIndex, ...patch }),
      });
      setSlideSaveStatus('saved');
      window.setTimeout(() => setSlideSaveStatus('idle'), 1200);
      return true;
    } catch {
      setSlideSaveStatus('error');
      window.setTimeout(() => setSlideSaveStatus('idle'), 2000);
      return false;
    }
  };

  const savePromptSettings = async () => {
    // Simplified behavior: always write to global defaults (shared across editor users).
    await fetchJson('/api/editor/template-types/defaults/update', {
      method: 'POST',
      body: JSON.stringify({
        templateTypeId,
        defaultPrompt: templateTypePrompt,
        slide1TemplateId: templateTypeMappingSlide1,
        slide2to5TemplateId: templateTypeMappingSlide2to5,
        slide6TemplateId: templateTypeMappingSlide6,
      }),
    });
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
    if (topExporting) return;
    // Reuse the same approach as ExportButton (works with the vision canvasRef handle).
    const fabricCanvas = canvasRef.current?.canvas || canvasRef.current;
    if (!fabricCanvas || typeof fabricCanvas.toDataURL !== "function") {
      alert("Canvas not ready. Please generate or load a slide first.");
      return;
    }

    setTopExporting(true);
    try {
      const currentZoom = fabricCanvas.getZoom?.() ?? 1;
      try {
        fabricCanvas.discardActiveObject?.();
      } catch {
        // ignore
      }

      // Full-res export
      fabricCanvas.setZoom?.(1);
      fabricCanvas.renderAll?.();
      await new Promise((r) => setTimeout(r, 100));

      const dataURL = fabricCanvas.toDataURL({
        format: "png",
        quality: 1.0,
        multiplier: 1,
      });

      const link = document.createElement("a");
      link.download = `carousel-${Date.now()}.png`;
      link.href = dataURL;
      link.click();

      // Restore zoom
      fabricCanvas.setZoom?.(currentZoom);
      fabricCanvas.renderAll?.();
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
      return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Prompt: Saving…</span>;
    }
    if (promptSaveStatus === "saved") {
      return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Prompt: Saved ✓</span>;
    }
    return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Prompt: Save Failed</span>;
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
          <button
            className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
            onClick={() => void handleTopDownload()}
            disabled={topExporting}
            title="Download PNG (1080×1440)"
          >
            {topExporting ? "Downloading..." : "Download"}
          </button>
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
        <aside
          className="relative bg-white border-r border-slate-200 flex flex-col shrink-0"
          style={{ width: sidebarWidth }}
        >
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

            <button
              type="button"
              className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2.5 hover:bg-slate-50"
              onClick={() => setPromptModalOpen(true)}
              title="Edit Prompt"
            >
              <div className="text-sm font-semibold text-slate-700">Prompt</div>
              <div className="mt-0.5 text-xs text-slate-500 truncate">
                {`${templateTypeId.toUpperCase()}: ${(templateTypePrompt || "").split("\n")[0] || "Click to edit..."}`}
              </div>
            </button>

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

          {/* Resize handle */}
          <div
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize"
            onPointerDown={onSidebarResizePointerDown}
            className="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-slate-200/60 active:bg-slate-300/60"
          />
        </aside>

        {/* Workspace */}
        <main className={`flex-1 min-w-0 overflow-y-auto ${styles.workspace}`}>
          {/* Slides row */}
          <div className="flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-[1400px] flex items-center gap-3">
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
                      <SlideCard index={i + 1} active={i === activeSlideIndex}>
                        <div
                          className="w-full h-full flex flex-col items-center justify-start"
                          style={i === activeSlideIndex ? undefined : { pointerEvents: "none" }}
                        >
                          {/* Scale the existing 540x720 preview down to fit 420x560 */}
                          <div
                            style={{
                              width: 420,
                              height: 560,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                transform: "scale(0.7777778)",
                                transformOrigin: "top left",
                                width: 540,
                                height: 720,
                              }}
                            >
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

                                return (
                                  <CarouselPreviewVision
                                    {...(i === activeSlideIndex ? { ref: canvasRef } : {})}
                                    layout={layoutForThisCard}
                                    backgroundColor={projectBackgroundColor}
                                    textColor={projectTextColor}
                                    templateSnapshot={snap}
                                    hasHeadline={templateTypeId !== "regular"}
                                    headlineFontFamily={headlineFontFamily}
                                    bodyFontFamily={bodyFontFamily}
                                      headlineFontWeight={headlineFontWeight}
                                      bodyFontWeight={bodyFontWeight}
                                    contentPaddingPx={templateTypeId === "regular" ? 0 : 40}
                                    clampUserTextToContentRect={templateTypeId !== "regular"}
                                    pushTextOutOfUserImage={templateTypeId !== "regular"}
                                    onUserTextChange={
                                      i === activeSlideIndex && templateTypeId === "regular"
                                        ? handleRegularCanvasTextChange
                                        : undefined
                                    }
                                  />
                                );
                              })()}
                            </div>
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
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1">
                      Body font size (px)
                    </label>
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
                        Updates all slides (debounced)
                      </div>
                    </div>
                  </div>
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
                  <div className="text-sm font-semibold text-slate-900">Controls</div>
                  <button
                    className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                    disabled={!currentProjectId || copyGenerating || switchingSlides}
                    onClick={() => void runGenerateCopy()}
                  >
                    {copyGenerating ? "Generating Copy..." : "Generate Copy"}
                  </button>
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
                          void handleRealign();
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
                <div className="text-sm font-semibold text-slate-900">Caption</div>
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

      {/* Prompt modal (quick edit) */}
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
                Prompt ({templateTypeId === "enhanced" ? "Enhanced" : "Regular"})
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
              <textarea
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                rows={18}
                value={templateTypePrompt}
                onChange={(e) => {
                  promptDirtyRef.current = true;
                  setTemplateTypePrompt(e.target.value);
                }}
                placeholder="Enter the prompt for this template type..."
                autoFocus
              />
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


