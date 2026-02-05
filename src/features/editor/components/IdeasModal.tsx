"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";

type IdeaRow = {
  id: string;
  source_id: string;
  run_id: string;
  title: string;
  bullets: any;
  status: string;
  approved_sort_index: number | null;
  created_at: string;
  updated_at: string;
};

type SourceRow = {
  id: string;
  sourceTitle: string;
  sourceUrl: string;
  lastGeneratedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  ideas: IdeaRow[];
};

type TitleGroup = {
  title: string;
  sortKey: number;
  sources: SourceRow[];
  ideaCount: number;
};

type SourceLite = { id: string; sourceUrl: string; ideaCount: number };

function tsToSortKey(ts: string | null | undefined): number {
  const t = ts ? Date.parse(ts) : NaN;
  return Number.isFinite(t) ? t : 0;
}

export function IdeasModal() {
  const open = useEditorSelector((s: any) => !!(s as any).ideasModalOpen);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const [promptDraft, setPromptDraft] = useState<string>("");
  const [promptStatus, setPromptStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [promptError, setPromptError] = useState<string | null>(null);
  const promptDirtyRef = useRef(false);
  const promptSaveTimeoutRef = useRef<number | null>(null);

  const [audienceDraft, setAudienceDraft] = useState<string>("");
  const [audienceStatus, setAudienceStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const audienceDirtyRef = useRef(false);
  const audienceSaveTimeoutRef = useRef<number | null>(null);

  const [sourceTitleDraft, setSourceTitleDraft] = useState("");
  const [sourceUrlDraft, setSourceUrlDraft] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<string>("");
  const lastGenArgsRef = useRef<{ sourceTitle: string; sourceUrl: string } | null>(null);

  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [selectedGroupTitle, setSelectedGroupTitle] = useState<string | null>(null);
  const [ideaBusyIds, setIdeaBusyIds] = useState<Set<string>>(() => new Set());
  const [ideaActionError, setIdeaActionError] = useState<string | null>(null);

  const [carouselTemplateType, setCarouselTemplateType] = useState<"enhanced" | "regular">("enhanced");
  const [carouselByIdea, setCarouselByIdea] = useState<
    Record<string, { state: "idle" | "running" | "success" | "error"; label: string; error: string | null; projectId: string | null }>
  >({});
  const carouselRunIdByIdeaRef = useRef<Record<string, number>>({});
  const carouselPollRefByIdeaRef = useRef<Record<string, number | null>>({});

  const [createdByIdeaId, setCreatedByIdeaId] = useState<Record<string, { projectId: string; createdAt: string }>>({});

  const groups: TitleGroup[] = useMemo(() => {
    const m = new Map<string, TitleGroup>();
    for (const s of sources || []) {
      const title = String(s?.sourceTitle || "").trim() || "(Untitled source)";
      const existing = m.get(title);
      const sortKey = Math.max(tsToSortKey(s?.lastGeneratedAt || null), tsToSortKey(s?.createdAt || null));
      const ideaCount = Array.isArray(s?.ideas) ? s.ideas.length : 0;
      if (!existing) {
        m.set(title, { title, sortKey, sources: [s], ideaCount });
      } else {
        existing.sources.push(s);
        existing.sortKey = Math.max(existing.sortKey, sortKey);
        existing.ideaCount += ideaCount;
      }
    }
    const out = Array.from(m.values());
    out.sort((a, b) => b.sortKey - a.sortKey || a.title.localeCompare(b.title));
    for (const g of out) {
      g.sources.sort(
        (a, b) =>
          Math.max(tsToSortKey(b.lastGeneratedAt), tsToSortKey(b.createdAt)) -
            Math.max(tsToSortKey(a.lastGeneratedAt), tsToSortKey(a.createdAt)) ||
          String(a.sourceUrl || "").localeCompare(String(b.sourceUrl || ""))
      );
    }
    return out;
  }, [sources]);

  const groupSourcesLite = useMemo(() => {
    const out = new Map<string, SourceLite[]>();
    for (const g of groups) {
      const rows: SourceLite[] = (g.sources || []).map((s) => ({
        id: s.id,
        sourceUrl: String(s.sourceUrl || ""),
        ideaCount: Array.isArray(s.ideas) ? s.ideas.length : 0,
      }));
      out.set(g.title, rows);
    }
    return out;
  }, [groups]);

  const selectedGroup = useMemo(() => {
    const title = String(selectedGroupTitle || "").trim();
    if (!title) return groups[0] || null;
    return groups.find((g) => g.title === title) || groups[0] || null;
  }, [groups, selectedGroupTitle]);

  const approvedQueue = useMemo(() => {
    const allIdeas: Array<IdeaRow & { sourceTitle: string; sourceUrl: string }> = [];
    for (const s of sources || []) {
      const title = String((s as any)?.sourceTitle || "");
      const url = String((s as any)?.sourceUrl || "");
      const rows = Array.isArray((s as any)?.ideas) ? (s as any).ideas : [];
      for (const i of rows) {
        if (String((i as any)?.status || "") !== "approved") continue;
        allIdeas.push({ ...(i as any), sourceTitle: title, sourceUrl: url });
      }
    }
    allIdeas.sort((a, b) => {
      const ai = Number(a.approved_sort_index);
      const bi = Number(b.approved_sort_index);
      const aOk = Number.isFinite(ai);
      const bOk = Number.isFinite(bi);
      if (aOk && bOk) return ai - bi;
      if (aOk) return -1;
      if (bOk) return 1;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });
    return allIdeas;
  }, [sources]);

  // Load "created" markers for approved ideas (persisted via editor_idea_carousel_runs).
  useEffect(() => {
    if (!open) return;
    if (!actions?.fetchIdeaCarouselRuns) return;
    const ids = approvedQueue.map((i) => i.id).filter(Boolean);
    if (ids.length === 0) {
      setCreatedByIdeaId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const m = await actions.fetchIdeaCarouselRuns(ids);
        if (!cancelled) setCreatedByIdeaId((m && typeof m === "object") ? m : {});
      } catch {
        // ignore; treat as unknown
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actions, approvedQueue, open]);

  // Keep selection stable when groups load.
  useEffect(() => {
    if (!open) return;
    if (!selectedGroupTitle && groups.length > 0) {
      setSelectedGroupTitle(groups[0]!.title);
    }
  }, [groups, open, selectedGroupTitle]);

  // Fetch sources/ideas when opening or toggling dismissed.
  useEffect(() => {
    if (!open) return;
    if (!actions?.fetchIdeaSourcesAndIdeas) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = (await actions.fetchIdeaSourcesAndIdeas(!!includeDismissed)) as SourceRow[];
        if (!cancelled) setSources(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e || "Failed to load ideas"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [actions, includeDismissed, open]);

  const refreshSources = async (opts?: { keepSelection?: boolean }) => {
    if (!actions?.fetchIdeaSourcesAndIdeas) return;
    const rows = (await actions.fetchIdeaSourcesAndIdeas(!!includeDismissed)) as SourceRow[];
    setSources(Array.isArray(rows) ? rows : []);
    if (!opts?.keepSelection) return;
  };

  const getCarouselUi = (ideaId: string) =>
    carouselByIdea[String(ideaId || "").trim()] || { state: "idle" as const, label: "", error: null, projectId: null };

  const setCarouselUi = (ideaId: string, patch: Partial<{ state: "idle" | "running" | "success" | "error"; label: string; error: string | null; projectId: string | null }>) => {
    const id = String(ideaId || "").trim();
    if (!id) return;
    setCarouselByIdea((prev) => {
      const cur = prev[id] || { state: "idle" as const, label: "", error: null, projectId: null };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

  const stepLabelFor = (progressCode: string) => {
    const code = String(progressCode || "").toLowerCase();
    if (code.includes("poppy")) return "Poppy is Cooking...";
    if (code.includes("parse")) return "Parsing output…";
    if (code.includes("emphasis")) return "Generating emphasis styles…";
    if (code.includes("save")) return "Saving…";
    return "Working…";
  };

  // Reset transient UI state on each open (so it feels "fresh").
  useEffect(() => {
    if (!open) return;
    setSourceTitleDraft("");
    setSourceUrlDraft("");
    setGenBusy(false);
    setGenError(null);
    setGenStatus("");
    lastGenArgsRef.current = null;

    setIdeaActionError(null);
    setIdeaBusyIds(new Set());

    // Clear per-idea carousel UI state + stop any pollers.
    setCarouselByIdea({});
    carouselRunIdByIdeaRef.current = {};
    const m = carouselPollRefByIdeaRef.current || {};
    for (const k of Object.keys(m)) {
      const t = m[k];
      if (t) window.clearInterval(t);
      m[k] = null;
    }

    // Reset dismissed filter + selection to newest group.
    setIncludeDismissed(false);
    setSelectedGroupTitle(null);

    // Reset prompt/audience transient UI (drafts will be loaded immediately after open).
    setPromptStatus("idle");
    setPromptError(null);
    promptDirtyRef.current = false;
    setAudienceStatus("idle");
    setAudienceError(null);
    audienceDirtyRef.current = false;
  }, [open]);

  // Load prompt + last source when modal opens.
  useEffect(() => {
    if (!open) return;
    if (!actions?.fetchIdeasPromptOverride) return;
    let cancelled = false;
    setPromptStatus("loading");
    setPromptError(null);
    void (async () => {
      try {
        const v = await actions.fetchIdeasPromptOverride();
        if (cancelled) return;
        setPromptDraft(String(v || ""));
        promptDirtyRef.current = false;
        setPromptStatus("idle");
      } catch (e: any) {
        if (cancelled) return;
        setPromptError(String(e?.message || e || "Failed to load Ideas Prompt"));
        setPromptStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally omit drafts from deps; this should run only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, open]);

  // Load audience when modal opens (per-account).
  useEffect(() => {
    if (!open) return;
    if (!actions?.fetchIdeasPromptAudience) {
      setAudienceDraft("");
      setAudienceStatus("idle");
      setAudienceError(null);
      audienceDirtyRef.current = false;
      return;
    }
    let cancelled = false;
    setAudienceStatus("loading");
    setAudienceError(null);
    void (async () => {
      try {
        const v = await actions.fetchIdeasPromptAudience();
        if (cancelled) return;
        setAudienceDraft(String(v || ""));
        audienceDirtyRef.current = false;
        setAudienceStatus("idle");
      } catch (e: any) {
        if (cancelled) return;
        setAudienceError(String(e?.message || e || "Failed to load Audience"));
        setAudienceStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally omit drafts from deps; this should run only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, open]);

  // Debounced autosave for Ideas Prompt (match EditorShell prompt autosave semantics).
  useEffect(() => {
    if (!open) return;
    if (!actions?.saveIdeasPromptOverride) return;
    if (!promptDirtyRef.current) return;
    if (promptSaveTimeoutRef.current) window.clearTimeout(promptSaveTimeoutRef.current);
    promptSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        setPromptError(null);
        setPromptStatus("saving");
        const saved = await actions.saveIdeasPromptOverride(String(promptDraft || ""));
        setPromptDraft(String(saved || ""));
        setPromptStatus("saved");
        promptDirtyRef.current = false;
        window.setTimeout(() => setPromptStatus("idle"), 1200);
      } catch (e: any) {
        setPromptError(String(e?.message || e || "Failed to save Ideas Prompt"));
        setPromptStatus("error");
        window.setTimeout(() => setPromptStatus("idle"), 2000);
      }
    }, 600);
    return () => {
      if (promptSaveTimeoutRef.current) window.clearTimeout(promptSaveTimeoutRef.current);
    };
  }, [actions, open, promptDraft]);

  // Debounced autosave for Audience (per-account).
  useEffect(() => {
    if (!open) return;
    if (!actions?.saveIdeasPromptAudience) return;
    if (!audienceDirtyRef.current) return;
    if (audienceSaveTimeoutRef.current) window.clearTimeout(audienceSaveTimeoutRef.current);
    audienceSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        setAudienceError(null);
        setAudienceStatus("saving");
        const saved = await actions.saveIdeasPromptAudience(String(audienceDraft || ""));
        setAudienceDraft(String(saved || ""));
        setAudienceStatus("saved");
        audienceDirtyRef.current = false;
        window.setTimeout(() => setAudienceStatus("idle"), 1200);
      } catch (e: any) {
        setAudienceError(String(e?.message || e || "Failed to save Audience"));
        setAudienceStatus("error");
        window.setTimeout(() => setAudienceStatus("idle"), 2000);
      }
    }, 600);
    return () => {
      if (audienceSaveTimeoutRef.current) window.clearTimeout(audienceSaveTimeoutRef.current);
    };
  }, [actions, open, audienceDraft]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      actions?.onCloseIdeasModal?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, open]);

  // Cleanup any running pollers when closing modal.
  useEffect(() => {
    if (open) return;
    const m = carouselPollRefByIdeaRef.current || {};
    for (const k of Object.keys(m)) {
      const t = m[k];
      if (t) window.clearInterval(t);
      m[k] = null;
    }
  }, [open]);

  if (!open) return null;

  const canGenerate = !!String(sourceTitleDraft || "").trim() && !!String(sourceUrlDraft || "").trim() && !genBusy;

  return (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) actions?.onCloseIdeasModal?.();
      }}
    >
      <div className="w-full max-w-6xl max-h-[90vh] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="text-base font-semibold text-slate-900">Generate Ideas</div>
            <div className="mt-0.5 text-xs text-slate-500">Generate and browse saved ideas grouped by Source Title.</div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={actions?.onCloseIdeasModal}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7">
              <div className="text-xs font-semibold text-slate-700">Ideas Prompt (saved for this user)</div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                Supports: <span className="font-mono">{'{{sourceTitle}}'}</span>{" "}
                <span className="font-mono">{'{{sourceUrl}}'}</span>{" "}
                <span className="font-mono">{'{{topicCount}}'}</span>{" "}
                <span className="font-mono">{'{{audience}}'}</span>
              </div>
              <textarea
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 text-sm shadow-sm"
                rows={4}
                value={promptDraft}
                onChange={(e) => {
                  promptDirtyRef.current = true;
                  setPromptDraft(e.target.value);
                }}
                placeholder="Enter the prompt sent to Poppy for generating topic ideas…"
              />
              <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-3">
                {promptStatus === "loading" ? <span>Loading…</span> : null}
                {promptStatus === "saving" ? <span>Saving…</span> : null}
                {promptStatus === "saved" ? <span className="text-emerald-700">Saved ✓</span> : null}
                {promptStatus === "error" && promptError ? <span className="text-red-600">❌ {promptError}</span> : null}
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-700">Audience (saved for this account)</div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  Used to fill <span className="font-mono">{'{{audience}}'}</span> when generating ideas (can be empty).
                </div>
                <input
                  className="mt-2 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                  value={audienceDraft}
                  onChange={(e) => {
                    audienceDirtyRef.current = true;
                    setAudienceDraft(e.target.value);
                  }}
                  placeholder='e.g. "women over 30"'
                />
                <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-3">
                  {audienceStatus === "loading" ? <span>Loading…</span> : null}
                  {audienceStatus === "saving" ? <span>Saving…</span> : null}
                  {audienceStatus === "saved" ? <span className="text-emerald-700">Saved ✓</span> : null}
                  {audienceStatus === "error" && audienceError ? <span className="text-red-600">❌ {audienceError}</span> : null}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="text-xs font-semibold text-slate-700">Source (manual tag)</div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                This tags ideas so you can find them later—even after you swap the source in Poppy.
              </div>
              <div className="mt-2 space-y-2">
                <input
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                  value={sourceTitleDraft}
                  onChange={(e) => setSourceTitleDraft(e.target.value)}
                  placeholder="Source Title (e.g. Sam Altman clip)"
                />
                <input
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                  value={sourceUrlDraft}
                  onChange={(e) => setSourceUrlDraft(e.target.value)}
                  placeholder="Source URL (paste link)"
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50"
                    onClick={() => {
                      try {
                        const t = String(window.localStorage.getItem("dn_ideas_last_source_title") || "");
                        const u = String(window.localStorage.getItem("dn_ideas_last_source_url") || "");
                        if (t) setSourceTitleDraft(t);
                        if (u) setSourceUrlDraft(u);
                      } catch {
                        // ignore
                      }
                    }}
                    title="Use the last source you generated ideas from"
                  >
                    Use last source
                  </button>
                  <button
                    type="button"
                    className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                    disabled={!canGenerate || !actions?.runGenerateIdeas}
                    onClick={async () => {
                      if (!actions?.runGenerateIdeas) return;
                      const st = String(sourceTitleDraft || "").trim();
                      const su = String(sourceUrlDraft || "").trim();
                      if (!st || !su) return;
                      setGenError(null);
                      setGenBusy(true);
                      setGenStatus(`Generating 8 ideas… (Poppy → Parsing → Saving)`);
                      lastGenArgsRef.current = { sourceTitle: st, sourceUrl: su };
                      try {
                        await actions.runGenerateIdeas({ sourceTitle: st, sourceUrl: su, topicCount: 8 });
                        // Persist last-source for fast repeat runs.
                        try {
                          window.localStorage.setItem("dn_ideas_last_source_title", st);
                          window.localStorage.setItem("dn_ideas_last_source_url", su);
                        } catch {
                          // ignore
                        }
                        // Refresh list.
                        if (actions.fetchIdeaSourcesAndIdeas) {
                          const rows = (await actions.fetchIdeaSourcesAndIdeas(!!includeDismissed)) as SourceRow[];
                          setSources(Array.isArray(rows) ? rows : []);
                          setSelectedGroupTitle(st);
                        }
                        setGenStatus("Saved ✓");
                        window.setTimeout(() => setGenStatus(""), 1400);
                      } catch (e: any) {
                        setGenError(String(e?.message || e || "Generate Ideas failed"));
                        setGenStatus("");
                      } finally {
                        setGenBusy(false);
                      }
                    }}
                    title="Generate 8 topic ideas from Poppy"
                  >
                    {genBusy ? "Generating…" : "Generate Ideas"}
                  </button>
                </div>
                {genStatus ? (
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    {genBusy ? (
                      <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
                    ) : null}
                    <span className="font-medium">{genStatus}</span>
                  </div>
                ) : null}
                {genError ? (
                  <div className="text-xs text-red-600 flex items-center justify-between gap-3">
                    <div>❌ {genError}</div>
                    <button
                      type="button"
                      className="h-8 px-3 rounded-lg border border-red-200 bg-white text-red-700 text-xs font-semibold shadow-sm hover:bg-red-50"
                      disabled={!lastGenArgsRef.current || genBusy || !actions?.runGenerateIdeas}
                      onClick={async () => {
                        if (!actions?.runGenerateIdeas) return;
                        const last = lastGenArgsRef.current;
                        if (!last) return;
                        setGenError(null);
                        setGenBusy(true);
                        setGenStatus(`Generating 8 ideas… (Poppy → Parsing → Saving)`);
                        try {
                          await actions.runGenerateIdeas({ ...last, topicCount: 8 });
                          if (actions.fetchIdeaSourcesAndIdeas) {
                            const rows = (await actions.fetchIdeaSourcesAndIdeas(!!includeDismissed)) as SourceRow[];
                            setSources(Array.isArray(rows) ? rows : []);
                            setSelectedGroupTitle(last.sourceTitle);
                          }
                          setGenStatus("Saved ✓");
                          window.setTimeout(() => setGenStatus(""), 1400);
                        } catch (e: any) {
                          setGenError(String(e?.message || e || "Generate Ideas failed"));
                          setGenStatus("");
                        } finally {
                          setGenBusy(false);
                        }
                      }}
                      title="Retry the last Generate Ideas run"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeDismissed}
                    onChange={(e) => setIncludeDismissed(e.target.checked)}
                  />
                  Show dismissed
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll container (match ImageLibraryModal semantics): single flex-1 overflow-y-auto */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-12 min-h-full">
            {/* Left: Source Title groups */}
            <div className="col-span-4 border-r border-slate-100">
              <div className="p-4">
                <div className="text-xs font-semibold text-slate-600">Sources</div>
                {loading ? <div className="mt-2 text-xs text-slate-500">Loading…</div> : null}
                {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
                {!loading && !error && groups.length === 0 ? (
                  <div className="mt-2 text-xs text-slate-500">
                    No sources yet. Generate ideas above to create your first source group.
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  {groups.map((g) => {
                    const active = (selectedGroup?.title || "") === g.title;
                    return (
                      <div key={g.title} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                        <button
                          type="button"
                          className={[
                            "w-full text-left px-3 py-2 transition-colors",
                            active ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-50",
                          ].join(" ")}
                          onClick={() => setSelectedGroupTitle(g.title)}
                          title={g.title}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold truncate">{g.title}</div>
                            <div className={["text-xs font-semibold", active ? "text-white/90" : "text-slate-500"].join(" ")}>
                              {g.ideaCount}
                            </div>
                          </div>
                        </button>
                        <div className="border-t border-slate-100">
                          {(groupSourcesLite.get(g.title) || []).map((s) => {
                            const busy = ideaBusyIds.has(`source:${s.id}`);
                            return (
                              <div key={s.id} className="px-3 py-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[11px] text-slate-500 truncate">{s.sourceUrl}</div>
                                  <div className="text-[10px] text-slate-400">{s.ideaCount} idea{s.ideaCount === 1 ? "" : "s"}</div>
                                </div>
                                <button
                                  type="button"
                                  className="h-8 w-8 rounded-md border border-red-200 bg-white text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                                  disabled={busy || !actions?.deleteIdeaSource}
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!actions?.deleteIdeaSource) return;
                                    const ok = window.confirm("Delete this source (and all its ideas/runs)? This cannot be undone.");
                                    if (!ok) return;
                                    setIdeaActionError(null);
                                    setIdeaBusyIds((prev) => new Set(prev).add(`source:${s.id}`));
                                    try {
                                      await actions.deleteIdeaSource(s.id);
                                      await refreshSources({ keepSelection: true });
                                      // If the current selected group is now empty, fall back to the newest group.
                                      const nextGroups = groups.filter((gg) => gg.title !== g.title || (groupSourcesLite.get(g.title) || []).length > 1);
                                      if (selectedGroupTitle === g.title && nextGroups.length === 0) {
                                        setSelectedGroupTitle(null);
                                      }
                                    } catch (err: any) {
                                      setIdeaActionError(String(err?.message || err || "Delete source failed"));
                                    } finally {
                                      setIdeaBusyIds((prev) => {
                                        const n = new Set(prev);
                                        n.delete(`source:${s.id}`);
                                        return n;
                                      });
                                    }
                                  }}
                                  title="Delete this source"
                                >
                                  🗑️
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Ideas */}
            <div className="col-span-8">
              <div className="p-5">
                {ideaActionError ? (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    ❌ {ideaActionError}
                  </div>
                ) : null}

                <div className="mb-5 rounded-xl border border-slate-200 bg-white">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Approved Queue</div>
                      <div className="text-xs text-slate-500">Reorder or remove approved topics (persisted).</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                        value={carouselTemplateType}
                        onChange={(e) => setCarouselTemplateType(e.target.value === "regular" ? "regular" : "enhanced")}
                        title="Template type for created carousel projects"
                      >
                        <option value="enhanced">Enhanced</option>
                        <option value="regular">Regular</option>
                      </select>
                      <div className="text-xs font-semibold text-slate-600">{approvedQueue.length}</div>
                    </div>
                  </div>
                  <div className="p-4">
                    {approvedQueue.length === 0 ? (
                      <div className="text-xs text-slate-500">No approved ideas yet. Approve an idea below to add it here.</div>
                    ) : (
                      <div className="space-y-2 h-[240px] overflow-y-scroll pr-1">
                        {approvedQueue.map((i, idx) => {
                          const busy = ideaBusyIds.has(i.id);
                          const ui = getCarouselUi(i.id);
                          const created = createdByIdeaId[i.id] || null;
                          return (
                            <div key={i.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 truncate">{i.title}</div>
                                  <div className="mt-0.5 text-[11px] text-slate-500 truncate">{i.sourceTitle}</div>
                                  <div className="mt-1 text-[11px] text-slate-600">
                                    {created ? (
                                      <span>✅ Created</span>
                                    ) : (
                                      <span>⬜ Not created</span>
                                    )}
                                  </div>
                                  {ui.state !== "idle" ? (
                                    <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-2">
                                      {ui.state === "running" ? (
                                        <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
                                      ) : null}
                                      <span className="font-medium">
                                        {ui.label || (ui.state === "success" ? "Done" : ui.state === "error" ? "Error" : "")}
                                      </span>
                                    </div>
                                  ) : null}
                                  {ui.state === "error" && ui.error ? (
                                    <div className="mt-1 text-[11px] text-red-600">❌ {ui.error}</div>
                                  ) : null}
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="h-8 px-3 rounded-md bg-black text-white text-xs font-semibold disabled:opacity-50"
                                    disabled={ui.state === "running" || !actions?.createCarouselFromIdea}
                                    onClick={async () => {
                                      if (!actions?.createCarouselFromIdea) return;
                                      const ideaId = i.id;
                                      const runId = (carouselRunIdByIdeaRef.current[ideaId] || 0) + 1;
                                      carouselRunIdByIdeaRef.current[ideaId] = runId;
                                      setCarouselUi(ideaId, { state: "running", label: "Creating project…", error: null, projectId: null });

                                      // Kill existing poller for this idea.
                                      const prevPoll = carouselPollRefByIdeaRef.current[ideaId];
                                      if (prevPoll) window.clearInterval(prevPoll);
                                      carouselPollRefByIdeaRef.current[ideaId] = null;

                                      try {
                                        const res = await actions.createCarouselFromIdea({ ideaId, templateTypeId: carouselTemplateType });
                                        const projectId = String((res as any)?.projectId || "").trim();
                                        if (!projectId) throw new Error("Missing projectId");
                                        // Mark created immediately (so on reopen it’s instant; server fetch will also confirm).
                                        setCreatedByIdeaId((prev) => ({ ...prev, [ideaId]: { projectId, createdAt: new Date().toISOString() } }));
                                        // Start polling Generate Copy job progress for this new project.
                                        setCarouselUi(ideaId, { label: "Starting…", projectId });

                                        const pollOnce = async () => {
                                          try {
                                            if (carouselRunIdByIdeaRef.current[ideaId] !== runId) return;
                                            const out = await actions.fetchProjectJobStatus?.({ projectId, jobType: "generate-copy" });
                                            const active = out?.activeJob || null;
                                            const recent0 = Array.isArray(out?.recentJobs) ? out.recentJobs[0] : null;
                                            // If there is no active job, but the most recent job is completed/failed,
                                            // we must update UI; otherwise we can get "stuck" on the last progress label.
                                            const job = active || recent0 || null;
                                            if (!job) return;

                                            const status = String(job.status || "");
                                            const err = String(job.error || "");
                                            if ((status === "pending" || status === "running") && err.startsWith("progress:")) {
                                              setCarouselUi(ideaId, { label: stepLabelFor(err.slice("progress:".length)) });
                                            } else if (status === "pending") {
                                              setCarouselUi(ideaId, { label: "Queued…" });
                                            } else if (status === "running") {
                                              setCarouselUi(ideaId, { label: "Working…" });
                                            } else if (status === "completed") {
                                              setCarouselUi(ideaId, { state: "success", label: "Done" });
                                              const t = carouselPollRefByIdeaRef.current[ideaId];
                                              if (t) window.clearInterval(t);
                                              carouselPollRefByIdeaRef.current[ideaId] = null;
                                            } else if (status === "failed") {
                                              setCarouselUi(ideaId, { state: "error", label: "Error", error: err || "Failed" });
                                              const t = carouselPollRefByIdeaRef.current[ideaId];
                                              if (t) window.clearInterval(t);
                                              carouselPollRefByIdeaRef.current[ideaId] = null;
                                            }
                                          } catch {
                                            // ignore poll errors
                                          }
                                        };

                                        void pollOnce();
                                        carouselPollRefByIdeaRef.current[ideaId] = window.setInterval(() => void pollOnce(), 500);
                                      } catch (e: any) {
                                        setCarouselUi(ideaId, { state: "error", label: "Error", error: String(e?.message || e || "Create failed") });
                                      }
                                    }}
                                    title="Create a new carousel project from this idea"
                                  >
                                    Create carousel
                                  </button>
                                  <button
                                    type="button"
                                    className="h-8 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-semibold disabled:opacity-50"
                                    disabled={busy || !actions?.updateIdea}
                                    onClick={async () => {
                                      if (!actions?.updateIdea) return;
                                      setIdeaActionError(null);
                                      setIdeaBusyIds((prev) => new Set(prev).add(i.id));
                                      try {
                                        await actions.updateIdea({ action: "unapprove", ideaId: i.id });
                                        await refreshSources({ keepSelection: true });
                                      } catch (e: any) {
                                        setIdeaActionError(String(e?.message || e || "Remove failed"));
                                      } finally {
                                        setIdeaBusyIds((prev) => {
                                          const n = new Set(prev);
                                          n.delete(i.id);
                                          return n;
                                        });
                                      }
                                    }}
                                    title="Remove from approved queue"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {selectedGroup ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{selectedGroup.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {selectedGroup.sources.length} source{selectedGroup.sources.length === 1 ? "" : "s"} •{" "}
                          {selectedGroup.ideaCount} idea{selectedGroup.ideaCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-6">
                      {selectedGroup.sources.map((s) => (
                        <div key={s.id} className="rounded-xl border border-slate-200 bg-white">
                          <div className="px-4 py-3 border-b border-slate-100">
                            <div className="text-xs font-semibold text-slate-700">Source URL</div>
                            <div className="mt-0.5 text-xs text-slate-500 break-all">{s.sourceUrl}</div>
                          </div>
                          <div className="p-4">
                            {Array.isArray(s.ideas) && s.ideas.length > 0 ? (
                              <div className="space-y-3">
                                {s.ideas.map((i) => (
                                  <div key={i.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="text-sm font-semibold text-slate-900">{i.title}</div>
                                      <div className="shrink-0 flex items-center gap-2">
                                        <div className="text-[11px] text-slate-500">{String(i.status || "")}</div>
                                        {(() => {
                                          const busy = ideaBusyIds.has(i.id);
                                          const status = String(i.status || "");
                                          const canUpdate = !!actions?.updateIdea;
                                          const isDismissed = status === "dismissed";
                                          const isApproved = status === "approved";
                                          const isPending = status === "pending";
                                          if (isDismissed && !includeDismissed) return null;
                                          return (
                                            <div className="flex items-center gap-2">
                                              {isPending ? (
                                                <button
                                                  type="button"
                                                  className="h-8 px-3 rounded-md bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
                                                  disabled={busy || !canUpdate}
                                                  onClick={async () => {
                                                    if (!actions?.updateIdea) return;
                                                    setIdeaActionError(null);
                                                    setIdeaBusyIds((prev) => new Set(prev).add(i.id));
                                                    try {
                                                      await actions.updateIdea({ action: "approve", ideaId: i.id });
                                                      await refreshSources({ keepSelection: true });
                                                    } catch (e: any) {
                                                      setIdeaActionError(String(e?.message || e || "Approve failed"));
                                                    } finally {
                                                      setIdeaBusyIds((prev) => {
                                                        const n = new Set(prev);
                                                        n.delete(i.id);
                                                        return n;
                                                      });
                                                    }
                                                  }}
                                                  title="Approve (adds to queue)"
                                                >
                                                  Approve
                                                </button>
                                              ) : null}
                                              {isApproved ? (
                                                <button
                                                  type="button"
                                                  className="h-8 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-semibold disabled:opacity-50"
                                                  disabled={busy || !canUpdate}
                                                  onClick={async () => {
                                                    if (!actions?.updateIdea) return;
                                                    setIdeaActionError(null);
                                                    setIdeaBusyIds((prev) => new Set(prev).add(i.id));
                                                    try {
                                                      await actions.updateIdea({ action: "unapprove", ideaId: i.id });
                                                      await refreshSources({ keepSelection: true });
                                                    } catch (e: any) {
                                                      setIdeaActionError(String(e?.message || e || "Remove failed"));
                                                    } finally {
                                                      setIdeaBusyIds((prev) => {
                                                        const n = new Set(prev);
                                                        n.delete(i.id);
                                                        return n;
                                                      });
                                                    }
                                                  }}
                                                  title="Remove from approved queue"
                                                >
                                                  Remove
                                                </button>
                                              ) : null}
                                              {!isDismissed ? (
                                                <button
                                                  type="button"
                                                  className="h-8 px-3 rounded-md border border-red-200 bg-white text-red-700 text-xs font-semibold disabled:opacity-50"
                                                  disabled={busy || !canUpdate}
                                                  onClick={async () => {
                                                    if (!actions?.updateIdea) return;
                                                    setIdeaActionError(null);
                                                    setIdeaBusyIds((prev) => new Set(prev).add(i.id));
                                                    try {
                                                      await actions.updateIdea({ action: "dismiss", ideaId: i.id });
                                                      await refreshSources({ keepSelection: true });
                                                    } catch (e: any) {
                                                      setIdeaActionError(String(e?.message || e || "Dismiss failed"));
                                                    } finally {
                                                      setIdeaBusyIds((prev) => {
                                                        const n = new Set(prev);
                                                        n.delete(i.id);
                                                        return n;
                                                      });
                                                    }
                                                  }}
                                                  title="Dismiss (hides forever by default)"
                                                >
                                                  Dismiss
                                                </button>
                                              ) : null}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    <div className="mt-2 space-y-2">
                                      {Array.isArray(i.bullets) ? (
                                        i.bullets.slice(0, 3).map((b: any, idx: number) => (
                                          <div key={`${i.id}:b:${idx}`} className="text-xs text-slate-700">
                                            <span className="font-semibold">{String(b?.heading || "")}:</span>{" "}
                                            <span className="text-slate-600">
                                              {Array.isArray(b?.points) ? b.points.slice(0, 2).join(" • ") : ""}
                                            </span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-xs text-slate-500">No bullets</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500">No ideas saved for this source yet.</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-600">Select a source group on the left.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

