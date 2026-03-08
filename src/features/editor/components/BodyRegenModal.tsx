"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";
import { useEditorSelector } from "@/features/editor/store";

type Attempt = {
  id: string;
  createdAt: string | null;
  guidanceText: string | null;
  body: string;
  bodyStyleRanges: any[];
};

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  suggestions?: Array<{ id: string; idx: number; body: string; createdAt: string }>;
};

function formatWhen(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const ok = Number.isFinite(d.getTime());
    if (!ok) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

export function BodyRegenModal() {
  const open = useEditorSelector((s: any) => !!(s as any).bodyRegenModalOpen);
  const templateTypeId = useEditorSelector((s: any) => (s as any).templateTypeId);
  const targetProjectId = useEditorSelector((s: any) => ((s as any).bodyRegenTargetProjectId ? String((s as any).bodyRegenTargetProjectId) : null));
  const targetSlideIndex = useEditorSelector((s: any) =>
    Number.isInteger((s as any).bodyRegenTargetSlideIndex) ? Number((s as any).bodyRegenTargetSlideIndex) : null
  );
  const originalByKey = useEditorSelector((s: any) => ((s as any).bodyRegenOriginalByKey && typeof (s as any).bodyRegenOriginalByKey === "object" ? (s as any).bodyRegenOriginalByKey : {}));
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Chat state (persisted server-side per project+slide)
  const [chatStatus, setChatStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [chatError, setChatError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canInteract = useMemo(() => !sendBusy, [sendBusy]);
  const effectiveSlideNumber = targetSlideIndex !== null ? targetSlideIndex + 1 : null;
  const originalKey = useMemo(() => {
    if (!targetProjectId || targetSlideIndex === null) return null;
    return `${String(targetProjectId)}:${Number(targetSlideIndex)}`;
  }, [targetProjectId, targetSlideIndex]);
  const original = useMemo(() => {
    if (!originalKey) return null;
    const row = (originalByKey as any)?.[originalKey] || null;
    if (!row) return null;
    return {
      id: "__original__",
      createdAt: null,
      guidanceText: null,
      body: String((row as any)?.body || ""),
      bodyStyleRanges: Array.isArray((row as any)?.bodyStyleRanges) ? (row as any).bodyStyleRanges : [],
    } as Attempt;
  }, [originalByKey, originalKey]);
  const attemptsWithOriginal = useMemo(() => {
    // Keep newest-first ordering for real attempts; append Original as a distinct entry at the bottom.
    const base = Array.isArray(attempts) ? attempts : [];
    return original ? [...base, original] : base;
  }, [attempts, original]);

  useEffect(() => {
    if (!open) return;
    if (!targetProjectId || targetSlideIndex === null) return;
    if (!actions?.fetchBodyRegenAttempts) return;

    let cancelled = false;
    const run = async () => {
      setAttemptsLoading(true);
      setAttemptsError(null);
      try {
        const rows = (await actions.fetchBodyRegenAttempts({
          projectId: targetProjectId,
          slideIndex: targetSlideIndex,
          limit: 20,
        })) as Attempt[];
        if (cancelled) return;
        const next = Array.isArray(rows) ? rows : [];
        setAttempts(next);
      } catch (e: any) {
        if (cancelled) return;
        setAttemptsError(String(e?.message || e || "Failed to load attempts"));
        setAttempts([]);
      } finally {
        if (!cancelled) setAttemptsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [actions, open, targetProjectId, targetSlideIndex]);

  async function getToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  function getActiveAccountHeader(): Record<string, string> {
    try {
      const id = typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
      return id ? ({ "x-account-id": id } as Record<string, string>) : ({} as Record<string, string>);
    } catch {
      return {} as Record<string, string>;
    }
  }

  // Load thread/messages on open (resume).
  useEffect(() => {
    if (!open) return;
    const pid = String(targetProjectId || "").trim();
    const si = Number.isInteger(targetSlideIndex as any) ? Number(targetSlideIndex) : null;
    if (!pid || si === null) return;

    let cancelled = false;
    void (async () => {
      setChatStatus("loading");
      setChatError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing auth token");
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
        const url = `/api/editor/projects/body-regen-chat/thread?projectId=${encodeURIComponent(pid)}&slideIndex=${encodeURIComponent(String(si))}`;
        const res = await fetch(url, { method: "GET", headers });
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load thread (${res.status})`));
        setThreadId(String(j?.threadId || "").trim() || null);
        const msgs: any[] = Array.isArray(j?.messages) ? j.messages : [];
        setMessages(
          msgs.map((m) => ({
            id: String(m.id),
            role: String(m.role) === "assistant" ? "assistant" : "user",
            content: String(m.content || ""),
            createdAt: String(m.createdAt || ""),
            suggestions: Array.isArray((m as any)?.suggestions)
              ? (m as any).suggestions.map((sug: any) => ({
                  id: String(sug.id),
                  idx: Number(sug.idx),
                  body: String(sug.body || ""),
                  createdAt: String(sug.createdAt || ""),
                }))
              : undefined,
          }))
        );
        setChatStatus("ready");
      } catch (e: any) {
        if (!cancelled) {
          setChatStatus("error");
          setChatError(String(e?.message || e || "Failed to load chat"));
          setThreadId(null);
          setMessages([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetProjectId, targetSlideIndex]);

  useEffect(() => {
    if (!open) return;
    // Auto-scroll to bottom when messages change.
    try {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    } catch {
      // ignore
    }
  }, [open, messages.length]);

  const sendMessage = async (provider: "poppy" | "claude") => {
    const pid = String(targetProjectId || "").trim();
    const si = Number.isInteger(targetSlideIndex as any) ? Number(targetSlideIndex) : null;
    const text = String(draft || "").trim();
    if (!pid || si === null || !text) return;
    if (sendBusy) return;
    if (templateTypeId !== "regular") return;

    setSendBusy(true);
    setChatError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };

      const optimisticId = `local-${Date.now()}`;
      setMessages((prev) => [...prev, { id: optimisticId, role: "user", content: text, createdAt: new Date().toISOString() }]);
      setDraft("");

      const res = await fetch(`/api/editor/projects/body-regen-chat/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ projectId: pid, slideIndex: si, content: text, provider }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Send failed (${res.status})`));

      const assistantMessage = String(j?.assistantMessage || "").trim();
      const srcMsgId = String(j?.sourceMessageId || "").trim();
      const candidatesIn = Array.isArray(j?.candidates) ? j.candidates : [];
      const suggestions = candidatesIn
        .slice(0, 3)
        .map((c: any, idx: number) => ({ id: `local-${srcMsgId}-${idx}`, idx, body: String(c?.body || ""), createdAt: new Date().toISOString() }));

      setThreadId(String(j?.threadId || "").trim() || null);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        { id: optimisticId, role: "user", content: text, createdAt: new Date().toISOString() },
        { id: srcMsgId || `assistant-${Date.now()}`, role: "assistant", content: assistantMessage || "…", createdAt: new Date().toISOString(), suggestions },
      ]);
    } catch (e: any) {
      setChatError(String(e?.message || e || "Send failed"));
    } finally {
      setSendBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (!canInteract) return;
      actions?.onCloseBodyRegenModal?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, canInteract, open]);

  if (!open) return null;

  const disabledBecauseType = templateTypeId !== "regular";
  const disabledBecauseTarget = !targetProjectId || targetSlideIndex === null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (!canInteract) return;
        if (e.target === e.currentTarget) actions?.onCloseBodyRegenModal?.();
      }}
    >
      <div className="w-full max-w-5xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">
            Regenerate Body{effectiveSlideNumber ? ` (Slide ${effectiveSlideNumber})` : ""}
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => actions?.onCloseBodyRegenModal?.()}
            disabled={!canInteract}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">
          {disabledBecauseType ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Body Regenerate is currently available for <span className="font-semibold">Regular</span> projects only.
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            <div className="min-h-[420px] rounded-lg border border-slate-200 bg-white flex flex-col overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">Chat</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Ask for improvements. Each reply includes 3 options you can apply to the slide body.
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
                {chatStatus === "loading" ? <div className="text-sm text-slate-600">Loading…</div> : null}
                {chatStatus === "error" ? <div className="text-sm text-red-600">❌ {chatError || "Failed to load chat"}</div> : null}
                {chatStatus === "ready" && messages.length === 0 ? (
                  <div className="text-sm text-slate-600">
                    Describe what you want to change about the slide body. For example: “Make it shorter and more punchy.”
                  </div>
                ) : null}

                {messages.map((m) => (
                  <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className="max-w-[85%]">
                      <div
                        className={[
                          "rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                          m.role === "user" ? "bg-black text-white" : "bg-slate-100 text-slate-900",
                        ].join(" ")}
                      >
                        {m.content}
                      </div>
                      {m.role === "assistant" && Array.isArray(m.suggestions) && m.suggestions.length > 0 ? (
                        <div className="mt-2 grid grid-cols-1 gap-2">
                          {m.suggestions.slice(0, 3).map((sug) => (
                            <div key={sug.id} className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-[11px] font-semibold text-slate-600">Option {Number(sug.idx) + 1}</div>
                                <button
                                  type="button"
                                  className="shrink-0 h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-50"
                                  disabled={!canInteract || disabledBecauseType || disabledBecauseTarget}
                                  onClick={async () => {
                                    try {
                                      // V1: plain body text only. We intentionally clear ranges.
                                      await actions?.onRestoreBodyRegenAttempt?.({ body: String(sug.body || ""), bodyStyleRanges: [] });
                                    } catch {
                                      // ignore; slide save errors surface elsewhere
                                    }
                                  }}
                                  title="Apply this option to the slide body"
                                >
                                  Apply
                                </button>
                              </div>
                              <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-900 leading-relaxed">{String(sug.body || "")}</pre>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 p-3">
                {chatStatus === "ready" && chatError ? <div className="mb-2 text-xs text-red-600">❌ {chatError}</div> : null}
                <div className="flex items-end gap-2">
                  <textarea
                    className="flex-1 min-h-[44px] max-h-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Message the AI…"
                    disabled={!canInteract || disabledBecauseType || disabledBecauseTarget || chatStatus !== "ready"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage("poppy");
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                      onClick={() => void sendMessage("poppy")}
                      disabled={
                        !canInteract ||
                        disabledBecauseType ||
                        disabledBecauseTarget ||
                        chatStatus !== "ready" ||
                        !String(draft || "").trim()
                      }
                      title="Send with Poppy (uses your knowledge base)"
                    >
                      {sendBusy ? "Sending…" : "Send with Poppy"}
                    </button>
                    <button
                      type="button"
                      className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-50"
                      onClick={() => void sendMessage("claude")}
                      disabled={
                        !canInteract ||
                        disabledBecauseType ||
                        disabledBecauseTarget ||
                        chatStatus !== "ready" ||
                        !String(draft || "").trim()
                      }
                      title="Send with Claude (direct)"
                    >
                      {sendBusy ? "Sending…" : "Send with Claude"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    Plain text only. Includes full carousel context (all slides textLines + caption + brand voice + attempts).
                  </div>
                  <button
                    type="button"
                    className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => actions?.onCloseBodyRegenModal?.()}
                    disabled={!canInteract}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <aside className="space-y-3">
              {chatStatus === "ready" && threadId ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold text-slate-700">Thread</div>
                  <div className="mt-1 text-[11px] text-slate-500 break-all">{threadId}</div>
                </div>
              ) : null}
              {disabledBecauseTarget ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Select a project and slide to use Body Regenerate.
                </div>
              ) : null}
              {chatStatus === "error" && chatError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {chatError}
                </div>
              ) : null}
            </aside>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <button
              type="button"
              className="w-full flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setExpanded((v) => !v)}
              disabled={attemptsLoading}
              title="Show previous attempts"
            >
              <span>Previous attempts</span>
              <span className="text-xs text-slate-500">
                {attemptsLoading ? "Loading…" : `${attemptsWithOriginal.length}`}
                <span className="ml-2">{expanded ? "▲" : "▼"}</span>
              </span>
            </button>

            {attemptsError ? <div className="mt-2 text-xs text-red-600">❌ {attemptsError}</div> : null}

            {expanded ? (
              <div className="mt-3 space-y-3">
                {attemptsWithOriginal.length === 0 ? (
                  <div className="text-xs text-slate-500">No attempts yet.</div>
                ) : (
                  attemptsWithOriginal.map((a) => (
                    <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-700">
                            {a.id === "__original__" ? "Original" : formatWhen(a.createdAt) || "Attempt"}
                          </div>
                          {a.id === "__original__" ? (
                            <div className="mt-1 text-[11px] text-slate-400">First version (captured when Generate Copy applied).</div>
                          ) : a.guidanceText ? (
                            <div className="mt-1 text-[11px] text-slate-500 truncate">
                              Guidance: {a.guidanceText}
                            </div>
                          ) : (
                            <div className="mt-1 text-[11px] text-slate-400">Guidance: (none)</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="shrink-0 h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                          disabled={!canInteract || disabledBecauseType || disabledBecauseTarget}
                          onClick={async () => {
                            try {
                              await actions?.onRestoreBodyRegenAttempt?.({
                                body: String(a.body || ""),
                                bodyStyleRanges: Array.isArray(a.bodyStyleRanges) ? a.bodyStyleRanges : [],
                              });
                              actions?.onCloseBodyRegenModal?.();
                            } catch {
                              // ignore (restore errors show in slide save UI)
                            }
                          }}
                          title="Restore this attempt to the slide"
                        >
                          Restore
                        </button>
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-900 leading-relaxed">
                        {String(a.body || "")}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-4 text-[11px] text-slate-500">
            Tip: Regenerate uses the full carousel context (all slide bodies) to stay coherent, but only updates the selected slide.
          </div>
        </div>
      </div>
    </div>
  );
}

