"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";
import { useEditorSelector } from "@/features/editor/store";
import { SwipeIdeasChatModal } from "@/features/editor/components/SwipeIdeasChatModal";
import { SwipeIdeasPickerModal } from "@/features/editor/components/SwipeIdeasPickerModal";

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
  const isMobile = useEditorSelector((s: any) => !!(s as any).isMobile);
  const actions = useEditorSelector((s: any) => (s as any).actions);
  const currentProjectId = useEditorSelector((s: any) => (s as any).currentProjectId);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<SwipeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [captureKey, setCaptureKey] = useState<string | null>(null);
  const [captureKeyPresent, setCaptureKeyPresent] = useState<boolean | null>(null);

  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<null | { x: number; y: number; itemId: string }>(null);
  const [rowMenuBusy, setRowMenuBusy] = useState(false);

  const [repurposeFilter, setRepurposeFilter] = useState<"all" | "repurposed" | "not_repurposed">("all");

  const selectedItem = useMemo(() => items.find((it) => it.id === selectedItemId) || null, [items, selectedItemId]);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const noteDirty = useMemo(() => {
    const server = selectedItem?.note ?? "";
    return String(noteDraft || "") !== String(server || "");
  }, [noteDraft, selectedItem?.note]);
  const [noteSaveStatus, setNoteSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);
  const noteSaveTimeoutRef = useRef<number | null>(null);

  const [templateTypeId, setTemplateTypeId] = useState<"enhanced" | "regular">(() => {
    try {
      const raw = typeof window !== "undefined" ? String(window.localStorage.getItem("swipeFile.templateTypeId") || "").trim() : "";
      return raw === "regular" ? "regular" : "enhanced";
    } catch {
      return "enhanced";
    }
  });
  const templateTypeIdRef = useRef<"enhanced" | "regular">(templateTypeId);
  useEffect(() => {
    templateTypeIdRef.current = templateTypeId;
    try {
      window.localStorage.setItem("swipeFile.templateTypeId", templateTypeId);
    } catch {
      // ignore
    }
  }, [templateTypeId]);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [savedPromptId, setSavedPromptId] = useState<string>("");
  const [promptsLoading, setPromptsLoading] = useState(false);

  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const pendingAutoGenerateProjectIdRef = useRef<string | null>(null);

  const [ideasChatOpen, setIdeasChatOpen] = useState(false);
  const [ideasCount, setIdeasCount] = useState<number>(0);
  const [ideasPickerOpen, setIdeasPickerOpen] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<null | { kind: "actions" | "repurpose" | "overflow"; itemId?: string }>(null);
  const captureLink = useMemo(() => {
    try {
      const origin = typeof window !== "undefined" ? String(window.location.origin || "").trim() : "";
      if (!origin) return "/swipe-file/capture?url=";
      return `${origin}/swipe-file/capture?url=`;
    } catch {
      return "/swipe-file/capture?url=";
    }
  }, []);
  const captureLinkNoLogin = useMemo(() => {
    const base = captureLink.replace("/swipe-file/capture?url=", "/swipe-file/capture");
    if (!captureKey) return null;
    try {
      const u = new URL(base, typeof window !== "undefined" ? window.location.origin : undefined);
      u.searchParams.set("k", captureKey);
      u.searchParams.set("url", "");
      // `url=` should be last-ish, but it's fine.
      return u.toString();
    } catch {
      return `${base}?k=${encodeURIComponent(captureKey)}&url=`;
    }
  }, [captureKey, captureLink]);

  useEffect(() => {
    if (!open) return;
    if (!isSuperadmin) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing auth token");
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
        const res = await fetch("/api/swipe-file/capture-key", { method: "GET", headers });
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load capture key (${res.status})`));
        setCaptureKeyPresent(!!j.keyPresent);
        setCaptureKey(typeof j.key === "string" ? j.key : null);
      } catch {
        if (!cancelled) {
          setCaptureKeyPresent(false);
          setCaptureKey(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isSuperadmin]);

  const refreshIdeasCount = async (itemId: string) => {
    const id = String(itemId || "").trim();
    if (!id) return;
    try {
      const token = await getToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(id)}/ideas`, { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) return;
      const rows = Array.isArray(j.ideas) ? (j.ideas as any[]) : [];
      setIdeasCount(rows.length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!selectedItemId) return;
    void refreshIdeasCount(selectedItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedItemId]);

  const refresh = async (opts?: { setSpinner?: boolean }) => {
    const setSpinner = opts?.setSpinner !== false;
    if (setSpinner) setLoading(true);
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
      return nextItems;
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load Swipe File"));
      return null;
    } finally {
      if (setSpinner) setLoading(false);
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
    if (!open) return;
    if (!isSuperadmin) return;
    // Category filter should apply immediately.
    setRepurposeFilter("all");
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryId]);

  const visibleItems = useMemo(() => {
    const mode = repurposeFilter;
    if (mode === "repurposed") return (items || []).filter((it) => !!String((it as any)?.createdProjectId || "").trim());
    if (mode === "not_repurposed") return (items || []).filter((it) => !String((it as any)?.createdProjectId || "").trim());
    return items || [];
  }, [items, repurposeFilter]);

  useEffect(() => {
    // Keep selection consistent with current filter.
    if (!open) return;
    if (!selectedItemId) {
      setSelectedItemId(visibleItems[0]?.id || null);
      return;
    }
    const ok = visibleItems.some((it) => it.id === selectedItemId);
    if (!ok) setSelectedItemId(visibleItems[0]?.id || null);
  }, [open, selectedItemId, visibleItems]);

  useEffect(() => {
    // Sync note draft when selection changes.
    setNoteDraft(String(selectedItem?.note || ""));
    setNoteSaveStatus("idle");
    setNoteSaveError(null);
    if (noteSaveTimeoutRef.current) window.clearTimeout(noteSaveTimeoutRef.current);
    noteSaveTimeoutRef.current = null;
  }, [selectedItem?.id, selectedItem?.note]);

  useEffect(() => {
    if (!open) return;
    if (!isSuperadmin) return;
    void refreshPrompts(templateTypeId);
  }, [open, templateTypeId, isSuperadmin]);

  useEffect(() => {
    if (!rowMenu) return;
    const onDown = () => setRowMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRowMenu(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [rowMenu]);

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
    // eslint-disable-next-line no-console
    console.log("[SwipeFile] enrich start", { itemId });
    const token = await getToken();
    if (!token) throw new Error("Missing auth token");
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
    const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/enrich`, { method: "POST", headers });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) throw new Error(String(j?.error || `Enrich failed (${res.status})`));
  };

  const runTranscribeOne = async (itemId: string) => {
    // eslint-disable-next-line no-console
    console.log("[SwipeFile] transcribe start", { itemId });
    const token = await getToken();
    if (!token) throw new Error("Missing auth token");
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
    const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/transcribe`, { method: "POST", headers });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) throw new Error(String(j?.error || `Transcribe failed (${res.status})`));
  };

  const saveNoteNow = async (args: { itemId: string; note: string }) => {
    const itemId = String(args.itemId || "").trim();
    if (!itemId) return false;
    const note = String(args.note ?? "");

    setNoteSaveStatus("saving");
    setNoteSaveError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ note: note.trim() ? note.trim() : null }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to save note (${res.status})`));

      setItems((prev) =>
        (prev || []).map((it) => (String(it.id) === itemId ? ({ ...it, note: note.trim() ? note.trim() : null } as any) : it))
      );

      setNoteSaveStatus("saved");
      window.setTimeout(() => setNoteSaveStatus("idle"), 1200);
      return true;
    } catch (e: any) {
      const msg = String(e?.message || e || "Failed to save note");
      setNoteSaveStatus("error");
      setNoteSaveError(msg);
      window.setTimeout(() => setNoteSaveStatus("idle"), 2000);
      return false;
    }
  };

  const scheduleDebouncedNoteSave = (args: { itemId: string; note: string; debounceMs: number }) => {
    if (noteSaveTimeoutRef.current) window.clearTimeout(noteSaveTimeoutRef.current);
    const itemIdAtSchedule = String(args.itemId || "").trim();
    const noteAtSchedule = String(args.note ?? "");
    noteSaveTimeoutRef.current = window.setTimeout(() => {
      noteSaveTimeoutRef.current = null;
      void saveNoteNow({ itemId: itemIdAtSchedule, note: noteAtSchedule });
    }, Math.max(200, Math.floor(args.debounceMs)));
  };

  const onEnrichAll = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const pendingItems = items
        .filter((it) => String(it.platform || "").toLowerCase() === "instagram")
        .filter((it) => {
          const st = String(it.enrichStatus || "idle").toLowerCase();
          return st !== "ok" && st !== "running";
        });

      const total = pendingItems.length;
      let idx = 0;

      for (const it of pendingItems) {
        idx += 1;
        const st = String(it.enrichStatus || "idle").toLowerCase();

        if (st === "needs_transcript") {
          setNotice(`Transcribing ${idx}/${total} (Whisper)…`);
          await runTranscribeOne(it.id);
          await refresh({ setSpinner: false });
          continue;
        }

        setNotice(`Enriching ${idx}/${total} (Apify)…`);
        await runEnrichOne(it.id);
        const nextItems = await refresh({ setSpinner: false });
        const after = Array.isArray(nextItems) ? nextItems.find((x) => x.id === it.id) : null;
        if (String(after?.enrichStatus || "").toLowerCase() === "needs_transcript") {
          setNotice(`Transcript missing — transcribing ${idx}/${total} (Whisper)…`);
          await runTranscribeOne(it.id);
          await refresh({ setSpinner: false });
        }
      }
    } catch (e: any) {
      const msg = String(e?.message || e || "Enrich all failed");
      setActionError(msg);
      setError(msg);
    } finally {
      setNotice(null);
      setLoading(false);
    }
  };

  const onCreateProject = async (opts?: { ideaId: string | null }) => {
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
        body: JSON.stringify({ templateTypeId: templateTypeIdRef.current, savedPromptId, ideaId: opts?.ideaId ?? null }),
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

  const deleteItem = async (itemId: string) => {
    const id = String(itemId || "").trim();
    if (!id) return;
    setRowMenuBusy(true);
    setActionError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(id)}`, { method: "DELETE", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Delete failed (${res.status})`));

      setItems((prev) => (prev || []).filter((it) => String(it.id) !== id));
      setSelectedItemId((prev) => (prev === id ? null : prev));
      setRowMenu(null);
    } catch (e: any) {
      const msg = String(e?.message || e || "Delete failed");
      setActionError(msg);
      setError(msg);
    } finally {
      setRowMenuBusy(false);
    }
  };

  const openLink = (urlRaw: string) => {
    const raw = String(urlRaw || "").trim();
    if (!raw) return;
    try {
      const u = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
      window.open(u, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      return true;
    } catch {
      return false;
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
        <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900 truncate">Swipe File</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Save links on mobile, enrich on desktop, repurpose into carousels.
            </div>
            {!isMobile ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">iPhone Shortcut URL</div>
                  <input
                    className="h-8 flex-1 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 shadow-sm"
                    value={captureLinkNoLogin || captureLink}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Swipe File capture link base"
                    title={
                      captureLinkNoLogin
                        ? "No-login capture link base (includes key). Append URL-encoded shared link after `url=`."
                        : "Capture link base. No-login capture link will appear once your account capture key is loaded."
                    }
                  />
                  <button
                    type="button"
                    className="h-8 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50"
                    onClick={async () => {
                      await copyText(captureLinkNoLogin || captureLink);
                    }}
                    title="Copy capture link base"
                  >
                    Copy
                  </button>
                </div>
                {captureKeyPresent === false ? (
                  <div className="mt-1 text-[11px] text-amber-700">Could not load capture key for this account.</div>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {!isMobile ? (
              <button
                type="button"
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-50"
                onClick={() => void refresh()}
                disabled={loading}
                title="Refresh"
              >
                Refresh
              </button>
            ) : (
              <button
                type="button"
                className="h-10 w-10 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => setMobileSheet({ kind: "overflow" })}
                aria-label="More"
                title="More"
              >
                ⋯
              </button>
            )}
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
          <aside className="hidden md:block border-r border-slate-100 bg-slate-50/50 p-3 overflow-auto">
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isMobile ? (
                  <select
                    className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm"
                    value={activeCategoryId}
                    onChange={(e) => setActiveCategoryId(e.target.value || "all")}
                    title="Category"
                    aria-label="Category"
                  >
                    <option value="all">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  className={[
                    "h-9 px-4 rounded-full border text-xs font-semibold shadow-sm transition-colors",
                    repurposeFilter === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => setRepurposeFilter("all")}
                  title="Show all"
                >
                  All
                </button>
                <button
                  type="button"
                  className={[
                    "h-9 px-4 rounded-full border text-xs font-semibold shadow-sm transition-colors",
                    repurposeFilter === "not_repurposed"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => setRepurposeFilter("not_repurposed")}
                  title="Show only items that do not have a project yet"
                >
                  Not repurposed
                </button>
                <button
                  type="button"
                  className={[
                    "h-9 px-4 rounded-full border text-xs font-semibold shadow-sm transition-colors",
                    repurposeFilter === "repurposed" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => setRepurposeFilter("repurposed")}
                  title="Show only items that already have a project"
                >
                  Repurposed
                </button>
              </div>
              {error ? <div className="mt-2 text-xs text-red-600">❌ {error}</div> : null}
              {notice ? <div className="mt-2 text-xs text-amber-700">{notice}</div> : null}
              {loading ? <div className="mt-2 text-xs text-slate-500">Loading…</div> : null}
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {visibleItems.length === 0 ? (
                <div className="p-6 text-sm text-slate-600">
                  {items.length === 0 ? "No items yet. Use the iPhone Shortcut to save a link." : "No items match this filter."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {visibleItems.map((it) => {
                    const selected = it.id === selectedItemId;
                    const canIdeasChat = !!String(it.transcript || "").trim();
                    const canEnrich = String(it.platform || "").toLowerCase() === "instagram";
                    const enrichStatus = String(it.enrichStatus || "idle").toLowerCase();
                    const enrichDone = enrichStatus === "ok";
                    const enrichRunning = enrichStatus === "running";
                    return (
                      <div
                        key={it.id}
                        className={[
                          "w-full px-4 py-3 transition-colors",
                          !isMobile ? "hover:bg-slate-50" : "",
                          !isMobile && selected ? "bg-slate-50" : "bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => {
                              if (isMobile) {
                                openLink(it.url);
                                return;
                              }
                              setSelectedItemId(it.id);
                            }}
                            title={isMobile ? "Open link" : "Select item"}
                          >
                            <div className="flex items-center gap-2">
                              <span className={platformBadge(it.platform)}>{String(it.platform || "unknown")}</span>
                              <span className="text-xs text-slate-500">
                                {String(it.enrichStatus || "idle").toLowerCase() === "ok"
                                  ? "enriched"
                                  : String(it.enrichStatus || "idle").toLowerCase() === "needs_transcript"
                                    ? "needs transcript"
                                    : String(it.enrichStatus || "idle").toLowerCase()}
                              </span>
                              {String(it.createdProjectId || "").trim() ? (
                                <span className="text-[11px] font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  repurposed
                                </span>
                              ) : null}
                            </div>
                            <div
                              className="mt-1 text-sm font-semibold text-slate-900 overflow-hidden leading-snug"
                              style={{
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical" as any,
                                WebkitLineClamp: 2,
                              }}
                              title={it.title ? it.title : it.note ? it.note : it.url}
                            >
                              {it.title ? it.title : it.note ? it.note : it.url}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap" title={it.url}>
                              {it.url}
                            </div>
                          </button>

                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <div className="text-[11px] text-slate-500 whitespace-nowrap">
                              {it.createdAt ? new Date(it.createdAt).toLocaleDateString() : ""}
                            </div>
                            {isMobile ? (
                              <button
                                type="button"
                                className="h-11 w-11 rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                                onClick={() => {
                                  setSelectedItemId(it.id);
                                  setMobileSheet({ kind: "actions", itemId: it.id });
                                }}
                                aria-label="Actions"
                                title="Actions"
                              >
                                ⋯
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {/* iOS-style action sheet (mobile) */}
                        {isMobile && mobileSheet?.kind === "actions" && mobileSheet.itemId === it.id ? (
                          <div
                            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40"
                            onMouseDown={(e) => {
                              if (e.target === e.currentTarget) setMobileSheet(null);
                            }}
                          >
                            <div className="w-full max-w-[520px] rounded-t-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
                              <div className="px-4 py-3 border-b border-slate-100">
                                <div className="text-xs font-semibold text-slate-700">Actions</div>
                                <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                                  {it.title ? it.title : it.note ? it.note : it.url}
                                </div>
                              </div>
                              <div className="p-2 space-y-2">
                                <button
                                  type="button"
                                  className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold hover:bg-slate-50"
                                  onClick={() => {
                                    setMobileSheet(null);
                                    openLink(it.url);
                                  }}
                                >
                                  Open link
                                </button>
                                <button
                                  type="button"
                                  className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold hover:bg-slate-50"
                                  onClick={async () => {
                                    await copyText(it.url);
                                    setMobileSheet(null);
                                  }}
                                >
                                  Copy link
                                </button>
                                <button
                                  type="button"
                                  className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                                  disabled={!canEnrich || loading || enrichDone || enrichRunning}
                                  onClick={async () => {
                                    if (!canEnrich) return;
                                    if (enrichDone || enrichRunning) return;
                                    setMobileSheet(null);
                                    try {
                                      setLoading(true);
                                      setNotice("Enriching (Apify)…");
                                      setError(null);
                                      setActionError(null);
                                      await runEnrichOne(it.id);
                                      const nextItems = await refresh({ setSpinner: false });
                                      const after = Array.isArray(nextItems) ? nextItems.find((x) => x.id === it.id) : null;
                                      if (String(after?.enrichStatus || "").toLowerCase() === "needs_transcript") {
                                        setNotice("Transcript missing — transcribing (Whisper)…");
                                        await runTranscribeOne(it.id);
                                        await refresh({ setSpinner: false });
                                      }
                                    } catch (e: any) {
                                      const msg = String(e?.message || e || "Enrich failed");
                                      setActionError(msg);
                                      setError(msg);
                                    } finally {
                                      setNotice(null);
                                      setLoading(false);
                                    }
                                  }}
                                  title={
                                    !canEnrich
                                      ? "Enrich is only available for Instagram items right now"
                                      : enrichDone
                                        ? "Already enriched"
                                        : enrichRunning
                                          ? "Enrich running"
                                          : "Enrich (Apify)"
                                  }
                                >
                                  {enrichDone ? "Enriched ✓" : enrichRunning ? "Enriching…" : "Enrich"}
                                </button>
                                <button
                                  type="button"
                                  className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                                  disabled={!canIdeasChat}
                                  onClick={() => {
                                    if (!canIdeasChat) return;
                                    setMobileSheet(null);
                                    setSelectedItemId(it.id);
                                    setIdeasChatOpen(true);
                                  }}
                                  title={!canIdeasChat ? "Enrich first to get a transcript" : "Open Ideas Chat"}
                                >
                                  Ideas Chat
                                </button>
                                <button
                                  type="button"
                                  className="w-full h-12 rounded-xl bg-black text-white text-sm font-semibold hover:bg-slate-900"
                                  onClick={() => {
                                    setSelectedItemId(it.id);
                                    setMobileSheet({ kind: "repurpose", itemId: it.id });
                                  }}
                                >
                                  Repurpose (create project)
                                </button>
                                {String(it.createdProjectId || "").trim() ? (
                                  <button
                                    type="button"
                                    className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold hover:bg-slate-50"
                                    onClick={() => {
                                      setMobileSheet(null);
                                      actions.onCloseSwipeFileModal?.();
                                      actions.onLoadProject?.(String(it.createdProjectId));
                                    }}
                                  >
                                    Open existing project
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="w-full h-12 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50"
                                  disabled={rowMenuBusy}
                                  onClick={async () => {
                                    const ok = window.confirm("Delete this Swipe File item? This cannot be undone.");
                                    if (!ok) return;
                                    await deleteItem(it.id);
                                    setMobileSheet(null);
                                  }}
                                >
                                  {rowMenuBusy ? "Deleting…" : "Delete"}
                                </button>
                                <button
                                  type="button"
                                  className="w-full h-12 rounded-xl bg-slate-100 text-slate-900 text-sm font-semibold hover:bg-slate-200"
                                  onClick={() => setMobileSheet(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                              <div className="pb-[env(safe-area-inset-bottom)]" />
                            </div>
                          </div>
                        ) : null}

                        {/* Repurpose sheet (mobile) */}
                        {isMobile && mobileSheet?.kind === "repurpose" && mobileSheet.itemId === it.id ? (
                          <div
                            className="fixed inset-0 z-[210] flex items-end justify-center bg-black/40"
                            onMouseDown={(e) => {
                              if (e.target === e.currentTarget) setMobileSheet(null);
                            }}
                          >
                            <div className="w-full max-w-[520px] rounded-t-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
                              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900">Repurpose</div>
                                  <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                                    {it.title ? it.title : it.note ? it.note : it.url}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50"
                                  onClick={() => setMobileSheet(null)}
                                >
                                  Close
                                </button>
                              </div>
                              <div className="p-4 space-y-3">
                                <div>
                                  <div className="text-xs font-semibold text-slate-700">Template type</div>
                                  <select
                                    className="mt-2 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                                    value={templateTypeId}
                                    onChange={(e) => {
                                      const next = e.target.value === "regular" ? "regular" : "enhanced";
                                      setTemplateTypeId(next);
                                    }}
                                    disabled={createBusy}
                                  >
                                    <option value="enhanced">Enhanced</option>
                                    <option value="regular">Regular</option>
                                  </select>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-slate-700">Saved prompt</div>
                                  <select
                                    className="mt-2 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-50"
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
                                  className="w-full h-11 rounded-lg bg-black text-white text-sm font-semibold shadow-md hover:bg-slate-900 disabled:opacity-50"
                                  disabled={createBusy || !savedPromptId}
                                  onClick={() => {
                                    setMobileSheet(null);
                                    setSelectedItemId(it.id);
                                    setIdeasPickerOpen(true);
                                  }}
                                >
                                  {createBusy ? "Creating..." : "Create project + rewrite"}
                                </button>
                                {createError ? <div className="text-xs text-red-600">❌ {createError}</div> : null}
                              </div>
                              <div className="pb-[env(safe-area-inset-bottom)]" />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>

          {rowMenu ? (
            <div
              className="fixed inset-0 z-[130]"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setRowMenu(null);
              }}
            >
              <div
                className="absolute w-44 rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden"
                style={{ left: Math.max(8, rowMenu.x), top: Math.max(8, rowMenu.y) }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                  disabled={rowMenuBusy}
                  onClick={async () => {
                    const ok = window.confirm("Delete this Swipe File item? This cannot be undone.");
                    if (!ok) return;
                    await deleteItem(rowMenu.itemId);
                  }}
                >
                  {rowMenuBusy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ) : null}

          {/* Right: detail (desktop only) */}
          <aside className="hidden md:block border-l border-slate-100 bg-white p-4 overflow-auto">
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
                    <div
                      className="mt-2 text-sm font-semibold text-slate-900 overflow-hidden break-words leading-snug"
                      style={{
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical" as any,
                        WebkitLineClamp: 3,
                      }}
                      title={selectedItem.title || selectedItem.note || "Swipe item"}
                    >
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
                          setNotice("Enriching (Apify)…");
                          setError(null);
                          setActionError(null);
                          await runEnrichOne(selectedItem.id);
                          const nextItems = await refresh({ setSpinner: false });
                          const after = Array.isArray(nextItems) ? nextItems.find((x) => x.id === selectedItem.id) : null;
                          if (String(after?.enrichStatus || "").toLowerCase() === "needs_transcript") {
                            setNotice("Transcript missing — transcribing (Whisper)…");
                            await runTranscribeOne(selectedItem.id);
                            await refresh({ setSpinner: false });
                          }
                        } catch (e: any) {
                          const msg = String(e?.message || e || "Enrich failed");
                          setActionError(msg);
                          setError(msg);
                        } finally {
                          setNotice(null);
                          setLoading(false);
                        }
                      }}
                      title={String(selectedItem.platform || "").toLowerCase() === "instagram" ? "Enrich (Apify)" : "Enrich (V2)"}
                    >
                      Enrich
                    </button>
                  </div>
                  {notice ? <div className="text-xs text-amber-700">{notice}</div> : null}
                  {actionError ? <div className="text-xs text-red-600">❌ {actionError}</div> : null}
                  {selectedItem.enrichError ? <div className="text-xs text-red-600">❌ {selectedItem.enrichError}</div> : null}
                  {String(selectedItem.enrichStatus || "").toLowerCase() === "needs_transcript" ? (
                    <div className="text-xs text-amber-700">
                      Transcript missing. If you click Enrich, it will auto-transcribe via Whisper.
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
                      const next = e.target.value;
                      setNoteDraft(next);
                      if (!selectedItem?.id) return;
                      scheduleDebouncedNoteSave({ itemId: selectedItem.id, note: next, debounceMs: 800 });
                    }}
                    onBlur={() => {
                      try {
                        if (!selectedItem?.id) return;
                        if (!noteDirty) return;
                        if (noteSaveTimeoutRef.current) window.clearTimeout(noteSaveTimeoutRef.current);
                        noteSaveTimeoutRef.current = null;
                        void saveNoteNow({ itemId: selectedItem.id, note: noteDraft });
                      } catch {
                        // ignore
                      }
                    }}
                    placeholder="Optional: what do you like about this? what angle to use?"
                  />
                  {noteSaveStatus === "saving" ? <div className="mt-2 text-[11px] text-slate-500">Saving…</div> : null}
                  {noteSaveStatus === "saved" ? <div className="mt-2 text-[11px] text-emerald-700">Saved</div> : null}
                  {noteSaveStatus === "error" ? <div className="mt-2 text-[11px] text-red-600">❌ {noteSaveError || "Save failed"}</div> : null}
                  {noteDirty && noteSaveStatus === "idle" ? <div className="mt-2 text-[11px] text-amber-700">Autosaving…</div> : null}
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-700">Repurpose</div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Template type</div>
                      <select
                        className="mt-2 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                        value={templateTypeId}
                        onChange={(e) => {
                          const next = e.target.value === "regular" ? "regular" : "enhanced";
                          setTemplateTypeId(next);
                        }}
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
                      onClick={() => setIdeasPickerOpen(true)}
                      title="Create project and auto-generate copy (when transcript exists)"
                    >
                      {createBusy ? "Creating..." : "Create project + rewrite"}
                    </button>
                    {createError ? <div className="text-xs text-red-600">❌ {createError}</div> : null}

                    <button
                      type="button"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                      disabled={!selectedItem || !String(selectedItem.transcript || "").trim()}
                      onClick={() => setIdeasChatOpen(true)}
                      title={
                        !String(selectedItem?.transcript || "").trim()
                          ? "Enrich first to get a transcript"
                          : "Chat with this Swipe item and generate carousel-ready ideas"
                      }
                    >
                      Generate ideas{ideasCount > 0 ? ` (${ideasCount})` : ""}
                    </button>
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

      <SwipeIdeasChatModal
        open={ideasChatOpen}
        onClose={() => setIdeasChatOpen(false)}
        swipeItemId={selectedItem?.id || null}
        swipeItemLabel={selectedItem?.title || selectedItem?.url || "Swipe item"}
        onIdeaSaved={() => {
          if (selectedItem?.id) void refreshIdeasCount(selectedItem.id);
        }}
      />

      <SwipeIdeasPickerModal
        open={ideasPickerOpen}
        onClose={() => setIdeasPickerOpen(false)}
        swipeItemId={selectedItem?.id || null}
        swipeItemLabel={selectedItem?.title || selectedItem?.url || "Swipe item"}
        templateTypeId={templateTypeIdRef.current}
        savedPromptId={savedPromptId}
        angleNotesSnapshot={noteDraft}
        onPick={(args) => {
          setIdeasPickerOpen(false);
          void onCreateProject({ ideaId: args.ideaId });
        }}
      />

      {/* Mobile overflow sheet */}
      {isMobile && mobileSheet?.kind === "overflow" ? (
        <div
          className="fixed inset-0 z-[190] flex items-end justify-center bg-black/40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileSheet(null);
          }}
        >
          <div className="w-full max-w-[520px] rounded-t-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="text-xs font-semibold text-slate-700">Swipe File</div>
            </div>
            <div className="p-2 space-y-2">
              <button
                type="button"
                className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold hover:bg-slate-50"
                onClick={async () => {
                  await copyText(captureLinkNoLogin || captureLink);
                  setMobileSheet(null);
                }}
              >
                Copy capture link
              </button>
              <button
                type="button"
                className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                disabled={loading}
                onClick={() => {
                  setMobileSheet(null);
                  void refresh();
                }}
              >
                Refresh
              </button>
              <button
                type="button"
                className="w-full h-12 rounded-xl bg-slate-100 text-slate-900 text-sm font-semibold hover:bg-slate-200"
                onClick={() => setMobileSheet(null)}
              >
                Cancel
              </button>
            </div>
            <div className="pb-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

