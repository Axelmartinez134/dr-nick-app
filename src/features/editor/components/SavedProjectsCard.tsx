'use client';

export type SavedProjectListItem = {
  id: string;
  title: string;
  template_type_id: string;
  updated_at: string;
};

export function SavedProjectsCard(props: {
  projects: SavedProjectListItem[];
  projectsLoading: boolean;
  switchingSlides: boolean;
  currentProjectId: string | null;
  projectTitle: string;
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
  onLoadProject: (projectId: string) => void;
  archiveBusy: boolean;
  archiveModalOpen: boolean;
  archiveTarget: { id: string; title: string } | null;
  onRequestArchive: (target: { id: string; title: string }) => void;
  onCancelArchive: () => void;
  onConfirmArchive: (target: { id: string; title: string }) => void;
}) {
  const {
    projects,
    projectsLoading,
    switchingSlides,
    currentProjectId,
    projectTitle,
    dropdownOpen,
    onToggleDropdown,
    onLoadProject,
    archiveBusy,
    archiveModalOpen,
    archiveTarget,
    onRequestArchive,
    onCancelArchive,
    onConfirmArchive,
  } = props;

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500 text-white text-sm flex items-center justify-center">💾</span>
            <span className="text-sm font-semibold text-slate-900">Saved Projects</span>
          </div>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{projects.length}</span>
        </div>

        <button
          onClick={onToggleDropdown}
          className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium shadow-sm flex items-center justify-between px-3 hover:bg-slate-50 transition-colors"
          disabled={projectsLoading || switchingSlides}
        >
          <span>
            {projectsLoading ? 'Loading...' : currentProjectId ? projectTitle || 'Untitled Project' : 'Load project…'}
          </span>
          <span className="text-slate-400">{dropdownOpen ? '▴' : '▾'}</span>
        </button>

        {dropdownOpen && (
          <div className="mt-2 w-full bg-white border border-slate-200 rounded-lg shadow-sm max-h-64 overflow-y-auto">
            {projects.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No projects yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {projects.map((p) => (
                  <div key={p.id} className="flex items-stretch">
                    <button
                      className="flex-1 text-left px-3 py-2 hover:bg-slate-50 transition-colors"
                      onClick={() => onLoadProject(p.id)}
                    >
                      <div className="text-sm font-medium text-slate-900 truncate">{p.title}</div>
                      <div className="text-xs text-slate-500 truncate">Type: {p.template_type_id}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Updated: {new Date(p.updated_at).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      type="button"
                      className="w-12 flex items-center justify-center border-l border-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                      title="Archive project"
                      aria-label={`Archive project ${p.title}`}
                      disabled={projectsLoading || switchingSlides || archiveBusy}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRequestArchive({ id: p.id, title: p.title });
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Archive Project Confirmation Modal */}
      {archiveModalOpen && archiveTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (archiveBusy) return;
              onCancelArchive();
            }}
          />
          <div className="relative w-[92vw] max-w-md rounded-xl bg-white border border-slate-200 shadow-xl p-4">
            <div className="text-sm font-semibold text-slate-900">Archive project?</div>
            <div className="mt-1 text-sm text-slate-600">
              This removes it from your Saved Projects list. You can’t load it from the editor once archived.
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-sm font-semibold text-slate-900 truncate">{archiveTarget.title}</div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40"
                disabled={archiveBusy}
                onClick={onCancelArchive}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-9 px-3 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40"
                disabled={archiveBusy}
                onClick={() => onConfirmArchive(archiveTarget)}
              >
                {archiveBusy ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

