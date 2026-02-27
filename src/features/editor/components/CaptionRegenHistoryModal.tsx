"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";

type RunRow = {
  id: string;
  createdAt: string | null;
  outputCaption: string;
  excludedFromPrompt: boolean;
};

type RunDetail = RunRow & {
  promptRendered: string;
  inputContext: any;
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

export function CaptionRegenHistoryModal(props: { open: boolean; onClose: () => void; projectId: string | null }) {
  const { open, onClose, projectId } = props;
  const pid = String(projectId || "").trim();

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsById, setDetailsById] = useState<Record<string, RunDetail | null>>({});
  const [detailsLoadingById, setDetailsLoadingById] = useState<Record<string, boolean>>({});
  const [toggleBusyById, setToggleBusyById] = useState<Record<string, boolean>>({});

  const canInteract = useMemo(() => status !== "loading" && !Object.values(toggleBusyById).some(Boolean), [status, toggleBusyById]);
  const loadLimit = 50;

  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (!canInteract) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canInteract, onClose, open]);

  useEffect(() => {
    if (!open) return;
    if (!pid) {
      setStatus("error");
      setError("Create or load a project first.");
      setRuns([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      setStatus("loading");
      setError(null);
      setRuns([]);
      setExpandedId(null);
      setDetailsById({});
      setDetailsLoadingById({});
      setToggleBusyById({});
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing auth token");
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
        const res = await fetch(
          `/api/editor/projects/caption-regen-runs?projectId=${encodeURIComponent(pid)}&limit=${encodeURIComponent(String(loadLimit))}`,
          { method: "GET", headers }
        );
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load history (${res.status})`));
        const rows: RunRow[] = Array.isArray(j.runs)
          ? (j.runs as any[]).map((r) => ({
              id: String(r?.id || ""),
              createdAt: r?.createdAt ?? null,
              outputCaption: String(r?.outputCaption || ""),
              excludedFromPrompt: !!r?.excludedFromPrompt,
            }))
          : [];
        setRuns(rows);
        setStatus("ready");
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          setError(String(e?.message || e || "Failed to load caption history"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pid]);

  const loadDetails = async (runId: string) => {
    const id = String(runId || "").trim();
    if (!id || !pid) return;
    if (detailsById[id]) return;
    setDetailsLoadingById((m) => ({ ...m, [id]: true }));
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(
        `/api/editor/projects/caption-regen-runs/${encodeURIComponent(id)}?projectId=${encodeURIComponent(pid)}`,
        { method: "GET", headers }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load details (${res.status})`));
      const r = j.run || null;
      const d: RunDetail = {
        id: String(r?.id || id),
        createdAt: r?.createdAt ?? null,
        outputCaption: String(r?.outputCaption || ""),
        excludedFromPrompt: !!r?.excludedFromPrompt,
        promptRendered: String(r?.promptRendered || ""),
        inputContext: r?.inputContext ?? null,
      };
      setDetailsById((m) => ({ ...m, [id]: d }));
    } catch (e: any) {
      // store a sentinel so we don't hammer the endpoint; error is shown inline
      setDetailsById((m) => ({ ...m, [id]: null }));
      setError(String(e?.message || e || "Failed to load details"));
    } finally {
      setDetailsLoadingById((m) => ({ ...m, [id]: false }));
    }
  };

  const toggleExclude = async (runId: string, next: boolean) => {
    const id = String(runId || "").trim();
    if (!id || !pid) return;
    setToggleBusyById((m) => ({ ...m, [id]: true }));
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(
        `/api/editor/projects/caption-regen-runs/${encodeURIComponent(id)}?projectId=${encodeURIComponent(pid)}`,
        { method: "PATCH", headers, body: JSON.stringify({ excludedFromPrompt: next }) }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Update failed (${res.status})`));
      const updated = j.run || null;
      const excludedFromPrompt = !!updated?.excludedFromPrompt;
      setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, excludedFromPrompt } : r)));
      setDetailsById((m) => {
        const cur = m[id];
        if (!cur) return m;
        return { ...m, [id]: { ...cur, excludedFromPrompt } };
      });
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to update"));
    } finally {
      setToggleBusyById((m) => ({ ...m, [id]: false }));
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (!canInteract) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={modalRef} className="w-full max-w-4xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900 truncate">Caption regen history</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Excluded runs are not sent to the model on future regenerations.
            </div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={onClose}
            disabled={!canInteract}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">
          {status === "loading" ? <div className="text-sm text-slate-600">Loading…</div> : null}
          {status === "error" ? <div className="text-sm text-red-600">❌ {error || "Failed to load"}</div> : null}
          {status === "ready" && runs.length === 0 ? (
            <div className="text-sm text-slate-600">No caption regeneration runs yet.</div>
          ) : null}

          {status === "ready" ? (
            <div className="space-y-3">
              {runs.map((r) => {
                const expanded = expandedId === r.id;
                const loading = !!detailsLoadingById[r.id];
                const busy = !!toggleBusyById[r.id];
                const detail = detailsById[r.id];
                return (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold text-slate-700">{formatWhen(r.createdAt) || "Run"}</div>
                          {r.excludedFromPrompt ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                              excluded
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800">
                              included
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-slate-900 whitespace-pre-wrap">{r.outputCaption || "—"}</div>
                      </div>
                      <div className="shrink-0 flex flex-col gap-2">
                        <button
                          type="button"
                          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void toggleExclude(r.id, !r.excludedFromPrompt)}
                          title={r.excludedFromPrompt ? "Include this run again" : "Exclude this run from future regenerations"}
                        >
                          {r.excludedFromPrompt ? "Include again" : "Exclude"}
                        </button>
                        <button
                          type="button"
                          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                          onClick={() => {
                            const next = expanded ? null : r.id;
                            setExpandedId(next);
                            if (!expanded) void loadDetails(r.id);
                          }}
                          disabled={loading}
                          title="View details"
                        >
                          {expanded ? "Hide details" : loading ? "Loading…" : "Details"}
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3" open>
                          <summary className="cursor-pointer text-xs font-semibold text-slate-700">Input context (JSON)</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-[12px] text-slate-800 leading-relaxed">
                            {detail === null ? "Failed to load." : JSON.stringify(detail?.inputContext ?? null, null, 2)}
                          </pre>
                        </details>
                        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-700">Prompt sent (exact)</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-[12px] text-slate-800 leading-relaxed">
                            {detail === null ? "Failed to load." : String(detail?.promptRendered || "")}
                          </pre>
                        </details>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

