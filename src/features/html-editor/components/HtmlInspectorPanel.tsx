"use client";

import { useState } from "react";
import { HtmlAiDesigner } from "./HtmlAiDesigner";
import { HtmlInspectorAccordion } from "./HtmlInspectorAccordion";
import type { HtmlEditableElement, HtmlElementPatch } from "../models/htmlElementModel";
import type { AddElementKind } from "../hooks/useHtmlElementSerializer";

export function HtmlInspectorPanel(props: {
  selectedElement: HtmlEditableElement | null;
  elements: HtmlEditableElement[];
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  onDeselectElement: () => void;
  onPatchSelectedElement: (patch: HtmlElementPatch) => void;
  stage: string;
  onAddElement: (kind: AddElementKind) => void;
  onDuplicateElement: (elementId: string) => void;
  onDeleteElement: (elementId: string) => void;
  onClearRichText: (elementId: string, plainText: string) => void;
  onApplyFontToAllPages: (fontFamily: string) => void;
  totalPages: number;
  onRefinePage: (prompt: string) => void;
  onRefineCarousel: (prompt: string) => void;
  aiBusy: boolean;
  aiStatusLabel: string;
  aiError: string | null;
}) {
  const [activeTab, setActiveTab] = useState<"inspector" | "ai">("inspector");

  return (
    <aside className="h-full w-full bg-white p-4">
      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => setActiveTab("inspector")}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-semibold",
              activeTab === "inspector" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600",
            ].join(" ")}
          >
            Inspector
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-semibold",
              activeTab === "ai" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600",
            ].join(" ")}
          >
            AI Designer
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {activeTab === "inspector" ? (
            <>
              {props.stage === "editing" ? (
                <HtmlInspectorAccordion
                  elements={props.elements}
                  selectedElementId={props.selectedElementId}
                  onSelectElement={props.onSelectElement}
                  onDeselectElement={props.onDeselectElement}
                  onPatchSelectedElement={props.onPatchSelectedElement}
                  onAddElement={props.onAddElement}
                  onDuplicateElement={props.onDuplicateElement}
                  onDeleteElement={props.onDeleteElement}
                  onClearRichText={props.onClearRichText}
                  onApplyFontToAllPages={props.onApplyFontToAllPages}
                  totalPages={props.totalPages}
                />
              ) : null}

            </>
          ) : (
            <HtmlAiDesigner
              enabled={props.stage === "editing"}
              busy={props.aiBusy}
              statusLabel={props.aiStatusLabel}
              error={props.aiError}
              onSubmitPage={props.onRefinePage}
              onSubmitCarousel={props.onRefineCarousel}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
