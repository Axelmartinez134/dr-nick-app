'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { TextLayoutDecision } from '@/lib/carousel-types';

interface CarouselPreviewProps {
  layout: TextLayoutDecision;
  headline: string;
  body: string;
  backgroundColor: string;
  textColor: string;
}

const CarouselPreview = forwardRef<any, CarouselPreviewProps>(
  ({ layout, headline, body, backgroundColor, textColor }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<any>(null);
    const [fabricLoaded, setFabricLoaded] = useState(false);

    // Initialize Fabric canvas once
    useEffect(() => {
      console.log('[Preview] 🎨 Initializing canvas...');
      if (!canvasRef.current) {
        console.log('[Preview] ❌ Canvas ref not ready');
        return;
      }

      console.log('[Preview] 📦 Loading Fabric.js...');
      // Dynamically import fabric only on client-side
      import('fabric').then((fabricModule) => {
        console.log('[Preview] ✅ Fabric.js loaded');
        console.log('[Preview] 🔍 Module structure:', Object.keys(fabricModule));
        
        // Fabric.js exports might be on the module directly or nested
        const fabric = (fabricModule as any).fabric || fabricModule;
        console.log('[Preview] 🔍 Fabric object:', typeof fabric, 'Has Canvas?', !!fabric.Canvas);
        
        console.log('[Preview] 🖼️ Creating canvas (1080x1080)...');
        const canvas = new fabric.Canvas(canvasRef.current, {
          width: 1080,
          height: 1080,
          backgroundColor,
        });

        // Set zoom to 0.5 for display (1080 -> 540)
        canvas.setZoom(0.5);
        console.log('[Preview] 🔍 Canvas zoom set to 0.5 for display');

        fabricCanvasRef.current = canvas;
        setFabricLoaded(true);
        console.log('[Preview] ✅ Canvas created and ready');
        console.log('[Preview] 📤 Canvas ref should now be available to parent');

        // Cleanup on unmount
        return () => {
          console.log('[Preview] 🧹 Cleaning up canvas');
          canvas.dispose();
          fabricCanvasRef.current = null;
        };
      }).catch((error) => {
        console.error('[Preview] ❌ Failed to load Fabric.js:', error);
      });
    }, []); // Only run once on mount

    // Expose canvas instance to parent via ref
    useImperativeHandle(ref, () => fabricCanvasRef.current, [fabricLoaded]);

    // Re-render when layout, text, or colors change
    useEffect(() => {
      console.log('[Preview] 🎨 Render triggered');
      const canvas = fabricCanvasRef.current;
      if (!canvas || !fabricLoaded) {
        console.log('[Preview] ⏳ Waiting... Canvas ready:', !!canvas, 'Fabric loaded:', fabricLoaded);
        return;
      }

      console.log('[Preview] 🖌️ Rendering text on canvas...');
      // Dynamically import fabric for rendering
      import('fabric').then((fabricModule) => {
        const fabric = (fabricModule as any).fabric || fabricModule;

        console.log('[Preview] 🧹 Clearing canvas');
        // Clear canvas
        canvas.clear();
        canvas.backgroundColor = backgroundColor;

        console.log('[Preview] ✍️ Adding headline:', {
          text: headline.substring(0, 30) + '...',
          pos: `(${layout.headline.x}, ${layout.headline.y})`,
          fontSize: layout.headline.fontSize,
          color: textColor,
        });

        // Add headline
        const headlineText = new fabric.Textbox(headline, {
          left: layout.headline.x,
          top: layout.headline.y,
          width: layout.headline.maxWidth,
          fontSize: layout.headline.fontSize,
          fontWeight: layout.headline.fontWeight,
          textAlign: layout.headline.textAlign,
          fill: textColor,
          fontFamily: 'Arial, sans-serif',
          selectable: true,
          editable: true,
        });

        console.log('[Preview] ✍️ Adding body:', {
          text: body.substring(0, 30) + '...',
          pos: `(${layout.body.x}, ${layout.body.y})`,
          fontSize: layout.body.fontSize,
          color: textColor,
        });

        // Add body text
        const bodyText = new fabric.Textbox(body, {
          left: layout.body.x,
          top: layout.body.y,
          width: layout.body.maxWidth,
          fontSize: layout.body.fontSize,
          fontWeight: layout.body.fontWeight,
          textAlign: layout.body.textAlign,
          fill: textColor,
          fontFamily: 'Arial, sans-serif',
          lineHeight: layout.body.lineHeight,
          selectable: true,
          editable: true,
        });

        canvas.add(headlineText, bodyText);
        canvas.renderAll();
        console.log('[Preview] ✅ Render complete! Objects on canvas:', canvas.getObjects().length);
      }).catch((error) => {
        console.error('[Preview] ❌ Render failed:', error);
      });
    }, [layout, headline, body, backgroundColor, textColor, fabricLoaded]);

    return (
      <div className="flex flex-col items-center space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Preview (540x540 display, exports at 1080x1080)</h3>
        <div 
          style={{ 
            width: '540px', 
            height: '540px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            backgroundColor: '#f9fafb'
          }}
        >
          <canvas 
            ref={canvasRef}
            width={1080}
            height={1080}
            style={{ 
              display: 'block'
            }} 
          />
        </div>
        <p className="text-sm text-gray-600">
          Click text to edit. Drag to reposition. Colors update live.
        </p>
      </div>
    );
  }
);

CarouselPreview.displayName = 'CarouselPreview';

export default CarouselPreview;

