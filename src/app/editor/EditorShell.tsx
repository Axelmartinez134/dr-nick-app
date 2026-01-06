"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./EditorShell.module.css";
import dynamic from "next/dynamic";
import { useCarouselEditorEngine } from "../components/health/marketing/ai-carousel/useCarouselEditorEngine";
import type { CarouselTextRequest } from "@/lib/carousel-types";
import TemplateEditorModal from "../components/health/marketing/ai-carousel/TemplateEditorModal";
import { supabase, useAuth } from "../components/auth/AuthContext";

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
  const FONT_OPTIONS = useMemo(
    () => [
      { label: "Inter", value: "Inter, sans-serif" },
      { label: "Poppins", value: "Poppins, sans-serif" },
      { label: "Montserrat", value: "Montserrat, sans-serif" },
      { label: "Playfair Display", value: "\"Playfair Display\", serif" },
    ],
    []
  );

  const {
    canvasRef,
    loading,
    realigning,
    error,
    layoutData,
    inputData,
    layoutHistory,
    currentCarouselId,
    carouselTitle,
    setCarouselTitle,
    saveStatus,
    saveError,
    debugLogs,
    debugScreenshot,
    showDebugPreview,
    setShowDebugPreview,
    handleRetry,
    savedCarousels,
    loadingCarousels,
    showDropdown,
    setShowDropdown,
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
    loadTemplate,
    loadCarousel,
    performAutoSave,
    setLayoutData,
    setInputData,
    setLayoutHistory,
    setCurrentCarouselId,
    setSaveStatus,
    setSaveError,
    setError,
    handleGenerate,
    handleRealign,
    handleUndo,
    handleNewCarousel,
    addLog,
    loadTemplatesList,
  } = useCarouselEditorEngine();

  // Project-wide colors (shared across all slides; affects canvas + generation).
  const [projectBackgroundColor, setProjectBackgroundColor] = useState<string>("#ffffff");
  const [projectTextColor, setProjectTextColor] = useState<string>("#000000");
  const [captionDraft, setCaptionDraft] = useState<string>("");

  const DEFAULT_REMIX_INSTRUCTIONS =
    "I have an Instagram carousel post that has done very well and gone viral. The post is shared within the \"Viral Carousel Post\" group. I want you to remix the post so that I can post an entirely unique version of it, while ensuring that it maintains all elements that made it viral and highly resonant with the Instagram audience. No copy that you create should remain line by line verbatim compared to the original post shared within the \"Viral Carousel Post\". I want to have the copy you create for both the first slide AND the second slide of each carousel hook the viewer and entrap their attention such that they stop scrolling and continue to explore more of the new carousel post you have created for me. For slides 1-6, all the while using the attached \"'Challenging a commonly held belief' framework\" group, please create 10 different variations of the carousel post but only share with me the one amongst them that you analytically determine is the most likely to be resonant with the Instagram audience and go viral. In addition, list out all verbiage that would be present on each slide of a post and each caption that would accompany each post as well as ensuring that you retaining the core meaning and message being communicated through the original Instagram carousel I shared with you\n\nThe Carousel post will contain 6 slides so you should create the copy for each slide and each slide should have a Max of 250 characters of text in Tweet Like Text. Do not go past this character limitation it is very important to stay under 250 characters of text.\n\nSlide #1-2. The First Slide Copy should challenge a commonly held belief and should make an instagram user scrolling through their feed want to read what comes in next. The second slide copy should be just as jarring and make the Instagram user scrolling through their become absolutely obsessed with reading the rest of the carousel.\n\nSlide #3-#5. The following slides should be related to the subject matter.\n\nSlide #6. The final 6th slide should be a wrap up slide that uses the least amount of words of what was discussed and why what was discussed matters with a takeaway.\n\nDo:\nUse Newlines to separate Ideas in a slide to make it visually easy to read.\n\nDont do:\nNever use ** for any copy\nDon't surround your outputs with \"\" unless it is necessary to make a point within the sentence or to paraphrase something.\nuse dashes sparingly\nDon't ever use an em dash, \"—\", and always replace any appropriate usage of it with an ellipsis instead.\n\nIn addition, ensure each post variation has an accompanying post caption that is cohesive with and contributes more value to the carousel slides copy and is 900 characters long at most\n\nRemember, the copy of both the first slide and the second slide of the carousel, with the highest importance of entrapping the viewer's attention being placed on the first slide, is the most important to get the viewer to continue to read through the piece of content so I want to have the copy you create for both the first and second slide of the carousel hook the viewer and entrap their attention all the while using the instruction from the \"'Challenging a commonly held belief' framework\" group to keep it entirely cohesive with the rest of the copy for each of the slides.\n\nUsing the subject matter of the social media post deduced from the \"Viral Carousel Post\" group in addition to the copy for the slides you have created, generate the most effective social media caption hook for Instagram utilizing the '5-Caption Hooks' video within the connected \"Art Of Hooks\" group. Ensure that the social media caption hook presented is 125 characters or less.\n\nOnce again, ensure that the generated social media caption hook presented is 125 characters or less.\n\nEnd every caption with a line break followed by this:\n\"🫶🏾 Dr. Nick\n\n#metabolichealth #mindsetsmatter\"\n\nYou do not need to supply any hashtags.";

  const [remixInstructions, setRemixInstructions] = useState<string>(DEFAULT_REMIX_INSTRUCTIONS);
  const [remixLoaded, setRemixLoaded] = useState(false);
  const remixSaveTimeoutRef = useRef<number | null>(null);
  const [remixSaveStatus, setRemixSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [remixModalOpen, setRemixModalOpen] = useState(false);
  const remixDirtyRef = useRef(false);

  // When a carousel is loaded/generated, sync project colors from it.
  useEffect(() => {
    const bg = inputData?.settings?.backgroundColor;
    const tc = inputData?.settings?.textColor;
    if (bg) setProjectBackgroundColor(bg);
    if (tc) setProjectTextColor(tc);
  }, [inputData]);

  type SlideState = {
    carouselId: string | null;
    carouselTitle: string;
    layoutData: any | null;
    inputData: any | null;
    layoutHistory: any[];
    saveStatus: any;
    saveError: string | null;
    error: string | null;
    debugLogs: string[];
    debugScreenshot: string | null;
    draftHeadline: string;
    draftBody: string;
    draftBg: string;
    draftText: string;
  };

  const initSlide = (): SlideState => ({
    carouselId: null,
    carouselTitle: "Untitled Carousel",
    layoutData: null,
    inputData: null,
    layoutHistory: [],
    saveStatus: "idle",
    saveError: null,
    error: null,
    debugLogs: [],
    debugScreenshot: null,
    draftHeadline: "",
    draftBody: "",
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

  // Load + persist remix instructions (per-user) in Supabase.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        // Don't show any "saved" state on initial load.
        setRemixSaveStatus("idle");
        remixDirtyRef.current = false;
        const { data, error } = await supabase
          .from("editor_preferences")
          .select("carousel_remix_instructions")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.warn("[EditorShell] Failed to load editor_preferences:", error);
          setRemixLoaded(true);
          return;
        }
        const text = (data as any)?.carousel_remix_instructions;
        if (typeof text === "string" && text.length > 0) {
          setRemixInstructions(text);
          setRemixLoaded(true);
          return;
        }
        // No row / empty: show default locally, but do NOT auto-write to Supabase.
        setRemixInstructions(DEFAULT_REMIX_INSTRUCTIONS);
        setRemixLoaded(true);
      } catch (e) {
        console.warn("[EditorShell] Failed to load/seed editor_preferences:", e);
        setRemixLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !remixLoaded) return;
    // Only save after the user has actually changed the field in this session.
    if (!remixDirtyRef.current) return;
    // Debounced save on every change
    if (remixSaveTimeoutRef.current) window.clearTimeout(remixSaveTimeoutRef.current);
    remixSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        setRemixSaveStatus("saving");
        await supabase.from("editor_preferences").upsert(
          { user_id: user.id, carousel_remix_instructions: remixInstructions },
          { onConflict: "user_id" }
        );
        setRemixSaveStatus("saved");
        remixDirtyRef.current = false;
        window.setTimeout(() => setRemixSaveStatus("idle"), 1500);
      } catch (e) {
        console.warn("[EditorShell] Failed to save remix instructions:", e);
        setRemixSaveStatus("error");
        window.setTimeout(() => setRemixSaveStatus("idle"), 2000);
      }
    }, 600);
    return () => {
      if (remixSaveTimeoutRef.current) window.clearTimeout(remixSaveTimeoutRef.current);
    };
  }, [remixInstructions, remixLoaded, user?.id]);

  // Close the remix modal on Escape.
  useEffect(() => {
    if (!remixModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRemixModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [remixModalOpen]);

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
          carouselId: currentCarouselId ?? s.carouselId,
          carouselTitle,
          layoutData,
          inputData,
          layoutHistory,
          saveStatus,
          saveError,
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
    carouselTitle,
    currentCarouselId,
    inputData,
    layoutData,
    layoutHistory,
    saveStatus,
    saveError,
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
      // Force-save current slide before switching (best effort).
      if (layoutData && inputData) {
        const forceNew = !currentCarouselId;
        const savedId = await performAutoSave(forceNew);
        if (savedId) {
          setSlides((prev) =>
            prev.map((s, i) => (i === activeSlideIndex ? { ...s, carouselId: savedId } : s))
          );
        }
      }

      // Snapshot current engine state into the current slide slot.
      setSlides((prev) =>
        prev.map((s, i) =>
          i === activeSlideIndex
            ? {
                ...s,
                carouselId: currentCarouselId ?? s.carouselId,
                carouselTitle,
                layoutData,
                inputData,
                layoutHistory,
                saveStatus,
                saveError,
                error,
                debugLogs,
                debugScreenshot,
              }
            : s
        )
      );

      setActiveSlideIndex(nextIndex);

      const next = slidesRef.current[nextIndex] || initSlide();
      if (next.carouselId) {
        await loadCarousel(next.carouselId);
        return;
      }

      if (next.layoutData || next.inputData) {
        setLayoutData(next.layoutData);
        setInputData(next.inputData);
        setLayoutHistory(next.layoutHistory || []);
        setCurrentCarouselId(next.carouselId);
        setCarouselTitle(next.carouselTitle || "Untitled Carousel");
        setSaveStatus((next as any).saveStatus || "idle");
        setSaveError((next as any).saveError || null);
        setError((next as any).error || null);
      } else {
        handleNewCarousel();
      }
    } finally {
      setSwitchingSlides(false);
    }
  };

  const goPrev = () => void switchToSlide(activeSlideIndex - 1);
  const goNext = () => void switchToSlide(activeSlideIndex + 1);

  const handleTopSaveDraft = async () => {
    if (switchingSlides) return;
    // Match MVP behavior: if no current id, save as new; otherwise update current.
    const forceNew = !currentCarouselId;
    const savedId = await performAutoSave(forceNew);
    if (savedId) {
      setSlides((prev) =>
        prev.map((s, i) => (i === activeSlideIndex ? { ...s, carouselId: savedId } : s))
      );
    }
  };

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

  const activeSlideTitle = slides[activeSlideIndex]?.carouselTitle ?? carouselTitle;

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

  const RemixStatusPill = () => {
    if (remixSaveStatus === "idle") return null;
    const base = "px-3 py-1 rounded-full text-xs font-semibold border";
    if (remixSaveStatus === "saving") {
      return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Remix: Saving…</span>;
    }
    if (remixSaveStatus === "saved") {
      return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Remix: Saved ✓</span>;
    }
    return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Remix: Save Failed</span>;
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
              setSlides((prev) =>
                prev.map((s, i) => (i === activeSlideIndex ? { ...s, carouselTitle: v } : s))
              );
              setCarouselTitle(v);
            }}
            placeholder="Untitled Carousel"
            disabled={switchingSlides}
            title="Slide title"
          />
          <StatusPill />
          <RemixStatusPill />
          <button
            className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 text-sm bg-white shadow-sm disabled:opacity-50"
            onClick={() => void handleTopSaveDraft()}
            disabled={saveStatus === "saving" || switchingSlides}
            title={currentCarouselId ? "Update current carousel" : "Save as new carousel"}
          >
            Save Draft
          </button>
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
                setSlides((prev) => prev.map((s, i) => (i === activeSlideIndex ? initSlide() : s)));
                handleNewCarousel();
              }}
              disabled={switchingSlides}
            >
              Create Carousel
            </button>

            <button
              type="button"
              className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2.5 hover:bg-slate-50"
              onClick={() => setRemixModalOpen(true)}
              disabled={!remixLoaded}
              title="Edit Prompt"
            >
              <div className="text-sm font-semibold text-slate-700">Prompt</div>
              <div className="mt-0.5 text-xs text-slate-500 truncate">
                {remixLoaded ? (remixInstructions || DEFAULT_REMIX_INSTRUCTIONS).split("\n")[0] : "Loading..."}
              </div>
            </button>

            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Template Settings</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                  value={selectedTemplateId || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setSelectedTemplateId(null);
                      setSelectedTemplateSnapshot(null);
                      return;
                    }
                    void loadTemplate(v);
                  }}
                  disabled={loadingTemplates}
                >
                  <option value="">
                    {loadingTemplates ? "Loading templates..." : "No template (legacy)"}
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  className="h-10 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm"
                  title="Open Template Editor (admin-only)"
                  onClick={() => setTemplateEditorOpen(true)}
                >
                  ⚙️
                </button>
              </div>
              {selectedTemplateId && (
                <div className="text-xs text-slate-500">
                  {selectedTemplateSnapshot ? "Snapshot loaded" : "Loading..."}
                </div>
              )}
            </div>

            {/* Saved carousels (loads into the current active slide) */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Saved Carousels</div>
                <div className="text-xs text-slate-500">{savedCarousels.length}</div>
              </div>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full h-10 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm flex items-center justify-between px-3"
                disabled={loadingCarousels || switchingSlides}
              >
                <span>
                  {loadingCarousels ? "Loading..." : "Load saved…"}
                </span>
                <span className="text-slate-400">{showDropdown ? "▴" : "▾"}</span>
              </button>

              {showDropdown && (
                <div className="w-full bg-white border border-slate-200 rounded-md shadow-sm max-h-64 overflow-y-auto">
                  {savedCarousels.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">No saved carousels yet</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {savedCarousels.map((c) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50"
                          onClick={() => {
                            setShowDropdown(false);
                            // Load into the currently active slide slot.
                            setSlides((prev) =>
                              prev.map((s, idx) =>
                                idx === activeSlideIndex ? { ...s, carouselId: c.id } : s
                              )
                            );
                            void loadCarousel(c.id);
                          }}
                        >
                          <div className="text-sm font-medium text-slate-900 truncate">{c.title}</div>
                          <div className="text-xs text-slate-500 truncate">{c.headline}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Updated: {new Date(c.updatedAt).toLocaleDateString()}
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
                    value={headlineFontFamily}
                    onChange={(e) => setHeadlineFontFamily(e.target.value)}
                  >
                    {FONT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Body</div>
                  <select
                    className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
                    value={bodyFontFamily}
                    onChange={(e) => setBodyFontFamily(e.target.value)}
                  >
                    {FONT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
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
                    >
                      <SlideCard index={i + 1} active={i === activeSlideIndex}>
                        {i === activeSlideIndex && layoutData?.layout && inputData ? (
                          <div className="w-full h-full flex flex-col items-center justify-center">
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
                                <CarouselPreviewVision
                                  ref={canvasRef}
                                  layout={layoutData.layout as any}
                                  backgroundColor={projectBackgroundColor}
                                  textColor={projectTextColor}
                                  templateSnapshot={selectedTemplateSnapshot}
                                  headlineFontFamily={headlineFontFamily}
                                  bodyFontFamily={bodyFontFamily}
                                />
                              </div>
                            </div>
                            <div className="mt-3">
                              <TextStylingToolbar fabricCanvas={canvasRef.current?.canvas} />
                            </div>
                          </div>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                            {slides[i]?.carouselId ? `Slide ${i + 1} (saved)` : `Slide ${i + 1} (empty)`}
                          </div>
                        )}
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
          </div>

          {/* Bottom panel */}
          <section className="bg-white border-t border-slate-200">
            <div className="max-w-[1400px] mx-auto px-6 py-4">
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1">Headline</label>
                    <input
                      className="w-full h-10 rounded-md border border-slate-200 px-3 text-slate-900"
                      placeholder="Enter headline..."
                      value={slides[activeSlideIndex]?.draftHeadline || ""}
                      onChange={(e) =>
                        setSlides((prev) =>
                          prev.map((s, i) =>
                            i === activeSlideIndex ? { ...s, draftHeadline: e.target.value } : s
                          )
                        )
                      }
                      disabled={loading || switchingSlides}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1">Body</label>
                    <textarea
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                      rows={3}
                      placeholder="Enter body..."
                      value={slides[activeSlideIndex]?.draftBody || ""}
                      onChange={(e) =>
                        setSlides((prev) =>
                          prev.map((s, i) =>
                            i === activeSlideIndex ? { ...s, draftBody: e.target.value } : s
                          )
                        )
                      }
                      disabled={loading || switchingSlides}
                    />
                  </div>

                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-900">Controls</div>
                  <button
                    className="w-full h-10 rounded-lg bg-[#6D28D9] text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                    disabled={
                      loading ||
                      switchingSlides ||
                      !(slides[activeSlideIndex]?.draftHeadline || "").trim() ||
                      !(slides[activeSlideIndex]?.draftBody || "").trim()
                    }
                    onClick={() => {
                      const cur = slidesRef.current[activeSlideIndex] || initSlide();
                      const req: CarouselTextRequest = {
                        headline: (cur.draftHeadline || "").trim(),
                        body: (cur.draftBody || "").trim(),
                        settings: {
                          backgroundColor: projectBackgroundColor || "#ffffff",
                          textColor: projectTextColor || "#000000",
                          // Keep image generation off by default in this shell; can be revisited later.
                          includeImage: false,
                        },
                        templateId: selectedTemplateId || undefined,
                      } as any;
                      void handleGenerate(req);
                    }}
                  >
                    {loading ? "Generating..." : "Generate Layout"}
                  </button>

                  <div className="flex items-center gap-2">
                    <select
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3"
                      value={realignmentModel}
                      onChange={(e) => setRealignmentModel(e.target.value as any)}
                      disabled={realigning}
                    >
                      <option value="gemini-computational">Gemini Computational</option>
                      <option value="gemini">Gemini 3 Vision</option>
                      <option value="claude">Claude Vision</option>
                    </select>
                  </div>

                  <button
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm disabled:opacity-50"
                    onClick={() => void handleRealign()}
                    disabled={loading || realigning || !layoutData || switchingSlides}
                  >
                    {realigning ? "Realigning..." : "Realign Text"}
                  </button>
                  <button
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm disabled:opacity-50"
                    onClick={handleUndo}
                    disabled={layoutHistory.length === 0 || realigning || switchingSlides}
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
                  onChange={(e) => setCaptionDraft(e.target.value)}
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
        currentTemplateId={selectedTemplateId}
        currentTemplateSnapshot={selectedTemplateSnapshot}
        onTemplateSaved={(templateId, nextDefinition) => {
          setSelectedTemplateId(templateId);
          setSelectedTemplateSnapshot(nextDefinition);
          addLog(`✅ Template updated (snapshot refreshed): ${templateId}`);
        }}
        onRefreshTemplates={loadTemplatesList}
      />

      {/* Prompt modal */}
      {remixModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6"
          onMouseDown={(e) => {
            // Only close on true backdrop clicks (not inside the panel).
            if (e.target === e.currentTarget) setRemixModalOpen(false);
          }}
        >
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="text-base font-semibold text-slate-900">Prompt</div>
              <button
                type="button"
                className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => setRemixModalOpen(false)}
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
                value={remixInstructions}
                onChange={(e) => {
                  remixDirtyRef.current = true;
                  setRemixInstructions(e.target.value);
                }}
                placeholder="Paste your remix instructions..."
                autoFocus
              />
              <div className="mt-2 text-xs text-slate-500">
                Auto-saves to Supabase as you type. Press <span className="font-mono">Esc</span> to close.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


