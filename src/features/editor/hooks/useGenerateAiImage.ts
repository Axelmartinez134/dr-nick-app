'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

function getAiImageStatusLabel(progressCode: string): string {
  const code = String(progressCode || '').toLowerCase();
  if (code.includes('generating')) return 'Generating image with AI...';
  if (code.includes('removebg')) return 'Removing background...';
  if (code.includes('uploading')) return 'Uploading...';
  return 'Working...';
}

export function useGenerateAiImage(params: {
  currentProjectId: string | null;
  currentProjectIdRef: { current: string | null };
  activeSlideIndex: number;
  activeSlideIndexRef: { current: number };
  templateTypeId: 'regular' | 'enhanced';

  aiKey: (projectId: string, slideIndex: number) => string;
  getAuthToken: () => Promise<string | null>;
  addLog: (msg: string) => void;

  getDraftAiImagePromptForSlide: (slideIndex: number) => string;

  computeTemplateIdForSlide: (slideIndex: number) => string | null;
  templateSnapshots: Record<string, any>;
  computeDefaultUploadedImagePlacement: (templateSnapshot: any | null, w: number, h: number) => {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  EMPTY_LAYOUT: any;
  layoutData: any;
  setLayoutData: (next: any) => void;
  slidesRef: { current: any[] };
  setSlides: (updater: any) => void;
  saveSlidePatchForProject: (projectId: string, slideIndex: number, patch: { layoutSnapshot?: any }) => Promise<boolean>;
}) {
  const {
    currentProjectId,
    currentProjectIdRef,
    activeSlideIndex,
    activeSlideIndexRef,
    templateTypeId,
    aiKey,
    getAuthToken,
    addLog,
    getDraftAiImagePromptForSlide,
    computeTemplateIdForSlide,
    templateSnapshots,
    computeDefaultUploadedImagePlacement,
    EMPTY_LAYOUT,
    layoutData,
    setLayoutData,
    slidesRef,
    setSlides,
    saveSlidePatchForProject,
  } = params;

  const [aiImageGeneratingKeys, setAiImageGeneratingKeys] = useState<Set<string>>(new Set());
  const [aiImageErrorByKey, setAiImageErrorByKey] = useState<Record<string, string | null>>({});
  const [aiImageProgressByKey, setAiImageProgressByKey] = useState<Record<string, number>>({});
  const [aiImageStatusByKey, setAiImageStatusByKey] = useState<Record<string, string>>({});

  const aiImageRunIdByKeyRef = useRef<Record<string, number>>({});
  const aiImageProgressRefsByKeyRef = useRef<Record<string, number | null>>({});
  const aiImagePollRefsByKeyRef = useRef<Record<string, number | null>>({});

  const aiKeyCurrent = currentProjectId ? aiKey(currentProjectId, activeSlideIndex) : '';
  const aiImageGeneratingThis = aiKeyCurrent ? aiImageGeneratingKeys.has(aiKeyCurrent) : false;
  const aiImageProgressThis = aiKeyCurrent ? aiImageProgressByKey[aiKeyCurrent] || 0 : 0;
  const aiImageStatusThis = aiKeyCurrent ? aiImageStatusByKey[aiKeyCurrent] || '' : '';
  const aiImageErrorThis = aiKeyCurrent ? aiImageErrorByKey[aiKeyCurrent] || null : null;

  const runGenerateAiImage = useCallback(
    async (slideIdx?: number) => {
      const targetSlide = slideIdx ?? activeSlideIndex;
      if (!currentProjectId) return;
      if (templateTypeId !== 'enhanced') return;

      const projectIdAtStart = currentProjectId;
      const key = aiKey(projectIdAtStart, targetSlide);
      const prompt = getDraftAiImagePromptForSlide(targetSlide) || '';
      if (!prompt || prompt.trim().length < 10) {
        setAiImageErrorByKey((prev) => ({
          ...prev,
          [key]: 'Please enter or generate an image prompt first (min 10 characters).',
        }));
        return;
      }

      const runId = (aiImageRunIdByKeyRef.current[key] || 0) + 1;
      aiImageRunIdByKeyRef.current[key] = runId;
      setAiImageGeneratingKeys((prev) => new Set(prev).add(key));
      setAiImageErrorByKey((prev) => ({ ...prev, [key]: null }));
      setAiImageProgressByKey((prev) => ({ ...prev, [key]: 0 }));
      setAiImageStatusByKey((prev) => ({ ...prev, [key]: 'Starting...' }));

      // Start progress animation (smooth progress over 90 seconds)
      if (aiImageProgressRefsByKeyRef.current[key]) window.clearInterval(aiImageProgressRefsByKeyRef.current[key]!);
      const startTime = Date.now();
      const totalDuration = 90000;
      aiImageProgressRefsByKeyRef.current[key] = window.setInterval(() => {
        if (aiImageRunIdByKeyRef.current[key] !== runId) return;
        const elapsed = Date.now() - startTime;
        const progress = Math.min(95, (elapsed / totalDuration) * 100);
        setAiImageProgressByKey((prev) => ({ ...prev, [key]: progress }));
      }, 200);

      // Start polling for job status
      if (aiImagePollRefsByKeyRef.current[key]) window.clearInterval(aiImagePollRefsByKeyRef.current[key]!);
      const pollStatus = async () => {
        try {
          const token = await getAuthToken();
          if (!token) return;
          const statusRes = await fetch(
            `/api/editor/projects/jobs/status?projectId=${encodeURIComponent(projectIdAtStart)}&jobType=generate-ai-image&slideIndex=${targetSlide}`,
            { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
          );
          const statusData = await statusRes.json().catch(() => ({}));
          const job = statusData?.activeJob || null;
          if (job && job.error && String(job.error).startsWith('progress:')) {
            const progressCode = job.error.slice('progress:'.length);
            if (aiImageRunIdByKeyRef.current[key] !== runId) return;
            setAiImageStatusByKey((prev) => ({ ...prev, [key]: getAiImageStatusLabel(progressCode) }));
          }
        } catch {
          // ignore
        }
      };
      void pollStatus();
      aiImagePollRefsByKeyRef.current[key] = window.setInterval(pollStatus, 500);

      try {
        addLog(`🖼️ Generating AI image for slide ${targetSlide + 1}...`);
        const token = await getAuthToken();
        if (!token) throw new Error('Not authenticated. Please sign in again.');

        const res = await fetch('/api/editor/projects/jobs/generate-ai-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ projectId: projectIdAtStart, slideIndex: targetSlide, prompt: prompt.trim() }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.success) throw new Error(j?.error || `Image generation failed (${res.status})`);
        if (aiImageRunIdByKeyRef.current[key] !== runId) return;

        const url = String(j?.url || '');
        const path = String(j?.path || '');
        if (!url) throw new Error('Image generated but no URL returned.');

        addLog(`✅ AI image generated: ${url.substring(0, 80)}...`);
        setAiImageStatusByKey((prev) => ({ ...prev, [key]: 'Done' }));

        // Load image dimensions for placement
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1 });
          img.onerror = () => resolve({ w: 1, h: 1 });
          img.src = url;
        });

        const tid = computeTemplateIdForSlide(targetSlide);
        const snap = (tid ? templateSnapshots[tid] : null) || null;
        const placement = computeDefaultUploadedImagePlacement(snap, dims.w, dims.h);
        const mask = (j?.mask as any) || null;
        const bgRemovalStatus = String(j?.bgRemovalStatus || 'succeeded');
        const original = j?.original || null;
        const processed = j?.processed || null;

        const isActiveTarget =
          currentProjectIdRef.current === projectIdAtStart && activeSlideIndexRef.current === targetSlide;
        const currentLayout = isActiveTarget ? layoutData : (slidesRef.current?.[targetSlide] as any)?.layoutData;
        const baseLayout = (currentLayout as any)?.layout ? { ...(currentLayout as any).layout } : { ...EMPTY_LAYOUT };
        const nextLayout = {
          ...baseLayout,
          image: {
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            url,
            storage: { bucket: 'carousel-project-images', path },
            bgRemovalEnabled: true,
            bgRemovalStatus,
            ...(original
              ? {
                  original: {
                    url: String(original.url || ''),
                    storage: original.storage || { bucket: 'carousel-project-images', path: String(original.path || '') },
                  },
                }
              : {}),
            ...(processed
              ? {
                  processed: {
                    url: String(processed.url || ''),
                    storage: processed.storage || { bucket: 'carousel-project-images', path: String(processed.path || '') },
                  },
                }
              : {}),
            ...(mask ? { mask } : {}),
            isAiGenerated: true,
          },
        };

        if (isActiveTarget) setLayoutData({ success: true, layout: nextLayout, imageUrl: url } as any);
        if (currentProjectIdRef.current === projectIdAtStart) {
          setSlides((prev: any[]) =>
            prev.map((s: any, i: number) => (i !== targetSlide ? s : { ...s, layoutData: { success: true, layout: nextLayout, imageUrl: url } as any }))
          );
          slidesRef.current = slidesRef.current.map((s: any, i: number) =>
            i !== targetSlide ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: url } as any } as any)
          );
        }

        await saveSlidePatchForProject(projectIdAtStart, targetSlide, { layoutSnapshot: nextLayout });
        addLog(`🖼️ AI image placed on slide ${targetSlide + 1}`);
        setAiImageProgressByKey((prev) => ({ ...prev, [key]: 100 }));
      } catch (e: any) {
        addLog(`❌ AI image generation failed: ${e?.message || 'unknown error'}`);
        setAiImageErrorByKey((prev) => ({
          ...prev,
          [key]: e?.message || 'Image generation failed. Please contact Dr. Nick.',
        }));
      } finally {
        if (aiImagePollRefsByKeyRef.current[key]) {
          window.clearInterval(aiImagePollRefsByKeyRef.current[key]!);
          aiImagePollRefsByKeyRef.current[key] = null;
        }
        if (aiImageProgressRefsByKeyRef.current[key]) {
          window.clearInterval(aiImageProgressRefsByKeyRef.current[key]!);
          aiImageProgressRefsByKeyRef.current[key] = null;
        }
        window.setTimeout(() => {
          if (aiImageRunIdByKeyRef.current[key] !== runId) return;
          setAiImageGeneratingKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          setAiImageProgressByKey((prev) => ({ ...prev, [key]: 0 }));
          setAiImageStatusByKey((prev) => ({ ...prev, [key]: '' }));
        }, 800);
      }
    },
    [
      EMPTY_LAYOUT,
      activeSlideIndex,
      activeSlideIndexRef,
      addLog,
      aiKey,
      computeDefaultUploadedImagePlacement,
      computeTemplateIdForSlide,
      currentProjectId,
      currentProjectIdRef,
      getAuthToken,
      getDraftAiImagePromptForSlide,
      layoutData,
      saveSlidePatchForProject,
      setLayoutData,
      setSlides,
      slidesRef,
      templateSnapshots,
      templateTypeId,
    ]
  );

  return {
    runGenerateAiImage,
    aiImageGeneratingThis,
    aiImageProgressThis,
    aiImageStatusThis,
    aiImageErrorThis,
  };
}

