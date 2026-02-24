"use client";

import { useEffect, useMemo, useState } from "react";
import { RichTextInput } from "@/app/editor/RichTextInput";
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

export function BodyEmphasisStylesModal() {
  const open = useEditorSelector((s: any) => !!(s as any).bodyEmphasisModalOpen);
  const templateTypeId = useEditorSelector((s: any) => (s as any).templateTypeId);
  const targetProjectId = useEditorSelector((s: any) =>
    (s as any).bodyEmphasisTargetProjectId ? String((s as any).bodyEmphasisTargetProjectId) : null
  );
  const targetSlideIndex = useEditorSelector((s: any) =>
    Number.isInteger((s as any).bodyEmphasisTargetSlideIndex) ? Number((s as any).bodyEmphasisTargetSlideIndex) : null
  );
  const actions = useEditorSelector((s: any) => (s as any).actions);
  const ui = useEditorSelector((s: any) => (s as any).bottomPanelUi);

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [guidance, setGuidance] = useState("");
  const [generating, setGenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const canInteract = useMemo(() => !generating, [generating]);
  const effectiveSlideNumber = targetSlideIndex !== null ? targetSlideIndex + 1 : null;

  const currentBodyNow = useMemo(() => {
    if (!ui) return "";
    if (!targetProjectId) return "";
    if (targetSlideIndex === null) return "";
    const slides = Array.isArray((ui as any)?.slides) ? ((ui as any).slides as any[]) : [];
    const s = slides[targetSlideIndex] || null;
    return String((s as any)?.draftBody || "");
  }, [targetProjectId, targetSlideIndex, ui]);

  useEffect(() => {
    if (!open) return;
    if (!targetProjectId || targetSlideIndex === null) return;
    if (!actions?.fetchBodyEmphasisAttempts) return;

    let cancelled = false;
    const run = async () => {
      setAttemptsLoading(true);
      setAttemptsError(null);
      try {
        const rows = (await actions.fetchBodyEmphasisAttempts({
          projectId: targetProjectId,
          slideIndex: targetSlideIndex,
          limit: 20,
        })) as Attempt[];
        if (cancelled) return;
        const next = Array.isArray(rows) ? rows : [];
        setAttempts(next);
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
      actions?.onCloseBodyEmphasisModal?.();
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
        if (e.target === e.currentTarget) actions?.onCloseBodyEmphasisModal?.();
      }}
    >
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">
            Regenerate Emphasis Styles{effectiveSlideNumber ? ` (Slide ${effectiveSlideNumber})` : ""}
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => actions?.onCloseBodyEmphasisModal?.()}
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
              Regenerate Emphasis Styles is currently available for <span className="font-semibold">Regular</span> projects only.
            </div>
          ) : null}

          <div className="mt-3">
            <div className="text-sm font-semibold text-slate-900">Feedback for the styling</div>
            <div className="mt-0.5 text-xs text-slate-500">Optional. You can regenerate without adding guidance.</div>
            <textarea
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
              rows={5}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="e.g. More contrast on numbers, emphasize outcomes, fewer italics..."
              disabled={!canInteract || disabledBecauseType || disabledBecauseTarget}
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            {generating ? <span className="text-xs text-slate-500">Updating styles…</span> : null}
            <button
              type="button"
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
              onClick={() => actions?.onCloseBodyEmphasisModal?.()}
              disabled={!canInteract}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-50"
              disabled={!canInteract || disabledBecauseType || disabledBecauseTarget}
              onClick={async () => {
                if (!actions?.onRunBodyEmphasisRegen) return;
                if (disabledBecauseType || disabledBecauseTarget) return;
                setGenerating(true);
                setRegenError(null);
                try {
                  await actions.onRunBodyEmphasisRegen({ guidanceText: String(guidance || "").trim() || null });
                  actions?.onCloseBodyEmphasisModal?.();
                } catch (e: any) {
                  setRegenError(String(e?.message || e || "Emphasis styles regeneration failed"));
                } finally {
                  setGenerating(false);
                }
              }}
              title="Regenerate emphasis styles (styles only; never rewrites copy)"
            >
              {generating ? "Updating…" : "Regenerate Emphasis Styles"}
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
                          <div className="text-xs font-semibold text-slate-700">{formatWhen(a.createdAt) || "Attempt"}</div>
                          {a.guidanceText ? (
                            <div className="mt-1 text-[11px] text-slate-500 truncate">Feedback: {a.guidanceText}</div>
                          ) : (
                            <div className="mt-1 text-[11px] text-slate-400">Feedback: (none)</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="shrink-0 h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                          disabled={!canInteract || disabledBecauseType || disabledBecauseTarget}
                          onClick={async () => {
                            try {
                              const attemptBody = String(a.body || "");
                              if (attemptBody !== String(currentBodyNow || "")) {
                                const ok = window.confirm(
                                  "This slide’s Body text has changed since this attempt. Restoring may not apply perfectly. It’s usually better to click Regenerate Emphasis Styles to restyle the current text. Continue anyway?"
                                );
                                if (!ok) return;
                              }
                              await actions?.onRestoreBodyEmphasisAttempt?.({
                                body: attemptBody,
                                bodyStyleRanges: Array.isArray(a.bodyStyleRanges) ? a.bodyStyleRanges : [],
                              });
                              actions?.onCloseBodyEmphasisModal?.();
                            } catch {
                              // ignore (restore errors show via slide save UI)
                            }
                          }}
                          title="Restore these emphasis styles to the current slide body"
                        >
                          Restore
                        </button>
                      </div>

                      <div className="mt-3">
                        <RichTextInput
                          key={`body-emph-attempt:${a.id}`}
                          valueText={String(a.body || "")}
                          valueRanges={Array.isArray(a.bodyStyleRanges) ? (a.bodyStyleRanges as any) : []}
                          onChange={() => {}}
                          disabled
                          minHeightPx={64}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 shadow-sm"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-4 text-[11px] text-slate-500">
            Tip: This updates emphasis styling only and never rewrites your Body copy.
          </div>
        </div>
      </div>
    </div>
  );
}

