"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";
import { useEditorSelector } from "@/features/editor/store";

type ChatMsg = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

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

export function ScriptChatModal() {
  const open = useEditorSelector((s: any) => !!(s as any).scriptChatModalOpen);
  const projectId = useEditorSelector((s: any) => ((s as any).scriptChatProjectId ? String((s as any).scriptChatProjectId) : null));
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState<string>("");
  const [sendBusy, setSendBusy] = useState<boolean>(false);
  const [resetBusy, setResetBusy] = useState<boolean>(false);

  const [promptOpen, setPromptOpen] = useState<boolean>(false);
  const [promptLoading, setPromptLoading] = useState<boolean>(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptSystem, setPromptSystem] = useState<string>("");
  const [promptContext, setPromptContext] = useState<string>("");
  const [promptCopyStatus, setPromptCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    return !!open && !!isSuperadmin && !!projectId && !!String(draft || "").trim() && !sendBusy && status === "ready";
  }, [open, isSuperadmin, projectId, draft, sendBusy, status]);

  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    setError(null);
    setThreadId(null);
    setMessages([]);
    setDraft("");
    setSendBusy(false);
    setResetBusy(false);
    setPromptOpen(false);
    setPromptLoading(false);
    setPromptError(null);
    setPromptSystem("");
    setPromptContext("");
    setPromptCopyStatus("idle");
  }, [open]);

  const loadThread = async (pid: string) => {
    const id = String(pid || "").trim();
    if (!id) return;
    setStatus("loading");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/editor/projects/script-chat/thread?projectId=${encodeURIComponent(id)}`, { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load thread (${res.status})`));
      setThreadId(String(j.threadId || ""));
      const rows: ChatMsg[] = Array.isArray(j.messages)
        ? (j.messages as any[]).map((m) => ({
            id: String(m?.id || ""),
            role: String(m?.role) === "assistant" ? "assistant" : "user",
            content: String(m?.content || ""),
            createdAt: String(m?.createdAt || ""),
          }))
        : [];
      setMessages(rows);
      setStatus("ready");
    } catch (e: any) {
      setStatus("error");
      setError(String(e?.message || e || "Failed to load thread"));
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!isSuperadmin) return;
    if (!projectId) return;
    void loadThread(projectId);
  }, [open, isSuperadmin, projectId]);

  useEffect(() => {
    if (!open) return;
    // Scroll to bottom on new messages.
    try {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    } catch {
      // ignore
    }
  }, [open, messages.length]);

  const onClose = () => {
    actions?.onCloseScriptChatModal?.();
  };

  const buildPromptPreviewText = () => {
    const sys = String(promptSystem || "").trim();
    const ctx = String(promptContext || "").trim();
    const firstMsg = String(draft || "").trim() || "<type your first message here>";
    return [
      `SYSTEM:\n${sys || "-"}`,
      ``,
      `CACHED_CONTEXT_BLOCK (frozen):\n${ctx || "-"}`,
      ``,
      `FIRST_USER_MESSAGE:\n${firstMsg}`,
    ].join("\n");
  };

  const fetchPromptPreview = async () => {
    if (!projectId) return;
    setPromptLoading(true);
    setPromptError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/editor/projects/script-chat/prompt-preview?projectId=${encodeURIComponent(projectId)}`, { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load prompt preview (${res.status})`));
      setPromptSystem(String(j?.system || ""));
      setPromptContext(String(j?.contextText || ""));
    } catch (e: any) {
      setPromptError(String(e?.message || e || "Failed to load prompt preview"));
    } finally {
      setPromptLoading(false);
    }
  };

  const onOpenPrompt = async () => {
    setPromptOpen(true);
    await fetchPromptPreview();
  };

  const onCopyPrompt = async () => {
    const text = buildPromptPreviewText();
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setPromptCopyStatus("copied");
        window.setTimeout(() => setPromptCopyStatus("idle"), 1200);
        return;
      }
    } catch {
      // fall through
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (!ok) throw new Error("copy command failed");
      setPromptCopyStatus("copied");
      window.setTimeout(() => setPromptCopyStatus("idle"), 1200);
    } catch {
      setPromptCopyStatus("error");
      window.setTimeout(() => setPromptCopyStatus("idle"), 1600);
    }
  };

  const onSend = async () => {
    if (!projectId) return;
    const content = String(draft || "").trim();
    if (!content) return;
    setSendBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/editor/projects/script-chat/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ projectId, content }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Send failed (${res.status})`));
      const u = j?.appended?.user;
      const a = j?.appended?.assistant;
      if (u?.id && a?.id) {
        setMessages((prev) => [
          ...prev,
          { id: String(u.id), role: "user", content: String(u.content || ""), createdAt: String(u.createdAt || "") },
          { id: String(a.id), role: "assistant", content: String(a.content || ""), createdAt: String(a.createdAt || "") },
        ]);
      } else {
        // Fallback: reload thread.
        await loadThread(projectId);
      }
      setDraft("");
      setStatus("ready");
    } catch (e: any) {
      setError(String(e?.message || e || "Send failed"));
      setStatus("error");
    } finally {
      setSendBusy(false);
    }
  };

  const onReset = async () => {
    if (!projectId) return;
    setResetBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/editor/projects/script-chat/reset`, {
        method: "POST",
        headers,
        body: JSON.stringify({ projectId }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Reset failed (${res.status})`));
      setThreadId(null);
      setMessages([]);
      setDraft("");
      await loadThread(projectId);
    } catch (e: any) {
      setError(String(e?.message || e || "Reset failed"));
      setStatus("error");
    } finally {
      setResetBusy(false);
    }
  };

  if (!open) return null;
  if (!isSuperadmin) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[880px] h-[75vh] rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-900 truncate">Create Script</div>
            <div className="text-[11px] text-slate-500 truncate">
              {projectId ? `Project: ${projectId}` : "No project selected"}
              {threadId ? ` • Thread: ${threadId}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={() => void onOpenPrompt()}
              disabled={!projectId}
              title="See the exact prompt/context sent on the first message"
            >
              View prompt
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={() => void onReset()}
              disabled={!projectId || resetBusy}
              title="Start a new chat (wipes the stored thread)"
            >
              {resetBusy ? "Resetting…" : "Start new chat"}
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-2 text-[12px] text-red-700 bg-red-50 border-b border-red-100">
            {String(error)}
          </div>
        ) : null}

        {promptOpen ? (
          <div className="px-4 py-3 border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-semibold text-slate-900">Prompt preview</div>
              <div className="flex items-center gap-2">
                {promptCopyStatus === "copied" ? (
                  <span className="text-[11px] text-emerald-700 font-semibold">Copied!</span>
                ) : promptCopyStatus === "error" ? (
                  <span className="text-[11px] text-red-600 font-semibold">Copy failed</span>
                ) : null}
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => void onCopyPrompt()}
                  disabled={promptLoading || !promptSystem || !promptContext}
                  title="Copy the full prompt text"
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50"
                  onClick={() => setPromptOpen(false)}
                  title="Hide prompt preview"
                >
                  Hide
                </button>
              </div>
            </div>

            {promptError ? <div className="mt-2 text-[11px] text-red-700">{promptError}</div> : null}
            {promptLoading ? <div className="mt-2 text-[11px] text-slate-500">Loading…</div> : null}

            <textarea
              className="mt-2 w-full h-[180px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono text-slate-900 outline-none"
              readOnly
              value={buildPromptPreviewText()}
            />
          </div>
        ) : null}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
          {messages.length === 0 ? (
            <div className="text-[12px] text-slate-500">
              {status === "loading" ? "Loading…" : "Send a message to start drafting your script."}
            </div>
          ) : null}

          {messages.map((m) => (
            <div key={m.id} className={["flex", m.role === "user" ? "justify-end" : "justify-start"].join(" ")}>
              <div
                className={[
                  "max-w-[80%] rounded-2xl px-3 py-2 shadow-sm border",
                  m.role === "user" ? "bg-white border-slate-200" : "bg-white border-slate-200",
                ].join(" ")}
              >
                <div className="text-[11px] font-semibold text-slate-600 mb-1">{m.role === "user" ? "You" : "Claude"}</div>
                <div className="text-[13px] text-slate-900 whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              className="flex-1 min-h-[44px] max-h-[160px] rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/40"
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!projectId || sendBusy || resetBusy || status === "loading"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) void onSend();
                }
              }}
            />
            <button
              type="button"
              className="h-11 px-4 rounded-xl bg-violet-600 text-white text-[13px] font-semibold shadow-sm hover:bg-violet-700 disabled:opacity-60"
              disabled={!canSend}
              onClick={() => void onSend()}
            >
              {sendBusy ? "Sending…" : "Send"}
            </button>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Enter to send • Shift+Enter for newline • If you see “Generate/Realign first.”, run Generate Copy or Realign.
          </div>
        </div>
      </div>
    </div>
  );
}

