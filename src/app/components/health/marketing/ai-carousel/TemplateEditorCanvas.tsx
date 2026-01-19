'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { supabase } from '../../../auth/AuthContext';
import type {
  CarouselTemplateDefinitionV1,
  TemplateAsset,
  TemplateImageAsset,
  TemplateShapeAsset,
  TemplateShapeStyle,
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
  getLayers: () => Array<{
    id: string;
    type: 'content-region' | 'text' | 'image' | 'shape';
    name: string;
    zIndex: number;
    kind?: string;
  }>;
  selectLayer: (layerId: string) => void;
  reorderLayer: (layerId: string, direction: 'up' | 'down') => void;
  addTextLayer: () => void;
  addRectLayer: () => void;
  renameLayer: (layerId: string, nextName: string) => void;
  deleteLayer: (layerId: string) => void;
  undo: () => void;
  getActiveLayerId: () => string | null;
  getTextLayerStyle: (layerId: string) => null | { fontFamily: string; fontWeight?: any; fontSize: number; fontStyle?: string; fill?: string };
  setTextLayerStyle: (
    layerId: string,
    patch: Partial<{ fontFamily: string; fontWeight: any; fontSize: number; fontStyle: string; fill: string }>
  ) => void;
  getShapeLayerStyle: (layerId: string) => null | { cornerRadius: number; fill: string; stroke: string; strokeWidth: number };
  setShapeLayerStyle: (
    layerId: string,
    patch: Partial<{ cornerRadius: number; fill: string; stroke: string; strokeWidth: number }>
  ) => void;
  startTextEditing: (layerId: string) => void;
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
    const contentRegionLayerId = '__content_region__';
    const historyRef = useRef<CarouselTemplateDefinitionV1[]>([]);
    const historyDebounceRef = useRef<number | null>(null);
    const applyingHistoryRef = useRef(false);
    const HISTORY_LIMIT = 50;

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

        if (a.type === 'shape') {
          const style: TemplateShapeStyle = {
            fill: String(obj.fill || a.style?.fill || '#111827'),
            stroke: String(obj.stroke || a.style?.stroke || '#111827'),
            strokeWidth: Number.isFinite(Number(obj.strokeWidth)) ? Number(obj.strokeWidth) : Number(a.style?.strokeWidth || 0),
          };
          const rx = Number(obj.rx ?? obj.ry ?? a.cornerRadius ?? 0);
          const cornerRadius = Number.isFinite(rx) ? Math.max(0, Math.round(rx)) : 0;
          return { ...a, rect, style, cornerRadius };
        }

        return { ...a, rect };
      });

      def.slides = [slide0];
      def.template_version = 1;
      return def;
    };

    const pushHistory = (snapshot?: CarouselTemplateDefinitionV1) => {
      if (applyingHistoryRef.current) return;
      const snap = snapshot ? clone(snapshot) : clone(exportFromCanvas());
      const arr = historyRef.current;
      // Avoid pushing duplicates (cheap check via JSON length).
      const prev = arr[arr.length - 1];
      if (prev && JSON.stringify(prev) === JSON.stringify(snap)) return;
      arr.push(snap);
      if (arr.length > HISTORY_LIMIT) arr.splice(0, arr.length - HISTORY_LIMIT);
    };

    const scheduleHistoryPush = () => {
      if (applyingHistoryRef.current) return;
      if (historyDebounceRef.current) window.clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = window.setTimeout(() => {
        historyDebounceRef.current = null;
        pushHistory();
      }, 250);
    };

    const computeLayersFromDef = (def: CarouselTemplateDefinitionV1) => {
      const slide0 = def.slides?.find(s => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
      const assets = Array.isArray(slide0.assets) ? slide0.assets : [];
      // UI ordering: show top-most layers first (higher zIndex first).
      const sorted = [...assets].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
      const nameForAsset = (a: any, idx: number) => {
        if (typeof a?.name === 'string' && a.name.trim()) return a.name.trim();
        if (a?.type === 'shape') {
          return a?.shape === 'rect' ? 'Rectangle' : 'Shape';
        }
        if (a?.type === 'image') {
          if (a?.kind === 'avatar') return 'Avatar';
          if (a?.kind === 'footer_icon') return 'Footer icon';
          if (a?.kind === 'cta_pill_image') return 'CTA';
          return `Image ${idx + 1}`;
        }
        // text
        if (a?.kind === 'display_name') return 'Display name';
        if (a?.kind === 'handle') return 'Handle';
        if (a?.kind === 'cta_text') return 'CTA text';
        return `Text ${idx + 1}`;
      };
      const layers = sorted.map((a: any, idx: number) => ({
        id: String(a.id),
        type: a.type === 'image' ? ('image' as const) : a.type === 'shape' ? ('shape' as const) : ('text' as const),
        name: nameForAsset(a, idx),
        zIndex: typeof a.zIndex === 'number' ? a.zIndex : 0,
        kind: a.kind,
      }));
      return [
        {
          id: contentRegionLayerId,
          type: 'content-region' as const,
          name: (slide0 as any)?.contentRegionName || 'Content Region',
          zIndex: -999,
          kind: 'contentRegion',
        },
        ...layers,
      ];
    };

    const selectLayerOnCanvas = (layerId: string) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      let obj: any = null;
      if (layerId === contentRegionLayerId) {
        obj = contentRegionObjRef.current;
      } else {
        obj = assetObjByIdRef.current.get(layerId) || null;
      }
      if (!obj) return;
      try {
        canvas.setActiveObject?.(obj);
        canvas.requestRenderAll?.();
      } catch {
        // ignore
      }
    };

    const normalizeZIndex = (assets: any[]) => {
      const sorted = [...assets].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      sorted.forEach((a, idx) => {
        a.zIndex = idx;
      });
      return sorted;
    };

    const reorderLayerInDef = (layerId: string, direction: 'up' | 'down') => {
      if (!layerId || layerId === contentRegionLayerId) return;
      pushHistory();
      const def = clone(defRef.current);
      const slide0 = def.slides?.find(s => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
      if (!def.slides || def.slides.length === 0) def.slides = [slide0];
      const assets = Array.isArray(slide0.assets) ? slide0.assets : [];
      // Normalize first so "up/down" moves are deterministic.
      const sorted = normalizeZIndex(assets);
      const idx = sorted.findIndex((a: any) => String(a.id) === String(layerId));
      if (idx === -1) return;
      // Semantics: "up" means bring forward (increase zIndex); "down" means send backward.
      const swapWith = direction === 'up' ? idx + 1 : idx - 1;
      if (swapWith < 0 || swapWith >= sorted.length) return;
      const tmp = sorted[idx];
      sorted[idx] = sorted[swapWith];
      sorted[swapWith] = tmp;
      // Re-normalize so zIndex remains contiguous and deterministic.
      normalizeZIndex(sorted);
      slide0.assets = sorted as any;
      def.slides = [slide0];
      defRef.current = clone(def);
      renderFromDefinition(defRef.current);
      // Reselect after rerender so the user sees it.
      selectLayerOnCanvas(layerId);
    };

    const addTextLayerToDef = () => {
      pushHistory();
      const def = exportFromCanvas();
      const slide0 = def.slides?.find(s => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
      if (!def.slides || def.slides.length === 0) def.slides = [slide0];
      const assets = Array.isArray(slide0.assets) ? slide0.assets : [];
      const nextZ = assets.reduce((m: number, a: any) => Math.max(m, typeof a?.zIndex === 'number' ? a.zIndex : -1), -1) + 1;
      const id = crypto.randomUUID();
      const t: TemplateTextAsset = {
        id,
        type: 'text',
        kind: 'other_text',
        name: `Text ${assets.filter((a: any) => a?.type === 'text').length + 1}`,
        rect: { x: 140, y: 220, width: 800, height: 80 },
        text: 'New text',
        style: { fontFamily: 'Inter', fontSize: 36, fontWeight: 'normal', fill: '#111827', textAlign: 'left' },
        locked: false,
        zIndex: nextZ,
        rotation: 0,
      };
      slide0.assets = [...assets, t as any];
      def.slides = [slide0];
      defRef.current = clone(def);
      renderFromDefinition(defRef.current);
      selectLayerOnCanvas(id);
    };

    const addRectLayerToDef = () => {
      pushHistory();
      const def = exportFromCanvas();
      const slide0 = def.slides?.find(s => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
      if (!def.slides || def.slides.length === 0) def.slides = [slide0];
      const assets = Array.isArray(slide0.assets) ? slide0.assets : [];
      const nextZ = assets.reduce((m: number, a: any) => Math.max(m, typeof a?.zIndex === 'number' ? a.zIndex : -1), -1) + 1;
      const id = crypto.randomUUID();
      const s: TemplateShapeAsset = {
        id,
        type: 'shape',
        shape: 'rect',
        kind: 'shape_rect',
        name: `Rectangle ${assets.filter((a: any) => a?.type === 'shape').length + 1}`,
        rect: { x: 140, y: 320, width: 240, height: 240 },
        cornerRadius: 0,
        style: { fill: '#111827', stroke: '#111827', strokeWidth: 0 },
        locked: false,
        zIndex: nextZ,
        rotation: 0,
      };
      slide0.assets = [...assets, s as any];
      def.slides = [slide0];
      defRef.current = clone(def);
      renderFromDefinition(defRef.current);
      selectLayerOnCanvas(id);
    };

    const renameLayerInDef = (layerId: string, nextName: string) => {
      const name = String(nextName || '').trim();
      if (!name) return;

      pushHistory();
      const def = clone(defRef.current);
      const slide0 = def.slides?.find(s => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
      if (!def.slides || def.slides.length === 0) def.slides = [slide0];

      if (layerId === contentRegionLayerId) {
        (slide0 as any).contentRegionName = name;
        def.slides = [slide0];
        defRef.current = clone(def);
        // No need to rerender canvas; just updating list/persistence.
        return;
      }

      const assets = Array.isArray(slide0.assets) ? slide0.assets : [];
      const idx = assets.findIndex((a: any) => String(a?.id) === String(layerId));
      if (idx === -1) return;
      assets[idx] = { ...(assets[idx] as any), name };
      slide0.assets = assets as any;
      def.slides = [slide0];
      defRef.current = clone(def);
      // Rerender so subsequent exports/operations stay consistent.
      renderFromDefinition(defRef.current);
      selectLayerOnCanvas(layerId);
    };

    const deleteLayerInDef = (layerId: string) => {
      if (!layerId) return;
      if (layerId === contentRegionLayerId) return; // never delete content region

      pushHistory();
      const def = clone(defRef.current);
      const slide0 = def.slides?.find(s => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
      if (!def.slides || def.slides.length === 0) def.slides = [slide0];
      const assets = Array.isArray(slide0.assets) ? slide0.assets : [];
      const nextAssets = assets.filter((a: any) => String(a?.id) !== String(layerId));
      slide0.assets = nextAssets as any;
      def.slides = [slide0];
      defRef.current = clone(def);
      renderFromDefinition(defRef.current);
      try {
        const canvas = fabricCanvasRef.current;
        canvas?.discardActiveObject?.();
        canvas?.requestRenderAll?.();
      } catch {
        // ignore
      }
    };

    const undoFromHistory = () => {
      const arr = historyRef.current;
      if (arr.length === 0) return;
      const last = arr.pop();
      if (!last) return;
      applyingHistoryRef.current = true;
      try {
        defRef.current = clone(last);
        renderFromDefinition(defRef.current);
      } finally {
        applyingHistoryRef.current = false;
      }
    };

    const getActiveLayerIdFromCanvas = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return null;
      const obj = canvas.getActiveObject?.();
      if (!obj) return null;
      const role = obj?.data?.role;
      if (role === 'template-content-region') return contentRegionLayerId;
      if (role === 'template-asset' && obj?.data?.assetId) return String(obj.data.assetId);
      return null;
    };

    const getTextStyleForLayer = (layerId: string) => {
      if (!layerId || layerId === contentRegionLayerId) return null;
      const obj = assetObjByIdRef.current.get(layerId);
      if (!obj) return null;
      const isText = obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
      if (!isText) return null;
      return {
        fontFamily: String(obj.fontFamily || 'Inter'),
        fontWeight: obj.fontWeight,
        fontSize: Number(obj.fontSize || 24),
        fontStyle: String(obj.fontStyle || 'normal'),
        fill: typeof obj.fill === 'string' ? obj.fill : undefined,
      };
    };

    const setTextStyleForLayer = (
      layerId: string,
      patch: Partial<{ fontFamily: string; fontWeight: any; fontSize: number; fontStyle: string; fill: string }>
    ) => {
      if (!layerId || layerId === contentRegionLayerId) return;
      const obj = assetObjByIdRef.current.get(layerId);
      const canvas = fabricCanvasRef.current;
      if (!obj || !canvas) return;
      const isText = obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
      if (!isText) return;
      pushHistory();
      try {
        const next: any = {};
        if (patch.fontFamily) next.fontFamily = patch.fontFamily;
        if (patch.fontWeight !== undefined) next.fontWeight = patch.fontWeight;
        if (typeof patch.fontSize === 'number' && Number.isFinite(patch.fontSize)) next.fontSize = Math.max(1, Math.round(patch.fontSize));
        if (patch.fontStyle) next.fontStyle = patch.fontStyle;
        if (typeof patch.fill === 'string') next.fill = patch.fill;
        obj.set?.(next);
        obj.setCoords?.();
        canvas.requestRenderAll?.();
      } catch {
        // ignore
      }
    };

    const getShapeStyleForLayer = (layerId: string) => {
      if (!layerId || layerId === contentRegionLayerId) return null;
      const obj = assetObjByIdRef.current.get(layerId);
      if (!obj) return null;
      const isRect = obj.type === 'rect';
      if (!isRect) return null;
      return {
        cornerRadius: Math.max(0, Math.round(Number(obj.rx ?? obj.ry ?? 0) || 0)),
        fill: String(obj.fill || '#111827'),
        stroke: String(obj.stroke || '#111827'),
        strokeWidth: Math.max(0, Math.round(Number(obj.strokeWidth ?? 0) || 0)),
      };
    };

    const setShapeStyleForLayer = (
      layerId: string,
      patch: Partial<{ cornerRadius: number; fill: string; stroke: string; strokeWidth: number }>
    ) => {
      if (!layerId || layerId === contentRegionLayerId) return;
      const obj = assetObjByIdRef.current.get(layerId);
      const canvas = fabricCanvasRef.current;
      if (!obj || !canvas) return;
      const isRect = obj.type === 'rect';
      if (!isRect) return;
      pushHistory();
      try {
        const next: any = {};
        if (typeof patch.fill === 'string') next.fill = patch.fill;
        if (typeof patch.stroke === 'string') next.stroke = patch.stroke;
        if (patch.strokeWidth !== undefined && Number.isFinite(Number(patch.strokeWidth))) {
          next.strokeWidth = Math.max(0, Number(patch.strokeWidth));
        }
        if (patch.cornerRadius !== undefined && Number.isFinite(Number(patch.cornerRadius))) {
          const desired = Math.max(0, Math.round(Number(patch.cornerRadius)));
          const w = typeof obj.getScaledWidth === 'function' ? obj.getScaledWidth() : (obj.width || 0) * (obj.scaleX || 1);
          const h = typeof obj.getScaledHeight === 'function' ? obj.getScaledHeight() : (obj.height || 0) * (obj.scaleY || 1);
          const maxR = Math.max(0, Math.floor(Math.min(w, h) / 2));
          const r = Math.min(desired, maxR);
          next.rx = r;
          next.ry = r;
        }
        obj.set?.(next);
        obj.setCoords?.();
        canvas.requestRenderAll?.();
      } catch {
        // ignore
      }
    };

    const startEditingTextLayer = (layerId: string) => {
      if (!layerId || layerId === contentRegionLayerId) return;
      const obj = assetObjByIdRef.current.get(layerId);
      const canvas = fabricCanvasRef.current;
      if (!obj || !canvas) return;
      const isText = obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
      if (!isText) return;
      try {
        canvas.setActiveObject?.(obj);
        if (typeof obj.enterEditing === 'function') {
          obj.enterEditing();
          if (typeof obj.selectAll === 'function') obj.selectAll();
        }
        canvas.requestRenderAll?.();
      } catch {
        // ignore
      }
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
        } else if (a.type === 'shape') {
          const s = a as TemplateShapeAsset;
          const r = Number.isFinite(Number(s.cornerRadius)) ? Math.max(0, Math.round(Number(s.cornerRadius))) : 0;
          const obj = new fabric.Rect({
            left: s.rect.x,
            top: s.rect.y,
            width: Math.max(1, s.rect.width),
            height: Math.max(1, s.rect.height),
            originX: 'left',
            originY: 'top',
            fill: s.style?.fill || '#111827',
            stroke: s.style?.stroke || '#111827',
            strokeWidth: Number(s.style?.strokeWidth || 0),
            rx: r,
            ry: r,
            selectable: true,
            evented: true,
          });
          (obj as any).data = { role: 'template-asset', assetId: s.id, assetType: 'shape', assetKind: s.kind };
          disableRotation(obj);
          canvas.add(obj);
          assetObjByIdRef.current.set(s.id, obj);
        }
      }

      // Track direct canvas edits (drag/resize/text edits) for undo.
      try {
        canvas.off?.('object:modified');
        canvas.off?.('text:changed');
        canvas.on?.('object:modified', () => scheduleHistoryPush());
        canvas.on?.('text:changed', () => scheduleHistoryPush());
      } catch {
        // ignore
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

          // Enable double-click to edit text layers (Mac Chrome friendly).
          // Fabric Textbox doesn't reliably enter editing on dblclick without this.
          try {
            canvas.on('mouse:dblclick', (opt: any) => {
              const target = opt?.target;
              if (!target) return;
              const role = target?.data?.role;
              if (role !== 'template-asset') return;
              const isText = target.type === 'textbox' || target.type === 'i-text' || target.type === 'text';
              if (!isText) return;
              try {
                canvas.setActiveObject?.(target);
                if (typeof target.enterEditing === 'function') {
                  target.enterEditing();
                  if (typeof target.selectAll === 'function') target.selectAll();
                }
                canvas.requestRenderAll?.();
              } catch {
                // ignore
              }
            });
          } catch {
            // ignore
          }

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
        pushHistory(defRef.current);
        const next = clone(def);
        defRef.current = next;
        renderFromDefinition(next);
      },

      addOrReplaceImageAsset: (asset) => {
        pushHistory();
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
        pushHistory();
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
      getLayers: () => computeLayersFromDef(defRef.current),
      selectLayer: (layerId: string) => selectLayerOnCanvas(layerId),
      reorderLayer: (layerId: string, direction: 'up' | 'down') => reorderLayerInDef(layerId, direction),
      addTextLayer: () => addTextLayerToDef(),
      addRectLayer: () => addRectLayerToDef(),
      renameLayer: (layerId: string, nextName: string) => renameLayerInDef(layerId, nextName),
      deleteLayer: (layerId: string) => deleteLayerInDef(layerId),
      undo: () => undoFromHistory(),
      getActiveLayerId: () => getActiveLayerIdFromCanvas(),
      getTextLayerStyle: (layerId: string) => getTextStyleForLayer(layerId),
      setTextLayerStyle: (layerId: string, patch: any) => setTextStyleForLayer(layerId, patch),
      getShapeLayerStyle: (layerId: string) => getShapeStyleForLayer(layerId),
      setShapeLayerStyle: (layerId: string, patch: any) => setShapeStyleForLayer(layerId, patch),
      startTextEditing: (layerId: string) => startEditingTextLayer(layerId),
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


