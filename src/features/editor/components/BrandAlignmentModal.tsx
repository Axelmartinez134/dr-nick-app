"use client";

import { useEffect, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";

export function BrandAlignmentModal() {
  const open = useEditorSelector((s: any) => !!(s as any).brandAlignmentModalOpen);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const currentProjectId = useEditorSelector((s: any) => ((s as any).currentProjectId as any) || null);

  const brandAlignmentPrompt = useEditorSelector((s: any) => String((s as any).brandAlignmentPrompt || ""));
  const brandAlignmentPromptSaveStatus = useEditorSelector(
    (s: any) => (String((s as any).brandAlignmentPromptSaveStatus || "idle") as any) || "idle"
  );
  const brandAlignmentPromptSaveError = useEditorSelector(
    (s: any) => ((s as any).brandAlignmentPromptSaveError as any) || null
  );

  const runStatus = useEditorSelector((s: any) => String((s as any).brandAlignmentRunStatus || "idle"));
  const runError = useEditorSelector((s: any) => ((s as any).brandAlignmentRunError as any) || null);
  const latestResult = useEditorSelector((s: any) => ((s as any).brandAlignmentLatestResult as any) || null);

  const runsStatus = useEditorSelector((s: any) => String((s as any).brandAlignmentRunsStatus || "idle"));
  const runsError = useEditorSelector((s: any) => ((s as any).brandAlignmentRunsError as any) || null);
  const runs = useEditorSelector((s: any) => (Array.isArray((s as any).brandAlignmentRuns) ? (s as any).brandAlignmentRuns : []));

  // Phase 2 UX polish: show elapsed time while running (up to 60s).
  const [runElapsedSec, setRunElapsedSec] = useState(0);
  useEffect(() => {
    if (runStatus !== "running") {
      setRunElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    setRunElapsedSec(0);
    const t = window.setInterval(() => {
      const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setRunElapsedSec(s);
    }, 250);
    return () => window.clearInterval(t);
  }, [runStatus]);

  const runProgressPct = Math.max(0, Math.min(100, (runElapsedSec / 60) * 100));

  if (!open) return null;

  const close = () => actions?.onCloseBrandAlignmentModal?.();
  const canRun = !!currentProjectId && !!String(brandAlignmentPrompt || "").trim() && runStatus !== "running";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">Brand Alignment</div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={close}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Prompt */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Brand Alignment Prompt</div>
                {brandAlignmentPromptSaveStatus === "saving" ? (
                  <span className="text-xs text-slate-500">Saving...</span>
                ) : brandAlignmentPromptSaveStatus === "saved" ? (
                  <span className="text-xs text-emerald-600">Saved ✓</span>
                ) : brandAlignmentPromptSaveStatus === "error" ? (
                  <span className="text-xs text-red-600">Save failed</span>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Paste your brand voice + rules here. This is stored <span className="font-semibold">per account</span>.
              </div>
              <textarea
                className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900"
                rows={14}
                value={brandAlignmentPrompt}
                onChange={(e) => actions?.onChangeBrandAlignmentPrompt?.(e.target.value)}
                placeholder="Paste your brand alignment rubric here..."
              />
              {brandAlignmentPromptSaveStatus === "error" && brandAlignmentPromptSaveError ? (
                <div className="mt-2 text-xs text-red-600">❌ {String(brandAlignmentPromptSaveError)}</div>
              ) : null}
              <div className="mt-2 text-[11px] text-slate-500">Auto-saves as you type.</div>
            </div>

            {/* Run section (Phase 1 placeholder) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Check</div>
              <div className="mt-1 text-xs text-slate-600">
                Sends your slides + caption to the LLM and returns structured feedback.
              </div>
              <button
                type="button"
                className={[
                  "mt-3 w-full h-10 rounded-lg text-sm font-semibold shadow-sm transition-colors",
                  canRun ? "bg-black text-white hover:bg-slate-900" : "bg-slate-100 text-slate-500 cursor-not-allowed",
                ].join(" ")}
                disabled={!canRun}
                onClick={() => actions?.onClickRunBrandAlignmentCheck?.()}
                title={
                  !currentProjectId
                    ? "Create or select a project first"
                    : !String(brandAlignmentPrompt || "").trim()
                      ? "Paste your brand alignment prompt first"
                      : runStatus === "running"
                        ? "Running..."
                        : "Run brand alignment check"
                }
              >
                {runStatus === "running" ? `Checking… (${runElapsedSec}s)` : "Run check"}
              </button>

              {runStatus === "running" ? (
                <div className="mt-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-slate-900 transition-[width]"
                      style={{ width: `${runProgressPct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    This can take up to <span className="font-semibold">60 seconds</span>.
                    {runElapsedSec >= 45 ? " Still working…" : null}
                  </div>
                </div>
              ) : null}

              {!currentProjectId ? (
                <div className="mt-2 text-xs text-slate-500">Create or select a project to enable checks.</div>
              ) : !String(brandAlignmentPrompt || "").trim() ? (
                <div className="mt-2 text-xs text-slate-500">Paste your brand rubric on the left to enable checks.</div>
              ) : null}

              {runStatus === "error" && runError ? (
                <div className="mt-3 text-xs text-red-600">❌ {String(runError)}</div>
              ) : null}

              {latestResult ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Result</div>
                    <div className="text-xs font-semibold text-slate-700">
                      {String(latestResult?.verdict || "").toUpperCase()} · {String(latestResult?.overallScore ?? "—")}
                    </div>
                  </div>
                  <div className="mt-2 max-h-[320px] overflow-y-auto pr-1">
                    {latestResult?.summary ? (
                      <div className="text-xs text-slate-700 whitespace-pre-wrap">{String(latestResult.summary)}</div>
                    ) : null}
                    {Array.isArray(latestResult?.issues) && latestResult.issues.length ? (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-slate-700">Top issues</div>
                        <ul className="mt-1 space-y-1">
                          {latestResult.issues.map((it: any, idx: number) => (
                            <li key={idx} className="text-xs text-slate-700">
                              - {String(it?.message || "Issue")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-500">No checks run yet.</div>
              )}

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">History</div>
                  {runsStatus === "loading" ? (
                    <div className="text-xs text-slate-500">Loading…</div>
                  ) : runsStatus === "error" ? (
                    <div className="text-xs text-red-600">Failed</div>
                  ) : null}
                </div>

                {runsStatus === "error" && runsError ? (
                  <div className="mt-2 text-xs text-red-600">❌ {String(runsError)}</div>
                ) : null}

                {runsStatus === "loading" ? (
                  <div className="mt-2 text-xs text-slate-600">Loading past checks…</div>
                ) : runs.length ? (
                  <div className="mt-2 space-y-2">
                    {runs.slice(0, 10).map((r: any) => {
                      const createdAt = r?.createdAt ? new Date(String(r.createdAt)).toLocaleString() : "—";
                      const score = String(r?.overallScore ?? "—");
                      const verdict = String(r?.verdict || "").toUpperCase() || "—";
                      const summary = String(r?.result?.summary || "").trim();
                      return (
                        <div key={String(r?.id || createdAt)} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] text-slate-600">{createdAt}</div>
                            <div className="text-[11px] font-semibold text-slate-700">
                              {verdict} · {score}
                            </div>
                          </div>
                          {summary ? (
                            <div className="mt-1 text-xs text-slate-700 line-clamp-3 whitespace-pre-wrap">{summary}</div>
                          ) : (
                            <div className="mt-1 text-xs text-slate-500">No summary</div>
                          )}
                        </div>
                      );
                    })}
                    {runs.length > 10 ? (
                      <div className="text-[11px] text-slate-500">Showing newest 10 (of {runs.length}).</div>
                    ) : null}
                  </div>
                ) : currentProjectId ? (
                  <div className="mt-2 text-xs text-slate-500">No history yet for this project.</div>
                ) : (
                  <div className="mt-2 text-xs text-slate-500">Select a project to see history.</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50"
              onClick={close}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

