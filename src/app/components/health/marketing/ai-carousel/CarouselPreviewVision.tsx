'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { VisionLayoutDecision } from '@/lib/carousel-types';

interface CarouselPreviewProps {
  layout: VisionLayoutDecision;
  backgroundColor: string;
  textColor: string;
}

const CarouselPreviewVision = forwardRef<any, CarouselPreviewProps>(
  ({ layout, backgroundColor, textColor }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<any>(null);
    const fabricModuleRef = useRef<any>(null);
    const [fabricLoaded, setFabricLoaded] = useState(false);

    // Initialize Fabric canvas once
    useEffect(() => {
      console.log('[Preview Vision] 🎨 Initializing canvas...');
      if (!canvasRef.current) {
        console.log('[Preview Vision] ❌ Canvas ref not ready');
        return;
      }

      // Don't initialize if already initialized
      if (fabricCanvasRef.current) {
        console.log('[Preview Vision] ⚠️ Canvas already initialized, skipping');
        return;
      }

      console.log('[Preview Vision] 📦 Loading Fabric.js...');
      let isMounted = true;
      
      // Dynamically import fabric only on client-side
      import('fabric').then((fabricModule) => {
        if (!isMounted) {
          console.log('[Preview Vision] ⚠️ Component unmounted, skipping initialization');
          return;
        }

        console.log('[Preview Vision] ✅ Fabric.js loaded');
        
        // Fabric.js exports might be on the module directly or nested
        const fabric = (fabricModule as any).fabric || fabricModule;
        
        // Store fabric module for later use
        fabricModuleRef.current = fabric;
        console.log('[Preview Vision] 💾 Fabric module stored for reuse');
        
        if (!canvasRef.current) {
          console.log('[Preview Vision] ❌ Canvas ref lost during fabric load');
          return;
        }

        console.log('[Preview Vision] 🖼️ Creating canvas (1080x1440)...');
        const canvas = new fabric.Canvas(canvasRef.current, {
          width: 1080,
          height: 1440,
          backgroundColor,
        });

        // Set zoom to 0.5 for display (1080x1440 -> 540x720)
        canvas.setZoom(0.5);
        console.log('[Preview Vision] 🔍 Canvas zoom set to 0.5 for display');

        fabricCanvasRef.current = canvas;
        setFabricLoaded(true);
        console.log('[Preview Vision] ✅ Canvas created and ready');
      }).catch((error) => {
        console.error('[Preview Vision] ❌ Failed to load Fabric.js:', error);
      });

      // Cleanup on unmount
      return () => {
        isMounted = false;
        if (fabricCanvasRef.current) {
          console.log('[Preview Vision] 🧹 Cleaning up canvas');
          fabricCanvasRef.current.dispose();
          fabricCanvasRef.current = null;
          setFabricLoaded(false);
        }
      };
    }, []); // Only run once on mount

    // Expose canvas instance to parent via ref
    useImperativeHandle(ref, () => fabricCanvasRef.current, [fabricLoaded]);

    // Re-render when layout or colors change
    useEffect(() => {
      console.log('[Preview Vision] 🎨 Render triggered');
      const canvas = fabricCanvasRef.current;
      const fabric = fabricModuleRef.current;
      
      if (!canvas || !fabricLoaded || !fabric) {
        console.log('[Preview Vision] ⏳ Waiting... Canvas:', !!canvas, 'Fabric loaded:', fabricLoaded, 'Fabric module:', !!fabric);
        return;
      }

      console.log('[Preview Vision] 🖌️ Rendering vision-based layout on canvas...');

      // Clear canvas
      canvas.clear();
      canvas.backgroundColor = backgroundColor;
      console.log('[Preview Vision] 🧹 Canvas cleared, background set to', backgroundColor);

      // STEP 1: Load and add image if provided
      if (layout.image && layout.image.url) {
        console.log('[Preview Vision] 🖼️ Loading image...');
        console.log('[Preview Vision] 📐 Image position:', layout.image);
        
        const imgElement = new Image();
        
        imgElement.onload = () => {
          console.log('[Preview Vision] ✅ Image loaded successfully');
          
          try {
            const fabricImage = new fabric.Image(imgElement, {
              left: layout.image!.x,
              top: layout.image!.y,
              scaleX: layout.image!.width / imgElement.width,
              scaleY: layout.image!.height / imgElement.height,
              selectable: true,
            });

            console.log('[Preview Vision] 📐 Image positioned and scaled');
            canvas.add(fabricImage);
            canvas.sendToBack(fabricImage); // Image behind text
            console.log('[Preview Vision] ✅ Image added to canvas');
          } catch (error) {
            console.error('[Preview Vision] ❌ Error creating Fabric image:', error);
          }
        };
        
        imgElement.onerror = (error) => {
          console.error('[Preview Vision] ❌ Image failed to load:', error);
        };
        
        imgElement.src = layout.image.url;
      }

      // STEP 2: Add text lines with mixed formatting
      console.log('[Preview Vision] ✍️ Adding text lines...');
      console.log('[Preview Vision] 📊 Total text lines:', layout.textLines.length);

      layout.textLines.forEach((line, index) => {
        console.log(`[Preview Vision] ✍️ Line ${index + 1}:`, {
          text: line.text.substring(0, 40),
          size: line.baseSize,
          pos: `(${line.position.x}, ${line.position.y})`,
          align: line.textAlign,
          styles: line.styles.length,
        });

        try {
          // Create IText object (supports mixed formatting)
          const textObj = new fabric.IText(line.text, {
            left: line.position.x,
            top: line.position.y,
            fontSize: line.baseSize,
            fill: textColor,
            fontFamily: 'Arial, sans-serif',
            textAlign: line.textAlign,
            lineHeight: line.lineHeight,
            originX: line.textAlign === 'center' ? 'center' : 'left',
            originY: 'top',
            selectable: true,
            editable: true,
          });

          // Apply style ranges (bold, italic, etc.)
          if (line.styles && line.styles.length > 0) {
            console.log(`[Preview Vision] 🎨 Applying ${line.styles.length} style range(s) to line ${index + 1}`);
            
            line.styles.forEach((style, styleIndex) => {
              console.log(`[Preview Vision]   Style ${styleIndex + 1}:`, {
                range: `chars ${style.start}-${style.end}`,
                weight: style.fontWeight,
                italic: style.fontStyle,
                color: style.fill,
              });

              const styleObj: any = {};
              
              if (style.fontWeight) {
                styleObj.fontWeight = style.fontWeight;
              }
              if (style.fontStyle) {
                styleObj.fontStyle = style.fontStyle;
              }
              if (style.fill) {
                styleObj.fill = style.fill;
              }
              if (style.underline) {
                styleObj.underline = style.underline;
              }

              // Apply styles to the character range
              textObj.setSelectionStyles(styleObj, style.start, style.end);
            });
          }

          canvas.add(textObj);
          console.log(`[Preview Vision] ✅ Line ${index + 1} added to canvas`);
        } catch (error) {
          console.error(`[Preview Vision] ❌ Error adding line ${index + 1}:`, error);
        }
      });

      canvas.renderAll();
      console.log('[Preview Vision] ✅ Render complete! Objects on canvas:', canvas.getObjects().length);
    }, [layout, backgroundColor, textColor, fabricLoaded]);

    return (
      <div className="flex flex-col items-center space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Preview (540x720 display, exports at 1080x1440)</h3>
        <div 
          style={{ 
            width: '540px', 
            height: '720px',
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
            height={1440}
            style={{ 
              display: 'block'
            }} 
          />
        </div>
        <p className="text-sm text-gray-600">
          Click text to edit. Drag to reposition. Select text to change styling.
        </p>
      </div>
    );
  }
);

CarouselPreviewVision.displayName = 'CarouselPreviewVision';

export default CarouselPreviewVision;

