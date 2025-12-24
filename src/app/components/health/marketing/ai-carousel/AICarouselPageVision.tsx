'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../../auth/AuthContext';
import CarouselInput from './CarouselInput';
import { CarouselTextRequest, LayoutResponse } from '@/lib/carousel-types';

// Lazy-load Fabric-dependent components
const CarouselPreviewVision = dynamic(() => import('./CarouselPreviewVision'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
      <div className="text-gray-600">Loading preview...</div>
    </div>
  ),
});

const ExportButton = dynamic(() => import('./ExportButton'), {
  ssr: false,
});

const TextStylingToolbar = dynamic(() => import('./TextStylingToolbar'), {
  ssr: false,
});

interface SavedCarousel {
  id: string;
  title: string;
  headline: string;
  createdAt: string;
  updatedAt: string;
}

type SaveStatus = 'idle' | 'editing' | 'saving' | 'saved' | 'error';

export default function AICarouselPageVision() {
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
  const [layoutHistory, setLayoutHistory] = useState<LayoutResponse[]>([]);

  // Auto-save states
  const [currentCarouselId, setCurrentCarouselId] = useState<string | null>(null);
  const [carouselTitle, setCarouselTitle] = useState('Untitled Carousel');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Saved carousels list
  const [savedCarousels, setSavedCarousels] = useState<SavedCarousel[]>([]);
  const [loadingCarousels, setLoadingCarousels] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Debug screenshot preview
  const [debugScreenshot, setDebugScreenshot] = useState<string | null>(null);
  const [showDebugPreview, setShowDebugPreview] = useState(false);
  
  // Realignment model selection
  const [realignmentModel, setRealignmentModel] = useState<'claude' | 'gemini' | 'gemini-computational'>('gemini-computational');

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[AI Carousel Vision] ${message}`);
  };

  // Load saved carousels on mount
  useEffect(() => {
    loadSavedCarousels();
  }, []);

  const loadSavedCarousels = async () => {
    setLoadingCarousels(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/marketing/carousel/list', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setSavedCarousels(result.carousels || []);
        addLog(`✅ Loaded ${result.carousels?.length || 0} saved carousels`);
      }
    } catch (err) {
      console.error('Failed to load saved carousels:', err);
    } finally {
      setLoadingCarousels(false);
    }
  };

  const loadCarousel = async (id: string) => {
    addLog(`📂 Loading carousel: ${id}`);
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`/api/marketing/carousel/load?id=${id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'Failed to load carousel');
        return;
      }

      const carousel = result.carousel;
      addLog(`✅ Carousel loaded: "${carousel.title}"`);

      // Restore state from loaded carousel
      setCurrentCarouselId(carousel.id);
      setCarouselTitle(carousel.title);
      
      // Reconstruct layoutData
      const layout: LayoutResponse = {
        success: true,
        layout: carousel.layoutJson,
        imageUrl: carousel.imageBase64,
      };
      
      // Update image position and URL with saved values
      if (layout.layout && carousel.imageBase64) {
        layout.layout.image.url = carousel.imageBase64;
        
        // IMPORTANT: Use the saved image position, not the one from layoutJson
        // This ensures moved images are restored to their correct position
        layout.layout.image.x = carousel.imagePosition.x;
        layout.layout.image.y = carousel.imagePosition.y;
        layout.layout.image.width = carousel.imagePosition.width;
        layout.layout.image.height = carousel.imagePosition.height;
        
        addLog(`📐 Image position restored: x=${carousel.imagePosition.x}, y=${carousel.imagePosition.y}`);
      }

      setLayoutData(layout);
      
      // Reconstruct inputData
      setInputData({
        headline: carousel.headline,
        body: carousel.body,
        settings: {
          backgroundColor: carousel.backgroundColor,
          textColor: carousel.textColor,
          imagePrompt: carousel.customImagePrompt,
        },
      });

      setSaveStatus('saved');
      setShowDropdown(false);
    } catch (err) {
      console.error('Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load carousel');
    } finally {
      setLoading(false);
    }
  };

  const triggerAutoSave = useCallback(() => {
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

    console.log('[Auto-Save] 📸 Captured state for auto-save:', {
      hasLayout: !!capturedLayoutData,
      hasInput: !!capturedInputData,
      carouselId: capturedCarouselId,
      title: capturedTitle,
    });

    // Debounce: wait 2 seconds before saving
    saveTimeoutRef.current = setTimeout(() => {
      performAutoSave(false, capturedLayoutData, capturedInputData, capturedCarouselId, capturedTitle);
    }, 2000);
  }, [layoutData, inputData, currentCarouselId, carouselTitle]);

  const performAutoSave = async (
    forceNew = false,
    capturedLayoutData?: LayoutResponse | null,
    capturedInputData?: CarouselTextRequest | null,
    capturedCarouselId?: string | null,
    capturedTitle?: string
  ) => {
    // Use captured values if provided, otherwise use current state
    const dataToSave = capturedLayoutData || layoutData;
    const inputToSave = capturedInputData || inputData;
    const idToUse = capturedCarouselId !== undefined ? capturedCarouselId : currentCarouselId;
    const titleToUse = capturedTitle || carouselTitle;

    if (!dataToSave || !inputToSave) {
      addLog('⚠️ Auto-save skipped: no data to save');
      console.log('[Auto-Save] ❌ Missing data:', {
        hasLayoutData: !!dataToSave,
        hasInputData: !!inputToSave,
      });
      return;
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
      const canvasScreenshot = canvasRef.current?.captureScreenshot?.();
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
        customImagePrompt: inputToSave.settings?.imagePrompt,
      };

      const response = await fetch('/api/marketing/carousel/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(saveData),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to save');
      }

      // Update current carousel ID if it was a new save
      if (!idToUse || forceNew) {
        setCurrentCarouselId(result.id);
        addLog(`✅ Carousel saved as new (ID: ${result.id})`);
      } else {
        addLog(`✅ Carousel updated (ID: ${result.id})`);
      }

      setSaveStatus('saved');
      retryCountRef.current = 0;

      // Reload carousel list to show updated title/date
      loadSavedCarousels();

      // Reset status after 2 seconds
      setTimeout(() => {
        if (saveStatus !== 'editing' && saveStatus !== 'saving') {
          setSaveStatus('idle');
        }
      }, 2000);
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
        setTimeout(() => performAutoSave(forceNew, capturedLayoutData, capturedInputData, capturedCarouselId, capturedTitle), 1000);
      } else {
        addLog('❌ Auto-save retry limit reached');
        retryCountRef.current = 0;
      }
    }
  };

  const handleSaveAsNew = () => {
    addLog('➕ Saving as new carousel...');
    performAutoSave(true);
  };

  const handleUpdateCurrent = () => {
    addLog('🔄 Updating current carousel...');
    performAutoSave(false);
  };

  // Trigger auto-save when layout or input changes (after generation or user edits)
  useEffect(() => {
    if (layoutData && inputData) {
      triggerAutoSave();
    }
  }, [layoutData, inputData, carouselTitle, triggerAutoSave]);

  const handleGenerate = async (data: CarouselTextRequest) => {
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
      
      const apiStartTime = Date.now();
      const response = await fetch('/api/marketing/carousel/layout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
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
      setInputData(data);
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
  };

  const handleRetry = () => {
    console.log('[AI Carousel Vision] 🔄 Retrying generation...');
    if (inputData) {
      handleGenerate(inputData);
    }
  };

  const handleStartOver = () => {
    setLayoutData(null);
    setInputData(null);
    setError(null);
    setDebugLogs([]);
    setLayoutHistory([]);
    setCurrentCarouselId(null);
    setCarouselTitle('Untitled Carousel');
    setSaveStatus('idle');
    canvasRef.current = null;
  };

  const handleRealign = async () => {
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
      addLog('💾 Saving current layout to history...');
      setLayoutHistory(prev => [...prev, layoutData]);

      // Call realign API with selected model
      addLog(`📡 Sending realignment request to API using ${realignmentModel.toUpperCase()}...`);
      const apiStartTime = Date.now();
      const controller = new AbortController();
      // Allow longer server-side processing (e.g., long Gemini emphasis call).
      const timeoutId = setTimeout(() => controller.abort(), 190_000);
      let response: Response;
      try {
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
            model: realignmentModel, // Pass selected model
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

      // Preserve the image URL from the current layout
      if (layoutData.imageUrl) {
        result.layout.image.url = layoutData.imageUrl;
      }
      // CRITICAL: Never allow realign to move the user's image. Preserve prior image bounds if present.
      if (layoutData.layout?.image && result.layout.image) {
        result.layout.image.x = layoutData.layout.image.x;
        result.layout.image.y = layoutData.layout.image.y;
        result.layout.image.width = layoutData.layout.image.width;
        result.layout.image.height = layoutData.layout.image.height;
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
  };

  const handleUndo = () => {
    if (layoutHistory.length === 0) {
      addLog('❌ No history to undo');
      return;
    }

    addLog('⏮️ Undoing to previous layout...');
    
    // Get the last layout from history
    const previousLayout = layoutHistory[layoutHistory.length - 1];
    
    // Remove it from history
    setLayoutHistory(prev => prev.slice(0, -1));
    
    // Restore previous layout
    setLayoutData(previousLayout);
    
    addLog('✅ Reverted to previous layout');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎨 AI Carousel Generator (Vision-Based)
          </h1>
          <p className="text-gray-600">
            Create stunning carousel posts with AI-powered image analysis and intelligent text placement
          </p>
        </div>

        {/* Saved Carousels Dropdown */}
        <div className="mb-6 relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            disabled={loadingCarousels}
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              {loadingCarousels ? 'Loading...' : `Load Saved Carousel (${savedCarousels.length})`}
            </span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute top-full mt-2 w-full max-w-2xl bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
              {savedCarousels.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm">No saved carousels yet</p>
                  <p className="text-xs text-gray-400 mt-1">Generate a carousel to save it automatically</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {savedCarousels.map((carousel) => (
                    <button
                      key={carousel.id}
                      onClick={() => loadCarousel(carousel.id)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {carousel.title}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {carousel.headline}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Updated: {new Date(carousel.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {currentCarouselId === carousel.id && (
                          <span className="ml-2 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Current
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title Editor (only show when layout exists) */}
        {layoutData && (
          <div className="mb-6 bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Carousel Title
            </label>
            <input
              type="text"
              value={carouselTitle}
              onChange={(e) => setCarouselTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter a title for this carousel..."
            />
          </div>
        )}

        {/* Error Message with Retry */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <svg className="h-6 w-6 text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-lg font-semibold text-red-800">Generation Failed</h3>
                </div>
                <p className="text-sm text-red-700 mb-4">{error}</p>
                <button
                  onClick={handleRetry}
                  disabled={!inputData}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
                >
                  🔄 Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div>
            <CarouselInput
              onGenerate={handleGenerate}
              loading={loading}
              onClear={handleStartOver}
            />
          </div>

          {/* Preview & Export Section */}
          <div>
            {layoutData?.layout && inputData && 'textLines' in layoutData.layout ? (
              <div className="space-y-6">
                {/* Save Status Indicator */}
                <div className="absolute top-4 right-4 z-10">
                  {saveStatus === 'editing' && (
                    <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-xs font-medium">Editing...</span>
                    </div>
                  )}
                  {saveStatus === 'saving' && (
                    <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium">Saving...</span>
                    </div>
                  )}
                  {saveStatus === 'saved' && (
                    <div className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1.5 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs font-medium">Saved ✓</span>
                    </div>
                  )}
                  {saveStatus === 'error' && (
                    <div className="flex items-center gap-1 text-red-600 bg-red-50 px-3 py-1.5 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-xs font-medium">Save Failed</span>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <CarouselPreviewVision
                    ref={canvasRef}
                    layout={layoutData.layout}
                    backgroundColor={inputData.settings?.backgroundColor || '#ffffff'}
                    textColor={inputData.settings?.textColor || '#000000'}
                  />
                </div>
                
                {/* Text Styling Toolbar */}
                <TextStylingToolbar fabricCanvas={canvasRef.current?.canvas} />
                
                {/* Realign & Undo Buttons */}
                <div className="flex flex-col items-center space-y-3">
                  {/* Model Selector */}
                  <div className="flex items-center space-x-3 bg-gray-100 px-4 py-2 rounded-lg">
                    <label className="text-sm font-medium text-gray-700">
                      AI Model:
                    </label>
                    <select
                      value={realignmentModel}
                      onChange={(e) => setRealignmentModel(e.target.value as 'claude' | 'gemini' | 'gemini-computational')}
                      className="px-3 py-1 border border-gray-300 rounded bg-white text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="gemini-computational">🧮 Gemini Computational (Recommended)</option>
                      <option value="gemini">⚡ Gemini 3 Vision</option>
                      <option value="claude">🤖 Claude Vision</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {realignmentModel === 'gemini-computational' && '📐 Pure math layout - like Bolt/Lovable (no vision)'}
                      {realignmentModel === 'gemini' && '👁️ Vision-based spatial analysis'}
                      {realignmentModel === 'claude' && '👁️ Vision-based spatial analysis'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleRealign}
                      disabled={loading || realigning || !layoutData}
                      className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors shadow-md flex items-center space-x-2"
                      title="Realign text based on current image position"
                    >
                      {realigning ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Realigning...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>🔄 Realign Text</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleUndo}
                      disabled={layoutHistory.length === 0 || realigning}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors shadow-md flex items-center space-x-2"
                      title={layoutHistory.length > 0 ? 'Undo to previous layout' : 'No previous layouts to undo'}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      <span>↩️ Undo</span>
                      {layoutHistory.length > 0 && (
                        <span className="text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded-full">
                          {layoutHistory.length}
                        </span>
                      )}
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-600 text-center max-w-md">
                    Drag the image to reposition it, then click <strong>"Realign Text"</strong> to regenerate text placement around the new image position.
                  </p>
                  
                  {/* Debug Screenshot Toggle */}
                  {debugScreenshot && (
                    <button
                      onClick={() => setShowDebugPreview(!showDebugPreview)}
                      className="text-xs text-purple-600 hover:text-purple-800 underline flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{showDebugPreview ? 'Hide' : 'Show'} Claude Vision Screenshot</span>
                    </button>
                  )}
                </div>

                {/* Save Buttons */}
                <div className="flex flex-col items-center space-y-3">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleSaveAsNew}
                      disabled={saveStatus === 'saving'}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors shadow-md flex items-center space-x-2"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>💾 Save As New</span>
                    </button>
                    
                    <button
                      onClick={handleUpdateCurrent}
                      disabled={!currentCarouselId || saveStatus === 'saving'}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors shadow-md flex items-center space-x-2"
                      title={!currentCarouselId ? 'Load an existing carousel first' : 'Update the currently loaded carousel'}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>🔄 Update Current</span>
                    </button>
                  </div>
                  
                  {saveError && (
                    <p className="text-xs text-red-600">
                      ❌ {saveError}
                    </p>
                  )}
                </div>
                
                <div className="flex flex-col items-center space-y-4">
                  <ExportButton canvasRef={canvasRef} />
                  
                  <button
                    onClick={handleStartOver}
                    className="text-sm text-gray-600 hover:text-gray-800 underline"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Layout Generated Yet
                </h3>
                <p className="text-gray-600">
                  Enter your headline and body text, then click "Generate Layout" to see your AI-powered carousel preview.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-12 bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">✨ Vision-Based Features:</h3>
          <ul className="list-disc list-inside space-y-2 text-blue-800">
            <li>AI analyzes the generated image to determine optimal text placement</li>
            <li>Claude automatically emphasizes key attention-grabbing words with bold/italic</li>
            <li>Text is intelligently positioned to complement the image without overlap</li>
            <li><strong>NEW:</strong> Auto-saves every change after 2 seconds (watch status indicator)</li>
            <li><strong>NEW:</strong> Load previously saved carousels from the dropdown</li>
            <li><strong>NEW:</strong> "Save As New" creates a copy, "Update Current" overwrites existing</li>
            <li>Drag the image to reposition it, then click "Realign Text" to regenerate text layout</li>
            <li>Use "Undo" button to revert to previous layouts (iterative refinement)</li>
            <li>Select any text to manually adjust bold/italic styling</li>
            <li>Click "Export PNG" to download your 1080x1440 image</li>
            <li>Drag text lines to reposition them on the canvas</li>
          </ul>
        </div>

        {/* Debug Screenshot Preview */}
        {showDebugPreview && debugScreenshot && (
          <div className="mt-8 bg-purple-900 rounded-lg p-6 overflow-hidden border-2 border-purple-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-purple-100 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                📸 Screenshot Sent to Claude Vision
              </h3>
              <button
                onClick={() => setShowDebugPreview(false)}
                className="text-purple-300 hover:text-white transition-colors"
                title="Hide preview"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-purple-200 text-sm mb-4">
              This is the EXACT image Claude Vision receives. Text objects are hidden to show only the image and background.
            </p>
            <div className="bg-white rounded p-4 overflow-auto max-h-96">
              <img 
                src={debugScreenshot} 
                alt="Screenshot sent to Claude Vision" 
                className="max-w-full h-auto mx-auto border-2 border-gray-300"
                style={{ maxHeight: '600px' }}
              />
            </div>
            <p className="text-purple-300 text-xs mt-2">
              Screenshot size: {(debugScreenshot.length / 1024).toFixed(0)} KB • 
              Format: PNG • 
              Resolution: 1080x1440
            </p>
          </div>
        )}

        {/* Debug Logs */}
        {debugLogs.length > 0 && (
          <div className="mt-8 bg-gray-900 rounded-lg p-6 overflow-hidden">
            <h3 className="font-semibold text-gray-100 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Debug Logs
            </h3>
            <div className="bg-black rounded p-4 max-h-96 overflow-y-auto font-mono text-xs text-green-400">
              {debugLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
