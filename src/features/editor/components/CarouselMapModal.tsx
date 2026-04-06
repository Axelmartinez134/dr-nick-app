"use client";

import type { DragEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";
import { useEditorSelector } from "@/features/editor/store";
import { CarouselMapProjectPickerModal } from "@/features/editor/components/CarouselMapProjectPickerModal";
import type {
  CarouselMapExpansion,
  CarouselMapGraph,
  CarouselMapOpeningPair,
  CarouselMapPromptKey,
  CarouselMapPromptState,
  CarouselMapSteeringState,
} from "@/features/editor/components/carousel-map/types";

type Props = {
  open: boolean;
  swipeItemId: string | null;
  mapId?: string | null;
  swipeItemLabel?: string | null;
  onClose: () => void;
  onLoadProject?: (projectId: string, templateTypeId?: TemplateTypeId) => void;
};

type TemplateTypeId = "regular" | "enhanced" | "html";

type LinePath = {
  id: string;
  d: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  dashArray?: string;
};

type Point = { x: number; y: number };

const PROMPT_STAGE_META: Record<
  CarouselMapPromptKey,
  { title: string; modalTitle: string; emptyError: string }
> = {
  topics: {
    title: "Topics",
    modalTitle: "Edit Topics Prompt",
    emptyError: "Enter a Topics prompt before generating.",
  },
  opening_pairs: {
    title: "Opening Pairs",
    modalTitle: "Edit Opening Pairs Prompt",
    emptyError: "Enter an Opening Pairs prompt before generating.",
  },
  expansions: {
    title: "Slides 3-6",
    modalTitle: "Edit Slides 3-6 Prompt",
    emptyError: "Enter a Slides 3-6 prompt before generating.",
  },
};

const STEERING_STAGE_META: Record<
  CarouselMapPromptKey,
  { buttonLabel: string; modalTitle: string; helperText: string; lastUsedLabel: string }
> = {
  topics: {
    buttonLabel: "Steer",
    modalTitle: "Steer Topics",
    helperText: "Steer the AI output here with your direction. This will be used for the next Topics generation only when you submit.",
    lastUsedLabel: "Last steering used",
  },
  opening_pairs: {
    buttonLabel: "Steer",
    modalTitle: "Steer Opening Pairs",
    helperText: "Steer the AI output here with your direction. This applies to the currently selected topic when you submit.",
    lastUsedLabel: "Last steering used",
  },
  expansions: {
    buttonLabel: "Steer",
    modalTitle: "Steer Slides 3-6",
    helperText: "Steer the AI output here with your direction. This applies to the current chosen opening when you submit.",
    lastUsedLabel: "Last steering used",
  },
};

function getActiveAccountHeader(): Record<string, string> {
  try {
    const id = typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
    return id ? { "x-account-id": id } : {};
  } catch {
    return {};
  }
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function authedFetchJson(url: string, init?: RequestInit) {
  const token = await getToken();
  if (!token) throw new Error("Missing auth token");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...getActiveAccountHeader(),
    ...(init?.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(String(json?.error || `Request failed (${res.status})`));
  return json;
}

function truncate(input: string, max = 260) {
  const raw = String(input || "").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}

function buildCurve(from: Point, to: Point) {
  const dx = Math.max(60, Math.abs(to.x - from.x) * 0.5);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

function LaneShell(props: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  contentRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <section className="relative z-10 min-w-[320px] max-w-[380px] h-full flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">{props.title}</div>
        {props.action ? <div className="shrink-0">{props.action}</div> : null}
      </div>
      <div ref={props.contentRef} className="carousel-map-lane-scroll min-h-0 flex-1 overflow-auto p-4">
        {props.children}
      </div>
    </section>
  );
}

function CarouselMapStagePromptModal(props: {
  open: boolean;
  stageKey: CarouselMapPromptKey | null;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
}) {
  if (!props.open || !props.stageKey) return null;
  const meta = PROMPT_STAGE_META[props.stageKey];
  return (
    <div
      className="fixed inset-0 z-[255] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">{meta.modalTitle}</div>
            <div className="mt-1 text-xs text-slate-500">Edit only the creative instruction text. Output format and schema remain locked by the system.</div>
          </div>
          <button
            type="button"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>
        <div className="p-5">
          <textarea
            className="min-h-[320px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder="Enter prompt..."
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500">Autosaves while typing.</div>
            <div className="text-[11px]">
              {props.saveStatus === "saving" ? <span className="text-slate-500">Saving…</span> : null}
              {props.saveStatus === "saved" ? <span className="text-emerald-700">Saved</span> : null}
              {props.saveStatus === "error" ? <span className="text-red-600">❌ {props.saveError || "Save failed"}</span> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CarouselMapSteeringModal(props: {
  open: boolean;
  stageKey: CarouselMapPromptKey | null;
  value: string;
  error: string | null;
  busy: boolean;
  submitLabel: string;
  onChange: (next: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!props.open || !props.stageKey) return null;
  const meta = STEERING_STAGE_META[props.stageKey];
  return (
    <div
      className="fixed inset-0 z-[255] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !props.busy) props.onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">{meta.modalTitle}</div>
            <div className="mt-1 text-xs text-slate-500">{meta.helperText}</div>
          </div>
          <button
            type="button"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={props.onClose}
            disabled={props.busy}
          >
            Close
          </button>
        </div>
        <div className="p-5">
          <textarea
            className="min-h-[240px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder="Tell the AI how you want to steer the next output..."
            disabled={props.busy}
          />
          {props.error ? <div className="mt-3 text-sm text-red-600">❌ {props.error}</div> : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500">Leave blank to proceed without saved steering.</div>
            <button
              type="button"
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              onClick={props.onSubmit}
              disabled={props.busy}
            >
              {props.busy ? "Working…" : props.submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GenerateWithSteeringControls(props: {
  label: string;
  disabled?: boolean;
  onGenerate: () => void;
  onSteer: () => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="h-8 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        disabled={props.disabled}
        onClick={props.onGenerate}
      >
        {props.label}
      </button>
      <div className="w-px bg-slate-200" />
      <button
        type="button"
        className="h-8 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        disabled={props.disabled}
        onClick={props.onSteer}
        title="Steer the next output"
      >
        Steer
      </button>
    </div>
  );
}

export function CarouselMapModal({ open, swipeItemId, mapId, swipeItemLabel, onClose, onLoadProject }: Props) {
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const [graph, setGraph] = useState<CarouselMapGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [stagePrompts, setStagePrompts] = useState<Record<CarouselMapPromptKey, CarouselMapPromptState> | null>(null);
  const [promptEditorKey, setPromptEditorKey] = useState<CarouselMapPromptKey | null>(null);
  const [promptEditorDraft, setPromptEditorDraft] = useState("");
  const [promptSaveStatus, setPromptSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [promptSaveError, setPromptSaveError] = useState<string | null>(null);
  const [steeringModalKey, setSteeringModalKey] = useState<CarouselMapPromptKey | null>(null);
  const [steeringDraft, setSteeringDraft] = useState("");
  const [steeringBusy, setSteeringBusy] = useState(false);
  const [steeringError, setSteeringError] = useState<string | null>(null);
  const [templateTypeId, setTemplateTypeId] = useState<TemplateTypeId>(() => {
    try {
      const raw = typeof window !== "undefined" ? String(window.localStorage.getItem("swipeFile.templateTypeId") || "").trim() : "";
      return raw === "regular" || raw === "html" ? raw : "enhanced";
    } catch {
      return "enhanced";
    }
  });
  const templateTypeIdRef = useRef<TemplateTypeId>(templateTypeId);
  const [savedPromptId, setSavedPromptId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerExpansionId, setPickerExpansionId] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [linePaths, setLinePaths] = useState<LinePath[]>([]);
  const [lineLayerSize, setLineLayerSize] = useState({ width: 0, height: 0 });
  const lastOpenRef = useRef<string>("");
  const lineCanvasRef = useRef<HTMLDivElement | null>(null);
  const lineViewportRef = useRef<HTMLDivElement | null>(null);
  const sourceLaneScrollRef = useRef<HTMLDivElement | null>(null);
  const topicLaneScrollRef = useRef<HTMLDivElement | null>(null);
  const openingLaneScrollRef = useRef<HTMLDivElement | null>(null);
  const chosenLaneScrollRef = useRef<HTMLDivElement | null>(null);
  const expansionLaneScrollRef = useRef<HTMLDivElement | null>(null);
  const sourceNodeRef = useRef<HTMLDivElement | null>(null);
  const chosenOpeningGroupRef = useRef<HTMLDivElement | null>(null);
  const chosenSlide1Ref = useRef<HTMLDivElement | null>(null);
  const chosenSlide2Ref = useRef<HTMLDivElement | null>(null);
  const topicRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pairRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const slide1Refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const slide2Refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const expansionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const promptSaveTimeoutRef = useRef<number | null>(null);
  const loadedPromptDraftRef = useRef<Record<CarouselMapPromptKey, string>>({
    topics: "",
    opening_pairs: "",
    expansions: "",
  });
  const digestOrigin = !!graph?.digestTopic;

  useEffect(() => {
    templateTypeIdRef.current = templateTypeId;
    try {
      window.localStorage.setItem("swipeFile.templateTypeId", templateTypeId);
    } catch {
      // ignore
    }
  }, [templateTypeId]);

  useEffect(() => {
    if (!digestOrigin) return;
    if (templateTypeId !== "html") return;
    setTemplateTypeId("enhanced");
  }, [digestOrigin, templateTypeId]);

  const loadGraph = useCallback(async (opts?: { preserveMessage?: boolean }) => {
    const resolvedMapId = String(mapId || "").trim();
    const resolvedSwipeItemId = String(swipeItemId || "").trim();
    if (!resolvedMapId && !resolvedSwipeItemId) return;
    setLoading(true);
    setError(null);
    if (!opts?.preserveMessage) setNotice(null);
    try {
      const url = resolvedMapId
        ? `/api/carousel-map/${encodeURIComponent(resolvedMapId)}`
        : `/api/carousel-map/by-swipe-item/${encodeURIComponent(resolvedSwipeItemId)}`;
      const json = await authedFetchJson(url, { method: "GET" });
      setGraph((json.graph as CarouselMapGraph) || null);
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load Carousel Map"));
    } finally {
      setLoading(false);
    }
  }, [mapId, swipeItemId]);

  const loadStagePrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      const json = await authedFetchJson(`/api/carousel-map/prompts`, { method: "GET" });
      const prompts = (json.prompts || {}) as Record<CarouselMapPromptKey, CarouselMapPromptState>;
      setStagePrompts(prompts);
      loadedPromptDraftRef.current = {
        topics: String(prompts?.topics?.promptText || ""),
        opening_pairs: String(prompts?.opening_pairs?.promptText || ""),
        expansions: String(prompts?.expansions?.promptText || ""),
      };
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load Carousel Map prompts"));
    } finally {
      setPromptsLoading(false);
    }
  }, []);

  useEffect(() => {
    const resolvedId = String(mapId || swipeItemId || "").trim();
    if (!open || !resolvedId) return;
    const key = `${open}:${resolvedId}`;
    if (lastOpenRef.current === key) return;
    lastOpenRef.current = key;
    setGraph(null);
    setError(null);
    setNotice(null);
    setBusyAction(null);
    setPickerOpen(false);
    setPickerExpansionId(null);
    setStagePrompts(null);
    setPromptEditorKey(null);
    setPromptEditorDraft("");
    setPromptSaveStatus("idle");
    setPromptSaveError(null);
    setSteeringModalKey(null);
    setSteeringDraft("");
    setSteeringBusy(false);
    setSteeringError(null);
    void loadGraph();
    void loadStagePrompts();
  }, [loadGraph, loadStagePrompts, mapId, open, swipeItemId]);

  useEffect(() => {
    if (!open) {
      lastOpenRef.current = "";
    }
  }, [open]);

  useEffect(() => {
    if (!promptEditorKey) return;
    const loaded = String(loadedPromptDraftRef.current[promptEditorKey] || "");
    const current = String(promptEditorDraft || "");
    if (current === loaded) return;
    if (promptSaveTimeoutRef.current) window.clearTimeout(promptSaveTimeoutRef.current);
    setPromptSaveStatus("saving");
    setPromptSaveError(null);
    promptSaveTimeoutRef.current = window.setTimeout(() => {
      promptSaveTimeoutRef.current = null;
      void (async () => {
        try {
          const json = await authedFetchJson(`/api/carousel-map/prompts`, {
            method: "POST",
            body: JSON.stringify({ promptKey: promptEditorKey, promptText: current }),
          });
          const prompts = (json.prompts || {}) as Record<CarouselMapPromptKey, CarouselMapPromptState>;
          setStagePrompts(prompts);
          loadedPromptDraftRef.current[promptEditorKey] = String(prompts?.[promptEditorKey]?.promptText || "");
          setPromptSaveStatus("saved");
          window.setTimeout(() => setPromptSaveStatus("idle"), 1200);
        } catch (e: any) {
          setPromptSaveStatus("error");
          setPromptSaveError(String(e?.message || e || "Save failed"));
        }
      })();
    }, 500);
    return () => {
      if (promptSaveTimeoutRef.current) window.clearTimeout(promptSaveTimeoutRef.current);
    };
  }, [promptEditorDraft, promptEditorKey]);

  const selectedTopic = useMemo(
    () => graph?.topics.find((topic) => topic.id === graph.selectedTopicId) || null,
    [graph]
  );
  const openingPairs = useMemo(
    () => (graph?.openingPairs || []).filter((pair) => pair.topicId === selectedTopic?.id),
    [graph, selectedTopic?.id]
  );
  const expansions = useMemo(
    () => (graph?.expansions || []).filter((row) => row.topicId === selectedTopic?.id),
    [graph, selectedTopic?.id]
  );
  const pickerExpansion = useMemo(
    () => expansions.find((row) => row.id === pickerExpansionId) || null,
    [expansions, pickerExpansionId]
  );
  const selectedSlide1Pair =
    graph?.openingPairs.find((pair) => pair.id === graph?.selectedSlide1SourcePairId) || null;
  const selectedSlide2Pair =
    graph?.openingPairs.find((pair) => pair.id === graph?.selectedSlide2SourcePairId) || null;
  const topicsSteering = graph?.topicsSteering || ({ stageKey: "topics", scopeKey: null, steeringText: "", lastUsedSteeringText: "", lastUsedAt: null } as CarouselMapSteeringState);
  const openingPairsSteering =
    graph?.openingPairsSteering ||
    ({ stageKey: "opening_pairs", scopeKey: null, steeringText: "", lastUsedSteeringText: "", lastUsedAt: null } as CarouselMapSteeringState);
  const expansionsSteering =
    graph?.expansionsSteering ||
    ({ stageKey: "expansions", scopeKey: null, steeringText: "", lastUsedSteeringText: "", lastUsedAt: null } as CarouselMapSteeringState);
  const topicsPromptEmpty = !String(stagePrompts?.topics?.promptText || "").trim();
  const openingPairsPromptEmpty = !String(stagePrompts?.opening_pairs?.promptText || "").trim();
  const expansionsPromptEmpty = !String(stagePrompts?.expansions?.promptText || "").trim();

  const openSteeringModal = (stageKey: CarouselMapPromptKey) => {
    const next =
      stageKey === "topics"
        ? topicsSteering.steeringText
        : stageKey === "opening_pairs"
          ? openingPairsSteering.steeringText
          : expansionsSteering.steeringText;
    setSteeringDraft(String(next || ""));
    setSteeringError(null);
    setSteeringModalKey(stageKey);
  };

  const renderLastSteeringBox = (state: CarouselMapSteeringState) => {
    const text = String(state.lastUsedSteeringText || "").trim();
    if (!text) return null;
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
          {STEERING_STAGE_META[state.stageKey].lastUsedLabel}
        </div>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{text}</div>
      </div>
    );
  };

  useEffect(() => {
    if (!open) {
      setLinePaths([]);
      setLineLayerSize({ width: 0, height: 0 });
      return;
    }

    let frame = 0;

    const pointFromEl = (el: HTMLElement | null, side: "left" | "right"): Point | null => {
      const canvas = lineCanvasRef.current;
      if (!canvas || !el) return null;
      const canvasRect = canvas.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      return {
        x: side === "left" ? rect.left - canvasRect.left : rect.right - canvasRect.left,
        y: rect.top + rect.height / 2 - canvasRect.top,
      };
    };

    const recalc = () => {
      frame = 0;
      const canvas = lineCanvasRef.current;
      if (!canvas) {
        setLinePaths([]);
        setLineLayerSize({ width: 0, height: 0 });
        return;
      }

      const nextPaths: LinePath[] = [];

      const sourcePoint = pointFromEl(sourceNodeRef.current, "right");
      if (sourcePoint && graph?.topics?.length) {
        graph.topics.forEach((topic) => {
          const to = pointFromEl(topicRefs.current[topic.id], "left");
          if (!to) return;
          const active = topic.id === graph.selectedTopicId;
          nextPaths.push({
            id: `source-topic-${topic.id}`,
            d: buildCurve(sourcePoint, to),
            stroke: active ? "#0f172a" : "#cbd5e1",
            strokeWidth: active ? 2.5 : 1.5,
            opacity: active ? 0.5 : 0.8,
            dashArray: active ? undefined : "6 8",
          });
        });
      }

      if (selectedTopic?.id) {
        const selectedTopicPoint = pointFromEl(topicRefs.current[selectedTopic.id], "right");
        if (selectedTopicPoint) {
          openingPairs.forEach((pair) => {
            const to = pointFromEl(pairRefs.current[pair.id], "left");
            if (!to) return;
            nextPaths.push({
              id: `topic-pair-${pair.id}`,
              d: buildCurve(selectedTopicPoint, to),
              stroke: "#7c3aed",
              strokeWidth: 2,
              opacity: 0.28,
            });
          });
        }
      }

      const slide1From = pointFromEl(
        graph?.selectedSlide1SourcePairId ? slide1Refs.current[graph.selectedSlide1SourcePairId] : null,
        "right"
      );
      const slide1To = pointFromEl(chosenSlide1Ref.current, "left");
      if (slide1From && slide1To) {
        nextPaths.push({
          id: "selected-slide1-line",
          d: buildCurve(slide1From, slide1To),
          stroke: "#0f766e",
          strokeWidth: 2.5,
          opacity: 0.75,
        });
      }

      const slide2From = pointFromEl(
        graph?.selectedSlide2SourcePairId ? slide2Refs.current[graph.selectedSlide2SourcePairId] : null,
        "right"
      );
      const slide2To = pointFromEl(chosenSlide2Ref.current, "left");
      if (slide2From && slide2To) {
        nextPaths.push({
          id: "selected-slide2-line",
          d: buildCurve(slide2From, slide2To),
          stroke: "#c026d3",
          strokeWidth: 2.5,
          opacity: 0.75,
        });
      }

      const chosenPoint = pointFromEl(chosenOpeningGroupRef.current, "right");
      if (chosenPoint && expansions.length > 0) {
        expansions.forEach((expansion) => {
          const to = pointFromEl(expansionRefs.current[expansion.id], "left");
          if (!to) return;
          nextPaths.push({
            id: `chosen-expansion-${expansion.id}`,
            d: buildCurve(chosenPoint, to),
            stroke: "#d97706",
            strokeWidth: 2,
            opacity: 0.28,
          });
        });
      }

      setLineLayerSize({
        width: canvas.scrollWidth || canvas.clientWidth,
        height: canvas.scrollHeight || canvas.clientHeight,
      });
      setLinePaths(nextPaths);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(recalc);
    };

    schedule();

    const resizeTarget = window;
    const scrollTargets = [
      lineViewportRef.current,
      sourceLaneScrollRef.current,
      topicLaneScrollRef.current,
      openingLaneScrollRef.current,
      chosenLaneScrollRef.current,
      expansionLaneScrollRef.current,
    ].filter(Boolean) as EventTarget[];

    resizeTarget.addEventListener("resize", schedule);
    scrollTargets.forEach((target) => target.addEventListener("scroll", schedule, { passive: true } as AddEventListenerOptions));

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeTarget.removeEventListener("resize", schedule);
      scrollTargets.forEach((target) =>
        target.removeEventListener("scroll", schedule as EventListenerOrEventListenerObject)
      );
    };
  }, [
    open,
    graph,
    selectedTopic?.id,
    openingPairs,
    expansions,
    graph?.selectedSlide1SourcePairId,
    graph?.selectedSlide2SourcePairId,
  ]);

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setBusyAction(label);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(String(e?.message || e || "Request failed"));
    } finally {
      setBusyAction(null);
    }
  };

  const patchSelection = async (body: Record<string, unknown>) => {
    if (!graph?.id) return;
    const json = await authedFetchJson(`/api/carousel-map/${encodeURIComponent(graph.id)}/selection`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setGraph((json.graph as CarouselMapGraph) || null);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard.");
    } catch {
      setNotice("Copy failed.");
    }
  };

  const copyAllOpeningPairs = async () => {
    if (!selectedTopic || openingPairs.length === 0) return;
    const text = [
      `Topic: ${selectedTopic.title}`,
      "",
      `Summary: ${selectedTopic.summary}`,
      "",
      ...openingPairs.flatMap((pair, index) => [
        pair.title,
        `Slide 1: ${pair.slide1}`,
        "",
        `Slide 2: ${pair.slide2}`,
        ...(index < openingPairs.length - 1 ? ["", ""] : []),
      ]),
    ].join("\n");
    await copyText(text);
  };

  const copyAllExpansions = async () => {
    if (!selectedTopic || expansions.length === 0) return;
    const text = [
      `Topic: ${selectedTopic.title}`,
      "",
      `Summary: ${selectedTopic.summary}`,
      "",
      ...expansions.flatMap((expansion, index) => [
        `Carousel #${index + 1}`,
        `Slide 1: ${expansion.selectedSlide1Text}`,
        "",
        `Slide 2: ${expansion.selectedSlide2Text}`,
        "",
        `Slide 3: ${expansion.slide3}`,
        "",
        `Slide 4: ${expansion.slide4}`,
        "",
        `Slide 5: ${expansion.slide5}`,
        "",
        `Slide 6: ${expansion.slide6}`,
        ...(index < expansions.length - 1 ? ["", ""] : []),
      ]),
    ].join("\n");
    await copyText(text);
  };

  const onUsePair = async (pair: CarouselMapOpeningPair) => {
    await runAction("use-pair", async () => {
      await patchSelection({
        selectedSlide1SourcePairId: pair.id,
        selectedSlide1Text: pair.slide1,
        selectedSlide2SourcePairId: pair.id,
        selectedSlide2Text: pair.slide2,
        clearExpansions: true,
      });
      setNotice("Opening pair selected.");
    });
  };

  const onUseSlide = async (kind: "slide1" | "slide2", pairId: string, text: string) => {
    await runAction(`use-${kind}`, async () => {
      await patchSelection(
        kind === "slide1"
          ? { selectedSlide1SourcePairId: pairId, selectedSlide1Text: text, clearExpansions: true }
          : { selectedSlide2SourcePairId: pairId, selectedSlide2Text: text, clearExpansions: true }
      );
    });
  };

  const setDragPayload = (
    e: DragEvent<HTMLElement>,
    payload:
      | { kind: "pair"; pairId: string; slide1: string; slide2: string }
      | { kind: "slide1" | "slide2"; pairId: string; text: string }
  ) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
  };

  const onDropSlide = async (kind: "slide1" | "slide2", e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData("application/json");
      const parsed = raw ? JSON.parse(raw) : null;
      const dragKind = String(parsed?.kind || "").trim();
      const pairId = String(parsed?.pairId || "").trim();
      if (!pairId) return;
      if (dragKind === "pair") {
        const slide1 = String(parsed?.slide1 || "").trim();
        const slide2 = String(parsed?.slide2 || "").trim();
        if (!slide1 || !slide2) return;
        await onUsePair({ id: pairId, topicId: "", sourceGenerationKey: "", sortOrder: 0, title: "", slide1, slide2, angleText: "", createdAt: "" });
        return;
      }
      const text = String(parsed?.text || "").trim();
      if (!text) return;
      await onUseSlide(kind, pairId, text);
    } catch {
      // ignore
    }
  };

  const onCreateProject = async (args: { templateTypeId: TemplateTypeId; savedPromptId: string; expansionId: string }) => {
    if (!graph?.id) return;
    setCreateBusy(true);
    setError(null);
    try {
      const json = await authedFetchJson(`/api/carousel-map/${encodeURIComponent(graph.id)}/create-project`, {
        method: "POST",
        body: JSON.stringify(args),
      });
      const projectId = String(json.projectId || "").trim();
      if (!projectId) throw new Error("Missing projectId");
      onClose();
      onLoadProject?.(projectId, args.templateTypeId);
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to create project"));
    } finally {
      setCreateBusy(false);
      setPickerOpen(false);
    }
  };

  const openPromptEditor = (promptKey: CarouselMapPromptKey) => {
    const next = String(stagePrompts?.[promptKey]?.promptText || "");
    setPromptEditorDraft(next);
    loadedPromptDraftRef.current[promptKey] = next;
    setPromptSaveStatus("idle");
    setPromptSaveError(null);
    setPromptEditorKey(promptKey);
  };

  const generateStage = async (stageKey: CarouselMapPromptKey, steeringText?: string) => {
    const mapId = String(graph?.id || "").trim();
    if (!mapId) return;
    const route =
      stageKey === "topics"
        ? `/api/carousel-map/${encodeURIComponent(mapId)}/topics/generate`
        : stageKey === "opening_pairs"
          ? `/api/carousel-map/${encodeURIComponent(mapId)}/opening-pairs/generate`
          : `/api/carousel-map/${encodeURIComponent(mapId)}/expansions/generate`;
    const busyKey = stageKey === "topics" ? "topics" : stageKey === "opening_pairs" ? "pairs" : "expansions";
    const successMessage =
      stageKey === "topics"
        ? "Topics generated."
        : stageKey === "opening_pairs"
          ? "Opening pairs generated."
          : "Slides 3-6 generated.";
    setBusyAction(busyKey);
    setError(null);
    try {
      const json = await authedFetchJson(route, {
        method: "POST",
        body: steeringText === undefined ? JSON.stringify({}) : JSON.stringify({ steeringText }),
      });
      setGraph((json.graph as CarouselMapGraph) || null);
      setNotice(successMessage);
    } catch (e) {
      throw e;
    } finally {
      setBusyAction(null);
    }
  };

  const submitSteeringModal = async () => {
    if (!steeringModalKey) return;
    setSteeringBusy(true);
    setSteeringError(null);
    try {
      await generateStage(steeringModalKey, steeringDraft);
      setSteeringModalKey(null);
    } catch (e: any) {
      const msg = String(e?.message || e || "Failed");
      setSteeringError(msg);
      setError(msg);
    } finally {
      setSteeringBusy(false);
    }
  };

  const onGenerateClick = (stageKey: CarouselMapPromptKey) => {
    void generateStage(stageKey).catch((e: any) => {
      setError(String(e?.message || e || "Failed"));
    });
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[230] flex items-stretch justify-center bg-black/55"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="flex h-full w-full flex-col bg-slate-50">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-900">Carousel Map</div>
              <div className="mt-1 truncate text-xs text-slate-500">{swipeItemLabel || graph?.source.title || "Source item"}</div>
              {graph?.digestTopic ? (
                <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-slate-700">
                  <div className="font-semibold text-sky-900">Locked digest topic</div>
                  <div className="mt-1 font-semibold text-slate-900">{graph.digestTopic.title}</div>
                  {graph.digestTopic.carouselAngle ? <div className="mt-1 text-slate-600">Carousel angle: {graph.digestTopic.carouselAngle}</div> : null}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={loading}
                onClick={() => void loadGraph({ preserveMessage: true })}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>

          {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">❌ {error}</div> : null}
          {notice ? <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">{notice}</div> : null}

          <div ref={lineViewportRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-4">
            <div ref={lineCanvasRef} className="relative flex h-full min-w-max gap-4">
              {linePaths.length > 0 ? (
                <svg
                  className="pointer-events-none absolute inset-0 z-20 overflow-visible"
                  width={lineLayerSize.width}
                  height={lineLayerSize.height}
                  viewBox={`0 0 ${Math.max(lineLayerSize.width, 1)} ${Math.max(lineLayerSize.height, 1)}`}
                  aria-hidden="true"
                >
                  {linePaths.map((path) => (
                    <path
                      key={path.id}
                      d={path.d}
                      fill="none"
                      stroke={path.stroke}
                      strokeWidth={path.strokeWidth}
                      strokeOpacity={path.opacity}
                      strokeDasharray={path.dashArray}
                      strokeLinecap="round"
                    />
                  ))}
                </svg>
              ) : null}
              <LaneShell
                title="Source"
                contentRef={(node) => {
                  sourceLaneScrollRef.current = node;
                }}
                action={
                  graph?.source.transcript ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Transcript ready</span>
                  ) : null
                }
              >
                {!graph ? (
                  <div className="text-sm text-slate-600">{loading ? "Loading…" : "No source loaded."}</div>
                ) : (
                  <div ref={sourceNodeRef} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 shadow-sm">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Title</div>
                      <div className="mt-1 font-medium text-slate-900">{graph.source.title || "Untitled source"}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                      <div>
                        <div className="font-semibold text-slate-500">Platform</div>
                        <div className="mt-1">{graph.source.platform || "—"}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-500">Author</div>
                        <div className="mt-1">{graph.source.authorHandle || "—"}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Category</div>
                      <div className="mt-1">{graph.source.categoryName || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Angle / Notes</div>
                      <div className="mt-1 whitespace-pre-wrap leading-6">{graph.source.note || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Caption</div>
                      <div className="mt-1 whitespace-pre-wrap leading-6">{truncate(graph.source.caption || "—")}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Transcript</div>
                      <div className="mt-1 whitespace-pre-wrap leading-6">{truncate(graph.source.transcript || "—", 1200)}</div>
                    </div>
                  </div>
                )}
              </LaneShell>

              <LaneShell
                title="Topics"
                contentRef={(node) => {
                  topicLaneScrollRef.current = node;
                }}
                action={
                  digestOrigin ? (
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">Locked</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      {isSuperadmin ? (
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => openPromptEditor("topics")}
                          title="Edit Topics prompt"
                        >
                          ⚙
                        </button>
                      ) : null}
                      <GenerateWithSteeringControls
                        label={busyAction === "topics" ? "Working…" : graph?.topics.length ? "Regenerate" : "Generate"}
                        disabled={!graph?.id || busyAction === "topics" || loading || promptsLoading || topicsPromptEmpty}
                        onGenerate={() => onGenerateClick("topics")}
                        onSteer={() => openSteeringModal("topics")}
                      />
                    </div>
                  )
                }
              >
                {digestOrigin && graph?.topics.length ? (
                  <div className="space-y-3">
                    {graph.topics.map((topic) => {
                      const active = topic.id === graph.selectedTopicId;
                      return (
                        <div
                          key={topic.id}
                          className={[
                            "w-full rounded-xl border px-3 py-3 text-left shadow-sm",
                            active ? "border-black bg-slate-900 text-white" : "border-slate-200 bg-white",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className={["text-sm font-semibold", active ? "text-white" : "text-slate-900"].join(" ")}>{topic.title}</div>
                            <span className={["text-[11px] font-semibold", active ? "text-slate-300" : "text-sky-700"].join(" ")}>Locked</span>
                          </div>
                          <div className={["mt-2 text-xs leading-5", active ? "text-slate-200" : "text-slate-600"].join(" ")}>
                            {topic.summary}
                          </div>
                          <div className={["mt-2 text-xs leading-5", active ? "text-slate-300" : "text-slate-500"].join(" ")}>
                            Why it matters: {topic.whyItMatters}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : topicsPromptEmpty ? (
                  <div className="text-sm text-amber-700">{PROMPT_STAGE_META.topics.emptyError}</div>
                ) : !graph?.topics.length ? (
                  <div className="text-sm text-slate-600">Generate topics to extract the strongest directions from the source.</div>
                ) : (
                  <div className="space-y-3">
                    {renderLastSteeringBox(topicsSteering)}
                    {graph.topics.map((topic) => {
                      const active = topic.id === graph.selectedTopicId;
                      return (
                        <button
                          key={topic.id}
                          ref={(node) => {
                            topicRefs.current[topic.id] = node;
                          }}
                          type="button"
                          className={[
                            "w-full rounded-xl border px-3 py-3 text-left shadow-sm transition-colors",
                            active ? "border-black bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50",
                          ].join(" ")}
                          onClick={() =>
                            void runAction("topic-select", async () => {
                              await patchSelection({
                                selectedTopicId: topic.id,
                                selectedSlide1SourcePairId: null,
                                selectedSlide1Text: null,
                                selectedSlide2SourcePairId: null,
                                selectedSlide2Text: null,
                                clearExpansions: true,
                              });
                              setNotice(`Selected topic: ${topic.title}`);
                            })
                          }
                        >
                          <div className={["text-sm font-semibold", active ? "text-white" : "text-slate-900"].join(" ")}>{topic.title}</div>
                          <div className={["mt-2 text-xs leading-5", active ? "text-slate-200" : "text-slate-600"].join(" ")}>
                            {topic.summary}
                          </div>
                          <div className={["mt-2 text-xs leading-5", active ? "text-slate-300" : "text-slate-500"].join(" ")}>
                            Why it matters: {topic.whyItMatters}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </LaneShell>

              <LaneShell
                title="Opening Pairs"
                contentRef={(node) => {
                  openingLaneScrollRef.current = node;
                }}
                action={
                  <div className="flex items-center gap-2">
                    {openingPairs.length > 0 ? (
                      <button
                        type="button"
                        className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => void copyAllOpeningPairs()}
                      >
                        Copy all pairs
                      </button>
                    ) : null}
                    {isSuperadmin ? (
                      <button
                        type="button"
                        className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => openPromptEditor("opening_pairs")}
                        title="Edit Opening Pairs prompt"
                      >
                        ⚙
                      </button>
                    ) : null}
                    <GenerateWithSteeringControls
                      label={busyAction === "pairs" ? "Working…" : openingPairs.length ? "Regenerate" : "Generate"}
                      disabled={!selectedTopic || busyAction === "pairs" || promptsLoading || openingPairsPromptEmpty}
                      onGenerate={() => onGenerateClick("opening_pairs")}
                      onSteer={() => openSteeringModal("opening_pairs")}
                    />
                  </div>
                }
              >
                {!selectedTopic ? (
                  <div className="text-sm text-slate-600">Select one topic first.</div>
                ) : openingPairsPromptEmpty ? (
                  <div className="text-sm text-amber-700">{PROMPT_STAGE_META.opening_pairs.emptyError}</div>
                ) : openingPairs.length === 0 ? (
                  <div className="text-sm text-slate-600">Generate opening pairs for the selected topic.</div>
                ) : (
                  <div className="space-y-3">
                    {renderLastSteeringBox(openingPairsSteering)}
                    {openingPairs.map((pair) => (
                      <div
                        key={pair.id}
                        ref={(node) => {
                          pairRefs.current[pair.id] = node;
                        }}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{pair.title}</div>
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) =>
                              setDragPayload(e, {
                                kind: "pair",
                                pairId: pair.id,
                                slide1: pair.slide1,
                                slide2: pair.slide2,
                              })
                            }
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
                            title="Drag copy full pair"
                          >
                            Drag pair
                          </button>
                        </div>
                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Slide 1</div>
                        <button
                          ref={(node) => {
                            slide1Refs.current[pair.id] = node;
                          }}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDragPayload(e, { kind: "slide1", pairId: pair.id, text: pair.slide1 });
                          }}
                          onClick={() => void onUseSlide("slide1", pair.id, pair.slide1)}
                          className={[
                            "mt-1 w-full rounded-lg border px-3 py-3 text-left text-sm leading-6 transition-colors",
                            graph?.selectedSlide1SourcePairId === pair.id && graph?.selectedSlide1Text === pair.slide1
                              ? "border-black bg-slate-900 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
                          ].join(" ")}
                        >
                          {pair.slide1}
                        </button>
                        <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Slide 2</div>
                        <button
                          ref={(node) => {
                            slide2Refs.current[pair.id] = node;
                          }}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDragPayload(e, { kind: "slide2", pairId: pair.id, text: pair.slide2 });
                          }}
                          onClick={() => void onUseSlide("slide2", pair.id, pair.slide2)}
                          className={[
                            "mt-1 w-full rounded-lg border px-3 py-3 text-left text-sm leading-6 transition-colors",
                            graph?.selectedSlide2SourcePairId === pair.id && graph?.selectedSlide2Text === pair.slide2
                              ? "border-black bg-slate-900 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
                          ].join(" ")}
                        >
                          {pair.slide2}
                        </button>
                        <div className="mt-3 text-[11px] text-slate-500">Angle: {pair.angleText}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="h-9 rounded-lg bg-black px-3 text-xs font-semibold text-white"
                            onClick={() => void onUsePair(pair)}
                          >
                            Use pair
                          </button>
                          <button
                            type="button"
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => void copyText(`Slide 1: ${pair.slide1}\n\nSlide 2: ${pair.slide2}`)}
                          >
                            Copy pair
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </LaneShell>

              <LaneShell
                title="Chosen Opening"
                contentRef={(node) => {
                  chosenLaneScrollRef.current = node;
                }}
                action={
                  <div className="flex items-center gap-2">
                    {isSuperadmin ? (
                      <button
                        type="button"
                        className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => openPromptEditor("expansions")}
                        title="Edit Slides 3-6 prompt"
                      >
                        ⚙
                      </button>
                    ) : null}
                    <GenerateWithSteeringControls
                      label={busyAction === "expansions" ? "Working…" : expansions.length ? "Generate more" : "Generate Slides 3-6"}
                      disabled={!graph?.selectedSlide1Text || !graph?.selectedSlide2Text || busyAction === "expansions" || promptsLoading || expansionsPromptEmpty}
                      onGenerate={() => onGenerateClick("expansions")}
                      onSteer={() => openSteeringModal("expansions")}
                    />
                  </div>
                }
              >
                <div ref={chosenOpeningGroupRef} className="space-y-4">
                  {expansionsPromptEmpty ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {PROMPT_STAGE_META.expansions.emptyError}
                    </div>
                  ) : null}
                  {renderLastSteeringBox(expansionsSteering)}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                    Drag a full opening pair into either slot to copy both slides, or click/drag each slide directly from an opening-pair card.
                  </div>
                  <div
                    ref={chosenSlide1Ref}
                    className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => void onDropSlide("slide1", e)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-slate-700">Chosen Slide 1</div>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                        onClick={() => void patchSelection({ selectedSlide1SourcePairId: null, selectedSlide1Text: null, clearExpansions: true })}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-800">{graph?.selectedSlide1Text || "Click or drag a Slide 1 candidate here."}</div>
                    {selectedSlide1Pair ? (
                      <div className="mt-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        From: {selectedSlide1Pair.title}
                      </div>
                    ) : null}
                  </div>
                  <div
                    ref={chosenSlide2Ref}
                    className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => void onDropSlide("slide2", e)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-slate-700">Chosen Slide 2</div>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                        onClick={() => void patchSelection({ selectedSlide2SourcePairId: null, selectedSlide2Text: null, clearExpansions: true })}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-800">{graph?.selectedSlide2Text || "Click or drag a Slide 2 candidate here."}</div>
                    {selectedSlide2Pair ? (
                      <div className="mt-3 inline-flex items-center rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700">
                        From: {selectedSlide2Pair.title}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      disabled={!graph?.selectedSlide1Text || !graph?.selectedSlide2Text}
                      onClick={() => void copyText(`Slide 1: ${graph?.selectedSlide1Text || ""}\n\nSlide 2: ${graph?.selectedSlide2Text || ""}`)}
                    >
                      Copy opener
                    </button>
                  </div>
                </div>
              </LaneShell>

              <LaneShell
                title="Expansions"
                contentRef={(node) => {
                  expansionLaneScrollRef.current = node;
                }}
                action={
                  expansions.length > 0 ? (
                    <button
                      type="button"
                      className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => void copyAllExpansions()}
                    >
                      Copy all Expansions
                    </button>
                  ) : undefined
                }
              >
                {!selectedTopic ? (
                  <div className="text-sm text-slate-600">Select a topic first.</div>
                ) : expansions.length === 0 ? (
                  <div className="text-sm text-slate-600">Generate slides 3-6 from the chosen opening.</div>
                ) : (
                  <div className="space-y-3">
                    {expansions.map((expansion, index) => (
                      <div
                        key={expansion.id}
                        ref={(node) => {
                          expansionRefs.current[expansion.id] = node;
                        }}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Opening</div>
                          <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            #{index + 1}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedSlide1Pair ? (
                            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              S1 from: {selectedSlide1Pair.title}
                            </div>
                          ) : null}
                          {selectedSlide2Pair ? (
                            <div className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700">
                              S2 from: {selectedSlide2Pair.title}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-2 space-y-2 text-sm text-slate-800">
                          <div><span className="font-semibold text-slate-600">S1:</span> {expansion.selectedSlide1Text}</div>
                          <div><span className="font-semibold text-slate-600">S2:</span> {expansion.selectedSlide2Text}</div>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-800">
                          <div><span className="font-semibold text-slate-600">S3:</span> {expansion.slide3}</div>
                          <div><span className="font-semibold text-slate-600">S4:</span> {expansion.slide4}</div>
                          <div><span className="font-semibold text-slate-600">S5:</span> {expansion.slide5}</div>
                          <div><span className="font-semibold text-slate-600">S6:</span> {expansion.slide6}</div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="h-9 rounded-lg bg-black px-3 text-xs font-semibold text-white disabled:opacity-50"
                            disabled={createBusy}
                            onClick={() => {
                              setPickerExpansionId(expansion.id);
                              setPickerOpen(true);
                            }}
                          >
                            {createBusy && pickerExpansionId === expansion.id ? "Creating…" : "Use for Project"}
                          </button>
                          <button
                            type="button"
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() =>
                              void copyText(
                                [
                                  `Slide 1: ${expansion.selectedSlide1Text}`,
                                  `Slide 2: ${expansion.selectedSlide2Text}`,
                                  `Slide 3: ${expansion.slide3}`,
                                  `Slide 4: ${expansion.slide4}`,
                                  `Slide 5: ${expansion.slide5}`,
                                  `Slide 6: ${expansion.slide6}`,
                                ].join("\n\n")
                              )
                            }
                          >
                            Copy full carousel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </LaneShell>
            </div>
          </div>
        </div>
      </div>

      <CarouselMapProjectPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mapId={graph?.id || null}
        expansion={pickerExpansion}
        initialTemplateTypeId={templateTypeIdRef.current}
        initialSavedPromptId={savedPromptId}
        allowHtml={!digestOrigin}
        onSelectionChange={(args) => {
          setTemplateTypeId(args.templateTypeId);
          setSavedPromptId(String(args.savedPromptId || "").trim());
        }}
        onPick={(args) => {
          void onCreateProject(args);
        }}
      />
      <CarouselMapStagePromptModal
        open={!!promptEditorKey}
        stageKey={promptEditorKey}
        value={promptEditorDraft}
        onChange={setPromptEditorDraft}
        onClose={() => setPromptEditorKey(null)}
        saveStatus={promptSaveStatus}
        saveError={promptSaveError}
      />
      <CarouselMapSteeringModal
        open={!!steeringModalKey}
        stageKey={steeringModalKey}
        value={steeringDraft}
        error={steeringError}
        busy={steeringBusy}
        submitLabel={
          steeringModalKey === "topics"
            ? graph?.topics.length
              ? "Regenerate Topics"
              : "Generate Topics"
            : steeringModalKey === "opening_pairs"
              ? openingPairs.length
                ? "Regenerate Opening Pairs"
                : "Generate Opening Pairs"
              : expansions.length
                ? "Generate More"
                : "Generate Slides 3-6"
        }
        onChange={setSteeringDraft}
        onClose={() => {
          if (steeringBusy) return;
          setSteeringModalKey(null);
          setSteeringError(null);
        }}
        onSubmit={() => void submitSteeringModal()}
      />
    </>
  );
}
