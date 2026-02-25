'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

  // Session-only settings (used only when the server-enforced model supports them)
  aiImageAspectRatio: string;
  aiImageSize: string;

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
    aiImageAspectRatio,
    aiImageSize,
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

  // Avoid effect re-runs caused by unstable function identities from callers.
  const getAuthTokenRef = useRef(params.getAuthToken);
  useEffect(() => {
    getAuthTokenRef.current = params.getAuthToken;
  }, [params.getAuthToken]);

  const getActiveAccountHeader = () => {
    try {
      const id = typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
      return id ? ({ "x-account-id": id } as Record<string, string>) : ({} as Record<string, string>);
    } catch {
      return {} as Record<string, string>;
    }
  };

  const [aiImageGeneratingKeys, setAiImageGeneratingKeys] = useState<Set<string>>(new Set());
  const [aiImageErrorByKey, setAiImageErrorByKey] = useState<Record<string, string | null>>({});
  const [aiImageProgressByKey, setAiImageProgressByKey] = useState<Record<string, number>>({});
  const [aiImageStatusByKey, setAiImageStatusByKey] = useState<Record<string, string>>({});

  const aiImageRunIdByKeyRef = useRef<Record<string, number>>({});
  const aiImageProgressRefsByKeyRef = useRef<Record<string, number | null>>({});
  const aiImagePollRefsByKeyRef = useRef<Record<string, number | null>>({});

  const stopTrackingKey = useCallback((key: string) => {
    if (!key) return;
    const poll = aiImagePollRefsByKeyRef.current[key];
    if (poll) window.clearInterval(poll);
    aiImagePollRefsByKeyRef.current[key] = null;
    const prog = aiImageProgressRefsByKeyRef.current[key];
    if (prog) window.clearInterval(prog);
    aiImageProgressRefsByKeyRef.current[key] = null;
  }, []);

  const refreshSlideFromServer = useCallback(
    async (projectId: string, slideIndex: number) => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await fetch(`/api/editor/projects/load?id=${encodeURIComponent(projectId)}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) return;
        const row = Array.isArray(data?.slides) ? data.slides.find((s: any) => s?.slide_index === slideIndex) : null;
        const layoutSnap = row?.layout_snapshot ?? null;
        const url = String((layoutSnap as any)?.image?.url || '');
        if (currentProjectIdRef.current === projectId) {
          setSlides((prev: any[]) =>
            prev.map((s: any, i: number) =>
              i !== slideIndex
                ? s
                : { ...s, layoutData: layoutSnap ? ({ success: true, layout: layoutSnap, imageUrl: url || null } as any) : null }
            )
          );
          slidesRef.current = slidesRef.current.map((s: any, i: number) =>
            i !== slideIndex
              ? s
              : ({ ...s, layoutData: layoutSnap ? ({ success: true, layout: layoutSnap, imageUrl: url || null } as any) : null } as any)
          );
          if (activeSlideIndexRef.current === slideIndex) {
            setLayoutData(layoutSnap ? ({ success: true, layout: layoutSnap, imageUrl: url || null } as any) : null);
          }
        }
      } catch {
        // ignore
      }
    },
    [activeSlideIndexRef, currentProjectIdRef, getAuthToken, setLayoutData, setSlides, slidesRef]
  );

  const beginTrackingExistingJob = useCallback(
    async (args: { projectId: string; slideIndex: number; startedAt?: string | null }) => {
      const pid = String(args.projectId || '').trim();
      if (!pid) return;
      const slideIndex = Number(args.slideIndex);
      if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) return;
      const key = aiKey(pid, slideIndex);
      if (aiImageGeneratingKeys.has(key)) return;

      const runId = (aiImageRunIdByKeyRef.current[key] || 0) + 1;
      aiImageRunIdByKeyRef.current[key] = runId;

      setAiImageGeneratingKeys((prev) => new Set(prev).add(key));
      setAiImageErrorByKey((prev) => ({ ...prev, [key]: null }));
      setAiImageStatusByKey((prev) => ({ ...prev, [key]: 'Working...' }));

      // Approximate progress based on job started_at to avoid jumping back to 0 on reload.
      const startedMs = args.startedAt ? new Date(args.startedAt).getTime() : Date.now();
      const startTime = Number.isFinite(startedMs) ? startedMs : Date.now();
      const totalDuration = 90000;
      const initialElapsed = Math.max(0, Date.now() - startTime);
      const initialProgress = Math.min(95, (initialElapsed / totalDuration) * 100);
      setAiImageProgressByKey((prev) => ({ ...prev, [key]: initialProgress }));

      stopTrackingKey(key);

      aiImageProgressRefsByKeyRef.current[key] = window.setInterval(() => {
        if (aiImageRunIdByKeyRef.current[key] !== runId) return;
        const elapsed = Date.now() - startTime;
        const progress = Math.min(95, (elapsed / totalDuration) * 100);
        setAiImageProgressByKey((prev) => ({ ...prev, [key]: progress }));
      }, 200);

      const pollOnce = async () => {
        try {
          const token = await getAuthToken();
          if (!token) return;
          const statusRes = await fetch(
            `/api/editor/projects/jobs/status?projectId=${encodeURIComponent(pid)}&jobType=generate-ai-image&slideIndex=${slideIndex}`,
            { method: 'GET', headers: { Authorization: `Bearer ${token}`, ...getActiveAccountHeader() } }
          );
          // If the project no longer exists / isn't in this account, stop polling immediately.
          if (statusRes.status === 404) {
            stopTrackingKey(key);
            window.setTimeout(() => {
              if (aiImageRunIdByKeyRef.current[key] !== runId) return;
              setAiImageGeneratingKeys((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
              setAiImageProgressByKey((prev) => ({ ...prev, [key]: 0 }));
              setAiImageStatusByKey((prev) => ({ ...prev, [key]: '' }));
            }, 0);
            return;
          }
          const statusData = await statusRes.json().catch(() => ({}));
          const activeJob = statusData?.activeJob || null;
          const recentJobs = Array.isArray(statusData?.recentJobs) ? statusData.recentJobs : [];
          if (aiImageRunIdByKeyRef.current[key] !== runId) return;

          if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) {
            const err = String(activeJob.error || '');
            if (err.startsWith('progress:')) {
              const progressCode = err.slice('progress:'.length);
              setAiImageStatusByKey((prev) => ({ ...prev, [key]: getAiImageStatusLabel(progressCode) }));
            } else if (String(activeJob.status) === 'pending') {
              setAiImageStatusByKey((prev) => ({ ...prev, [key]: 'Queued...' }));
            } else {
              setAiImageStatusByKey((prev) => ({ ...prev, [key]: 'Working...' }));
            }
            return;
          }

          // No active job; treat the most recent job as the terminal state.
          const mostRecent = recentJobs[0] || null;
          const status = String(mostRecent?.status || '');
          if (status === 'completed') {
            setAiImageStatusByKey((prev) => ({ ...prev, [key]: 'Done' }));
            setAiImageProgressByKey((prev) => ({ ...prev, [key]: 100 }));
            await refreshSlideFromServer(pid, slideIndex);
          } else if (status === 'failed') {
            const msg = String(mostRecent?.error || 'Image generation failed');
            setAiImageStatusByKey((prev) => ({ ...prev, [key]: 'Error' }));
            setAiImageErrorByKey((prev) => ({ ...prev, [key]: msg }));
          }

          stopTrackingKey(key);
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
        } catch {
          // ignore
        }
      };

      void pollOnce();
      aiImagePollRefsByKeyRef.current[key] = window.setInterval(() => {
        void pollOnce();
      }, 500);
    },
    [
      aiKey,
      aiImageGeneratingKeys,
      getAuthToken,
      refreshSlideFromServer,
      stopTrackingKey,
    ]
  );

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
          const token = await getAuthTokenRef.current?.();
          if (!token) return;
          const statusRes = await fetch(
            `/api/editor/projects/jobs/status?projectId=${encodeURIComponent(projectIdAtStart)}&jobType=generate-ai-image&slideIndex=${targetSlide}`,
            { method: 'GET', headers: { Authorization: `Bearer ${token}`, ...getActiveAccountHeader() } }
          );
          if (statusRes.status === 404) {
            // Stale project selection (deleted/moved accounts). Stop polling.
            if (aiImagePollRefsByKeyRef.current[key]) window.clearInterval(aiImagePollRefsByKeyRef.current[key]!);
            aiImagePollRefsByKeyRef.current[key] = null;
            return;
          }
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
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...getActiveAccountHeader() },
          body: JSON.stringify({
            projectId: projectIdAtStart,
            slideIndex: targetSlide,
            prompt: prompt.trim(),
            // Server enforces the model from DB; these settings are best-effort and only apply when supported.
            imageConfig: {
              aspectRatio: String(aiImageAspectRatio || '3:4'),
              imageSize: String(aiImageSize || '1K'),
            },
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.success) throw new Error(j?.error || `Image generation failed (${res.status})`);
        if (aiImageRunIdByKeyRef.current[key] !== runId) return;

        if (j?.debug?.promptSentToImageModel) {
          try {
            addLog(`🧪 ImageGen full prompt sent to image model (JSON):`);
            addLog(JSON.stringify(String(j.debug.promptSentToImageModel || '')));
          } catch {
            // ignore
          }
        }

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
        // Phase 5 guardrail: AI image generation replaces the PRIMARY image but must preserve any sticker images.
        // NOTE: baseLayout spread already preserves extraImages[], but we keep an explicit reference to avoid accidental drops
        // if this code is refactored later.
        const prevExtras = Array.isArray((baseLayout as any)?.extraImages) ? ((baseLayout as any).extraImages as any[]) : null;
        const nextLayout = {
          ...baseLayout,
          ...(prevExtras ? { extraImages: prevExtras } : {}),
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

        // Phase 2 (Recents): track AI images as recent assets (best-effort).
        try {
          await fetch('/api/editor/assets/recents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              url,
              storage: { bucket: 'carousel-project-images', path },
              kind: 'ai',
            }),
          });
        } catch {
          // ignore
        }

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

  // Resume UI tracking after reload: if a job is already running for the active slide,
  // re-show progress/status and refresh slide snapshot on completion.
  useEffect(() => {
    const pid = String(currentProjectId || '').trim();
    const slideIndex = Number(activeSlideIndex);
    if (!pid) return;
    if (templateTypeId !== 'enhanced') return;
    if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex > 5) return;

    let cancelled = false;
    // On a hard refresh, auth/session can be slightly delayed; retry briefly so the UI
    // reliably re-attaches to an in-flight job.
    const startedAtMs = Date.now();
    const MAX_RETRY_MS = 15_000;
    const INTERVAL_MS = 500;
    let timer: number | null = null;

    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
    };

    const attempt = async () => {
      try {
        if (cancelled) return;
        const token = await getAuthTokenRef.current?.();
        if (!token) {
          if (Date.now() - startedAtMs > MAX_RETRY_MS) stop();
          return;
        }
        const statusRes = await fetch(
          `/api/editor/projects/jobs/status?projectId=${encodeURIComponent(pid)}&jobType=generate-ai-image&slideIndex=${slideIndex}`,
          { method: 'GET', headers: { Authorization: `Bearer ${token}`, ...getActiveAccountHeader() } }
        );
        if (statusRes.status === 404) {
          // Project not found (often stale account/project). Don't keep retrying.
          stop();
          return;
        }
        const statusData = await statusRes.json().catch(() => ({}));
        if (cancelled) return;
        const job = statusData?.activeJob || null;
        if (job && (job.status === 'pending' || job.status === 'running')) {
          void beginTrackingExistingJob({ projectId: pid, slideIndex, startedAt: job.started_at || null });
          // Once we attach tracking, stop retries.
          stop();
        } else {
          // No active job; no need to keep retrying.
          stop();
        }
      } catch {
        // If status checks keep failing, don't poll forever.
        if (Date.now() - startedAtMs > MAX_RETRY_MS) stop();
      }
    };

    timer = window.setInterval(() => {
      void attempt();
    }, INTERVAL_MS);
    void attempt();

    return () => {
      cancelled = true;
      stop();
    };
  }, [activeSlideIndex, beginTrackingExistingJob, currentProjectId, templateTypeId]);

  return {
    runGenerateAiImage,
    aiImageGeneratingThis,
    aiImageProgressThis,
    aiImageStatusThis,
    aiImageErrorThis,
  };
}

