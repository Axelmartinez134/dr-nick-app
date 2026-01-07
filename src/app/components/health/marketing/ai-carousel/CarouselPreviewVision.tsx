'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { VisionLayoutDecision } from '@/lib/carousel-types';
import type { CarouselTemplateDefinitionV1, TemplateAsset, TemplateImageAsset, TemplateTextAsset, TemplateRect } from '@/lib/carousel-template-types';
import { supabase } from '../../../auth/AuthContext';

interface CarouselPreviewProps {
  layout: VisionLayoutDecision;
  backgroundColor: string;
  textColor: string;
  templateSnapshot?: CarouselTemplateDefinitionV1 | null;
  headlineFontFamily?: string;
  bodyFontFamily?: string;
  headlineFontWeight?: number;
  bodyFontWeight?: number;
}

const DISPLAY_ZOOM = 0.5;

const CarouselPreviewVision = forwardRef<any, CarouselPreviewProps>(
  ({ layout, backgroundColor, textColor, templateSnapshot, headlineFontFamily, bodyFontFamily, headlineFontWeight, bodyFontWeight }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<any>(null);
    const fabricModuleRef = useRef<any>(null);
    const [fabricLoaded, setFabricLoaded] = useState(false);
    const constraintsRef = useRef<{ allowedRect: null | { x: number; y: number; width: number; height: number } }>({ allowedRect: null });

    const computeAllowedRect = (tpl: CarouselTemplateDefinitionV1 | null | undefined) => {
      if (!tpl?.slides?.length) return null;
      const slide0 = tpl.slides.find(s => s.slideIndex === 0) || tpl.slides[0];
      const r = slide0?.contentRegion as TemplateRect | undefined;
      if (!r) return null;
      const PAD = 40;
      return {
        x: r.x + PAD,
        y: r.y + PAD,
        width: Math.max(1, r.width - (PAD * 2)),
        height: Math.max(1, r.height - (PAD * 2)),
      };
    };

    const disableRotationControls = (obj: any) => {
      try {
        obj.lockRotation = true;
        obj.hasRotatingPoint = false;
        if (typeof obj.setControlsVisibility === 'function') {
          obj.setControlsVisibility({ mtr: false });
        }
      } catch {
        // ignore
      }
    };

    const getAABBTopLeft = (obj: any) => {
      const width = (typeof obj.getScaledWidth === 'function'
        ? obj.getScaledWidth()
        : (obj.width || 0) * (obj.scaleX || 1));
      const height = (typeof obj.getScaledHeight === 'function'
        ? obj.getScaledHeight()
        : (obj.height || 0) * (obj.scaleY || 1));
      const originX = (obj.originX || 'left') as 'left' | 'center' | 'right';
      const originY = (obj.originY || 'top') as 'top' | 'center' | 'bottom';
      const leftRaw = obj.left || 0;
      const topRaw = obj.top || 0;
      const originOffsetX =
        originX === 'center' ? width / 2 :
        originX === 'right' ? width :
        0;
      const originOffsetY =
        originY === 'center' ? height / 2 :
        originY === 'bottom' ? height :
        0;
      return { x: leftRaw - originOffsetX, y: topRaw - originOffsetY, width, height, originOffsetX, originOffsetY };
    };

    const clampObjectToRect = (obj: any, rect: { x: number; y: number; width: number; height: number }) => {
      if (!obj) return;
      const { x: tlx, y: tly, width, height, originOffsetX, originOffsetY } = getAABBTopLeft(obj);
      const left = rect.x;
      const top = rect.y;
      const right = rect.x + rect.width;
      const bottom = rect.y + rect.height;

      // If object is larger than bounds, shrink (prefer uniform for images)
      if (width > rect.width || height > rect.height) {
        const sx = (obj.scaleX || 1);
        const sy = (obj.scaleY || 1);
        const maxScaleX = rect.width / Math.max(1, (obj.width || width));
        const maxScaleY = rect.height / Math.max(1, (obj.height || height));
        if (obj.type === 'image') {
          const uniform = Math.min(maxScaleX, maxScaleY);
          obj.scaleX = uniform;
          obj.scaleY = uniform;
        } else {
          obj.scaleX = Math.min(sx, maxScaleX);
          obj.scaleY = Math.min(sy, maxScaleY);
        }
      }

      const aabb = getAABBTopLeft(obj);
      let newTlx = aabb.x;
      let newTly = aabb.y;

      if (newTlx < left) newTlx = left;
      if (newTly < top) newTly = top;
      if (newTlx + aabb.width > right) newTlx = right - aabb.width;
      if (newTly + aabb.height > bottom) newTly = bottom - aabb.height;

      obj.left = newTlx + aabb.originOffsetX;
      obj.top = newTly + aabb.originOffsetY;
      if (typeof obj.setCoords === 'function') obj.setCoords();
    };

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

        // Enforce hard-clamps for user content when a template contentRegion exists.
        // We attach listeners once and consult constraintsRef (updated on render).
        const getUserImageBlockedRect = (): null | { left: number; top: number; right: number; bottom: number } => {
          const objs = canvas.getObjects?.() || [];
          const img = objs.find((o: any) => o?.type === 'image' && o?.data?.role === 'user-image');
          if (!img) return null;
          const aabb = getAABBTopLeft(img);
          const clearance = 1;
          return {
            left: Math.floor(aabb.x - clearance),
            top: Math.floor(aabb.y - clearance),
            right: Math.ceil(aabb.x + aabb.width + clearance),
            bottom: Math.ceil(aabb.y + aabb.height + clearance),
          };
        };

        const rectsOverlap = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) => {
          return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        };

        const objectAABB = (obj: any) => {
          const aabb = getAABBTopLeft(obj);
          return { left: aabb.x, top: aabb.y, right: aabb.x + aabb.width, bottom: aabb.y + aabb.height };
        };

        const pushTextOutOfImage = (obj: any) => {
          const allowed = constraintsRef.current.allowedRect;
          const blocked = getUserImageBlockedRect();
          if (!allowed || !blocked || !obj) return;
          const lr = objectAABB(obj);
          if (!rectsOverlap(lr, blocked)) return;

          // Candidate snap positions (keep current x if possible).
          const w = lr.right - lr.left;
          const h = lr.bottom - lr.top;
          const candidates: Array<{ x: number; y: number }> = [];

          // Above image
          candidates.push({ x: lr.left, y: blocked.top - h });
          // Below image
          candidates.push({ x: lr.left, y: blocked.bottom });
          // Left of image
          candidates.push({ x: blocked.left - w, y: lr.top });
          // Right of image (preferred tie-break)
          candidates.push({ x: blocked.right, y: lr.top });

          const withinAllowed = (p: { x: number; y: number }) => {
            return (
              p.x >= allowed.x &&
              p.y >= allowed.y &&
              (p.x + w) <= (allowed.x + allowed.width) &&
              (p.y + h) <= (allowed.y + allowed.height)
            );
          };

          const cur = { x: lr.left, y: lr.top };
          const dist2 = (a: any, b: any) => {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            return dx * dx + dy * dy;
          };

          const ok = candidates
            .filter(withinAllowed)
            .sort((a, b) => {
              const da = dist2(a, cur);
              const db = dist2(b, cur);
              if (da !== db) return da - db;
              // tie-break: prefer RIGHT
              if (a.x === blocked.right && b.x !== blocked.right) return -1;
              if (b.x === blocked.right && a.x !== blocked.right) return 1;
              return 0;
            })[0];

          if (!ok) {
            // Fallback: just clamp to allowed rect (better than staying on top of the image)
            clampObjectToRect(obj, allowed);
            return;
          }

          // Preserve origin offsets when setting left/top
          const aabbNow = getAABBTopLeft(obj);
          obj.left = ok.x + aabbNow.originOffsetX;
          obj.top = ok.y + aabbNow.originOffsetY;
          if (typeof obj.setCoords === 'function') obj.setCoords();
        };

        const onObjectMoving = (e: any) => {
          const rect = constraintsRef.current.allowedRect;
          if (!rect) return;
          const obj = e?.target;
          const role = obj?.data?.role;
          if (role !== 'user-image' && role !== 'user-text') return;
          clampObjectToRect(obj, rect);
          if (role === 'user-text') pushTextOutOfImage(obj);
          canvas.requestRenderAll?.();
        };
        const onObjectScaling = (e: any) => {
          const rect = constraintsRef.current.allowedRect;
          if (!rect) return;
          const obj = e?.target;
          const role = obj?.data?.role;
          if (role !== 'user-image' && role !== 'user-text') return;
          clampObjectToRect(obj, rect);
          if (role === 'user-text') pushTextOutOfImage(obj);
          canvas.requestRenderAll?.();
        };

        canvas.on('object:moving', onObjectMoving);
        canvas.on('object:scaling', onObjectScaling);
        // Store for cleanup
        (canvas as any).__dnClampHandlers = { onObjectMoving, onObjectScaling };
      }).catch((error) => {
        console.error('[Preview Vision] ❌ Failed to load Fabric.js:', error);
      });

      // Cleanup on unmount
      return () => {
        isMounted = false;
        if (fabricCanvasRef.current) {
          console.log('[Preview Vision] 🧹 Cleaning up canvas');
          try {
            const c = fabricCanvasRef.current;
            const h = (c as any).__dnClampHandlers;
            if (h) {
              c.off('object:moving', h.onObjectMoving);
              c.off('object:scaling', h.onObjectScaling);
            }
          } catch {
            // ignore
          }
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
        
        // Find the USER image object on canvas.
        // Templates introduce additional Fabric image objects; do NOT treat those as the user's image.
        const objects = canvas.getObjects();
        const imageObj =
          objects.find((obj: any) => obj?.type === 'image' && obj?.data?.role === 'user-image') ||
          objects.find((obj: any) => obj?.type === 'image'); // fallback for legacy canvases
        
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

        const topLeft = { x: leftRaw - originOffsetX, y: topRaw - originOffsetY };

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
      const existingImageObj =
        canvas.getObjects?.().find((obj: any) => obj?.type === 'image' && obj?.data?.role === 'user-image') ||
        canvas.getObjects?.().find((obj: any) => obj?.type === 'image');
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

      // Update clamp constraints based on template snapshot (contentRegion inset by 40px).
      constraintsRef.current.allowedRect = computeAllowedRect(templateSnapshot || null);

      const addTemplateAssets = () => {
        if (!templateSnapshot?.slides?.length) return;
        const slide0 = templateSnapshot.slides.find(s => s.slideIndex === 0) || templateSnapshot.slides[0];
        const assets = (slide0?.assets || []) as TemplateAsset[];
        if (!Array.isArray(assets) || assets.length === 0) return;

        // Deterministic ordering by zIndex, then stable id.
        const sorted = [...assets].sort((a, b) => {
          const za = (a.zIndex ?? 0);
          const zb = (b.zIndex ?? 0);
          if (za !== zb) return za - zb;
          return String(a.id).localeCompare(String(b.id));
        });

        for (const asset of sorted) {
          try {
            if (asset.type === 'text') {
              const t = asset as TemplateTextAsset;
              const obj = new fabric.Textbox(t.text || '', {
                left: t.rect.x,
                top: t.rect.y,
                width: Math.max(1, t.rect.width),
                fontSize: t.style?.fontSize || 24,
                fontFamily: t.style?.fontFamily || 'Arial, sans-serif',
                fontWeight: t.style?.fontWeight || 'normal',
                fill: t.style?.fill || '#000000',
                textAlign: t.style?.textAlign || 'left',
                originX: 'left',
                originY: 'top',
                selectable: false,
                editable: false,
                evented: false,
              });
              (obj as any).data = { role: 'template-asset', assetId: t.id, assetKind: t.kind, assetType: 'text' };
              disableRotationControls(obj);
              canvas.add(obj);
            } else if (asset.type === 'image') {
              const imgA = asset as TemplateImageAsset;
              const imgElement = new Image();
              imgElement.crossOrigin = 'anonymous';
              imgElement.onload = () => {
                try {
                  const fimg = new fabric.Image(imgElement, {
                    left: imgA.rect.x,
                    top: imgA.rect.y,
                    originX: 'left',
                    originY: 'top',
                    scaleX: imgA.rect.width / imgElement.width,
                    scaleY: imgA.rect.height / imgElement.height,
                    selectable: false,
                    evented: false,
                  });
                  (fimg as any).data = { role: 'template-asset', assetId: imgA.id, assetKind: imgA.kind, assetType: 'image' };
                  disableRotationControls(fimg);
                  canvas.add(fimg);
                  // Keep template assets behind user content.
                  if (typeof canvas.sendObjectToBack === 'function') canvas.sendObjectToBack(fimg);
                  canvas.renderAll();
                } catch (e) {
                  console.warn('[Preview Vision] ⚠️ Failed to add template image asset:', e);
                }
              };
              const setSrc = async () => {
                const publicUrl = imgA.src?.url;
                const objectPath = imgA.src?.path;
                if (!publicUrl || !objectPath) return;

                // First try public URL
                try {
                  const res = await fetch(publicUrl, { method: 'HEAD' });
                  if (res.ok) {
                    imgElement.src = publicUrl;
                    return;
                  }
                } catch {
                  // ignore and fallback
                }

                // Fallback: signed URL via server (works even when storage.objects policies can't be edited)
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return;
                  const templateId = String(objectPath.split('/')[0] || '');
                  const url = `/api/marketing/carousel/templates/signed-url?templateId=${encodeURIComponent(templateId)}&path=${encodeURIComponent(objectPath)}&expiresIn=3600`;
                  const r = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
                  const j = await r.json();
                  if (j?.success && j?.signedUrl) {
                    imgElement.src = j.signedUrl;
                    return;
                  }
                } catch {
                  // ignore
                }
              };
              void setSrc();
            }
          } catch (e) {
            console.warn('[Preview Vision] ⚠️ Failed to add template asset:', e);
          }
        }
      };

      // STEP 0: Add locked template assets (if any)
      addTemplateAssets();

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
            (fabricImage as any).data = { role: 'user-image' };
            disableRotationControls(fabricImage);

            console.log('[Preview Vision] 📐 Image positioned and scaled');
            canvas.add(fabricImage);
            
            // Stacking: template assets (locked layer) should be behind user content.
            // Place user image above template assets but below user text.
            const templateCount = (canvas.getObjects?.() || []).filter((o: any) => o?.data?.role === 'template-asset').length;
            let stacked = false;
            try {
              if (typeof canvas.moveTo === 'function') {
                canvas.moveTo(fabricImage, templateCount);
                stacked = true;
              } else if (typeof (fabricImage as any).moveTo === 'function') {
                (fabricImage as any).moveTo(templateCount);
                stacked = true;
              }
            } catch {
              stacked = false;
            }
            console.log('[Preview Vision] 🧱 Image stacking:', stacked ? `moved to index ${templateCount} ✅` : 'could not reorder ⚠️');

            // If the image loads after text has been added, force all text to the front.
            try {
              const objs = canvas.getObjects?.() || [];
              objs.forEach((obj: any) => {
                if (obj?.data?.role === 'user-text') {
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

      // Decide which lines are "headline" vs "body" so we can apply per-block font families.
      // Heuristic:
      // - If there are 2+ distinct font sizes, treat the largest baseSize lines as HEADLINE.
      // - If there is only 1 distinct font size, treat the first line as HEADLINE and the rest as BODY.
      const sizesDesc = Array.from(new Set(layout.textLines.map((l) => l.baseSize))).sort((a, b) => b - a);
      const headlineSize = sizesDesc[0] ?? 0;
      const hasDistinctHeadlineSize = sizesDesc.length >= 2;
      const headlineFont = headlineFontFamily || 'Inter, sans-serif';
      const bodyFont = bodyFontFamily || 'Inter, sans-serif';
      const headlineWeight = Number.isFinite(headlineFontWeight as any) ? (headlineFontWeight as number) : 700;
      const bodyWeight = Number.isFinite(bodyFontWeight as any) ? (bodyFontWeight as number) : 400;

      layout.textLines.forEach((line, index) => {
        console.log(`[Preview Vision] ✍️ Line ${index + 1}:`, {
          text: line.text.substring(0, 40),
          size: line.baseSize,
          pos: `(${line.position.x}, ${line.position.y})`,
          align: line.textAlign,
          styles: line.styles.length,
        });

        try {
          const isHeadlineLine = hasDistinctHeadlineSize ? line.baseSize === headlineSize : index === 0;
          const baseWeight = isHeadlineLine ? headlineWeight : bodyWeight;
          // Create Textbox object (enforces width constraint, supports mixed formatting)
          const textObj = new fabric.Textbox(line.text, {
            left: line.position.x,
            top: line.position.y,
            width: line.maxWidth, // CRITICAL: Hard width constraint that forces wrapping
            fontSize: line.baseSize,
            fill: textColor,
            fontFamily: isHeadlineLine ? headlineFont : bodyFont,
            fontWeight: baseWeight,
            textAlign: line.textAlign,
            lineHeight: line.lineHeight,
            originX: line.textAlign === 'center' ? 'center' : line.textAlign === 'right' ? 'right' : 'left',
            originY: 'top',
            selectable: true,
            editable: true,
            splitByGrapheme: false, // Wrap at word boundaries, not mid-word
          });
          (textObj as any).data = { role: 'user-text', lineIndex: index };
          disableRotationControls(textObj);

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
                // Our generator uses 'bold'/'normal'. Map to numeric weights so fonts like Open Sans Light render correctly.
                if (style.fontWeight === 'bold') styleObj.fontWeight = 700;
                else if (style.fontWeight === 'normal') styleObj.fontWeight = baseWeight;
                else styleObj.fontWeight = style.fontWeight as any;
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
    }, [layout, backgroundColor, textColor, fabricLoaded, templateSnapshot, headlineFontFamily, bodyFontFamily, headlineFontWeight, bodyFontWeight]);

    return (
      <div className="flex flex-col items-center space-y-4">
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
      </div>
    );
  }
);

CarouselPreviewVision.displayName = 'CarouselPreviewVision';

export default CarouselPreviewVision;

