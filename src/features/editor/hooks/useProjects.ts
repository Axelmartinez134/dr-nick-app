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

      await projectsApi.archiveProject(fetchJson, pid);
      addLog(`🗄️ Archived project: ${args.titleForUi || pid}`);

      const wasActive = currentProjectIdRef.current === pid;
      let nextProjectId: string | null = null;

      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== pid);
        nextProjectId = remaining[0]?.id || null;
        return remaining;
      });

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
      } else {
        void refreshProjectsList();
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

