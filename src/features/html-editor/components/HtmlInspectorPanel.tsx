"use client";

import { HtmlAiDesigner } from "./HtmlAiDesigner";
import { HtmlElementEditor } from "./HtmlElementEditor";
import { HtmlElementList } from "./HtmlElementList";
import type { HtmlEditableElement } from "../hooks/useHtmlElementParser";
import type { HtmlElementPatch } from "../hooks/useHtmlElementSerializer";
import type { HtmlDesignPreset } from "../lib/presets";

export function HtmlInspectorPanel(props: {
  selectedElement: HtmlEditableElement | null;
  elements: HtmlEditableElement[];
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  onPatchSelectedElement: (patch: HtmlElementPatch) => void;
  projectTitle: string;
  stage: string;
  selectedPreset: HtmlDesignPreset | null;
  persistedPresetSelected: boolean;
  generationStatus: string;
  presetsCount: number;
  hasUnsavedHtmlChanges: boolean;
}) {
  return (
    <aside className="w-[320px] shrink-0 border-l border-slate-200 bg-white p-4 xl:w-[340px]">
      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <button type="button" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
            Inspector
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400"
            title="AI Designer is intentionally disabled in v1."
          >
            AI Designer
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <HtmlElementEditor element={props.selectedElement} onPatch={props.onPatchSelectedElement} />
          <HtmlElementList
            elements={props.elements}
            selectedElementId={props.selectedElementId}
            onSelect={props.onSelectElement}
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Project status</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div>Project: {props.projectTitle || "Untitled Project"}</div>
              <div>Workflow stage: {props.stage}</div>
              <div>Preset: {props.selectedPreset?.name || (props.persistedPresetSelected ? "Selected" : "Not selected")}</div>
              <div>Generation: {props.generationStatus || "idle"}</div>
              <div>Presets loaded: {props.presetsCount}</div>
              <div>Unsaved changes: {props.hasUnsavedHtmlChanges ? "Yes" : "No"}</div>
            </div>
          </div>

          <HtmlAiDesigner />
        </div>
      </div>
    </aside>
  );
}
