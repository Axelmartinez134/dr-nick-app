"use client";

import { createRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./EditorShell.module.css";
import dynamic from "next/dynamic";
import { useCarouselEditorEngine } from "../components/health/marketing/ai-carousel/useCarouselEditorEngine";
import type { CarouselTextRequest, TextStyle } from "@/lib/carousel-types";
import type { VisionLayoutDecision } from "@/lib/carousel-types";
import { wrapFlowLayout } from "@/lib/wrap-flow-layout";
import {
  computeDefaultUploadedImagePlacement as computeDefaultUploadedImagePlacementShared,
  getTemplateContentRectRaw as getTemplateContentRectRawShared,
} from "@/lib/templatePlacement";
import TemplateEditorModal from "../components/health/marketing/ai-carousel/TemplateEditorModal";
import { estimateAvgCharWidthEm, estimateAvgCharWidthEmRelaxed } from "../components/health/marketing/ai-carousel/fontMetrics";
import { supabase, useAuth } from "../components/auth/AuthContext";
import { RichTextInput, type InlineStyleRange } from "./RichTextInput";
import { remapRangesByDiff } from "@/lib/text-placement";
import { AdvancedLayoutControls } from "./AdvancedLayoutControls";
import { EditorSidebar } from "@/features/editor/components/EditorSidebar";
import { TemplateSettingsModal } from "@/features/editor/components/TemplateSettingsModal";
import { PromptsModal } from "@/features/editor/components/PromptsModal";
import { MobileDrawer } from "@/features/editor/components/MobileDrawer";
import { MobileSaveSlidesPanel } from "@/features/editor/components/MobileSaveSlidesPanel";
import { EditorSlidesRow } from "@/features/editor/components/EditorSlidesRow";
import { EditorTopBar } from "@/features/editor/components/EditorTopBar";
import { EditorBottomPanel } from "@/features/editor/components/EditorBottomPanel";
import { useEditorSelector, useEditorStore } from "@/features/editor/store";
import { useProjects } from "@/features/editor/hooks/useProjects";
import { useSlidePersistence } from "@/features/editor/hooks/useSlidePersistence";
import { useAutoRealignOnImageRelease } from "@/features/editor/hooks/useAutoRealignOnImageRelease";
import { useImageOps } from "@/features/editor/hooks/useImageOps";
import { useEditorBootstrap } from "@/features/editor/hooks/useEditorBootstrap";
import { useProjectLifecycle } from "@/features/editor/hooks/useProjectLifecycle";
import { useEditorPersistence } from "@/features/editor/hooks/useEditorPersistence";
import { useEditorJobs } from "@/features/editor/hooks/useEditorJobs";
import { useEditorStoreActionsSync } from "@/features/editor/hooks/useEditorStoreActionsSync";
import { useEditorStoreWorkspaceSync } from "@/features/editor/hooks/useEditorStoreWorkspaceSync";
import { useEditorStoreWorkspaceRegistry } from "@/features/editor/hooks/useEditorStoreWorkspaceRegistry";
import { useLiveLayoutQueue } from "@/features/editor/hooks/useLiveLayoutQueue";
import { useCanvasTextStyling } from "@/features/editor/hooks/useCanvasTextStyling";
import { useActiveImageSelection } from "@/features/editor/hooks/useActiveImageSelection";
import { useCanvasExport } from "@/features/editor/hooks/useCanvasExport";
import { useSlidesViewport } from "@/features/editor/hooks/useSlidesViewport";
import { useMultiCanvasRefs } from "@/features/editor/hooks/useMultiCanvasRefs";
import {
  type SlideState,
  initSlide,
  getLayoutLockedFromInput,
  withLayoutLockedInInput,
  getAutoRealignOnImageReleaseFromInput,
  withAutoRealignOnImageReleaseInInput,
} from "@/features/editor/state";

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
export default function EditorShell() {
  const { user, signOut } = useAuth();
  const editorStore = useEditorStore();
  const slideCount = 6;
  // Phase 5A: store-owned identity + navigation
  const activeSlideIndex = useEditorSelector((s) => (Number.isFinite(s.activeSlideIndex as any) ? Number(s.activeSlideIndex) : 0));
  const setActiveSlideIndex = useCallback((next: number) => {
    editorStore.setState({ activeSlideIndex: next } as any);
  }, [editorStore]);

  const switchingSlides = useEditorSelector((s) => !!s.switchingSlides);
  const setSwitchingSlides = useCallback((next: boolean) => {
    editorStore.setState({ switchingSlides: next, projectTitleDisabled: next } as any);
  }, [editorStore]);

  const topExporting = useEditorSelector((s) => !!s.topExporting);
  const setTopExporting = useCallback((next: boolean) => {
    editorStore.setState({ topExporting: next } as any);
  }, [editorStore]);

  const currentProjectId = useEditorSelector((s) => (s.currentProjectId ? String(s.currentProjectId) : null));
  const setCurrentProjectId = useCallback((next: string | null) => {
    editorStore.setState({ currentProjectId: next } as any);
  }, [editorStore]);

  const projectTitle = useEditorSelector((s) => String(s.projectTitle || ""));
  const setProjectTitle = useCallback((next: string) => {
    editorStore.setState({ projectTitle: next } as any);
  }, [editorStore]);
  const templateTypeId = useEditorSelector((s) => (s.templateTypeId === "enhanced" ? "enhanced" : "regular"));
  const setTemplateTypeId = useCallback((next: "regular" | "enhanced") => {
    editorStore.setState({ templateTypeId: next } as any);
  }, [editorStore]);
  const templateTypeIdRef = useRef<"regular" | "enhanced">(templateTypeId);
  useEffect(() => {
    templateTypeIdRef.current = templateTypeId;
  }, [templateTypeId]);
  // UX: Template Type is chosen ONLY when creating a new project (never mutates an existing project).
  // Defaults to Enhanced on each /editor load.
  const newProjectTemplateTypeId = useEditorSelector((s) => (s.newProjectTemplateTypeId === "regular" ? "regular" : "enhanced"));
  const setNewProjectTemplateTypeId = useCallback((next: "regular" | "enhanced") => {
    editorStore.setState({ newProjectTemplateTypeId: next } as any);
  }, [editorStore]);
  const projectSaveStatus = useEditorSelector((s) => (s.projectSaveStatus as any) || "idle");
  const setProjectSaveStatus = useCallback((next: "idle" | "saving" | "saved" | "error") => {
    editorStore.setState({ projectSaveStatus: next } as any);
  }, [editorStore]);
  const projectSaveTimeoutRef = useRef<number | null>(null);
  const slideSaveStatus = useEditorSelector((s) => (s.slideSaveStatus as any) || "idle");
  const setSlideSaveStatus = useCallback((next: "idle" | "saving" | "saved" | "error") => {
    editorStore.setState({ slideSaveStatus: next } as any);
  }, [editorStore]);
  const layoutDirtyRef = useRef(false);
  const LIVE_LAYOUT_DEBOUNCE_MS = 500;

  // Phase 5B: store-owned modals + prompt/mapping UI state
  const templateSettingsOpen = useEditorSelector((s) => !!s.templateSettingsOpen);
  const setTemplateSettingsOpen = useCallback((next: boolean) => {
    editorStore.setState({ templateSettingsOpen: next } as any);
  }, [editorStore]);

  const promptModalOpen = useEditorSelector((s) => !!s.promptModalOpen);
  const setPromptModalOpen = useCallback((next: boolean) => {
    editorStore.setState({ promptModalOpen: next } as any);
  }, [editorStore]);

  const promptModalSection = useEditorSelector((s) => (s.promptModalSection === "emphasis" || s.promptModalSection === "image" ? s.promptModalSection : "prompt"));
  const setPromptModalSection = useCallback((next: "prompt" | "emphasis" | "image") => {
    editorStore.setState({ promptModalSection: next } as any);
  }, [editorStore]);

  const templateTypePrompt = useEditorSelector((s) => String(s.templateTypePrompt || ""));
  const setTemplateTypePrompt = useCallback((next: string) => {
    editorStore.setState({
      templateTypePrompt: next,
      templateTypePromptPreviewLine: String(next || "").split("\n")[0] || "",
    } as any);
  }, [editorStore]);

  const templateTypeEmphasisPrompt = useEditorSelector((s) => String(s.templateTypeEmphasisPrompt || ""));
  const setTemplateTypeEmphasisPrompt = useCallback((next: string) => {
    editorStore.setState({
      templateTypeEmphasisPrompt: next,
      templateTypeEmphasisPromptPreviewLine: String(next || "").split("\n")[0] || "",
    } as any);
  }, [editorStore]);

  const templateTypeImageGenPrompt = useEditorSelector((s) => String(s.templateTypeImageGenPrompt || ""));
  const setTemplateTypeImageGenPrompt = useCallback((next: string) => {
    editorStore.setState({
      templateTypeImageGenPrompt: next,
      templateTypeImageGenPromptPreviewLine: String(next || "").split("\n")[0] || "",
    } as any);
  }, [editorStore]);

  const templateTypeMappingSlide1 = useEditorSelector((s) => (s.templateTypeMappingSlide1 ? String(s.templateTypeMappingSlide1) : null));
  const setTemplateTypeMappingSlide1 = useCallback((next: string | null) => {
    editorStore.setState({ templateTypeMappingSlide1: next } as any);
  }, [editorStore]);

  const templateTypeMappingSlide2to5 = useEditorSelector((s) => (s.templateTypeMappingSlide2to5 ? String(s.templateTypeMappingSlide2to5) : null));
  const setTemplateTypeMappingSlide2to5 = useCallback((next: string | null) => {
    editorStore.setState({ templateTypeMappingSlide2to5: next } as any);
  }, [editorStore]);

  const templateTypeMappingSlide6 = useEditorSelector((s) => (s.templateTypeMappingSlide6 ? String(s.templateTypeMappingSlide6) : null));
  const setTemplateTypeMappingSlide6 = useCallback((next: string | null) => {
    editorStore.setState({ templateTypeMappingSlide6: next } as any);
  }, [editorStore]);

  // Phase 5C: store-owned Saved Projects dropdown + archive modal state
  const projectsDropdownOpen = useEditorSelector((s) => !!s.projectsDropdownOpen);
  const setProjectsDropdownOpen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    editorStore.setState((prev: any) => {
      const prevOpen = !!prev.projectsDropdownOpen;
      const open = typeof next === "function" ? !!(next as any)(prevOpen) : !!next;
      return { projectsDropdownOpen: open } as any;
    });
  }, [editorStore]);

  const archiveProjectModalOpen = useEditorSelector((s) => !!s.archiveProjectModalOpen);
  const setArchiveProjectModalOpen = useCallback((next: boolean) => {
    editorStore.setState({ archiveProjectModalOpen: next } as any);
  }, [editorStore]);

  const archiveProjectTarget = useEditorSelector((s) => (s.archiveProjectTarget ? (s.archiveProjectTarget as any) : null));
  const setArchiveProjectTarget = useCallback((next: { id: string; title: string } | null) => {
    editorStore.setState({ archiveProjectTarget: next } as any);
  }, [editorStore]);

  const archiveProjectBusy = useEditorSelector((s) => !!s.archiveProjectBusy);
  const setArchiveProjectBusy = useCallback((next: boolean) => {
    editorStore.setState({ archiveProjectBusy: next } as any);
  }, [editorStore]);
  // Stage 4B: live layout queue is extracted; layout compute fns are provided via refs to avoid TDZ ordering issues.
  const computeDeterministicLayoutRef = useRef<((params: any) => any) | null>(null);
  const computeRegularBodyTextboxLayoutRef = useRef<((params: any) => any) | null>(null);
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
  const { activeCanvasNonce, setActiveCanvasNonce, lastActiveFabricCanvasRef, slideCanvasRefs, slideRefs } =
    useMultiCanvasRefs({ slideCount });
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

  const isPunctuationWhitespaceOnly = (s: string) => {
    // Allowed punctuation set from spec + whitespace
    return /^[\s.,!?;:'"()[\]{}\-—…]*$/u.test(String(s || ""));
  };

  const isPunctuationOnlyChange = (prev: string, next: string) => {
    const a = String(prev || "");
    const b = String(next || "");
    // Letters/digits must remain identical; only punctuation/whitespace can change.
    const aAlnum = a.replace(/[^0-9A-Za-z]/g, "");
    const bAlnum = b.replace(/[^0-9A-Za-z]/g, "");
    if (aAlnum !== bAlnum) return false;
    // Any non-alnum chars must be within the allowed punctuation set + whitespace.
    const aNon = a.replace(/[0-9A-Za-z]/g, "");
    const bNon = b.replace(/[0-9A-Za-z]/g, "");
    return isPunctuationWhitespaceOnly(aNon) && isPunctuationWhitespaceOnly(bNon);
  };

  const rangesEqual = (a: InlineStyleRange[], b: InlineStyleRange[]) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const x: any = a[i];
      const y: any = b[i];
      if (!x || !y) return false;
      if (Number(x.start) !== Number(y.start)) return false;
      if (Number(x.end) !== Number(y.end)) return false;
      if (!!x.bold !== !!y.bold) return false;
      if (!!x.italic !== !!y.italic) return false;
      if (!!x.underline !== !!y.underline) return false;
    }
    return true;
  };

  const applyMarkToRanges = (params: {
    textLen: number;
    existing: InlineStyleRange[];
    segments: Array<{ start: number; end: number }>;
    mark: "bold" | "italic" | "underline";
    enabled: boolean;
  }): InlineStyleRange[] => {
    const textLen = Math.max(0, Math.floor(Number(params.textLen) || 0));
    const existing = Array.isArray(params.existing) ? params.existing : [];
    const segs = (Array.isArray(params.segments) ? params.segments : [])
      .map((s) => ({ start: Math.max(0, Math.min(textLen, Math.floor(Number(s.start) || 0))), end: Math.max(0, Math.min(textLen, Math.floor(Number(s.end) || 0))) }))
      .filter((s) => s.end > s.start);
    if (!segs.length) return existing;

    const points = new Set<number>([0, textLen]);
    for (const r of existing) {
      const a = Math.max(0, Math.min(textLen, Math.floor(Number((r as any).start) || 0)));
      const b = Math.max(0, Math.min(textLen, Math.floor(Number((r as any).end) || 0)));
      if (b > a) {
        points.add(a);
        points.add(b);
      }
    }
    for (const s of segs) {
      points.add(s.start);
      points.add(s.end);
    }
    const sorted = Array.from(points).sort((a, b) => a - b);

    const overlapsAnySeg = (a: number, b: number) => segs.some((s) => Math.min(b, s.end) > Math.max(a, s.start));
    const marksForInterval = (a: number, b: number) => {
      const active = existing.filter((r) => {
        const rs = Number((r as any).start ?? -1);
        const re = Number((r as any).end ?? -1);
        return re > a && rs < b;
      });
      return {
        bold: active.some((r: any) => !!r.bold),
        italic: active.some((r: any) => !!r.italic),
        underline: active.some((r: any) => !!r.underline),
      };
    };

    const out: InlineStyleRange[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      if (b <= a) continue;
      const marks = marksForInterval(a, b);
      if (overlapsAnySeg(a, b)) {
        (marks as any)[params.mark] = params.enabled;
      }
      if (marks.bold || marks.italic || marks.underline) {
        out.push({
          start: a,
          end: b,
          bold: marks.bold || undefined,
          italic: marks.italic || undefined,
          underline: marks.underline || undefined,
        });
      }
    }
    // Merge adjacent identical marks
    const merged: InlineStyleRange[] = [];
    const same = (x: InlineStyleRange, y: InlineStyleRange) =>
      !!x.bold === !!y.bold && !!x.italic === !!y.italic && !!x.underline === !!y.underline;
    for (const r of out) {
      const prev = merged[merged.length - 1];
      if (prev && same(prev, r) && r.start <= prev.end) {
        prev.end = Math.max(prev.end, r.end);
        continue;
      }
      merged.push({ ...r });
    }
    return merged;
  };

  const mapLineSelectionToSourceSegments = (params: {
    parts: Array<{ lineStart: number; lineEnd: number; sourceStart: number; sourceEnd: number }>;
    selectionStart: number;
    selectionEnd: number;
  }): Array<{ start: number; end: number }> => {
    const selA = Math.max(0, Math.floor(Number(params.selectionStart) || 0));
    const selB = Math.max(0, Math.floor(Number(params.selectionEnd) || 0));
    const a = Math.min(selA, selB);
    const b = Math.max(selA, selB);
    const out: Array<{ start: number; end: number }> = [];
    const parts = Array.isArray(params.parts) ? params.parts : [];
    for (const p of parts) {
      const ls = Number((p as any).lineStart ?? -1);
      const le = Number((p as any).lineEnd ?? -1);
      const ss = Number((p as any).sourceStart ?? -1);
      if (!Number.isFinite(ls) || !Number.isFinite(le) || !Number.isFinite(ss)) continue;
      const ovA = Math.max(a, ls);
      const ovB = Math.min(b, le);
      if (ovB <= ovA) continue;
      const srcA = ss + (ovA - ls);
      const srcB = ss + (ovB - ls);
      out.push({ start: srcA, end: srcB });
    }
    return out;
  };

  // NOTE: applyInlineStyleFromCanvas is defined after engine state is available.

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

  // Current project snapshots (so projects don't morph unexpectedly)
  const [projectPromptSnapshot, setProjectPromptSnapshot] = useState<string>("");
  const [projectMappingSlide1, setProjectMappingSlide1] = useState<string | null>(null);
  const [projectMappingSlide2to5, setProjectMappingSlide2to5] = useState<string | null>(null);
  const [projectMappingSlide6, setProjectMappingSlide6] = useState<string | null>(null);
  const [templateSnapshots, setTemplateSnapshots] = useState<Record<string, any>>({});

  const promptDirtyRef = useRef(false);
  const promptSaveTimeoutRef = useRef<number | null>(null);
  const promptSaveStatus = useEditorSelector((s) => (s.promptSaveStatus as any) || "idle");
  const setPromptSaveStatus = useCallback((next: "idle" | "saving" | "saved" | "error") => {
    editorStore.setState({ promptSaveStatus: next } as any);
  }, [editorStore]);
  // Long-running generation jobs are extracted into dedicated hooks (Section 7).
  const [aiImagePromptSaveStatus, setAiImagePromptSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Shared key helper (also used by image operations / BG removal state).
  const aiKey = (projectId: string, slideIndex: number) => `${projectId}:${slideIndex}`;

  // Phase 3A: image operations (upload/delete/bg-removal) need runId guards too,
  // so stale completions don't overwrite newer image state for the same project+slide.
  const imageOpRunIdByKeyRef = useRef<Record<string, number>>({});
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { viewportWidth, isMobile, VIEWPORT_PAD, totalW, translateX } = useSlidesViewport({ viewportRef, slideCount, activeSlideIndex });
  useEffect(() => {
    editorStore.setState({ isMobile: !!isMobile } as any);
  }, [editorStore, isMobile]);
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

  // Phase 5E: move core store fields to direct ownership (no giant mirroring effect needed).
  useEffect(() => {
    editorStore.setState(
      {
        loading: !!loading,
        loadingTemplates: !!loadingTemplates,
        templates: (Array.isArray(templates) ? templates : []).map((t: any) => ({
          id: String(t?.id || ""),
          name: String(t?.name || ""),
        })),
        fontOptions: FONT_OPTIONS,
        headlineFontKey: fontKey(headlineFontFamily, headlineFontWeight),
        bodyFontKey: fontKey(bodyFontFamily, bodyFontWeight),
      } as any
    );
  }, [editorStore, loading, loadingTemplates, templates, FONT_OPTIONS, headlineFontFamily, headlineFontWeight, bodyFontFamily, bodyFontWeight]);

  useActiveImageSelection({
    canvasRef,
    activeSlideIndex,
    activeCanvasNonce,
    activeLayout: (layoutData as any)?.layout,
    setActiveImageSelected,
  });

  // Global diagnostics: capture any uncaught errors/rejections so the Debug panel isn't "silent"
  // when the editor appears blank.
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      try {
        const msg = String(ev?.message || 'Unknown error');
        const file = String((ev as any)?.filename || '');
        addLog(`❌ Window error: ${msg}${file ? ` (${file})` : ''}`);
      } catch {
        // ignore
      }
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      try {
        const reason = (ev as any)?.reason;
        const msg = reason instanceof Error ? reason.message : String(reason || 'Unknown rejection');
        addLog(`❌ Unhandled promise rejection: ${msg}`);
      } catch {
        // ignore
      }
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [addLog]);

  // Undo snapshots should restore BOTH layout and underlying text/styling state.
  // We push snapshots only for explicit layout actions (Generate Layout / Realign),
  // not for background live-layout as you type.
  const pushUndoSnapshot = useCallback(() => {
    if (!layoutData || !inputData) return;
    setLayoutHistory((prev) => [...(prev || []), { layoutData, inputData }]);
  }, [inputData, layoutData, setLayoutHistory]);

  const applyInlineStyleFromCanvas = (args: {
    lineKey?: string;
    lineIndex?: number;
    block?: "HEADLINE" | "BODY";
    selectionStart: number;
    selectionEnd: number;
    mark: "bold" | "italic" | "underline";
    enabled: boolean;
    // If true, do NOT update engine layout/input state immediately (prevents Fabric editing from exiting).
    preserveCanvasEditing?: boolean;
  }) => {
    if (!currentProjectId) return;
    const slideIndex = activeSlideIndexRef.current;
    const curSlide = slidesRef.current[slideIndex] || initSlide();
    const block: "HEADLINE" | "BODY" = args.block === "HEADLINE" ? "HEADLINE" : "BODY";

    const baseLayout =
      (slideIndex === activeSlideIndexRef.current ? (layoutData as any)?.layout : null) ||
      (curSlide as any)?.layoutData?.layout ||
      null;
    const baseInput =
      (slideIndex === activeSlideIndexRef.current ? (inputData as any) : null) ||
      (curSlide as any)?.inputData ||
      null;
    if (!baseLayout || !Array.isArray((baseLayout as any).textLines)) return;

    const lines = (baseLayout as any).textLines as any[];
    const line =
      (args.lineKey ? lines.find((l) => String((l as any)?.lineKey || "") === String(args.lineKey)) : null) ||
      (Number.isFinite(args.lineIndex as any) ? lines[Number(args.lineIndex)] : null) ||
      null;
    if (!line) return;
    const parts = Array.isArray((line as any).__sourceParts) ? (line as any).__sourceParts : null;
    if (!parts) return;

    const segs = mapLineSelectionToSourceSegments({
      parts,
      selectionStart: args.selectionStart,
      selectionEnd: args.selectionEnd,
    });
    if (!segs.length) return;

    // IMPORTANT: __sourceParts typically map only the "word" spans, not the inter-word spaces.
    // If the user highlights a whole phrase, we want the mark to apply across the entire
    // contiguous selection including spaces. So we expand to one contiguous source span.
    const segMin = Math.min(...segs.map((s) => Number(s.start)));
    const segMax = Math.max(...segs.map((s) => Number(s.end)));
    const mergedSegs = [{ start: segMin, end: segMax }].filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);
    if (!mergedSegs.length) return;

    const headlineText = String(curSlide.draftHeadline || "");
    const bodyText = String(curSlide.draftBody || "");
    const headlineRanges = Array.isArray(curSlide.draftHeadlineRanges) ? curSlide.draftHeadlineRanges : [];
    const bodyRanges = Array.isArray(curSlide.draftBodyRanges) ? curSlide.draftBodyRanges : [];

    const nextHeadlineRanges =
      block === "HEADLINE"
        ? applyMarkToRanges({ textLen: headlineText.length, existing: headlineRanges, segments: mergedSegs, mark: args.mark, enabled: args.enabled })
        : headlineRanges;
    const nextBodyRanges =
      block === "BODY"
        ? applyMarkToRanges({ textLen: bodyText.length, existing: bodyRanges, segments: mergedSegs, mark: args.mark, enabled: args.enabled })
        : bodyRanges;

    const nextInput = {
      ...(baseInput && typeof baseInput === "object" ? baseInput : {}),
      headline: headlineText,
      body: bodyText,
      headlineStyleRanges: nextHeadlineRanges,
      bodyStyleRanges: nextBodyRanges,
    };

    const nextLayout = {
      ...(baseLayout as any),
      textLines: lines.map((l: any) => {
        const p = Array.isArray(l?.__sourceParts) ? l.__sourceParts : null;
        if (!p) return l;
        const blk = String(l?.block || "").toUpperCase() === "HEADLINE" ? "HEADLINE" : "BODY";
        const ranges = blk === "HEADLINE" ? nextHeadlineRanges : nextBodyRanges;
        return { ...l, styles: buildTextStylesForLine(p, ranges) };
      }),
    };

    const nextLayoutData = { success: true, layout: nextLayout, imageUrl: (layoutData as any)?.imageUrl || null } as any;

    // Always update the ref so background jobs / persistence sees latest ranges.
    slidesRef.current = slidesRef.current.map((s, i) =>
      i !== slideIndex
        ? s
        : ({
            ...s,
            draftHeadlineRanges: nextHeadlineRanges,
            draftBodyRanges: nextBodyRanges,
            layoutData: nextLayoutData,
            inputData: nextInput,
          } as any)
    );

    // IMPORTANT: while Fabric is actively editing text, updating the engine/layout props
    // can cause a re-render that recreates text objects and exits editing/selection.
    // So we defer UI/engine updates until editing is done, but still persist snapshots.
    if (!args.preserveCanvasEditing) {
      setSlides((prev) =>
        prev.map((s, i) =>
          i !== slideIndex
            ? s
            : ({
                ...s,
                draftHeadlineRanges: nextHeadlineRanges,
                draftBodyRanges: nextBodyRanges,
                layoutData: nextLayoutData,
                inputData: nextInput,
              } as any)
        )
      );
      if (slideIndex === activeSlideIndexRef.current) {
        setLayoutData(nextLayoutData);
        setInputData(nextInput as any);
      }
    }

    schedulePersistLayoutAndInput({
      projectId: currentProjectIdRef.current,
      slideIndex,
      layoutSnapshot: nextLayout,
      inputSnapshot: nextInput,
    });
  };

  // Project-wide colors (shared across all slides; affects canvas + generation).
  const [projectBackgroundColor, setProjectBackgroundColor] = useState<string>("#ffffff");
  const [projectTextColor, setProjectTextColor] = useState<string>("#000000");
  useEffect(() => {
    editorStore.setState({ projectBackgroundColor, projectTextColor } as any);
  }, [editorStore, projectBackgroundColor, projectTextColor]);
  const [captionDraft, setCaptionDraft] = useState<string>("");
  const [captionCopyStatus, setCaptionCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [showLayoutOverlays, setShowLayoutOverlays] = useState(false);
  const [showAdvancedLayoutControls, setShowAdvancedLayoutControls] = useState(false);

  const { canvasTextSelection, applyCanvasInlineMark, clearCanvasInlineMarks } = useCanvasTextStyling({
    canvasRef,
    activeSlideIndex,
    currentProjectId,
    activeCanvasNonce,
    applyInlineStyleFromCanvas,
  });

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
  const enhancedLockOn = templateTypeId === "enhanced" && !!slides[activeSlideIndex]?.layoutLocked;

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
    const projectIdAtSchedule = currentProjectId;
    const slideIndexAtSchedule = activeSlideIndex;
    const typeAtSchedule = templateTypeId;
    const headlineAtSchedule = activeDraftHeadline;
    const bodyAtSchedule = activeDraftBody;
    const headlineVal = typeAtSchedule === "regular" ? null : (headlineAtSchedule || null);
    scheduleDebouncedSlideTextSave({
      projectId: projectIdAtSchedule,
      slideIndex: slideIndexAtSchedule,
      debounceMs: 600,
      patch: { headline: headlineVal, body: bodyAtSchedule || null },
      onSuccess: () => {
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
      },
    });
    return () => {
      cancelPendingSlideTextSave();
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
    const projectIdAtSchedule = currentProjectId;
    const slideIndexAtSchedule = activeSlideIndex;
    const promptAtSchedule = activeDraftAiImagePrompt;
    scheduleDebouncedAiPromptSave({
      projectId: projectIdAtSchedule,
      slideIndex: slideIndexAtSchedule,
      debounceMs: 600,
      prompt: promptAtSchedule,
      onComplete: (ok) => {
        if (!ok) return;
        // Only update visible UI state if we're still viewing that project.
        if (currentProjectIdRef.current !== projectIdAtSchedule) return;
        setSlides((prev) =>
          prev.map((s, i) => (i !== slideIndexAtSchedule ? s : { ...s, savedAiImagePrompt: promptAtSchedule }))
        );
        setAiImagePromptSaveStatus("saved");
        window.setTimeout(() => setAiImagePromptSaveStatus("idle"), 1200);
      },
    });
    return () => {
      cancelPendingAiPromptSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, activeSlideIndex, activeDraftAiImagePrompt, templateTypeId, switchingSlides]);

  // Persist layout snapshots only when an explicit layout action happened (Generate Layout / Realign / Undo).
  useEffect(() => {
    if (!currentProjectId) return;
    if (switchingSlides) return;
    if (!layoutDirtyRef.current) return;
    if (!layoutData?.layout || !inputData) return;

    const projectIdAtSchedule = currentProjectId;
    const slideIndexAtSchedule = activeSlideIndex;
    const layoutAtSchedule = layoutData.layout;
    const inputAtSchedule = inputData;
    scheduleDebouncedLayoutPersist({
      projectId: projectIdAtSchedule,
      slideIndex: slideIndexAtSchedule,
      debounceMs: 400,
      layoutSnapshot: layoutAtSchedule,
      inputSnapshot: inputAtSchedule,
      onSaved: () => {
        layoutDirtyRef.current = false;
      },
    });

    return () => {
      cancelPendingLayoutPersist();
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

  const refreshProjectsListRef = useRef<null | (() => Promise<void>)>(null);
  const { loadProject, createNewProject } = useProjectLifecycle({
    fetchJson,
    slideCount,
    initSlide,
    slidesRef,
    setSlides,
    setActiveSlideIndex,
    setCurrentProjectId,
    setProjectTitle,
    setTemplateTypeId,
    setCaptionDraft,
    setProjectPromptSnapshot,
    setProjectMappingSlide1,
    setProjectMappingSlide2to5,
    setProjectMappingSlide6,
    setProjectsDropdownOpen,
    setLayoutData,
    setInputData,
    setLayoutHistory,
    handleNewCarousel,
    getLayoutLockedFromInput,
    getAutoRealignOnImageReleaseFromInput,
    refreshProjectsListRef,
  });

  const {
    saveProjectMeta,
    saveProjectMetaForProject,
    scheduleDebouncedProjectTitleSave,
    scheduleDebouncedCaptionSave,
  } = useEditorPersistence({
    fetchJson,
    currentProjectId,
    setProjectSaveStatus,
    projectSaveTimeoutRef,
  });

  const { projects, projectsLoading, hydrateProjects, refreshProjectsList, archiveProjectById: archiveProjectByIdCore } =
    useProjects({
      fetchJson,
      addLog,
      currentProjectIdRef,
      onLoadProject: async (projectId: string) => {
        await loadProject(projectId);
      },
      onCreateNewEnhancedProject: async () => {
        await createNewProject("enhanced");
      },
    });
  useEffect(() => {
    editorStore.setState({ projects, projectsLoading } as any);
  }, [editorStore, projects, projectsLoading]);
  // Make refresh available to project lifecycle without creating a circular hook dependency.
  refreshProjectsListRef.current = refreshProjectsList;

  const {
    saveSlidePatchForProject,
    saveSlideAiImagePromptForProject: saveSlideAiImagePromptForProjectCore,
    scheduleDebouncedSlideTextSave,
    scheduleDebouncedLayoutPersist,
    scheduleDebouncedAiPromptSave,
    schedulePersistLayoutAndInputNoReflow,
    hasPendingSlideTextSave,
    cancelPendingSlideTextSave,
    hasPendingLayoutPersist,
    cancelPendingLayoutPersist,
    hasPendingAiPromptSave,
    cancelPendingAiPromptSave,
  } = useSlidePersistence({
    fetchJson,
    addLog,
    setSlideSaveStatus,
    currentProjectIdRef,
  });

  const { scheduleAutoRealignAfterRelease } = useAutoRealignOnImageRelease({
    currentProjectIdRef,
    activeSlideIndexRef,
  });

  useEditorBootstrap({
    userId: user?.id || null,
    templateTypeId,
    templateTypeIdRef,
    fetchJson,
    addLog,
    setTemplates,
    setTemplateSnapshots,
    hydrateProjects,
    loadProject,
    createNewProject,
    setTemplateTypePrompt,
    setTemplateTypeEmphasisPrompt,
    setTemplateTypeImageGenPrompt,
    setTemplateTypeMappingSlide1,
    setTemplateTypeMappingSlide2to5,
    setTemplateTypeMappingSlide6,
    promptDirtyRef,
    setPromptSaveStatus,
    editorBootstrapDoneRef,
    initialProjectAutoLoadDoneRef,
    initialTemplateTypeLoadDoneRef,
    lastLoadedTemplateTypeIdRef,
    loadTemplatesList,
    loadTemplateTypeEffective,
    refreshProjectsList,
  });

  // NOTE: image operations + image-move persistence live in `useImageOps`.

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

  const getTemplateContentRectRaw = getTemplateContentRectRawShared;

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
        // Persist minimal source mapping so we can update inline styles without reflow (Lock Layout feature).
        // `__sourceParts` mirrors wrap-flow's `parts` and maps this line's text back to [sourceStart,sourceEnd) spans
        // of the original block string.
        const parts = Array.isArray((src as any)?.parts) ? (src as any).parts : [];
        const hintStart =
          parts && parts.length > 0 && Number.isFinite(Number((parts[0] as any)?.sourceStart ?? NaN))
            ? Number((parts[0] as any).sourceStart)
            : undefined;
        let next: any = { ...l, lineKey: key, block: src?.block || "BODY", __sourceParts: parts };
        if (typeof hintStart === "number") next.__hintStart = hintStart;

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
  computeDeterministicLayoutRef.current = computeDeterministicLayout;

  const applyInlineStylesToExistingLayout = (params: {
    layout: any;
    headlineRanges: InlineStyleRange[];
    bodyRanges: InlineStyleRange[];
  }): { layout: any; canApply: boolean } => {
    const { layout, headlineRanges, bodyRanges } = params;
    if (!layout || !Array.isArray(layout.textLines)) return { layout, canApply: false };
    let ok = true;
    const nextLines = layout.textLines.map((l: any) => {
      const parts = Array.isArray(l?.__sourceParts) ? l.__sourceParts : null;
      if (!parts) {
        ok = false;
        return l;
      }
      const block = String(l?.block || "").toUpperCase() === "HEADLINE" ? "HEADLINE" : "BODY";
      const ranges = block === "HEADLINE" ? headlineRanges : bodyRanges;
      return { ...l, styles: buildTextStylesForLine(parts, ranges) };
    });
    return { layout: { ...layout, textLines: nextLines }, canApply: ok };
  };

  type FixedWrapToken =
    | { kind: "word"; text: string; start: number; end: number }
    | { kind: "break"; start: number; end: number };

  const tokenizeFixedWrap = (text: string): FixedWrapToken[] => {
    const s = String(text || "");
    const out: FixedWrapToken[] = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i]!;
      if (ch === "\n") {
        out.push({ kind: "break", start: i, end: i + 1 });
        i += 1;
        continue;
      }
      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < s.length && !/\s/.test(s[j]!) && s[j] !== "\n") j += 1;
      out.push({ kind: "word", text: s.slice(i, j), start: i, end: j });
      i = j;
    }
    return out;
  };

  const takeLineFixed = (tokens: FixedWrapToken[], idx: number, maxChars: number) => {
    if (idx >= tokens.length) return { line: "", consumed: 0, parts: [] as any[] };
    if (tokens[idx]?.kind === "break") {
      return { line: "", consumed: 1, parts: [] as any[] };
    }
    let line = "";
    let consumed = 0;
    const parts: Array<{ lineStart: number; lineEnd: number; sourceStart: number; sourceEnd: number }> = [];
    for (let i = idx; i < tokens.length; i++) {
      const t = tokens[i]!;
      if (t.kind === "break") break;
      const next = line ? `${line} ${t.text}` : t.text;
      if (!Number.isFinite(maxChars as any) || next.length <= maxChars) {
        const startPos = line ? line.length + 1 : 0;
        line = next;
        parts.push({ lineStart: startPos, lineEnd: startPos + t.text.length, sourceStart: t.start, sourceEnd: t.end });
        consumed++;
        continue;
      }
      break;
    }
    // IMPORTANT for Lock Layout: never truncate with ellipsis.
    // If a single word doesn't fit in maxChars, still take it (overflow is allowed).
    if (!line) {
      const t = tokens[idx]!;
      if (t.kind === "word") {
        line = t.text;
        parts.push({ lineStart: 0, lineEnd: t.text.length, sourceStart: t.start, sourceEnd: t.end });
        consumed = 1;
      }
    }
    return { line, consumed, parts };
  };

  const wrapBlockIntoExistingLinesNoMove = (params: {
    layout: any;
    block: "HEADLINE" | "BODY";
    text: string;
    ranges: InlineStyleRange[];
  }): { layout: any; overflow: boolean } => {
    const { layout, block, text, ranges } = params;
    if (!layout || !Array.isArray(layout.textLines)) return { layout, overflow: false };
    const target = String(block);
    const idxs = layout.textLines
      .map((l: any, idx: number) => ({ l, idx }))
      .filter(({ l }: any) => String(l?.block || "").toUpperCase() === target)
      .map(({ idx }: any) => idx);
    if (!idxs.length) return { layout, overflow: false };

    const tokens = tokenizeFixedWrap(String(text || ""));
    let tIdx = 0;
    // Lock Layout mode: overflow is allowed; we do not truncate or drop tokens.
    let overflow = false;

    const avgEm =
      target === "HEADLINE"
        ? estimateAvgCharWidthEmRelaxed(headlineFontFamily, headlineFontWeight)
        : estimateAvgCharWidthEmRelaxed(bodyFontFamily, bodyFontWeight);

    const nextLines = [...layout.textLines];
    for (let pos = 0; pos < idxs.length; pos++) {
      const li = idxs[pos]!;
      const line = nextLines[li] as any;
      const maxWidth = Math.max(1, Math.floor(Number(line?.maxWidth || 1)));
      const fontSize = Math.max(1, Math.floor(Number(line?.baseSize || (target === "HEADLINE" ? 76 : 48))));
      const estCharPx = Math.max(4, Math.floor(fontSize * Math.max(0.3, Number(avgEm) || 0.56)));
      const maxChars = Math.max(4, Math.floor(maxWidth / estCharPx));

      const isLastLine = pos === (idxs.length - 1);
      // For the last available line, consume EVERYTHING (including breaks) so nothing is dropped.
      if (isLastLine) {
        let txt = "";
        const parts: Array<{ lineStart: number; lineEnd: number; sourceStart: number; sourceEnd: number }> = [];
        let outIdx = 0;
        while (tIdx < tokens.length) {
          const t = tokens[tIdx]!;
          if (t.kind === "break") {
            txt += "\n";
            outIdx += 1;
            tIdx += 1;
            continue;
          }
          // word
          const prefix = txt && !txt.endsWith("\n") ? " " : "";
          const startPos = outIdx + prefix.length;
          txt += prefix + t.text;
          outIdx = txt.length;
          parts.push({ lineStart: startPos, lineEnd: startPos + t.text.length, sourceStart: t.start, sourceEnd: t.end });
          tIdx += 1;
        }
        const nextLine: any = { ...line, text: String(txt || "") };
        nextLine.__sourceParts = parts;
        nextLine.styles = buildTextStylesForLine(parts, ranges);
        nextLines[li] = nextLine;
        break;
      }

      // Non-last lines: respect maxChars for wrapping, but do not truncate words.
      const { line: txt, consumed, parts } = takeLineFixed(tokens, tIdx, maxChars);
      tIdx += Math.max(0, consumed);

      const nextLine: any = { ...line, text: String(txt || "") };
      nextLine.__sourceParts = parts;
      nextLine.styles = buildTextStylesForLine(parts, ranges);
      nextLines[li] = nextLine;
    }
    if (tIdx < tokens.length) overflow = true;
    return { layout: { ...layout, textLines: nextLines }, overflow };
  };

  const schedulePersistLayoutAndInput = (params: {
    projectId: string | null;
    slideIndex: number;
    layoutSnapshot: any;
    inputSnapshot: any;
  }) => {
    const pid = String(params.projectId || "").trim();
    if (!pid) return;
    const slideIndex = params.slideIndex;
    if (slideIndex < 0 || slideIndex >= slideCount) return;
    schedulePersistLayoutAndInputNoReflow({
      projectId: pid,
      slideIndex,
      debounceMs: 500,
      layoutSnapshot: params.layoutSnapshot,
      inputSnapshot: params.inputSnapshot,
    });
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
  computeRegularBodyTextboxLayoutRef.current = computeRegularBodyTextboxLayout;

  const {
    enqueueLiveLayoutForProject,
    processLiveLayoutQueue,
    scheduleLiveLayout,
    wipeLineOverridesForActiveSlide,
    runRealignTextForActiveSlide,
  } = useLiveLayoutQueue({
    slideCount,
    templateTypeId,
    currentProjectId,
    currentProjectIdRef,
    activeSlideIndex,
    activeSlideIndexRef,
    realignmentModel,
    slidesRef,
    initSlide,
    setSlides,
    layoutData,
    inputData,
    setLayoutData,
    setInputData,
    setLayoutHistory,
    saveSlidePatchForProject,
    schedulePersistLayoutAndInput,
    addLog,
    headlineFontFamily,
    headlineFontWeight,
    bodyFontFamily,
    bodyFontWeight,
    projectBackgroundColor,
    projectTextColor,
    LIVE_LAYOUT_DEBOUNCE_MS,
    liveLayoutKey,
    liveLayoutTimeoutsRef,
    liveLayoutQueueRef,
    liveLayoutRunIdByKeyRef,
    liveLayoutRunningRef,
    computeTemplateIdForSlide,
    templateSnapshots,
    computeDeterministicLayoutRef,
    computeRegularBodyTextboxLayoutRef,
    handleRealign,
    layoutDirtyRef,
    pushUndoSnapshot,
  });

  const {
    runGenerateImagePrompts,
    imagePromptGeneratingAll,
    imagePromptErrorAll,
    imagePromptGeneratingThis,
    imagePromptErrorThis,
    imagePromptGenerating,
    imagePromptError,
    runGenerateCopy,
    copyGenerating,
    copyError,
    copyProgressState,
    copyProgressLabel,
    runGenerateAiImage,
    aiImageGeneratingThis,
    aiImageProgressThis,
    aiImageStatusThis,
    aiImageErrorThis,
  } = useEditorJobs({
    currentProjectId,
    currentProjectIdRef,
    activeSlideIndex,
    activeSlideIndexRef,
    templateTypeId,
    slideCount,
    fetchJson,
    getAuthToken,
    addLog,
    slidesRef,
    initSlide,
    setSlides,
    setCaptionDraft,
    refreshProjectsList,
    enqueueLiveLayoutForProject,
    aiKey,
    getDraftAiImagePromptForSlide: (slideIndex: number) =>
      String((slidesRef.current?.[slideIndex] as any)?.draftAiImagePrompt || ''),
    computeTemplateIdForSlide,
    templateSnapshots,
    computeDefaultUploadedImagePlacement,
    EMPTY_LAYOUT,
    layoutData,
    setLayoutData,
    saveSlidePatchForProject,
  });

  // Stage 4B3: `wipeLineOverridesForActiveSlide` and `runRealignTextForActiveSlide` are extracted into `useLiveLayoutQueue`.
  // NOTE: scheduleLiveLayoutAll was removed since body font size is now per-slide

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

    const rebuildBlock = (block: "HEADLINE" | "BODY") => {
      // Preserve paragraph breaks when rebuilding the underlying source-of-truth text from positioned lines.
      // We can infer paragraph boundaries from the stable lineKey format: `${BLOCK}:${paragraphIndex}:...`
      const lines = nextTextLines.filter((l: any) => (l?.block === "HEADLINE" ? "HEADLINE" : "BODY") === block);
      const parseParagraphIndex = (lineKey: any) => {
        try {
          const s = String(lineKey || "");
          const m = s.match(/^[A-Z]+:(\d+):/);
          if (m && m[1] != null) return Number(m[1]) || 0;
        } catch {
          // ignore
        }
        return 0;
      };

      let out = "";
      let prevPara: number | null = null;
      for (const l of lines) {
        const raw = String(l?.text ?? "");
        const text = raw.replace(/[ \t]+$/g, "").replace(/^[ \t]+/g, "");
        if (!text) continue;
        const para = parseParagraphIndex((l as any)?.lineKey);
        if (out.length > 0) {
          // Paragraph change → blank line; otherwise normal line continuation.
          out += (prevPara != null && para !== prevPara) ? "\n\n" : " ";
        }
        out += text;
        prevPara = para;
      }
      return out;
    };

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

  async function loadTemplateTypeEffective(type: 'regular' | 'enhanced') {
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
  }

  const archiveProjectById = async (projectId: string, titleForUi: string) => {
    const pid = String(projectId || '').trim();
    if (!pid) return;
    if (archiveProjectBusy) return;
    setArchiveProjectBusy(true);
    try {
      await archiveProjectByIdCore({
        projectId: pid,
        titleForUi,
        onCloseUi: () => {
          setArchiveProjectModalOpen(false);
          setArchiveProjectTarget(null);
          setProjectsDropdownOpen(false);
        },
      });
    } catch (e: any) {
      addLog(`❌ Archive project failed: ${String(e?.message || e || 'unknown error')}`);
    } finally {
      setArchiveProjectBusy(false);
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

  // NOTE: slide snapshot persistence is handled via `useSlidePersistence` (project-scoped).

  async function savePromptSettings() {
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
  }

  // Project-scoped AI image prompt save (debounced callers capture pid).
  const saveSlideAiImagePromptForProject = async (projectId: string, slideIndex: number, prompt: string) => {
    const pid = String(projectId || "").trim();
    if (!pid) return false;
    const shouldShowUi = currentProjectIdRef.current === pid;
    if (shouldShowUi) setAiImagePromptSaveStatus("saving");
    const ok = await saveSlideAiImagePromptForProjectCore(pid, slideIndex, prompt);
    if (!ok) {
      if (shouldShowUi) setAiImagePromptSaveStatus("idle");
      return false;
    }
    if (shouldShowUi) {
      setSlides((prev) => prev.map((s, i) => (i !== slideIndex ? s : { ...s, savedAiImagePrompt: prompt })));
      setAiImagePromptSaveStatus("saved");
      window.setTimeout(() => setAiImagePromptSaveStatus("idle"), 1200);
    }
    return true;
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

  const canGoPrev = activeSlideIndex > 0;
  const canGoNext = activeSlideIndex < slideCount - 1;

  // (Stage 4D1) Active image selection tracking is extracted.

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

  const isEditableTarget = (target: any) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.closest?.('[data-rte-root="1"]')) return true;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return true;
    if ((el as any).isContentEditable) return true;
    return false;
  };

  function computeDefaultUploadedImagePlacement(templateSnapshot: any | null, imageW: number, imageH: number) {
    return computeDefaultUploadedImagePlacementShared(templateSnapshot, imageW, imageH);
  }

  const openImageMenu = (x: number, y: number) => {
    setImageMenuPos({ x, y });
    setImageMenuOpen(true);
  };

  const closeImageMenu = () => {
    setImageMenuOpen(false);
    setImageMenuPos(null);
  };

  const {
    uploadImageForActiveSlide,
    setActiveSlideImageBgRemoval,
    deleteImageForActiveSlide,
    handleUserImageChange,
  } = useImageOps({
    slideCount,
    EMPTY_LAYOUT,
    fetchJson,
    getAuthToken,
    currentProjectId,
    currentProjectIdRef,
    activeSlideIndex,
    activeSlideIndexRef,
    templateTypeId,
    computeTemplateIdForSlide,
    templateSnapshots,
    computeDefaultUploadedImagePlacement,
    slidesRef,
    setSlides,
    layoutData,
    setLayoutData,
    setActiveImageSelected,
    setImageBusy,
    closeImageMenu,
    setBgRemovalBusyKeys,
    addLog,
    saveSlidePatchForProject,
    aiKey,
    imageOpRunIdByKeyRef,
    pushUndoSnapshot,
    switchingSlides,
    copyGenerating,
    realigning,
    runRealignTextForActiveSlide,
    scheduleAutoRealignAfterRelease,
  });

  const hasImageForActiveSlide = () => {
    const curLayout = (layoutData as any)?.layout || null;
    const url = curLayout?.image?.url || null;
    return !!String(url || "").trim();
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
      // UX: clear selection on the previous slide so you don't see multiple slides "selected".
      // Each slide has its own Fabric canvas; we only want the active slide to show selection.
      try {
        const prevHandle = slideCanvasRefs.current[slideIndexAtStart]?.current;
        const prevCanvas = (prevHandle as any)?.canvas || prevHandle || null;
        prevCanvas?.discardActiveObject?.();
        prevCanvas?.requestRenderAll?.();
        prevCanvas?.renderAll?.();
      } catch {
        // ignore
      }
      // Also clear derived UI state immediately; listeners will re-sync for the next slide.
      setActiveImageSelected(false);

      // Best-effort flush pending project/slide saves before switching.
      try {
        if (projectSaveTimeoutRef.current) {
          window.clearTimeout(projectSaveTimeoutRef.current);
          projectSaveTimeoutRef.current = null;
          if (projectIdAtStart) {
            void saveProjectMetaForProject(projectIdAtStart, { title: projectTitleAtStart, caption: captionAtStart });
          }
        }
        if (hasPendingSlideTextSave()) {
          cancelPendingSlideTextSave();
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
        if (hasPendingLayoutPersist()) {
          cancelPendingLayoutPersist();
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

  const { handleTopDownload, handleDownloadAll, handleShareAll, shareSingleSlide } = useCanvasExport({
    slideCount,
    slideCanvasRefs,
    projectTitle,
    topExporting,
    setTopExporting,
    setMobileSaveBusy,
    setMobileSaveOpen,
  });

  const handleSignOut = async () => {
    await signOut();
  };

  useEditorStoreActionsSync({
    editorStore,

    // Keep dependency semantics identical to the original effect.
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

    // Captured values used in actions (intentionally not part of the dependency list).
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
    projectTextColorForUpdate: projectTextColor,
    projectBackgroundColorForUpdate: projectBackgroundColor,
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
  });

  // Phase 5E5: workspace slices are now published via a dedicated hook (no more workspace mirroring here).
  useEditorStoreWorkspaceRegistry({
    editorStore,
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
    deleteImageForActiveSlide,
    uploadImageForActiveSlide,
    handleUserImageChange,
    canvasTextSelection,
    applyCanvasInlineMark,
    clearCanvasInlineMarks,
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
    imageMenuOpen,
    imageMenuPos,
    VIEWPORT_PAD,
    translateX,
    totalW,
    templateTypeId,
    handleRegularCanvasTextChange,
    handleEnhancedCanvasTextChange,
  });

  useEditorStoreWorkspaceSync({
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

    titleText: "The Fittest You - AI Carousel Generator",
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
  } as any);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar (visual only for now) */}
      <EditorTopBar />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left sidebar */}
        {!isMobile ? (
          <aside
            className="relative bg-white border-r border-slate-200 flex flex-col shrink-0"
            style={{ width: sidebarWidth }}
          >
            <EditorSidebar />

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
              <MobileDrawer
                open={mobileDrawerOpen}
                onOpen={() => setMobileDrawerOpen(true)}
                onClose={() => setMobileDrawerOpen(false)}
                onDrawerPointerDown={(e) => {
                  if ((e as any).pointerType && (e as any).pointerType !== "touch") return;
                  const x = (e as any).clientX ?? 0;
                  const y = (e as any).clientY ?? 0;
                  mobileGestureRef.current = { mode: "drawer-close", startX: x, startY: y, lastX: x, lastY: y, fired: false };
                }}
                onDrawerPointerMove={(e) => {
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
                onDrawerPointerUp={() => {
                  const g = mobileGestureRef.current;
                  if (g.mode === "drawer-close") mobileGestureRef.current.mode = null;
                }}
                onDrawerPointerCancel={() => {
                  const g = mobileGestureRef.current;
                  if (g.mode === "drawer-close") mobileGestureRef.current.mode = null;
                }}
              >
                <EditorSidebar />
              </MobileDrawer>

              <MobileSaveSlidesPanel
                open={mobileSaveOpen}
                slideCount={slideCount}
                mobileSaveBusy={mobileSaveBusy}
                topExporting={topExporting}
                onClose={() => setMobileSaveOpen(false)}
                onShareSingleSlide={(i) => void shareSingleSlide(i)}
                onDownloadZip={() => void handleDownloadAll()}
              />
            </>
          ) : null}
          {/* Slides row */}
          {/* Lock desktop slide-row height to prevent layout shift while Fabric/templates load. */}
          {/* Slightly bias padding to the top so slides sit a touch lower without moving the bottom panel. */}
          <EditorSlidesRow />

          <EditorBottomPanel />
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

      <TemplateSettingsModal />

      <PromptsModal promptTextareaRef={promptTextareaRef} emphasisTextareaRef={emphasisTextareaRef} />
    </div>
  );
}


