'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { SlideState } from '../state';

type CopyUiState = 'idle' | 'running' | 'success' | 'error';
type CopyUi = { state: CopyUiState; label: string; error: string | null };

export function useGenerateCopy(params: {
  currentProjectId: string | null;
  currentProjectIdRef: { current: string | null };
  templateTypeId: 'regular' | 'enhanced';
  slideCount: number;
  slidesRef: { current: SlideState[] };
  initSlide: () => SlideState;
  setSlides: (next: SlideState[]) => void;
  setCaptionDraft: (caption: string) => void;
  refreshProjectsList: () => Promise<void> | void;
  enqueueLiveLayoutForProject: (projectId: string, indices: number[]) => void;
  runGenerateImagePrompts: (slideIndexOverride?: number) => Promise<void>;
  fetchJson: (path: string, init?: RequestInit) => Promise<any>;
  addLog: (msg: string) => void;
}) {
  const {
    currentProjectId,
    currentProjectIdRef,
    templateTypeId,
    slideCount,
    slidesRef,
    initSlide,
    setSlides,
    setCaptionDraft,
    refreshProjectsList,
    enqueueLiveLayoutForProject,
    runGenerateImagePrompts,
    fetchJson,
    addLog,
  } = params;

  const [copyByProject, setCopyByProject] = useState<Record<string, CopyUi>>({});
  const copyRunIdByProjectRef = useRef<Record<string, number>>({});
  const copyPollRefsByProjectRef = useRef<Record<string, number | null>>({});
  const copyResetRefsByProjectRef = useRef<Record<string, number | null>>({});

  const getCopyUi = useCallback(
    (projectId: string | null): CopyUi => {
      const pid = String(projectId || '').trim();
      if (!pid) return { state: 'idle', label: '', error: null };
      return copyByProject[pid] || { state: 'idle', label: '', error: null };
    },
    [copyByProject]
  );

  const setCopyUi = useCallback((projectId: string, patch: Partial<CopyUi>) => {
    const pid = String(projectId || '').trim();
    if (!pid) return;
    setCopyByProject((prev) => {
      const cur = prev[pid] || { state: 'idle' as CopyUiState, label: '', error: null };
      return { ...prev, [pid]: { ...cur, ...patch } };
    });
  }, []);

  const copyUiCurrent = useMemo(() => getCopyUi(currentProjectId), [currentProjectId, getCopyUi]);
  const copyGenerating = copyUiCurrent.state === 'running';
  const copyError = copyUiCurrent.error;
  const copyProgressState = copyUiCurrent.state;
  const copyProgressLabel = copyUiCurrent.label;

  const runGenerateCopy = useCallback(async () => {
    if (!currentProjectId) return;
    const projectIdAtStart = currentProjectId;
    const runId = (copyRunIdByProjectRef.current[projectIdAtStart] || 0) + 1;
    copyRunIdByProjectRef.current[projectIdAtStart] = runId;

    setCopyUi(projectIdAtStart, { state: 'running', label: 'Starting…', error: null });

    // Progress indicator: poll job status for true step updates (no schema changes).
    const prevPoll = copyPollRefsByProjectRef.current[projectIdAtStart];
    if (prevPoll) window.clearInterval(prevPoll);
    copyPollRefsByProjectRef.current[projectIdAtStart] = null;
    const prevReset = copyResetRefsByProjectRef.current[projectIdAtStart];
    if (prevReset) window.clearTimeout(prevReset);
    copyResetRefsByProjectRef.current[projectIdAtStart] = null;

    const stepLabelFor = (progressCode: string) => {
      const code = String(progressCode || '').toLowerCase();
      if (code.includes('poppy')) return 'Poppy is Cooking...';
      if (code.includes('parse')) return 'Parsing output…';
      if (code.includes('emphasis')) return 'Generating emphasis styles…';
      if (code.includes('save')) return 'Saving…';
      return 'Working…';
    };

    const pollOnce = async () => {
      try {
        // Ignore stale pollers for this project.
        if (copyRunIdByProjectRef.current[projectIdAtStart] !== runId) return;
        const j = await fetchJson(`/api/editor/projects/jobs/status?projectId=${encodeURIComponent(projectIdAtStart)}`, {
          method: 'GET',
        });
        const job = j?.activeJob || null;
        if (!job) return;
        const status = String(job.status || '');
        const err = String(job.error || '');
        // We reuse `error` while running to store "progress:<step>".
        if ((status === 'pending' || status === 'running') && err.startsWith('progress:')) {
          setCopyUi(projectIdAtStart, { label: stepLabelFor(err.slice('progress:'.length)) });
        } else if (status === 'pending') {
          setCopyUi(projectIdAtStart, { label: 'Queued…' });
        } else if (status === 'running') {
          setCopyUi(projectIdAtStart, { label: 'Working…' });
        } else if (status === 'completed') {
          setCopyUi(projectIdAtStart, { label: 'Done' });
        } else if (status === 'failed') {
          setCopyUi(projectIdAtStart, { label: 'Error' });
        }
      } catch {
        // ignore polling errors; Debug panel has details
      }
    };

    void pollOnce();
    copyPollRefsByProjectRef.current[projectIdAtStart] = window.setInterval(() => {
      void pollOnce();
    }, 500);

    try {
      addLog(`🤖 Generate Copy start: project=${projectIdAtStart} type=${templateTypeId.toUpperCase()}`);
      const data = await fetchJson('/api/editor/projects/jobs/generate-copy', {
        method: 'POST',
        body: JSON.stringify({ projectId: projectIdAtStart }),
      });
      // Ignore stale completions for this project.
      if (copyRunIdByProjectRef.current[projectIdAtStart] !== runId) return;
      const typeOut = data?.templateTypeId === 'enhanced' ? 'enhanced' : 'regular';
      addLog(
        `🤖 Generate Copy response: type=${String(typeOut).toUpperCase()} slides=${
          Array.isArray(data?.slides) ? data.slides.length : 0
        } captionLen=${String(data?.caption || '').length}`
      );
      if (data?.poppyRoutingMeta && typeof data.poppyRoutingMeta === 'object') {
        const b = String((data.poppyRoutingMeta as any)?.boardId || '');
        const c = String((data.poppyRoutingMeta as any)?.chatId || '');
        const m = String((data.poppyRoutingMeta as any)?.model || '');
        addLog(`🤖 Poppy routing used: board_id=${b || '-'} chat_id=${c || '-'} model=${m || '-'}`);
      }
      const slidesOut = data.slides || [];
      const nextSlides: SlideState[] = Array.from({ length: slideCount }).map((_, i) => {
        const prev = slidesRef.current[i] || initSlide();
        const out = slidesOut[i] || {};
        const nextHeadline = out.headline ?? '';
        const nextBody = out.body ?? '';
        const nextHeadlineRanges = Array.isArray(out.headlineStyleRanges) ? out.headlineStyleRanges : [];
        const nextBodyRanges = Array.isArray(out.bodyStyleRanges) ? out.bodyStyleRanges : [];
        addLog(
          `🧾 Slide ${i + 1} text: headlineLen=${String(nextHeadline).length} bodyLen=${String(nextBody).length} headlineRanges=${
            nextHeadlineRanges.length
          } bodyRanges=${nextBodyRanges.length}`
        );

        const previewRanges = (label: string, text: string, ranges: any[]) => {
          if (!Array.isArray(ranges) || !ranges.length || !text) return;
          // Show up to 6 ranges so logs stay readable.
          const max = Math.min(6, ranges.length);
          for (let r = 0; r < max; r++) {
            const rr = ranges[r] || {};
            const start = Number(rr.start);
            const end = Number(rr.end);
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
            const marks = [rr.bold ? 'bold' : null, rr.italic ? 'italic' : null, rr.underline ? 'underline' : null]
              .filter(Boolean)
              .join('+') || 'style';
            const slice = String(text).slice(start, end).replace(/\s+/g, ' ').trim();
            addLog(`   ↳ ${label} ${marks}: "${slice}" (${start}-${end})`);
          }
          if (ranges.length > max) addLog(`   ↳ ${label} … +${ranges.length - max} more range(s)`);
        };

        if (typeOut === 'enhanced') {
          previewRanges('headline', String(nextHeadline), nextHeadlineRanges);
        }
        previewRanges('body', String(nextBody), nextBodyRanges);

        return {
          ...prev,
          draftHeadline: nextHeadline,
          draftBody: nextBody,
          // Use AI-provided emphasis ranges so the editor + canvas show the final emphasized result immediately.
          draftHeadlineRanges: typeOut === 'enhanced' ? nextHeadlineRanges : [],
          draftBodyRanges: nextBodyRanges,
        };
      });

      // Apply UI updates ONLY if the user is still viewing this same project.
      if (currentProjectIdRef.current === projectIdAtStart) {
        setSlides(nextSlides);
        slidesRef.current = nextSlides;
        if (typeof data.caption === 'string') setCaptionDraft(data.caption);
        void refreshProjectsList();
        // Auto-layout all 6 slides sequentially (queued).
        addLog(`📐 Queue live layout for slides 1–6`);
        setCopyUi(projectIdAtStart, { label: 'Applying layouts…' });
        enqueueLiveLayoutForProject(projectIdAtStart, [0, 1, 2, 3, 4, 5]);
        // Generate AI image prompts for Enhanced template type (async, non-blocking)
        if (typeOut === 'enhanced') {
          addLog(`🎨 Triggering AI image prompt generation for Enhanced project`);
          void runGenerateImagePrompts();
        }
      }
      setCopyUi(projectIdAtStart, { state: 'success' });
    } catch (e: any) {
      addLog(`❌ Generate Copy failed: ${e?.message || 'unknown error'}`);
      setCopyUi(projectIdAtStart, {
        state: 'error',
        error: e?.message || 'Generate Copy failed',
        label: 'Error',
      });
    } finally {
      const poll = copyPollRefsByProjectRef.current[projectIdAtStart];
      if (poll) window.clearInterval(poll);
      copyPollRefsByProjectRef.current[projectIdAtStart] = null;
      // Leave a brief success/error state so users see completion.
      copyResetRefsByProjectRef.current[projectIdAtStart] = window.setTimeout(() => {
        // Only reset if no newer run started for this project.
        if (copyRunIdByProjectRef.current[projectIdAtStart] !== runId) return;
        setCopyUi(projectIdAtStart, { state: 'idle', label: '' });
      }, 1400);
    }
  }, [
    addLog,
    currentProjectId,
    currentProjectIdRef,
    enqueueLiveLayoutForProject,
    fetchJson,
    initSlide,
    refreshProjectsList,
    runGenerateImagePrompts,
    setCaptionDraft,
    setCopyUi,
    setSlides,
    slideCount,
    slidesRef,
    templateTypeId,
  ]);

  return {
    runGenerateCopy,
    copyGenerating,
    copyError,
    copyProgressState,
    copyProgressLabel,
  };
}

