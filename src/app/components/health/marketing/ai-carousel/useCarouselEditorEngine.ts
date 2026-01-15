'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../auth/AuthContext';
import { CarouselTextRequest, LayoutResponse } from '@/lib/carousel-types';
import type { CarouselTemplateDefinitionV1 } from '@/lib/carousel-template-types';
import { ensureTypographyFontsLoaded, estimateAvgCharWidthEm } from './fontMetrics';

interface SavedCarousel {
  id: string;
  title: string;
  headline: string;
  createdAt: string;
  updatedAt: string;
}

type SaveStatus = 'idle' | 'editing' | 'saving' | 'saved' | 'error';
type RealignmentModel = 'claude' | 'gemini' | 'gemini-computational';

type UndoSnapshot = {
  layoutData: LayoutResponse;
  inputData: CarouselTextRequest;
};

export function useCarouselEditorEngine(opts?: {
  enableLegacyAutoSave?: boolean;
  enableLegacySavedCarouselsOnMount?: boolean;
  enableTemplatesOnMount?: boolean;
}) {
  // Legacy autosave and legacy "saved carousels" (ai_carousels) have been removed.
  // We keep these flags for backward-compat with call sites, but they do nothing now.
  const enableLegacyAutoSave = false;
  const enableLegacySavedCarouselsOnMount = false;
  const enableTemplatesOnMount = opts?.enableTemplatesOnMount !== false;
  const canvasRef = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [realigning, setRealigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutData, setLayoutData] = useState<LayoutResponse | null>(null);
  const [inputData, setInputData] = useState<CarouselTextRequest | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Layout history for undo functionality
  const [layoutHistory, setLayoutHistory] = useState<UndoSnapshot[]>([]);

  // Auto-save states
  const [currentCarouselId, setCurrentCarouselId] = useState<string | null>(null);
  const [carouselTitle, setCarouselTitle] = useState('Untitled Carousel');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Project-wide typography (persisted with the carousel; canvas-only).
  const [headlineFontFamily, setHeadlineFontFamily] = useState<string>('"Droid Serif", serif');
  const [bodyFontFamily, setBodyFontFamily] = useState<string>('Inter, sans-serif');
  // NOTE: weights are not yet persisted to DB; used for UI selection (Phase 2) and canvas rendering (Phase 3).
  const [headlineFontWeight, setHeadlineFontWeight] = useState<number>(400);
  const [bodyFontWeight, setBodyFontWeight] = useState<number>(400);

  // Legacy saved carousels removed; keep minimal placeholder state for older UI.
  const [savedCarousels] = useState<SavedCarousel[]>([]);
  const [loadingCarousels] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Debug screenshot preview
  const [debugScreenshot, setDebugScreenshot] = useState<string | null>(null);
  const [showDebugPreview, setShowDebugPreview] = useState(false);

  // Realignment model selection
  const [realignmentModel, setRealignmentModel] = useState<RealignmentModel>('gemini-computational');

  // Templates
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; updatedAt: string }>>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateSnapshot, setSelectedTemplateSnapshot] = useState<CarouselTemplateDefinitionV1 | null>(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => {
      const next = [...prev, `[${timestamp}] ${message}`];
      // Prevent unbounded growth (debug can get chatty).
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
    console.log(`[AI Carousel Vision] ${message}`);
  }, []);

  const loadTemplatesList = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/marketing/carousel/templates/list', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setTemplates(result.templates || []);
        addLog(`✅ Loaded ${result.templates?.length || 0} templates`);
      } else {
        addLog(`⚠️ Failed to load templates: ${result.error || 'unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
      addLog('⚠️ Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, [addLog]);

  const loadTemplate = useCallback(async (templateId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/marketing/carousel/templates/load?id=${templateId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to load template');
      }
      const def = result.template?.definition as CarouselTemplateDefinitionV1;
      setSelectedTemplateId(templateId);
      setSelectedTemplateSnapshot(def || null);
      addLog(`✅ Template loaded: ${result.template?.name || templateId}`);
    } catch (e) {
      console.error('Failed to load template:', e);
      addLog(`⚠️ Failed to load template: ${(e as any)?.message || 'unknown error'}`);
      setSelectedTemplateId(null);
      setSelectedTemplateSnapshot(null);
    }
  }, [addLog]);

  const loadSavedCarousels = useCallback(async () => {
    // removed
  }, []);

  const loadCarousel = useCallback(async (_id: string) => {
    // removed
  }, []);

  const triggerAutoSave = useCallback(() => {
    if (!enableLegacyAutoSave) return;
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set status to editing
    setSaveStatus('editing');

    // CRITICAL: Capture current state values NOW (not when timeout fires)
    // This prevents stale/null values if state changes during the 2s delay
    const capturedLayoutData = layoutData;
    const capturedInputData = inputData;
    const capturedCarouselId = currentCarouselId;
    const capturedTitle = carouselTitle;
    const capturedTemplateId = selectedTemplateId;
    const capturedTemplateSnapshot = selectedTemplateSnapshot;
    const capturedHeadlineFontFamily = headlineFontFamily;
    const capturedBodyFontFamily = bodyFontFamily;

    console.log('[Auto-Save] 📸 Captured state for auto-save:', {
      hasLayout: !!capturedLayoutData,
      hasInput: !!capturedInputData,
      carouselId: capturedCarouselId,
      title: capturedTitle,
    });

    // Debounce: wait 2 seconds before saving
    saveTimeoutRef.current = setTimeout(() => {
      void performAutoSave(
        false,
        capturedLayoutData,
        capturedInputData,
        capturedCarouselId,
        capturedTitle,
        capturedTemplateId,
        capturedTemplateSnapshot,
        capturedHeadlineFontFamily,
        capturedBodyFontFamily
      );
    }, 2000);
  }, [
    enableLegacyAutoSave,
    layoutData,
    inputData,
    currentCarouselId,
    carouselTitle,
    selectedTemplateId,
    selectedTemplateSnapshot,
    headlineFontFamily,
    bodyFontFamily,
    headlineFontWeight,
    bodyFontWeight,
  ]);

  const performAutoSave = useCallback(async (
    forceNew = false,
    capturedLayoutData?: LayoutResponse | null,
    capturedInputData?: CarouselTextRequest | null,
    capturedCarouselId?: string | null,
    capturedTitle?: string,
    capturedTemplateId?: string | null,
    capturedTemplateSnapshot?: CarouselTemplateDefinitionV1 | null,
    capturedHeadlineFontFamily?: string,
    capturedBodyFontFamily?: string
  ): Promise<string | null> => {
    // Use captured values if provided, otherwise use current state
    const dataToSave = capturedLayoutData || layoutData;
    const inputToSave = capturedInputData || inputData;
    const idToUse = capturedCarouselId !== undefined ? capturedCarouselId : currentCarouselId;
    const titleToUse = capturedTitle || carouselTitle;
    const templateIdToUse = capturedTemplateId !== undefined ? capturedTemplateId : selectedTemplateId;
    const templateSnapshotToUse = capturedTemplateSnapshot !== undefined ? capturedTemplateSnapshot : selectedTemplateSnapshot;
    const headlineFontFamilyToUse = capturedHeadlineFontFamily || headlineFontFamily;
    const bodyFontFamilyToUse = capturedBodyFontFamily || bodyFontFamily;

    if (!dataToSave || !inputToSave) {
      addLog('⚠️ Auto-save skipped: no data to save');
      console.log('[Auto-Save] ❌ Missing data:', {
        hasLayoutData: !!dataToSave,
        hasInputData: !!inputToSave,
      });
      return null;
    }

    setSaveStatus('saving');
    setSaveError(null);
    addLog('💾 Auto-saving carousel...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Get current canvas state
      const imagePosition = canvasRef.current?.getImagePosition?.();

      const saveData = {
        id: forceNew ? undefined : idToUse,
        title: titleToUse,
        headline: inputToSave.headline,
        body: inputToSave.body,
        layoutJson: dataToSave.layout,
        imageBase64: dataToSave.imageUrl || '',
        imagePosition: imagePosition || dataToSave.layout?.image || { x: 0, y: 0, width: 0, height: 0 },
        backgroundColor: inputToSave.settings?.backgroundColor || '#ffffff',
        textColor: inputToSave.settings?.textColor || '#000000',
        headlineFontFamily: headlineFontFamilyToUse,
        bodyFontFamily: bodyFontFamilyToUse,
        customImagePrompt: inputToSave.settings?.imagePrompt,
        templateId: templateIdToUse,
        templateSnapshot: templateSnapshotToUse,
      };

      throw new Error('Legacy save is no longer supported');
    } catch (err) {
      console.error('Auto-save error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save';
      setSaveError(errorMessage);
      setSaveStatus('error');
      addLog(`❌ Auto-save failed: ${errorMessage}`);

      // Retry once with the same captured values
      if (retryCountRef.current < 1) {
        retryCountRef.current++;
        addLog('🔄 Retrying auto-save...');
        setTimeout(
          () => void performAutoSave(
            forceNew,
            capturedLayoutData,
            capturedInputData,
            capturedCarouselId,
            capturedTitle,
            capturedTemplateId,
            capturedTemplateSnapshot,
            capturedHeadlineFontFamily,
            capturedBodyFontFamily
          ),
          1000
        );
      } else {
        addLog('❌ Auto-save retry limit reached');
        retryCountRef.current = 0;
      }
      return null;
    }
  }, [
    addLog,
    bodyFontFamily,
    carouselTitle,
    currentCarouselId,
    headlineFontFamily,
    inputData,
    layoutData,
    loadSavedCarousels,
    saveStatus,
    selectedTemplateId,
    selectedTemplateSnapshot,
  ]);

  const handleSaveAsNew = useCallback(() => {
    addLog('➕ Saving as new carousel...');
    void performAutoSave(true);
  }, [addLog, performAutoSave]);

  const handleUpdateCurrent = useCallback(() => {
    addLog('🔄 Updating current carousel...');
    void performAutoSave(false);
  }, [addLog, performAutoSave]);

  // Trigger auto-save when layout or input changes (after generation or user edits)
  useEffect(() => {
    if (!enableLegacyAutoSave) return;
    if (layoutData && inputData) {
      triggerAutoSave();
    }
  }, [enableLegacyAutoSave, layoutData, inputData, carouselTitle, triggerAutoSave]);

  const handleGenerate = useCallback(async (data: CarouselTextRequest) => {
    setLoading(true);
    setError(null);
    setLayoutData(null);
    setDebugLogs([]);

    try {
      addLog('🚀 Starting vision-based generation...');
      addLog(`📝 Headline: "${data.headline.substring(0, 50)}${data.headline.length > 50 ? '...' : ''}"`);
      addLog(`📝 Body: "${data.body.substring(0, 50)}${data.body.length > 50 ? '...' : ''}"`);
      addLog(`🎨 Colors: BG=${data.settings?.backgroundColor}, Text=${data.settings?.textColor}`);

      if (data.settings?.imagePrompt) {
        addLog(`📝 Custom image prompt provided (${data.settings.imagePrompt.length} chars)`);
      } else {
        addLog(`📝 Auto-generating image prompt from headline/body`);
      }

      // Get auth token from Supabase session
      addLog('🔐 Getting authentication token...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        addLog('❌ No session found');
        setError('Not authenticated. Please log in again.');
        setLoading(false);
        return;
      }
      addLog('✅ Authentication successful');

      addLog('📡 Sending request to API...');
      addLog('⏳ Step 1: Generating image with GPT-Image-1.5...');
      addLog('⏳ Step 2: Analyzing image with Claude Vision...');
      addLog('⏳ Step 3: Generating text layout...');

      // Ensure fonts are loaded before we (a) measure metrics and (b) render Fabric text.
      await ensureTypographyFontsLoaded({
        headlineFontFamily,
        headlineFontWeight,
        bodyFontFamily,
        bodyFontWeight,
      });

      const apiStartTime = Date.now();
      const requestBody: CarouselTextRequest = {
        ...data,
        templateId: selectedTemplateId || undefined,
        fontMetrics: {
          headlineAvgCharWidthEm: estimateAvgCharWidthEm(headlineFontFamily, headlineFontWeight),
          bodyAvgCharWidthEm: estimateAvgCharWidthEm(bodyFontFamily, bodyFontWeight),
        },
      };

      const response = await fetch('/api/marketing/carousel/layout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const apiElapsed = Date.now() - apiStartTime;
      addLog(`📥 API responded with status: ${response.status} (${apiElapsed}ms)`);
      const result = await response.json() as LayoutResponse;

      if (!result.success) {
        addLog(`❌ API error: ${result.error}`);
        setError(result.error || 'Failed to generate layout');
        return;
      }

      addLog('✅ Vision-based layout received from Claude');

      if (result.layout && 'textLines' in result.layout) {
        addLog(`📊 Text lines generated: ${result.layout.textLines.length}`);

        result.layout.textLines.forEach((line, index) => {
          const boldCount = line.styles.filter(s => s.fontWeight === 'bold').length;
          const italicCount = line.styles.filter(s => s.fontStyle === 'italic').length;
          addLog(`  Line ${index + 1}: "${line.text.substring(0, 30)}..." (${line.baseSize}px, ${boldCount} bold, ${italicCount} italic)`);
        });
      }

      if (result.imageUrl) {
        addLog('🖼️ Image generated and included');
        addLog(`📊 Image data length: ${result.imageUrl.length} chars`);
      }

      setLayoutData(result);
      setInputData(requestBody);
      addLog('✅ Layout data set, rendering preview...');

      // Reset carousel ID for new generation (will trigger auto-save as new)
      setCurrentCarouselId(null);
      setCarouselTitle('Untitled Carousel');
    } catch (err) {
      console.error('Generation error:', err);
      addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setError(err instanceof Error ? err.message : 'Failed to generate layout');
    } finally {
      setLoading(false);
    }
  }, [addLog, selectedTemplateId]);

  const handleRetry = useCallback(() => {
    console.log('[AI Carousel Vision] 🔄 Retrying generation...');
    if (inputData) {
      void handleGenerate(inputData);
    }
  }, [handleGenerate, inputData]);

  const handleStartOver = useCallback(() => {
    setLayoutData(null);
    setInputData(null);
    setError(null);
    setDebugLogs([]);
    setLayoutHistory([]);
    setCurrentCarouselId(null);
    setCarouselTitle('Untitled Carousel');
    setSaveStatus('idle');
    // Don't null out the ref; the Fabric canvas is managed inside CarouselPreviewVision.
  }, []);

  // "New carousel" = reset editor state (but keep current template selection so you can iterate quickly).
  const handleNewCarousel = useCallback(() => {
    addLog('🆕 New carousel');
    setShowDropdown(false);
    setLayoutData(null);
    setInputData(null);
    setError(null);
    setDebugLogs([]);
    setLayoutHistory([]);
    setCurrentCarouselId(null);
    setCarouselTitle('Untitled Carousel');
    setSaveStatus('idle');
    setSaveError(null);
  }, [addLog]);

  const handleRealign = useCallback(async (arg?: any) => {
    const opts: { skipHistory?: boolean } | undefined =
      arg && typeof arg === 'object' && 'skipHistory' in arg ? (arg as any) : undefined;
    if (!layoutData || !inputData || !canvasRef.current) {
      addLog('❌ Cannot realign: missing data or canvas');
      return;
    }

    setRealigning(true);
    setError(null);

    try {
      addLog('🔄 Starting text realignment...');

      // Capture IMAGE-ONLY screenshot (without old text)
      // This ensures Claude only sees the image and background, not old text positions
      addLog('📸 Capturing image-only screenshot (hiding text)...');
      const screenshot = canvasRef.current.captureImageOnly?.();
      if (!screenshot) {
        throw new Error('Failed to capture canvas screenshot');
      }
      addLog(`✅ Image-only screenshot captured (${screenshot.length} chars)`);

      // Save screenshot for debug preview
      setDebugScreenshot(screenshot);
      setShowDebugPreview(true);
      addLog('🔍 Screenshot saved to debug preview panel');

      // Get current image position
      addLog('📐 Getting current image position...');
      const imagePosition = canvasRef.current.getImagePosition?.();
      if (!imagePosition) {
        throw new Error('Failed to get image position');
      }
      addLog(`✅ Image position: x=${imagePosition.x}, y=${imagePosition.y}, w=${imagePosition.width}, h=${imagePosition.height}`);
      addLog(`📊 Image BOUNDS: Top=${Math.round(imagePosition.y)}, Bottom=${Math.round(imagePosition.y + imagePosition.height)}`);

      // Get auth token from Supabase session
      addLog('🔐 Getting authentication token...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        addLog('❌ No session found');
        setError('Not authenticated. Please log in again.');
        return;
      }
      addLog('✅ Authentication successful');

      // Save current layout to history before realigning
      if (!opts?.skipHistory) {
        addLog('💾 Saving current layout to history...');
        if (layoutData && inputData) {
          setLayoutHistory(prev => [...prev, { layoutData, inputData }]);
        } else {
          addLog('⚠️ Skipping history snapshot: missing layoutData or inputData');
        }
      }

      // Call realign API with selected model
      addLog(`📡 Sending realignment request to API using ${realignmentModel.toUpperCase()}...`);
      const apiStartTime = Date.now();
      const controller = new AbortController();
      // Allow longer server-side processing (e.g., long Gemini emphasis call).
      const timeoutId = setTimeout(() => controller.abort(), 190_000);
      let response: Response;
      try {
        await ensureTypographyFontsLoaded({
          headlineFontFamily,
          headlineFontWeight,
          bodyFontFamily,
          bodyFontWeight,
        });

        response = await fetch('/api/marketing/carousel/realign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            headline: inputData.headline,
            body: inputData.body,
            canvasScreenshot: screenshot,
            imagePosition,
            contentRegion: selectedTemplateSnapshot?.slides?.[0]?.contentRegion || null,
            contentPadding: 40,
            model: realignmentModel, // Pass selected model
            fontMetrics: {
              headlineAvgCharWidthEm: estimateAvgCharWidthEm(headlineFontFamily, headlineFontWeight),
              bodyAvgCharWidthEm: estimateAvgCharWidthEm(bodyFontFamily, bodyFontWeight),
            },
            imageAlphaMask: (layoutData as any)?.layout?.image?.mask || undefined,
          }),
          signal: controller.signal,
        });
      } catch (e) {
        if ((e as any)?.name === 'AbortError') {
          throw new Error('Realign timed out (190s). Check server logs; Gemini may be slow or stalled.');
        }
        throw e;
      } finally {
        clearTimeout(timeoutId);
      }

      const apiElapsed = Date.now() - apiStartTime;
      addLog(`📥 API responded with status: ${response.status} (${apiElapsed}ms)`);

      const result = await response.json();

      if (!result.success) {
        addLog(`❌ API error: ${result.error}`);
        setError(result.error || 'Failed to realign text');
        // Remove from history since realignment failed
        setLayoutHistory(prev => prev.slice(0, -1));
        return;
      }

      addLog('✅ Text realigned successfully');
      addLog(`📊 New text lines: ${result.layout.textLines.length}`);

      // CRITICAL: Log actual Y positions to debug overlap
      addLog('🔍 DETAILED TEXT POSITIONS:');
      result.layout.textLines.forEach((line: any, index: number) => {
        const boldCount = line.styles.filter((s: any) => s.fontWeight === 'bold').length;
        const italicCount = line.styles.filter((s: any) => s.fontStyle === 'italic').length;
        const lineHeight = line.baseSize * (line.lineHeight || 1.2);
        const lineBottom = Math.round(line.position.y + lineHeight);

        addLog(`  Line ${index + 1}: y=${line.position.y}, bottom=${lineBottom}, size=${line.baseSize}px, text="${line.text.substring(0, 25)}..."`);
      });

      // Log image position for comparison
      if (result.layout.image) {
        const img = result.layout.image;
        addLog('🖼️ IMAGE BOUNDS:');
        addLog(`  Top: ${img.y}, Bottom: ${img.y + img.height}, Left: ${img.x}, Right: ${img.x + img.width}`);
        addLog('⚠️ CHECK: Does any text Y overlap with image Y range?');
      }

      // Preserve the image URL from the current layout.
      // In /editor we often restore layouts from snapshots where the base64 URL lives on `layout.image.url`
      // (and `layoutData.imageUrl` may be null). If we don't carry this forward, the image can "disappear"
      // after realign (new layout comes back with image bounds but no url).
      //
      // ALSO: Preserve editor-specific image metadata (mask + bg removal fields). The server layout engine
      // only returns canonical bounds and text lines; if we drop these fields, subsequent Realign/Layout
      // calls lose silhouette wrapping and the Controls UI regresses to "idle".
      const prevImageMeta = (layoutData as any)?.layout?.image || null;
      const existingImageUrl =
        (layoutData as any)?.layout?.image?.url ||
        (layoutData as any)?.imageUrl ||
        null;
      if (existingImageUrl && result.layout.image) {
        result.layout.image.url = existingImageUrl;
      }
      // CRITICAL: Never allow realign to move the user's image. Preserve prior image bounds if present.
      // Use the CURRENT image position measured from the canvas (this is the source of truth after dragging/resizing).
      if (result.layout.image && imagePosition) {
        result.layout.image.x = imagePosition.x;
        result.layout.image.y = imagePosition.y;
        result.layout.image.width = imagePosition.width;
        result.layout.image.height = imagePosition.height;
      }

      // Preserve editor image metadata fields (mask + bg removal toggle/state + storage pointers).
      if (result.layout.image && prevImageMeta) {
        const fields = ['mask', 'storage', 'bgRemovalEnabled', 'bgRemovalStatus', 'original', 'processed'] as const;
        for (const k of fields) {
          if (typeof (prevImageMeta as any)?.[k] !== 'undefined') {
            (result.layout.image as any)[k] = (prevImageMeta as any)[k];
          }
        }
      }

      // Update layout data with new realigned layout
      setLayoutData({
        success: true,
        layout: result.layout,
        imageUrl: layoutData.imageUrl, // Preserve original image
      });

      addLog('✅ Layout updated, canvas will re-render');
    } catch (err) {
      console.error('Realignment error:', err);
      addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setError(err instanceof Error ? err.message : 'Failed to realign text');
      // Remove from history since realignment failed
      setLayoutHistory(prev => prev.slice(0, -1));
    } finally {
      setRealigning(false);
    }
  }, [addLog, inputData, layoutData, realignmentModel, selectedTemplateSnapshot]);

  const handleUndo = useCallback(() => {
    if (layoutHistory.length === 0) {
      addLog('❌ No history to undo');
      return;
    }

    addLog('⏮️ Undoing to previous layout...');

    // Get the last snapshot from history
    const previous = layoutHistory[layoutHistory.length - 1];

    // Remove it from history
    setLayoutHistory(prev => prev.slice(0, -1));

    // Restore previous layout + input (text + style ranges)
    setLayoutData(previous.layoutData);
    setInputData(previous.inputData);

    addLog('✅ Reverted to previous layout');
  }, [addLog, layoutHistory]);

  // Load saved carousels + templates on mount
  useEffect(() => {
    if (enableTemplatesOnMount) void loadTemplatesList();
  }, [enableLegacySavedCarouselsOnMount, enableTemplatesOnMount, loadSavedCarousels, loadTemplatesList]);

  return {
    // refs
    canvasRef,

    // state
    loading,
    realigning,
    error,
    layoutData,
    inputData,
    debugLogs,
    layoutHistory,
    currentCarouselId,
    carouselTitle,
    saveStatus,
    saveError,
    savedCarousels,
    loadingCarousels,
    showDropdown,
    debugScreenshot,
    showDebugPreview,
    realignmentModel,
    templates,
    loadingTemplates,
    selectedTemplateId,
    selectedTemplateSnapshot,
    templateEditorOpen,
    headlineFontFamily,
    bodyFontFamily,
    headlineFontWeight,
    bodyFontWeight,

    // setters (used by UI)
    setShowDropdown,
    setShowDebugPreview,
    setCarouselTitle,
    setRealignmentModel,
    setLayoutData,
    setInputData,
    setLayoutHistory,
    setCurrentCarouselId,
    setSaveStatus,
    setSaveError,
    setError,
    setSelectedTemplateId,
    setSelectedTemplateSnapshot,
    setTemplateEditorOpen,
    setHeadlineFontFamily,
    setBodyFontFamily,
    setHeadlineFontWeight,
    setBodyFontWeight,
    setTemplates,

    // actions
    addLog,
    loadTemplatesList,
    loadTemplate,
    loadSavedCarousels,
    loadCarousel,
    performAutoSave,
    handleSaveAsNew,
    handleUpdateCurrent,
    handleGenerate,
    handleRetry,
    handleStartOver,
    handleNewCarousel,
    handleRealign,
    handleUndo,
  };
}


