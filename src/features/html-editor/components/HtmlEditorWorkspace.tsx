"use client";

import { forwardRef } from "react";
import { HtmlPresetGallery } from "./HtmlPresetGallery";
import { HtmlSlidesStrip } from "./HtmlSlidesStrip";
import type { HtmlSlidePreviewHandle } from "./HtmlSlidePreview";
import type { HtmlEditableElement, HtmlElementPatch } from "../models/htmlElementModel";
import type { HtmlDesignPreset } from "../lib/presets";

type WorkflowStage = "generate-copy" | "choose-preset" | "generate-slides" | "editing";

export type HtmlSlideRestyleStatus = {
  state: "idle" | "queued" | "refining" | "applied" | "error";
  label: string;
  error?: string | null;
};

type Props = {
  stage: WorkflowStage;
  documentKeyBase?: string | null;
  activeSlideIndex: number;
  htmlSlides: Array<{ id: string; slideIndex: number; html: string | null; pageTitle: string | null; pageType: string | null }>;
  slideElements: HtmlEditableElement[][];
  copySlides: any[];
  selectedElementId: string | null;
  onSelectEditableId: (editableId: string, slideIndex: number) => void;
  onDeselectAll?: () => void;
  onTextCommit?: (editableId: string, text: string, html: string, slideIndex: number) => void;
  onTransform?: (editableId: string, patch: HtmlElementPatch, slideIndex: number) => void;
  onRequestUndo?: () => void;
  onRequestRedo?: () => void;
  onRequestSave?: () => void;
  onRequestDeleteSelected?: () => void;
  onSelectSlide: (slideIndex: number) => void;
  placeholderTitle: string;
  placeholderDescription: string;
  hasCopy: boolean;
  hasGeneratedSlides: boolean;
  slideRestyleStatuses: Record<number, HtmlSlideRestyleStatus>;
  presets: HtmlDesignPreset[];
  selectedPresetId: string | null;
  onSelectPreset: (presetId: string) => void;
};

export const HtmlEditorWorkspace = forwardRef<HtmlSlidePreviewHandle, Props>(function HtmlEditorWorkspace(props, ref) {
  return (
    <main
      className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
      style={{
        backgroundColor: "#EEF0F3",
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(16, 24, 40, 0.16) 1px, transparent 0)",
        backgroundSize: "14px 14px",
      }}
    >
      <div className="p-6">
        <div className="mx-auto w-full max-w-[1480px]">
          <HtmlSlidesStrip
            ref={ref}
            stage={props.stage}
            documentKeyBase={props.documentKeyBase}
            activeSlideIndex={props.activeSlideIndex}
            htmlSlides={props.htmlSlides}
            slideElements={props.slideElements}
            copySlides={props.copySlides}
            selectedElementId={props.selectedElementId}
            onSelectEditableId={props.onSelectEditableId}
            onDeselectAll={props.onDeselectAll}
            onTextCommit={props.onTextCommit}
            onTransform={props.onTransform}
            onRequestUndo={props.onRequestUndo}
            onRequestRedo={props.onRequestRedo}
            onRequestSave={props.onRequestSave}
            onRequestDeleteSelected={props.onRequestDeleteSelected}
            onSelectSlide={props.onSelectSlide}
            placeholderTitle={props.placeholderTitle}
            placeholderDescription={props.placeholderDescription}
            slideRestyleStatuses={props.slideRestyleStatuses}
          />

          {!props.hasGeneratedSlides && props.hasCopy ? (
            <div className="mt-2 px-16 pb-2">
              <HtmlPresetGallery
                presets={props.presets}
                selectedPresetId={props.selectedPresetId}
                onSelect={props.onSelectPreset}
              />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
});
