"use client";

import type { RefObject } from "react";
import { useEditorSelector } from "@/features/editor/store";

export type PromptsModalProps = {
  promptTextareaRef: RefObject<HTMLTextAreaElement | null>;
  emphasisTextareaRef: RefObject<HTMLTextAreaElement | null>;
  captionRegenTextareaRef: RefObject<HTMLTextAreaElement | null>;
};

export function PromptsModal(props: PromptsModalProps) {
  const { promptTextareaRef, emphasisTextareaRef, captionRegenTextareaRef } = props;

  const open = useEditorSelector((s) => s.promptModalOpen);
  const templateTypeId = useEditorSelector((s) => s.templateTypeId);
  const section = useEditorSelector((s) => s.promptModalSection);

  const templateTypePrompt = useEditorSelector((s) => s.templateTypePrompt);
  const templateTypeEmphasisPrompt = useEditorSelector((s) => s.templateTypeEmphasisPrompt);
  const templateTypeImageGenPrompt = useEditorSelector((s) => s.templateTypeImageGenPrompt);
  const captionRegenPrompt = useEditorSelector((s: any) => String((s as any).captionRegenPrompt || ""));
  const captionRegenPromptSaveStatus = useEditorSelector(
    (s: any) => (String((s as any).captionRegenPromptSaveStatus || "idle") as any) || "idle"
  );
  const captionRegenPromptSaveError = useEditorSelector((s: any) => ((s as any).captionRegenPromptSaveError as any) || null);

  const actions = useEditorSelector((s) => s.actions);

  if (!open) return null;

  const tabs: Array<{ id: "prompt" | "emphasis" | "image" | "caption"; label: string }> = [
    { id: "prompt", label: "Poppy Prompt" },
    { id: "emphasis", label: "Text Styling" },
    ...(templateTypeId === "enhanced" ? ([{ id: "image", label: "Image Prompts" }] as const) : []),
    { id: "caption", label: "Caption Regen" },
  ];
  const activeTab =
    section === "emphasis" || section === "image" || section === "caption"
      ? section
      : "prompt";
  const activeLabel = tabs.find((t) => t.id === activeTab)?.label || "Prompts";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) actions.onClosePromptsModal();
      }}
    >
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">
            {activeLabel} ({templateTypeId === "enhanced" ? "Enhanced" : "Regular"})
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={actions.onClosePromptsModal}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">
          {/* Tab / slider row */}
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
            {tabs.map((t) => {
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={[
                    "h-9 px-3 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors",
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => actions.onOpenPromptModal(t.id)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Active tab content (single prompt at a time) */}
          {activeTab === "prompt" ? (
            <div>
              <div className="text-sm font-semibold text-slate-900">Poppy Prompt</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Used for generating the 6-slide copy for this template type (saved per user).
              </div>
              <textarea
                ref={promptTextareaRef}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                rows={14}
                value={templateTypePrompt}
                onChange={(e) => actions.onChangeTemplateTypePrompt(e.target.value)}
                placeholder="Enter the Poppy prompt for this template type..."
                data-prompt-section="active"
              />
            </div>
          ) : null}

          {activeTab === "emphasis" ? (
            <div>
              <div className="text-sm font-semibold text-slate-900">Text Styling Prompt</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Controls bold/italic/underline for scannability. It never changes characters—only formatting ranges (saved per user).
              </div>
              <textarea
                ref={emphasisTextareaRef}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                rows={14}
                value={templateTypeEmphasisPrompt}
                onChange={(e) => actions.onChangeTemplateTypeEmphasisPrompt(e.target.value)}
                placeholder="Enter the text styling prompt for this template type..."
                data-prompt-section="active"
              />
            </div>
          ) : null}

          {activeTab === "image" ? (
            <div>
              <div className="text-sm font-semibold text-slate-900">Image Generation Prompt</div>
              <div className="mt-0.5 text-xs text-slate-500">
                System prompt sent to Claude for generating per-slide image prompts. Used when "Generate Copy" is clicked (Enhanced only).
              </div>
              <textarea
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                rows={14}
                value={templateTypeImageGenPrompt}
                onChange={(e) => actions.onChangeTemplateTypeImageGenPrompt(e.target.value)}
                placeholder="Enter the image generation prompt for this template type..."
                data-prompt-section="active"
              />
            </div>
          ) : null}

          {activeTab === "caption" ? (
            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-slate-900">Caption Regenerate Prompt</div>
                {captionRegenPromptSaveStatus === "saving" ? (
                  <span className="text-xs text-slate-500">Saving...</span>
                ) : captionRegenPromptSaveStatus === "saved" ? (
                  <span className="text-xs text-emerald-600">Saved ✓</span>
                ) : captionRegenPromptSaveStatus === "error" ? (
                  <span className="text-xs text-red-600">Save failed</span>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Global per-user prompt used when you click <span className="font-semibold">Regenerate</span> in the ✍️ Caption card.
              </div>
              <textarea
                ref={captionRegenTextareaRef}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                rows={16}
                value={captionRegenPrompt}
                onChange={(e) => actions.onChangeCaptionRegenPrompt(e.target.value)}
                placeholder="Enter the caption regeneration prompt..."
                data-prompt-section="active"
              />
              {captionRegenPromptSaveStatus === "error" && captionRegenPromptSaveError ? (
                <div className="mt-2 text-xs text-red-600">❌ {captionRegenPromptSaveError}</div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 text-xs text-slate-500">
            Auto-saves as you type. Press <span className="font-mono">Esc</span> to close.
          </div>
        </div>
      </div>
    </div>
  );
}

