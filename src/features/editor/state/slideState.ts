import type { InlineStyleRange } from '@/app/editor/RichTextInput';

export type SlideState = {
  layoutData: any | null;
  inputData: any | null;
  layoutHistory: any[];
  error: string | null;
  debugLogs: string[];
  debugScreenshot: string | null;
  // Last-saved text values (used to avoid saving on slide-switch / hydration).
  savedHeadline: string;
  savedBody: string;
  draftHeadline: string;
  draftBody: string;
  draftHeadlineRanges: InlineStyleRange[];
  draftBodyRanges: InlineStyleRange[];
  draftHeadlineFontSizePx: number; // Enhanced only; persisted via input_snapshot.headlineFontSizePx
  draftHeadlineTextAlign: 'left' | 'center' | 'right'; // Enhanced only; persisted via input_snapshot.headlineTextAlign
  draftBodyFontSizePx: number; // Per-slide body font size; persisted via input_snapshot.bodyFontSizePx
  draftBodyTextAlign: 'left' | 'center' | 'right'; // persisted via input_snapshot.bodyTextAlign
  draftBg: string;
  draftText: string;
  // AI Image Prompt (Enhanced only) - per-slide prompt for image generation
  savedAiImagePrompt: string;
  draftAiImagePrompt: string;

  // Enhanced-only UX: when enabled, edits should NOT trigger reflow/realign for this slide.
  // Persisted in input_snapshot.editor.layoutLocked
  layoutLocked: boolean;

  // Enhanced-only UX: when enabled (and image selected), releasing an image move/resize/rotate
  // triggers the full "Realign Text" pipeline. Persisted in input_snapshot.editor.autoRealignOnImageRelease
  autoRealignOnImageRelease: boolean;
};

export function initSlide(): SlideState {
  return {
    layoutData: null,
    inputData: null,
    layoutHistory: [],
    error: null,
    debugLogs: [],
    debugScreenshot: null,
    savedHeadline: '',
    savedBody: '',
    draftHeadline: '',
    draftBody: '',
    draftHeadlineRanges: [],
    draftBodyRanges: [],
    draftHeadlineFontSizePx: 76,
    draftHeadlineTextAlign: 'left',
    draftBodyFontSizePx: 48,
    draftBodyTextAlign: 'left',
    draftBg: '#ffffff',
    draftText: '#000000',
    savedAiImagePrompt: '',
    draftAiImagePrompt: '',
    layoutLocked: false,
    autoRealignOnImageRelease: false,
  };
}

