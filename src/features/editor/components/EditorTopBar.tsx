import type { ReactNode } from "react";

export type EditorTopBarProps = {
  titleText: string;
  projectTitleValue: string;
  projectTitlePlaceholder: string;
  projectTitleDisabled: boolean;
  onChangeProjectTitle: (next: string) => void;

  projectStatusPill?: ReactNode;
  promptStatusPill?: ReactNode;

  isMobile: boolean;
  topExporting: boolean;
  onDownloadAll: () => void;
  onShareAll: () => void;

  onSignOut: () => void;
};

export function EditorTopBar(props: EditorTopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white select-none">
          🎠
        </div>
        <div className="text-sm font-semibold text-slate-900">{props.titleText}</div>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <input
          className="h-9 w-[320px] max-w-[40vw] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
          value={props.projectTitleValue}
          onChange={(e) => props.onChangeProjectTitle(e.target.value)}
          placeholder={props.projectTitlePlaceholder}
          disabled={props.projectTitleDisabled}
          title="Project title"
        />
        {props.projectStatusPill}
        {props.promptStatusPill}
        {!props.isMobile ? (
          <button
            className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
            onClick={props.onDownloadAll}
            disabled={props.topExporting}
            title="Download all 6 slides as a ZIP"
          >
            {props.topExporting ? "Preparing..." : "Download All"}
          </button>
        ) : (
          <button
            className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
            onClick={props.onShareAll}
            disabled={props.topExporting}
            title="Download all slides (saves to Photos when supported)"
          >
            {props.topExporting ? "Preparing..." : "Download All"}
          </button>
        )}
        <button
          onClick={props.onSignOut}
          className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm transition-colors"
          title="Sign out"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}

