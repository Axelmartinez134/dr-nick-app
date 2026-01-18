import type { RefObject } from "react";

export type PromptsModalProps = {
  open: boolean;
  templateTypeId: "regular" | "enhanced";
  section: "prompt" | "emphasis" | "image";

  templateTypePrompt: string;
  templateTypeEmphasisPrompt: string;
  templateTypeImageGenPrompt: string;

  onChangeTemplateTypePrompt: (next: string) => void;
  onChangeTemplateTypeEmphasisPrompt: (next: string) => void;
  onChangeTemplateTypeImageGenPrompt: (next: string) => void;

  promptTextareaRef: RefObject<HTMLTextAreaElement | null>;
  emphasisTextareaRef: RefObject<HTMLTextAreaElement | null>;

  onClose: () => void;
};

export function PromptsModal(props: PromptsModalProps) {
  const {
    open,
    templateTypeId,
    section,
    templateTypePrompt,
    templateTypeEmphasisPrompt,
    templateTypeImageGenPrompt,
    onChangeTemplateTypePrompt,
    onChangeTemplateTypeEmphasisPrompt,
    onChangeTemplateTypeImageGenPrompt,
    promptTextareaRef,
    emphasisTextareaRef,
    onClose,
  } = props;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">
            Prompts ({templateTypeId === "enhanced" ? "Enhanced" : "Regular"})
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Poppy Prompt</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Used for generating the 6-slide copy for this template type (saved per user).
              </div>
              <textarea
                ref={promptTextareaRef}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                rows={10}
                value={templateTypePrompt}
                onChange={(e) => onChangeTemplateTypePrompt(e.target.value)}
                placeholder="Enter the Poppy prompt for this template type..."
                data-prompt-section={section === "prompt" ? "active" : "inactive"}
              />
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900">Text Styling Prompt</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Controls bold/italic/underline for scannability. It never changes characters—only formatting ranges (saved per user).
              </div>
              <textarea
                ref={emphasisTextareaRef}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                rows={10}
                value={templateTypeEmphasisPrompt}
                onChange={(e) => onChangeTemplateTypeEmphasisPrompt(e.target.value)}
                placeholder="Enter the text styling prompt for this template type..."
                data-prompt-section={section === "emphasis" ? "active" : "inactive"}
              />
            </div>

            {templateTypeId === "enhanced" && (
              <div>
                <div className="text-sm font-semibold text-slate-900">Image Generation Prompt</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  System prompt sent to Claude for generating per-slide image prompts. Used when "Generate Copy" is clicked (Enhanced only).
                </div>
                <textarea
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                  rows={10}
                  value={templateTypeImageGenPrompt}
                  onChange={(e) => onChangeTemplateTypeImageGenPrompt(e.target.value)}
                  placeholder="Enter the image generation prompt for this template type..."
                  data-prompt-section={section === "image" ? "active" : "inactive"}
                />
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Auto-saves as you type. Press <span className="font-mono">Esc</span> to close.
          </div>
        </div>
      </div>
    </div>
  );
}

