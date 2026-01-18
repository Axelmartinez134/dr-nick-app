import type { ReactNode } from "react";

export type EditorSidebarProps = {
  // Project card
  templateTypeId: "regular" | "enhanced";
  newProjectTemplateTypeId: "regular" | "enhanced";
  switchingSlides: boolean;
  onChangeNewProjectTemplateTypeId: (next: "regular" | "enhanced") => void;
  onClickNewProject: () => void;

  // Saved projects card (already extracted)
  savedProjectsCard: ReactNode;

  // Template card
  onOpenTemplateSettings: () => void;
  onOpenPromptModal: (section: "prompt" | "emphasis" | "image") => void;
  templateTypePromptPreviewLine: string;
  templateTypeEmphasisPromptPreviewLine: string;
  templateTypeImageGenPromptPreviewLine: string;

  // Typography card
  fontOptions: Array<{ label: string; family: string; weight: number }>;
  headlineFontKey: string;
  bodyFontKey: string;
  onChangeHeadlineFontKey: (nextKey: string) => void;
  onChangeBodyFontKey: (nextKey: string) => void;

  // Colors card
  loading: boolean;
  projectBackgroundColor: string;
  projectTextColor: string;
  onChangeBackgroundColor: (next: string) => void;
  onChangeTextColor: (next: string) => void;
};

export function EditorSidebar(props: EditorSidebarProps) {
  const {
    templateTypeId,
    newProjectTemplateTypeId,
    switchingSlides,
    onChangeNewProjectTemplateTypeId,
    onClickNewProject,
    savedProjectsCard,
    onOpenTemplateSettings,
    onOpenPromptModal,
    templateTypePromptPreviewLine,
    templateTypeEmphasisPromptPreviewLine,
    templateTypeImageGenPromptPreviewLine,
    fontOptions,
    headlineFontKey,
    bodyFontKey,
    onChangeHeadlineFontKey,
    onChangeBodyFontKey,
    loading,
    projectBackgroundColor,
    projectTextColor,
    onChangeBackgroundColor,
    onChangeTextColor,
  } = props;

  return (
    <div className="p-4 space-y-4 overflow-auto">
      {/* Project Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white text-sm flex items-center justify-center">➕</span>
          <span className="text-sm font-semibold text-slate-900">Project</span>
        </div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Current project type: <span className="font-semibold uppercase">{templateTypeId}</span>
          </div>
          <div className="text-xs text-slate-600">New project type:</div>
        </div>
        <select
          className="mb-3 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
          value={newProjectTemplateTypeId}
          onChange={(e) => onChangeNewProjectTemplateTypeId(e.target.value === "regular" ? "regular" : "enhanced")}
          disabled={switchingSlides}
          title="Choose the type for the next new project (does not change the current project)"
        >
          <option value="enhanced">Enhanced</option>
          <option value="regular">Regular</option>
        </select>
        <button
          className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-md hover:shadow-lg transition-shadow disabled:opacity-50"
          onClick={onClickNewProject}
          disabled={switchingSlides}
        >
          New Project
        </button>
      </div>

      {/* Saved Projects Card */}
      {savedProjectsCard}

      {/* Template Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm flex items-center justify-center">🎨</span>
            <span className="text-sm font-semibold text-slate-900">Template</span>
          </div>
          <button
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors"
            onClick={onOpenTemplateSettings}
            disabled={switchingSlides}
            title="Edit template type settings"
          >
            Edit Template
          </button>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 hover:bg-slate-50 transition-colors"
            onClick={() => onOpenPromptModal("prompt")}
            title="Edit Poppy Prompt"
          >
            <div className="text-xs font-semibold text-slate-700">Poppy Prompt</div>
            <div className="mt-0.5 text-[11px] text-slate-500 truncate">{templateTypePromptPreviewLine || "Click to edit..."}</div>
          </button>

          <button
            type="button"
            className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 hover:bg-slate-50 transition-colors"
            onClick={() => onOpenPromptModal("emphasis")}
            title="Edit Text Styling Prompt"
          >
            <div className="text-xs font-semibold text-slate-700">Text Styling Prompt</div>
            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
              {templateTypeEmphasisPromptPreviewLine || "Click to edit..."}
            </div>
          </button>

          {templateTypeId === "enhanced" && (
            <button
              type="button"
              className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 hover:bg-slate-50 transition-colors"
              onClick={() => onOpenPromptModal("image")}
              title="Edit Image Generation Prompt"
            >
              <div className="text-xs font-semibold text-slate-700">Image Generation Prompt</div>
              <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                {templateTypeImageGenPromptPreviewLine || "Click to edit..."}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Typography Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-slate-700 text-white text-xs font-bold flex items-center justify-center">Aa</span>
          <span className="text-sm font-semibold text-slate-900">Typography (Global)</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Headline Font</div>
            <select
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
              value={headlineFontKey}
              onChange={(e) => onChangeHeadlineFontKey(e.target.value || "")}
            >
              {fontOptions.map((o) => (
                <option key={`${o.family}@@${o.weight}`} value={`${o.family}@@${o.weight}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Body Font</div>
            <select
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
              value={bodyFontKey}
              onChange={(e) => onChangeBodyFontKey(e.target.value || "")}
            >
              {fontOptions.map((o) => (
                <option key={`${o.family}@@${o.weight}`} value={`${o.family}@@${o.weight}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Colors Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 text-white text-sm flex items-center justify-center">🖌️</span>
          <span className="text-sm font-semibold text-slate-900">Colors</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Background</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                value={projectBackgroundColor || "#ffffff"}
                onChange={(e) => onChangeBackgroundColor(e.target.value)}
                disabled={loading || switchingSlides}
                aria-label="Background color"
              />
              <div className="text-xs text-slate-600 tabular-nums">{projectBackgroundColor || "#ffffff"}</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Text</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                value={projectTextColor || "#000000"}
                onChange={(e) => onChangeTextColor(e.target.value)}
                disabled={loading || switchingSlides}
                aria-label="Text color"
              />
              <div className="text-xs text-slate-600 tabular-nums">{projectTextColor || "#000000"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

