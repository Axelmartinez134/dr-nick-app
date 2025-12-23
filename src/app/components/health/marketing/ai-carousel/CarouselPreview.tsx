'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { TextLayoutDecision } from '@/lib/carousel-types';

interface CarouselPreviewProps {
  layout: TextLayoutDecision;
  headline: string;
  body: string;
  backgroundColor: string;
  textColor: string;
  imageUrl?: string;
}

const CarouselPreview = forwardRef<any, CarouselPreviewProps>(
  ({ layout, headline, body, backgroundColor, textColor, imageUrl }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<any>(null);
    const fabricModuleRef = useRef<any>(null);
    const [fabricLoaded, setFabricLoaded] = useState(false);

    // Initialize Fabric canvas once
    useEffect(() => {
      console.log('[Preview] 🎨 Initializing canvas...');
      if (!canvasRef.current) {
        console.log('[Preview] ❌ Canvas ref not ready');
        return;
      }

      // Don't initialize if already initialized
      if (fabricCanvasRef.current) {
        console.log('[Preview] ⚠️ Canvas already initialized, skipping');
        return;
      }

      console.log('[Preview] 📦 Loading Fabric.js...');
      let isMounted = true;
      
      // Dynamically import fabric only on client-side
      import('fabric').then((fabricModule) => {
        if (!isMounted) {
          console.log('[Preview] ⚠️ Component unmounted, skipping initialization');
          return;
        }

        console.log('[Preview] ✅ Fabric.js loaded');
        console.log('[Preview] 🔍 Module structure:', Object.keys(fabricModule));
        
        // Fabric.js exports might be on the module directly or nested
        const fabric = (fabricModule as any).fabric || fabricModule;
        console.log('[Preview] 🔍 Fabric object:', typeof fabric, 'Has Canvas?', !!fabric.Canvas);
        
        // Store fabric module for later use
        fabricModuleRef.current = fabric;
        console.log('[Preview] 💾 Fabric module stored for reuse');
        
        if (!canvasRef.current) {
          console.log('[Preview] ❌ Canvas ref lost during fabric load');
          return;
        }

        console.log('[Preview] 🖼️ Creating canvas (1080x1440)...');
        const canvas = new fabric.Canvas(canvasRef.current, {
          width: 1080,
          height: 1440,
          backgroundColor,
        });

        // Set zoom to 0.5 for display (1080x1440 -> 540x720)
        canvas.setZoom(0.5);
        console.log('[Preview] 🔍 Canvas zoom set to 0.5 for display');

        fabricCanvasRef.current = canvas;
        setFabricLoaded(true);
        console.log('[Preview] ✅ Canvas created and ready');
        console.log('[Preview] 📤 Canvas ref should now be available to parent');
      }).catch((error) => {
        console.error('[Preview] ❌ Failed to load Fabric.js:', error);
      });

      // Cleanup on unmount
      return () => {
        isMounted = false;
        if (fabricCanvasRef.current) {
          console.log('[Preview] 🧹 Cleaning up canvas');
          fabricCanvasRef.current.dispose();
          fabricCanvasRef.current = null;
          setFabricLoaded(false);
        }
      };
    }, []); // Only run once on mount

    // Expose canvas instance to parent via ref
    useImperativeHandle(ref, () => fabricCanvasRef.current, [fabricLoaded]);

    // Re-render when layout, text, or colors change
    useEffect(() => {
      console.log('[Preview] 🎨 Render triggered');
      const canvas = fabricCanvasRef.current;
      const fabric = fabricModuleRef.current;
      
      if (!canvas || !fabricLoaded || !fabric) {
        console.log('[Preview] ⏳ Waiting... Canvas:', !!canvas, 'Fabric loaded:', fabricLoaded, 'Fabric module:', !!fabric);
        return;
      }

      console.log('[Preview] 🖌️ Rendering text on canvas...');

      console.log('[Preview] 🧹 Clearing canvas');
      // Clear canvas
      canvas.clear();
      canvas.backgroundColor = backgroundColor;

      // Load and add image if provided
      console.log('[Preview] 🖼️ Checking for image...');
      console.log('[Preview] 🖼️ imageUrl:', imageUrl);
      console.log('[Preview] 🖼️ layout.image:', layout.image);
      console.log('[Preview] 🖼️ Should load image?', !!(imageUrl && layout.image));
      
      if (imageUrl && layout.image) {
        console.log('[Preview] 🖼️ Loading image from URL:', imageUrl);
        console.log('[Preview] 📐 Image config:', {
          x: layout.image.x,
          y: layout.image.y,
          width: layout.image.width,
          height: layout.image.height,
          scale: layout.image.scale,
        });
        console.log('[Preview] 🔍 fabric.Image available?', !!fabric.Image);
        
        if (!fabric.Image) {
          console.error('[Preview] ❌ fabric.Image is not available!');
          return;
        }
        
        // Use native browser Image API for better debugging
        console.log('[Preview] 📡 Creating native Image element...');
        const imgElement = new Image();
        // Note: crossOrigin not needed for data URLs or same-origin images
        if (imageUrl.startsWith('http')) {
          imgElement.crossOrigin = 'anonymous';
          console.log('[Preview] 🔒 CORS enabled for external URL');
        }
        
        imgElement.onload = () => {
          console.log('[Preview] ✅ Native image loaded successfully!');
          console.log('[Preview] 📏 Native image dimensions:', imgElement.width, 'x', imgElement.height);
          
          try {
            console.log('[Preview] 🎨 Creating Fabric.js image from element...');
            const fabricImage = new fabric.Image(imgElement, {
              left: layout.image!.x,
              top: layout.image!.y,
              scaleX: layout.image!.scale,
              scaleY: layout.image!.scale,
              selectable: true,
            });

            console.log('[Preview] 📐 Fabric image created and positioned at:', fabricImage.left, fabricImage.top);
            console.log('[Preview] 📏 Fabric image scaled dimensions:', 
              fabricImage.width! * fabricImage.scaleX!, 
              'x', 
              fabricImage.height! * fabricImage.scaleY!);
            
            canvas.add(fabricImage);
            console.log('[Preview] ✅ Image added to canvas');
            console.log('[Preview] 📊 Canvas objects count:', canvas.getObjects().length);
            
            canvas.renderAll();
            console.log('[Preview] ✅ Canvas rendered with image');
          } catch (error) {
            console.error('[Preview] ❌ Error creating Fabric image:', error);
          }
        };
        
        imgElement.onerror = (error) => {
          console.error('[Preview] ❌ Native image failed to load:', error);
          console.error('[Preview] ❌ Image URL:', imageUrl);
        };
        
        console.log('[Preview] 📥 Starting image download...');
        imgElement.src = imageUrl;
        console.log('[Preview] ⏳ Waiting for image to load...');
      } else {
        console.log('[Preview] ℹ️ Skipping image (not provided or no image layout)');
      }

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
    }, [layout, headline, body, backgroundColor, textColor, imageUrl, fabricLoaded]);

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
          Click text to edit. Drag to reposition. Colors update live.
        </p>
      </div>
    );
  }
);

CarouselPreview.displayName = 'CarouselPreview';

export default CarouselPreview;

