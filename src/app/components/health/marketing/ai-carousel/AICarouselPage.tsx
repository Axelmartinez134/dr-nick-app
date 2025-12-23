'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../../auth/AuthContext';
import CarouselInput from './CarouselInput';
import { CarouselTextRequest, LayoutResponse, TextLayoutDecision } from '@/lib/carousel-types';

// Lazy-load Fabric-dependent components
const CarouselPreview = dynamic(() => import('./CarouselPreview'), {
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

export default function AICarouselPage() {
  const canvasRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutData, setLayoutData] = useState<LayoutResponse | null>(null);
  const [inputData, setInputData] = useState<CarouselTextRequest | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[AI Carousel] ${message}`);
  };

  const handleGenerate = async (data: CarouselTextRequest) => {
    setLoading(true);
    setError(null);
    setLayoutData(null);
    setDebugLogs([]);

    try {
      addLog('🚀 Starting generation...');
      addLog(`📝 Headline: "${data.headline.substring(0, 50)}${data.headline.length > 50 ? '...' : ''}"`);
      addLog(`📝 Body: "${data.body.substring(0, 50)}${data.body.length > 50 ? '...' : ''}"`);
      addLog(`🎨 Colors: BG=${data.settings?.backgroundColor}, Text=${data.settings?.textColor}`);
      addLog(`🖼️ Include image: ${data.settings?.includeImage ? 'Yes' : 'No'}`);
      
      if (data.settings?.includeImage) {
        if (data.settings?.imagePrompt) {
          addLog(`📝 Custom image prompt provided (${data.settings.imagePrompt.length} chars)`);
        } else {
          addLog(`📝 Auto-generating image prompt from headline/body`);
        }
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

      addLog('✅ Layout received from Claude');
      
      // Handle both old and new layout structures
      if (result.layout && 'textLines' in result.layout) {
        addLog(`📊 Text lines generated: ${result.layout.textLines.length}`);
      } else if (result.layout && 'headline' in result.layout) {
        const oldLayout = result.layout as TextLayoutDecision;
        addLog(`📐 Layout type: Headline at (${oldLayout.headline.x}, ${oldLayout.headline.y}), Body at (${oldLayout.body.x}, ${oldLayout.body.y})`);
        addLog(`📏 Font sizes: Headline=${oldLayout.headline.fontSize}px, Body=${oldLayout.body.fontSize}px`);
      }
      
      if (result.imageUrl) {
        addLog('🖼️ Image URL received');
        addLog(`🔗 Image URL: ${result.imageUrl}`);
        if (result.layout?.image) {
          addLog(`📐 Image position: (${result.layout.image.x}, ${result.layout.image.y}), size: ${result.layout.image.width}x${result.layout.image.height}`);
        }
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

  const handleStartOver = () => {
    setLayoutData(null);
    setInputData(null);
    setError(null);
    canvasRef.current = null;
  };

  const handleColorChange = (newData: CarouselTextRequest) => {
    // Update input data for live color changes
    setInputData(newData);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎨 AI Carousel Generator (MVP)
          </h1>
          <p className="text-gray-600">
            Create text-only carousel posts with AI-powered layout optimization
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
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
            {layoutData?.layout && inputData && 'headline' in layoutData.layout ? (
              <div className="space-y-6">
                <CarouselPreview
                  ref={canvasRef}
                  layout={layoutData.layout as unknown as TextLayoutDecision}
                  headline={inputData.headline}
                  body={inputData.body}
                  backgroundColor={inputData.settings?.backgroundColor || '#ffffff'}
                  textColor={inputData.settings?.textColor || '#000000'}
                  imageUrl={layoutData.imageUrl}
                />
                
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
                  Enter your headline and body text, then click "Generate Layout" to see your carousel preview.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-12 bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">How to Use:</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Enter your headline and body text</li>
            <li>Choose background and text colors</li>
            <li>Click "Generate Layout" - AI will optimize text positioning</li>
            <li>Change colors anytime - preview updates instantly</li>
            <li>Click "Export PNG" to download your 1080x1440 image</li>
          </ol>
        </div>

        {/* Debug Logs */}
        {debugLogs.length > 0 && (
          <div className="mt-6 bg-gray-900 rounded-lg p-6 text-white font-mono text-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-green-400">🔍 Debug Logs</h3>
              <button
                onClick={() => setDebugLogs([])}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear Logs
              </button>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {debugLogs.map((log, index) => (
                <div key={index} className="text-gray-300">
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

