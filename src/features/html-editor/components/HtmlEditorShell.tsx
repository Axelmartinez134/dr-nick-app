"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorTopBar } from "@/features/editor/components/EditorTopBar";
import { EditorSidebar } from "@/features/editor/components/EditorSidebar";
import { SwipeFileModal } from "@/features/editor/components/SwipeFileModal";
import { useEditorSelector, useEditorStore } from "@/features/editor/store";
import { supabase } from "@/app/components/auth/AuthContext";
import { HtmlBottomPanel } from "./HtmlBottomPanel";
import { HtmlEditorWorkspace } from "./HtmlEditorWorkspace";
import { HtmlInspectorPanel } from "./HtmlInspectorPanel";
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
import { useHtmlSlideGeneration } from "../hooks/useHtmlSlideGeneration";
import type { HtmlDesignPreset } from "../lib/presets";
import { useHtmlElementParser } from "../hooks/useHtmlElementParser";
import { applyElementPatchToHtml, type HtmlElementPatch } from "../hooks/useHtmlElementSerializer";
import { useHtmlSlideExport } from "../hooks/useHtmlSlideExport";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | ({ status: "ready" } & HtmlProjectShellData);

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
  const [presets, setPresets] = useState<HtmlDesignPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [htmlDirtyRevision, setHtmlDirtyRevision] = useState(0);
  const [hasUnsavedHtmlChanges, setHasUnsavedHtmlChanges] = useState(false);
  const htmlSaveTimeoutRef = useRef<number | null>(null);
  const htmlSaveResetTimeoutRef = useRef<number | null>(null);

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
      const currentActiveSlideIndex = Number(editorStore.getState().activeSlideIndex || 0);
      const clampedActiveSlideIndex = Math.max(
        0,
        Math.min(currentActiveSlideIndex, Math.max((data.htmlSlides?.length || 1) - 1, 0))
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
      setLoadState({ status: "ready", ...data });
      return data;
    },
    [editorStore]
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
      setLoadState((prev) => {
        if (prev.status !== "ready") return prev;
        const nextSlides = [...prev.htmlSlides];
        const pageIndex = Math.max(0, Math.min(Number(payload?.pageIndex || 0), 5));
        const existing = nextSlides[pageIndex] || {
          id: `generated-${pageIndex}`,
          slideIndex: pageIndex,
          html: null,
          pageTitle: null,
          pageType: null,
        };
        nextSlides[pageIndex] = {
          ...existing,
          html: String(payload?.page?.html || ""),
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
  const activeSlideHtml =
    loadState.status === "ready"
      ? String((loadState.htmlSlides[activeSlideIndex] || loadState.htmlSlides[0] || null)?.html || "")
      : "";
  const parsedActiveSlide = useHtmlElementParser(activeSlideHtml);
  const selectedElement = parsedActiveSlide.elements.find((element) => element.id === selectedElementId) || null;
  const { downloadAll } = useHtmlSlideExport();
  const onPatchSelectedElement = useCallback(
    (patch: HtmlElementPatch) => {
      if (loadState.status !== "ready" || !selectedElementId) return;
      setLoadState((prev) => {
        if (prev.status !== "ready") return prev;
        const nextSlides = [...prev.htmlSlides];
        const index = Math.max(0, Math.min(activeSlideIndex, nextSlides.length - 1));
        const target = nextSlides[index];
        if (!target) return prev;
        const nextHtml = applyElementPatchToHtml(String(target.html || ""), selectedElementId, patch);
        nextSlides[index] = { ...target, html: nextHtml };
        return { ...prev, htmlSlides: nextSlides };
      });
      setHtmlDirtyRevision((value) => value + 1);
      setHasUnsavedHtmlChanges(true);
    },
    [activeSlideIndex, loadState.status, selectedElementId]
  );
  const onSelectSlide = useCallback(
    (nextIndex: number) => {
      editorStore.setState({ activeSlideIndex: nextIndex } as any);
    },
    [editorStore]
  );

  useEffect(() => {
    if (loadState.status !== "ready") return;
    const active = loadState.htmlSlides[activeSlideIndex] || loadState.htmlSlides[0] || null;
    if (!active || !String(active.html || "").trim()) return;
    if (parsedActiveSlide.normalizedHtml === String(active.html || "")) return;
    setLoadState((prev) => {
      if (prev.status !== "ready") return prev;
      const nextSlides = [...prev.htmlSlides];
      const index = Math.max(0, Math.min(activeSlideIndex, nextSlides.length - 1));
      const target = nextSlides[index];
      if (!target) return prev;
      nextSlides[index] = { ...target, html: parsedActiveSlide.normalizedHtml };
      return { ...prev, htmlSlides: nextSlides };
    });
    setHtmlDirtyRevision((value) => value + 1);
    setHasUnsavedHtmlChanges(true);
  }, [activeSlideIndex, loadState, parsedActiveSlide.normalizedHtml]);

  useEffect(() => {
    setSelectedElementId(null);
  }, [activeSlideIndex, currentProjectId]);

  useEffect(() => {
    if (loadState.status !== "ready" || !currentProjectId || !hasUnsavedHtmlChanges) return;
    if (htmlSaveTimeoutRef.current) window.clearTimeout(htmlSaveTimeoutRef.current);
    htmlSaveTimeoutRef.current = window.setTimeout(() => {
      editorStore.setState({ slideSaveStatus: "saving" } as any);
      void saveHtmlSlides({
        projectId: currentProjectId,
        slides: loadState.htmlSlides.map((slide, index) => ({
          slideIndex: index,
          html: String(slide?.html || ""),
          pageTitle: slide?.pageTitle ?? null,
          pageType: slide?.pageType ?? null,
        })),
      })
        .then(() => {
          setHasUnsavedHtmlChanges(false);
          editorStore.setState({ slideSaveStatus: "saved" } as any);
          if (htmlSaveResetTimeoutRef.current) window.clearTimeout(htmlSaveResetTimeoutRef.current);
          htmlSaveResetTimeoutRef.current = window.setTimeout(() => {
            editorStore.setState({ slideSaveStatus: "idle" } as any);
          }, 1200);
        })
        .catch(() => {
          editorStore.setState({ slideSaveStatus: "error" } as any);
        });
    }, 700);

    return () => {
      if (htmlSaveTimeoutRef.current) window.clearTimeout(htmlSaveTimeoutRef.current);
    };
  }, [currentProjectId, editorStore, hasUnsavedHtmlChanges, htmlDirtyRevision, loadState]);

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
            const currentState = loadState.status === "ready" ? loadState : null;
            if (currentState) {
              await saveHtmlSlides({
                projectId,
                slides: currentState.htmlSlides.map((slide, index) => ({
                  slideIndex: index,
                  html: String(slide?.html || ""),
                  pageTitle: slide?.pageTitle ?? null,
                  pageType: slide?.pageType ?? null,
                })),
              });
              setHasUnsavedHtmlChanges(false);
            }
            await downloadAll({ projectId, projectTitle });
          } finally {
            editorStore.setState({ topExporting: false } as any);
          }
        },
        onDownloadPdf: () => {},
        onClickNewProject: async () => {
          const type = (editorStore.getState().newProjectTemplateTypeId || "enhanced") as "regular" | "enhanced" | "html";
          const data = await createProject(type);
          const projectId = String(data?.project?.id || "").trim();
          if (!projectId) return;
          setRuntimeProjectIdHint(projectId);
          window.location.reload();
        },
        onToggleProjectsDropdown: () => {
          const open = !!editorStore.getState().projectsDropdownOpen;
          editorStore.setState({ projectsDropdownOpen: !open } as any);
        },
        onLoadProject: (projectId: string) => {
          setRuntimeProjectIdHint(projectId);
          window.location.reload();
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
  }, [downloadAll, editorStore, hydrate, loadState]);

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
          <aside className="w-[380px] shrink-0 border-r border-slate-200 bg-white">
            <EditorSidebar />
          </aside>
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
                  stage={stage}
                  activeSlideIndex={activeSlideIndex}
                  htmlSlides={workspaceHtmlSlides}
                  copySlides={loadState.slides}
                  selectedElementId={selectedElementId}
                  onSelectEditableId={(editableId) => setSelectedElementId(editableId)}
                  onSelectSlide={onSelectSlide}
                  placeholderTitle={placeholderTitle}
                  placeholderDescription={placeholderDescription}
                  hasCopy={hasCopy}
                  hasGeneratedSlides={hasGeneratedSlides}
                  presets={presets}
                  selectedPresetId={selectedPreset?.id || selectedPresetId}
                  onSelectPreset={(presetId) => setSelectedPresetId(presetId)}
                />

                <HtmlInspectorPanel
                  selectedElement={selectedElement}
                  elements={parsedActiveSlide.elements}
                  selectedElementId={selectedElementId}
                  onSelectElement={(editableId) => setSelectedElementId(editableId)}
                  onPatchSelectedElement={onPatchSelectedElement}
                  projectTitle={String(loadState.project?.title || "Untitled Project")}
                  stage={stage}
                  selectedPreset={selectedPreset}
                  persistedPresetSelected={persistedPresetSelected}
                  generationStatus={generation.generating ? "generating" : loadState.htmlGenerationStatus}
                  presetsCount={presets.length}
                  hasUnsavedHtmlChanges={hasUnsavedHtmlChanges}
                />
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
    loadState,
    onSelectSlide,
    onPatchSelectedElement,
    parsedActiveSlide.elements,
    presets,
    runGenerateCopy,
    runGenerateSlides,
    selectedElement,
    selectedElementId,
    selectedPreset,
    selectedPresetId,
  ]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <EditorTopBar />
      {content}
    </div>
  );
}
