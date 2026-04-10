"use client";

import type { AddElementKind } from "../hooks/useHtmlElementSerializer";

const OPTIONS: Array<{ kind: AddElementKind; label: string; description: string }> = [
  { kind: "text", label: "Add Text", description: "Centered editable text span" },
  { kind: "image-slot", label: "Add Image", description: "Main image slot with placeholder" },
  { kind: "logo-slot", label: "Add Logo", description: "Logo slot in the top-left corner" },
];

export function HtmlAddElementBar(props: {
  disabled?: boolean;
  onAddElement: (kind: AddElementKind) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">Add element</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">
        New elements are inserted into the persisted overlay layer and appear live in the active slide.
      </div>
      <div className="mt-3 space-y-2">
        {OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            disabled={!!props.disabled}
            className="flex w-full items-start justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => props.onAddElement(option.kind)}
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">{option.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{option.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
