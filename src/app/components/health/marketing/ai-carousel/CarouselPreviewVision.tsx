'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { VisionLayoutDecision } from '@/lib/carousel-types';

interface CarouselPreviewProps {
  layout: VisionLayoutDecision;
  backgroundColor: string;
  textColor: string;
}

const DISPLAY_ZOOM = 0.5;

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
        canvas.setZoom(DISPLAY_ZOOM);
        console.log('[Preview Vision] 🔍 Canvas zoom set to', DISPLAY_ZOOM, 'for display');

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

    // Expose canvas instance and utility methods to parent via ref
    useImperativeHandle(ref, () => ({
      canvas: fabricCanvasRef.current,
      
      // Capture canvas screenshot as base64 PNG
      captureScreenshot: (): string | null => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) {
          console.error('[Preview Vision] ❌ Cannot capture screenshot: canvas not initialized');
          return null;
        }
        
        console.log('[Preview Vision] 📸 Capturing canvas screenshot...');
        
        // Temporarily reset zoom to 1.0 for full-resolution screenshot
        const currentZoom = canvas.getZoom();
        canvas.setZoom(1.0);
        
        // Capture as PNG data URL
        const dataURL = canvas.toDataURL({
          format: 'png',
          quality: 1.0,
          multiplier: 1,
        });
        
        // Restore original zoom
        canvas.setZoom(currentZoom);
        
        console.log('[Preview Vision] ✅ Screenshot captured, length:', dataURL.length);
        return dataURL;
      },
      
      // Capture screenshot with ONLY image and background (no text)
      // Used for realignment so Claude doesn't see old text positions
      captureImageOnly: (): string | null => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) {
          console.error('[Preview Vision] ❌ Cannot capture screenshot: canvas not initialized');
          return null;
        }
        
        console.log('[Preview Vision] 📸 Capturing IMAGE-ONLY screenshot (hiding text)...');
        
        // Save current state
        const currentZoom = canvas.getZoom();
        const objects = canvas.getObjects();
        
        // Hide all text objects temporarily
        const textObjects = objects.filter((obj: any) => obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox');
        console.log(`[Preview Vision] 👻 Hiding ${textObjects.length} text objects...`);
        
        textObjects.forEach((obj: any) => {
          obj.visible = false;
        });
        
        // Reset zoom for full-resolution
        canvas.setZoom(1.0);
        canvas.renderAll(); // Re-render without text
        
        // Capture screenshot
        const dataURL = canvas.toDataURL({
          format: 'png',
          quality: 1.0,
          multiplier: 1,
        });
        
        // Restore text objects visibility
        console.log(`[Preview Vision] 👁️ Restoring ${textObjects.length} text objects...`);
        textObjects.forEach((obj: any) => {
          obj.visible = true;
        });
        
        // Restore zoom
        canvas.setZoom(currentZoom);
        canvas.renderAll();
        
        console.log('[Preview Vision] ✅ Image-only screenshot captured, length:', dataURL.length);
        return dataURL;
      },
      
      // Get current image position from canvas
      getImagePosition: (): { x: number; y: number; width: number; height: number } | null => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) {
          console.error('[Preview Vision] ❌ Cannot get image position: canvas not initialized');
          return null;
        }
        
        console.log('[Preview Vision] 📐 Getting current image position...');
        
        // Find the image object on canvas (should be the first Image object)
        const objects = canvas.getObjects();
        const imageObj = objects.find((obj: any) => obj.type === 'image');
        
        if (!imageObj) {
          console.error('[Preview Vision] ❌ No image found on canvas');
          return null;
        }
        
        // CRITICAL: We need the TRUE axis-aligned bounding box (AABB) of the image on the canvas.
        // Depending on Fabric version/origin settings, imageObj.left/top may represent center, not top-left.
        // Also, getBoundingRect has version-specific behavior with zoom/viewportTransform.
        // Since rotation is disallowed, we can compute a stable AABB using origin-aware helpers:
        //   topLeft = getPointByOrigin('left','top')
        //   width/height = getScaledWidth/getScaledHeight
        const zoom = typeof canvas.getZoom === 'function' ? canvas.getZoom() : 1;
        const vpt = canvas.viewportTransform || [zoom, 0, 0, zoom, 0, 0];

        if (typeof imageObj.setCoords === 'function') {
          imageObj.setCoords();
        }

        const width = (typeof imageObj.getScaledWidth === 'function'
          ? imageObj.getScaledWidth()
          : (imageObj.width || 0) * (imageObj.scaleX || 1));
        const height = (typeof imageObj.getScaledHeight === 'function'
          ? imageObj.getScaledHeight()
          : (imageObj.height || 0) * (imageObj.scaleY || 1));

        // Compute top-left ourselves from left/top + origin + scaled size.
        // This avoids relying on Fabric helpers that can vary across versions.
        const originX = (imageObj.originX || 'left') as 'left' | 'center' | 'right';
        const originY = (imageObj.originY || 'top') as 'top' | 'center' | 'bottom';
        const leftRaw = imageObj.left || 0;
        const topRaw = imageObj.top || 0;

        const originOffsetX =
          originX === 'center' ? width / 2 :
          originX === 'right' ? width :
          0;
        const originOffsetY =
          originY === 'center' ? height / 2 :
          originY === 'bottom' ? height :
          0;

        let topLeft = { x: leftRaw - originOffsetX, y: topRaw - originOffsetY };

        // fallback: bounding rect (may be viewport-dependent in some Fabric builds)
        let rectAbs = null as null | { left: number; top: number; width: number; height: number };
        if (typeof imageObj.getBoundingRect === 'function') {
          const r = imageObj.getBoundingRect(true, true);
          if (r && Number.isFinite(r.left) && Number.isFinite(r.top)) {
            rectAbs = { left: r.left, top: r.top, width: r.width, height: r.height };
          }
        }

        // If the numbers look like they’re in viewport space (scaled by zoom), normalize them back.
        // Heuristic: if zoom < 1 and coordinates are "suspiciously large" while preserved image top is smaller,
        // dividing by zoom generally restores canonical canvas coords.
        const normalize = (p: { x: number; y: number }) => {
          if (!zoom || zoom === 1) return p;
          // If viewportTransform has translation, remove it too.
          const tx = vpt[4] || 0;
          const ty = vpt[5] || 0;
          return { x: (p.x - tx) / zoom, y: (p.y - ty) / zoom };
        };

        const cand1 = { x: topLeft.x, y: topLeft.y, width, height };
        const cand2 = { ...normalize(topLeft), width: width / (zoom || 1), height: height / (zoom || 1) };

        const looksReasonable = (c: any) =>
          Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.width) && Number.isFinite(c.height) &&
          c.width > 0 && c.height > 0 &&
          c.x > -2000 && c.x < 4000 && c.y > -2000 && c.y < 6000;

        const chosen = looksReasonable(cand1) ? cand1 : cand2;

        console.log('[Preview Vision] 🔎 Image bounds debug:', {
          zoom,
          viewportTransform: vpt,
          rectAbs,
          origin: { originX, originY },
          leftTopRaw: { leftRaw, topRaw },
          scaled: { width, height },
          computedTopLeft: topLeft,
          cand1,
          cand2,
          chosen
        });
        console.log(`[Preview Vision] 🧮 Image AABB SENT: x=${Math.round(chosen.x)} y=${Math.round(chosen.y)} w=${Math.round(chosen.width)} h=${Math.round(chosen.height)}`);
        console.log('[Preview Vision] 📍 Image extends to:', { right: chosen.x + chosen.width, bottom: chosen.y + chosen.height });
        return chosen;
      },
    }), [fabricLoaded]);

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

      // Preserve current image position so realign can NEVER move the user's image.
      // Use origin-aware top-left (getPointByOrigin) so we preserve the user's intended placement.
      const existingImageObj = canvas.getObjects?.().find((obj: any) => obj.type === 'image');
      let preservedImage: null | { left: number; top: number; scaleX: number; scaleY: number } = null;
      if (existingImageObj) {
        try {
          if (typeof existingImageObj.setCoords === 'function') existingImageObj.setCoords();
          const tl = typeof existingImageObj.getPointByOrigin === 'function'
            ? existingImageObj.getPointByOrigin('left', 'top')
            : null;
          preservedImage = {
            left: tl ? tl.x : (existingImageObj.left || 0),
            top: tl ? tl.y : (existingImageObj.top || 0),
            scaleX: existingImageObj.scaleX || 1,
            scaleY: existingImageObj.scaleY || 1,
          };
        } catch {
          preservedImage = {
            left: existingImageObj.left || 0,
            top: existingImageObj.top || 0,
            scaleX: existingImageObj.scaleX || 1,
            scaleY: existingImageObj.scaleY || 1,
          };
        }
      }
      if (preservedImage) {
        console.log('[Preview Vision] 🧷 Preserving existing image position:', preservedImage);
      }

      // Clear canvas
      canvas.clear();
      // IMPORTANT: fabric.Canvas#clear() can reset viewportTransform/zoom depending on Fabric version.
      // Re-apply display zoom deterministically every render so coordinates & hit-testing remain stable.
      if (typeof canvas.setZoom === 'function') {
        canvas.setZoom(DISPLAY_ZOOM);
      }
      if (canvas.viewportTransform && Array.isArray(canvas.viewportTransform)) {
        // Ensure no translation drift
        canvas.viewportTransform[4] = 0;
        canvas.viewportTransform[5] = 0;
      }
      canvas.backgroundColor = backgroundColor;
      console.log('[Preview Vision] 🧹 Canvas cleared, background set to', backgroundColor);

      // STEP 1: Load and add image if provided
      if (layout.image && layout.image.url) {
        console.log('[Preview Vision] 🖼️ Loading image...');
        console.log('[Preview Vision] 📐 Image position:', layout.image);
        
        const imgElement = new Image();
        
        imgElement.onload = () => {
          console.log('[Preview Vision] ✅ Image loaded successfully');
          
          // Verify canvas still exists and has required methods
          if (!canvas || typeof canvas.add !== 'function') {
            console.error('[Preview Vision] ❌ Canvas not available for image rendering');
            return;
          }
          
          try {
            const desiredLeft = preservedImage ? preservedImage.left : layout.image!.x;
            const desiredTop = preservedImage ? preservedImage.top : layout.image!.y;

            const fabricImage = new fabric.Image(imgElement, {
              left: desiredLeft,
              top: desiredTop,
              originX: 'left',
              originY: 'top',
              // If we preserved an existing image, keep its exact scale so it never "jumps".
              scaleX: preservedImage ? preservedImage.scaleX : (layout.image!.width / imgElement.width),
              scaleY: preservedImage ? preservedImage.scaleY : (layout.image!.height / imgElement.height),
              selectable: true,
            });

            console.log('[Preview Vision] 📐 Image positioned and scaled');
            canvas.add(fabricImage);
            
            // Send image to back across Fabric versions
            const sendImageToBack = () => {
              if (typeof canvas.sendObjectToBack === 'function') {
                canvas.sendObjectToBack(fabricImage);
                return true;
              }
              if (typeof canvas.sendToBack === 'function') {
                canvas.sendToBack(fabricImage);
                return true;
              }
              if (typeof canvas.moveTo === 'function') {
                canvas.moveTo(fabricImage, 0);
                return true;
              }
              if (typeof (fabricImage as any).moveTo === 'function') {
                (fabricImage as any).moveTo(0);
                return true;
              }
              return false;
            };

            const sent = sendImageToBack();
            console.log('[Preview Vision] 🧱 Image stacking:', sent ? 'sent to back ✅' : 'could not reorder ⚠️');

            // If the image loads after text has been added, force all text to the front.
            try {
              const objs = canvas.getObjects?.() || [];
              objs.forEach((obj: any) => {
                if (obj?.type === 'textbox' || obj?.type === 'i-text' || obj?.type === 'text') {
                  if (typeof canvas.bringObjectToFront === 'function') {
                    canvas.bringObjectToFront(obj);
                  } else if (typeof canvas.bringToFront === 'function') {
                    canvas.bringToFront(obj);
                  } else if (typeof canvas.moveTo === 'function') {
                    canvas.moveTo(obj, (canvas.getObjects?.().length || 1) - 1);
                  } else if (typeof obj?.moveTo === 'function') {
                    obj.moveTo((canvas.getObjects?.().length || 1) - 1);
                  }
                }
              });
              canvas.renderAll();
              console.log('[Preview Vision] ✅ Forced text to front after image load');
            } catch (e) {
              console.warn('[Preview Vision] ⚠️ Could not force text to front:', e);
            }
            
            console.log('[Preview Vision] ✅ Image added to canvas');
            canvas.renderAll();
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
          // Create Textbox object (enforces width constraint, supports mixed formatting)
          const textObj = new fabric.Textbox(line.text, {
            left: line.position.x,
            top: line.position.y,
            width: line.maxWidth, // CRITICAL: Hard width constraint that forces wrapping
            fontSize: line.baseSize,
            fill: textColor,
            fontFamily: 'Arial, sans-serif',
            textAlign: line.textAlign,
            lineHeight: line.lineHeight,
            originX: line.textAlign === 'center' ? 'center' : line.textAlign === 'right' ? 'right' : 'left',
            originY: 'top',
            selectable: true,
            editable: true,
            splitByGrapheme: false, // Wrap at word boundaries, not mid-word
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

