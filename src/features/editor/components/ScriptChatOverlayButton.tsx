"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";
import { useEditorSelector } from "@/features/editor/store";

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

export function ScriptChatOverlayButton() {
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const isMobile = useEditorSelector((s: any) => !!(s as any).isMobile);
  const currentProjectId = useEditorSelector((s: any) => ((s as any).currentProjectId ? String((s as any).currentProjectId) : null));
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const pid = useMemo(() => (currentProjectId ? String(currentProjectId) : ""), [currentProjectId]);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error" | "loading">("idle");
  // Mobile UX: hide overlay buttons (Copy action is moved into the bottom Controls card).
  if (isMobile) return null;
  if (!isSuperadmin || !pid) return null;

  const buildPromptPreviewText = (args: { system: string; contextText: string }) => {
    const sys = String(args.system || "").trim();
    const ctx = String(args.contextText || "").trim();
    const firstMsg = "<type your first message here>";
    return [
      `SYSTEM:\n${sys || "-"}`,
      ``,
      `CACHED_CONTEXT_BLOCK (frozen):\n${ctx || "-"}`,
      ``,
      `FIRST_USER_MESSAGE:\n${firstMsg}`,
    ].join("\n");
  };

  const copyScriptPrompt = async () => {
    if (copyStatus === "loading") return;
    setCopyStatus("loading");
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/editor/projects/script-chat/prompt-preview?projectId=${encodeURIComponent(pid)}`, { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load prompt (${res.status})`));

      const text = buildPromptPreviewText({ system: String(j?.system || ""), contextText: String(j?.contextText || "") });

      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          setCopyStatus("copied");
          window.setTimeout(() => setCopyStatus("idle"), 1200);
          return;
        }
      } catch {
        // fall through
      }

      // Fallback copy path (matches DebugCard behavior).
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
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1200);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 1600);
    }
  };

  return (
    <div className="absolute right-[5px] top-[5px] z-[50] flex items-center gap-2">
      {copyStatus === "copied" ? (
        <div className="text-[11px] font-semibold text-emerald-700 bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-2 py-1 shadow-lg">
          Copied
        </div>
      ) : copyStatus === "error" ? (
        <div className="text-[11px] font-semibold text-red-600 bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-2 py-1 shadow-lg">
          Copy failed
        </div>
      ) : null}

      <button
        type="button"
        className="h-9 px-3 rounded-xl border border-slate-200 bg-white/95 backdrop-blur text-[12px] font-semibold text-slate-800 shadow-lg hover:bg-white disabled:opacity-60"
        onClick={() => void copyScriptPrompt()}
        disabled={copyStatus === "loading"}
        title="Copy the full Script prompt preview"
      >
        {copyStatus === "loading" ? "Copying…" : "Copy Script Prompt"}
      </button>
      <button
        type="button"
        className="h-9 px-3 rounded-xl border border-slate-200 bg-white/95 backdrop-blur text-[12px] font-semibold text-slate-800 shadow-lg hover:bg-white"
        onClick={() => actions?.onOpenScriptChatModal?.(pid)}
        title="Chat with AI to draft a Reel script"
      >
        Create Script
      </button>
    </div>
  );
}

