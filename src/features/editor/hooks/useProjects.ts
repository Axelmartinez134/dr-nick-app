'use client';

import { useCallback, useState } from 'react';
import * as projectsApi from '../services/projectsApi';

export type ProjectListItem = projectsApi.ProjectListItem;

function sortByUpdatedAtDesc(items: ProjectListItem[]): ProjectListItem[] {
  return [...items].sort((a: any, b: any) => Date.parse(String(b?.updated_at || 0)) - Date.parse(String(a?.updated_at || 0)));
}

export function useProjects(params: {
  fetchJson: projectsApi.FetchJson;
  addLog: (message: string) => void;
  currentProjectIdRef: { current: string | null };
  onLoadProject: (projectId: string) => Promise<void>;
  onCreateNewEnhancedProject: () => Promise<void> | void;
}) {
  const { fetchJson, addLog, currentProjectIdRef, onLoadProject, onCreateNewEnhancedProject } = params;

  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);

  const hydrateProjects = useCallback((items: unknown) => {
    const next = Array.isArray(items) ? (items as ProjectListItem[]) : [];
    setProjects(sortByUpdatedAtDesc(next));
  }, []);

  const refreshProjectsList = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const next = await projectsApi.listProjects(fetchJson);
      setProjects(sortByUpdatedAtDesc(next));
    } finally {
      setProjectsLoading(false);
    }
  }, [fetchJson]);

  const archiveProjectById = useCallback(
    async (args: {
      projectId: string;
      titleForUi: string;
      onCloseUi?: () => void;
    }) => {
      const pid = String(args.projectId || '').trim();
      if (!pid) return;

      const wasActive = currentProjectIdRef.current === pid;
      addLog(`🗄️ Archiving project start: ${args.titleForUi || pid} (${pid})`);

      // Do not rely on optimistic UI for this action; verify server state so archived projects
      // never “appear removed” and then come back after refresh/reload.
      await projectsApi.archiveProject(fetchJson, pid);

      const refreshed = await projectsApi.listProjects(fetchJson);
      const sorted = sortByUpdatedAtDesc(refreshed);
      const stillPresent = sorted.some((p) => p.id === pid);
      if (stillPresent) {
        addLog(`❌ Archive verification failed (still present after refresh): ${pid}`);
      } else {
        addLog(`✅ Archived project verified (removed from list): ${pid}`);
      }

      setProjects(sorted);
      const nextProjectId = sorted[0]?.id || null;

      // Close modal/dropdown in the caller.
      try {
        args.onCloseUi?.();
      } catch {
        // ignore
      }

      // If the archived project was active, auto-load the next most recent remaining project.
      if (wasActive) {
        if (nextProjectId) {
          await onLoadProject(nextProjectId);
        } else {
          await onCreateNewEnhancedProject();
        }
      }
    },
    [fetchJson, addLog, currentProjectIdRef, onLoadProject, onCreateNewEnhancedProject, refreshProjectsList]
  );

  return {
    projects,
    projectsLoading,
    hydrateProjects,
    refreshProjectsList,
    archiveProjectById,
  };
}

