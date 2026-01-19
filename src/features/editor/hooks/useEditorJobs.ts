'use client';

import { useGenerateAiImage } from './useGenerateAiImage';
import { useGenerateCopy } from './useGenerateCopy';
import { useGenerateImagePrompts } from './useGenerateImagePrompts';

export function useEditorJobs(params: {
  // Identity
  currentProjectId: string | null;
  currentProjectIdRef: { current: string | null };
  activeSlideIndex: number;
  activeSlideIndexRef: { current: number };
  templateTypeId: 'regular' | 'enhanced';
  slideCount: number;

  // Shared infra
  fetchJson: (path: string, init?: RequestInit) => Promise<any>;
  getAuthToken: () => Promise<string | null>;
  addLog: (msg: string) => void;

  // Slides
  slidesRef: { current: any[] };
  initSlide: () => any;
  setSlides: (updater: any) => void;
  setCaptionDraft: (caption: string) => void;
  refreshProjectsList: () => Promise<void> | void;
  enqueueLiveLayoutForProject: (projectId: string, indices: number[]) => void;

  // AI image prompts
  // (hook manages persistence via API route; we only need setSlides for UI updates)

  // AI image generation (Enhanced only)
  aiKey: (projectId: string, slideIndex: number) => string;
  getDraftAiImagePromptForSlide: (slideIndex: number) => string;
  computeTemplateIdForSlide: (slideIndex: number) => string | null;
  templateSnapshots: Record<string, any>;
  computeDefaultUploadedImagePlacement: (
    templateSnapshot: any | null,
    w: number,
    h: number
  ) => { x: number; y: number; width: number; height: number };
  EMPTY_LAYOUT: any;
  layoutData: any;
  setLayoutData: (next: any) => void;
  saveSlidePatchForProject: (projectId: string, slideIndex: number, patch: { layoutSnapshot?: any }) => Promise<boolean>;
}) {
  const {
    runGenerateImagePrompts,
    imagePromptGeneratingAll,
    imagePromptErrorAll,
    imagePromptGeneratingThis,
    imagePromptErrorThis,
    imagePromptGenerating,
    imagePromptError,
  } = useGenerateImagePrompts({
    currentProjectId: params.currentProjectId,
    currentProjectIdRef: params.currentProjectIdRef,
    activeSlideIndex: params.activeSlideIndex,
    templateTypeId: params.templateTypeId,
    fetchJson: params.fetchJson,
    addLog: params.addLog,
    setSlides: params.setSlides,
  });

  const { runGenerateCopy, copyGenerating, copyError, copyProgressState, copyProgressLabel } = useGenerateCopy({
    currentProjectId: params.currentProjectId,
    currentProjectIdRef: params.currentProjectIdRef,
    templateTypeId: params.templateTypeId,
    slideCount: params.slideCount,
    slidesRef: params.slidesRef as any,
    initSlide: params.initSlide as any,
    setSlides: params.setSlides,
    setCaptionDraft: params.setCaptionDraft,
    refreshProjectsList: params.refreshProjectsList,
    enqueueLiveLayoutForProject: params.enqueueLiveLayoutForProject,
    runGenerateImagePrompts,
    fetchJson: params.fetchJson,
    addLog: params.addLog,
  });

  const { runGenerateAiImage, aiImageGeneratingThis, aiImageProgressThis, aiImageStatusThis, aiImageErrorThis } =
    useGenerateAiImage({
      currentProjectId: params.currentProjectId,
      currentProjectIdRef: params.currentProjectIdRef,
      activeSlideIndex: params.activeSlideIndex,
      activeSlideIndexRef: params.activeSlideIndexRef,
      templateTypeId: params.templateTypeId,
      aiKey: params.aiKey,
      getAuthToken: params.getAuthToken,
      addLog: params.addLog,
      getDraftAiImagePromptForSlide: params.getDraftAiImagePromptForSlide,
      computeTemplateIdForSlide: params.computeTemplateIdForSlide,
      templateSnapshots: params.templateSnapshots,
      computeDefaultUploadedImagePlacement: params.computeDefaultUploadedImagePlacement,
      EMPTY_LAYOUT: params.EMPTY_LAYOUT,
      layoutData: params.layoutData,
      setLayoutData: params.setLayoutData,
      slidesRef: params.slidesRef as any,
      setSlides: params.setSlides,
      saveSlidePatchForProject: params.saveSlidePatchForProject,
    });

  return {
    // Image prompts
    runGenerateImagePrompts,
    imagePromptGeneratingAll,
    imagePromptErrorAll,
    imagePromptGeneratingThis,
    imagePromptErrorThis,
    imagePromptGenerating,
    imagePromptError,

    // Copy
    runGenerateCopy,
    copyGenerating,
    copyError,
    copyProgressState,
    copyProgressLabel,

    // AI image
    runGenerateAiImage,
    aiImageGeneratingThis,
    aiImageProgressThis,
    aiImageStatusThis,
    aiImageErrorThis,
  };
}

