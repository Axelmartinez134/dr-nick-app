"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";
import { useEditorSelector } from "@/features/editor/store";

type Category = { id: string; name: string };
type SwipeItem = {
  id: string;
  createdAt: string;
  url: string;
  platform: string;
  status: string;
  categoryId: string;
  tags: string[];
  note: string | null;
  enrichStatus: string;
  enrichError: string | null;
  enrichedAt: string | null;
  caption: string | null;
  transcript: string | null;
  authorHandle: string | null;
  title: string | null;
  thumbUrl: string | null;
  createdProjectId: string | null;
};

type SavedPrompt = { id: string; title: string; is_active: boolean };

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

function platformBadge(platform: string) {
  const p = String(platform || "unknown").toLowerCase();
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border";
  if (p === "instagram") return `${base} bg-pink-50 text-pink-700 border-pink-200`;
  if (p === "youtube") return `${base} bg-red-50 text-red-700 border-red-200`;
  if (p === "tiktok") return `${base} bg-slate-50 text-slate-800 border-slate-200`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200`;
}

export function SwipeFileModal() {
  const open = useEditorSelector((s: any) => !!(s as any).swipeFileModalOpen);
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const actions = useEditorSelector((s: any) => (s as any).actions);
  const currentProjectId = useEditorSelector((s: any) => (s as any).currentProjectId);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<SwipeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const selectedItem = useMemo(() => items.find((it) => it.id === selectedItemId) || null, [items, selectedItemId]);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const noteDirty = useMemo(() => {
    const server = selectedItem?.note ?? "";
    return String(noteDraft || "") !== String(server || "");
  }, [noteDraft, selectedItem?.note]);

  const [templateTypeId, setTemplateTypeId] = useState<"enhanced" | "regular">("enhanced");
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [savedPromptId, setSavedPromptId] = useState<string>("");
  const [promptsLoading, setPromptsLoading] = useState(false);

  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const pendingAutoGenerateProjectIdRef = useRef<string | null>(null);
  const captureLink = useMemo(() => {
    try {
      const origin = typeof window !== "undefined" ? String(window.location.origin || "").trim() : "";
      if (!origin) return "/swipe-file/capture?url=";
      return `${origin}/swipe-file/capture?url=`;
    } catch {
      return "/swipe-file/capture?url=";
    }
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };

      const catsRes = await fetch("/api/swipe-file/categories", { method: "GET", headers });
      const catsJson = await catsRes.json().catch(() => null);
      if (!catsRes.ok || !catsJson?.success) throw new Error(String(catsJson?.error || `Failed to load categories (${catsRes.status})`));
      const nextCats: Category[] = Array.isArray(catsJson.categories)
        ? catsJson.categories.map((c: any) => ({ id: String(c.id), name: String(c.name || "") }))
        : [];
      setCategories(nextCats);

      const qp = new URLSearchParams();
      if (activeCategoryId && activeCategoryId !== "all") qp.set("categoryId", activeCategoryId);
      if (q.trim()) qp.set("q", q.trim());
      const itemsRes = await fetch(`/api/swipe-file/items${qp.toString() ? `?${qp.toString()}` : ""}`, { method: "GET", headers });
      const itemsJson = await itemsRes.json().catch(() => null);
      if (!itemsRes.ok || !itemsJson?.success) throw new Error(String(itemsJson?.error || `Failed to load items (${itemsRes.status})`));
      const nextItems: SwipeItem[] = Array.isArray(itemsJson.items) ? (itemsJson.items as any[]) : [];
      setItems(nextItems);

      // Keep selection stable if possible.
      setSelectedItemId((prev) => {
        if (prev && nextItems.some((i) => i.id === prev)) return prev;
        return nextItems[0]?.id || null;
      });
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load Swipe File"));
    } finally {
      setLoading(false);
    }
  };

  const refreshPrompts = async (typeId: "enhanced" | "regular") => {
    setPromptsLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/editor/user-settings/poppy-prompts/list?type=${encodeURIComponent(typeId)}`, { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load prompts (${res.status})`));
      const rows: SavedPrompt[] = Array.isArray(j.prompts)
        ? j.prompts.map((p: any) => ({ id: String(p.id), title: String(p.title || "Prompt"), is_active: !!p.is_active }))
        : [];
      setSavedPrompts(rows);
      const active = rows.find((p) => p.is_active)?.id || rows[0]?.id || "";
      setSavedPromptId(active);
    } catch {
      setSavedPrompts([]);
      setSavedPromptId("");
    } finally {
      setPromptsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!isSuperadmin) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isSuperadmin]);

  useEffect(() => {
    // Sync note draft when selection changes.
    setNoteDraft(String(selectedItem?.note || ""));
  }, [selectedItem?.id, selectedItem?.note]);

  useEffect(() => {
    if (!open) return;
    if (!isSuperadmin) return;
    void refreshPrompts(templateTypeId);
  }, [open, templateTypeId, isSuperadmin]);

  // Auto-run Generate Copy once the created project is actually loaded in the editor.
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

  if (!open) return null;
  if (!actions) return null;

  if (!isSuperadmin) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-6">
        <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 p-6">
          <div className="text-lg font-semibold text-slate-900">Swipe File</div>
          <div className="mt-2 text-sm text-slate-600">Access denied.</div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm hover:bg-slate-50"
              onClick={actions.onCloseSwipeFileModal}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const enrichableIds = items
    .filter((it) => String(it.platform || "").toLowerCase() === "instagram")
    .filter((it) => {
      const st = String(it.enrichStatus || "idle").toLowerCase();
      return st !== "ok" && st !== "running";
    })
    .map((it) => it.id);

  const runEnrichOne = async (itemId: string) => {
    const token = await getToken();
    if (!token) throw new Error("Missing auth token");
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
    const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/enrich`, { method: "POST", headers });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) throw new Error(String(j?.error || `Enrich failed (${res.status})`));
  };

  const onEnrichAll = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      for (const id of enrichableIds) {
        // Refresh between runs so UI shows status changes.
        await runEnrichOne(id);
        await refresh();
      }
    } catch (e: any) {
      setError(String(e?.message || e || "Enrich all failed"));
    } finally {
      setLoading(false);
    }
  };

  const onCreateProject = async () => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      if (!selectedItem) throw new Error("Select an item first");
      if (!savedPromptId) throw new Error("Select a prompt");

      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };

      // Persist angle/note before creating project so snapshot matches what you typed.
      if (noteDirty) {
        const noteRes = await fetch(`/api/swipe-file/items/${encodeURIComponent(selectedItem.id)}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ note: String(noteDraft || "").trim() || null }),
        });
        const noteJson = await noteRes.json().catch(() => null);
        if (!noteRes.ok || !noteJson?.success) {
          throw new Error(String(noteJson?.error || `Failed to save note (${noteRes.status})`));
        }
      }

      const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(selectedItem.id)}/create-project`, {
        method: "POST",
        headers,
        body: JSON.stringify({ templateTypeId, savedPromptId }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Create project failed (${res.status})`));
      const projectId = String(j?.projectId || "").trim();
      if (!projectId) throw new Error("Missing projectId");

      // Close modal, load project, then auto-generate copy if transcript is present.
      actions.onCloseSwipeFileModal?.();
      actions.onLoadProject?.(projectId);
      if (String(selectedItem.transcript || "").trim()) {
        pendingAutoGenerateProjectIdRef.current = projectId;
      }
    } catch (e: any) {
      setCreateError(String(e?.message || e || "Create project failed"));
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/50 p-2 md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) actions.onCloseSwipeFileModal();
      }}
    >
      <div className="w-full max-w-6xl h-full bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900 truncate">Swipe File</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Save links on mobile, enrich on desktop, repurpose into carousels.
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">iPhone Shortcut URL</div>
              <input
                className="h-8 flex-1 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 shadow-sm"
                value={captureLink}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Swipe File capture link base"
                title="Use this as the base URL in your iPhone Shortcut (append URL-encoded shared link)."
              />
              <button
                type="button"
                className="h-8 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(captureLink);
                  } catch {
                    // ignore
                  }
                }}
                title="Copy capture link base"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-50"
              onClick={() => void refresh()}
              disabled={loading}
              title="Refresh"
            >
              Refresh
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-md bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-50"
              onClick={() => void onEnrichAll()}
              disabled={loading || enrichableIds.length === 0}
              title="Enrich all pending Instagram items (one-by-one)"
            >
              Enrich all pending
            </button>
            <button
              type="button"
              className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={actions.onCloseSwipeFileModal}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[240px_1fr_360px]">
          {/* Left: categories */}
          <aside className="border-r border-slate-100 bg-slate-50/50 p-3 overflow-auto">
            <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Categories</div>
            <button
              type="button"
              className={[
                "w-full text-left px-3 py-2 rounded-lg text-sm border",
                activeCategoryId === "all" ? "bg-white border-slate-200 text-slate-900" : "bg-transparent border-transparent text-slate-700 hover:bg-white/70",
              ].join(" ")}
              onClick={() => setActiveCategoryId("all")}
            >
              All
            </button>
            <div className="mt-1 space-y-1">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={[
                    "w-full text-left px-3 py-2 rounded-lg text-sm border",
                    activeCategoryId === c.id ? "bg-white border-slate-200 text-slate-900" : "bg-transparent border-transparent text-slate-700 hover:bg-white/70",
                  ].join(" ")}
                  onClick={() => setActiveCategoryId(c.id)}
                  title={c.name}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </aside>

          {/* Middle: list */}
          <main className="min-h-0 flex flex-col">
            <div className="p-3 border-b border-slate-100">
              <input
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                placeholder="Search (URL, title, note, caption)…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void refresh();
                }}
              />
              {error ? <div className="mt-2 text-xs text-red-600">❌ {error}</div> : null}
              {loading ? <div className="mt-2 text-xs text-slate-500">Loading…</div> : null}
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {items.length === 0 ? (
                <div className="p-6 text-sm text-slate-600">No items yet. Use the iPhone Shortcut to save a link.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {items.map((it) => {
                    const selected = it.id === selectedItemId;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        className={[
                          "w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors",
                          selected ? "bg-slate-50" : "bg-white",
                        ].join(" ")}
                        onClick={() => setSelectedItemId(it.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={platformBadge(it.platform)}>{String(it.platform || "unknown")}</span>
                              <span className="text-xs text-slate-500">
                                {String(it.enrichStatus || "idle").toLowerCase() === "ok"
                                  ? "enriched"
                                  : String(it.enrichStatus || "idle").toLowerCase() === "needs_transcript"
                                    ? "needs transcript"
                                    : String(it.enrichStatus || "idle").toLowerCase()}
                              </span>
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900 truncate">
                              {it.title ? it.title : it.note ? it.note : it.url}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 truncate">{it.url}</div>
                          </div>
                          <div className="text-[11px] text-slate-500 whitespace-nowrap">
                            {it.createdAt ? new Date(it.createdAt).toLocaleDateString() : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </main>

          {/* Right: detail */}
          <aside className="border-l border-slate-100 bg-white p-4 overflow-auto">
            {!selectedItem ? (
              <div className="text-sm text-slate-600">Select an item to view details.</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={platformBadge(selectedItem.platform)}>{String(selectedItem.platform || "unknown")}</span>
                      {selectedItem.authorHandle ? (
                        <span className="text-xs text-slate-600">@{String(selectedItem.authorHandle)}</span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900 break-words">
                      {selectedItem.title || selectedItem.note || "Swipe item"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <a
                    className="text-xs text-blue-700 underline break-all"
                    href={selectedItem.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selectedItem.url}
                  </a>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm hover:bg-slate-50"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(String(selectedItem.url || ""));
                        } catch {
                          // ignore
                        }
                      }}
                      title="Copy URL"
                    >
                      Copy link
                    </button>
                    <button
                      type="button"
                      className="h-9 px-3 rounded-md bg-slate-900 text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                      disabled={String(selectedItem.platform || "").toLowerCase() !== "instagram" || loading}
                      onClick={async () => {
                        try {
                          setLoading(true);
                          await runEnrichOne(selectedItem.id);
                          await refresh();
                        } catch (e: any) {
                          setError(String(e?.message || e || "Enrich failed"));
                        } finally {
                          setLoading(false);
                        }
                      }}
                      title={String(selectedItem.platform || "").toLowerCase() === "instagram" ? "Enrich (Apify)" : "Enrich (V2)"}
                    >
                      Enrich
                    </button>
                  </div>
                  {selectedItem.enrichError ? <div className="text-xs text-red-600">❌ {selectedItem.enrichError}</div> : null}
                  {String(selectedItem.enrichStatus || "").toLowerCase() === "needs_transcript" ? (
                    <div className="text-xs text-amber-700">
                      Transcript missing. Transcribe is V2 (Whisper).
                    </div>
                  ) : null}
                </div>

                <div className="mt-5">
                  <div className="text-xs font-semibold text-slate-700">Angle / Notes</div>
                  <textarea
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                    rows={4}
                    value={noteDraft}
                    onChange={(e) => {
                      setNoteDraft(e.target.value);
                    }}
                    placeholder="Optional: what do you like about this? what angle to use?"
                  />
                  {noteDirty ? <div className="mt-2 text-[11px] text-amber-700">Unsaved changes (will save when you create project).</div> : null}
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-700">Repurpose</div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Template type</div>
                      <select
                        className="mt-2 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                        value={templateTypeId}
                        onChange={(e) => setTemplateTypeId(e.target.value === "regular" ? "regular" : "enhanced")}
                        disabled={createBusy}
                      >
                        <option value="enhanced">Enhanced</option>
                        <option value="regular">Regular</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Saved prompt</div>
                      <select
                        className="mt-2 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-50"
                        value={savedPromptId}
                        onChange={(e) => setSavedPromptId(e.target.value)}
                        disabled={createBusy || promptsLoading || savedPrompts.length === 0}
                      >
                        {savedPrompts.length === 0 ? (
                          <option value="">{promptsLoading ? "Loading..." : "No saved prompts found"}</option>
                        ) : null}
                        {savedPrompts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.is_active ? "★ " : ""}
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-md hover:shadow-lg transition-shadow disabled:opacity-50"
                      disabled={createBusy || !savedPromptId}
                      onClick={() => void onCreateProject()}
                      title="Create project and auto-generate copy (when transcript exists)"
                    >
                      {createBusy ? "Creating..." : "Create project + rewrite"}
                    </button>
                    {createError ? <div className="text-xs text-red-600">❌ {createError}</div> : null}
                    {selectedItem.createdProjectId ? (
                      <button
                        type="button"
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors"
                        onClick={() => {
                          actions.onCloseSwipeFileModal?.();
                          actions.onLoadProject?.(String(selectedItem.createdProjectId));
                        }}
                      >
                        Open existing project
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6">
                  <details className="rounded-lg border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">Caption</summary>
                    <div className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">
                      {selectedItem.caption ? selectedItem.caption : <span className="text-slate-400">—</span>}
                    </div>
                  </details>
                  <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">Transcript</summary>
                    <div className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">
                      {selectedItem.transcript ? selectedItem.transcript : <span className="text-slate-400">—</span>}
                    </div>
                  </details>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

