"use client";

import { useMemo } from "react";

export function AdvancedLayoutControls(props: {
  open: boolean;
  onToggle: () => void;
  canGenerate: boolean;
  onGenerate: () => void;
  realignmentModel: string;
  onChangeModel: (next: string) => void;
  disableModelSelect: boolean;
}) {
  const modelLabel = useMemo(() => {
    const v = String(props.realignmentModel || "");
    if (v === "gemini-computational") return "Gemini Computational";
    if (v === "gemini") return "Gemini 3 Vision";
    if (v === "claude") return "Claude Vision";
    return v || "Model";
  }, [props.realignmentModel]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-semibold text-slate-800"
        onClick={props.onToggle}
        aria-expanded={props.open}
      >
        <span>Advanced</span>
        <span className="text-xs font-medium text-slate-500">
          {props.open ? "Hide" : `Show (${modelLabel})`}
        </span>
      </button>
      {props.open ? (
        <div className="px-3 pb-3 space-y-2">
          <button
            className="w-full h-10 rounded-lg bg-[#6D28D9] text-white text-sm font-semibold shadow-sm disabled:opacity-50"
            disabled={!props.canGenerate}
            onClick={props.onGenerate}
            title="Force a full deterministic layout pass for the active slide"
          >
            Generate Layout (Advanced)
          </button>

          <select
            className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3 disabled:opacity-50"
            value={props.realignmentModel}
            onChange={(e) => props.onChangeModel(e.target.value)}
            disabled={props.disableModelSelect}
            title="Choose the Realign engine (computational is fastest; vision can be slower)"
          >
            <option value="gemini-computational">Gemini Computational</option>
            <option value="gemini">Gemini 3 Vision</option>
            <option value="claude">Claude Vision</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}

