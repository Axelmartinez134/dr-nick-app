'use client';

import { useState, RefObject, useEffect } from 'react';

interface ExportButtonProps {
  canvasRef: RefObject<any>;
}

export default function ExportButton({ canvasRef }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  // Check if canvas is ready
  useEffect(() => {
    const checkCanvas = () => {
      if (canvasRef.current && !canvasReady) {
        console.log('[Export] ✅ Canvas is now ready');
        setCanvasReady(true);
      }
    };

    // Check immediately
    checkCanvas();

    // Also check periodically in case it becomes ready later
    const interval = setInterval(checkCanvas, 100);

    return () => clearInterval(interval);
  }, [canvasRef, canvasReady]);

  const handleExport = async () => {
    console.log('[Export] 🖱️ Export button clicked');
    console.log('[Export] 📦 Canvas ref:', canvasRef);
    console.log('[Export] 🎨 Canvas available?', !!canvasRef.current);
    
    const fabricCanvas = canvasRef.current;
    
    if (!fabricCanvas) {
      console.log('[Export] ❌ No canvas available');
      alert('Canvas not ready. Please wait a moment and try again.');
      return;
    }
    
    setExporting(true);
    setExported(false);

    try {
      console.log('[Export] 🎨 Starting export...');
      
      // Save current zoom level
      const currentZoom = fabricCanvas.getZoom();
      console.log('[Export] 📏 Current zoom:', currentZoom);
      
      // Temporarily disable selection for clean export
      fabricCanvas.discardActiveObject();
      
      // Reset zoom to 1.0 for full resolution export
      fabricCanvas.setZoom(1);
      fabricCanvas.renderAll();
      console.log('[Export] 🔍 Zoom reset to 1.0 for export');

      // Small delay to ensure render is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('[Export] 📸 Generating PNG...');
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1.0,
        multiplier: 1,
      });

      const link = document.createElement('a');
      link.download = `carousel-${Date.now()}.png`;
      link.href = dataURL;
      link.click();

      console.log('[Export] ✅ Export complete!');
      
      // Restore zoom
      fabricCanvas.setZoom(currentZoom);
      fabricCanvas.renderAll();
      console.log('[Export] 🔍 Zoom restored to', currentZoom);

      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (error) {
      console.error('[Export] ❌ Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={handleExport}
        disabled={!canvasReady || exporting}
        className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
      >
        {exporting ? 'Exporting...' : canvasReady ? '📥 Export PNG (1080x1440)' : '⏳ Preparing...'}
      </button>
      {exported && (
        <p className="text-sm text-green-600 font-medium">
          ✓ Downloaded successfully!
        </p>
      )}
    </div>
  );
}

