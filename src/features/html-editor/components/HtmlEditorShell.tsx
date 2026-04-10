"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HtmlSlidePreviewHandle } from "./HtmlSlidePreview";
import { EditorTopBar } from "@/features/editor/components/EditorTopBar";
import { EditorSidebar } from "@/features/editor/components/EditorSidebar";
import { SwipeFileModal } from "@/features/editor/components/SwipeFileModal";
import { useEditorSelector, useEditorStore } from "@/features/editor/store";
import { supabase } from "@/app/components/auth/AuthContext";
import { HtmlBottomPanel } from "./HtmlBottomPanel";
import { HtmlEditorWorkspace, type HtmlSlideRestyleStatus } from "./HtmlEditorWorkspace";
import { HtmlInspectorPanel } from "./HtmlInspectorPanel";
import { HtmlUnsavedChangesDialog } from "./HtmlUnsavedChangesDialog";
import { ResizablePanel } from "./ResizablePanel";
import {
  archiveProject,
  createProject,
  listHtmlPresets,
  loadHtmlProjectShellData,
  saveHtmlSlides,
  setRuntimeProjectIdHint,
  type HtmlProjectShellData,
} from "../services/htmlProjectsApi";
import { useHtmlGenerateCopy } from "../hooks/useHtmlGenerateCopy";
import { useHtmlCarouselRefinement } from "../hooks/useHtmlCarouselRefinement";
import { useHtmlPageRefinement } from "../hooks/useHtmlPageRefinement";
import { useHtmlSlideGeneration } from "../hooks/useHtmlSlideGeneration";
import { buildManualEditsSummary } from "../lib/htmlManualEdits";
import type { HtmlDesignPreset } from "../lib/presets";
import { createHtmlSlidePageState, patchHtmlSlidePageState, renderHtmlSlidePageState, type HtmlSlidePageState } from "../lib/htmlPageState";
import { addElementToHtml, duplicateElementInHtml, deleteElementInHtml, type AddElementKind, type HtmlElementPatch } from "../hooks/useHtmlElementSerializer";
import { useHtmlSlideExport } from "../hooks/useHtmlSlideExport";
import { getFontCssImport } from "../lib/fontOptimizer";
import {
  buildPageStatesFromHtmlSlides,
  captureHtmlEditorSnapshot,
  cloneHtmlSlidesForSnapshot,
  normalizeSelectionForSnapshot,
  type HtmlEditorSelectionSnapshot,
  type HtmlEditorSlideSnapshot,
  type HtmlEditorSnapshot,
} from "../lib/htmlEditorSnapshots";
import {
  clearHtmlSessionDraft,
  getHtmlEditorActiveAccountId,
  readHtmlSessionDraft,
  writeHtmlSessionDraft,
} from "../lib/htmlSessionRecovery";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | ({ status: "ready" } & HtmlProjectShellData);

type PendingNavigationAction =
  | { type: "load-project"; projectId: string }
  | { type: "create-project"; templateTypeId: "regular" | "enhanced" | "html" };

function shouldIgnoreShellShortcut(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  const tagName = String(element.tagName || "").toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  if (element.isContentEditable) return true;
  return Boolean(element.closest('[contenteditable="true"]'));
}

function normalizeHtmlSlidesForEditor(
  slides: Array<{ id: string; slideIndex: number; html: string | null; pageTitle: string | null; pageType: string | null }>
) {
  const pageStates = slides.map((slide) => createHtmlSlidePageState(String(slide?.html || "")));
  const normalizedSlides = slides.map((slide, index) => {
    const html = String(slide?.html || "");
    if (!html.trim()) return slide;
    const parsed = pageStates[index];
    return parsed.baseHtml === html ? slide : { ...slide, html: parsed.baseHtml };
  });
  return { normalizedSlides, pageStates };
}

function buildHtmlContentString(projectTitle: string, slides: any[]) {
  return [
    "PROJECT_TITLE:",
    String(projectTitle || "Untitled HTML Carousel").trim() || "Untitled HTML Carousel",
    "",
    "CAROUSEL_TEXTLINES:",
    ...Array.from({ length: 6 }).flatMap((_, index) => {
      const slide = slides[index] || {};
      const lines = [String(slide?.headline || "").trim(), ...String(slide?.body || "").split(/\r?\n/).map((line) => String(line || "").trim())]
        .filter(Boolean);
      return [`SLIDE ${index + 1} (textLines):`, ...(lines.length ? lines : [`Slide ${index + 1}`]), ""];
    }),
  ]
    .join("\n")
    .trim();
}

export function HtmlEditorShell() {
  const editorStore = useEditorStore();
  const activeSlideIndex = useEditorSelector((s) => s.activeSlideIndex);
  const isMobile = useEditorSelector((s) => s.isMobile);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [pageStates, setPageStates] = useState<HtmlSlidePageState[]>([]);
  const [presets, setPresets] = useState<HtmlDesignPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [selectedElementSelection, setSelectedElementSelection] = useState<{ slideIndex: number; elementId: string } | null>(null);
  const [htmlDirtyRevision, setHtmlDirtyRevision] = useState(0);
  const [hasUnsavedHtmlChanges, setHasUnsavedHtmlChanges] = useState(false);
  const [undoStack, setUndoStack] = useState<HtmlEditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HtmlEditorSnapshot[]>([]);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<PendingNavigationAction | null>(null);
  const [unsavedDialogMode, setUnsavedDialogMode] = useState<"unsaved-navigation" | "restore-session" | null>(null);
  const [unsavedDialogBusy, setUnsavedDialogBusy] = useState(false);
  const [unsavedDialogError, setUnsavedDialogError] = useState<string | null>(null);
  const [pendingSessionDraft, setPendingSessionDraft] = useState<HtmlEditorSnapshot | null>(null);
  const htmlSaveTimeoutRef = useRef<number | null>(null);
  const htmlSaveResetTimeoutRef = useRef<number | null>(null);
  const historyGroupTimeoutRef = useRef<number | null>(null);
  const sessionDraftTimeoutRef = useRef<number | null>(null);
  const slideRestyleFadeTimeoutRef = useRef<number | null>(null);
  const activePreviewRef = useRef<HtmlSlidePreviewHandle | null>(null);
  const pageStatesRef = useRef<HtmlSlidePageState[]>([]);
  const baselinePageStatesRef = useRef<HtmlSlidePageState[]>([]);
  const loadStateRef = useRef<LoadState>({ status: "loading" });
  const currentRevisionRef = useRef(0);
  const lastSavedRevisionRef = useRef(0);
  const inFlightSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const inFlightSaveRevisionRef = useRef<number | null>(null);
  const skipNextHistoryCheckpointRef = useRef(false);
  const sessionAccountIdRef = useRef(getHtmlEditorActiveAccountId());
  const [slideRestyleStatuses, setSlideRestyleStatuses] = useState<Record<number, HtmlSlideRestyleStatus>>({});

  const debugLog = useCallback((_stage: string, _payload?: unknown) => {}, []);

  useEffect(() => {
    pageStatesRef.current = pageStates;
  }, [pageStates]);

  useEffect(() => {
    loadStateRef.current = loadState;
  }, [loadState]);

  useEffect(() => {
    return () => {
      if (historyGroupTimeoutRef.current) window.clearTimeout(historyGroupTimeoutRef.current);
      if (sessionDraftTimeoutRef.current) window.clearTimeout(sessionDraftTimeoutRef.current);
    };
  }, []);

  const createSnapshotFromCurrentState = useCallback(
    (reason?: string) => {
      const current = loadStateRef.current;
      if (current.status !== "ready") return null;
      const htmlSlides = cloneHtmlSlidesForSnapshot(current.htmlSlides as HtmlEditorSlideSnapshot[]);
      const baselineHtmlSlides = cloneHtmlSlidesForSnapshot(
        htmlSlides.map((slide, index) => ({
          ...slide,
          html: String(baselinePageStatesRef.current[index]?.baseHtml || slide.html || ""),
        }))
      );
      return captureHtmlEditorSnapshot({
        projectId: String(current.project?.id || ""),
        accountId: sessionAccountIdRef.current,
        activeSlideIndex: Number(editorStore.getState().activeSlideIndex || 0),
        selectedElementSelection: selectedElementSelection as HtmlEditorSelectionSnapshot,
        htmlSlides,
        baselineHtmlSlides,
        reason,
      });
    },
    [editorStore, selectedElementSelection]
  );

  const snapshotSignature = useCallback((snapshot: HtmlEditorSnapshot | null) => {
    if (!snapshot) return "";
    return JSON.stringify({
      projectId: snapshot.projectId,
      activeSlideIndex: snapshot.activeSlideIndex,
      selectedElementSelection: snapshot.selectedElementSelection,
      htmlSlides: snapshot.htmlSlides.map((slide) => ({
        slideIndex: slide.slideIndex,
        html: slide.html,
        pageTitle: slide.pageTitle,
        pageType: slide.pageType,
      })),
      baselineHtmlSlides: snapshot.baselineHtmlSlides.map((slide) => ({
        slideIndex: slide.slideIndex,
        html: slide.html,
      })),
    });
  }, []);

  const pushUndoCheckpoint = useCallback(
    (reason: string, options?: { clearRedo?: boolean }) => {
      if (skipNextHistoryCheckpointRef.current) {
        skipNextHistoryCheckpointRef.current = false;
        return;
      }
      const snapshot = createSnapshotFromCurrentState(reason);
      if (!snapshot) return;
      const signature = snapshotSignature(snapshot);
      setUndoStack((current) => {
        const previous = current[current.length - 1] || null;
        if (snapshotSignature(previous) === signature) return current;
        return [...current.slice(-49), snapshot];
      });
      if (options?.clearRedo !== false) {
        setRedoStack([]);
      }
    },
    [createSnapshotFromCurrentState, snapshotSignature]
  );

  const queueGroupedUndoCheckpoint = useCallback(
    (reason: string) => {
      if (historyGroupTimeoutRef.current) return;
      pushUndoCheckpoint(reason);
      historyGroupTimeoutRef.current = window.setTimeout(() => {
        historyGroupTimeoutRef.current = null;
      }, 450);
    },
    [pushUndoCheckpoint]
  );

  const markHtmlDirty = useCallback(() => {
    const nextRevision = currentRevisionRef.current + 1;
    currentRevisionRef.current = nextRevision;
    setHtmlDirtyRevision(nextRevision);
    setHasUnsavedHtmlChanges(nextRevision !== lastSavedRevisionRef.current);
  }, []);

  const applySnapshot = useCallback(
    (snapshot: HtmlEditorSnapshot, options?: { preserveHistory?: boolean }) => {
      const current = loadStateRef.current;
      if (current.status !== "ready") return;
      const nextSlides = cloneHtmlSlidesForSnapshot(snapshot.htmlSlides);
      const nextPageStates = buildPageStatesFromHtmlSlides(nextSlides);
      const nextBaselineStates = buildPageStatesFromHtmlSlides(snapshot.baselineHtmlSlides);
      const nextSelection = normalizeSelectionForSnapshot(snapshot.selectedElementSelection, nextPageStates);
      const nextActiveSlideIndex = Math.max(0, Math.min(snapshot.activeSlideIndex, Math.max(nextSlides.length - 1, 0)));

      skipNextHistoryCheckpointRef.current = true;
      pageStatesRef.current = nextPageStates;
      baselinePageStatesRef.current = nextBaselineStates;
      setPageStates(nextPageStates);
      setSelectedElementSelection(nextSelection as { slideIndex: number; elementId: string } | null);
      editorStore.setState({ activeSlideIndex: nextActiveSlideIndex } as any);
      setLoadState({
        ...current,
        status: "ready",
        htmlSlides: nextSlides,
      });
      activePreviewRef.current?.flushInlineEdit();
      activePreviewRef.current?.syncStructure(String(nextSlides[nextActiveSlideIndex]?.html || ""));
      activePreviewRef.current?.highlight(nextSelection?.slideIndex === nextActiveSlideIndex ? nextSelection.elementId : null);
      if (!options?.preserveHistory) {
        markHtmlDirty();
      }
    },
    [editorStore, markHtmlDirty]
  );

  const flushHtmlSave = useCallback(
    async (options?: { blocking?: boolean; reason?: string }) => {
      while (true) {
        const current = loadStateRef.current;
        const projectId = current.status === "ready" ? String(current.project?.id || "").trim() : "";
        const revisionToSave = currentRevisionRef.current;
        if (!projectId) return false;
        if (!hasUnsavedHtmlChanges && revisionToSave === lastSavedRevisionRef.current) return true;
        if (inFlightSavePromiseRef.current && inFlightSaveRevisionRef.current === revisionToSave) {
          const result = await inFlightSavePromiseRef.current;
          if (!options?.blocking || currentRevisionRef.current === revisionToSave) return result;
          continue;
        }

        const promise = saveHtmlSlides({
          projectId,
          slides: (current.status === "ready" ? current.htmlSlides : []).map((slide, index) => ({
            slideIndex: index,
            html: String(slide?.html || ""),
            pageTitle: slide?.pageTitle ?? null,
            pageType: slide?.pageType ?? null,
          })),
        })
          .then(() => {
            if (currentRevisionRef.current === revisionToSave) {
              lastSavedRevisionRef.current = revisionToSave;
              setHasUnsavedHtmlChanges(false);
              clearHtmlSessionDraft(projectId, sessionAccountIdRef.current);
            }
            editorStore.setState({ slideSaveStatus: "saved" } as any);
            if (htmlSaveResetTimeoutRef.current) window.clearTimeout(htmlSaveResetTimeoutRef.current);
            htmlSaveResetTimeoutRef.current = window.setTimeout(() => {
              editorStore.setState({ slideSaveStatus: "idle" } as any);
            }, 1200);
            return true;
          })
          .catch((error: any) => {
            editorStore.setState({ slideSaveStatus: "error" } as any);
            throw error;
          })
          .finally(() => {
            inFlightSavePromiseRef.current = null;
            inFlightSaveRevisionRef.current = null;
          });

        inFlightSavePromiseRef.current = promise;
        inFlightSaveRevisionRef.current = revisionToSave;
        editorStore.setState({ slideSaveStatus: "saving" } as any);

        try {
          const result = await promise;
          if (!options?.blocking || currentRevisionRef.current === revisionToSave) return result;
        } catch {
          return false;
        }
      }
    },
    [editorStore, hasUnsavedHtmlChanges]
  );

  const restoreSessionDraft = useCallback(() => {
    if (!pendingSessionDraft) return;
    applySnapshot(pendingSessionDraft);
    setPendingSessionDraft(null);
    setUnsavedDialogMode(null);
    setUnsavedDialogError(null);
  }, [applySnapshot, pendingSessionDraft]);

  const discardSessionDraft = useCallback(() => {
    const current = loadStateRef.current;
    if (current.status === "ready") {
      clearHtmlSessionDraft(String(current.project?.id || ""), sessionAccountIdRef.current);
    }
    setPendingSessionDraft(null);
    setUnsavedDialogMode(null);
    setUnsavedDialogError(null);
  }, []);

  const performUndo = useCallback(() => {
    if (!undoStack.length) return;
    const currentSnapshot = createSnapshotFromCurrentState("redo");
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack((current) => current.slice(0, -1));
    if (currentSnapshot) {
      setRedoStack((current) => [...current.slice(-49), currentSnapshot]);
    }
    applySnapshot(previous);
  }, [applySnapshot, createSnapshotFromCurrentState, undoStack]);

  const performRedo = useCallback(() => {
    if (!redoStack.length) return;
    const currentSnapshot = createSnapshotFromCurrentState("undo");
    const nextSnapshot = redoStack[redoStack.length - 1];
    if (!nextSnapshot) return;
    setRedoStack((current) => current.slice(0, -1));
    if (currentSnapshot) {
      setUndoStack((current) => [...current.slice(-49), currentSnapshot]);
    }
    applySnapshot(nextSnapshot);
  }, [applySnapshot, createSnapshotFromCurrentState, redoStack]);

  const continueNavigationAction = useCallback(
    async (action: PendingNavigationAction) => {
      if (action.type === "load-project") {
        setRuntimeProjectIdHint(action.projectId);
        window.location.reload();
        return;
      }
      const data = await createProject(action.templateTypeId);
      const projectId = String(data?.project?.id || "").trim();
      if (!projectId) return;
      setRuntimeProjectIdHint(projectId);
      window.location.reload();
    },
    []
  );

  const requestNavigationAction = useCallback(
    (action: PendingNavigationAction) => {
      if (!hasUnsavedHtmlChanges) {
        void continueNavigationAction(action);
        return;
      }
      setPendingNavigationAction(action);
      setUnsavedDialogError(null);
      setUnsavedDialogMode("unsaved-navigation");
    },
    [continueNavigationAction, hasUnsavedHtmlChanges]
  );

  const dismissUnsavedDialog = useCallback(() => {
    if (unsavedDialogBusy) return;
    setPendingNavigationAction(null);
    setPendingSessionDraft(null);
    setUnsavedDialogMode(null);
    setUnsavedDialogError(null);
  }, [unsavedDialogBusy]);

  const performSave = useCallback(async () => {
    activePreviewRef.current?.flushInlineEdit();
    return flushHtmlSave({ blocking: true, reason: "manual-save" });
  }, [flushHtmlSave]);

  const handleUnsavedDialogPrimary = useCallback(async () => {
    if (unsavedDialogMode === "restore-session") {
      restoreSessionDraft();
      return;
    }
    if (!pendingNavigationAction) return;
    setUnsavedDialogBusy(true);
    setUnsavedDialogError(null);
    const saved = await performSave();
    if (!saved) {
      setUnsavedDialogBusy(false);
      setUnsavedDialogError("Could not save this project. Fix the save issue or discard your changes.");
      return;
    }
    setUnsavedDialogBusy(false);
    setUnsavedDialogMode(null);
    setPendingNavigationAction(null);
    await continueNavigationAction(pendingNavigationAction);
  }, [continueNavigationAction, pendingNavigationAction, performSave, restoreSessionDraft, unsavedDialogMode]);

  const handleUnsavedDialogDiscard = useCallback(async () => {
    if (unsavedDialogMode === "restore-session") {
      discardSessionDraft();
      return;
    }
    if (!pendingNavigationAction) return;
    const action = pendingNavigationAction;
    setPendingNavigationAction(null);
    setUnsavedDialogMode(null);
    setUnsavedDialogError(null);
    await continueNavigationAction(action);
  }, [continueNavigationAction, discardSessionDraft, pendingNavigationAction, unsavedDialogMode]);

  const resetBaselineForSlide = useCallback((slideIndex: number, state: HtmlSlidePageState) => {
    const nextBaseline = [...baselinePageStatesRef.current];
    nextBaseline[slideIndex] = state;
    baselinePageStatesRef.current = nextBaseline;
  }, []);

  const clearSlideRestyleFadeTimer = useCallback(() => {
    if (slideRestyleFadeTimeoutRef.current) {
      window.clearTimeout(slideRestyleFadeTimeoutRef.current);
      slideRestyleFadeTimeoutRef.current = null;
    }
  }, []);

  const scheduleSlideRestyleStatusReset = useCallback(() => {
    clearSlideRestyleFadeTimer();
    slideRestyleFadeTimeoutRef.current = window.setTimeout(() => {
      setSlideRestyleStatuses({});
      slideRestyleFadeTimeoutRef.current = null;
    }, 4000);
  }, [clearSlideRestyleFadeTimer]);

  useEffect(() => {
    return () => {
      clearSlideRestyleFadeTimer();
    };
  }, [clearSlideRestyleFadeTimer]);

  const hydrate = useCallback(
    async (preferredProjectId?: string | null) => {
      editorStore.setState({
        loading: true,
        projectsLoading: true,
        templateTypeId: "html",
        projectTitleDisabled: true,
        titleText: "HTML Carousel Editor",
      } as any);

      const data = await loadHtmlProjectShellData(preferredProjectId);
      const { normalizedSlides: normalizedHtmlSlides, pageStates: nextPageStates } = normalizeHtmlSlidesForEditor(
        Array.isArray(data.htmlSlides) ? data.htmlSlides : []
      );
      const currentActiveSlideIndex = Number(editorStore.getState().activeSlideIndex || 0);
      const clampedActiveSlideIndex = Math.max(
        0,
        Math.min(currentActiveSlideIndex, Math.max((normalizedHtmlSlides?.length || 1) - 1, 0))
      );
      editorStore.setState({
        loading: false,
        projectsLoading: false,
        projects: Array.isArray(data.projects) ? data.projects : [],
        currentProjectId: String(data.project?.id || ""),
        projectTitle: String(data.project?.title || "Untitled Project"),
        projectTitleDisabled: true,
        templateTypeId: "html",
        titleText: "HTML Carousel Editor",
        captionDraft: String(data.project?.caption || ""),
        activeSlideIndex: clampedActiveSlideIndex,
      } as any);
      const normalizedData = { ...data, htmlSlides: normalizedHtmlSlides };
      debugLog("hydrate-ready", {
        preferredProjectId: preferredProjectId || null,
        slideCount: normalizedHtmlSlides.length,
        pageStates: nextPageStates.map((state, index) => ({
          index,
          baseHtmlLength: state.baseHtml.length,
          elementCount: state.elements.length,
        })),
      });
      pageStatesRef.current = nextPageStates;
      baselinePageStatesRef.current = nextPageStates;
      sessionAccountIdRef.current = getHtmlEditorActiveAccountId();
      currentRevisionRef.current = 0;
      lastSavedRevisionRef.current = 0;
      setHtmlDirtyRevision(0);
      setHasUnsavedHtmlChanges(false);
      setUndoStack([]);
      setRedoStack([]);
      setPendingNavigationAction(null);
      setPendingSessionDraft(null);
      setUnsavedDialogMode(null);
      setUnsavedDialogBusy(false);
      setUnsavedDialogError(null);
      setPageStates(nextPageStates);
      setLoadState({ status: "ready", ...normalizedData });
      const sessionDraft = readHtmlSessionDraft(String(data.project?.id || ""), sessionAccountIdRef.current);
      if (sessionDraft) {
        const serverSnapshot = captureHtmlEditorSnapshot({
          projectId: String(data.project?.id || ""),
          accountId: sessionAccountIdRef.current,
          activeSlideIndex: clampedActiveSlideIndex,
          selectedElementSelection: null,
          htmlSlides: normalizedHtmlSlides as HtmlEditorSlideSnapshot[],
          baselineHtmlSlides: normalizedHtmlSlides.map((slide) => ({ ...slide, html: String(slide?.html || "") })),
        });
        if (snapshotSignature(sessionDraft) !== snapshotSignature(serverSnapshot)) {
          setPendingSessionDraft(sessionDraft);
          setUnsavedDialogMode("restore-session");
        } else {
          clearHtmlSessionDraft(String(data.project?.id || ""), sessionAccountIdRef.current);
        }
      }
      return normalizedData;
    },
    [editorStore, snapshotSignature]
  );

  useEffect(() => {
    const syncViewport = () => {
      if (typeof window === "undefined") return;
      editorStore.setState({ isMobile: window.innerWidth < 768 } as any);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, [editorStore]);

  useEffect(() => {
    let cancelled = false;

    async function runInitialHydrate() {
      try {
        await hydrate();
        if (cancelled) return;
      } catch (error: any) {
        if (cancelled) return;
        editorStore.setState({ loading: false, projectsLoading: false } as any);
        setLoadState({ status: "error", message: String(error?.message || "Failed to load html project") });
      }
    }

    void runInitialHydrate();
    return () => {
      cancelled = true;
    };
  }, [editorStore, hydrate]);

  useEffect(() => {
    let cancelled = false;
    async function loadPresets() {
      try {
        const nextPresets = await listHtmlPresets();
        if (!cancelled) setPresets(nextPresets);
      } catch {
        if (!cancelled) setPresets([]);
      }
    }
    void loadPresets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadState.status !== "ready" || !presets.length || selectedPresetId) return;
    if (loadState.htmlPresetId) {
      setSelectedPresetId(String(loadState.htmlPresetId));
      return;
    }
    const guide = loadState.htmlStyleGuide;
    if (guide && typeof guide === "object") {
      const matched = presets.find((preset) => JSON.stringify(preset.styleGuide) === JSON.stringify(guide));
      if (matched) setSelectedPresetId(matched.id);
    }
  }, [loadState, presets, selectedPresetId]);

  const currentProjectId = loadState.status === "ready" ? String(loadState.project?.id || "") : null;
  const { runGenerateCopy, copyProgress } = useHtmlGenerateCopy({
    projectId: currentProjectId,
    onCompleted: async () => {
      await hydrate(currentProjectId);
    },
  });
  const { runGenerateSlides, generation } = useHtmlSlideGeneration({
    projectId: currentProjectId,
    onPage: (payload) => {
      const pageIndex = Math.max(0, Math.min(Number(payload?.pageIndex || 0), 5));
      const nextPageState = createHtmlSlidePageState(String(payload?.page?.html || ""));
      setPageStates((prev) => {
        const next = [...prev];
        next[pageIndex] = nextPageState;
        pageStatesRef.current = next;
        return next;
      });
      setLoadState((prev) => {
        if (prev.status !== "ready") return prev;
        const nextSlides = [...prev.htmlSlides];
        const existing = nextSlides[pageIndex] || {
          id: `generated-${pageIndex}`,
          slideIndex: pageIndex,
          html: null,
          pageTitle: null,
          pageType: null,
        };
        nextSlides[pageIndex] = {
          ...existing,
          html: nextPageState.baseHtml,
          pageTitle: String(payload?.page?.title || `Slide ${pageIndex + 1}`),
          pageType: pageIndex === 0 ? "cover" : pageIndex === 5 ? "cta" : "content",
        };
        return {
          ...prev,
          htmlSlides: nextSlides,
          htmlGenerationStatus: "generating",
        };
      });
    },
    onComplete: async () => {
      await hydrate(currentProjectId);
    },
  });
  const selectedPreset =
    presets.find((preset) => preset.id === selectedPresetId) ||
    (loadState.status === "ready" && loadState.htmlStyleGuide && typeof loadState.htmlStyleGuide === "object"
      ? presets.find((preset) => JSON.stringify(preset.styleGuide) === JSON.stringify(loadState.htmlStyleGuide))
      : null) ||
    null;
  const commitRenderedSlideHtml = useCallback(
    (slideIndex: number, nextState: HtmlSlidePageState) => {
      const renderedHtml = renderHtmlSlidePageState(nextState);
      debugLog("commit-rendered-slide-html", {
        slideIndex,
        baseHtmlLength: nextState.baseHtml.length,
        renderedHtmlLength: renderedHtml.length,
        elementCount: nextState.elements.length,
        elements: nextState.elements.map((element) => ({
          id: element.id,
          type: element.type,
          translateX: element.translateX,
          translateY: element.translateY,
          width: element.width,
          height: element.height,
          rotate: element.rotate,
        })),
      });
      const nextStates = [...pageStatesRef.current];
      nextStates[slideIndex] = nextState;
      pageStatesRef.current = nextStates;
      setPageStates(nextStates);
      setLoadState((prev) => {
        if (prev.status !== "ready") return prev;
        const nextSlides = [...prev.htmlSlides];
        const existing = nextSlides[slideIndex] || {
          id: `generated-${slideIndex}`,
          slideIndex,
          html: null,
          pageTitle: null,
          pageType: null,
        };
        nextSlides[slideIndex] = {
          ...existing,
          html: renderedHtml,
        };
        return { ...prev, htmlSlides: nextSlides };
      });
      return renderedHtml;
    },
    []
  );
  const updateSlidePageStateByIndex = useCallback(
    (slideIndex: number, updater: (state: HtmlSlidePageState) => HtmlSlidePageState | null) => {
      if (loadState.status !== "ready") return null;
      const safeIndex = Math.max(0, Math.min(slideIndex, Math.max(loadState.htmlSlides.length - 1, 0)));
      const fallbackHtml = String((loadState.htmlSlides[safeIndex] || loadState.htmlSlides[0] || null)?.html || "");
      const currentState = pageStatesRef.current[safeIndex] || createHtmlSlidePageState(fallbackHtml);
      const nextState = updater(currentState);
      if (!nextState) return null;
      const renderedHtml = commitRenderedSlideHtml(safeIndex, nextState);
      return { slideIndex: safeIndex, nextState, renderedHtml };
    },
    [commitRenderedSlideHtml, loadState]
  );
  const updateActiveSlidePageState = useCallback(
    (updater: (state: HtmlSlidePageState) => HtmlSlidePageState | null) => {
      if (loadState.status !== "ready") return null;
      const slideIndex = Math.max(0, Math.min(activeSlideIndex, Math.max(loadState.htmlSlides.length - 1, 0)));
      const fallbackHtml = String((loadState.htmlSlides[slideIndex] || loadState.htmlSlides[0] || null)?.html || "");
      const currentState = pageStatesRef.current[slideIndex] || createHtmlSlidePageState(fallbackHtml);
      debugLog("update-active-slide-state-before", {
        slideIndex,
        fallbackHtmlLength: fallbackHtml.length,
        currentElements: currentState.elements.map((element) => ({
          id: element.id,
          type: element.type,
          translateX: element.translateX,
          translateY: element.translateY,
          width: element.width,
          height: element.height,
          rotate: element.rotate,
        })),
      });
      const nextState = updater(currentState);
      if (!nextState) return null;
      const renderedHtml = commitRenderedSlideHtml(slideIndex, nextState);
      debugLog("update-active-slide-state-after", {
        slideIndex,
        renderedHtmlLength: renderedHtml.length,
        nextElements: nextState.elements.map((element) => ({
          id: element.id,
          type: element.type,
          translateX: element.translateX,
          translateY: element.translateY,
          width: element.width,
          height: element.height,
          rotate: element.rotate,
        })),
      });
      return { slideIndex, nextState, renderedHtml };
    },
    [activeSlideIndex, commitRenderedSlideHtml, debugLog, loadState]
  );
  const activeSlideHtml =
    loadState.status === "ready"
      ? String((loadState.htmlSlides[activeSlideIndex] || loadState.htmlSlides[0] || null)?.html || "")
      : "";
  const activePageState =
    pageStates[activeSlideIndex] ||
    (activeSlideHtml.trim() ? createHtmlSlidePageState(activeSlideHtml) : null);
  const activeElements = activePageState?.elements || [];
  const activeSelectedElementId =
    selectedElementSelection && selectedElementSelection.slideIndex === activeSlideIndex
      ? selectedElementSelection.elementId
      : null;
  const selectedElement = activeElements.find((element) => element.id === activeSelectedElementId) || null;
  const { downloadAll } = useHtmlSlideExport();
  const setRestyleStatusForSlide = useCallback((slideIndex: number, status: HtmlSlideRestyleStatus) => {
    setSlideRestyleStatuses((current) => ({
      ...current,
      [slideIndex]: status,
    }));
  }, []);
  const { runRefinePage, refinement } = useHtmlPageRefinement({
    projectId: currentProjectId,
    onPage: (payload) => {
      const pageIndex = Math.max(0, Number(payload?.pageIndex || 0));
      const nextState = createHtmlSlidePageState(String(payload?.page?.html || ""));
      const renderedHtml = commitRenderedSlideHtml(pageIndex, nextState);
      resetBaselineForSlide(pageIndex, nextState);
      setSelectedElementSelection((current) => (current?.slideIndex === pageIndex ? null : current));
      markHtmlDirty();
      if (Number(editorStore.getState().activeSlideIndex || 0) === pageIndex) {
        activePreviewRef.current?.syncStructure(renderedHtml);
        activePreviewRef.current?.highlight(null);
      }
    },
  });
  const { runRefineCarousel, carouselRefinement } = useHtmlCarouselRefinement({
    projectId: currentProjectId,
    onStatus: (payload) => {
      if (payload.phase === "refining-page" && typeof payload.pageIndex === "number") {
        setRestyleStatusForSlide(payload.pageIndex, {
          state: "refining",
          label: "Refining...",
        });
      }
    },
    onPage: (payload) => {
      const pageIndex = Math.max(0, Number(payload?.pageIndex || 0));
      const nextState = createHtmlSlidePageState(String(payload?.page?.html || ""));
      const renderedHtml = commitRenderedSlideHtml(pageIndex, nextState);
      resetBaselineForSlide(pageIndex, nextState);
      setSelectedElementSelection((current) => (current?.slideIndex === pageIndex ? null : current));
      markHtmlDirty();
      setRestyleStatusForSlide(pageIndex, {
        state: "applied",
        label: "Updated",
      });
      if (Number(editorStore.getState().activeSlideIndex || 0) === pageIndex) {
        activePreviewRef.current?.syncStructure(renderedHtml);
        activePreviewRef.current?.highlight(null);
      }
    },
    onPageError: (payload) => {
      if (typeof payload.pageIndex !== "number") return;
      setRestyleStatusForSlide(payload.pageIndex, {
        state: "error",
        label: "Failed",
        error: payload.message,
      });
    },
    onComplete: async () => {
      scheduleSlideRestyleStatusReset();
    },
  });
  const isAnyRefinementRunning = refinement.refining || carouselRefinement.running;
  const effectiveAiStatusLabel = carouselRefinement.running ? carouselRefinement.label : refinement.label;
  const effectiveAiError = carouselRefinement.error || refinement.error;

  const onRefineActivePage = useCallback(
    (prompt: string) => {
      if (loadState.status !== "ready" || !activePageState || !currentProjectId || isAnyRefinementRunning) return;
      activePreviewRef.current?.flushInlineEdit();
      const latestSlideIndex = Math.max(0, Math.min(Number(editorStore.getState().activeSlideIndex || 0), Math.max(loadState.htmlSlides.length - 1, 0)));
      const latestState =
        pageStatesRef.current[latestSlideIndex] ||
        createHtmlSlidePageState(String((loadState.htmlSlides[latestSlideIndex] || loadState.htmlSlides[0] || null)?.html || ""));
      const renderedHtml = renderHtmlSlidePageState(latestState);
      const baselineState = baselinePageStatesRef.current[latestSlideIndex] || latestState;
      const manualEdits = buildManualEditsSummary({
        baseline: baselineState,
        current: latestState,
      });
      pushUndoCheckpoint("ai-refine-page");
      debugLog("refine-page-request", {
        slideIndex: latestSlideIndex,
        promptLength: prompt.length,
        htmlLength: renderedHtml.length,
        manualEditsLength: manualEdits.length,
      });
      void runRefinePage({
        pageIndex: latestSlideIndex,
        html: renderedHtml,
        prompt,
        aspectRatio: "3:4",
        manualEdits,
        htmlGenerationId: loadState.htmlGenerationId,
      });
    },
    [activePageState, currentProjectId, debugLog, editorStore, isAnyRefinementRunning, loadState, runRefinePage]
  );
  const onRefineCarouselSlides = useCallback(
    (prompt: string) => {
      if (loadState.status !== "ready" || !currentProjectId || isAnyRefinementRunning) return;
      activePreviewRef.current?.flushInlineEdit();
      clearSlideRestyleFadeTimer();
      const pages = loadState.htmlSlides
        .map((slide, index) => {
          const currentState =
            pageStatesRef.current[index] || createHtmlSlidePageState(String(slide?.html || ""));
          const renderedHtml = renderHtmlSlidePageState(currentState);
          if (!renderedHtml.trim()) return null;
          const baselineState = baselinePageStatesRef.current[index] || currentState;
          const manualEdits = buildManualEditsSummary({
            baseline: baselineState,
            current: currentState,
          });
          return {
            pageIndex: index,
            html: renderedHtml,
            manualEdits,
          };
        })
        .filter(Boolean) as Array<{ pageIndex: number; html: string; manualEdits?: string }>;
      if (!pages.length) return;
      pushUndoCheckpoint("ai-refine-carousel");
      setSlideRestyleStatuses(
        Object.fromEntries(
          pages.map((page) => [
            page.pageIndex,
            {
              state: "queued",
              label: "Queued",
            } satisfies HtmlSlideRestyleStatus,
          ])
        )
      );
      debugLog("refine-carousel-request", {
        promptLength: prompt.length,
        pageCount: pages.length,
        pages: pages.map((page) => ({
          pageIndex: page.pageIndex,
          htmlLength: page.html.length,
          manualEditsLength: String(page.manualEdits || "").length,
        })),
      });
      void runRefineCarousel({
        pages,
        prompt,
        aspectRatio: "3:4",
        htmlGenerationId: loadState.htmlGenerationId,
      });
    },
    [clearSlideRestyleFadeTimer, currentProjectId, debugLog, isAnyRefinementRunning, loadState, runRefineCarousel]
  );

  const onPatchSelectedElement = useCallback(
    (patch: HtmlElementPatch) => {
      if (loadState.status !== "ready" || !activeSelectedElementId) return;
      queueGroupedUndoCheckpoint("inspector-patch");
      debugLog("inspector-patch", { editableId: activeSelectedElementId, slideIndex: activeSlideIndex, patch });
      updateActiveSlidePageState((state) => patchHtmlSlidePageState(state, activeSelectedElementId, patch));
      markHtmlDirty();
      if (typeof patch.fontFamily === "string") {
        const cssImport = getFontCssImport(patch.fontFamily);
        if (cssImport) activePreviewRef.current?.sendFontCss(cssImport);
      }
    },
    [activeSelectedElementId, activeSlideIndex, debugLog, loadState.status, markHtmlDirty, queueGroupedUndoCheckpoint, updateActiveSlidePageState]
  );

  const onTextCommit = useCallback(
    (editableId: string, _text: string, html: string, slideIndex: number) => {
      if (loadState.status !== "ready" || !editableId) return;
      pushUndoCheckpoint("text-commit");
      debugLog("text-commit", { editableId, slideIndex, htmlLength: html.length });
      updateSlidePageStateByIndex(slideIndex, (state) => patchHtmlSlidePageState(state, editableId, { html }));
      markHtmlDirty();
    },
    [debugLog, loadState.status, markHtmlDirty, pushUndoCheckpoint, updateSlidePageStateByIndex]
  );

  const onDeselectAll = useCallback(() => {
    setSelectedElementSelection((current) => (current?.slideIndex === activeSlideIndex ? null : current));
  }, [activeSlideIndex]);
  const onTransformElement = useCallback(
    (editableId: string, patch: HtmlElementPatch, slideIndex: number) => {
      if (loadState.status !== "ready" || !editableId) return;
      pushUndoCheckpoint("transform");
      debugLog("transform-received", { editableId, slideIndex, patch });
      updateSlidePageStateByIndex(slideIndex, (state) => patchHtmlSlidePageState(state, editableId, patch));
      markHtmlDirty();
    },
    [debugLog, loadState.status, markHtmlDirty, pushUndoCheckpoint, updateSlidePageStateByIndex]
  );
  const onAddElement = useCallback(
    (kind: AddElementKind) => {
      if (loadState.status !== "ready") return;
      pushUndoCheckpoint("add-element");
      activePreviewRef.current?.flushInlineEdit();
      let insertedId: string | null = null;
      let nextHtmlForSync: string | null = null;
      updateActiveSlidePageState((state) => {
        const renderedHtml = renderHtmlSlidePageState(state);
        const result = addElementToHtml(renderedHtml, kind);
        insertedId = String(result?.editableId || "").trim() || null;
        nextHtmlForSync = String(result?.html || "");
        return createHtmlSlidePageState(nextHtmlForSync);
      });
      if (nextHtmlForSync) {
        activePreviewRef.current?.syncStructure(nextHtmlForSync);
      }
      if (insertedId) {
        setSelectedElementSelection({ slideIndex: activeSlideIndex, elementId: insertedId });
      }
      markHtmlDirty();
    },
    [activeSlideIndex, loadState.status, markHtmlDirty, pushUndoCheckpoint, updateActiveSlidePageState]
  );
  const onDuplicateElement = useCallback(
    (elementId: string) => {
      if (loadState.status !== "ready" || !elementId) return;
      pushUndoCheckpoint("duplicate-element");
      activePreviewRef.current?.flushInlineEdit();
      let nextHtmlForSync: string | null = null;
      let duplicatedId: string | null = null;
      updateActiveSlidePageState((state) => {
        const renderedHtml = renderHtmlSlidePageState(state);
        const result = duplicateElementInHtml(renderedHtml, elementId);
        nextHtmlForSync = String(result?.html || "");
        duplicatedId = String(result?.editableId || "").trim() || null;
        return createHtmlSlidePageState(nextHtmlForSync);
      });
      if (nextHtmlForSync) {
        activePreviewRef.current?.syncStructure(nextHtmlForSync);
      }
      if (duplicatedId) {
        setSelectedElementSelection({ slideIndex: activeSlideIndex, elementId: duplicatedId });
      }
      markHtmlDirty();
    },
    [activeSlideIndex, loadState.status, markHtmlDirty, pushUndoCheckpoint, updateActiveSlidePageState]
  );
  const onDeleteElement = useCallback(
    (elementId: string) => {
      if (loadState.status !== "ready" || !elementId) return;
      pushUndoCheckpoint("delete-element");
      activePreviewRef.current?.flushInlineEdit();
      let nextHtmlForSync: string | null = null;
      updateActiveSlidePageState((state) => {
        const renderedHtml = renderHtmlSlidePageState(state);
        const result = deleteElementInHtml(renderedHtml, elementId);
        nextHtmlForSync = result;
        return createHtmlSlidePageState(result);
      });
      if (nextHtmlForSync) {
        activePreviewRef.current?.syncStructure(nextHtmlForSync);
      }
      setSelectedElementSelection(null);
      markHtmlDirty();
    },
    [loadState.status, markHtmlDirty, pushUndoCheckpoint, updateActiveSlidePageState]
  );
  const onClearRichText = useCallback(
    (elementId: string, plainText: string) => {
      if (loadState.status !== "ready" || !elementId) return;
      pushUndoCheckpoint("clear-rich-text");
      activePreviewRef.current?.flushInlineEdit();
      updateActiveSlidePageState((state) => patchHtmlSlidePageState(state, elementId, { text: plainText }));
      markHtmlDirty();
    },
    [loadState.status, markHtmlDirty, pushUndoCheckpoint, updateActiveSlidePageState]
  );
  const onApplyFontToAllPages = useCallback(
    (fontFamily: string) => {
      const normalizedFont = String(fontFamily || "").trim();
      if (loadState.status !== "ready" || !normalizedFont || normalizedFont === "inherit") return;
      pushUndoCheckpoint("apply-font-to-all-pages");
      for (let index = 0; index < loadState.htmlSlides.length; index += 1) {
        updateSlidePageStateByIndex(index, (state) => {
          let changed = false;
          const elements = state.elements.map((element) => {
            if (element.type !== "text" || element.fontFamily === normalizedFont) return element;
            changed = true;
            return {
              ...element,
              fontFamily: normalizedFont,
            };
          });
          return changed ? { ...state, elements } : state;
        });
      }
      const cssImport = getFontCssImport(normalizedFont);
      if (cssImport) activePreviewRef.current?.sendFontCss(cssImport);
      markHtmlDirty();
    },
    [loadState, markHtmlDirty, pushUndoCheckpoint, updateSlidePageStateByIndex]
  );
  const onSelectSlide = useCallback(
    (nextIndex: number) => {
      activePreviewRef.current?.flushInlineEdit();
      setSelectedElementSelection(null);
      editorStore.setState({ activeSlideIndex: nextIndex } as any);
    },
    [editorStore]
  );
  const performDeleteSelected = useCallback(() => {
    const currentSelection = selectedElementSelection;
    if (!currentSelection) return;
    if (currentSelection.slideIndex !== Number(editorStore.getState().activeSlideIndex || 0)) return;
    onDeleteElement(currentSelection.elementId);
  }, [editorStore, onDeleteElement, selectedElementSelection]);

  useEffect(() => {
    setSelectedElementSelection(null);
    setSlideRestyleStatuses({});
    clearSlideRestyleFadeTimer();
  }, [currentProjectId]);

  useEffect(() => {
    if (loadState.status !== "ready" || !currentProjectId || !hasUnsavedHtmlChanges) return;
    if (htmlSaveTimeoutRef.current) window.clearTimeout(htmlSaveTimeoutRef.current);
    htmlSaveTimeoutRef.current = window.setTimeout(() => {
      void flushHtmlSave({ reason: "autosave" });
    }, 700);

    return () => {
      if (htmlSaveTimeoutRef.current) window.clearTimeout(htmlSaveTimeoutRef.current);
    };
  }, [currentProjectId, flushHtmlSave, hasUnsavedHtmlChanges, htmlDirtyRevision, loadState.status]);

  useEffect(() => {
    if (!hasUnsavedHtmlChanges && editorStore.getState().slideSaveStatus !== "saving") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editorStore, hasUnsavedHtmlChanges]);

  useEffect(() => {
    if (loadState.status !== "ready" || !hasUnsavedHtmlChanges) return;
    if (sessionDraftTimeoutRef.current) window.clearTimeout(sessionDraftTimeoutRef.current);
    sessionDraftTimeoutRef.current = window.setTimeout(() => {
      const snapshot = createSnapshotFromCurrentState("session-draft");
      if (snapshot) writeHtmlSessionDraft(snapshot);
      sessionDraftTimeoutRef.current = null;
    }, 500);
    return () => {
      if (sessionDraftTimeoutRef.current) window.clearTimeout(sessionDraftTimeoutRef.current);
    };
  }, [createSnapshotFromCurrentState, hasUnsavedHtmlChanges, htmlDirtyRevision, loadState.status]);

  useEffect(() => {
    if (loadState.status !== "ready") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (unsavedDialogMode) return;
      if (command && (event.key === "s" || event.key === "S")) {
        event.preventDefault();
        void performSave();
        return;
      }
      if (shouldIgnoreShellShortcut(event.target)) return;
      if (command && !event.shiftKey && (event.key === "z" || event.key === "Z")) {
        event.preventDefault();
        performUndo();
        return;
      }
      if (command && event.shiftKey && (event.key === "z" || event.key === "Z")) {
        event.preventDefault();
        performRedo();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && activeSelectedElementId) {
        event.preventDefault();
        performDeleteSelected();
        return;
      }
      if (event.key === "Escape" && selectedElementSelection) {
        event.preventDefault();
        activePreviewRef.current?.flushInlineEdit();
        setSelectedElementSelection(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeSelectedElementId,
    loadState.status,
    performDeleteSelected,
    performRedo,
    performSave,
    performUndo,
    selectedElementSelection,
    unsavedDialogMode,
  ]);

  useEffect(() => {
    const baseActions = editorStore.getState().actions as any;

    editorStore.setState({
      actions: {
        ...baseActions,
        setIsSuperadmin: (next: boolean) => {
          editorStore.setState({ isSuperadmin: !!next } as any);
        },
        onSignOut: async () => {
          await supabase.auth.signOut();
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
        },
        onChangeNewProjectTemplateTypeId: (next: "regular" | "enhanced" | "html") => {
          editorStore.setState({ newProjectTemplateTypeId: next } as any);
        },
        onDownloadAll: async () => {
          const projectId = String(editorStore.getState().currentProjectId || "").trim();
          const projectTitle = String(editorStore.getState().projectTitle || "html-carousel");
          if (!projectId) return;
          editorStore.setState({ topExporting: true } as any);
          try {
            const saved = await performSave();
            if (!saved) return;
            await downloadAll({ projectId, projectTitle });
          } finally {
            editorStore.setState({ topExporting: false } as any);
          }
        },
        onDownloadPdf: () => {},
        onClickNewProject: async () => {
          const type = (editorStore.getState().newProjectTemplateTypeId || "enhanced") as "regular" | "enhanced" | "html";
          requestNavigationAction({ type: "create-project", templateTypeId: type });
        },
        onToggleProjectsDropdown: () => {
          const open = !!editorStore.getState().projectsDropdownOpen;
          editorStore.setState({ projectsDropdownOpen: !open } as any);
        },
        onLoadProject: (projectId: string) => {
          requestNavigationAction({ type: "load-project", projectId });
        },
        onClickUndo: () => {
          performUndo();
        },
        onRequestArchive: (target: { id: string; title: string }) => {
          editorStore.setState({ archiveProjectModalOpen: true, archiveProjectTarget: target } as any);
        },
        onCancelArchive: () => {
          editorStore.setState({ archiveProjectModalOpen: false, archiveProjectTarget: null, archiveProjectBusy: false } as any);
        },
        onConfirmArchive: async (target: { id: string; title: string }) => {
          const projectId = String(target?.id || "").trim();
          if (!projectId) return;
          editorStore.setState({ archiveProjectBusy: true } as any);
          try {
            await archiveProject(projectId);
            editorStore.setState({ archiveProjectModalOpen: false, archiveProjectTarget: null, archiveProjectBusy: false } as any);
            await hydrate();
          } catch {
            editorStore.setState({ archiveProjectBusy: false } as any);
          }
        },
        onOpenSwipeFileModal: () => {
          editorStore.setState({ swipeFileModalOpen: true } as any);
        },
        onCloseSwipeFileModal: () => {
          editorStore.setState({ swipeFileModalOpen: false } as any);
        },
      },
    } as any);
  }, [downloadAll, editorStore, hydrate, performSave, performUndo, requestNavigationAction]);

  const content = useMemo(() => {
    if (loadState.status === "loading") {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
            Loading html workspace...
          </div>
        </div>
      );
    }

    if (loadState.status === "error") {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="max-w-md rounded-2xl border border-red-200 bg-white px-6 py-5 text-center shadow-sm">
            <div className="text-lg font-semibold text-slate-900">HTML workspace failed to load</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{loadState.message}</div>
            <button
              type="button"
              className="mt-4 h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    const persistedPresetSelected =
      !!String(loadState.htmlPresetId || "").trim() ||
      !!(loadState.htmlStyleGuide && typeof loadState.htmlStyleGuide === "object" && Object.keys(loadState.htmlStyleGuide).length);
    const hasCopy = (loadState.slides || []).some((slide) => String(slide?.headline || "").trim() || String(slide?.body || "").trim());
    const hasGeneratedSlides = (loadState.htmlSlides || []).some((slide) => String(slide?.html || "").trim());
    const workspaceHtmlSlides =
      loadState.htmlSlides.length > 0
        ? loadState.htmlSlides
        : Array.from({ length: Math.max(loadState.slides.length, 6) }).map((_, index) => ({
            id: `placeholder-${index}`,
            slideIndex: index,
            html: null,
            pageTitle: null,
            pageType: null,
          }));
    const stage = !hasCopy
      ? "generate-copy"
      : hasGeneratedSlides
        ? "editing"
        : selectedPreset
          ? "generate-slides"
          : "choose-preset";
    const activeCopySlide = loadState.slides[activeSlideIndex] || loadState.slides[0] || null;
    const activeCopyPreview = [String(activeCopySlide?.headline || "").trim(), String(activeCopySlide?.body || "").trim()]
      .filter(Boolean)
      .join("\n");
    const placeholderTitle =
      stage === "generate-copy"
        ? "Generate copy to get started"
        : stage === "choose-preset"
          ? "Choose a preset next"
          : stage === "generate-slides"
            ? "Generate slide visuals"
            : "HTML slide workspace";
    const placeholderDescription =
      stage === "generate-copy"
        ? "Generate structured copy first. The html workspace keeps all six slides in horizontal order, but each card stays a placeholder until copy exists."
        : stage === "choose-preset"
          ? activeCopyPreview
            ? `Copy exists for this slide. Choose a preset next so the html row can be rendered from this content.\n${activeCopyPreview}`
            : "Copy exists for the project. Choose a preset next so the html row can be rendered."
          : stage === "generate-slides"
            ? "A preset is selected. Generate slides to replace these placeholders with live html previews."
            : "The dedicated html workspace is active. Use the horizontal row to switch slides while editing the active iframe.";

    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {!isMobile ? (
          <ResizablePanel side="left" defaultWidth={380} minWidth={280} maxWidth={520} className="border-r border-slate-200 bg-white">
            <div className="h-full overflow-y-auto">
              <EditorSidebar />
            </div>
          </ResizablePanel>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
          {isMobile ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="text-xl font-semibold text-slate-900">Use desktop for HTML editing</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  The html editor keeps the shared product shell, but phone editing is still out of scope in v1.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <HtmlEditorWorkspace
                  ref={activePreviewRef}
                  stage={stage}
                  documentKeyBase={
                    loadState.status === "ready"
                      ? `${String(loadState.project?.id || "html")}::${String(loadState.htmlGenerationId || "base")}`
                      : "html"
                  }
                  activeSlideIndex={activeSlideIndex}
                  htmlSlides={workspaceHtmlSlides}
                  slideElements={pageStates.map((state) => state.elements)}
                  copySlides={loadState.slides}
                  selectedElementId={activeSelectedElementId}
                  onSelectEditableId={(editableId, slideIndex) => {
                    editorStore.setState({ activeSlideIndex: slideIndex } as any);
                    setSelectedElementSelection({ slideIndex, elementId: editableId });
                  }}
                  onDeselectAll={onDeselectAll}
                  onTextCommit={onTextCommit}
                  onTransform={onTransformElement}
                  onRequestUndo={performUndo}
                  onRequestRedo={performRedo}
                  onRequestSave={() => {
                    void performSave();
                  }}
                  onRequestDeleteSelected={performDeleteSelected}
                  onSelectSlide={onSelectSlide}
                  placeholderTitle={placeholderTitle}
                  placeholderDescription={placeholderDescription}
                  slideRestyleStatuses={slideRestyleStatuses}
                  hasCopy={hasCopy}
                  hasGeneratedSlides={hasGeneratedSlides}
                  presets={presets}
                  selectedPresetId={selectedPreset?.id || selectedPresetId}
                  onSelectPreset={(presetId) => setSelectedPresetId(presetId)}
                />

                <ResizablePanel side="right" defaultWidth={340} minWidth={280} maxWidth={520} className="border-l border-slate-200 bg-white">
                  <HtmlInspectorPanel
                    selectedElement={selectedElement}
                    elements={activeElements}
                    selectedElementId={activeSelectedElementId}
                    onSelectElement={(editableId) => setSelectedElementSelection({ slideIndex: activeSlideIndex, elementId: editableId })}
                    onDeselectElement={onDeselectAll}
                    onAddElement={onAddElement}
                    onDuplicateElement={onDuplicateElement}
                    onDeleteElement={onDeleteElement}
                    onClearRichText={onClearRichText}
                    onApplyFontToAllPages={onApplyFontToAllPages}
                    totalPages={loadState.htmlSlides.length}
                    onPatchSelectedElement={onPatchSelectedElement}
                    onRefinePage={onRefineActivePage}
                    onRefineCarousel={onRefineCarouselSlides}
                    aiBusy={isAnyRefinementRunning}
                    aiStatusLabel={effectiveAiStatusLabel}
                    aiError={effectiveAiError}
                    stage={stage}
                  />
                </ResizablePanel>
              </div>

              <HtmlBottomPanel
                stage={stage}
                caption={String(loadState.project?.caption || "")}
                promptSnapshot={String(loadState.project?.prompt_snapshot || "")}
                generationStatus={generation.generating ? "generating" : loadState.htmlGenerationStatus}
                slideCount={workspaceHtmlSlides.length}
                onPrimaryAction={
                  stage === "generate-copy"
                    ? () => void runGenerateCopy()
                    : stage === "generate-slides" && selectedPreset
                      ? () => {
                          setLoadState((prev) =>
                            prev.status !== "ready"
                              ? prev
                              : {
                                  ...prev,
                                  htmlGenerationStatus: "generating",
                                  htmlStyleGuide: selectedPreset.styleGuide,
                                }
                          );
                          void runGenerateSlides({
                            presetId: selectedPreset.id,
                            content: buildHtmlContentString(String(loadState.project?.title || ""), loadState.slides),
                          });
                        }
                      : undefined
                }
                primaryActionBusy={stage === "generate-copy" ? copyProgress.copyGenerating : generation.generating}
                primaryActionLabel={stage === "generate-copy" ? copyProgress.label : generation.label}
                primaryActionError={stage === "generate-copy" ? copyProgress.error : generation.error}
              />
            </>
          )}
        </div>

        <SwipeFileModal />
      </div>
    );
  }, [
    activeSlideIndex,
    copyProgress.copyGenerating,
    copyProgress.error,
    copyProgress.label,
    generation.error,
    generation.generating,
    generation.label,
    hasUnsavedHtmlChanges,
    isMobile,
    isAnyRefinementRunning,
    loadState,
    onAddElement,
    onApplyFontToAllPages,
    onClearRichText,
    onDeleteElement,
    onDeselectAll,
    onDuplicateElement,
    onRefineActivePage,
    onRefineCarouselSlides,
    onSelectSlide,
    onTransformElement,
    onPatchSelectedElement,
    performDeleteSelected,
    performRedo,
    performSave,
    performUndo,
    onTextCommit,
    activeElements,
    pageStates,
    presets,
    runGenerateCopy,
    runGenerateSlides,
    selectedElement,
    activeSelectedElementId,
    selectedPreset,
    selectedPresetId,
    effectiveAiError,
    effectiveAiStatusLabel,
    slideRestyleStatuses,
  ]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <EditorTopBar />
      {content}
      <HtmlUnsavedChangesDialog
        open={!!unsavedDialogMode}
        mode={unsavedDialogMode || "unsaved-navigation"}
        busy={unsavedDialogBusy}
        error={unsavedDialogError}
        onCancel={dismissUnsavedDialog}
        onDiscard={() => {
          void handleUnsavedDialogDiscard();
        }}
        onPrimary={() => {
          void handleUnsavedDialogPrimary();
        }}
      />
    </div>
  );
}
