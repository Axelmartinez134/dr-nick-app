"use client";

import { useMemo, useState } from "react";
import type { HtmlDesignPreset } from "../lib/presets";

export function HtmlPresetGallery(props: {
  presets: HtmlDesignPreset[];
  selectedPresetId: string | null;
  onSelect: (presetId: string) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const categories = useMemo(
    () => ["all", ...Array.from(new Set(props.presets.map((preset) => preset.category).filter(Boolean)))],
    [props.presets]
  );
  const filteredPresets = useMemo(
    () => props.presets.filter((preset) => categoryFilter === "all" || preset.category === categoryFilter),
    [categoryFilter, props.presets]
  );

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Preset Gallery</div>
          <div className="mt-1 text-xs text-slate-500">Choose a visual system before generating HTML slides.</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500" htmlFor="html-preset-category">
            Category
          </label>
          <select
            id="html-preset-category"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(String(e.target.value || "all"))}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === "all" ? "All" : category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {filteredPresets.map((preset) => {
          const selected = preset.id === props.selectedPresetId;
          return (
            <button
              key={preset.id}
              type="button"
              className={[
                "rounded-2xl border p-4 text-left transition-colors",
                selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 hover:bg-slate-100",
              ].join(" ")}
              onClick={() => props.onSelect(preset.id)}
            >
              <div
                className="h-32 rounded-xl border border-black/5"
                style={{
                  background: `linear-gradient(135deg, ${preset.styleGuide.backgroundColor}, ${preset.styleGuide.secondaryColor})`,
                }}
              >
                <div className="flex h-full flex-col justify-between p-4">
                  <div
                    className="text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: selected ? "rgba(255,255,255,0.72)" : preset.styleGuide.accentColor }}
                  >
                    {preset.category}
                  </div>
                  <div
                    className="max-w-[70%] text-2xl font-extrabold leading-tight"
                    style={{ color: selected ? "#ffffff" : preset.styleGuide.primaryColor }}
                  >
                    {preset.name}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-sm font-semibold">{preset.name}</div>
              <div className={`mt-1 text-xs leading-5 ${selected ? "text-slate-200" : "text-slate-600"}`}>{preset.description}</div>
              <div className={`mt-3 flex flex-wrap gap-2 text-[11px] ${selected ? "text-slate-200" : "text-slate-500"}`}>
                <span>{preset.aspectRatio}</span>
                {preset.isFeatured ? <span>Featured</span> : null}
                {preset.styleGuide.designPatterns.slice(0, 2).map((pattern) => (
                  <span key={pattern}>{pattern}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
