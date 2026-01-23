'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

type ImagePromptUi = { generating: boolean; error: string | null };

export function useGenerateImagePrompts(params: {
  currentProjectId: string | null;
  currentProjectIdRef: { current: string | null };
  activeSlideIndex: number;
  templateTypeId: 'regular' | 'enhanced';
  fetchJson: (path: string, init?: RequestInit) => Promise<any>;
  addLog: (msg: string) => void;
  setSlides: (updater: any) => void;
}) {
  const { currentProjectId, currentProjectIdRef, activeSlideIndex, templateTypeId, fetchJson, addLog, setSlides } = params;

  // bulk (all slides): tracked per-project
  const [imagePromptByProject, setImagePromptByProject] = useState<Record<string, ImagePromptUi>>({});
  const imagePromptRunIdByProjectRef = useRef<Record<string, number>>({});

  // single slide regenerate: tracked per-project+slide
  const imagePromptKey = useCallback((projectId: string, slideIndex: number) => `${projectId}:${slideIndex}`, []);
  const [imagePromptGeneratingKeys, setImagePromptGeneratingKeys] = useState<Set<string>>(new Set());
  const [imagePromptErrorByKey, setImagePromptErrorByKey] = useState<Record<string, string | null>>({});
  const imagePromptRunIdByKeyRef = useRef<Record<string, number>>({});

  const getImagePromptUi = useCallback(
    (projectId: string | null): ImagePromptUi => {
      const pid = String(projectId || '').trim();
      if (!pid) return { generating: false, error: null };
      return imagePromptByProject[pid] || { generating: false, error: null };
    },
    [imagePromptByProject]
  );

  const setImagePromptUi = useCallback((projectId: string, patch: Partial<ImagePromptUi>) => {
    const pid = String(projectId || '').trim();
    if (!pid) return;
    setImagePromptByProject((prev) => {
      const cur = prev[pid] || { generating: false, error: null };
      return { ...prev, [pid]: { ...cur, ...patch } };
    });
  }, []);

  const imagePromptUiCurrent = getImagePromptUi(currentProjectId);
  const imagePromptGeneratingAll = imagePromptUiCurrent.generating;
  const imagePromptErrorAll = imagePromptUiCurrent.error;

  const imagePromptKeyCurrent = useMemo(() => {
    return currentProjectId && Number.isInteger(activeSlideIndex) ? imagePromptKey(currentProjectId, activeSlideIndex) : '';
  }, [activeSlideIndex, currentProjectId, imagePromptKey]);

  const imagePromptGeneratingThis = imagePromptKeyCurrent ? imagePromptGeneratingKeys.has(imagePromptKeyCurrent) : false;
  const imagePromptErrorThis = imagePromptKeyCurrent ? imagePromptErrorByKey[imagePromptKeyCurrent] || null : null;

  const imagePromptGenerating = imagePromptGeneratingAll || imagePromptGeneratingThis;
  const imagePromptError = imagePromptErrorThis || imagePromptErrorAll;

  const runGenerateImagePrompts = useCallback(
    async (slideIndexOverride?: number) => {
      if (!currentProjectId) return;
      if (templateTypeId !== 'enhanced') return;
      const projectIdAtStart = currentProjectId;
      const isSingleSlide = slideIndexOverride !== undefined;
      const key = isSingleSlide ? imagePromptKey(projectIdAtStart, slideIndexOverride as number) : '';
      let runIdStarted: number | null = null;
      if (isSingleSlide) {
        const runId = (imagePromptRunIdByKeyRef.current[key] || 0) + 1;
        imagePromptRunIdByKeyRef.current[key] = runId;
        runIdStarted = runId;
        setImagePromptGeneratingKeys((prev) => new Set(prev).add(key));
        setImagePromptErrorByKey((prev) => ({ ...prev, [key]: null }));
      } else {
        const runId = (imagePromptRunIdByProjectRef.current[projectIdAtStart] || 0) + 1;
        imagePromptRunIdByProjectRef.current[projectIdAtStart] = runId;
        runIdStarted = runId;
        setImagePromptUi(projectIdAtStart, { generating: true, error: null });
      }
      try {
        addLog(
          `🎨 Generating AI image prompts for project ${projectIdAtStart}${
            slideIndexOverride !== undefined ? ` (slide ${slideIndexOverride + 1} only)` : ''
          }`
        );
        const bodyPayload: any = { projectId: projectIdAtStart };
        if (slideIndexOverride !== undefined) bodyPayload.slideIndex = slideIndexOverride;
        const data = await fetchJson('/api/editor/projects/jobs/generate-image-prompts', {
          method: 'POST',
          body: JSON.stringify(bodyPayload),
        });
        // Ignore stale completions.
        if (isSingleSlide) {
          if (imagePromptRunIdByKeyRef.current[key] !== runIdStarted) return;
        } else {
          if (imagePromptRunIdByProjectRef.current[projectIdAtStart] !== runIdStarted) return;
        }
        const prompts = data.prompts || [];
        addLog(`🎨 Received ${prompts.length} AI image prompts`);
        if (data?.debug?.promptSentToClaude) {
          try {
            addLog(`🧪 ImagePrompt full prompt sent to Claude (JSON):`);
            addLog(JSON.stringify(String(data.debug.promptSentToClaude || '')));
          } catch {
            // ignore
          }
        }
        // Apply UI updates ONLY if the user is still viewing this same project.
        if (currentProjectIdRef.current === projectIdAtStart) {
          setSlides((prev: any[]) =>
            prev.map((s: any, i: number) => {
              const newPrompt = prompts[i] || '';
              if (slideIndexOverride !== undefined && i !== slideIndexOverride) return s;
              if (!newPrompt) return s;
              return { ...s, savedAiImagePrompt: newPrompt, draftAiImagePrompt: newPrompt };
            })
          );
        }
      } catch (e: any) {
        addLog(`❌ Failed to generate AI image prompts: ${e?.message || 'unknown error'}`);
        if (isSingleSlide) {
          if (imagePromptRunIdByKeyRef.current[key] === runIdStarted) {
            setImagePromptErrorByKey((prev) => ({
              ...prev,
              [key]: e?.message || 'Failed to regenerate image prompt',
            }));
          }
        } else {
          if (imagePromptRunIdByProjectRef.current[projectIdAtStart] === runIdStarted) {
            setImagePromptUi(projectIdAtStart, { error: e?.message || 'Failed to generate image prompts' });
          }
        }
      } finally {
        if (isSingleSlide) {
          if (imagePromptRunIdByKeyRef.current[key] === runIdStarted) {
            setImagePromptGeneratingKeys((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          }
        } else {
          // Only clear generating if no newer run started.
          if (imagePromptRunIdByProjectRef.current[projectIdAtStart] === runIdStarted) {
            setImagePromptUi(projectIdAtStart, { generating: false });
          }
        }
      }
    },
    [addLog, currentProjectId, currentProjectIdRef, fetchJson, imagePromptKey, setImagePromptUi, setSlides, templateTypeId]
  );

  return {
    runGenerateImagePrompts,
    imagePromptGeneratingAll,
    imagePromptErrorAll,
    imagePromptGeneratingThis,
    imagePromptErrorThis,
    imagePromptGenerating,
    imagePromptError,
  };
}

