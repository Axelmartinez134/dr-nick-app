"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";

export function EmphasisAllModal() {
  const open = useEditorSelector((s: any) => !!(s as any).emphasisAllModalOpen);
  const templateTypeId = useEditorSelector((s: any) => (s as any).templateTypeId);
  const currentProjectId = useEditorSelector((s: any) => String((s as any).currentProjectId || "").trim() || null);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const [guidance, setGuidance] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInteract = useMemo(() => !running, [running]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (!canInteract) return;
      actions?.onCloseEmphasisAllModal?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, canInteract, open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  if (!open) return null;

  const disabledBecauseType = templateTypeId !== "regular";
  const disabledBecauseTarget = !currentProjectId;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (!canInteract) return;
        if (e.target === e.currentTarget) actions?.onCloseEmphasisAllModal?.();
      }}
    >
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">Regenerate Emphasis Styles (All Slides)</div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => actions?.onCloseEmphasisAllModal?.()}
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
            <div className="mt-0.5 text-xs text-slate-500">Optional. This will update emphasis styles across all slides that have body text.</div>
            <textarea
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
              rows={6}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder='e.g. Fewer italics overall, bold numbers, underline only the single biggest takeaway...'
              disabled={!canInteract || disabledBecauseType || disabledBecauseTarget}
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            {running ? <span className="text-xs text-slate-500">Updating styles…</span> : null}
            <button
              type="button"
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
              onClick={() => actions?.onCloseEmphasisAllModal?.()}
              disabled={!canInteract}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-50"
              disabled={!canInteract || disabledBecauseType || disabledBecauseTarget}
              onClick={async () => {
                if (!actions?.onRunEmphasisAllRegen) return;
                if (disabledBecauseType || disabledBecauseTarget) return;
                setRunning(true);
                setError(null);
                try {
                  await actions.onRunEmphasisAllRegen({ guidanceText: String(guidance || "").trim() || null });
                  actions?.onCloseEmphasisAllModal?.();
                } catch (e: any) {
                  setError(String(e?.message || e || "Failed to regenerate emphasis styles"));
                } finally {
                  setRunning(false);
                }
              }}
              title="Regenerate emphasis styles (styles only; never rewrites copy)"
            >
              {running ? "Updating…" : "Regenerate Emphasis Styles"}
            </button>
          </div>

          {error ? <div className="mt-2 text-xs text-red-600">❌ {error}</div> : null}

          <div className="mt-4 text-[11px] text-slate-500">
            Note: This updates emphasis styling only and never rewrites your Body copy.
          </div>
        </div>
      </div>
    </div>
  );
}

