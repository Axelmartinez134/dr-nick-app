"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";
import { useEditorSelector } from "@/features/editor/store";

type ChatMsg = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
type IdeaCard = { title: string; slides: string[]; angleText: string; sourceMessageId?: string | null };
type SavedIdea = {
  id: string;
  createdAt: string;
  title: string;
  slides: string[];
  angleText: string;
  sourceMessageId: string | null;
};
type DraftIdea = {
  id: string;
  createdAt: string;
  title: string;
  slides: string[];
  angleText: string;
  sourceMessageId: string;
};

type SwipeContext = {
  title: string;
  authorHandle: string;
  categoryName: string;
  caption: string;
  transcript: string;
  note: string;
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

const DEFAULT_MASTER_PROMPT_UI = `You are an idea-generation assistant for 6-slide Instagram carousel posts.

Your job:
- Help me refine someone else’s inspiration into an original, brand-aligned idea.
- Propose multiple concrete carousel ideas that can fit into exactly 6 slides.
- Keep ideas relevant to my audience and brand voice.

Output format (HARD):
Return ONLY valid JSON (no markdown) in this exact shape:
{
  "assistantMessage": "string",
  "cards": [
    {
      "title": "string",
      "slides": ["slide 1", "slide 2", "slide 3", "slide 4", "slide 5", "slide 6"],
      "angleText": "string"
    }
  ]
}`;

export function SwipeIdeasChatModal(props: {
  open: boolean;
  onClose: () => void;
  swipeItemId: string | null;
  swipeItemLabel: string;
  onIdeaSaved?: () => void;
}) {
  const { open, onClose, swipeItemId, swipeItemLabel, onIdeaSaved } = props;
  const isMobile = useEditorSelector((s: any) => !!(s as any).isMobile);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [cards, setCards] = useState<IdeaCard[]>([]);
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([]);
  const [savedIdeasLoading, setSavedIdeasLoading] = useState(false);
  const [savedIdeasError, setSavedIdeasError] = useState<string | null>(null);

  const [draftIdeas, setDraftIdeas] = useState<DraftIdea[]>([]);
  const [draftIdeasLoading, setDraftIdeasLoading] = useState(false);
  const [draftIdeasError, setDraftIdeasError] = useState<string | null>(null);

  const [swipeContext, setSwipeContext] = useState<SwipeContext | null>(null);
  const [swipeContextLoading, setSwipeContextLoading] = useState(false);
  const [swipeContextError, setSwipeContextError] = useState<string | null>(null);

  const [angleNotesDraft, setAngleNotesDraft] = useState<string>("");
  const [angleNotesSaveStatus, setAngleNotesSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [angleNotesSaveError, setAngleNotesSaveError] = useState<string | null>(null);
  const angleNotesSaveTimeoutRef = useRef<number | null>(null);

  const [draft, setDraft] = useState("");
  const [sendBusy, setSendBusy] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [masterPrompt, setMasterPrompt] = useState<string>("");
  const [masterSaveStatus, setMasterSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [masterSaveError, setMasterSaveError] = useState<string | null>(null);
  const masterSaveTimeoutRef = useRef<number | null>(null);

  const [saveIdeaBusyKey, setSaveIdeaBusyKey] = useState<string | null>(null);
  const [saveIdeaError, setSaveIdeaError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [batchesOpenBySourceMessageId, setBatchesOpenBySourceMessageId] = useState<Record<string, boolean>>({});

  const [openPanel, setOpenPanel] = useState<null | "source" | "ideas">(null);
  const [sourceTab, setSourceTab] = useState<"transcript" | "caption" | "notes">("transcript");
  const gestureRef = useRef<{
    mode: null | "open-source" | "open-ideas";
    startX: number;
    startY: number;
    fired: boolean;
  }>({ mode: null, startX: 0, startY: 0, fired: false });

  const canSend = useMemo(() => {
    return !!open && !!String(swipeItemId || "").trim() && !!String(draft || "").trim() && !sendBusy;
  }, [open, swipeItemId, draft, sendBusy]);

  const cardKey = (c: { title: string; angleText: string; slides: string[] }) => {
    const title = String(c.title || "").trim();
    const angleText = String(c.angleText || "").trim();
    const slides = Array.isArray(c.slides) ? c.slides.map((s) => String(s ?? "").trim()) : [];
    return `${title}||${angleText}||${slides.join("␟")}`;
  };

  const savedCardKeySet = useMemo(() => {
    return new Set((savedIdeas || []).map((s) => cardKey({ title: s.title, angleText: s.angleText, slides: s.slides })));
  }, [savedIdeas]);

  const attemptGroups = useMemo(() => {
    const groups = new Map<string, DraftIdea[]>();
    for (const d of draftIdeas || []) {
      const k = String(d.sourceMessageId || "unknown");
      groups.set(k, [...(groups.get(k) || []), d]);
    }
    const entries = Array.from(groups.entries()).map(([sourceMessageId, items]) => {
      // Sort items in the batch for stable display.
      const sortedItems = [...items].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const assistantMsg = (messages || []).find((m) => m.role === "assistant" && String(m.id) === String(sourceMessageId));
      const sortKey = assistantMsg?.createdAt ? String(assistantMsg.createdAt) : String(sortedItems[0]?.createdAt || "");
      return { sourceMessageId, items: sortedItems, sortKey };
    });
    // Oldest first.
    entries.sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
    return entries;
  }, [draftIdeas, messages]);

  useEffect(() => {
    if (!open) return;
    setNotice(null);
    setSaveIdeaError(null);
    setCards([]);
    setDraftIdeas([]);
    setDraftIdeasError(null);
    setSwipeContext(null);
    setSwipeContextError(null);
    setAngleNotesDraft("");
    setAngleNotesSaveStatus("idle");
    setAngleNotesSaveError(null);
    setDraft("");
    setBatchesOpenBySourceMessageId({});
    setOpenPanel(null);
    setSourceTab("transcript");
  }, [open]);

  const refreshSavedIdeas = async (itemId: string) => {
    const id = String(itemId || "").trim();
    if (!id) return;
    setSavedIdeasLoading(true);
    setSavedIdeasError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(id)}/ideas`, { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load saved ideas (${res.status})`));
      const rows: SavedIdea[] = Array.isArray(j.ideas)
        ? (j.ideas as any[]).map((r) => ({
            id: String(r?.id || ""),
            createdAt: String(r?.createdAt || ""),
            title: String(r?.title || ""),
            slides: Array.isArray(r?.slideOutline) ? r.slideOutline.map((x: any) => String(x ?? "")) : [],
            angleText: String(r?.angleText || ""),
            sourceMessageId: r?.sourceMessageId ? String(r.sourceMessageId) : null,
          }))
        : [];
      setSavedIdeas(rows);
    } catch (e: any) {
      setSavedIdeasError(String(e?.message || e || "Failed to load saved ideas"));
      setSavedIdeas([]);
    } finally {
      setSavedIdeasLoading(false);
    }
  };

  const refreshDraftIdeas = async (itemId: string) => {
    const id = String(itemId || "").trim();
    if (!id) return;
    setDraftIdeasLoading(true);
    setDraftIdeasError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(id)}/ideas/drafts`, { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load draft ideas (${res.status})`));
      const rows: DraftIdea[] = Array.isArray(j.drafts)
        ? (j.drafts as any[]).map((r) => ({
            id: String(r?.id || ""),
            createdAt: String(r?.createdAt || ""),
            title: String(r?.title || ""),
            slides: Array.isArray(r?.slideOutline) ? r.slideOutline.map((x: any) => String(x ?? "")) : [],
            angleText: String(r?.angleText || ""),
            sourceMessageId: String(r?.sourceMessageId || ""),
          }))
        : [];
      setDraftIdeas(rows);
    } catch (e: any) {
      setDraftIdeasError(String(e?.message || e || "Failed to load draft ideas"));
      setDraftIdeas([]);
    } finally {
      setDraftIdeasLoading(false);
    }
  };

  const refreshSwipeContext = async (itemId: string) => {
    const id = String(itemId || "").trim();
    if (!id) return;
    setSwipeContextLoading(true);
    setSwipeContextError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(id)}/ideas/context`, { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load context (${res.status})`));
      const ctx: SwipeContext = {
        title: String(j?.context?.title || ""),
        authorHandle: String(j?.context?.authorHandle || ""),
        categoryName: String(j?.context?.categoryName || ""),
        caption: String(j?.context?.caption || ""),
        transcript: String(j?.context?.transcript || ""),
        note: String(j?.context?.note || ""),
      };
      setSwipeContext(ctx);
      setAngleNotesDraft(String(ctx.note || ""));
    } catch (e: any) {
      setSwipeContextError(String(e?.message || e || "Failed to load context"));
      setSwipeContext(null);
      setAngleNotesDraft("");
    } finally {
      setSwipeContextLoading(false);
    }
  };

  // Load master prompt + thread/messages when opening.
  useEffect(() => {
    if (!open) return;
    const itemId = String(swipeItemId || "").trim();
    if (!itemId) return;

    let cancelled = false;
    void (async () => {
      setStatus("loading");
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing auth token");
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };

        const [promptRes, threadRes, ctxRes] = await Promise.all([
          fetch("/api/editor/user-settings/swipe-ideas-master-prompt", { method: "GET", headers }),
          fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/ideas/thread`, { method: "GET", headers }),
          fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/ideas/context`, { method: "GET", headers }),
        ]);

        const promptJson = await promptRes.json().catch(() => null);
        const threadJson = await threadRes.json().catch(() => null);
        const ctxJson = await ctxRes.json().catch(() => null);
        if (cancelled) return;

        if (!promptRes.ok || !promptJson?.success) {
          throw new Error(String(promptJson?.error || `Failed to load master prompt (${promptRes.status})`));
        }
        if (!threadRes.ok || !threadJson?.success) {
          throw new Error(String(threadJson?.error || `Failed to load thread (${threadRes.status})`));
        }
        if (!ctxRes.ok || !ctxJson?.success) {
          throw new Error(String(ctxJson?.error || `Failed to load context (${ctxRes.status})`));
        }

        const mp = String(promptJson?.swipeIdeasMasterPromptOverride ?? "").trim();
        setMasterPrompt(mp || DEFAULT_MASTER_PROMPT_UI);
        setThreadId(String(threadJson?.threadId || "").trim() || null);
        const msgs: ChatMsg[] = Array.isArray(threadJson?.messages) ? (threadJson.messages as any[]) : [];
        setMessages(
          msgs.map((m) => ({
            id: String(m.id),
            role: String(m.role) === "assistant" ? "assistant" : "user",
            content: String(m.content || ""),
            createdAt: String(m.createdAt || ""),
          }))
        );
        setStatus("ready");

        const ctx: SwipeContext = {
          title: String(ctxJson?.context?.title || ""),
          authorHandle: String(ctxJson?.context?.authorHandle || ""),
          categoryName: String(ctxJson?.context?.categoryName || ""),
          caption: String(ctxJson?.context?.caption || ""),
          transcript: String(ctxJson?.context?.transcript || ""),
          note: String(ctxJson?.context?.note || ""),
        };
        setSwipeContext(ctx);
        setAngleNotesDraft(String(ctx.note || ""));

        // Load saved ideas (persisted) so reopening shows what "Generate ideas (N)" refers to.
        void refreshSavedIdeas(itemId);
        void refreshDraftIdeas(itemId);
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          setError(String(e?.message || e || "Failed to load ideas chat"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, swipeItemId]);

  // Debounced autosave Angle/Notes for this swipe item.
  useEffect(() => {
    if (!open) return;
    if (status !== "ready") return;
    const itemId = String(swipeItemId || "").trim();
    if (!itemId) return;
    if (!swipeContext) return;

    if (angleNotesSaveTimeoutRef.current) window.clearTimeout(angleNotesSaveTimeoutRef.current);

    angleNotesSaveTimeoutRef.current = window.setTimeout(() => {
      angleNotesSaveTimeoutRef.current = null;
      void (async () => {
        const nextNote = String(angleNotesDraft || "").trim();
        const serverNote = String(swipeContext.note || "").trim();
        if (nextNote === serverNote) return;

        setAngleNotesSaveStatus("saving");
        setAngleNotesSaveError(null);
        try {
          const token = await getToken();
          if (!token) throw new Error("Missing auth token");
          const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
          const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ note: nextNote ? nextNote : null }),
          });
          const j = await res.json().catch(() => null);
          if (!res.ok || !j?.success) throw new Error(String(j?.error || `Save failed (${res.status})`));
          setSwipeContext((prev) => (prev ? { ...prev, note: nextNote } : prev));
          setAngleNotesSaveStatus("saved");
          window.setTimeout(() => setAngleNotesSaveStatus("idle"), 800);
        } catch (e: any) {
          setAngleNotesSaveStatus("error");
          setAngleNotesSaveError(String(e?.message || e || "Save failed"));
        }
      })();
    }, 650);

    return () => {
      if (angleNotesSaveTimeoutRef.current) window.clearTimeout(angleNotesSaveTimeoutRef.current);
      angleNotesSaveTimeoutRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angleNotesDraft, open, status, swipeItemId, swipeContext?.note]);

  // Debounced autosave master prompt.
  useEffect(() => {
    if (!open) return;
    if (status !== "ready") return;
    if (masterSaveTimeoutRef.current) window.clearTimeout(masterSaveTimeoutRef.current);

    masterSaveTimeoutRef.current = window.setTimeout(() => {
      masterSaveTimeoutRef.current = null;
      void (async () => {
        setMasterSaveStatus("saving");
        setMasterSaveError(null);
        try {
          const token = await getToken();
          if (!token) throw new Error("Missing auth token");
          const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
          const res = await fetch("/api/editor/user-settings/swipe-ideas-master-prompt", {
            method: "POST",
            headers,
            body: JSON.stringify({ swipeIdeasMasterPromptOverride: String(masterPrompt || "").trim() || null }),
          });
          const j = await res.json().catch(() => null);
          if (!res.ok || !j?.success) throw new Error(String(j?.error || `Save failed (${res.status})`));
          setMasterSaveStatus("saved");
          window.setTimeout(() => setMasterSaveStatus("idle"), 800);
        } catch (e: any) {
          setMasterSaveStatus("error");
          setMasterSaveError(String(e?.message || e || "Save failed"));
        }
      })();
    }, 650);

    return () => {
      if (masterSaveTimeoutRef.current) window.clearTimeout(masterSaveTimeoutRef.current);
      masterSaveTimeoutRef.current = null;
    };
  }, [masterPrompt, open, status]);

  const sendMessage = async () => {
    const itemId = String(swipeItemId || "").trim();
    const text = String(draft || "").trim();
    if (!itemId || !text) return;

    setSendBusy(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };

      const optimisticId = `local-${Date.now()}`;
      setMessages((prev) => [...prev, { id: optimisticId, role: "user", content: text, createdAt: new Date().toISOString() }]);
      setDraft("");

      const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/ideas/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: text }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Send failed (${res.status})`));

      const assistantMessage = String(j?.assistantMessage || "").trim();
      const srcMsgId = String(j?.sourceMessageId || "").trim();
      const cardsIn: IdeaCard[] = Array.isArray(j?.cards)
        ? (j.cards as any[]).map((c) => ({
            title: String(c?.title || ""),
            slides: Array.isArray(c?.slides) ? c.slides.map((s: any) => String(s ?? "")) : [],
            angleText: String(c?.angleText || ""),
            sourceMessageId: srcMsgId || null,
          }))
        : [];

      setThreadId(String(j?.threadId || "").trim() || null);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        { id: optimisticId, role: "user", content: text, createdAt: new Date().toISOString() },
        { id: srcMsgId || `assistant-${Date.now()}`, role: "assistant", content: assistantMessage || "…", createdAt: new Date().toISOString() },
      ]);
      setCards(cardsIn);
      if (srcMsgId && cardsIn.length > 0) {
        const nowIso = new Date().toISOString();
        const optimisticDrafts: DraftIdea[] = cardsIn.map((c, idx) => ({
          id: `local-${srcMsgId}-${idx}`,
          createdAt: nowIso,
          title: String(c.title || ""),
          slides: Array.isArray(c.slides) ? c.slides : [],
          angleText: String(c.angleText || ""),
          sourceMessageId: srcMsgId,
        }));
        setDraftIdeas((prev) => [...(prev || []), ...optimisticDrafts]);
        setBatchesOpenBySourceMessageId((prev) => ({ ...(prev || {}), [srcMsgId]: true }));
      }
      void refreshDraftIdeas(itemId);
      void refreshSavedIdeas(itemId);
    } catch (e: any) {
      const msg = String(e?.message || e || "Send failed");
      setError(msg);
      setNotice(null);
    } finally {
      setSendBusy(false);
    }
  };

  const saveIdea = async (card: IdeaCard, key: string, sourceMessageId?: string | null) => {
    const itemId = String(swipeItemId || "").trim();
    const tid = String(threadId || "").trim();
    if (!itemId) return;

    setSaveIdeaBusyKey(key);
    setSaveIdeaError(null);
    setNotice(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };

      const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/ideas`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: String(card.title || "").trim(),
          angleText: String(card.angleText || "").trim(),
          slideOutline: Array.isArray(card.slides) ? card.slides : [],
          threadId: tid || null,
          sourceMessageId: sourceMessageId ? String(sourceMessageId || "").trim() : null,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Save failed (${res.status})`));
      setNotice("Idea saved.");
      onIdeaSaved?.();
      void refreshSavedIdeas(itemId);
    } catch (e: any) {
      setSaveIdeaError(String(e?.message || e || "Save idea failed"));
    } finally {
      setSaveIdeaBusyKey(null);
    }
  };

  if (!open) return null;

  const closePanels = () => setOpenPanel(null);
  const openSource = () => {
    setOpenPanel("source");
  };
  const openIdeas = () => {
    setOpenPanel("ideas");
  };

  const isEditableTarget = (target: any) => {
    try {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = String(el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return true;
      if ((el as any).isContentEditable) return true;
      if (el.closest?.('[data-no-gesture="1"]')) return true;
      return false;
    } catch {
      return false;
    }
  };

  const renderContextInner = () => {
    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-700">Context</div>
          <button
            type="button"
            className="h-7 px-2 rounded-md border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold shadow-sm hover:bg-slate-50"
            onClick={() => {
              const id = String(swipeItemId || "").trim();
              if (id) void refreshSwipeContext(id);
            }}
            title="Refresh context"
          >
            Refresh
          </button>
        </div>

        {swipeContextError ? <div className="mt-2 text-xs text-red-600">❌ {swipeContextError}</div> : null}
        {swipeContextLoading ? <div className="mt-3 text-sm text-slate-600">Loading context…</div> : null}

        {swipeContext ? (
          <div className="mt-3 space-y-4">
            <div>
              <div className="text-xs font-semibold text-slate-700">Title</div>
              <div className="mt-1 text-sm text-slate-900 whitespace-pre-wrap break-words">{swipeContext.title || "—"}</div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-700">Author</div>
                <div className="mt-1 text-sm text-slate-900 break-words">{swipeContext.authorHandle || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700">Category</div>
                <div className="mt-1 text-sm text-slate-900 break-words">{swipeContext.categoryName || "—"}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700">Angle / Notes</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">Auto-saves as you type.</div>
                {angleNotesSaveStatus === "saving" ? (
                  <span className="text-[11px] text-slate-500">Saving…</span>
                ) : angleNotesSaveStatus === "saved" ? (
                  <span className="text-[11px] text-emerald-700">Saved ✓</span>
                ) : angleNotesSaveStatus === "error" ? (
                  <span className="text-[11px] text-red-600">Save failed</span>
                ) : null}
              </div>
              <textarea
                data-no-gesture="1"
                className="mt-2 w-full min-h-[84px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                value={angleNotesDraft}
                onChange={(e) => setAngleNotesDraft(e.target.value)}
                placeholder="Optional notes about the angle you want…"
              />
              {angleNotesSaveStatus === "error" && angleNotesSaveError ? (
                <div className="mt-2 text-xs text-red-600">❌ {angleNotesSaveError}</div>
              ) : null}
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700">Caption</div>
              <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 whitespace-pre-wrap break-words">
                {swipeContext.caption ? swipeContext.caption : <span className="text-slate-400">—</span>}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700">Transcript</div>
              <div className="mt-2 max-h-[360px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 whitespace-pre-wrap break-words">
                {swipeContext.transcript ? swipeContext.transcript : <span className="text-slate-400">—</span>}
              </div>
            </div>
          </div>
        ) : status === "ready" ? (
          <div className="mt-3 text-sm text-slate-600">No context loaded.</div>
        ) : null}
      </>
    );
  };

  const renderIdeasInner = () => {
    return (
      <>
        <div className="text-xs font-semibold text-slate-700">Saved ideas (persisted)</div>
        <div className="mt-2 text-[11px] text-slate-500">These are the ideas you saved and can reuse later.</div>
        {savedIdeasError ? <div className="mt-2 text-xs text-red-600">❌ {savedIdeasError}</div> : null}

        {savedIdeasLoading ? (
          <div className="mt-3 text-sm text-slate-600">Loading saved ideas…</div>
        ) : savedIdeas.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No saved ideas yet. Use the section below to save one.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {savedIdeas.map((it) => (
              <div key={it.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate" title={it.title}>
                      {it.title || "Idea"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{it.createdAt ? new Date(it.createdAt).toLocaleString() : ""}</div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(String(it.angleText || "").trim());
                        setNotice("Copied idea angle.");
                      } catch {
                        // ignore
                      }
                    }}
                    title="Copy angle text"
                  >
                    Copy
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {(Array.isArray(it.slides) ? it.slides : []).slice(0, 2).map((s, i) => (
                    <div key={i} className="text-xs text-slate-700 truncate" title={String(s || "")}>
                      <span className="font-semibold text-slate-600">S{i + 1}:</span> {String(s || "").trim() || "—"}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-700">Batches</div>
              <div className="mt-2 text-[11px] text-slate-500">
                Each time you chat, new ideas are grouped into an attempt. Expand/collapse as needed.
              </div>
            </div>
            <button
              type="button"
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50"
              onClick={() => void refreshDraftIdeas(String(swipeItemId || ""))}
              title="Refresh batches"
            >
              Refresh
            </button>
          </div>

          {draftIdeasError ? <div className="mt-2 text-xs text-red-600">❌ {draftIdeasError}</div> : null}
          {saveIdeaError ? <div className="mt-2 text-xs text-red-600">❌ {saveIdeaError}</div> : null}

          {draftIdeasLoading ? (
            <div className="mt-3 text-sm text-slate-600">Loading batches…</div>
          ) : attemptGroups.length === 0 ? (
            <div className="mt-3 text-sm text-slate-600">No ideas yet. Send a message to generate ideas.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {attemptGroups.map((g, idx) => {
                const attemptNumber = idx + 1;
                const openNow = batchesOpenBySourceMessageId[String(g.sourceMessageId)] !== false;
                return (
                  <div key={g.sourceMessageId} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50"
                      onClick={() =>
                        setBatchesOpenBySourceMessageId((prev) => ({
                          ...(prev || {}),
                          [String(g.sourceMessageId)]: !openNow,
                        }))
                      }
                      title={openNow ? "Collapse" : "Expand"}
                    >
                      <div className="text-xs font-semibold text-slate-700">Attempt {attemptNumber}</div>
                      <div className="text-[11px] text-slate-500">
                        {g.items.length} idea{g.items.length === 1 ? "" : "s"} {openNow ? "▾" : "▸"}
                      </div>
                    </button>

                    {openNow ? (
                      <div className="border-t border-slate-100 p-3 space-y-3">
                        {g.items.map((it) => {
                          const key = `batch-${it.id}`;
                          const busy = saveIdeaBusyKey === key;
                          const isSaved = savedCardKeySet.has(cardKey({ title: it.title, angleText: it.angleText, slides: it.slides }));
                          return (
                            <div key={it.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900">{it.title || "Idea"}</div>
                                </div>
                                {isSaved ? <span className="shrink-0 text-[11px] font-semibold text-emerald-700">Saved ✓</span> : null}
                              </div>
                              <div className="mt-2 space-y-1">
                                {(Array.isArray(it.slides) ? it.slides : []).slice(0, 6).map((s, i) => (
                                  <div key={i} className="text-xs text-slate-700">
                                    <span className="font-semibold text-slate-600">S{i + 1}:</span> {String(s || "").trim() || "—"}
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="mt-3 w-full h-9 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                                disabled={busy || isSaved}
                                onClick={() => void saveIdea({ title: it.title, slides: it.slides, angleText: it.angleText }, key, it.sourceMessageId)}
                              >
                                {isSaved ? "Saved" : busy ? "Saving…" : "Select (save idea)"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  };

  const renderSourceDrawer = () => {
    if (!isMobile || openPanel !== "source") return null;
    return (
      <div
        className="fixed inset-0 z-[160] bg-black/40"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closePanels();
        }}
      >
        <aside
          className="absolute left-0 top-0 h-full bg-white border-r border-slate-200 shadow-2xl overflow-hidden flex flex-col"
          style={{ width: "min(88vw, 360px)" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Source</div>
            <button
              type="button"
              className="h-10 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50"
              onClick={closePanels}
            >
              Close
            </button>
          </div>
          <div className="px-2 pt-2 border-b border-slate-100">
            <div className="flex items-center gap-1">
              {([
                { id: "transcript", label: "Transcript" },
                { id: "caption", label: "Caption" },
                { id: "notes", label: "Notes" },
              ] as const).map((t) => {
                const active = sourceTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={[
                      "h-10 px-3 rounded-lg text-sm font-semibold",
                      active ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                    onClick={() => setSourceTab(t.id)}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {sourceTab === "notes" ? (
              <>
                <div className="text-xs font-semibold text-slate-700">Angle / Notes</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500">Auto-saves as you type.</div>
                  {angleNotesSaveStatus === "saving" ? (
                    <span className="text-[11px] text-slate-500">Saving…</span>
                  ) : angleNotesSaveStatus === "saved" ? (
                    <span className="text-[11px] text-emerald-700">Saved ✓</span>
                  ) : angleNotesSaveStatus === "error" ? (
                    <span className="text-[11px] text-red-600">Save failed</span>
                  ) : null}
                </div>
                <textarea
                  data-no-gesture="1"
                  className="mt-2 w-full min-h-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                  value={angleNotesDraft}
                  onChange={(e) => setAngleNotesDraft(e.target.value)}
                  placeholder="Optional notes about the angle you want…"
                />
                {angleNotesSaveStatus === "error" && angleNotesSaveError ? (
                  <div className="mt-2 text-xs text-red-600">❌ {angleNotesSaveError}</div>
                ) : null}
              </>
            ) : sourceTab === "caption" ? (
              <>
                <div className="text-xs font-semibold text-slate-700">Caption</div>
                <div className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-800 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  {swipeContext?.caption ? swipeContext.caption : "—"}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs font-semibold text-slate-700">Transcript</div>
                <div className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-800 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  {swipeContext?.transcript ? swipeContext.transcript : "—"}
                </div>
              </>
            )}
          </div>
          <div className="pb-[env(safe-area-inset-bottom)]" />
        </aside>
      </div>
    );
  };

  const renderIdeasDrawer = () => {
    if (!isMobile || openPanel !== "ideas") return null;
    return (
      <div
        className="fixed inset-0 z-[160] bg-black/40"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closePanels();
        }}
      >
        <aside
          className="absolute right-0 top-0 h-full bg-white border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col"
          style={{ width: "min(88vw, 360px)" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Ideas</div>
            <button
              type="button"
              className="h-10 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50"
              onClick={closePanels}
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
            {renderIdeasInner()}
          </div>
          <div className="pb-[env(safe-area-inset-bottom)]" />
        </aside>
      </div>
    );
  };

  const disabledComposer = isMobile && openPanel === "ideas";
  const canSendEffective = canSend && !disabledComposer;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-stretch justify-center bg-black/50 p-2 md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => {
        if (!isMobile) return;
        if ((e as any).pointerType && (e as any).pointerType !== "touch") return;
        if (openPanel) return;
        if (isEditableTarget((e as any).target)) return;
        const x = (e as any).clientX ?? 0;
        const y = (e as any).clientY ?? 0;
        const w = typeof window !== "undefined" ? window.innerWidth : 0;
        if (x <= 20) {
          gestureRef.current = { mode: "open-source", startX: x, startY: y, fired: false };
        } else if (w > 0 && x >= w - 20) {
          gestureRef.current = { mode: "open-ideas", startX: x, startY: y, fired: false };
        } else {
          gestureRef.current = { mode: null, startX: x, startY: y, fired: false };
        }
      }}
      onPointerMove={(e) => {
        if (!isMobile) return;
        const g = gestureRef.current;
        if (!g.mode) return;
        const x = (e as any).clientX ?? 0;
        const y = (e as any).clientY ?? 0;
        const dx = x - g.startX;
        const dy = y - g.startY;
        if (Math.abs(dy) > Math.abs(dx)) return;
        if (g.fired) return;
        if (g.mode === "open-source" && dx > 60) {
          g.fired = true;
          setOpenPanel("source");
          setSourceTab((prev) => prev || "transcript");
        }
        if (g.mode === "open-ideas" && dx < -60) {
          g.fired = true;
          setOpenPanel("ideas");
        }
      }}
      onPointerUp={() => {
        if (!isMobile) return;
        gestureRef.current.mode = null;
        gestureRef.current.fired = false;
      }}
      onPointerCancel={() => {
        if (!isMobile) return;
        gestureRef.current.mode = null;
        gestureRef.current.fired = false;
      }}
    >
      <div className="w-full max-w-7xl h-full bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900 truncate">Generate ideas</div>
            <div className="mt-0.5 text-xs text-slate-500 truncate" title={swipeItemLabel}>
              {swipeItemLabel || "Swipe item"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMobile ? (
              <>
                <button
                  type="button"
                  className="h-10 w-10 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setOpenPanel((prev) => (prev === "source" ? null : "source"));
                    setSourceTab((prev) => prev || "transcript");
                  }}
                  aria-label="Source"
                  title="Source"
                >
                  ☰
                </button>
                <button
                  type="button"
                  className="h-10 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50"
                  onClick={() => setOpenPanel((prev) => (prev === "ideas" ? null : "ideas"))}
                  aria-label="Ideas"
                  title="Ideas"
                >
                  Ideas
                </button>
              </>
            ) : (
              <button
                type="button"
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm hover:bg-slate-50"
                onClick={() => setSettingsOpen((v) => !v)}
                title="Master prompt settings"
              >
                Settings
              </button>
            )}
            <button
              type="button"
              className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {settingsOpen ? (
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-700">Master prompt (account-wide)</div>
              {masterSaveStatus === "saving" ? (
                <span className="text-xs text-slate-500">Saving…</span>
              ) : masterSaveStatus === "saved" ? (
                <span className="text-xs text-emerald-700">Saved ✓</span>
              ) : masterSaveStatus === "error" ? (
                <span className="text-xs text-red-600">Save failed</span>
              ) : null}
            </div>
            <textarea
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              rows={8}
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              placeholder={DEFAULT_MASTER_PROMPT_UI}
            />
            {masterSaveStatus === "error" && masterSaveError ? (
              <div className="mt-2 text-xs text-red-600">❌ {masterSaveError}</div>
            ) : null}
            <div className="mt-2 text-[11px] text-slate-500">Auto-saves as you type.</div>
          </div>
        ) : null}

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr_360px]">
          {/* Left: context (desktop only) */}
          {!isMobile ? (
            <aside className="border-b md:border-b-0 md:border-r border-slate-100 bg-white p-4 overflow-auto">
              {renderContextInner()}
            </aside>
          ) : null}

          <main className="min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto p-5 space-y-3">
              {status === "loading" ? <div className="text-sm text-slate-600">Loading…</div> : null}
              {status === "error" ? <div className="text-sm text-red-600">❌ {error || "Failed to load"}</div> : null}
              {status === "ready" && messages.length === 0 ? (
                <div className="text-sm text-slate-600">
                  Ask for carousel angles, hooks, or how to adapt the idea to your audience.
                </div>
              ) : null}

              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={[
                      "max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                      m.role === "user" ? "bg-black text-white" : "bg-slate-100 text-slate-900",
                    ].join(" ")}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 p-4">
              {notice ? <div className="mb-2 text-xs text-emerald-700">{notice}</div> : null}
              {error ? <div className="mb-2 text-xs text-red-600">❌ {error}</div> : null}
              <div className="flex items-end gap-2">
                <textarea
                  data-no-gesture="1"
                  className="flex-1 min-h-[44px] max-h-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                  placeholder="Message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (canSendEffective) void sendMessage();
                    }
                  }}
                  disabled={disabledComposer}
                />
                <button
                  type="button"
                  className="h-11 px-4 rounded-lg bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                  disabled={!canSendEffective}
                  onClick={() => void sendMessage()}
                  title="Send (⌘+Enter)"
                >
                  {sendBusy ? "Sending…" : "Send"}
                </button>
              </div>
              {disabledComposer ? (
                <div className="mt-2 text-[11px] text-slate-500">Close Ideas to type.</div>
              ) : (
                <div className="mt-2 text-[11px] text-slate-500">Tip: press ⌘+Enter to send.</div>
              )}
            </div>
          </main>

          {/* Right: ideas (desktop only) */}
          {!isMobile ? (
            <aside className="border-t md:border-t-0 md:border-l border-slate-100 bg-slate-50/50 p-4 overflow-auto">
              {renderIdeasInner()}
            </aside>
          ) : null}
        </div>
      </div>

      {renderSourceDrawer()}
      {renderIdeasDrawer()}
    </div>
  );
}

