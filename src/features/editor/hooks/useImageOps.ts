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
  handleUserExtraImageChange: (change: {
    canvasSlideIndex?: number;
    imageId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    angle?: number;
  }) => void;
  removeImagesFromSlide: (args: {
    slideIndex?: number;
    removePrimary?: boolean;
    removeStickerIds?: string[];
    reason?: 'menu' | 'button' | 'key';
  }) => Promise<void>;
  promoteStickerToPrimary: (args: { slideIndex?: number; stickerId: string }) => Promise<void>;
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

  const solidMask128 = useCallback(() => {
    const w = 128;
    const h = 128;
    const u8 = new Uint8Array(w * h);
    u8.fill(255);
    try {
      // eslint-disable-next-line no-undef
      const btoaFn = (globalThis as any).btoa || btoa;
      let bin = '';
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      const dataB64 = btoaFn(bin);
      return { w, h, dataB64, alphaThreshold: 0 };
    } catch {
      // Best-effort: overlays will treat missing dataB64 as "no mask", but we try to avoid crashes.
      return { w, h, dataB64: '', alphaThreshold: 0 };
    }
  }, []);

  const makeImageId = useCallback(() => {
    try {
      const v = (globalThis as any)?.crypto?.randomUUID?.();
      if (v) return String(v);
    } catch {
      // ignore
    }
    return `img_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }, []);

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

        const activeAccountId = (() => {
          try {
            return typeof localStorage !== 'undefined' ? String(localStorage.getItem('editor.activeAccountId') || '').trim() : '';
          } catch {
            return '';
          }
        })();

        const res = await fetch('/api/editor/projects/slides/image/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, ...(activeAccountId ? { 'x-account-id': activeAccountId } : {}) },
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
        const hasPrimary = !!String((latestBaseLayout as any)?.image?.url || '').trim();
        const primaryUrl = String((latestBaseLayout as any)?.image?.url || '').trim() || null;

        // Multi-image Phase 1:
        // - If no primary exists yet: set `layout.image` (unchanged behavior).
        // - If primary exists: append a sticker image to `layout.extraImages[]` and keep `layout.image` untouched.
        const nextLayout = (() => {
          if (!hasPrimary) {
            return {
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
          }

          const sticker: any = {
            id: makeImageId(),
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
          };

          const prevExtras = Array.isArray((latestBaseLayout as any)?.extraImages) ? ([...(latestBaseLayout as any).extraImages] as any[]) : [];
          return { ...latestBaseLayout, extraImages: [...prevExtras, sticker] };
        })();

        // Only apply UI updates if the user is still viewing this project.
        if (currentProjectIdRef.current === projectIdAtStart) {
          setSlides((prev: any[]) =>
            prev.map((s, i) =>
              i !== slideIndexAtStart
                ? s
                : {
                    ...s,
                    layoutData: { success: true, layout: nextLayout, imageUrl: hasPrimary ? primaryUrl : url } as any,
                  }
            )
          );
          slidesRef.current = slidesRef.current.map((s, i) =>
            i !== slideIndexAtStart
              ? s
              : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: hasPrimary ? primaryUrl : url } as any } as any)
          );
          if (activeSlideIndexRef.current === slideIndexAtStart) {
            setLayoutData({ success: true, layout: nextLayout, imageUrl: hasPrimary ? primaryUrl : url } as any);
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

        // Always keep a mask so Show Layout Overlays can visualize the wrap area,
        // even when BG removal is OFF (logos/recents frequently insert with bgRemoval OFF).
        if (!(nextImg as any).mask) (nextImg as any).mask = solidMask128();
        if (!bgRemovalEnabledAtInsert) {
          if ((nextImg as any).processed) delete (nextImg as any).processed;
        }

        const hasPrimary = !!String((latestBaseLayout as any)?.image?.url || '').trim();
        const primaryUrl = String((latestBaseLayout as any)?.image?.url || '').trim() || null;

        // Multi-image Phase 1:
        // - If no primary exists yet: set `layout.image` (unchanged behavior).
        // - If primary exists: append a sticker to `layout.extraImages[]` and keep `layout.image` untouched.
        // NOTE: BG removal at insert currently only works for the primary image (via setActiveSlideImageBgRemoval).
        // For stickers we store as-is for now (no insert-time BG removal).
        const nextLayout = (() => {
          if (!hasPrimary) return { ...latestBaseLayout, image: nextImg };
          const sticker: any = { ...nextImg, id: makeImageId(), bgRemovalEnabled: false, bgRemovalStatus: 'disabled' };
          if (!(sticker as any).mask) (sticker as any).mask = solidMask128();
          const prevExtras = Array.isArray((latestBaseLayout as any)?.extraImages) ? ([...(latestBaseLayout as any).extraImages] as any[]) : [];
          return { ...latestBaseLayout, extraImages: [...prevExtras, sticker] };
        })();

        if (currentProjectIdRef.current === projectIdAtStart) {
          setSlides((prev: any[]) =>
            prev.map((s, i) =>
              i !== slideIndexAtStart
                ? s
                : { ...s, layoutData: { success: true, layout: nextLayout, imageUrl: hasPrimary ? primaryUrl : url } as any }
            )
          );
          slidesRef.current = slidesRef.current.map((s, i) =>
            i !== slideIndexAtStart
              ? s
              : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: hasPrimary ? primaryUrl : url } as any } as any)
          );
          if (activeSlideIndexRef.current === slideIndexAtStart) {
            setLayoutData({ success: true, layout: nextLayout, imageUrl: hasPrimary ? primaryUrl : url } as any);
          }
          // Only mark "active image selected" when setting the primary slot.
          if (!hasPrimary) setActiveImageSelected(true);
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

        if (bgRemovalEnabledAtInsert && !hasPrimary) {
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
      makeImageId,
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

      const debugWrap =
        (() => {
          try {
            // Local-only debugging: enable with `localStorage.setItem('dn_debug_wrap', '1')`
            // and disable with `localStorage.removeItem('dn_debug_wrap')`.
            return typeof window !== 'undefined' && window.localStorage?.getItem('dn_debug_wrap') === '1';
          } catch {
            return false;
          }
        })();

      // Debug: track image drag updates + whether this will schedule auto realign on release (Enhanced only).
      if (debugWrap) {
        try {
          const s = slidesRef.current?.[slideIndex] || {};
          const auto = !!(s as any)?.autoRealignOnImageRelease;
          const locked = !!(s as any)?.layoutLocked;
          addLog(
            `🖼️ IMG change slide ${slideIndex + 1}: ` +
              `prev=(${Math.round(Number(prevImage?.x ?? 0))},${Math.round(Number(prevImage?.y ?? 0))}) ${Math.round(Number(prevImage?.width ?? 0))}x${Math.round(Number(prevImage?.height ?? 0))} ` +
              `next=(${Math.round(Number(change.x ?? 0))},${Math.round(Number(change.y ?? 0))}) ${Math.round(Number(change.width ?? 0))}x${Math.round(Number(change.height ?? 0))} ` +
              `angle=${Number.isFinite(change.angle as any) ? Math.round(Number(change.angle)) : 0} ` +
              `type=${templateTypeId} autoRealign=${auto ? '1' : '0'} locked=${locked ? '1' : '0'}`
          );
        } catch {
          // ignore
        }
      }

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
      if (debugWrap) {
        try {
          const s = slidesRef.current?.[slideIndex] || {};
          addLog(
            `🧲 AutoRealign check slide ${slideIndex + 1}: type=${templateTypeId} ` +
              `auto=${!!(s as any)?.autoRealignOnImageRelease ? '1' : '0'} locked=${!!(s as any)?.layoutLocked ? '1' : '0'}`
          );
        } catch {
          // ignore
        }
      }
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

  const handleUserExtraImageChange = useCallback(
    (change: {
      canvasSlideIndex?: number;
      imageId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      angle?: number;
    }) => {
      if (!currentProjectId) return;
      const slideIndex = Number.isInteger((change as any)?.canvasSlideIndex) ? Number((change as any).canvasSlideIndex) : activeSlideIndex;
      if (slideIndex < 0 || slideIndex >= slideCount) return;
      const imageId = String((change as any)?.imageId || '').trim();
      if (!imageId) return;

      const currentLayoutState =
        slideIndex === activeSlideIndex ? (layoutData as any) : ((slidesRef.current?.[slideIndex] as any)?.layoutData as any);
      const baseLayout = currentLayoutState?.layout ? { ...currentLayoutState.layout } : { ...EMPTY_LAYOUT };
      const prevExtrasRaw = (baseLayout as any)?.extraImages;
      const prevExtras = Array.isArray(prevExtrasRaw) ? ([...prevExtrasRaw] as any[]) : [];
      if (prevExtras.length === 0) return;
      const idx = prevExtras.findIndex((x) => String(x?.id || '') === imageId);
      if (idx < 0) return;

      const prev = prevExtras[idx] || {};

      // Enable Undo for image moves/resizes/rotations too. Push only when bounds actually changed.
      try {
        const eps = 0.5;
        const didMove =
          Math.abs(Number(prev?.x ?? 0) - Number(change.x ?? 0)) > eps ||
          Math.abs(Number(prev?.y ?? 0) - Number(change.y ?? 0)) > eps;
        const didResize =
          Math.abs(Number(prev?.width ?? 0) - Number(change.width ?? 0)) > eps ||
          Math.abs(Number(prev?.height ?? 0) - Number(change.height ?? 0)) > eps;
        const didRotate = Math.abs(Number(prev?.angle ?? 0) - Number(change.angle ?? 0)) > eps;
        if (didMove || didResize || didRotate) pushUndoSnapshot();
      } catch {
        pushUndoSnapshot();
      }

      const nextOne = {
        ...prev,
        x: Math.round(Number(change.x) || 0),
        y: Math.round(Number(change.y) || 0),
        width: Math.max(1, Math.round(Number(change.width) || 1)),
        height: Math.max(1, Math.round(Number(change.height) || 1)),
        angle: Number(change.angle) || 0,
      };
      prevExtras[idx] = nextOne;
      const nextLayout = { ...baseLayout, extraImages: prevExtras };

      if (slideIndex === activeSlideIndex) {
        const primaryUrl = String((nextLayout as any)?.image?.url || '').trim() || null;
        setLayoutData({ success: true, layout: nextLayout, imageUrl: primaryUrl } as any);
      }
      setSlides((prevArr: any[]) =>
        prevArr.map((s, i) =>
          i !== slideIndex
            ? s
            : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: String((nextLayout as any)?.image?.url || '').trim() || null } as any } as any)
        )
      );
      slidesRef.current = slidesRef.current.map((s, i) =>
        i !== slideIndex
          ? s
          : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: String((nextLayout as any)?.image?.url || '').trim() || null } as any } as any)
      );

      // Debounced persist (500ms) after user finishes moving/resizing the sticker.
      if (imageMoveSaveTimeoutRef.current) window.clearTimeout(imageMoveSaveTimeoutRef.current);
      const projectIdAtSchedule = currentProjectId;
      const slideIndexAtSchedule = slideIndex;
      const layoutAtSchedule = nextLayout;
      imageMoveSaveTimeoutRef.current = window.setTimeout(() => {
        void saveSlidePatchForProject(projectIdAtSchedule, slideIndexAtSchedule, { layoutSnapshot: layoutAtSchedule });
      }, 500);
    },
    [
      EMPTY_LAYOUT,
      activeSlideIndex,
      currentProjectId,
      layoutData,
      pushUndoSnapshot,
      saveSlidePatchForProject,
      setLayoutData,
      setSlides,
      slideCount,
      slidesRef,
    ]
  );

  const removeImagesFromSlide = useCallback(
    async (args: { slideIndex?: number; removePrimary?: boolean; removeStickerIds?: string[]; reason?: 'menu' | 'button' | 'key' }) => {
      if (!currentProjectId) return;
      const slideIndex = Number.isInteger(args?.slideIndex as any) ? Number(args.slideIndex) : activeSlideIndex;
      if (slideIndex < 0 || slideIndex >= slideCount) return;
      const removePrimary = !!args?.removePrimary;
      const removeStickerIds = Array.isArray(args?.removeStickerIds) ? (args.removeStickerIds as string[]) : [];
      if (!removePrimary && removeStickerIds.length === 0) return;

      const projectIdAtStart = currentProjectId;
      const baseLayoutState =
        slideIndex === activeSlideIndex ? (layoutData as any) : ((slidesRef.current?.[slideIndex] as any)?.layoutData as any);
      const baseLayout = baseLayoutState?.layout ? { ...baseLayoutState.layout } : { ...EMPTY_LAYOUT };

      const nextLayout: any = { ...baseLayout };
      if (removePrimary && nextLayout.image) delete nextLayout.image;
      if (removeStickerIds.length > 0) {
        const prevExtrasRaw = nextLayout.extraImages;
        const prevExtras = Array.isArray(prevExtrasRaw) ? (prevExtrasRaw as any[]) : [];
        nextLayout.extraImages = prevExtras.filter((x) => !removeStickerIds.includes(String(x?.id || '')));
      }

      // If extras is now empty, keep it but allow it to be cleaned up later.
      const primaryUrl = String(nextLayout?.image?.url || '').trim() || null;

      if (currentProjectIdRef.current === projectIdAtStart) {
        setSlides((prevArr: any[]) =>
          prevArr.map((s, i) =>
            i !== slideIndex ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: primaryUrl } as any } as any)
          )
        );
        slidesRef.current = slidesRef.current.map((s, i) =>
          i !== slideIndex ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: primaryUrl } as any } as any)
        );
        if (activeSlideIndexRef.current === slideIndex) {
          setLayoutData({ success: true, layout: nextLayout, imageUrl: primaryUrl } as any);
        }
      }

      // Persist
      await saveSlidePatchForProject(projectIdAtStart, slideIndex, { layoutSnapshot: nextLayout });
    },
    [
      EMPTY_LAYOUT,
      activeSlideIndex,
      activeSlideIndexRef,
      currentProjectId,
      currentProjectIdRef,
      layoutData,
      saveSlidePatchForProject,
      setLayoutData,
      setSlides,
      slideCount,
      slidesRef,
    ]
  );

  const promoteStickerToPrimary = useCallback(
    async (args: { slideIndex?: number; stickerId: string }) => {
      if (!currentProjectId) return;
      const slideIndex = Number.isInteger(args?.slideIndex as any) ? Number(args.slideIndex) : activeSlideIndex;
      if (slideIndex < 0 || slideIndex >= slideCount) return;
      const stickerId = String(args?.stickerId || '').trim();
      if (!stickerId) return;

      const projectIdAtStart = currentProjectId;
      const baseLayoutState =
        slideIndex === activeSlideIndex ? (layoutData as any) : ((slidesRef.current?.[slideIndex] as any)?.layoutData as any);
      const baseLayout = baseLayoutState?.layout ? { ...baseLayoutState.layout } : { ...EMPTY_LAYOUT };
      const prevExtrasRaw = (baseLayout as any)?.extraImages;
      const prevExtras = Array.isArray(prevExtrasRaw) ? ([...prevExtrasRaw] as any[]) : [];
      const idx = prevExtras.findIndex((x) => String(x?.id || '') === stickerId);
      if (idx < 0) return;

      const sticker = prevExtras[idx];
      const prevPrimary = (baseLayout as any)?.image || null;

      // Undo checkpoint (big semantic change).
      try {
        pushUndoSnapshot();
      } catch {
        // ignore
      }

      // Remove sticker from extras.
      const nextExtras = prevExtras.filter((x) => String(x?.id || '') !== stickerId);

      // Demote existing primary -> sticker (per Phase 4 spec).
      if (prevPrimary && String(prevPrimary?.url || '').trim()) {
        const demoted = { ...prevPrimary, id: makeImageId() };
        if (!(demoted as any).mask) (demoted as any).mask = solidMask128();
        nextExtras.push(demoted);
      }

      const nextPrimary = { ...sticker };
      // Primary does not need an id; keep it harmlessly if present.
      if (!(nextPrimary as any).mask) (nextPrimary as any).mask = solidMask128();

      const nextLayout: any = { ...baseLayout, image: nextPrimary, extraImages: nextExtras };

      const primaryUrl = String(nextPrimary?.url || '').trim() || null;
      if (currentProjectIdRef.current === projectIdAtStart) {
        setSlides((prevArr: any[]) =>
          prevArr.map((s, i) =>
            i !== slideIndex ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: primaryUrl } as any } as any)
          )
        );
        slidesRef.current = slidesRef.current.map((s, i) =>
          i !== slideIndex ? s : ({ ...s, layoutData: { success: true, layout: nextLayout, imageUrl: primaryUrl } as any } as any)
        );
        if (activeSlideIndexRef.current === slideIndex) {
          setLayoutData({ success: true, layout: nextLayout, imageUrl: primaryUrl } as any);
        }
      }

      await saveSlidePatchForProject(projectIdAtStart, slideIndex, { layoutSnapshot: nextLayout });
      addLog(`⭐ Set sticker as primary (slide ${slideIndex + 1})`);
      setActiveImageSelected(true);
    },
    [
      EMPTY_LAYOUT,
      activeSlideIndex,
      activeSlideIndexRef,
      addLog,
      currentProjectId,
      currentProjectIdRef,
      layoutData,
      makeImageId,
      pushUndoSnapshot,
      saveSlidePatchForProject,
      setActiveImageSelected,
      setLayoutData,
      setSlides,
      slideCount,
      slidesRef,
    ]
  );

  return {
    uploadImageForActiveSlide,
    insertRecentImageForActiveSlide,
    setActiveSlideImageBgRemoval,
    deleteImageForActiveSlide,
    handleUserImageChange,
    handleUserExtraImageChange,
    removeImagesFromSlide,
    promoteStickerToPrimary,
  };
}

