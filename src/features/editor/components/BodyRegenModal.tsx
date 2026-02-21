"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";

type Attempt = {
  id: string;
  createdAt: string | null;
  guidanceText: string | null;
  body: string;
  bodyStyleRanges: any[];
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
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [guidance, setGuidance] = useState("");
  const [generating, setGenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const canInteract = useMemo(() => !generating, [generating]);
  const effectiveSlideNumber = targetSlideIndex !== null ? targetSlideIndex + 1 : null;

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
        // Prefill guidance with last-used guidance (per project+slide) when available.
        const last = next[0]?.guidanceText;
        setGuidance(String(last || ""));
      } catch (e: any) {
        if (cancelled) return;
        setAttemptsError(String(e?.message || e || "Failed to load attempts"));
        setAttempts([]);
        setGuidance("");
      } finally {
        if (!cancelled) setAttemptsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [actions, open, targetProjectId, targetSlideIndex]);

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
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-slate-200">
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

          <div className="mt-3">
            <div className="text-sm font-semibold text-slate-900">How would you like to change it?</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Optional. You can regenerate without adding guidance.
            </div>
            <textarea
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
              rows={5}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="e.g. Make it shorter, add more contrast, make it more tactical..."
              disabled={!canInteract || disabledBecauseType || disabledBecauseTarget}
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            {generating ? <span className="text-xs text-slate-500">Regenerating…</span> : null}
            <button
              type="button"
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
              onClick={() => actions?.onCloseBodyRegenModal?.()}
              disabled={!canInteract}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-50"
              disabled={!canInteract || disabledBecauseType || disabledBecauseTarget}
              onClick={async () => {
                if (!actions?.onRunBodyRegen) return;
                if (disabledBecauseType || disabledBecauseTarget) return;
                setGenerating(true);
                setRegenError(null);
                try {
                  await actions.onRunBodyRegen({ guidanceText: String(guidance || "").trim() || null });
                  // Close on success (less confusing; body is now updated on the slide).
                  actions?.onCloseBodyRegenModal?.();
                } catch (e: any) {
                  setRegenError(String(e?.message || e || "Body regeneration failed"));
                } finally {
                  setGenerating(false);
                }
              }}
              title="Regenerate body with Claude"
            >
              {generating ? "Regenerating…" : "Regenerate"}
            </button>
          </div>

          {regenError ? <div className="mt-2 text-xs text-red-600">❌ {regenError}</div> : null}

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
                {attemptsLoading ? "Loading…" : `${attempts.length}`}
                <span className="ml-2">{expanded ? "▲" : "▼"}</span>
              </span>
            </button>

            {attemptsError ? <div className="mt-2 text-xs text-red-600">❌ {attemptsError}</div> : null}

            {expanded ? (
              <div className="mt-3 space-y-3">
                {attempts.length === 0 ? (
                  <div className="text-xs text-slate-500">No attempts yet.</div>
                ) : (
                  attempts.map((a) => (
                    <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-700">
                            {formatWhen(a.createdAt) || "Attempt"}
                          </div>
                          {a.guidanceText ? (
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

