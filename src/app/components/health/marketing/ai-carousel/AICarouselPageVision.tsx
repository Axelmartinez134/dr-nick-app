'use client';

import { useState, useRef } from 'react';
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

export default function AICarouselPageVision() {
  const canvasRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutData, setLayoutData] = useState<LayoutResponse | null>(null);
  const [inputData, setInputData] = useState<CarouselTextRequest | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[AI Carousel Vision] ${message}`);
  };

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
      addLog('⏳ Step 1: Generating image with DALL-E...');
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
    canvasRef.current = null;
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
                <CarouselPreviewVision
                  ref={canvasRef}
                  layout={layoutData.layout}
                  backgroundColor={inputData.settings?.backgroundColor || '#ffffff'}
                  textColor={inputData.settings?.textColor || '#000000'}
                />
                
                {/* Text Styling Toolbar */}
                <TextStylingToolbar fabricCanvas={canvasRef.current} />
                
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
            <li>Select any text to manually adjust bold/italic styling</li>
            <li>Click "Export PNG" to download your 1080x1440 image</li>
            <li>Drag text lines to reposition them on the canvas</li>
          </ul>
        </div>

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

