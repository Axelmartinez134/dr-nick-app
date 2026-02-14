'use client';

import { useCallback } from 'react';
import * as projectsApi from '../services/projectsApi';
import type { SlideState } from '../state';

export function useProjectLifecycle(params: {
  fetchJson: projectsApi.FetchJson;
  slideCount: number;

  // Slide state
  initSlide: () => SlideState;
  slidesRef: { current: SlideState[] };
  setSlides: (next: SlideState[]) => void;
  setActiveSlideIndex: (i: number) => void;

  // Project state setters
  setCurrentProjectId: (id: string | null) => void;
  setProjectTitle: (title: string) => void;
  setTemplateTypeId: (id: 'regular' | 'enhanced') => void;
  setCaptionDraft: (caption: string) => void;
  setOutreachMessageDraft: (msg: string) => void;
  setIsOutreachProject: (next: boolean) => void;
  setProjectPromptSnapshot: (prompt: string) => void;
  setProjectMappingSlide1: (id: string | null) => void;
  setProjectMappingSlide2to5: (id: string | null) => void;
  setProjectMappingSlide6: (id: string | null) => void;
  setProjectsDropdownOpen: (open: boolean) => void;
  setProjectBackgroundEffectEnabled: (next: boolean) => void;
  setProjectBackgroundEffectType: (next: "none" | "dots_n8n") => void;
  setProjectBackgroundColor: (next: string) => void;
  setProjectTextColor: (next: string) => void;
  setProjectBackgroundEffectSettings: (next: any) => void;
  setThemeIdLastApplied: (next: string | null) => void;
  setThemeIsCustomized: (next: boolean) => void;
  setThemeDefaultsSnapshot: (next: any | null) => void;
  setLastManualBackgroundColor: (next: string | null) => void;
  setLastManualTextColor: (next: string | null) => void;
  setAiImageAutoRemoveBgEnabled: (next: boolean) => void;

  // Review / Approval (project-level)
  setReviewReady: (next: boolean) => void;
  setReviewPosted: (next: boolean) => void;
  setReviewApproved: (next: boolean) => void;
  setReviewScheduled: (next: boolean) => void;
  setReviewComment: (next: string) => void;
  setReviewSource: (next: string) => void;

  // Engine state setters
  setLayoutData: (v: any) => void;
  setInputData: (v: any) => void;
  setLayoutHistory: (v: any) => void;
  handleNewCarousel: () => void;

  // Input snapshot helpers
  getLayoutLockedFromInput: (inputSnap: any) => boolean;
  getAutoRealignOnImageReleaseFromInput: (inputSnap: any) => boolean;

  // Projects list refresh (ref to avoid circular deps with useProjects hook)
  refreshProjectsListRef: { current: null | (() => Promise<void>) };
}) {
  const {
    fetchJson,
    slideCount,
    initSlide,
    slidesRef,
    setSlides,
    setActiveSlideIndex,
    setCurrentProjectId,
    setProjectTitle,
    setTemplateTypeId,
    setCaptionDraft,
    setOutreachMessageDraft,
    setIsOutreachProject,
    setProjectPromptSnapshot,
    setProjectMappingSlide1,
    setProjectMappingSlide2to5,
    setProjectMappingSlide6,
    setProjectsDropdownOpen,
    setProjectBackgroundEffectEnabled,
    setProjectBackgroundEffectType,
    setProjectBackgroundColor,
    setProjectTextColor,
    setProjectBackgroundEffectSettings,
    setThemeIdLastApplied,
    setThemeIsCustomized,
    setThemeDefaultsSnapshot,
    setLastManualBackgroundColor,
    setLastManualTextColor,
    setAiImageAutoRemoveBgEnabled,
    setReviewReady,
    setReviewPosted,
    setReviewApproved,
    setReviewScheduled,
    setReviewComment,
    setReviewSource,
    setLayoutData,
    setInputData,
    setLayoutHistory,
    handleNewCarousel,
    getLayoutLockedFromInput,
    getAutoRealignOnImageReleaseFromInput,
    refreshProjectsListRef,
  } = params;

  const loadProject = useCallback(
    async (projectId: string) => {
      const data = await projectsApi.loadProject(fetchJson, projectId);
      const project = data.project;
      const loadedSlides = data.slides || [];
      setCurrentProjectId(project.id);
      setProjectTitle(project.title || 'Untitled Project');
      setTemplateTypeId(project.template_type_id === 'enhanced' ? 'enhanced' : 'regular');
      setCaptionDraft(project.caption || '');
      const outreachMessageRaw = (project as any)?.outreach_message;
      setOutreachMessageDraft(String(outreachMessageRaw || ''));
      // Outreach-only UI should remain visible even if the message is cleared to an empty string.
      setIsOutreachProject(outreachMessageRaw !== null && outreachMessageRaw !== undefined);

      // Apply snapshot mapping for render/layout to avoid morphing
      setProjectMappingSlide1(project.slide1_template_id_snapshot ?? null);
      setProjectMappingSlide2to5(project.slide2_5_template_id_snapshot ?? null);
      setProjectMappingSlide6(project.slide6_template_id_snapshot ?? null);
      setProjectPromptSnapshot(project.prompt_snapshot || '');
      setProjectBackgroundEffectEnabled(!!(project as any)?.background_effect_enabled);
      setProjectBackgroundEffectType(String((project as any)?.background_effect_type || 'none') === 'dots_n8n' ? 'dots_n8n' : 'none');
      // Phase 3: hydrate project-wide colors from carousel_projects (canonical).
      setProjectBackgroundColor(String((project as any)?.project_background_color || '#ffffff'));
      setProjectTextColor(String((project as any)?.project_text_color || '#000000'));
      // Phase 4: hydrate theme/effect settings + provenance.
      setProjectBackgroundEffectSettings(((project as any)?.background_effect_settings as any) ?? {});
      setThemeIdLastApplied(((project as any)?.theme_id_last_applied as any) ?? null);
      setThemeIsCustomized(!!(project as any)?.theme_is_customized);
      setThemeDefaultsSnapshot(((project as any)?.theme_defaults_snapshot as any) ?? null);
      setLastManualBackgroundColor(((project as any)?.last_manual_background_color as any) ?? null);
      setLastManualTextColor(((project as any)?.last_manual_text_color as any) ?? null);
      setAiImageAutoRemoveBgEnabled(((project as any)?.ai_image_autoremovebg_enabled as any) !== false);
      setReviewReady(!!(project as any)?.review_ready);
      setReviewPosted(!!(project as any)?.review_posted);
      setReviewApproved(!!(project as any)?.review_approved);
      setReviewScheduled(!!(project as any)?.review_scheduled);
      setReviewComment(String((project as any)?.review_comment || ''));
      setReviewSource(String((project as any)?.review_source || ''));

      const nextSlides: SlideState[] = Array.from({ length: slideCount }).map((_, i) => {
        const prev = slidesRef.current[i] || initSlide();
        const row = loadedSlides.find((r: any) => r.slide_index === i);
        const layoutSnap = row?.layout_snapshot ?? null;
        const inputSnap = row?.input_snapshot ?? null;
        const loadedHeadline = row?.headline || '';
        const loadedBody = row?.body || '';
        const loadedAiImagePrompt = row?.ai_image_prompt || '';
        return {
          ...prev,
          savedHeadline: loadedHeadline,
          savedBody: loadedBody,
          draftHeadline: loadedHeadline,
          draftBody: loadedBody,
          draftHeadlineRanges: Array.isArray(inputSnap?.headlineStyleRanges) ? inputSnap.headlineStyleRanges : [],
          draftBodyRanges: Array.isArray(inputSnap?.bodyStyleRanges) ? inputSnap.bodyStyleRanges : [],
          draftHeadlineFontSizePx: Number.isFinite((inputSnap as any)?.headlineFontSizePx as any)
            ? Math.max(24, Math.min(120, Math.round(Number((inputSnap as any).headlineFontSizePx))))
            : 76,
          draftHeadlineTextAlign:
            String((inputSnap as any)?.headlineTextAlign || 'left') === 'center'
              ? 'center'
              : String((inputSnap as any)?.headlineTextAlign || 'left') === 'right'
                ? 'right'
                : 'left',
          draftBodyFontSizePx: Number.isFinite((inputSnap as any)?.bodyFontSizePx as any)
            ? Math.max(24, Math.min(120, Math.round(Number((inputSnap as any).bodyFontSizePx))))
            : 48,
          draftBodyTextAlign:
            String((inputSnap as any)?.bodyTextAlign || 'left') === 'center'
              ? 'center'
              : String((inputSnap as any)?.bodyTextAlign || 'left') === 'right'
                ? 'right'
                : 'left',
          layoutData: layoutSnap ? ({ success: true, layout: layoutSnap, imageUrl: null } as any) : null,
          inputData: inputSnap || null,
          layoutHistory: [],
          savedAiImagePrompt: loadedAiImagePrompt,
          draftAiImagePrompt: loadedAiImagePrompt,
          layoutLocked: getLayoutLockedFromInput(inputSnap || null),
          autoRealignOnImageRelease: getAutoRealignOnImageReleaseFromInput(inputSnap || null),
        } as any;
      });
      setSlides(nextSlides);
      slidesRef.current = nextSlides;
      setActiveSlideIndex(0);
      // Restore slide 1 (index 0) snapshots into the engine immediately.
      if (nextSlides[0]?.layoutData && (nextSlides[0] as any)?.inputData) {
        setLayoutData((nextSlides[0] as any).layoutData);
        setInputData((nextSlides[0] as any).inputData);
        setLayoutHistory(((nextSlides[0] as any).layoutHistory || []) as any);
      } else {
        handleNewCarousel();
      }
    },
    [
      fetchJson,
      getAutoRealignOnImageReleaseFromInput,
      getLayoutLockedFromInput,
      handleNewCarousel,
      initSlide,
      setActiveSlideIndex,
      setCaptionDraft,
      setCurrentProjectId,
      setInputData,
      setLayoutData,
      setLayoutHistory,
      setProjectMappingSlide1,
      setProjectMappingSlide2to5,
      setProjectMappingSlide6,
      setProjectPromptSnapshot,
      setProjectTitle,
      setSlides,
      setTemplateTypeId,
      slideCount,
      slidesRef,
    ]
  );

  const createNewProject = useCallback(
    async (type: 'regular' | 'enhanced') => {
      const data = await projectsApi.createProject(fetchJson, { templateTypeId: type, title: 'Untitled Project' });
      const project = data.project;
      const slidesRows = data.slides || [];
      setCurrentProjectId(project.id);
      setProjectTitle(project.title || 'Untitled Project');
      setTemplateTypeId(project.template_type_id === 'enhanced' ? 'enhanced' : 'regular');
      setCaptionDraft(project.caption || '');
      setOutreachMessageDraft(String((project as any)?.outreach_message || ''));
      setIsOutreachProject(((project as any)?.outreach_message) !== null && ((project as any)?.outreach_message) !== undefined);
      setProjectPromptSnapshot(project.prompt_snapshot || '');
      setProjectMappingSlide1(project.slide1_template_id_snapshot ?? null);
      setProjectMappingSlide2to5(project.slide2_5_template_id_snapshot ?? null);
      setProjectMappingSlide6(project.slide6_template_id_snapshot ?? null);
      setProjectBackgroundEffectEnabled(!!(project as any)?.background_effect_enabled);
      setProjectBackgroundEffectType(String((project as any)?.background_effect_type || 'none') === 'dots_n8n' ? 'dots_n8n' : 'none');
      // Phase 3: hydrate project-wide colors from carousel_projects (canonical).
      setProjectBackgroundColor(String((project as any)?.project_background_color || '#ffffff'));
      setProjectTextColor(String((project as any)?.project_text_color || '#000000'));
      // Phase 4: hydrate theme/effect settings + provenance.
      setProjectBackgroundEffectSettings(((project as any)?.background_effect_settings as any) ?? {});
      setThemeIdLastApplied(((project as any)?.theme_id_last_applied as any) ?? null);
      setThemeIsCustomized(!!(project as any)?.theme_is_customized);
      setThemeDefaultsSnapshot(((project as any)?.theme_defaults_snapshot as any) ?? null);
      setLastManualBackgroundColor(((project as any)?.last_manual_background_color as any) ?? null);
      setLastManualTextColor(((project as any)?.last_manual_text_color as any) ?? null);
      setAiImageAutoRemoveBgEnabled(((project as any)?.ai_image_autoremovebg_enabled as any) !== false);
      setReviewReady(!!(project as any)?.review_ready);
      setReviewPosted(!!(project as any)?.review_posted);
      setReviewApproved(!!(project as any)?.review_approved);
      setReviewScheduled(!!(project as any)?.review_scheduled);
      setReviewComment(String((project as any)?.review_comment || ''));
      setReviewSource(String((project as any)?.review_source || ''));
      const nextSlides: SlideState[] = Array.from({ length: slideCount }).map((_, i) => {
        const prev = slidesRef.current[i] || initSlide();
        const row = slidesRows.find((r: any) => r.slide_index === i);
        const loadedHeadline = row?.headline || '';
        const loadedBody = row?.body || '';
        const loadedAiImagePrompt = row?.ai_image_prompt || '';
        return {
          ...prev,
          savedHeadline: loadedHeadline,
          savedBody: loadedBody,
          draftHeadline: loadedHeadline,
          draftBody: loadedBody,
          draftHeadlineRanges: [],
          draftBodyRanges: [],
          draftHeadlineFontSizePx: 76,
          draftHeadlineTextAlign: 'left',
          draftBodyFontSizePx: 48,
          draftBodyTextAlign: 'left',
          layoutData: null,
          inputData: null,
          layoutHistory: [],
          error: null,
          debugLogs: [],
          debugScreenshot: null,
          savedAiImagePrompt: loadedAiImagePrompt,
          draftAiImagePrompt: loadedAiImagePrompt,
          layoutLocked: false,
          autoRealignOnImageRelease: false,
        } as any;
      });
      setSlides(nextSlides);
      slidesRef.current = nextSlides;
      setActiveSlideIndex(0);
      setProjectsDropdownOpen(false);
      await refreshProjectsListRef.current?.();
      handleNewCarousel();
    },
    [
      fetchJson,
      handleNewCarousel,
      initSlide,
      refreshProjectsListRef,
      setActiveSlideIndex,
      setCaptionDraft,
      setCurrentProjectId,
      setProjectMappingSlide1,
      setProjectMappingSlide2to5,
      setProjectMappingSlide6,
      setProjectPromptSnapshot,
      setProjectTitle,
      setProjectsDropdownOpen,
      setSlides,
      setTemplateTypeId,
      slideCount,
      slidesRef,
      setProjectBackgroundColor,
      setProjectTextColor,
      setProjectBackgroundEffectSettings,
      setThemeIdLastApplied,
      setThemeIsCustomized,
      setThemeDefaultsSnapshot,
      setLastManualBackgroundColor,
      setLastManualTextColor,
    ]
  );

  return { loadProject, createNewProject };
}

