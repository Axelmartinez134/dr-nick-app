"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";
import { useEditorSelector } from "@/features/editor/store";
import { SwipeIdeasChatModal } from "@/features/editor/components/SwipeIdeasChatModal";
import { SwipeIdeasPickerModal } from "@/features/editor/components/SwipeIdeasPickerModal";

type Creator = {
  id: string;
  channelId: string;
  channelName: string;
  feedUrl: string;
  isActive: boolean;
  lastRefreshedAt: string | null;
  lastRefreshError: string | null;
  createdAt: string;
  videoCount: number;
};

type Video = {
  id: string;
  creatorId: string;
  channelId: string;
  channelName: string;
  title: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  description: string | null;
  publishedAt: string;
  fetchedAt: string | null;
  viewCount: number | null;
  likeCount: number | null;
  note: string | null;
  mirroredSwipeItemId: string | null;
  mirroredCreatedProjectId: string | null;
  mirroredEnrichStatus: string | null;
  mirroredEnrichError: string | null;
  mirroredTranscript: string | null;
};

function getActiveAccountHeader(): Record<string, string> {
  try {
    const id = typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
    return id ? ({ "x-account-id": id } as Record<string, string>) : ({} as Record<string, string>);
  } catch {
    return {} as Record<string, string>;
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
  if (!raw) return "Unknown time";
  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts)) return "Unknown time";
  const diffMs = Date.now() - ts;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.round(diffMonths / 12)}y ago`;
}

function formatNumber(v: number | null) {
  if (!Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(v));
}

export function YoutubeCreatorFeedPanel() {
  const actions = useEditorSelector((s: any) => (s as any).actions);
  const currentProjectId = useEditorSelector((s: any) => (s as any).currentProjectId);
  const isMobile = useEditorSelector((s: any) => !!(s as any).isMobile);

  const [creators, setCreators] = useState<Creator[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false);
  const [busyCreatorId, setBusyCreatorId] = useState<string | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>("all");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [feedUrlDraft, setFeedUrlDraft] = useState<string>("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [templateTypeId, setTemplateTypeId] = useState<"enhanced" | "regular">(() => {
    try {
      const raw = typeof window !== "undefined" ? String(window.localStorage.getItem("swipeFile.templateTypeId") || "").trim() : "";
      return raw === "regular" ? "regular" : "enhanced";
    } catch {
      return "enhanced";
    }
  });
  const templateTypeIdRef = useRef<"enhanced" | "regular">(templateTypeId);
  const [savedPromptId, setSavedPromptId] = useState<string>("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const pendingAutoGenerateProjectIdRef = useRef<string | null>(null);
  const [ideasCount, setIdeasCount] = useState<number>(0);
  const [ideasChatOpen, setIdeasChatOpen] = useState(false);
  const [ideasPickerOpen, setIdeasPickerOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [noteSaveStatus, setNoteSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);
  const noteSaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    templateTypeIdRef.current = templateTypeId;
    try {
      window.localStorage.setItem("swipeFile.templateTypeId", templateTypeId);
    } catch {
      // ignore
    }
  }, [templateTypeId]);

  const selectedVideo = useMemo(() => {
    if (selectedVideoId) return videos.find((video) => video.id === selectedVideoId) || null;
    return videos[0] || null;
  }, [selectedVideoId, videos]);

  useEffect(() => {
    setSelectedVideoId((prev) => {
      if (prev && videos.some((video) => video.id === prev)) return prev;
      return videos[0]?.id || null;
    });
  }, [videos]);

  useEffect(() => {
    setNoteDraft(String(selectedVideo?.note || ""));
    setNoteSaveStatus("idle");
    setNoteSaveError(null);
    if (noteSaveTimeoutRef.current) window.clearTimeout(noteSaveTimeoutRef.current);
    noteSaveTimeoutRef.current = null;
  }, [selectedVideo?.id, selectedVideo?.note]);

  useEffect(() => {
    const pending = pendingAutoGenerateProjectIdRef.current;
    if (!pending) return;
    if (String(currentProjectId || "") !== String(pending)) return;
    pendingAutoGenerateProjectIdRef.current = null;
    try {
      actions?.onClickGenerateCopy?.();
    } catch {
      // ignore
    }
  }, [actions, currentProjectId]);

  const loadCreators = async (opts?: { preserveMessage?: boolean }) => {
    setCreatorsLoading(true);
    if (!opts?.preserveMessage) setPanelError(null);
    try {
      const json = await authedFetchJson("/api/yt-rss/creators", { method: "GET" });
      const rows: Creator[] = Array.isArray(json.creators) ? (json.creators as Creator[]) : [];
      setCreators(rows);
      setSelectedCreatorId((prev) => {
        if (prev === "all") return "all";
        return rows.some((creator) => creator.id === prev) ? prev : "all";
      });
    } catch (e: any) {
      setPanelError(String(e?.message || e || "Failed to load creators"));
    } finally {
      setCreatorsLoading(false);
    }
  };

  const loadVideos = async (creatorId = selectedCreatorId, opts?: { preserveMessage?: boolean }) => {
    setVideosLoading(true);
    if (!opts?.preserveMessage) setPanelError(null);
    try {
      const qp = new URLSearchParams();
      qp.set("limit", "200");
      if (creatorId && creatorId !== "all") qp.set("creatorId", creatorId);
      const json = await authedFetchJson(`/api/yt-rss/videos?${qp.toString()}`, { method: "GET" });
      const rows: Video[] = Array.isArray(json.videos) ? (json.videos as Video[]) : [];
      setVideos(rows);
    } catch (e: any) {
      setPanelError(String(e?.message || e || "Failed to load videos"));
    } finally {
      setVideosLoading(false);
    }
  };

  useEffect(() => {
    void loadCreators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadVideos(selectedCreatorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCreatorId]);

  const refreshIdeasCount = async (swipeItemId: string) => {
    const id = String(swipeItemId || "").trim();
    if (!id) {
      setIdeasCount(0);
      return;
    }
    try {
      const json = await authedFetchJson(`/api/swipe-file/items/${encodeURIComponent(id)}/ideas`, { method: "GET" });
      const rows = Array.isArray(json.ideas) ? (json.ideas as any[]) : [];
      setIdeasCount(rows.length);
    } catch {
      setIdeasCount(0);
    }
  };

  useEffect(() => {
    if (!selectedVideo?.mirroredSwipeItemId) {
      setIdeasCount(0);
      return;
    }
    void refreshIdeasCount(selectedVideo.mirroredSwipeItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideo?.mirroredSwipeItemId]);

  const saveNoteNow = async (videoId: string, note: string) => {
    setNoteSaveStatus("saving");
    setNoteSaveError(null);
    try {
      await authedFetchJson(`/api/yt-rss/videos/${encodeURIComponent(videoId)}`, {
        method: "PATCH",
        body: JSON.stringify({ note: note.trim() ? note.trim() : null }),
      });
      setVideos((prev) => prev.map((video) => (video.id === videoId ? { ...video, note: note.trim() ? note.trim() : null } : video)));
      setNoteSaveStatus("saved");
      window.setTimeout(() => setNoteSaveStatus("idle"), 1200);
      return true;
    } catch (e: any) {
      setNoteSaveStatus("error");
      setNoteSaveError(String(e?.message || e || "Failed to save note"));
      window.setTimeout(() => setNoteSaveStatus("idle"), 2000);
      return false;
    }
  };

  const scheduleNoteSave = (videoId: string, note: string) => {
    if (noteSaveTimeoutRef.current) window.clearTimeout(noteSaveTimeoutRef.current);
    noteSaveTimeoutRef.current = window.setTimeout(() => {
      noteSaveTimeoutRef.current = null;
      void saveNoteNow(videoId, note);
    }, 800);
  };

  const onAddCreator = async () => {
    const feedUrl = String(feedUrlDraft || "").trim();
    if (!feedUrl) return;
    setAddBusy(true);
    setAddError(null);
    setNotice(null);
    setWarning(null);
    try {
      const json = await authedFetchJson("/api/yt-rss/creators", {
        method: "POST",
        body: JSON.stringify({ feedUrl }),
      });
      const nextCreators: Creator[] = Array.isArray(json.creators) ? (json.creators as Creator[]) : [];
      setCreators(nextCreators);
      const addedCreatorId = String(json.addedCreatorId || "").trim();
      setFeedUrlDraft("");
      setSelectedCreatorId(addedCreatorId || "all");
      setNotice(
        `Added creator. Cached ${Number(json.refreshStats?.insertedCount || 0)} new videos and refreshed ${Number(json.refreshStats?.updatedCount || 0)} existing videos.`
      );
      await loadVideos(addedCreatorId || "all", { preserveMessage: true });
    } catch (e: any) {
      setAddError(String(e?.message || e || "Failed to add creator"));
    } finally {
      setAddBusy(false);
    }
  };

  const onToggleCreator = async (creator: Creator, nextActive: boolean) => {
    setBusyCreatorId(creator.id);
    setPanelError(null);
    try {
      await authedFetchJson(`/api/yt-rss/creators/${encodeURIComponent(creator.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextActive }),
      });
      await loadCreators({ preserveMessage: true });
    } catch (e: any) {
      setPanelError(String(e?.message || e || "Failed to update creator"));
    } finally {
      setBusyCreatorId(null);
    }
  };

  const onDeleteCreator = async (creator: Creator) => {
    if (!window.confirm(`Delete ${creator.channelName}? Cached videos for this creator will also be removed.`)) return;
    setBusyCreatorId(creator.id);
    setPanelError(null);
    try {
      await authedFetchJson(`/api/yt-rss/creators/${encodeURIComponent(creator.id)}`, { method: "DELETE" });
      const nextSelected = selectedCreatorId === creator.id ? "all" : selectedCreatorId;
      setSelectedCreatorId(nextSelected);
      await loadCreators({ preserveMessage: true });
      await loadVideos(nextSelected, { preserveMessage: true });
    } catch (e: any) {
      setPanelError(String(e?.message || e || "Failed to delete creator"));
    } finally {
      setBusyCreatorId(null);
    }
  };

  const onRefreshFeeds = async (creatorId?: string) => {
    setWarning(null);
    setNotice(creatorId ? "Refreshing creator feed…" : "Refreshing all active creator feeds…");
    setPanelError(null);
    setBusyCreatorId(creatorId || "__all__");
    try {
      const json = await authedFetchJson("/api/yt-rss/refresh", {
        method: "POST",
        body: JSON.stringify(creatorId ? { creatorId } : {}),
      });
      if (Number(json.failedFetches || 0) > 0) {
        setWarning(`${Number(json.failedFetches || 0)} creator feed refreshes failed. Cached videos are still shown below.`);
      } else {
        setWarning(null);
      }
      setNotice(
        `Refresh complete. ${Number(json.insertedCount || 0)} new videos, ${Number(json.updatedCount || 0)} updated videos.`
      );
      await Promise.all([loadCreators({ preserveMessage: true }), loadVideos(selectedCreatorId, { preserveMessage: true })]);
    } catch (e: any) {
      const msg = String(e?.message || e || "Refresh failed");
      if (!creatorId) setWarning(msg);
      else setPanelError(msg);
    } finally {
      setBusyCreatorId(null);
    }
  };

  const onEnrichVideo = async (video: Video) => {
    setPanelError(null);
    setWarning(null);
    setNotice("Mirroring video into Swipe File and enriching transcript…");
    setBusyCreatorId(`enrich:${video.id}`);
    try {
      await authedFetchJson(`/api/yt-rss/videos/${encodeURIComponent(video.id)}/enrich`, { method: "POST" });
      await loadVideos(selectedCreatorId, { preserveMessage: true });
      setNotice("Enrich complete. The mirrored Swipe File item is now available for ideas and project creation.");
    } catch (e: any) {
      setPanelError(String(e?.message || e || "Enrich failed"));
    } finally {
      setBusyCreatorId(null);
    }
  };

  const onCreateProject = async (video: Video, opts: { ideaId: string | null; templateTypeId: "enhanced" | "regular"; savedPromptId: string }) => {
    const swipeItemId = String(video.mirroredSwipeItemId || "").trim();
    if (!swipeItemId) throw new Error("Enrich this video first");
    setCreateBusy(true);
    setCreateError(null);
    try {
      const json = await authedFetchJson(`/api/swipe-file/items/${encodeURIComponent(swipeItemId)}/create-project`, {
        method: "POST",
        body: JSON.stringify({
          templateTypeId: opts.templateTypeId === "regular" ? "regular" : "enhanced",
          savedPromptId: String(opts.savedPromptId || "").trim(),
          ideaId: opts.ideaId ?? null,
        }),
      });
      const projectId = String(json.projectId || "").trim();
      if (!projectId) throw new Error("Missing project id");
      pendingAutoGenerateProjectIdRef.current = projectId;
      actions?.onCloseSwipeFileModal?.();
      actions?.onLoadProject?.(projectId);
      await loadVideos(selectedCreatorId, { preserveMessage: true });
    } catch (e: any) {
      setCreateError(String(e?.message || e || "Create project failed"));
    } finally {
      setCreateBusy(false);
    }
  };

  const canGenerateIdeas = !!String(selectedVideo?.mirroredSwipeItemId || "").trim() && !!String(selectedVideo?.mirroredTranscript || "").trim();
  const canCreateProject = !!String(selectedVideo?.mirroredSwipeItemId || "").trim();
  const enrichDone = String(selectedVideo?.mirroredEnrichStatus || "").toLowerCase() === "ok";
  const enrichBusy = busyCreatorId === `enrich:${selectedVideo?.id}`;

  return (
    <>
      <div className="border-b border-slate-100 p-3">
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-slate-700">Add YouTube feed</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Paste a YouTube channel URL like `youtube.com/@name` or a direct `videos.xml?channel_id=UC...` feed URL.
                </div>
                <input
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                  value={feedUrlDraft}
                  onChange={(e) => setFeedUrlDraft(e.target.value)}
                  placeholder="https://www.youtube.com/@creator or https://www.youtube.com/feeds/videos.xml?channel_id=UC..."
                />
              </div>
              <div className="flex shrink-0 items-end gap-2">
                <button
                  type="button"
                  className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                  disabled={addBusy || !String(feedUrlDraft || "").trim()}
                  onClick={() => void onAddCreator()}
                >
                  {addBusy ? "Adding…" : "Add creator"}
                </button>
              </div>
            </div>
            {addError ? <div className="mt-2 text-[11px] text-red-600">❌ {addError}</div> : null}
          </div>

          {isMobile ? (
            <select
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
              value={selectedCreatorId}
              onChange={(e) => setSelectedCreatorId(String(e.target.value || "all"))}
            >
              <option value="all">All creators</option>
              {creators.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.channelName}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-9 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              onClick={() => void onRefreshFeeds()}
              disabled={busyCreatorId === "__all__" || creatorsLoading || videosLoading}
            >
              {busyCreatorId === "__all__" ? "Refreshing…" : "Refresh all active"}
            </button>
            {selectedCreatorId !== "all" ? (
              <button
                type="button"
                className="h-9 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                onClick={() => void onRefreshFeeds(selectedCreatorId)}
                disabled={!!busyCreatorId}
              >
                Refresh selected creator
              </button>
            ) : null}
          </div>
          {panelError ? <div className="text-xs text-red-600">❌ {panelError}</div> : null}
          {warning ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{warning}</div> : null}
          {notice ? <div className="text-xs text-slate-600">{notice}</div> : null}
          {creatorsLoading || videosLoading ? <div className="text-xs text-slate-500">Loading…</div> : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)_360px]">
        <aside className="hidden md:block border-r border-slate-100 bg-slate-50/50 p-3 overflow-auto">
          <div className="text-xs font-semibold text-slate-600 uppercase">Creators</div>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              className={[
                "w-full rounded-xl border px-3 py-3 text-left shadow-sm transition-colors",
                selectedCreatorId === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
              ].join(" ")}
              onClick={() => setSelectedCreatorId("all")}
            >
              <div className="text-sm font-semibold">All creators</div>
              <div className={`mt-1 text-[11px] ${selectedCreatorId === "all" ? "text-slate-200" : "text-slate-500"}`}>
                {creators.length} tracked creators
              </div>
            </button>
            {creators.map((creator) => {
              const selected = creator.id === selectedCreatorId;
              const rowBusy = busyCreatorId === creator.id;
              return (
                <div
                  key={creator.id}
                  className={[
                    "rounded-xl border px-3 py-3 shadow-sm transition-colors",
                    selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900",
                  ].join(" ")}
                >
                  <button type="button" className="w-full text-left" onClick={() => setSelectedCreatorId(creator.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{creator.channelName}</div>
                        <div className={`mt-1 text-[11px] ${selected ? "text-slate-200" : "text-slate-500"}`}>{creator.videoCount} cached videos</div>
                      </div>
                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          creator.isActive
                            ? selected
                              ? "border-emerald-300 bg-emerald-400/20 text-emerald-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : selected
                              ? "border-amber-300 bg-amber-400/20 text-amber-100"
                              : "border-amber-200 bg-amber-50 text-amber-700",
                        ].join(" ")}
                      >
                        {creator.isActive ? "active" : "paused"}
                      </span>
                    </div>
                  </button>
                  <div className={`mt-2 text-[11px] ${selected ? "text-slate-200" : "text-slate-500"}`}>
                    Last refresh: {creator.lastRefreshedAt ? formatRelativeTime(creator.lastRefreshedAt) : "never"}
                  </div>
                  {creator.lastRefreshError ? (
                    <div className={`mt-1 text-[11px] ${selected ? "text-amber-200" : "text-amber-700"}`}>Warning: {creator.lastRefreshError}</div>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className={[
                        "h-8 rounded-md border px-2 text-[11px] font-semibold shadow-sm disabled:opacity-50",
                        selected ? "border-slate-600 bg-slate-800 text-white hover:bg-slate-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                      disabled={!!rowBusy}
                      onClick={() => void onRefreshFeeds(creator.id)}
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      className={[
                        "h-8 rounded-md border px-2 text-[11px] font-semibold shadow-sm disabled:opacity-50",
                        selected ? "border-slate-600 bg-slate-800 text-white hover:bg-slate-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                      disabled={!!rowBusy}
                      onClick={() => void onToggleCreator(creator, !creator.isActive)}
                    >
                      {creator.isActive ? "Pause" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className={[
                        "h-8 rounded-md border px-2 text-[11px] font-semibold shadow-sm disabled:opacity-50",
                        selected ? "border-red-300 bg-red-500/10 text-red-100 hover:bg-red-500/20" : "border-red-200 bg-white text-red-700 hover:bg-red-50",
                      ].join(" ")}
                      disabled={!!rowBusy}
                      onClick={() => void onDeleteCreator(creator)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
            {videos.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">
                {creators.length === 0 ? "No creators yet. Add a YouTube RSS feed URL to start caching videos." : "No cached videos for this creator yet."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {videos.map((video) => {
                  const selected = video.id === selectedVideo?.id;
                  const mirrored = !!String(video.mirroredSwipeItemId || "").trim();
                  const transcriptReady = !!String(video.mirroredTranscript || "").trim();
                  return (
                    <button
                      key={video.id}
                      type="button"
                      className={[
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                        selected ? "bg-slate-50" : "bg-white hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => setSelectedVideoId(video.id)}
                    >
                      <div className="h-[68px] w-[120px] shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {video.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            YouTube
                          </span>
                          {mirrored ? (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              mirrored
                            </span>
                          ) : null}
                          {transcriptReady ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              transcript ready
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{video.title}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {video.channelName} • {formatRelativeTime(video.publishedAt)}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {formatNumber(video.viewCount)} views • {formatNumber(video.likeCount)} likes
                        </div>
                        {video.description ? <div className="mt-1 line-clamp-2 text-[11px] text-slate-600">{video.description}</div> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <aside className="border-l border-slate-100 bg-white p-4 overflow-auto">
          {!selectedVideo ? (
            <div className="text-sm text-slate-600">Select a video to view details.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      YouTube RSS
                    </span>
                    <span className="text-xs text-slate-500">{selectedVideo.channelName}</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-snug text-slate-900">{selectedVideo.title}</div>
                </div>
              </div>

              {selectedVideo.thumbnailUrl ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedVideo.thumbnailUrl} alt="" className="h-auto w-full object-cover" />
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                <a className="break-all text-xs text-blue-700 underline" href={selectedVideo.videoUrl} target="_blank" rel="noreferrer">
                  {selectedVideo.videoUrl}
                </a>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>Published: {formatRelativeTime(selectedVideo.publishedAt)}</div>
                  <div>Cached: {selectedVideo.fetchedAt ? formatRelativeTime(selectedVideo.fetchedAt) : "never"}</div>
                  <div>Views: {formatNumber(selectedVideo.viewCount)}</div>
                  <div>Likes: {formatNumber(selectedVideo.likeCount)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(String(selectedVideo.videoUrl || ""));
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                    disabled={enrichBusy}
                    onClick={() => void onEnrichVideo(selectedVideo)}
                  >
                    {enrichBusy ? "Enriching…" : enrichDone ? "Enrich again" : "Enrich"}
                  </button>
                </div>
                {selectedVideo.mirroredSwipeItemId ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                    Mirrored into Swipe File for this account. Further Swipe actions now use that mirrored item.
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    Enrich first to mirror this video into the active account’s Swipe File and unlock downstream repurpose actions.
                  </div>
                )}
                {selectedVideo.mirroredEnrichError ? <div className="text-xs text-red-600">❌ {selectedVideo.mirroredEnrichError}</div> : null}
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold text-slate-700">Angle / Notes</div>
                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                  rows={4}
                  value={noteDraft}
                  onChange={(e) => {
                    const next = e.target.value;
                    setNoteDraft(next);
                    if (!selectedVideo?.id) return;
                    scheduleNoteSave(selectedVideo.id, next);
                  }}
                  onBlur={() => {
                    if (!selectedVideo?.id) return;
                    if (noteSaveTimeoutRef.current) window.clearTimeout(noteSaveTimeoutRef.current);
                    noteSaveTimeoutRef.current = null;
                    void saveNoteNow(selectedVideo.id, noteDraft);
                  }}
                  placeholder="Optional: your angle, hook, or reason this topic matters."
                />
                {noteSaveStatus === "saving" ? <div className="mt-2 text-[11px] text-slate-500">Saving…</div> : null}
                {noteSaveStatus === "saved" ? <div className="mt-2 text-[11px] text-emerald-700">Saved</div> : null}
                {noteSaveStatus === "error" ? <div className="mt-2 text-[11px] text-red-600">❌ {noteSaveError || "Save failed"}</div> : null}
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-700">Repurpose</div>
                <div className="mt-3 space-y-3">
                  <button
                    type="button"
                    className="h-10 w-full rounded-lg bg-black text-sm font-semibold text-white shadow-md transition-shadow hover:shadow-lg disabled:opacity-50"
                    disabled={!canCreateProject || createBusy}
                    onClick={() => setIdeasPickerOpen(true)}
                    title={canCreateProject ? "Create project + rewrite" : "Enrich this video first"}
                  >
                    {createBusy ? "Creating…" : "Create project + rewrite"}
                  </button>
                  {createError ? <div className="text-xs text-red-600">❌ {createError}</div> : null}
                  <button
                    type="button"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    disabled={!canGenerateIdeas}
                    onClick={() => setIdeasChatOpen(true)}
                    title={canGenerateIdeas ? "Generate ideas from the mirrored Swipe item" : "Enrich this video until a transcript is available"}
                  >
                    Generate ideas{ideasCount > 0 ? ` (${ideasCount})` : ""}
                  </button>
                  <button
                    type="button"
                    className={[
                      "h-10 w-full rounded-lg border text-sm font-semibold shadow-sm transition-colors",
                      selectedVideo.mirroredCreatedProjectId
                        ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400",
                    ].join(" ")}
                    disabled={!selectedVideo.mirroredCreatedProjectId}
                    onClick={() => {
                      if (!selectedVideo.mirroredCreatedProjectId) return;
                      actions?.onCloseSwipeFileModal?.();
                      actions?.onLoadProject?.(String(selectedVideo.mirroredCreatedProjectId));
                    }}
                  >
                    {selectedVideo.mirroredCreatedProjectId ? "Open existing project" : "No project yet"}
                  </button>
                </div>
              </div>

              {selectedVideo.description ? (
                <details className="mt-6 rounded-lg border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">Description</summary>
                  <div className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{selectedVideo.description}</div>
                </details>
              ) : null}
              <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">Transcript</summary>
                <div className="mt-2 whitespace-pre-wrap text-xs text-slate-700">
                  {selectedVideo.mirroredTranscript ? selectedVideo.mirroredTranscript : <span className="text-slate-400">Run Enrich to fetch transcript.</span>}
                </div>
              </details>
            </>
          )}
        </aside>
      </div>

      <SwipeIdeasChatModal
        open={ideasChatOpen}
        onClose={() => setIdeasChatOpen(false)}
        swipeItemId={selectedVideo?.mirroredSwipeItemId || null}
        swipeItemLabel={selectedVideo?.title || "YouTube video"}
        onIdeaSaved={() => {
          if (selectedVideo?.mirroredSwipeItemId) void refreshIdeasCount(selectedVideo.mirroredSwipeItemId);
        }}
      />

      <SwipeIdeasPickerModal
        open={ideasPickerOpen}
        onClose={() => setIdeasPickerOpen(false)}
        swipeItemId={selectedVideo?.mirroredSwipeItemId || null}
        swipeItemLabel={selectedVideo?.title || "YouTube video"}
        initialTemplateTypeId={templateTypeIdRef.current}
        initialSavedPromptId={savedPromptId}
        angleNotesSnapshot={noteDraft}
        onSelectionChange={(args) => {
          const nextType = args.templateTypeId === "regular" ? "regular" : "enhanced";
          setTemplateTypeId(nextType);
          setSavedPromptId(String(args.savedPromptId || "").trim());
        }}
        onPick={(args) => {
          setIdeasPickerOpen(false);
          if (!selectedVideo) return;
          void onCreateProject(selectedVideo, {
            ideaId: args.ideaId,
            templateTypeId: args.templateTypeId === "regular" ? "regular" : "enhanced",
            savedPromptId: args.savedPromptId,
          });
        }}
      />
    </>
  );
}
