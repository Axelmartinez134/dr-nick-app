"use client";

import { HtmlPresetGallery } from "./HtmlPresetGallery";
import { HtmlSlidesStrip } from "./HtmlSlidesStrip";
import type { HtmlDesignPreset } from "../lib/presets";

type WorkflowStage = "generate-copy" | "choose-preset" | "generate-slides" | "editing";

export function HtmlEditorWorkspace(props: {
  stage: WorkflowStage;
  activeSlideIndex: number;
  htmlSlides: Array<{ id: string; slideIndex: number; html: string | null; pageTitle: string | null; pageType: string | null }>;
  copySlides: any[];
  selectedElementId: string | null;
  onSelectEditableId: (editableId: string) => void;
  onSelectSlide: (slideIndex: number) => void;
  placeholderTitle: string;
  placeholderDescription: string;
  hasCopy: boolean;
  hasGeneratedSlides: boolean;
  presets: HtmlDesignPreset[];
  selectedPresetId: string | null;
  onSelectPreset: (presetId: string) => void;
}) {
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
            stage={props.stage}
            activeSlideIndex={props.activeSlideIndex}
            htmlSlides={props.htmlSlides}
            copySlides={props.copySlides}
            selectedElementId={props.selectedElementId}
            onSelectEditableId={props.onSelectEditableId}
            onSelectSlide={props.onSelectSlide}
            placeholderTitle={props.placeholderTitle}
            placeholderDescription={props.placeholderDescription}
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
}
