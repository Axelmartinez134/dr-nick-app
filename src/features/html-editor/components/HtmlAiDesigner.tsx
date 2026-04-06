"use client";

export function HtmlAiDesigner() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">AI Designer</div>
          <div className="mt-1 text-xs text-slate-500">Future refinement tools will live here.</div>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
          Coming soon
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <button
          type="button"
          disabled
          className="h-10 w-full rounded-lg bg-slate-900/70 text-sm font-semibold text-white opacity-60"
        >
          Restyle selected element
        </button>
        <textarea
          disabled
          value="Describe how you want the selected element refined..."
          className="min-h-[120px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400"
          readOnly
        />
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
          The AI Designer tab is intentionally visible in v1 so the final workspace shape is already established, but no backend
          refinement actions run yet.
        </div>
      </div>
    </div>
  );
}
