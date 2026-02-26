"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";

type Idea = {
  id: string;
  createdAt: string;
  title: string;
  slideOutline: string[];
  angleText: string;
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

export function SwipeIdeasPickerModal(props: {
  open: boolean;
  onClose: () => void;
  swipeItemId: string | null;
  swipeItemLabel: string;
  onPick: (args: { ideaId: string | null }) => void;
}) {
  const { open, onClose, swipeItemId, swipeItemLabel, onPick } = props;

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const selectedIdea = useMemo(() => ideas.find((i) => i.id === selectedId) || null, [ideas, selectedId]);

  useEffect(() => {
    if (!open) return;
    const itemId = String(swipeItemId || "").trim();
    if (!itemId) return;

    let cancelled = false;
    void (async () => {
      setStatus("loading");
      setError(null);
      setIdeas([]);
      setSelectedId("");
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing auth token");
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
        const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/ideas`, { method: "GET", headers });
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load ideas (${res.status})`));
        const rows: Idea[] = Array.isArray(j.ideas)
          ? (j.ideas as any[]).map((r) => ({
              id: String(r.id),
              createdAt: String(r.createdAt || ""),
              title: String(r.title || ""),
              slideOutline: Array.isArray(r.slideOutline) ? r.slideOutline.map((x: any) => String(x ?? "")) : [],
              angleText: String(r.angleText || ""),
            }))
          : [];
        setIdeas(rows);
        setStatus("ready");
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          setError(String(e?.message || e || "Failed to load ideas"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, swipeItemId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[145] flex items-stretch justify-center bg-black/50 p-2 md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl h-full bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900 truncate">Pick an idea</div>
            <div className="mt-0.5 text-xs text-slate-500 truncate" title={swipeItemLabel}>
              {swipeItemLabel || "Swipe item"}
            </div>
          </div>
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

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_360px]">
          <main className="min-h-0 overflow-auto p-4">
            {status === "loading" ? <div className="text-sm text-slate-600">Loading…</div> : null}
            {status === "error" ? <div className="text-sm text-red-600">❌ {error || "Failed to load"}</div> : null}
            {status === "ready" && ideas.length === 0 ? (
              <div className="text-sm text-slate-600">
                No saved ideas yet. Click “Generate ideas” first, then select one to save it.
              </div>
            ) : null}

            <div className="space-y-2">
              {ideas.map((it) => {
                const active = it.id === selectedId;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={[
                      "w-full text-left rounded-xl border px-4 py-3 transition-colors",
                      active ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50",
                    ].join(" ")}
                    onClick={() => setSelectedId(it.id)}
                    title={it.title}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{it.title || "Idea"}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {it.createdAt ? new Date(it.createdAt).toLocaleString() : ""}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">{active ? "Selected" : ""}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1">
                      {(Array.isArray(it.slideOutline) ? it.slideOutline : []).slice(0, 2).map((s, idx) => (
                        <div key={idx} className="text-xs text-slate-700 truncate">
                          <span className="font-semibold text-slate-600">S{idx + 1}:</span> {String(s || "").trim() || "—"}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </main>

          <aside className="border-l border-slate-100 bg-slate-50/50 p-4 overflow-auto">
            <div className="text-xs font-semibold text-slate-700">Preview</div>
            <div className="mt-2 text-[11px] text-slate-500">This idea will become the “angle” used for copy generation.</div>

            {selectedIdea ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">{selectedIdea.title}</div>
                <div className="mt-2 space-y-1">
                  {selectedIdea.slideOutline.slice(0, 6).map((s, i) => (
                    <div key={i} className="text-xs text-slate-700">
                      <span className="font-semibold text-slate-600">S{i + 1}:</span> {String(s || "").trim() || "—"}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-600">Select an idea to preview it.</div>
            )}

            <div className="mt-4 space-y-2">
              <button
                type="button"
                className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                disabled={!selectedIdea}
                onClick={() => onPick({ ideaId: selectedIdea ? selectedIdea.id : null })}
              >
                Use selected idea
              </button>
              <button
                type="button"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50"
                onClick={() => onPick({ ideaId: null })}
                title="Continue using Angle/Notes (no idea selected)"
              >
                Continue without idea
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

