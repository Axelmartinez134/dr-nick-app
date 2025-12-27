'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { supabase } from '../../../auth/AuthContext';
import type {
  CarouselTemplateDefinitionV1,
  TemplateAsset,
  TemplateImageAsset,
  TemplateTextAsset,
  TemplateRect,
  TemplateTextStyle,
} from '@/lib/carousel-template-types';

const DISPLAY_ZOOM = 0.5;

export interface TemplateEditorCanvasHandle {
  loadDefinition: (def: CarouselTemplateDefinitionV1) => void;
  exportDefinition: () => CarouselTemplateDefinitionV1;
  addOrReplaceImageAsset: (asset: TemplateImageAsset) => void;
  upsertTextAsset: (asset: TemplateTextAsset) => void;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function defaultSlide0(): { slideIndex: 0; contentRegion: TemplateRect; assets: TemplateAsset[] } {
  return {
    slideIndex: 0,
    // Default to full canvas; template designer can resize to create a safe box.
    contentRegion: { x: 0, y: 0, width: 1080, height: 1440 },
    assets: [],
  };
}

export default forwardRef<TemplateEditorCanvasHandle, { initialDefinition?: CarouselTemplateDefinitionV1 | null }>(
  function TemplateEditorCanvas({ initialDefinition }, ref) {
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<any>(null);
    const fabricRef = useRef<any>(null);
    const [ready, setReady] = useState(false);
    const [assetCount, setAssetCount] = useState(0);
    const [lastImageError, setLastImageError] = useState<string | null>(null);

    const defRef = useRef<CarouselTemplateDefinitionV1>({
      template_version: 1,
      slides: [defaultSlide0()],
    });

    const assetObjByIdRef = useRef<Map<string, any>>(new Map());
    const contentRegionObjRef = useRef<any>(null);

    const disableRotation = (obj: any) => {
      try {
        obj.lockRotation = true;
        obj.hasRotatingPoint = false;
        if (typeof obj.setControlsVisibility === 'function') obj.setControlsVisibility({ mtr: false });
      } catch {
        // ignore
      }
    };

    const rectFromObj = (obj: any): TemplateRect => {
      const width = typeof obj.getScaledWidth === 'function' ? obj.getScaledWidth() : (obj.width || 0) * (obj.scaleX || 1);
      const height = typeof obj.getScaledHeight === 'function' ? obj.getScaledHeight() : (obj.height || 0) * (obj.scaleY || 1);
      return {
        x: obj.left || 0,
        y: obj.top || 0,
        width,
        height,
      };
    };

    const exportFromCanvas = (): CarouselTemplateDefinitionV1 => {
      const def = clone(defRef.current);
      const canvas = fabricCanvasRef.current;
      if (!canvas) return def;

      const slide0 = def.slides?.find(s => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();

      // Content region
      const regionObj = canvas.getObjects?.().find((o: any) => o?.data?.role === 'template-content-region');
      if (regionObj) {
        slide0.contentRegion = rectFromObj(regionObj);
      }

      // Assets
      const objects = canvas.getObjects?.() || [];
      const byId = new Map<string, any>();
      objects.forEach((o: any) => {
        if (o?.data?.role === 'template-asset' && o?.data?.assetId) {
          byId.set(String(o.data.assetId), o);
        }
      });

      slide0.assets = (slide0.assets || []).map((a: any) => {
        const obj = byId.get(String(a.id));
        if (!obj) return a;
        const rect = rectFromObj(obj);

        if (a.type === 'text') {
          const style: TemplateTextStyle = {
            fontFamily: obj.fontFamily || a.style?.fontFamily || 'Inter',
            fontSize: obj.fontSize || a.style?.fontSize || 24,
            fontWeight: obj.fontWeight || a.style?.fontWeight || 'normal',
            fill: obj.fill || a.style?.fill || '#111827',
            textAlign: obj.textAlign || a.style?.textAlign || 'left',
          };
          return { ...a, rect, text: obj.text || a.text, style };
        }

        return { ...a, rect };
      });

      def.slides = [slide0];
      def.template_version = 1;
      return def;
    };

    const ensureContentRegion = (fabric: any, canvas: any, r: TemplateRect) => {
      const existing = contentRegionObjRef.current;
      if (existing) {
        existing.set({ left: r.x, top: r.y, width: r.width, height: r.height });
        existing.setCoords?.();
        return existing;
      }
      const rect = new fabric.Rect({
        left: r.x,
        top: r.y,
        width: r.width,
        height: r.height,
        originX: 'left',
        originY: 'top',
        fill: 'rgba(59, 130, 246, 0.06)', // blue-500 @ low alpha
        stroke: 'rgba(59, 130, 246, 0.9)',
        strokeWidth: 2,
        strokeDashArray: [8, 6],
        selectable: true,
        evented: true,
        hasBorders: true,
        hasControls: true,
      });
      (rect as any).data = { role: 'template-content-region' };
      disableRotation(rect);
      contentRegionObjRef.current = rect;
      canvas.add(rect);
      return rect;
    };

    const renderFromDefinition = (def: CarouselTemplateDefinitionV1) => {
      const canvas = fabricCanvasRef.current;
      const fabric = fabricRef.current;
      if (!canvas || !fabric) return;

      canvas.clear();
      canvas.setZoom?.(DISPLAY_ZOOM);
      if (canvas.viewportTransform && Array.isArray(canvas.viewportTransform)) {
        canvas.viewportTransform[4] = 0;
        canvas.viewportTransform[5] = 0;
      }
      canvas.backgroundColor = '#ffffff';

      assetObjByIdRef.current = new Map();
      contentRegionObjRef.current = null;

      const slide0 = def.slides?.find(s => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
      ensureContentRegion(fabric, canvas, slide0.contentRegion);

      const assets = Array.isArray(slide0.assets) ? slide0.assets : [];
      const sorted = [...assets].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      setAssetCount(sorted.length);

      for (const a of sorted) {
        if (a.type === 'text') {
          const t = a as TemplateTextAsset;
          const obj = new fabric.Textbox(t.text || '', {
            left: t.rect.x,
            top: t.rect.y,
            width: Math.max(1, t.rect.width),
            fontSize: t.style?.fontSize || 24,
            fontFamily: t.style?.fontFamily || 'Inter',
            fontWeight: t.style?.fontWeight || 'normal',
            fill: t.style?.fill || '#111827',
            textAlign: t.style?.textAlign || 'left',
            originX: 'left',
            originY: 'top',
            selectable: true,
            editable: true,
            evented: true,
          });
          (obj as any).data = { role: 'template-asset', assetId: t.id, assetType: 'text', assetKind: t.kind };
          disableRotation(obj);
          canvas.add(obj);
          assetObjByIdRef.current.set(t.id, obj);
        } else if (a.type === 'image') {
          const img = a as TemplateImageAsset;
          const imgEl = new Image();
          // Important for Fabric exports and consistent loading from Supabase Storage public URLs.
          // Even if you don't export from this editor, it helps avoid canvas taint issues.
          imgEl.crossOrigin = 'anonymous';
          imgEl.onload = () => {
            try {
              setLastImageError(null);
              const obj = new fabric.Image(imgEl, {
                left: img.rect.x,
                top: img.rect.y,
                originX: 'left',
                originY: 'top',
                scaleX: img.rect.width / imgEl.width,
                scaleY: img.rect.height / imgEl.height,
                selectable: true,
                evented: true,
              });
              (obj as any).data = { role: 'template-asset', assetId: img.id, assetType: 'image', assetKind: img.kind };
              disableRotation(obj);
              canvas.add(obj);
              assetObjByIdRef.current.set(img.id, obj);
              canvas.renderAll();
            } catch {
              // ignore
            }
          };
          imgEl.onerror = (e) => {
            const url = img.src?.url;
            const msg =
              `Image failed to load (likely 400/CORS). ` +
              `URL: ${url || '(missing url)'} ` +
              `— If this is a Supabase Storage public URL, confirm the bucket is PUBLIC and add ` +
              `"http://localhost:3000" to Supabase API Settings → CORS Allowed Origins.`;
            setLastImageError(msg);
            console.warn('[TemplateEditorCanvas] Image failed to load:', {
              assetId: img.id,
              url,
              error: e,
            });
          };
          const setSrc = async () => {
            const publicUrl = img.src?.url;
            const objectPath = img.src?.path;
            if (!publicUrl || !objectPath) return;

            // First try the public URL
            try {
              const res = await fetch(publicUrl, { method: 'HEAD' });
              if (res.ok) {
                imgEl.src = publicUrl;
                return;
              }
              console.warn('[TemplateEditorCanvas] Public URL not readable, falling back to signed URL:', { publicUrl, status: res.status });
            } catch (err) {
              console.warn('[TemplateEditorCanvas] Public URL HEAD failed, falling back to signed URL:', { publicUrl, err });
            }

            // Fallback: signed URL (mirrors the Monday check-in pattern)
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) {
                setLastImageError(`Image is not publicly readable and no session exists to mint a signed URL. URL: ${publicUrl}`);
                return;
              }
              const templateId = String(objectPath.split('/')[0] || '');
              const url = `/api/marketing/carousel/templates/signed-url?templateId=${encodeURIComponent(templateId)}&path=${encodeURIComponent(objectPath)}&expiresIn=3600`;
              const r = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
              const j = await r.json();
              if (j?.success && j?.signedUrl) {
                imgEl.src = j.signedUrl;
                return;
              }
              setLastImageError(`Failed to mint signed URL for template asset. ${j?.error || ''}`);
            } catch (e2: any) {
              setLastImageError(`Failed to mint signed URL for template asset. ${e2?.message || 'unknown error'}`);
            }
          };

          void setSrc();
        }
      }

      canvas.renderAll();
    };

    useEffect(() => {
      if (!canvasElRef.current) return;
      if (fabricCanvasRef.current) return;

      let mounted = true;
      import('fabric')
        .then((mod) => {
          if (!mounted) return;
          const fabric = (mod as any).fabric || mod;
          fabricRef.current = fabric;

          const canvas = new fabric.Canvas(canvasElRef.current, {
            width: 1080,
            height: 1440,
            backgroundColor: '#ffffff',
          });
          canvas.setZoom(DISPLAY_ZOOM);
          fabricCanvasRef.current = canvas;

          setReady(true);

          // Initial render
          const initDef = initialDefinition ? clone(initialDefinition) : defRef.current;
          defRef.current = initDef;
          renderFromDefinition(initDef);
        })
        .catch((e) => console.error('[TemplateEditorCanvas] Failed to load Fabric:', e));

      return () => {
        mounted = false;
        try {
          fabricCanvasRef.current?.dispose?.();
        } catch {
          // ignore
        }
        fabricCanvasRef.current = null;
        fabricRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      loadDefinition: (def) => {
        const next = clone(def);
        defRef.current = next;
        renderFromDefinition(next);
      },

      addOrReplaceImageAsset: (asset) => {
        const def = exportFromCanvas();
        const slide0 = def.slides?.find(s => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
        if (!def.slides || def.slides.length === 0) def.slides = [slide0];

        const existingIdx = slide0.assets.findIndex(a => a.id === asset.id);
        if (existingIdx >= 0) slide0.assets[existingIdx] = asset;
        else slide0.assets.push(asset);

        defRef.current = clone(def);
        renderFromDefinition(defRef.current);
      },

      upsertTextAsset: (asset) => {
        const def = exportFromCanvas();
        const slide0 = def.slides?.find(s => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
        if (!def.slides || def.slides.length === 0) def.slides = [slide0];

        const existingIdx = slide0.assets.findIndex(a => a.id === asset.id);
        if (existingIdx >= 0) slide0.assets[existingIdx] = asset;
        else slide0.assets.push(asset);

        defRef.current = clone(def);
        renderFromDefinition(defRef.current);
      },

      exportDefinition: () => {
        const def = exportFromCanvas();
        defRef.current = clone(def);
        return def;
      },
    }), [initialDefinition]);

    return (
      <div className="flex flex-col items-center gap-3">
        <div className="text-sm text-black">
          {ready
            ? `Template canvas ready (540×720 display, exports 1080×1440) • Assets: ${assetCount}`
            : 'Loading template canvas...'}
        </div>
        {lastImageError && (
          <div className="w-full max-w-[540px] text-xs text-black bg-black/5 border border-gray-200 rounded p-3">
            {lastImageError}
          </div>
        )}
        <div
          style={{
            width: '540px',
            height: '720px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#f9fafb',
          }}
        >
          <canvas ref={canvasElRef} width={1080} height={1440} style={{ display: 'block' }} />
        </div>
      </div>
    );
  }
);


