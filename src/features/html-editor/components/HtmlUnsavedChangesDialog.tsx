"use client";

type Mode = "unsaved-navigation" | "restore-session";

export function HtmlUnsavedChangesDialog(props: {
  open: boolean;
  mode: Mode;
  busy?: boolean;
  title?: string;
  description?: string;
  error?: string | null;
  onCancel: () => void;
  onDiscard: () => void;
  onPrimary: () => void;
}) {
  if (!props.open) return null;

  const title =
    props.title ||
    (props.mode === "restore-session" ? "Restore local draft?" : "Unsaved changes");
  const description =
    props.description ||
    (props.mode === "restore-session"
      ? "A local HTML editor draft was found for this project. You can restore those unsaved edits or discard them."
      : "You have unsaved changes in this HTML project. Save them before continuing, or discard them.");
  const primaryLabel = props.mode === "restore-session" ? "Restore draft" : "Save and continue";
  const discardLabel = props.mode === "restore-session" ? "Discard draft" : "Discard";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => !props.busy && props.onCancel()} />
      <div className="relative w-[92vw] max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="text-base font-semibold text-slate-900">{title}</div>
        <div className="mt-2 text-sm leading-6 text-slate-600">{description}</div>
        {props.error ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {props.error}
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={!!props.busy}
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={!!props.busy}
            onClick={props.onDiscard}
          >
            {discardLabel}
          </button>
          <button
            type="button"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={!!props.busy}
            onClick={props.onPrimary}
          >
            {props.busy ? "Working..." : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
