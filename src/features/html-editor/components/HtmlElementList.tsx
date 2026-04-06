"use client";

import type { HtmlEditableElement } from "../hooks/useHtmlElementParser";

export function HtmlElementList(props: {
  elements: HtmlEditableElement[];
  selectedElementId: string | null;
  onSelect: (elementId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">Element List</div>
      <div className="mt-3 max-h-64 space-y-2 overflow-auto">
        {props.elements.length === 0 ? <div className="text-sm text-slate-500">No editable elements found for this slide.</div> : null}
        {props.elements.map((element) => {
          const active = element.id === props.selectedElementId;
          return (
            <button
              key={element.id}
              type="button"
              className={[
                "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-100",
              ].join(" ")}
              onClick={() => props.onSelect(element.id)}
            >
              <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{element.type}</div>
              <div className="mt-1 text-sm font-semibold">{element.label}</div>
              <div className={`mt-1 truncate text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>{element.id}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
