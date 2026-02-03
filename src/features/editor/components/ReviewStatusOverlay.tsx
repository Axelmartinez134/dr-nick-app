"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";

function IosToggle(props: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const { label, value, disabled, onChange } = props;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] font-semibold text-slate-700">{label}</div>
      <button
        type="button"
        className={["h-7 w-12 rounded-full transition-colors", value ? "bg-black" : "bg-slate-300", disabled ? "opacity-60" : ""].join(
          " "
        )}
        onClick={() => onChange(!value)}
        disabled={disabled}
        aria-label={label}
        title={label}
      >
        <span
          className={[
            "block h-6 w-6 rounded-full bg-white shadow-sm translate-x-0 transition-transform",
            value ? "translate-x-5" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function ReviewStatusOverlay(props: { projectId: string | null }) {
  const { projectId } = props;
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const ready = useEditorSelector((s: any) => !!(s as any).reviewReady);
  const posted = useEditorSelector((s: any) => !!(s as any).reviewPosted);
  const approved = useEditorSelector((s: any) => !!(s as any).reviewApproved);
  const scheduled = useEditorSelector((s: any) => !!(s as any).reviewScheduled);
  const reviewSource = useEditorSelector((s: any) => String((s as any).reviewSource || ""));
  const savingIds = useEditorSelector((s: any) => (s as any).shareCarouselsSavingIds as Set<string>);

  const pid = useMemo(() => (projectId ? String(projectId) : ""), [projectId]);
  const busy = !!pid && !!savingIds?.has?.(pid);

  const [draft, setDraft] = useState<string>(() => reviewSource);
  const timerRef = useRef<number | null>(null);
  const dirtyRef = useRef<boolean>(false);

  useEffect(() => {
    // New project loaded.
    dirtyRef.current = false;
    setDraft(reviewSource);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Keep in sync unless user is mid-edit.
    if (dirtyRef.current) return;
    setDraft(reviewSource);
  }, [reviewSource]);

  const saveNow = useCallback(
    async (nextText: string) => {
      if (!pid) return;
      try {
        const ok = await actions.onChangeProjectReviewSource?.({ projectId: pid, next: nextText });
        if (ok === false) throw new Error("Save failed");
        dirtyRef.current = false;
      } catch {
        // ignore; we only show the global "Saving..." state like the rest of the Review block
      }
    },
    [actions, pid]
  );

  const onChangeDraft = useCallback(
    (next: string) => {
      dirtyRef.current = true;
      setDraft(next);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void saveNow(next), 600);
    },
    [saveNow]
  );

  const onBlur = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    void saveNow(draft);
  }, [draft, saveNow]);

  if (!isSuperadmin || !pid) return null;

  return (
    <div className="absolute left-[5px] top-[5px] z-[50] flex items-start gap-3">
      <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-3 py-2 shadow-lg w-[160px]">
          <div className="text-[11px] font-semibold text-slate-900 mb-2">Review</div>
          <div className="space-y-1.5">
            <IosToggle
              label="Ready"
              value={ready}
              disabled={busy}
              onChange={(next) => actions.onToggleProjectReviewReady?.({ projectId: pid, next })}
            />
            <IosToggle
              label="Posted"
              value={posted}
              disabled={busy}
              onChange={(next) => actions.onToggleProjectReviewPosted?.({ projectId: pid, next })}
            />
            <IosToggle
              label="Approved"
              value={approved}
              disabled={busy}
              onChange={(next) => actions.onToggleProjectReviewApproved?.({ projectId: pid, next })}
            />
            <IosToggle
              label="Scheduled"
              value={scheduled}
              disabled={busy}
              onChange={(next) => actions.onToggleProjectReviewScheduled?.({ projectId: pid, next })}
            />
          </div>
          {busy ? <div className="mt-2 text-[11px] text-slate-500">Saving…</div> : null}
      </div>

      <input
        className="h-9 w-[360px] rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-3 text-[12px] text-slate-900 shadow-lg"
        placeholder="Source material…"
        value={draft}
        onChange={(e) => onChangeDraft(e.target.value)}
        onBlur={onBlur}
        spellCheck={false}
      />
    </div>
  );
}

