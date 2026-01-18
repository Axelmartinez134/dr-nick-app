'use client';

import { useCallback, useRef } from 'react';
import * as slidesApi from '../services/slidesApi';

export type SaveUiStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useSlidePersistence(params: {
  fetchJson: slidesApi.FetchJson;
  addLog: (message: string) => void;
  setSlideSaveStatus: (s: SaveUiStatus) => void;
  currentProjectIdRef: { current: string | null };
}) {
  const { fetchJson, addLog, setSlideSaveStatus, currentProjectIdRef } = params;

  // Mirrors EditorShell's existing per-feature debouncers (keep timings at call sites).
  const slideTextSaveTimeoutRef = useRef<number | null>(null);
  const slideTextSavePendingRef = useRef(false);
  const layoutPersistTimeoutRef = useRef<number | null>(null);
  const layoutPersistPendingRef = useRef(false);
  const aiPromptSaveTimeoutRef = useRef<number | null>(null);
  const aiPromptSavePendingRef = useRef(false);
  const rteNoReflowSaveTimeoutRef = useRef<number | null>(null);
  const rteNoReflowSavePendingRef = useRef(false);

  const saveSlidePatchForProject = useCallback(
    async (
      projectId: string,
      slideIndex: number,
      patch: {
        headline?: string | null;
        body?: string | null;
        layoutSnapshot?: any | null;
        inputSnapshot?: any | null;
      }
    ): Promise<boolean> => {
      const pid = String(projectId || '').trim();
      if (!pid) return false;
      setSlideSaveStatus('saving');
      try {
        addLog(
          `🧩 Persist slide ${slideIndex + 1}: ${Object.keys(patch)
            .filter((k) => (patch as any)[k] !== undefined)
            .join(', ')}`
        );
        await slidesApi.updateSlide(fetchJson, { projectId: pid, slideIndex, patch });
        setSlideSaveStatus('saved');
        window.setTimeout(() => setSlideSaveStatus('idle'), 1200);
        addLog(`✅ Persisted slide ${slideIndex + 1}`);
        return true;
      } catch {
        setSlideSaveStatus('error');
        window.setTimeout(() => setSlideSaveStatus('idle'), 2000);
        addLog(`❌ Persist slide ${slideIndex + 1} failed`);
        return false;
      }
    },
    [fetchJson, addLog, setSlideSaveStatus]
  );

  const saveSlideAiImagePromptForProject = useCallback(
    async (projectId: string, slideIndex: number, prompt: string): Promise<boolean> => {
      const pid = String(projectId || '').trim();
      if (!pid) return false;
      const shouldShowUi = currentProjectIdRef.current === pid;
      // NOTE: EditorShell owns aiImagePromptSaveStatus; keep that behavior there.
      try {
        addLog(`💾 Saving AI image prompt for slide ${slideIndex + 1} (project ${pid})`);
        await slidesApi.updateSlide(fetchJson, { projectId: pid, slideIndex, patch: { aiImagePrompt: prompt } });
        addLog(`✅ Saved AI image prompt for slide ${slideIndex + 1} (project ${pid})`);
        return true;
      } catch {
        addLog(`❌ Failed to save AI image prompt for slide ${slideIndex + 1} (project ${pid})`);
        // Keep UI state handling in EditorShell; return false for callers.
        void shouldShowUi;
        return false;
      }
    },
    [fetchJson, addLog, currentProjectIdRef]
  );

  const scheduleDebouncedSlideTextSave = useCallback(
    (args: {
      projectId: string;
      slideIndex: number;
      debounceMs: number;
      patch: { headline?: string | null; body?: string | null };
      onSuccess?: () => void;
    }) => {
      if (slideTextSaveTimeoutRef.current) window.clearTimeout(slideTextSaveTimeoutRef.current);
      slideTextSavePendingRef.current = true;
      slideTextSaveTimeoutRef.current = window.setTimeout(() => {
        slideTextSavePendingRef.current = false;
        void (async () => {
          const ok = await saveSlidePatchForProject(args.projectId, args.slideIndex, args.patch);
          if (!ok) return;
          try {
            args.onSuccess?.();
          } catch {
            // ignore
          }
        })();
      }, args.debounceMs);
    },
    [saveSlidePatchForProject]
  );

  const scheduleDebouncedLayoutPersist = useCallback(
    (args: {
      projectId: string;
      slideIndex: number;
      debounceMs: number;
      layoutSnapshot: any;
      inputSnapshot: any;
      onSaved?: () => void;
    }) => {
      if (layoutPersistTimeoutRef.current) window.clearTimeout(layoutPersistTimeoutRef.current);
      layoutPersistPendingRef.current = true;
      layoutPersistTimeoutRef.current = window.setTimeout(() => {
        layoutPersistPendingRef.current = false;
        void (async () => {
          const ok = await saveSlidePatchForProject(args.projectId, args.slideIndex, {
            layoutSnapshot: args.layoutSnapshot,
            inputSnapshot: args.inputSnapshot,
          });
          if (ok) args.onSaved?.();
        })();
      }, args.debounceMs);
    },
    [saveSlidePatchForProject]
  );

  const scheduleDebouncedAiPromptSave = useCallback(
    (args: {
      projectId: string;
      slideIndex: number;
      debounceMs: number;
      prompt: string;
      onComplete?: (ok: boolean) => void;
    }) => {
      if (aiPromptSaveTimeoutRef.current) window.clearTimeout(aiPromptSaveTimeoutRef.current);
      aiPromptSavePendingRef.current = true;
      aiPromptSaveTimeoutRef.current = window.setTimeout(() => {
        aiPromptSavePendingRef.current = false;
        void (async () => {
          const ok = await saveSlideAiImagePromptForProject(args.projectId, args.slideIndex, args.prompt);
          args.onComplete?.(ok);
        })();
      }, args.debounceMs);
    },
    [saveSlideAiImagePromptForProject]
  );

  const schedulePersistLayoutAndInputNoReflow = useCallback(
    (args: {
      projectId: string;
      slideIndex: number;
      debounceMs: number;
      layoutSnapshot: any;
      inputSnapshot: any;
    }) => {
      if (rteNoReflowSaveTimeoutRef.current) window.clearTimeout(rteNoReflowSaveTimeoutRef.current);
      rteNoReflowSavePendingRef.current = true;
      const layoutAtSchedule = args.layoutSnapshot;
      const inputAtSchedule = args.inputSnapshot;
      rteNoReflowSaveTimeoutRef.current = window.setTimeout(() => {
        rteNoReflowSavePendingRef.current = false;
        void saveSlidePatchForProject(args.projectId, args.slideIndex, {
          layoutSnapshot: layoutAtSchedule,
          inputSnapshot: inputAtSchedule,
        });
      }, args.debounceMs);
    },
    [saveSlidePatchForProject]
  );

  const hasPendingSlideTextSave = useCallback(() => !!slideTextSavePendingRef.current, []);
  const cancelPendingSlideTextSave = useCallback(() => {
    if (slideTextSaveTimeoutRef.current) window.clearTimeout(slideTextSaveTimeoutRef.current);
    slideTextSaveTimeoutRef.current = null;
    slideTextSavePendingRef.current = false;
  }, []);

  const hasPendingLayoutPersist = useCallback(() => !!layoutPersistPendingRef.current, []);
  const cancelPendingLayoutPersist = useCallback(() => {
    if (layoutPersistTimeoutRef.current) window.clearTimeout(layoutPersistTimeoutRef.current);
    layoutPersistTimeoutRef.current = null;
    layoutPersistPendingRef.current = false;
  }, []);

  const hasPendingAiPromptSave = useCallback(() => !!aiPromptSavePendingRef.current, []);
  const cancelPendingAiPromptSave = useCallback(() => {
    if (aiPromptSaveTimeoutRef.current) window.clearTimeout(aiPromptSaveTimeoutRef.current);
    aiPromptSaveTimeoutRef.current = null;
    aiPromptSavePendingRef.current = false;
  }, []);

  const hasPendingNoReflowPersist = useCallback(() => !!rteNoReflowSavePendingRef.current, []);
  const cancelPendingNoReflowPersist = useCallback(() => {
    if (rteNoReflowSaveTimeoutRef.current) window.clearTimeout(rteNoReflowSaveTimeoutRef.current);
    rteNoReflowSaveTimeoutRef.current = null;
    rteNoReflowSavePendingRef.current = false;
  }, []);

  return {
    saveSlidePatchForProject,
    saveSlideAiImagePromptForProject,
    scheduleDebouncedSlideTextSave,
    scheduleDebouncedLayoutPersist,
    scheduleDebouncedAiPromptSave,
    schedulePersistLayoutAndInputNoReflow,
    hasPendingSlideTextSave,
    cancelPendingSlideTextSave,
    hasPendingLayoutPersist,
    cancelPendingLayoutPersist,
    hasPendingAiPromptSave,
    cancelPendingAiPromptSave,
    hasPendingNoReflowPersist,
    cancelPendingNoReflowPersist,
  };
}

