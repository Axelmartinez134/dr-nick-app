'use client';

import { useCallback, useRef } from 'react';

export type ImageOps = {
  uploadImageForActiveSlide: (file: File, opts?: { bgRemovalEnabledAtInsert?: boolean }) => Promise<void>;
  insertRecentImageForActiveSlide: (asset: {
    url: string;
    storage?: { bucket?: string | null; path?: string | null } | null;
    kind?: string | null;
  }, opts?: { bgRemovalEnabledAtInsert?: boolean }) => Promise<void>;
  setActiveSlideImageBgRemoval: (nextEnabled: boolean) => Promise<void>;
  deleteImageForActiveSlide: (reason: 'menu' | 'button') => Promise<void>;
  handleUserImageChange: (change: {
    canvasSlideIndex?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    angle?: number;
  }) => void;
};

export function useImageOps(params: {
  slideCount: number;
  EMPTY_LAYOUT: any;

  // Auth / network
  fetchJson: (path: string, init?: RequestInit) => Promise<any>;
  getAuthToken: () => Promise<string | null>;

  // Project/slide identity
  currentProjectId: string | null;
  currentProjectIdRef: { current: string | null };
  activeSlideIndex: number;
  activeSlideIndexRef: { current: number };
  templateTypeId: 'regular' | 'enhanced';

  // Template lookup used for initial image placement
  computeTemplateIdForSlide: (slideIndex: number) => string | null;
  templateSnapshots: Record<string, any>;
  computeDefaultUploadedImagePlacement: (templateSnapshot: any | null, w: number, h: number) => {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // State access / setters
  slidesRef: { current: any[] };
  setSlides: (updater: any) => void;
  layoutData: any;
  setLayoutData: (next: any) => void;
  setActiveImageSelected: (v: boolean) => void;

  // UI state
  setImageBusy: (v: boolean) => void;
  closeImageMenu: () => void;
  setBgRemovalBusyKeys: (updater: any) => void;

  // Logging + persistence
  addLog: (msg: string) => void;
  saveSlidePatchForProject: (projectId: string, slideIndex: number, patch: { layoutSnapshot?: any }) => Promise<boolean>;

  // Concurrency guards
  aiKey: (projectId: string, slideIndex: number) => string;
  imageOpRunIdByKeyRef: { current: Record<string, number> };

  // Undo + auto realign
  pushUndoSnapshot: () => void;
  switchingSlides: boolean;
  copyGenerating: boolean;
  realigning: boolean;
  runRealignTextForActiveSlide: (opts: { pushHistory: boolean }) => void;
  scheduleAutoRealignAfterRelease: (args: {
    projectIdAtRelease: string;
    slideIndexAtRelease: number;
    templateTypeId: 'regular' | 'enhanced';
    getSlideState: () => { layoutLocked: boolean; autoRealignOnImageRelease: boolean };
    switchingSlides: boolean;
    copyGenerating: boolean;
    realigning: boolean;
    runRealignTextForActiveSlide: (opts: { pushHistory: boolean }) => void;
  }) => void;
}): ImageOps {
  const {
    slideCount,
    EMPTY_LAYOUT,
    fetchJson,
    getAuthToken,
    currentProjectId,
    currentProjectIdRef,
    activeSlideIndex,
    activeSlideIndexRef,
    templateTypeId,
    computeTemplateIdForSlide,
    templateSnapshots,
    computeDefaultUploadedImagePlacement,
    slidesRef,
    setSlides,
    layoutData,
    setLayoutData,
    setActiveImageSelected,
    setImageBusy,
    closeImageMenu,
    setBgRemovalBusyKeys,
    addLog,
    saveSlidePatchForProject,
    aiKey,
    imageOpRunIdByKeyRef,
    pushUndoSnapshot,
    switchingSlides,
    copyGenerating,
    realigning,
    runRealignTextForActiveSlide,
    scheduleAutoRealignAfterRelease,
  } = params;

  const imageMoveSaveTimeoutRef = useRef<number | null>(null);

  const uploadImageForActiveSlide = useCallback(
    async (file: File, opts?: { bgRemovalEnabledAtInsert?: boolean }) => {
      if (!currentProjectId) throw new Error('Create or load a project first.');
      if (!file) return;
      if (!Number.isInteger(activeSlideIndex) || activeSlideIndex < 0 || activeSlideIndex > 5) return;
      const projectIdAtStart = currentProjectId;
      const slideIndexAtStart = activeSlideIndex;
      const opKey = aiKey(projectIdAtStart, slideIndexAtStart);
      const runId = (imageOpRunIdByKeyRef.current[opKey] || 0) + 1;
      imageOpRunIdByKeyRef.current[opKey] = runId;
      const tidAtStart = computeTemplateIdForSlide(slideIndexAtStart);
      const snapAtStart = (tidAtStart ? templateSnapshots[tidAtStart] : null) || null;
      const baseLayoutAtStart = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : { ...EMPTY_LAYOUT };

      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
      const t = String((file as any)?.type || '');
      if (!allowedTypes.has(t)) {
        throw new Error('Unsupported file type. Please upload JPG, PNG, or WebP.');
      }
      if (Number((file as any)?.size || 0) > 10 * 1024 * 1024) {
        throw new Error('File too large. Max 10MB.');
      }

      setImageBusy(true);
      closeImageMenu();
      try {
        const token = await getAuthToken();
        if (!token) throw new Error('Not authenticated. Please sign in again.');
        if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

        const bgRemovalEnabledAtInsert = opts?.bgRemovalEnabledAtInsert !== undefined ? !!opts.bgRemovalEnabledAtInsert : true;

        const fd = new FormData();
        fd.append('file', file);
        fd.append('projectId', projectIdAtStart);
        fd.append('slideIndex', String(slideIndexAtStart));
        // Phase 1: allow caller to decide whether BG removal runs at insert time.
        fd.append('bgRemovalEnabled', bgRemovalEnabledAtInsert ? '1' : '0');

        const res = await fetch('/api/editor/projects/slides/image/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.success) throw new Error(j?.error || `Upload failed (${res.status})`);
        if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

        const url = String(j?.url || '');
        const path = String(j?.path || '');
        if (!url) throw new Error('Upload succeeded but no URL was returned.');

        // Load image dimensions for initial centered placement.
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1 });
          img.onerror = () => resolve({ w: 1, h: 1 });
          img.src = url;
        });
        if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

        const placement = computeDefaultUploadedImagePlacement(snapAtStart, dims.w, dims.h);
        const mask = (j?.mask as any) || null;
        const bgRemovalStatus = String(j?.bgRemovalStatus || 'idle');
        const bgRemovalEnabledFromServer = (j as any)?.bgRemovalEnabled === false ? false : true;
        const original = j?.original || null;
        const processed = j?.processed || null;

        // Patch the ORIGINAL slide's layout snapshot so Realign can see the image and preserve movement.
        // If the user is still on the same project, prefer the latest in-memory layout for that slide.
        const latestBaseLayout =
          currentProjectIdRef.current === projectIdAtStart
            ? ((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout
                ? { ...((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout as any) }
                : baseLayoutAtStart)
            : baseLayoutAtStart;
        const nextLayout = {
          ...latestBaseLayout,
          image: {
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            url,
            storage: { bucket: 'carousel-project-images', path },
            bgRemovalEnabled: bgRemovalEnabledFromServer,
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
          },
        };

        // Only apply UI updates if the user is still viewing this project.
        if (currentProjectIdRef.current === projectIdAtStart) {
          setSlides((prev: any[]) =>
            prev.map((s, i) =>
              i !== slideIndexAtStart ? s : { ...s, layoutData: { success: true, layout: nextLayout, imageUrl: url } as any }
            )
          );
          slidesRef.current = slidesRef.current.map((s, i) =>
            i !== slideIndexAtStart ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: url } as any } as any)
          );
          if (activeSlideIndexRef.current === slideIndexAtStart) {
            setLayoutData({ success: true, layout: nextLayout, imageUrl: url } as any);
          }
        }

        // Persist to Supabase (per-slide snapshot).
        await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout });
        addLog(`🖼️ Uploaded image → slide ${slideIndexAtStart + 1}`);

        // Phase 2: track in Recents (best-effort, never blocks upload).
        try {
          await fetchJson('/api/editor/assets/recents', {
            method: 'POST',
            body: JSON.stringify({
              url,
              storage: { bucket: 'carousel-project-images', path },
              kind: 'upload',
            }),
          });
        } catch {
          // ignore
        }
      } finally {
        setImageBusy(false);
      }
    },
    [
      EMPTY_LAYOUT,
      activeSlideIndex,
      activeSlideIndexRef,
      addLog,
      aiKey,
      closeImageMenu,
      computeDefaultUploadedImagePlacement,
      computeTemplateIdForSlide,
      currentProjectId,
      currentProjectIdRef,
      getAuthToken,
      imageOpRunIdByKeyRef,
      layoutData,
      saveSlidePatchForProject,
      setImageBusy,
      setLayoutData,
      setSlides,
      slidesRef,
      templateSnapshots,
    ]
  );

  const setActiveSlideImageBgRemoval = useCallback(
    async (nextEnabled: boolean) => {
      if (!currentProjectId) throw new Error('Create or load a project first.');
      if (!Number.isInteger(activeSlideIndex) || activeSlideIndex < 0 || activeSlideIndex > 5) return;
      const projectIdAtStart = currentProjectId;
      const slideIndexAtStart = activeSlideIndex;
      const opKey = aiKey(projectIdAtStart, slideIndexAtStart);
      // UI: show busy state per slide while toggling/reprocessing.
      setBgRemovalBusyKeys((prev: Set<string>) => {
        const next = new Set(prev);
        next.add(opKey);
        return next;
      });
      const runId = (imageOpRunIdByKeyRef.current[opKey] || 0) + 1;
      imageOpRunIdByKeyRef.current[opKey] = runId;
      const baseLayoutAtStart = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : null;
      const baseLayout = baseLayoutAtStart;
      const img = baseLayout?.image ? { ...(baseLayout.image as any) } : null;
      if (!img || !String(img?.url || '').trim()) return;

      // Ensure we always keep a pointer to the original upload for retries.
      const orig = (img as any).original || null;
      if (!orig) {
        (img as any).original = {
          url: String((img as any)?.url || ''),
          storage: (img as any)?.storage || null,
        };
      }

      (img as any).bgRemovalEnabled = !!nextEnabled;
      if (!nextEnabled) {
        // When disabling, revert to original visually and clear mask so wrapping falls back to rectangle.
        (img as any).bgRemovalStatus = 'disabled';
        const o = (img as any).original || null;
        if (o?.url) (img as any).url = String(o.url);
        if (o?.storage) (img as any).storage = o.storage;
        if ((img as any).mask) delete (img as any).mask;
        if ((img as any).processed) delete (img as any).processed;
      } else {
        // When enabling, kick off reprocess from stored original and update to processed PNG + server mask.
        (img as any).bgRemovalStatus = 'processing';
      }

      const nextLayout = { ...baseLayout, image: img };
      if (currentProjectIdRef.current === projectIdAtStart) {
        setSlides((prev: any[]) =>
          prev.map((s, i) =>
            i === slideIndexAtStart ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout } as any } as any) : s
          )
        );
        slidesRef.current = slidesRef.current.map((s, i) =>
          i === slideIndexAtStart ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout } as any } as any) : s
        );
        if (activeSlideIndexRef.current === slideIndexAtStart) {
          setLayoutData((prev: any) => (prev?.layout ? { ...prev, layout: nextLayout } : prev));
        }
      }

      await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout });
      if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

      if (nextEnabled) {
        try {
          const sourcePath =
            String((img as any)?.original?.storage?.path || (img as any)?.storage?.path || '').trim() || undefined;
          const j = await fetchJson('/api/editor/projects/slides/image/reprocess', {
            method: 'POST',
            body: JSON.stringify({ projectId: projectIdAtStart, slideIndex: slideIndexAtStart, path: sourcePath }),
          });
          if (!j?.success) throw new Error(j?.error || 'Reprocess failed');
          if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

          const processedUrl = String(j?.processed?.url || '');
          const processedPath = String(j?.processed?.path || '');
          const mask = j?.mask || null;
          const bgRemovalStatus = String(j?.bgRemovalStatus || 'succeeded');

          const base2 =
            currentProjectIdRef.current === projectIdAtStart
              ? ((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout
                  ? { ...((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout as any) }
                  : ({ ...EMPTY_LAYOUT } as any))
              : ({ ...EMPTY_LAYOUT } as any);
          const prevImg = (base2 as any)?.image ? { ...(base2 as any).image } : null;
          if (!prevImg) return;

          const nextImg = {
            ...prevImg,
            bgRemovalEnabled: true,
            bgRemovalStatus,
            url: processedUrl || prevImg.url,
            storage: processedPath ? { bucket: 'carousel-project-images', path: processedPath } : prevImg.storage,
            original: j?.original
              ? { url: String(j.original.url || ''), storage: { bucket: 'carousel-project-images', path: String(j.original.path || '') } }
              : (prevImg as any).original,
            processed: j?.processed
              ? { url: String(j.processed.url || ''), storage: { bucket: 'carousel-project-images', path: String(j.processed.path || '') } }
              : { url: processedUrl, storage: processedPath ? { bucket: 'carousel-project-images', path: processedPath } : prevImg.storage },
            ...(mask ? { mask } : {}),
          };
          const nextLayout2 = { ...base2, image: nextImg };
          if (currentProjectIdRef.current === projectIdAtStart) {
            setSlides((prev: any[]) =>
              prev.map((s, i) =>
                i === slideIndexAtStart
                  ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: nextImg.url } as any } as any)
                  : s
              )
            );
            slidesRef.current = slidesRef.current.map((s, i) =>
              i === slideIndexAtStart
                ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: nextImg.url } as any } as any)
                : s
            );
            if (activeSlideIndexRef.current === slideIndexAtStart) {
              setLayoutData((prev: any) => (prev?.layout ? ({ ...prev, layout: nextLayout2, imageUrl: nextImg.url } as any) : prev));
            }
          }
          await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout2 });
        } catch (e) {
          // Mark failed but keep original visible.
          const base2 =
            currentProjectIdRef.current === projectIdAtStart
              ? ((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout
                  ? { ...((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout as any) }
                  : null)
              : null;
          const prevImg = base2?.image ? { ...(base2.image as any) } : null;
          if (!base2 || !prevImg) return;
          const o = (prevImg as any).original || null;
          const failedImg: any = { ...prevImg, bgRemovalEnabled: true, bgRemovalStatus: 'failed' };
          if (o?.url) failedImg.url = String(o.url);
          if (o?.storage) failedImg.storage = o.storage;
          if (failedImg.mask) delete failedImg.mask;
          if (failedImg.processed) delete failedImg.processed;
          const nextLayout2 = { ...base2, image: failedImg };
          if (currentProjectIdRef.current === projectIdAtStart) {
            setSlides((prev: any[]) =>
              prev.map((s, i) =>
                i === slideIndexAtStart
                  ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: failedImg.url } as any } as any)
                  : s
              )
            );
            slidesRef.current = slidesRef.current.map((s, i) =>
              i === slideIndexAtStart
                ? ({ ...s, layoutData: { ...(s as any).layoutData, layout: nextLayout2, imageUrl: failedImg.url } as any } as any)
                : s
            );
            if (activeSlideIndexRef.current === slideIndexAtStart) {
              setLayoutData((prev: any) => (prev?.layout ? ({ ...prev, layout: nextLayout2, imageUrl: failedImg.url } as any) : prev));
            }
          }
          await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout2 });
        }
      }
      // Clear busy state when the operation completes.
      setBgRemovalBusyKeys((prev: Set<string>) => {
        const next = new Set(prev);
        next.delete(opKey);
        return next;
      });
    },
    [
      EMPTY_LAYOUT,
      activeSlideIndex,
      activeSlideIndexRef,
      aiKey,
      currentProjectId,
      currentProjectIdRef,
      fetchJson,
      imageOpRunIdByKeyRef,
      layoutData,
      saveSlidePatchForProject,
      setBgRemovalBusyKeys,
      setLayoutData,
      setSlides,
      slidesRef,
    ]
  );

  const insertRecentImageForActiveSlide = useCallback(
    async (
      asset: { url: string; storage?: { bucket?: string | null; path?: string | null } | null; kind?: string | null },
      opts?: { bgRemovalEnabledAtInsert?: boolean }
    ) => {
      if (!currentProjectId) throw new Error('Create or load a project first.');
      const url = String(asset?.url || '').trim();
      if (!url) return;
      if (!Number.isInteger(activeSlideIndex) || activeSlideIndex < 0 || activeSlideIndex > 5) return;

      const projectIdAtStart = currentProjectId;
      const slideIndexAtStart = activeSlideIndex;
      const opKey = aiKey(projectIdAtStart, slideIndexAtStart);
      const runId = (imageOpRunIdByKeyRef.current[opKey] || 0) + 1;
      imageOpRunIdByKeyRef.current[opKey] = runId;

      const tidAtStart = computeTemplateIdForSlide(slideIndexAtStart);
      const snapAtStart = (tidAtStart ? templateSnapshots[tidAtStart] : null) || null;
      const baseLayoutAtStart = (layoutData as any)?.layout ? { ...(layoutData as any).layout } : { ...EMPTY_LAYOUT };

      const bgRemovalEnabledAtInsert = opts?.bgRemovalEnabledAtInsert !== undefined ? !!opts.bgRemovalEnabledAtInsert : false;

      setImageBusy(true);
      closeImageMenu();
      try {
        if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

        // Load dimensions for initial placement.
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1 });
          img.onerror = () => resolve({ w: 1, h: 1 });
          img.src = url;
        });
        if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

        const placement = computeDefaultUploadedImagePlacement(snapAtStart, dims.w, dims.h);

        const storageBucket = String(asset?.storage?.bucket || '').trim() || null;
        const storagePath = String(asset?.storage?.path || '').trim() || null;

        const latestBaseLayout =
          currentProjectIdRef.current === projectIdAtStart
            ? ((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout
                ? { ...((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout as any) }
                : baseLayoutAtStart)
            : baseLayoutAtStart;

        const nextImg: any = {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          url,
          storage: storageBucket && storagePath ? { bucket: storageBucket, path: storagePath } : null,
          // Always keep an "original" pointer so BG removal can be enabled later.
          original: { url, storage: storageBucket && storagePath ? { bucket: storageBucket, path: storagePath } : null },
          bgRemovalEnabled: !!bgRemovalEnabledAtInsert,
          bgRemovalStatus: bgRemovalEnabledAtInsert ? 'processing' : 'disabled',
          isAiGenerated: String(asset?.kind || '') === 'ai',
        };

        if (!bgRemovalEnabledAtInsert) {
          if ((nextImg as any).mask) delete (nextImg as any).mask;
          if ((nextImg as any).processed) delete (nextImg as any).processed;
        }

        const nextLayout = { ...latestBaseLayout, image: nextImg };

        if (currentProjectIdRef.current === projectIdAtStart) {
          setSlides((prev: any[]) =>
            prev.map((s, i) => (i !== slideIndexAtStart ? s : { ...s, layoutData: { success: true, layout: nextLayout, imageUrl: url } as any }))
          );
          slidesRef.current = slidesRef.current.map((s, i) =>
            i !== slideIndexAtStart ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: url } as any } as any)
          );
          if (activeSlideIndexRef.current === slideIndexAtStart) {
            setLayoutData({ success: true, layout: nextLayout, imageUrl: url } as any);
          }
          setActiveImageSelected(true);
        }

        await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout });
        if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

        // Track usage in recents (best-effort).
        try {
          await fetchJson('/api/editor/assets/recents', {
            method: 'POST',
            body: JSON.stringify({
              url,
              ...(storageBucket && storagePath ? { storage: { bucket: storageBucket, path: storagePath } } : {}),
              kind: String(asset?.kind || 'upload'),
            }),
          });
        } catch {
          // ignore
        }

        if (bgRemovalEnabledAtInsert) {
          if (!(storageBucket && storagePath)) {
            throw new Error('Cannot run background removal for this recent image (missing stored source path).');
          }
          await setActiveSlideImageBgRemoval(true);
        }
      } finally {
        setImageBusy(false);
      }
    },
    [
      EMPTY_LAYOUT,
      activeSlideIndex,
      activeSlideIndexRef,
      aiKey,
      closeImageMenu,
      computeDefaultUploadedImagePlacement,
      computeTemplateIdForSlide,
      currentProjectId,
      currentProjectIdRef,
      fetchJson,
      imageOpRunIdByKeyRef,
      layoutData,
      saveSlidePatchForProject,
      setActiveImageSelected,
      setImageBusy,
      setLayoutData,
      setSlides,
      setActiveSlideImageBgRemoval,
      slidesRef,
      templateSnapshots,
    ]
  );

  const deleteImageForActiveSlide = useCallback(
    async (reason: 'menu' | 'button') => {
      if (!currentProjectId) return;
      if (!Number.isInteger(activeSlideIndex) || activeSlideIndex < 0 || activeSlideIndex > 5) return;
      const projectIdAtStart = currentProjectId;
      const slideIndexAtStart = activeSlideIndex;
      const opKey = aiKey(projectIdAtStart, slideIndexAtStart);
      const runId = (imageOpRunIdByKeyRef.current[opKey] || 0) + 1;
      imageOpRunIdByKeyRef.current[opKey] = runId;
      setImageBusy(true);
      closeImageMenu();
      try {
        // Best-effort delete from storage
        try {
          await fetchJson('/api/editor/projects/slides/image/delete', {
            method: 'POST',
            body: JSON.stringify({ projectId: projectIdAtStart, slideIndex: slideIndexAtStart }),
          });
        } catch (e) {
          // If storage delete fails, still remove from the slide snapshot so the UI unblocks.
          console.warn('[EditorShell] Image storage delete failed:', e);
        }
        if (imageOpRunIdByKeyRef.current[opKey] !== runId) return;

        const baseLayout =
          currentProjectIdRef.current === projectIdAtStart
            ? ((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout
                ? { ...((slidesRef.current?.[slideIndexAtStart] as any)?.layoutData?.layout as any) }
                : activeSlideIndexRef.current === slideIndexAtStart && (layoutData as any)?.layout
                  ? { ...((layoutData as any).layout as any) }
                  : { ...EMPTY_LAYOUT })
            : { ...EMPTY_LAYOUT };
        const nextLayout = { ...baseLayout };
        if ((nextLayout as any).image) delete (nextLayout as any).image;

        if (currentProjectIdRef.current === projectIdAtStart) {
          setSlides((prev: any[]) =>
            prev.map((s, i) =>
              i !== slideIndexAtStart ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: null } as any } as any)
            )
          );
          slidesRef.current = slidesRef.current.map((s, i) =>
            i !== slideIndexAtStart ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: null } as any } as any)
          );
          if (activeSlideIndexRef.current === slideIndexAtStart) {
            setLayoutData({ success: true, layout: nextLayout, imageUrl: null } as any);
          }
        }

        await saveSlidePatchForProject(projectIdAtStart, slideIndexAtStart, { layoutSnapshot: nextLayout });
        setActiveImageSelected(false);
        addLog(`🗑️ Removed image (slide ${slideIndexAtStart + 1}) via ${reason}`);
      } finally {
        setImageBusy(false);
      }
    },
    [
      EMPTY_LAYOUT,
      activeSlideIndex,
      activeSlideIndexRef,
      addLog,
      aiKey,
      closeImageMenu,
      currentProjectId,
      currentProjectIdRef,
      fetchJson,
      imageOpRunIdByKeyRef,
      layoutData,
      saveSlidePatchForProject,
      setActiveImageSelected,
      setImageBusy,
      setLayoutData,
      setSlides,
      slidesRef,
    ]
  );

  const handleUserImageChange = useCallback(
    (change: { canvasSlideIndex?: number; x: number; y: number; width: number; height: number; angle?: number }) => {
      if (!currentProjectId) return;
      const slideIndex = Number.isInteger((change as any)?.canvasSlideIndex) ? Number((change as any).canvasSlideIndex) : activeSlideIndex;
      if (slideIndex < 0 || slideIndex >= slideCount) return;

      // Update in-memory layout snapshot so Realign sees the current image bounds immediately.
      const currentLayoutState =
        slideIndex === activeSlideIndex ? (layoutData as any) : ((slidesRef.current?.[slideIndex] as any)?.layoutData as any);
      const baseLayout = currentLayoutState?.layout ? { ...currentLayoutState.layout } : { ...EMPTY_LAYOUT };
      const prevImage = (baseLayout as any)?.image || null;
      if (!prevImage || !prevImage.url) return; // no user image to update

      // Enable Undo for image moves/resizes/rotations too. Push only when bounds actually changed.
      try {
        const eps = 0.5;
        const didMove =
          Math.abs(Number(prevImage?.x ?? 0) - Number(change.x ?? 0)) > eps ||
          Math.abs(Number(prevImage?.y ?? 0) - Number(change.y ?? 0)) > eps;
        const didResize =
          Math.abs(Number(prevImage?.width ?? 0) - Number(change.width ?? 0)) > eps ||
          Math.abs(Number(prevImage?.height ?? 0) - Number(change.height ?? 0)) > eps;
        const didRotate = Math.abs(Number(prevImage?.angle ?? 0) - Number(change.angle ?? 0)) > eps;
        if (didMove || didResize || didRotate) pushUndoSnapshot();
      } catch {
        pushUndoSnapshot();
      }

      const nextLayout = {
        ...baseLayout,
        image: {
          ...prevImage,
          x: Math.round(Number(change.x) || 0),
          y: Math.round(Number(change.y) || 0),
          width: Math.max(1, Math.round(Number(change.width) || 1)),
          height: Math.max(1, Math.round(Number(change.height) || 1)),
          angle: Number(change.angle) || 0,
        },
      };

      if (slideIndex === activeSlideIndex) {
        setLayoutData({ success: true, layout: nextLayout, imageUrl: prevImage.url } as any);
      }
      setSlides((prev: any[]) =>
        prev.map((s, i) => (i !== slideIndex ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: prevImage.url } as any } as any)))
      );
      slidesRef.current = slidesRef.current.map((s, i) =>
        i !== slideIndex ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: prevImage.url } as any } as any)
      );

      // Debounced persist (500ms) after user finishes moving/resizing the image.
      if (imageMoveSaveTimeoutRef.current) window.clearTimeout(imageMoveSaveTimeoutRef.current);
      const projectIdAtSchedule = currentProjectId;
      const slideIndexAtSchedule = slideIndex;
      const layoutAtSchedule = nextLayout;
      imageMoveSaveTimeoutRef.current = window.setTimeout(() => {
        void saveSlidePatchForProject(projectIdAtSchedule, slideIndexAtSchedule, { layoutSnapshot: layoutAtSchedule });
      }, 500);

      // Enhanced-only: optional safety-guarded auto realign when the user releases the image.
      scheduleAutoRealignAfterRelease({
        projectIdAtRelease: currentProjectId,
        slideIndexAtRelease: slideIndex,
        templateTypeId,
        getSlideState: () => {
          const cur = (slidesRef.current?.[slideIndex] as any) || {};
          return { layoutLocked: !!cur.layoutLocked, autoRealignOnImageRelease: !!cur.autoRealignOnImageRelease };
        },
        switchingSlides,
        copyGenerating,
        realigning,
        runRealignTextForActiveSlide,
      });
    },
    [
      EMPTY_LAYOUT,
      activeSlideIndex,
      aiKey,
      copyGenerating,
      currentProjectId,
      layoutData,
      pushUndoSnapshot,
      realigning,
      runRealignTextForActiveSlide,
      saveSlidePatchForProject,
      scheduleAutoRealignAfterRelease,
      setLayoutData,
      setSlides,
      slideCount,
      slidesRef,
      switchingSlides,
      templateTypeId,
    ]
  );

  return {
    uploadImageForActiveSlide,
    insertRecentImageForActiveSlide,
    setActiveSlideImageBgRemoval,
    deleteImageForActiveSlide,
    handleUserImageChange,
  };
}

