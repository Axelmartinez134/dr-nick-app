"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";

type DigestCreator = {
  id: string;
  channelId: string;
  channelName: string;
  feedUrl: string;
  isActive: boolean;
  lastRefreshedAt: string | null;
  lastRefreshError: string | null;
  createdAt: string;
  digestEnabled: boolean;
  digestEnabledAt: string | null;
};

type DigestRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  videosDiscovered: number;
  videosProcessed: number;
  videosFailed: number;
  videosPending: number;
  topicsExtracted: number;
  promptSource: string | null;
  errorMessage: string | null;
  runErrors: any[];
};

type DigestTopic = {
  id: string;
  title: string;
  whatItIs: string;
  whyItMatters: string;
  carouselAngle: string | null;
  status: "active" | "starred" | "dismissed";
  note: string | null;
  sortOrder: number;
};

type DigestVideo = {
  id: string;
  ytVideoId: string | null;
  digestRunId: string | null;
  status: string;
  retryCount: number;
  errorMessage: string | null;
  youtubeVideoUrl: string;
  videoTitle: string;
  creatorName: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  summary: string | null;
  uniqueViewpoints: string[];
  transcriptCharCount: number | null;
  rawTranscript: string | null;
  sourceRemoved: boolean;
  currentCreatorId: string | null;
  currentCreatorIsActive: boolean | null;
  digestEnabled: boolean | null;
  topics: DigestTopic[];
};

function getActiveAccountHeader(): Record<string, string> {
  try {
    const id = typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
    return id ? ({ "x-account-id": id } as Record<string, string>) : {};
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

function formatRelativeTime(input: string | null) {
  const raw = String(input || "").trim();
  if (!raw) return "never";
  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts)) return "unknown";
  const diffMs = Date.now() - ts;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(raw).toLocaleString();
}

function formatTimestamp(input: string | null) {
  const raw = String(input || "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString();
}

function topicStatusLabel(status: string) {
  if (status === "starred") return "Starred";
  if (status === "dismissed") return "Dismissed";
  return "Active";
}

function runStatusTone(status: string) {
  if (status === "failed") return "bg-red-100 text-red-700";
  if (status === "completed_with_errors") return "bg-amber-100 text-amber-700";
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  return "bg-sky-100 text-sky-700";
}

export function DailyDigestPanel() {
  const [creators, setCreators] = useState<DigestCreator[]>([]);
  const [videos, setVideos] = useState<DigestVideo[]>([]);
  const [runs, setRuns] = useState<DigestRun[]>([]);
  const [activeRun, setActiveRun] = useState<DigestRun | null>(null);
  const [lastCompletedRun, setLastCompletedRun] = useState<DigestRun | null>(null);
  const [latestTopicRunId, setLatestTopicRunId] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptStatus, setPromptStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [promptError, setPromptError] = useState<string | null>(null);
  const promptSaveRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [runNowBusy, setRunNowBusy] = useState(false);
  const [busyCreatorId, setBusyCreatorId] = useState<string | null>(null);
  const [showManageCreators, setShowManageCreators] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "new" | "starred">("all");
  const [selectedSourceId, setSelectedSourceId] = useState<string>("all");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [expandedVideoIds, setExpandedVideoIds] = useState<Record<string, boolean>>({});
  const [isWide, setIsWide] = useState(true);

  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [noteError, setNoteError] = useState<string | null>(null);
  const noteSaveRef = useRef<number | null>(null);

  useEffect(() => {
    const onResize = () => setIsWide(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const refreshData = async (opts?: { includePrompt?: boolean; setSpinner?: boolean }) => {
    const includePrompt = opts?.includePrompt !== false;
    const setSpinner = opts?.setSpinner !== false;
    if (setSpinner) setLoading(true);
    setError(null);
    try {
      const requests: Promise<any>[] = [
        authedFetchJson("/api/daily-digest/creators", { method: "GET" }),
        authedFetchJson("/api/daily-digest/runs", { method: "GET" }),
        authedFetchJson("/api/daily-digest/videos", { method: "GET" }),
      ];
      if (includePrompt) requests.push(authedFetchJson("/api/daily-digest/prompt", { method: "GET" }));
      const [creatorsJson, runsJson, videosJson, promptJson] = await Promise.all(requests);
      setCreators(Array.isArray(creatorsJson.creators) ? creatorsJson.creators : []);
      setRuns(Array.isArray(runsJson.runs) ? runsJson.runs : []);
      setActiveRun(runsJson.activeRun || null);
      setLastCompletedRun(runsJson.lastCompletedRun || null);
      setVideos(Array.isArray(videosJson.videos) ? videosJson.videos : []);
      setLatestTopicRunId(typeof videosJson.latestTopicRunId === "string" ? videosJson.latestTopicRunId : videosJson.latestTopicRunId ?? null);
      if (includePrompt) {
        setPromptDraft(String(promptJson?.prompt || ""));
        setPromptStatus("idle");
        setPromptError(null);
      }
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load Daily Digest"));
    } finally {
      if (setSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeRun && !runNowBusy) return;
    const t = window.setInterval(() => {
      void refreshData({ includePrompt: false, setSpinner: false });
    }, 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.id, runNowBusy]);

  const creatorTopicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let removed = 0;
    for (const video of videos) {
      for (const topic of video.topics || []) {
        if (topic.status === "dismissed") continue;
        if (video.sourceRemoved || !video.currentCreatorId) {
          removed += 1;
          continue;
        }
        counts.set(video.currentCreatorId, (counts.get(video.currentCreatorId) || 0) + 1);
      }
    }
    return { counts, removed };
  }, [videos]);

  const visibleCreatorRows = useMemo(() => {
    return creators.filter((creator) => {
      const count = creatorTopicCounts.counts.get(creator.id) || 0;
      if (creator.digestEnabled) return true;
      return count > 0;
    });
  }, [creators, creatorTopicCounts]);

  const manageCreatorRows = useMemo(() => {
    const visibleIds = new Set(visibleCreatorRows.map((creator) => creator.id));
    return creators.filter((creator) => !creator.digestEnabled && !visibleIds.has(creator.id));
  }, [creators, visibleCreatorRows]);

  const filteredVideos = useMemo(() => {
    const selectedSource = selectedSourceId;
    const visible = videos
      .map((video) => {
        if (selectedSource !== "all") {
          if (selectedSource === "__removed__") {
            if (!video.sourceRemoved) return null;
          } else if (video.currentCreatorId !== selectedSource) {
            return null;
          }
        }

        let topics = [...(video.topics || [])];
        if (!showDismissed) topics = topics.filter((topic) => topic.status !== "dismissed");
        if (filterMode === "starred") topics = topics.filter((topic) => topic.status === "starred");
        if (filterMode === "new") topics = topics.filter(() => video.digestRunId === latestTopicRunId);

        const showFailed = filterMode === "all" && video.status === "failed";
        if (!showFailed && topics.length === 0) return null;
        return { ...video, topics };
      })
      .filter(Boolean) as DigestVideo[];
    return visible;
  }, [videos, selectedSourceId, showDismissed, filterMode, latestTopicRunId]);

  const selectedTopic = useMemo(() => {
    if (!selectedTopicId) return null;
    for (const video of filteredVideos) {
      const found = (video.topics || []).find((topic) => topic.id === selectedTopicId);
      if (found) return { video, topic: found };
    }
    return null;
  }, [filteredVideos, selectedTopicId]);

  useEffect(() => {
    if (!selectedTopicId) return;
    if (!selectedTopic) setSelectedTopicId(null);
  }, [selectedTopicId, selectedTopic]);

  useEffect(() => {
    setNoteDraft(selectedTopic?.topic.note || "");
    setNoteStatus("idle");
    setNoteError(null);
    if (noteSaveRef.current) window.clearTimeout(noteSaveRef.current);
    noteSaveRef.current = null;
  }, [selectedTopic?.topic.id, selectedTopic?.topic.note]);

  const saveTopicPatch = async (topicId: string, patch: Record<string, any>) => {
    await authedFetchJson(`/api/daily-digest/topics/${encodeURIComponent(topicId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    await refreshData({ includePrompt: false, setSpinner: false });
  };

  const scheduleNoteSave = (topicId: string, note: string) => {
    if (noteSaveRef.current) window.clearTimeout(noteSaveRef.current);
    noteSaveRef.current = window.setTimeout(async () => {
      noteSaveRef.current = null;
      setNoteStatus("saving");
      setNoteError(null);
      try {
        await saveTopicPatch(topicId, { note: note.trim() ? note.trim() : null });
        setNoteStatus("saved");
        window.setTimeout(() => setNoteStatus("idle"), 1200);
      } catch (e: any) {
        setNoteStatus("error");
        setNoteError(String(e?.message || e || "Failed to save note"));
      }
    }, 700);
  };

  const updatePromptNow = async (value: string) => {
    setPromptStatus("saving");
    setPromptError(null);
    try {
      await authedFetchJson("/api/daily-digest/prompt", {
        method: "POST",
        body: JSON.stringify({ distillPrompt: value }),
      });
      setPromptStatus("saved");
      window.setTimeout(() => setPromptStatus("idle"), 1200);
    } catch (e: any) {
      setPromptStatus("error");
      setPromptError(String(e?.message || e || "Failed to save prompt"));
    }
  };

  const toggleCreator = async (creator: DigestCreator, enabled: boolean) => {
    setBusyCreatorId(creator.id);
    try {
      await authedFetchJson("/api/daily-digest/creators", {
        method: "POST",
        body: JSON.stringify({ ytCreatorId: creator.id, enabled }),
      });
      await refreshData({ includePrompt: false, setSpinner: false });
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to update creator"));
    } finally {
      setBusyCreatorId(null);
    }
  };

  const runNow = async () => {
    setRunNowBusy(true);
    setNotice("Running Daily Digest…");
    setError(null);
    try {
      await authedFetchJson("/api/daily-digest/manual-run", { method: "POST" });
      await refreshData({ includePrompt: false, setSpinner: false });
      setNotice("Daily Digest run complete.");
    } catch (e: any) {
      setError(String(e?.message || e || "Daily Digest run failed"));
    } finally {
      setRunNowBusy(false);
      window.setTimeout(() => setNotice(null), 2000);
    }
  };

  const latestVisibleVideo = filteredVideos[0] || null;
  const detailVideo = selectedTopic?.video || latestVisibleVideo;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-100 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Daily Digest</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Auto-processed insights from your tracked creators. Runs daily at 6am and 12pm.
            </div>
          </div>
          <button
            type="button"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setPromptOpen((v) => !v)}
          >
            ⚙ Prompt
          </button>
        </div>
        {promptOpen ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <textarea
              className="min-h-[180px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              value={promptDraft}
              onChange={(e) => {
                const next = e.target.value;
                setPromptDraft(next);
                if (promptSaveRef.current) window.clearTimeout(promptSaveRef.current);
                promptSaveRef.current = window.setTimeout(() => {
                  promptSaveRef.current = null;
                  void updatePromptNow(next);
                }, 800);
              }}
            />
            <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
              {promptStatus === "loading" ? <span>Loading…</span> : null}
              {promptStatus === "saving" ? <span>Saving…</span> : null}
              {promptStatus === "saved" ? <span className="text-emerald-700">Saved ✓</span> : null}
              {promptStatus === "error" && promptError ? <span className="text-red-600">❌ {promptError}</span> : null}
              <button
                type="button"
                className="ml-auto h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={async () => {
                  try {
                    setPromptStatus("saving");
                    await authedFetchJson("/api/daily-digest/prompt", { method: "DELETE" });
                    await refreshData({ includePrompt: true, setSpinner: false });
                    setPromptStatus("saved");
                  } catch (e: any) {
                    setPromptStatus("error");
                    setPromptError(String(e?.message || e || "Failed to reset prompt"));
                  }
                }}
              >
                Reset to default
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_360px]">
        <aside className="min-h-0 overflow-auto border-r border-slate-100 bg-slate-50/50 p-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-700">Status</div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${runStatusTone(activeRun?.status || lastCompletedRun?.status || "idle")}`}>
                {activeRun || runNowBusy ? "Running" : lastCompletedRun?.status === "completed_with_errors" ? "Warnings" : lastCompletedRun?.status === "failed" ? "Failed" : "Ready"}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-600">
              {activeRun || runNowBusy ? (
                <div>Running now{activeRun?.startedAt ? ` • started ${formatRelativeTime(activeRun.startedAt)}` : "…"}</div>
              ) : (
                <div>Last completed: {lastCompletedRun ? formatTimestamp(lastCompletedRun.finishedAt || lastCompletedRun.startedAt) : "No runs yet"}</div>
              )}
            </div>
            {lastCompletedRun ? (
              <div className="mt-2 text-[11px] text-slate-600">
                {lastCompletedRun.videosProcessed} videos • {lastCompletedRun.topicsExtracted} topics • {lastCompletedRun.videosFailed} failures
              </div>
            ) : null}
            <button
              type="button"
              className="mt-3 h-9 w-full rounded-md bg-slate-900 px-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              disabled={runNowBusy || !!activeRun}
              onClick={() => void runNow()}
            >
              {runNowBusy || activeRun ? "Running…" : "Run now"}
            </button>
          </div>

          <div className="mt-3">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-600">Sources</div>
            <div className="space-y-2">
              <button
                type="button"
                className={`w-full rounded-xl border px-3 py-3 text-left text-sm shadow-sm ${selectedSourceId === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}
                onClick={() => setSelectedSourceId("all")}
              >
                <div className="font-semibold">All creators</div>
              </button>
              {visibleCreatorRows.map((creator) => {
                const count = creatorTopicCounts.counts.get(creator.id) || 0;
                const selected = selectedSourceId === creator.id;
                return (
                  <div
                    key={creator.id}
                    className={`rounded-xl border px-3 py-3 shadow-sm ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"} ${!creator.digestEnabled ? "opacity-80" : ""}`}
                  >
                    <button type="button" className="w-full text-left" onClick={() => setSelectedSourceId(creator.id)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {creator.channelName}
                            {!creator.digestEnabled ? " (paused)" : ""}
                          </div>
                          <div className={`mt-1 text-[11px] ${selected ? "text-slate-200" : "text-slate-500"}`}>{count} topics</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"}`}>
                          {count}
                        </span>
                      </div>
                    </button>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        className={`h-8 rounded-md border px-2 text-[11px] font-semibold shadow-sm ${selected ? "border-slate-600 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                        disabled={busyCreatorId === creator.id}
                        onClick={() => void toggleCreator(creator, !creator.digestEnabled)}
                      >
                        {busyCreatorId === creator.id ? "Saving…" : creator.digestEnabled ? "Pause" : "Enable"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {creatorTopicCounts.removed > 0 ? (
                <button
                  type="button"
                  className={`w-full rounded-xl border px-3 py-3 text-left text-sm shadow-sm ${selectedSourceId === "__removed__" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}
                  onClick={() => setSelectedSourceId("__removed__")}
                >
                  <div className="font-semibold">Removed creators</div>
                  <div className={`mt-1 text-[11px] ${selectedSourceId === "__removed__" ? "text-slate-200" : "text-slate-500"}`}>{creatorTopicCounts.removed} topics</div>
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              className="text-xs font-semibold text-slate-700 underline"
              onClick={() => setShowManageCreators((v) => !v)}
            >
              Manage creators
            </button>
            {showManageCreators ? (
              <div className="mt-2 space-y-2">
                {manageCreatorRows.length === 0 ? <div className="text-[11px] text-slate-500">No additional creators.</div> : null}
                {manageCreatorRows.map((creator) => (
                  <div key={creator.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-sm font-semibold text-slate-900">{creator.channelName}</div>
                    <button
                      type="button"
                      className="mt-2 h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      disabled={busyCreatorId === creator.id}
                      onClick={() => void toggleCreator(creator, true)}
                    >
                      {busyCreatorId === creator.id ? "Saving…" : "Enable"}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col border-t border-slate-100 lg:border-t-0">
          <div className="border-b border-slate-100 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "new", "starred"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`h-9 rounded-full border px-4 text-xs font-semibold shadow-sm ${filterMode === mode ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                  onClick={() => setFilterMode(mode)}
                >
                  {mode === "all" ? "All" : mode === "new" ? "New" : "Starred"}
                </button>
              ))}
              <button
                type="button"
                className={`h-9 rounded-full border px-4 text-xs font-semibold shadow-sm ${showDismissed ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                onClick={() => setShowDismissed((v) => !v)}
              >
                Show dismissed
              </button>
            </div>
            {error ? <div className="mt-2 text-xs text-red-600">❌ {error}</div> : null}
            {notice ? <div className="mt-2 text-xs text-slate-600">{notice}</div> : null}
            {loading ? <div className="mt-2 text-xs text-slate-500">Loading…</div> : null}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {filteredVideos.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">No digest items match this filter yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredVideos.map((video) => {
                  const expanded = expandedVideoIds[video.id] ?? (video.digestRunId === latestTopicRunId);
                  return (
                    <div key={video.id} className="p-4">
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 text-left"
                        onClick={() => setExpandedVideoIds((prev) => ({ ...prev, [video.id]: !expanded }))}
                      >
                        <div className="h-[45px] w-[80px] shrink-0 overflow-hidden rounded bg-slate-100">
                          {video.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-600">{video.creatorName}</span>
                            {video.sourceRemoved ? <span className="text-[10px] font-semibold text-amber-700">(source removed)</span> : null}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${runStatusTone(video.status === "failed" ? "failed" : "completed")}`}>
                              {video.status}
                            </span>
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{video.videoTitle}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{formatRelativeTime(video.publishedAt)}</div>
                        </div>
                      </button>

                      {expanded ? (
                        <div className="mt-3">
                          {video.summary ? <blockquote className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{video.summary}</blockquote> : null}
                          {video.status === "failed" ? (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{video.errorMessage || "Video processing failed."}</div>
                          ) : null}
                          {video.topics.length > 0 ? (
                            <div className="mt-3 space-y-3">
                              {video.topics.map((topic) => {
                                const selected = selectedTopicId === topic.id;
                                return (
                                  <div key={topic.id} className={`rounded-xl border p-3 ${selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"}`}>
                                    <button type="button" className="w-full text-left" onClick={() => setSelectedTopicId(topic.id)}>
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-semibold text-slate-900">{topic.title}</div>
                                        <span className="text-[10px] font-semibold text-slate-500">{topicStatusLabel(topic.status)}</span>
                                      </div>
                                      <div className="mt-1 line-clamp-2 text-xs text-slate-600">{topic.whatItIs}</div>
                                      <div className="mt-1 line-clamp-2 text-xs text-slate-500">{topic.whyItMatters}</div>
                                    </button>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700"
                                        onClick={() => void saveTopicPatch(topic.id, { status: topic.status === "starred" ? "active" : "starred" })}
                                      >
                                        {topic.status === "starred" ? "Unstar" : "Star"}
                                      </button>
                                      <button
                                        type="button"
                                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700"
                                        onClick={() => void saveTopicPatch(topic.id, { status: topic.status === "dismissed" ? "active" : "dismissed" })}
                                      >
                                        {topic.status === "dismissed" ? "Undismiss" : "Dismiss"}
                                      </button>
                                      <button
                                        type="button"
                                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700"
                                        onClick={() => setSelectedTopicId(topic.id)}
                                      >
                                        Note
                                      </button>
                                      <button
                                        type="button"
                                        disabled
                                        className="h-8 cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-400"
                                      >
                                        Create carousel
                                      </button>
                                    </div>
                                    {!isWide && selected ? (
                                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                                        <div className="font-semibold text-slate-900">{topic.title}</div>
                                        <div className="mt-2 whitespace-pre-wrap">{topic.whatItIs}</div>
                                        <div className="mt-2 whitespace-pre-wrap">{topic.whyItMatters}</div>
                                        {topic.carouselAngle ? <div className="mt-2 whitespace-pre-wrap text-slate-500">Carousel angle: {topic.carouselAngle}</div> : null}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                          {video.uniqueViewpoints.length > 0 ? (
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-slate-700">Unique viewpoints</div>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                                {video.uniqueViewpoints.map((item, index) => (
                                  <li key={`${video.id}-uv-${index}`}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <aside className="hidden min-h-0 overflow-auto border-l border-slate-100 bg-white p-4 lg:block">
          {!detailVideo ? (
            <div className="text-sm text-slate-600">Select a topic to view detail.</div>
          ) : selectedTopic ? (
            <>
              <div className="text-xs font-semibold text-slate-600">{selectedTopic.video.creatorName}</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{selectedTopic.topic.title}</div>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">{selectedTopic.topic.whatItIs}</div>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">{selectedTopic.topic.whyItMatters}</div>
              {selectedTopic.topic.carouselAngle ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                  <span className="font-semibold text-slate-900">Carousel angle:</span> {selectedTopic.topic.carouselAngle}
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700">Source video</div>
                {selectedTopic.video.thumbnailUrl ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedTopic.video.thumbnailUrl} alt="" className="h-auto w-full object-cover" />
                  </div>
                ) : null}
                <div className="mt-3 text-sm font-semibold text-slate-900">{selectedTopic.video.videoTitle}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {selectedTopic.video.creatorName}
                  {selectedTopic.video.sourceRemoved ? " (source removed)" : ""}
                </div>
                <a
                  className="mt-2 inline-block text-xs font-semibold text-blue-700 underline"
                  href={selectedTopic.video.youtubeVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on YouTube
                </a>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-700">Notes</div>
                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                  rows={5}
                  value={noteDraft}
                  onChange={(e) => {
                    const next = e.target.value;
                    setNoteDraft(next);
                    void scheduleNoteSave(selectedTopic.topic.id, next);
                  }}
                  onBlur={() => {
                    if (!selectedTopic?.topic.id) return;
                    if (noteSaveRef.current) window.clearTimeout(noteSaveRef.current);
                    noteSaveRef.current = null;
                    void saveTopicPatch(selectedTopic.topic.id, { note: noteDraft.trim() ? noteDraft.trim() : null });
                  }}
                />
                {noteStatus === "saving" ? <div className="mt-2 text-[11px] text-slate-500">Saving…</div> : null}
                {noteStatus === "saved" ? <div className="mt-2 text-[11px] text-emerald-700">Saved ✓</div> : null}
                {noteStatus === "error" && noteError ? <div className="mt-2 text-[11px] text-red-600">❌ {noteError}</div> : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => void saveTopicPatch(selectedTopic.topic.id, { status: selectedTopic.topic.status === "starred" ? "active" : "starred" })}
                >
                  {selectedTopic.topic.status === "starred" ? "Unstar" : "Star"}
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => void saveTopicPatch(selectedTopic.topic.id, { status: selectedTopic.topic.status === "dismissed" ? "active" : "dismissed" })}
                >
                  {selectedTopic.topic.status === "dismissed" ? "Undismiss" : "Dismiss"}
                </button>
                <button
                  type="button"
                  disabled
                  className="h-9 cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-400 shadow-sm"
                >
                  Create carousel
                </button>
              </div>

              {selectedTopic.video.rawTranscript ? (
                <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">Transcript excerpt</summary>
                  <div className="mt-2 whitespace-pre-wrap text-xs text-slate-700">
                    {selectedTopic.video.rawTranscript.slice(0, 2000)}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <>
              <div className="text-xs font-semibold text-slate-600">Video summary</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{detailVideo.videoTitle}</div>
              {detailVideo.summary ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{detailVideo.summary}</div>
              ) : null}
              <a className="mt-3 inline-block text-xs font-semibold text-blue-700 underline" href={detailVideo.youtubeVideoUrl} target="_blank" rel="noreferrer">
                View on YouTube
              </a>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
