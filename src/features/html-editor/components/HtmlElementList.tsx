"use client";

import type { HtmlEditableElement } from "../models/htmlElementModel";

function getElementTypeLabel(element: HtmlEditableElement) {
  if (element.type === "block") return "Design";
  if (element.type === "image-slot") return "Image area";
  if (element.type === "image") return "Image";
  return "Text";
}

export function HtmlElementList(props: {
  elements: HtmlEditableElement[];
  selectedElementId: string | null;
  onSelect: (elementId: string) => void;
}) {
  const visibleElements = props.elements.filter((element) => element.listable);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">Element List</div>
      <div className="mt-3 max-h-64 space-y-2 overflow-auto">
        {visibleElements.length === 0 ? <div className="text-sm text-slate-500">No editable elements found for this slide.</div> : null}
        {visibleElements.map((element) => {
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
              <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{getElementTypeLabel(element)}</div>
              <div className="mt-1 text-sm font-semibold">{element.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
