'use client';

import { useCallback, useRef } from 'react';

export type ProjectSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useEditorPersistence(params: {
  fetchJson: (path: string, init?: RequestInit) => Promise<any>;

  // Identity
  currentProjectId: string | null;

  // UI state
  setProjectSaveStatus: (s: ProjectSaveStatus) => void;

  // Shared debounce timer used by both title and caption
  projectSaveTimeoutRef: { current: number | null };
}) {
  const { fetchJson, currentProjectId, setProjectSaveStatus, projectSaveTimeoutRef } = params;

  // Keep track of the most recent "idle reset" timers so new saves don't race old timeouts.
  const idleResetRef = useRef<number | null>(null);

  const clearIdleReset = useCallback(() => {
    if (idleResetRef.current) window.clearTimeout(idleResetRef.current);
    idleResetRef.current = null;
  }, []);

  const saveProjectMetaForProject = useCallback(
    async (projectId: string, patch: { title?: string; caption?: string | null; outreachMessage?: string | null }) => {
      const pid = String(projectId || '').trim();
      if (!pid) return;
      clearIdleReset();
      setProjectSaveStatus('saving');
      try {
        await fetchJson('/api/editor/projects/update', {
          method: 'POST',
          body: JSON.stringify({ projectId: pid, ...patch }),
        });
        setProjectSaveStatus('saved');
        idleResetRef.current = window.setTimeout(() => setProjectSaveStatus('idle'), 1200);
      } catch {
        setProjectSaveStatus('error');
        idleResetRef.current = window.setTimeout(() => setProjectSaveStatus('idle'), 2000);
      }
    },
    [clearIdleReset, fetchJson, setProjectSaveStatus]
  );

  const saveProjectMeta = useCallback(
    async (patch: { title?: string; caption?: string | null; outreachMessage?: string | null }) => {
      if (!currentProjectId) return;
      await saveProjectMetaForProject(currentProjectId, patch);
    },
    [currentProjectId, saveProjectMetaForProject]
  );

  const scheduleDebouncedProjectTitleSave = useCallback(
    (args: { projectId: string | null; title: string; debounceMs: number }) => {
      if (projectSaveTimeoutRef.current) window.clearTimeout(projectSaveTimeoutRef.current);
      const projectIdAtSchedule = args.projectId;
      const titleAtSchedule = args.title;
      projectSaveTimeoutRef.current = window.setTimeout(() => {
        if (!projectIdAtSchedule) return;
        void saveProjectMetaForProject(projectIdAtSchedule, { title: titleAtSchedule });
      }, args.debounceMs);
    },
    [projectSaveTimeoutRef, saveProjectMetaForProject]
  );

  const scheduleDebouncedCaptionSave = useCallback(
    (args: { projectId: string | null; caption: string; debounceMs: number }) => {
      if (projectSaveTimeoutRef.current) window.clearTimeout(projectSaveTimeoutRef.current);
      const projectIdAtSchedule = args.projectId;
      const captionAtSchedule = args.caption;
      projectSaveTimeoutRef.current = window.setTimeout(() => {
        if (!projectIdAtSchedule) return;
        void saveProjectMetaForProject(projectIdAtSchedule, { caption: captionAtSchedule });
      }, args.debounceMs);
    },
    [projectSaveTimeoutRef, saveProjectMetaForProject]
  );

  const scheduleDebouncedOutreachMessageSave = useCallback(
    (args: { projectId: string | null; outreachMessage: string; debounceMs: number }) => {
      if (projectSaveTimeoutRef.current) window.clearTimeout(projectSaveTimeoutRef.current);
      const projectIdAtSchedule = args.projectId;
      const msgAtSchedule = args.outreachMessage;
      projectSaveTimeoutRef.current = window.setTimeout(() => {
        if (!projectIdAtSchedule) return;
        void saveProjectMetaForProject(projectIdAtSchedule, { outreachMessage: msgAtSchedule });
      }, args.debounceMs);
    },
    [projectSaveTimeoutRef, saveProjectMetaForProject]
  );

  return {
    saveProjectMeta,
    saveProjectMetaForProject,
    scheduleDebouncedProjectTitleSave,
    scheduleDebouncedCaptionSave,
    scheduleDebouncedOutreachMessageSave,
  };
}

