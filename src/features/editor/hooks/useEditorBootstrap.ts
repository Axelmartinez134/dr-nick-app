import { useEffect } from 'react';

type TemplateTypeId = 'regular' | 'enhanced';

type PromptSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useEditorBootstrap(params: {
  userId: string | null;
  templateTypeId: TemplateTypeId;

  // Network + logging
  fetchJson: (path: string, init?: RequestInit) => Promise<any>;
  addLog: (msg: string) => void;

  // Hydration targets
  setTemplates: (templates: any[]) => void;
  setTemplateSnapshots: (updater: (prev: Record<string, any>) => Record<string, any>) => void;
  hydrateProjects: (projects: any[]) => void;

  // Project bootstrap actions
  loadProject: (projectId: string) => Promise<void>;
  createNewProject: (type: TemplateTypeId) => Promise<void>;

  // Template-type effective settings (per-user)
  setTemplateTypePrompt: (v: string) => void;
  setTemplateTypeEmphasisPrompt: (v: string) => void;
  setTemplateTypeImageGenPrompt: (v: string) => void;
  setTemplateTypeMappingSlide1: (v: string | null) => void;
  setTemplateTypeMappingSlide2to5: (v: string | null) => void;
  setTemplateTypeMappingSlide6: (v: string | null) => void;
  promptDirtyRef: { current: boolean };
  setPromptSaveStatus: (s: PromptSaveStatus) => void;

  // Guard refs (must preserve semantics exactly)
  editorBootstrapDoneRef: { current: boolean };
  initialProjectAutoLoadDoneRef: { current: boolean };
  initialTemplateTypeLoadDoneRef: { current: boolean };
  lastLoadedTemplateTypeIdRef: { current: TemplateTypeId | null };

  // Fallback hooks (keep identical)
  loadTemplatesList: () => void | Promise<void>;
  loadTemplateTypeEffective: (templateTypeId: TemplateTypeId) => void | Promise<void>;
  refreshProjectsList: () => void | Promise<void>;
}) {
  const {
    userId,
    templateTypeId,
    fetchJson,
    addLog,
    setTemplates,
    setTemplateSnapshots,
    hydrateProjects,
    loadProject,
    createNewProject,
    setTemplateTypePrompt,
    setTemplateTypeEmphasisPrompt,
    setTemplateTypeImageGenPrompt,
    setTemplateTypeMappingSlide1,
    setTemplateTypeMappingSlide2to5,
    setTemplateTypeMappingSlide6,
    promptDirtyRef,
    setPromptSaveStatus,
    editorBootstrapDoneRef,
    initialProjectAutoLoadDoneRef,
    initialTemplateTypeLoadDoneRef,
    lastLoadedTemplateTypeIdRef,
    loadTemplatesList,
    loadTemplateTypeEffective,
    refreshProjectsList,
  } = params;

  // Initial editor state load (single round trip):
  // - Bootstraps starter template if user has none
  // - Loads templates list, projects list, effective template-type settings
  // - Preloads the 3 mapped template definitions for instant preview rendering
  useEffect(() => {
    if (!userId) return;
    if (editorBootstrapDoneRef.current) return;
    editorBootstrapDoneRef.current = true;
    void (async () => {
      try {
        const data = await fetchJson('/api/editor/initial-state', {
          method: 'POST',
          body: JSON.stringify({ templateTypeId }),
        });
        if (!data?.success) throw new Error(data?.error || 'Failed to load editor state');

        // Hydrate templates + snapshots
        if (Array.isArray(data.templates)) {
          setTemplates(data.templates);
        }
        if (data.templateSnapshotsById && typeof data.templateSnapshotsById === 'object') {
          setTemplateSnapshots((prev) => ({ ...prev, ...(data.templateSnapshotsById as any) }));
        }

        // Hydrate projects list
        if (Array.isArray(data.projects)) {
          const sortedProjects = [...data.projects].sort(
            (a: any, b: any) => Date.parse(String(b?.updated_at || 0)) - Date.parse(String(a?.updated_at || 0))
          );
          hydrateProjects(sortedProjects);
          // Phase 1/2: auto-load most recent project if any, otherwise auto-create an Enhanced project.
          // Guarded so it can't double-run under StrictMode/dev re-renders.
          if (!initialProjectAutoLoadDoneRef.current) {
            initialProjectAutoLoadDoneRef.current = true;
            if (sortedProjects.length > 0) {
              try {
                await loadProject(String(sortedProjects[0]?.id || ''));
              } catch (e: any) {
                addLog(`⚠️ Auto-load most recent project failed: ${String(e?.message || e || 'unknown error')}`);
              }
            } else {
              try {
                await createNewProject('enhanced');
              } catch (e: any) {
                addLog(`⚠️ Auto-create Enhanced project failed: ${String(e?.message || e || 'unknown error')}`);
              }
            }
          }
        }

        // Hydrate effective per-user template-type settings
        const effective = data?.templateType?.effective || null;
        if (effective) {
          setTemplateTypePrompt(String(effective.prompt || ''));
          setTemplateTypeEmphasisPrompt(String(effective.emphasisPrompt || ''));
          setTemplateTypeImageGenPrompt(String(effective.imageGenPrompt || ''));
          setTemplateTypeMappingSlide1(effective.slide1TemplateId ?? null);
          setTemplateTypeMappingSlide2to5(effective.slide2to5TemplateId ?? null);
          setTemplateTypeMappingSlide6(effective.slide6TemplateId ?? null);
          promptDirtyRef.current = false;
          setPromptSaveStatus('idle');
        }

        // Mark template-type as loaded so downstream effects don't refetch on first render.
        initialTemplateTypeLoadDoneRef.current = true;
        lastLoadedTemplateTypeIdRef.current = templateTypeId;

        if (data?.bootstrap?.created) {
          addLog(`🧩 Starter template created for new user`);
        }
      } catch (e: any) {
        addLog(`⚠️ Initial editor load failed: ${String(e?.message || e || 'unknown error')}`);
        // Fallback: best-effort load the two critical things.
        void loadTemplatesList();
        void loadTemplateTypeEffective(templateTypeId);
        void refreshProjectsList();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}

