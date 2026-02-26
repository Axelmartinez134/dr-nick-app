"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";

type ChatMsg = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
type IdeaCard = { title: string; slides: string[]; angleText: string };

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

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [cards, setCards] = useState<IdeaCard[]>([]);

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

  const canSend = useMemo(() => {
    return !!open && !!String(swipeItemId || "").trim() && !!String(draft || "").trim() && !sendBusy;
  }, [open, swipeItemId, draft, sendBusy]);

  useEffect(() => {
    if (!open) return;
    setNotice(null);
    setSaveIdeaError(null);
    setCards([]);
    setDraft("");
  }, [open]);

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

        const [promptRes, threadRes] = await Promise.all([
          fetch("/api/editor/user-settings/swipe-ideas-master-prompt", { method: "GET", headers }),
          fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/ideas/thread`, { method: "GET", headers }),
        ]);

        const promptJson = await promptRes.json().catch(() => null);
        const threadJson = await threadRes.json().catch(() => null);
        if (cancelled) return;

        if (!promptRes.ok || !promptJson?.success) {
          throw new Error(String(promptJson?.error || `Failed to load master prompt (${promptRes.status})`));
        }
        if (!threadRes.ok || !threadJson?.success) {
          throw new Error(String(threadJson?.error || `Failed to load thread (${threadRes.status})`));
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
          }))
        : [];

      setThreadId(String(j?.threadId || "").trim() || null);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        { id: optimisticId, role: "user", content: text, createdAt: new Date().toISOString() },
        { id: srcMsgId || `assistant-${Date.now()}`, role: "assistant", content: assistantMessage || "…", createdAt: new Date().toISOString() },
      ]);
      setCards(cardsIn);
    } catch (e: any) {
      const msg = String(e?.message || e || "Send failed");
      setError(msg);
      setNotice(null);
    } finally {
      setSendBusy(false);
    }
  };

  const saveIdea = async (card: IdeaCard, key: string) => {
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
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Save failed (${res.status})`));
      setNotice("Idea saved.");
      onIdeaSaved?.();
    } catch (e: any) {
      setSaveIdeaError(String(e?.message || e || "Save idea failed"));
    } finally {
      setSaveIdeaBusyKey(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-stretch justify-center bg-black/50 p-2 md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-6xl h-full bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900 truncate">Generate ideas</div>
            <div className="mt-0.5 text-xs text-slate-500 truncate" title={swipeItemLabel}>
              {swipeItemLabel || "Swipe item"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm hover:bg-slate-50"
              onClick={() => setSettingsOpen((v) => !v)}
              title="Master prompt settings"
            >
              Settings
            </button>
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

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_360px]">
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
                  className="flex-1 min-h-[44px] max-h-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                  placeholder="Message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (canSend) void sendMessage();
                    }
                  }}
                />
                <button
                  type="button"
                  className="h-11 px-4 rounded-lg bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                  disabled={!canSend}
                  onClick={() => void sendMessage()}
                  title="Send (⌘+Enter)"
                >
                  {sendBusy ? "Sending…" : "Send"}
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">Tip: press ⌘+Enter to send.</div>
            </div>
          </main>

          <aside className="border-l border-slate-100 bg-slate-50/50 p-4 overflow-auto">
            <div className="text-xs font-semibold text-slate-700">Idea cards</div>
            <div className="mt-2 text-[11px] text-slate-500">Select one to save it for this Swipe item.</div>
            {saveIdeaError ? <div className="mt-2 text-xs text-red-600">❌ {saveIdeaError}</div> : null}

            {cards.length === 0 ? (
              <div className="mt-4 text-sm text-slate-600">No cards yet. Send a message to generate ideas.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {cards.map((c, idx) => {
                  const key = `${idx}-${c.title}`;
                  const busy = saveIdeaBusyKey === key;
                  return (
                    <div key={key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="text-sm font-semibold text-slate-900">{c.title || "Idea"}</div>
                      <div className="mt-2 space-y-1">
                        {(Array.isArray(c.slides) ? c.slides : []).slice(0, 6).map((s, i) => (
                          <div key={i} className="text-xs text-slate-700">
                            <span className="font-semibold text-slate-600">S{i + 1}:</span> {String(s || "").trim() || "—"}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="mt-3 w-full h-9 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void saveIdea(c, key)}
                      >
                        {busy ? "Saving…" : "Select (save idea)"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

