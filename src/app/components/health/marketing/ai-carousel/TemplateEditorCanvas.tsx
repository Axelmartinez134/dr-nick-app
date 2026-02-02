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
  // Phase 2 (arrows): creation helpers (UI lives in TemplateEditorModal).
  addArrowSolidLayer: () => void;
  addArrowLineLayer: () => void;
  renameLayer: (layerId: string, nextName: string) => void;
  deleteLayer: (layerId: string) => void;
  undo: () => void;
  getActiveLayerId: () => string | null;
  getTextLayerStyle: (layerId: string) => null | { fontFamily: string; fontWeight?: any; fontSize: number; fontStyle?: string; fill?: string };
  setTextLayerStyle: (
    layerId: string,
    patch: Partial<{ fontFamily: string; fontWeight: any; fontSize: number; fontStyle: string; fill: string }>
  ) => void;
  getShapeLayerStyle: (layerId: string) => null | {
    shape: 'rect' | 'arrow_solid' | 'arrow_line' | 'unknown';
    cornerRadius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    arrowHeadSizePx?: number;
  };
  setShapeLayerStyle: (
    layerId: string,
    patch: Partial<{ cornerRadius: number; fill: string; stroke: string; strokeWidth: number; arrowHeadSizePx: number }>
  ) => void;
  startTextEditing: (layerId: string) => void;
  // Phase 4: avatar-style crop mode for circular-masked images.
  startImageCropMode: (layerId: string) => void;
  finishImageCropMode: () => void;
  resetImageCrop: (layerId: string) => void;
  getActiveImageCropLayerId: () => string | null;
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
    const [cropModeLayerId, setCropModeLayerId] = useState<string | null>(null);
    const [cropDragging, setCropDragging] = useState(false);

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

    // Phase 1 (arrows): dev-only preview flag so we can validate rendering before Phase 2 adds creation UI.
    const shouldShowArrowDevPreview = (): boolean => {
      if (process.env.NODE_ENV === 'production') return false;
      try {
        return typeof localStorage !== 'undefined' && localStorage.getItem('dn_template_arrow_test') === '1';
      } catch {
        return false;
      }
    };

    const clampArrow = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    const buildSolidArrowPoints = (w: number, h: number, headLenPx: number) => {
      const headW = clampArrow(Number(headLenPx) || 0, 8, Math.max(8, w - 8));
      const shaftW = Math.max(1, w - headW);
      const shaftTop = h * 0.25;
      const shaftBot = h * 0.75;
      // Right-pointing arrow, local coords (0..w, 0..h)
      return [
        { x: 0, y: shaftTop },
        { x: shaftW, y: shaftTop },
        { x: shaftW, y: 0 },
        { x: w, y: h / 2 },
        { x: shaftW, y: h },
        { x: shaftW, y: shaftBot },
        { x: 0, y: shaftBot },
      ];
    };

    const buildLineArrowPath = (w: number, h: number, headLenPx: number) => {
      const headW = clampArrow(Number(headLenPx) || 0, 8, Math.max(8, w - 8));
      const x0 = 0;
      const x1 = w;
      const y = h / 2;
      const hx = x1 - headW;
      // Make the arrow fill the full bounding box height (0..h) so export/import is stable.
      // 3 segments: shaft, head top, head bottom
      return `M ${x0} ${y} L ${x1} ${y} M ${hx} 0 L ${x1} ${y} L ${hx} ${h}`;
    };

    const getArrowHeadLenPx = (asset: any) => {
      // Preferred: absolute head length in template pixels.
      const px = Number(asset?.arrowHeadSizePx);
      if (Number.isFinite(px) && px > 0) return px;
      // Back-compat: legacy % (older templates).
      const pct = Number(asset?.arrowHeadSizePct);
      if (Number.isFinite(pct) && pct > 0) {
        const w = Math.max(1, Number(asset?.rect?.width) || 1);
        return (w * pct) / 100;
      }
      const w = Math.max(1, Number(asset?.rect?.width) || 1);
      return w * 0.35;
    };

    const getSlide0 = (d: CarouselTemplateDefinitionV1) =>
      d.slides?.find((s) => s.slideIndex === 0) || d.slides?.[0] || defaultSlide0();

    const getImageAssetById = (layerId: string) => {
      const def = defRef.current;
      const slide0: any = getSlide0(def);
      const assets = Array.isArray(slide0.assets) ? (slide0.assets as any[]) : [];
      const idx = assets.findIndex((a) => a && String(a.id) === String(layerId) && a.type === 'image');
      if (idx === -1) return null;
      return { slide0, assets, idx, asset: assets[idx] as TemplateImageAsset };
    };

    const getShapeAssetById = (layerId: string) => {
      const def = defRef.current;
      const slide0: any = getSlide0(def);
      const assets = Array.isArray(slide0.assets) ? (slide0.assets as any[]) : [];
      const idx = assets.findIndex((a) => a && String(a.id) === String(layerId) && a.type === 'shape');
      if (idx === -1) return null;
      return { slide0, assets, idx, asset: assets[idx] as TemplateShapeAsset };
    };

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    // Compute a "cover" crop rect in SOURCE pixel space, matched to the container aspect ratio.
    const computeCoverCropRect = (iw: number, ih: number, containerW: number, containerH: number) => {
      const ar = containerW / Math.max(1, containerH);
      const srcAr = iw / Math.max(1, ih);
      // Crop rect in source pixels.
      let cw: number;
      let ch: number;
      if (srcAr > ar) {
        // source is wider → use full height, crop width
        ch = ih;
        cw = ih * ar;
      } else {
        // source is taller/narrower → use full width, crop height
        cw = iw;
        ch = iw / ar;
      }
      cw = Math.max(1, Math.min(iw, cw));
      ch = Math.max(1, Math.min(ih, ch));
      return { cw, ch };
    };

    // Apply crop fields (scale + offsets in TEMPLATE PIXELS) to a fabric.Image using cropX/cropY.
    // This keeps the object's rendered bounding box fixed to containerW×containerH, preventing "jumping"
    // and keeping selection handles stable.
    const applyCircleMaskCropToImage = (
      fabric: any,
      imgObj: any,
      imgEl: HTMLImageElement,
      containerW: number,
      containerH: number,
      crop?: { scale: number; offsetX: number; offsetY: number }
    ) => {
      const iw = Math.max(1, imgEl.naturalWidth || imgEl.width || 1);
      const ih = Math.max(1, imgEl.naturalHeight || imgEl.height || 1);
      const { cw: coverW, ch: coverH } = computeCoverCropRect(iw, ih, containerW, containerH);

      const mult = clamp(Number(crop?.scale ?? 1) || 1, 1, 4);
      const cw = clamp(coverW / mult, 1, iw);
      const ch = clamp(coverH / mult, 1, ih);

      // Convert template-pixel offsets to source-pixel offsets (relative to crop rect size).
      const offXPx = Number(crop?.offsetX ?? 0) || 0;
      const offYPx = Number(crop?.offsetY ?? 0) || 0;
      const shiftXSrc = offXPx * (cw / Math.max(1, containerW));
      const shiftYSrc = offYPx * (ch / Math.max(1, containerH));

      const centerX = iw / 2;
      const centerY = ih / 2;
      const minCropX = 0;
      const minCropY = 0;
      const maxCropX = Math.max(0, iw - cw);
      const maxCropY = Math.max(0, ih - ch);
      const cropX = clamp(centerX - cw / 2 + shiftXSrc, minCropX, maxCropX);
      const cropY = clamp(centerY - ch / 2 + shiftYSrc, minCropY, maxCropY);

      // Scale so the cropped region fills the container exactly.
      const scale = containerW / Math.max(1, cw);

      // ClipPath must be specified in object coords (pre-scale) so it appears as a circle in canvas pixels.
      const outputR = Math.max(1, Math.floor(Math.min(containerW, containerH) / 2));
      const rObj = outputR / Math.max(1e-6, scale);

      try {
        imgObj.set?.({
          width: cw,
          height: ch,
          cropX,
          cropY,
          scaleX: scale,
          scaleY: scale,
        });
        const clip = new fabric.Circle({
          radius: rObj,
          originX: 'center',
          originY: 'center',
          left: 0,
          top: 0,
          fill: '#000000',
          selectable: false,
          evented: false,
        });
        (imgObj as any).clipPath = clip;
        imgObj.setCoords?.();
      } catch {
        // ignore
      }
    };

    const createMaskedImageObject = (fabric: any, imgEl: HTMLImageElement, asset: TemplateImageAsset) => {
      const w = Math.max(1, asset.rect.width);
      const h = Math.max(1, asset.rect.height);
      const imgObj = new fabric.Image(imgEl, {
        left: asset.rect.x,
        top: asset.rect.y,
        originX: 'left',
        originY: 'top',
        selectable: true,
        evented: true,
      });
      disableRotation(imgObj);
      applyCircleMaskCropToImage(fabric, imgObj, imgEl, w, h, (asset as any).crop);
      return imgObj;
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

    // Arrow shapes must export rect without stroke to avoid compounding growth on repeated exports.
    const arrowRectFromObj = (obj: any): TemplateRect => {
      const sx = Number(obj?.scaleX ?? 1) || 1;
      const sy = Number(obj?.scaleY ?? 1) || 1;
      const width = (Number(obj?.width ?? 0) || 0) * sx;
      const height = (Number(obj?.height ?? 0) || 0) * sy;
      return {
        x: obj?.left || 0,
        y: obj?.top || 0,
        width,
        height,
      };
    };

    // ContentRegion is a dashed/stroked rect. Fabric's getScaledWidth/Height can include stroke,
    // which would cause the exported template contentRegion to "grow" a few px on every export.
    // We must export the logical interior size (width/height * scale), excluding stroke.
    const contentRegionRectFromObj = (obj: any): TemplateRect => {
      const sx = Number(obj?.scaleX ?? 1) || 1;
      const sy = Number(obj?.scaleY ?? 1) || 1;
      const width = (Number(obj?.width ?? 0) || 0) * sx;
      const height = (Number(obj?.height ?? 0) || 0) * sy;
      return {
        x: obj?.left || 0,
        y: obj?.top || 0,
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
        slide0.contentRegion = contentRegionRectFromObj(regionObj);
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
        const objShape = String(obj?.data?.shape || '');
        const rect =
          objShape === 'arrow_solid' || objShape === 'arrow_line'
            ? arrowRectFromObj(obj)
            : rectFromObj(obj);

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
          const shape = String(a.shape || '');
          const sx = Math.abs(Number(obj.scaleX ?? 1) || 1);
          const sy = Math.abs(Number(obj.scaleY ?? 1) || 1);
          const strokeScale = (sx + sy) / 2;
          const baseStrokeWidth = Number.isFinite(Number(obj.strokeWidth))
            ? Number(obj.strokeWidth)
            : Number(a.style?.strokeWidth || 0);

          const style: TemplateShapeStyle = {
            fill: String(obj.fill || a.style?.fill || '#111827'),
            stroke: String(obj.stroke || a.style?.stroke || '#111827'),
            // Phase 3 (arrows): bake stroke scaling into persisted strokeWidth so it matches after re-render.
            // Rectangles keep the historical behavior (strokeWidth is not scaled on resize).
            strokeWidth: shape === 'rect' ? baseStrokeWidth : Math.max(0, baseStrokeWidth * strokeScale),
          };
          // Only rectangles have corner radius.
          if (shape === 'rect') {
            const rx = Number(obj.rx ?? obj.ry ?? a.cornerRadius ?? 0);
            const cornerRadius = Number.isFinite(rx) ? Math.max(0, Math.round(rx)) : 0;
            return { ...a, rect, style, cornerRadius };
          }
          // Arrow shapes: preserve arrowhead size metadata.
          return {
            ...a,
            rect,
            style,
            arrowHeadSizePx: (a as any).arrowHeadSizePx,
            arrowHeadSizePct: (a as any).arrowHeadSizePct,
          };
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
          if (a?.shape === 'rect') return 'Rectangle';
          if (String(a?.shape || '').startsWith('arrow')) return 'Arrow';
          return 'Shape';
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

    const addArrowSolidLayerToDef = () => {
      pushHistory();
      const def = exportFromCanvas();
      const slide0 = def.slides?.find((s) => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
      if (!def.slides || def.slides.length === 0) def.slides = [slide0];
      const assets = Array.isArray(slide0.assets) ? slide0.assets : [];
      const nextZ = assets.reduce((m: number, a: any) => Math.max(m, typeof a?.zIndex === 'number' ? a.zIndex : -1), -1) + 1;
      const id = crypto.randomUUID();
      const count = assets.filter((a: any) => a?.type === 'shape' && String(a?.shape || '').startsWith('arrow')).length + 1;
      const initialW = 320;
      const s: TemplateShapeAsset = {
        id,
        type: 'shape',
        shape: 'arrow_solid' as any,
        kind: 'shape_arrow_solid' as any,
        name: `Arrow (solid) ${count}`,
        rect: { x: 140, y: 320, width: initialW, height: 140 },
        style: { fill: '#111827', stroke: '#111827', strokeWidth: 0 },
        arrowHeadSizePx: initialW * 0.35,
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

    const addArrowLineLayerToDef = () => {
      pushHistory();
      const def = exportFromCanvas();
      const slide0 = def.slides?.find((s) => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
      if (!def.slides || def.slides.length === 0) def.slides = [slide0];
      const assets = Array.isArray(slide0.assets) ? slide0.assets : [];
      const nextZ = assets.reduce((m: number, a: any) => Math.max(m, typeof a?.zIndex === 'number' ? a.zIndex : -1), -1) + 1;
      const id = crypto.randomUUID();
      const count = assets.filter((a: any) => a?.type === 'shape' && String(a?.shape || '').startsWith('arrow')).length + 1;
      const initialW = 320;
      const s: TemplateShapeAsset = {
        id,
        type: 'shape',
        shape: 'arrow_line' as any,
        kind: 'shape_arrow_line' as any,
        name: `Arrow (line) ${count}`,
        rect: { x: 140, y: 480, width: initialW, height: 140 },
        style: { fill: '#111827', stroke: '#111827', strokeWidth: 10 },
        arrowHeadSizePx: initialW * 0.35,
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
      const shape = ((): 'rect' | 'arrow_solid' | 'arrow_line' | 'unknown' => {
        const s = String(obj?.data?.shape || '');
        if (s === 'rect') return 'rect';
        if (s === 'arrow_solid') return 'arrow_solid';
        if (s === 'arrow_line') return 'arrow_line';
        return 'unknown';
      })();
      if (shape === 'unknown') return null;

      const shapeAsset = getShapeAssetById(layerId);
      const arrowHeadSizePx =
        shape !== 'rect' ? getArrowHeadLenPx(shapeAsset?.asset) : undefined;

      return {
        shape,
        cornerRadius: shape === 'rect' ? Math.max(0, Math.round(Number(obj.rx ?? obj.ry ?? 0) || 0)) : 0,
        fill: String(obj.fill || '#111827'),
        stroke: String(obj.stroke || '#111827'),
        strokeWidth: Math.max(0, Math.round(Number(obj.strokeWidth ?? 0) || 0)),
        ...(shape !== 'rect' ? { arrowHeadSizePx } : {}),
      };
    };

    const setShapeStyleForLayer = (
      layerId: string,
      patch: Partial<{ cornerRadius: number; fill: string; stroke: string; strokeWidth: number; arrowHeadSizePx: number }>
    ) => {
      if (!layerId || layerId === contentRegionLayerId) return;
      const obj = assetObjByIdRef.current.get(layerId);
      const canvas = fabricCanvasRef.current;
      if (!obj || !canvas) return;
      const shape = String(obj?.data?.shape || '');

      // Rectangles: keep the existing direct manipulation behavior.
      if (shape === 'rect' && obj.type === 'rect') {
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
        return;
      }

      // Arrows: update the persisted asset (including arrowHeadSizePct) and re-render for correct geometry.
      if (shape === 'arrow_solid' || shape === 'arrow_line') {
        pushHistory();
        try {
          const def = clone(defRef.current);
          const slide0 = def.slides?.find((s) => s.slideIndex === 0) || def.slides?.[0] || defaultSlide0();
          if (!def.slides || def.slides.length === 0) def.slides = [slide0];
          const assets = Array.isArray(slide0.assets) ? (slide0.assets as any[]) : [];
          const idx = assets.findIndex((a: any) => a && String(a.id) === String(layerId) && a.type === 'shape');
          if (idx === -1) return;

          const cur = assets[idx] as any;
          const nextStyle: any = { ...(cur.style || {}) };
          if (typeof patch.fill === 'string') nextStyle.fill = patch.fill;
          if (typeof patch.stroke === 'string') nextStyle.stroke = patch.stroke;
          if (patch.strokeWidth !== undefined && Number.isFinite(Number(patch.strokeWidth))) {
            nextStyle.strokeWidth = Math.max(0, Number(patch.strokeWidth));
          }
          const w = Math.max(1, Number(cur?.rect?.width) || 1);
          const maxHeadPx = Math.max(8, w - 8);
          const nextArrowHeadSizePx =
            patch.arrowHeadSizePx !== undefined && Number.isFinite(Number(patch.arrowHeadSizePx))
              ? clamp(Number(patch.arrowHeadSizePx), 8, maxHeadPx)
              : (Number(cur.arrowHeadSizePx) || getArrowHeadLenPx(cur));

          // Prefer the absolute field going forward; keep legacy % only if already present and px wasn't set before.
          assets[idx] = {
            ...cur,
            style: nextStyle,
            arrowHeadSizePx: nextArrowHeadSizePx,
            ...(patch.arrowHeadSizePx !== undefined ? { arrowHeadSizePct: undefined } : null),
          };
          slide0.assets = assets as any;
          def.slides = [slide0];
          defRef.current = clone(def);
          renderFromDefinition(defRef.current);
          selectLayerOnCanvas(layerId);
        } catch {
          // ignore
        }
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
        // IMPORTANT: normalize scale so repeated re-renders don't compound prior user scaling.
        // ContentRegion should be fully described by {left,top,width,height} in template pixels.
        existing.set({
          left: r.x,
          top: r.y,
          width: r.width,
          height: r.height,
          scaleX: 1,
          scaleY: 1,
        });
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
              const wantCircle = String((img as any).maskShape || 'none') === 'circle';
              const obj = wantCircle
                ? createMaskedImageObject(fabric, imgEl, img)
                : new fabric.Image(imgEl, {
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
              const activeAccountId = (() => {
                try {
                  return typeof localStorage !== 'undefined' ? String(localStorage.getItem('editor.activeAccountId') || '').trim() : '';
                } catch {
                  return '';
                }
              })();
              const r = await fetch(url, {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  ...(activeAccountId ? { 'x-account-id': activeAccountId } : {}),
                },
              });
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
          const shape = String((s as any).shape || 'rect');
          if (shape === 'rect') {
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
            (obj as any).data = { role: 'template-asset', assetId: s.id, assetType: 'shape', assetKind: s.kind, shape };
            disableRotation(obj);
            canvas.add(obj);
            assetObjByIdRef.current.set(s.id, obj);
          } else if (shape === 'arrow_solid') {
            const w = Math.max(1, s.rect.width);
            const h = Math.max(1, s.rect.height);
            const headLenPx = getArrowHeadLenPx(s);
            const pts = buildSolidArrowPoints(w, h, headLenPx);
            const obj = new fabric.Polygon(pts, {
              left: s.rect.x,
              top: s.rect.y,
              originX: 'left',
              originY: 'top',
              fill: s.style?.fill || '#111827',
              stroke: s.style?.stroke || '#111827',
              strokeWidth: Number(s.style?.strokeWidth || 0),
              strokeLineJoin: 'round',
              selectable: true,
              evented: true,
            });
            (obj as any).data = { role: 'template-asset', assetId: s.id, assetType: 'shape', assetKind: s.kind, shape };
            disableRotation(obj);
            canvas.add(obj);
            assetObjByIdRef.current.set(s.id, obj);
          } else if (shape === 'arrow_line') {
            const w = Math.max(1, s.rect.width);
            const h = Math.max(1, s.rect.height);
            const headLenPx = getArrowHeadLenPx(s);
            const path = buildLineArrowPath(w, h, headLenPx);
            const obj = new fabric.Path(path, {
              left: s.rect.x,
              top: s.rect.y,
              originX: 'left',
              originY: 'top',
              fill: 'transparent',
              stroke: s.style?.stroke || '#111827',
              strokeWidth: Math.max(1, Number(s.style?.strokeWidth || 8)),
              strokeLineCap: 'round',
              strokeLineJoin: 'round',
              selectable: true,
              evented: true,
            });
            // Stroke scales with object transforms by default (strokeUniform=false).
            (obj as any).data = { role: 'template-asset', assetId: s.id, assetType: 'shape', assetKind: s.kind, shape };
            disableRotation(obj);
            canvas.add(obj);
            assetObjByIdRef.current.set(s.id, obj);
          }
        }
      }

      // Dev-only preview: show two arrows even before creation UI exists (Phase 2).
      if (shouldShowArrowDevPreview()) {
        try {
          const w = 240;
          const h = 120;
          const solid = new fabric.Polygon(buildSolidArrowPoints(w, h, 84), {
            left: 90,
            top: 1060,
            originX: 'left',
            originY: 'top',
            fill: '#111827',
            stroke: '#111827',
            strokeWidth: 0,
            selectable: true,
            evented: true,
          });
          const line = new fabric.Path(buildLineArrowPath(w, h, 84), {
            left: 360,
            top: 1060,
            originX: 'left',
            originY: 'top',
            fill: 'transparent',
            stroke: '#111827',
            strokeWidth: 10,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            selectable: true,
            evented: true,
          });
          disableRotation(solid);
          disableRotation(line);
          canvas.add(solid);
          canvas.add(line);
        } catch {
          // ignore
        }
      }

      // Track direct canvas edits (drag/resize/text edits) for undo.
      try {
        canvas.off?.('object:modified');
        canvas.off?.('text:changed');
        canvas.on?.('object:modified', (opt: any) => {
          scheduleHistoryPush();

          // Phase 3 (arrows): when resizing arrows, Fabric uses scaleX/scaleY transforms. If we persist
          // without normalizing, repeated saves/exports can compound stroke scaling. So after a resize,
          // we export (baking stroke scaling) and immediately re-render (resetting scale to 1).
          const t = opt?.target;
          const shape = String(t?.data?.shape || '');
          if (shape !== 'arrow_solid' && shape !== 'arrow_line') return;
          const sx = Math.abs(Number(t?.scaleX ?? 1) || 1);
          const sy = Math.abs(Number(t?.scaleY ?? 1) || 1);
          const needsBake = Math.abs(sx - 1) > 1e-3 || Math.abs(sy - 1) > 1e-3;
          if (!needsBake) return;

          const assetId = String(t?.data?.assetId || '');
          if (!assetId) return;
          try {
            const next = exportFromCanvas();
            defRef.current = clone(next);
            renderFromDefinition(defRef.current);
            selectLayerOnCanvas(assetId);
          } catch {
            // ignore
          }
        });
        canvas.on?.('text:changed', () => scheduleHistoryPush());
      } catch {
        // ignore
      }

      canvas.renderAll();
    };

    // Phase 4: crop mode interaction (pan/zoom inside circular mask).
    const cropModeRef = useRef<{
      layerId: string | null;
      dragging: boolean;
      lastPointer: { x: number; y: number } | null;
      prevCanvasState: null | {
        selection: boolean;
        skipTargetFind: boolean;
        defaultCursor?: string;
        hoverCursor?: string;
        moveCursor?: string;
      };
    }>({ layerId: null, dragging: false, lastPointer: null, prevCanvasState: null });

    // DOM-level crop interaction (reliable). This avoids relying on Fabric mouse events for drag.
    const cropDragRef = useRef<{ dragging: boolean; lastClientX: number; lastClientY: number } | null>(null);

    const setCropModeLocks = (obj: any, enabled: boolean) => {
      try {
        obj.lockMovementX = !!enabled;
        obj.lockMovementY = !!enabled;
        obj.hasControls = !enabled;
        if (typeof obj.setControlsVisibility === 'function') {
          obj.setControlsVisibility({ mtr: false });
        }
      } catch {
        // ignore
      }
    };

    const getImageObjById = (layerId: string) => {
      const obj = assetObjByIdRef.current.get(layerId);
      if (!obj) return null;
      if (obj.type === 'image') return obj;
      return null;
    };

    const applyCropToActiveLayer = () => {
      const layerId = cropModeRef.current.layerId;
      if (!layerId) return;
      const imgObj = getImageObjById(layerId);
      if (!imgObj) return;

      // Container size is the asset rect size (selection box stays fixed).
      const w = Math.max(1, Number(imgObj.getScaledWidth?.() || 0) || Number(imgObj.width || 1) * Number(imgObj.scaleX || 1));
      const h = Math.max(1, Number(imgObj.getScaledHeight?.() || 0) || Number(imgObj.height || 1) * Number(imgObj.scaleY || 1));

      const info = getImageAssetById(layerId);
      if (!info) return;
      const crop = (info.asset as any)?.crop;
      // imgObj uses cropX/cropY; need the underlying element to compute source dims.
      const el = imgObj.getElement?.() as HTMLImageElement | undefined;
      if (!el) return;
      applyCircleMaskCropToImage(fabricRef.current, imgObj, el, w, h, crop);
      try {
        fabricCanvasRef.current?.requestRenderAll?.();
      } catch {
        // ignore
      }
    };

    const setCropForLayer = (layerId: string, nextCrop: { scale: number; offsetX: number; offsetY: number }) => {
      const info = getImageAssetById(layerId);
      if (!info) return;
      // Update the definition snapshot used for export/save.
      info.assets[info.idx] = { ...(info.assets[info.idx] as any), crop: nextCrop };
      (info.slide0 as any).assets = info.assets as any;
      (defRef.current as any).slides = [info.slide0];
      applyCropToActiveLayer();
    };

    const onCropWheel = (opt: any) => {
      const layerId = cropModeRef.current.layerId;
      if (!layerId) return;
      const e = opt?.e;
      if (!e) return;
      e.preventDefault?.();
      e.stopPropagation?.();

      const info = getImageAssetById(layerId);
      if (!info) return;
      const cur = (info.asset as any)?.crop || { scale: 1, offsetX: 0, offsetY: 0 };
      const deltaY = Number(e.deltaY || 0);
      const factor = deltaY > 0 ? 0.92 : 1.08; // zoom out / in
      const nextScale = Math.max(1, Math.min(4, (Number(cur.scale || 1) || 1) * factor));
      setCropForLayer(layerId, { scale: nextScale, offsetX: Number(cur.offsetX || 0) || 0, offsetY: Number(cur.offsetY || 0) || 0 });
    };

    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      try {
        canvas.off?.('mouse:wheel', onCropWheel);

        canvas.on?.('mouse:wheel', onCropWheel);
      } catch {
        // ignore
      }
      return () => {
        try {
          canvas.off?.('mouse:wheel', onCropWheel);
        } catch {
          // ignore
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

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
      addArrowSolidLayer: () => addArrowSolidLayerToDef(),
      addArrowLineLayer: () => addArrowLineLayerToDef(),
      renameLayer: (layerId: string, nextName: string) => renameLayerInDef(layerId, nextName),
      deleteLayer: (layerId: string) => deleteLayerInDef(layerId),
      undo: () => undoFromHistory(),
      getActiveLayerId: () => getActiveLayerIdFromCanvas(),
      getTextLayerStyle: (layerId: string) => getTextStyleForLayer(layerId),
      setTextLayerStyle: (layerId: string, patch: any) => setTextStyleForLayer(layerId, patch),
      getShapeLayerStyle: (layerId: string) => getShapeStyleForLayer(layerId),
      setShapeLayerStyle: (layerId: string, patch: any) => setShapeStyleForLayer(layerId, patch),
      startTextEditing: (layerId: string) => startEditingTextLayer(layerId),
      startImageCropMode: (layerId: string) => {
        const info = getImageAssetById(layerId);
        if (!info) return;
        const mask = String((info.asset as any)?.maskShape || 'none');
        if (mask !== 'circle') return;

        cropModeRef.current.layerId = String(layerId);
        cropModeRef.current.dragging = false;
        cropModeRef.current.lastPointer = null;
        setCropModeLayerId(String(layerId));

        // Put the Fabric canvas into an "interaction capture" mode so panning feels seamless.
        // We pan on drag anywhere (not just when clicking the image), and we don't want Fabric to
        // start selection/move transforms in the background.
        try {
          const canvas = fabricCanvasRef.current;
          if (canvas) {
            cropModeRef.current.prevCanvasState = {
              selection: !!canvas.selection,
              skipTargetFind: !!canvas.skipTargetFind,
              defaultCursor: canvas.defaultCursor,
              hoverCursor: canvas.hoverCursor,
              moveCursor: canvas.moveCursor,
            };
            canvas.discardActiveObject?.();
            canvas.selection = false;
            canvas.skipTargetFind = true;
            canvas.defaultCursor = 'grab';
            canvas.hoverCursor = 'grab';
            canvas.moveCursor = 'grab';
            canvas.requestRenderAll?.();
          }
        } catch {
          // ignore
        }

        // Ensure crop defaults exist.
        const cur = (info.asset as any)?.crop || { scale: 1, offsetX: 0, offsetY: 0 };
        setCropForLayer(String(layerId), {
          scale: Math.max(1, Math.min(4, Number(cur.scale || 1) || 1)),
          offsetX: Number(cur.offsetX || 0) || 0,
          offsetY: Number(cur.offsetY || 0) || 0,
        });

        // Lock the image object so transforms don't fight crop panning.
        const imgObj = getImageObjById(String(layerId));
        if (imgObj) {
          setCropModeLocks(imgObj, true);
        }
      },
      finishImageCropMode: () => {
        const layerId = cropModeRef.current.layerId;
        cropModeRef.current.layerId = null;
        cropModeRef.current.dragging = false;
        cropModeRef.current.lastPointer = null;
        setCropModeLayerId(null);
        cropDragRef.current = null;
        if (!layerId) return;
        const imgObj = getImageObjById(String(layerId));
        if (imgObj) {
          setCropModeLocks(imgObj, false);
          try {
            imgObj.setCoords?.();
            fabricCanvasRef.current?.requestRenderAll?.();
          } catch {
            // ignore
          }
        }

        // Restore Fabric canvas interaction state.
        try {
          const canvas = fabricCanvasRef.current;
          const prev = cropModeRef.current.prevCanvasState;
          cropModeRef.current.prevCanvasState = null;
          if (canvas && prev) {
            canvas.selection = prev.selection;
            canvas.skipTargetFind = prev.skipTargetFind;
            if (prev.defaultCursor !== undefined) canvas.defaultCursor = prev.defaultCursor;
            if (prev.hoverCursor !== undefined) canvas.hoverCursor = prev.hoverCursor;
            if (prev.moveCursor !== undefined) canvas.moveCursor = prev.moveCursor;
            canvas.requestRenderAll?.();
          }
        } catch {
          // ignore
        }
      },
      resetImageCrop: (layerId: string) => {
        const info = getImageAssetById(layerId);
        if (!info) return;
        const mask = String((info.asset as any)?.maskShape || 'none');
        if (mask !== 'circle') return;
        setCropForLayer(String(layerId), { scale: 1, offsetX: 0, offsetY: 0 });
      },
      getActiveImageCropLayerId: () => cropModeRef.current.layerId,
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
            position: 'relative',
          }}
        >
          <canvas ref={canvasElRef} width={1080} height={1440} style={{ display: 'block' }} />
          {cropModeLayerId ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                cursor: cropDragging ? 'grabbing' : 'grab',
              }}
              onPointerDown={(e) => {
                if (!cropModeLayerId) return;
                cropDragRef.current = { dragging: true, lastClientX: e.clientX, lastClientY: e.clientY };
                setCropDragging(true);
                try {
                  (e.currentTarget as any)?.setPointerCapture?.(e.pointerId);
                } catch {
                  // ignore
                }
                e.preventDefault();
              }}
              onPointerMove={(e) => {
                if (!cropModeLayerId) return;
                const st = cropDragRef.current;
                if (!st?.dragging) return;
                const dxCss = e.clientX - st.lastClientX;
                const dyCss = e.clientY - st.lastClientY;
                st.lastClientX = e.clientX;
                st.lastClientY = e.clientY;
                // Convert CSS pixels to template-canvas pixels (1080×1440) using Fabric zoom.
                const dx = dxCss / DISPLAY_ZOOM;
                const dy = dyCss / DISPLAY_ZOOM;
                const info = getImageAssetById(cropModeLayerId);
                if (!info) return;
                const cur = (info.asset as any)?.crop || { scale: 1, offsetX: 0, offsetY: 0 };
                setCropForLayer(cropModeLayerId, {
                  scale: Number(cur.scale || 1) || 1,
                  offsetX: (Number(cur.offsetX || 0) || 0) + dx,
                  offsetY: (Number(cur.offsetY || 0) || 0) + dy,
                });
                e.preventDefault();
              }}
              onPointerUp={(e) => {
                if (cropDragRef.current) cropDragRef.current.dragging = false;
                setCropDragging(false);
                try {
                  (e.currentTarget as any)?.releasePointerCapture?.(e.pointerId);
                } catch {
                  // ignore
                }
                e.preventDefault();
              }}
              onPointerCancel={() => {
                if (cropDragRef.current) cropDragRef.current.dragging = false;
                setCropDragging(false);
              }}
              onWheel={(e) => {
                if (!cropModeLayerId) return;
                e.preventDefault();
                const info = getImageAssetById(cropModeLayerId);
                if (!info) return;
                const cur = (info.asset as any)?.crop || { scale: 1, offsetX: 0, offsetY: 0 };
                const factor = e.deltaY > 0 ? 0.92 : 1.08;
                const nextScale = Math.max(1, Math.min(4, (Number(cur.scale || 1) || 1) * factor));
                setCropForLayer(cropModeLayerId, {
                  scale: nextScale,
                  offsetX: Number(cur.offsetX || 0) || 0,
                  offsetY: Number(cur.offsetY || 0) || 0,
                });
              }}
            />
          ) : null}
          {cropModeLayerId ? (
            <div
              style={{
                position: 'absolute',
                left: 10,
                top: 10,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(17, 24, 39, 0.85)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Crop mode
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
);


