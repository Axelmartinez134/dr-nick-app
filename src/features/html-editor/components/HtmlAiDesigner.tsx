"use client";

import { useState } from "react";

export function HtmlAiDesigner(props: {
  enabled: boolean;
  busy: boolean;
  statusLabel: string;
  error: string | null;
  onSubmitPage: (prompt: string) => void;
  onSubmitCarousel: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">AI Designer</div>
          <div className="mt-1 text-xs text-slate-500">Refine the active slide or restyle the full carousel with one prompt.</div>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
          Per-page + Carousel
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe how you want the active slide refined..."
          disabled={!props.enabled || props.busy}
          className="min-h-[120px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
        />
        <button
          type="button"
          disabled={!props.enabled || props.busy || !prompt.trim()}
          onClick={() => props.onSubmitPage(prompt.trim())}
          className="h-10 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {props.busy ? "Refining..." : "Refine this page"}
        </button>
        <button
          type="button"
          disabled={!props.enabled || props.busy || !prompt.trim()}
          onClick={() => props.onSubmitCarousel(prompt.trim())}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {props.busy ? "Restyling..." : "Restyle all slides"}
        </button>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
          {props.enabled
            ? "AI changes apply immediately. Whole-carousel restyle updates each slide as it streams back and leaves failed slides untouched."
            : "AI Designer becomes available once the project reaches the live editing stage."}
        </div>
        {props.statusLabel ? (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-medium text-slate-600">
            {props.statusLabel}
          </div>
        ) : null}
        {props.error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs font-medium text-rose-700">
            {props.error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
