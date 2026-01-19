/* eslint-disable react/no-unstable-nested-components */
"use client";

import { useEditorSelector } from "@/features/editor/store";

export function EditorTopBar() {
  const titleText = useEditorSelector((s) => s.titleText);
  const projectTitleValue = useEditorSelector((s) => s.projectTitle);
  const projectTitleDisabled = useEditorSelector((s) => s.projectTitleDisabled);
  const isMobile = useEditorSelector((s) => s.isMobile);
  const topExporting = useEditorSelector((s) => s.topExporting);

  const promptSaveStatus = useEditorSelector((s) => s.promptSaveStatus);
  const projectSaveStatus = useEditorSelector((s) => s.projectSaveStatus);
  const slideSaveStatus = useEditorSelector((s) => s.slideSaveStatus);
  const actions = useEditorSelector((s) => s.actions);

  const PromptStatusPill = () => {
    if (promptSaveStatus === "idle") return null;
    const base = "px-3 py-1 rounded-full text-xs font-semibold border";
    if (promptSaveStatus === "saving") {
      return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Poppy Prompt: Saving…</span>;
    }
    if (promptSaveStatus === "saved") {
      return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Poppy Prompt: Saved ✓</span>;
    }
    return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Poppy Prompt: Save Failed</span>;
  };

  const ProjectStatusPill = () => {
    if (projectSaveStatus === "idle" && slideSaveStatus === "idle") return null;
    const base = "px-3 py-1 rounded-full text-xs font-semibold border";
    const status =
      projectSaveStatus === "saving" || slideSaveStatus === "saving"
        ? "saving"
        : projectSaveStatus === "error" || slideSaveStatus === "error"
          ? "error"
          : projectSaveStatus === "saved" || slideSaveStatus === "saved"
            ? "saved"
            : "idle";
    if (status === "saving") return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Saving…</span>;
    if (status === "saved") return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Saved ✓</span>;
    if (status === "error") return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Save Failed</span>;
    return null;
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white select-none">
          🎠
        </div>
        <div className="text-sm font-semibold text-slate-900">{titleText}</div>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <input
          className="h-9 w-[320px] max-w-[40vw] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
          value={projectTitleValue}
          onChange={(e) => actions.onChangeProjectTitle(e.target.value)}
          placeholder="Untitled Project"
          disabled={projectTitleDisabled}
          title="Project title"
        />
        <ProjectStatusPill />
        <PromptStatusPill />
        {!isMobile ? (
          <button
            className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
            onClick={actions.onDownloadAll}
            disabled={topExporting}
            title="Download all 6 slides as a ZIP"
          >
            {topExporting ? "Preparing..." : "Download All"}
          </button>
        ) : (
          <button
            className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
            onClick={actions.onShareAll}
            disabled={topExporting}
            title="Download all slides (saves to Photos when supported)"
          >
            {topExporting ? "Preparing..." : "Download All"}
          </button>
        )}
        <button
          onClick={actions.onSignOut}
          className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm transition-colors"
          title="Sign out"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}

