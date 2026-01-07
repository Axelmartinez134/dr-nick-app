'use client';

import dynamic from 'next/dynamic';
import CarouselInput from './CarouselInput';
import TemplateEditorModal from './TemplateEditorModal';
import { useCarouselEditorEngine } from './useCarouselEditorEngine';

// Lazy-load Fabric-dependent components
const CarouselPreviewVision = dynamic(() => import('./CarouselPreviewVision'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
      <div className="text-black">Loading preview...</div>
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
  const {
    canvasRef,
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
    setCarouselTitle,
    setShowDropdown,
    setShowDebugPreview,
    setRealignmentModel,
    setSelectedTemplateId,
    setSelectedTemplateSnapshot,
    setTemplateEditorOpen,
    addLog,
    loadTemplatesList,
    loadTemplate,
    loadCarousel,
    handleGenerate,
    handleRetry,
    handleStartOver,
    handleNewCarousel,
    handleRealign,
    handleUndo,
    handleSaveAsNew,
    handleUpdateCurrent,
  } = useCarouselEditorEngine();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Template Selector */}
        <div className="mb-6 bg-white rounded-lg shadow p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-black">
              Template
            </label>
            <select
              value={selectedTemplateId || ''}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  setSelectedTemplateId(null);
                  setSelectedTemplateSnapshot(null);
                  return;
                }
                void loadTemplate(v);
              }}
              className="px-3 py-2 border border-gray-300 rounded bg-white text-sm font-medium text-black disabled:text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loadingTemplates}
            >
              <option value="">{loadingTemplates ? 'Loading templates...' : 'No template (legacy)'}</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedTemplateId && (
              <span className="text-xs text-black">
                {selectedTemplateSnapshot ? 'Snapshot loaded' : 'Loading...'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewCarousel}
              className="px-3 py-2 bg-black text-white rounded text-sm font-medium disabled:bg-black/30 disabled:text-white"
              title="Start a new carousel (clears current layout + save state)"
            >
              New Carousel
            </button>
            <button
              onClick={() => setTemplateEditorOpen(true)}
              className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium flex items-center gap-2"
              title="Open Template Editor"
            >
              <span aria-hidden>⚙️</span>
              <span>Template Editor</span>
            </button>
          </div>
        </div>
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
                    templateSnapshot={selectedTemplateSnapshot}
                    headlineFontFamily={headlineFontFamily}
                    bodyFontFamily={bodyFontFamily}
                    headlineFontWeight={headlineFontWeight}
                    bodyFontWeight={bodyFontWeight}
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

      <TemplateEditorModal
        open={templateEditorOpen}
        onClose={() => setTemplateEditorOpen(false)}
        templates={templates}
        currentTemplateId={selectedTemplateId}
        currentTemplateSnapshot={selectedTemplateSnapshot}
        onTemplateSaved={(templateId, nextDefinition) => {
          setSelectedTemplateId(templateId);
          setSelectedTemplateSnapshot(nextDefinition);
          addLog(`✅ Template updated (snapshot refreshed): ${templateId}`);
        }}
        onRefreshTemplates={loadTemplatesList}
      />
    </div>
  );
}
