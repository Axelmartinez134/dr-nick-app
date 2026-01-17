'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { VisionLayoutDecision } from '@/lib/carousel-types';
import type { CarouselTemplateDefinitionV1, TemplateAsset, TemplateImageAsset, TemplateTextAsset, TemplateRect } from '@/lib/carousel-template-types';
import { supabase } from '../../../auth/AuthContext';
import { ensureTypographyFontsLoaded } from './fontMetrics';
import {
  rectsOverlapAABB,
  aabbIntersectsMask,
  findNearestValidTopLeft as findNearestValidTopLeftPure,
  enforceTextInvariantsSequential,
} from '@/lib/text-placement';

interface CarouselPreviewProps {
  layout: VisionLayoutDecision;
  backgroundColor: string;
  textColor: string;
  templateSnapshot?: CarouselTemplateDefinitionV1 | null;
  // Optional: template ID (for debug overlays/logging).
  templateId?: string | null;
  // Which slide within the templateSnapshot this canvas represents (0-based).
  // Used for debug overlays + contentRegion clamping.
  slideIndex?: number;
  hasHeadline?: boolean; // if false, treat ALL lines as body lines (used for /editor Regular)
  // When true, shrink each user text object's width to hug the rendered text (plus small padding),
  // instead of filling the full lane width. Intended for /editor Enhanced so selection boxes aren't huge.
  tightUserTextWidth?: boolean;
  // Optional debug hook used by /editor to surface Fabric sizing details in the Debug panel.
  onDebugLog?: (message: string) => void;
  // Optional debug overlays (content rect + image bounds + mask overlay).
  // Intended for /editor to help visualize wrap boundaries.
  showLayoutOverlays?: boolean;
  headlineFontFamily?: string;
  bodyFontFamily?: string;
  headlineFontWeight?: number;
  bodyFontWeight?: number;
  // Optional render/interaction tuning (used by /editor for template-type specific behavior).
  // Defaults preserve existing behavior.
  contentPaddingPx?: number; // default 40
  clampUserTextToContentRect?: boolean; // default true
  clampUserImageToContentRect?: boolean; // default true
  pushTextOutOfUserImage?: boolean; // default true
  // /editor Enhanced: when true, do NOT auto-move text lines during invariant enforcement.
  // The editor will show a warning and let the user press "Realign" explicitly.
  lockTextLayout?: boolean;
  // /editor Enhanced: when true, while the user is dragging the user-image, do not run
  // post-render invariant enforcement that auto-moves text lines. Intended for "auto realign on release".
  suppressTextInvariantsWhileDraggingUserImage?: boolean;
  onUserTextChange?: (change: {
    canvasSlideIndex?: number;
    lineIndex: number;
    lineKey?: string;
    x: number;
    y: number;
    maxWidth: number;
    text?: string;
  }) => void;
  onUserImageChange?: (change: {
    canvasSlideIndex?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    angle?: number;
  }) => void;
  // Display sizing (CSS pixels). The canvas internal resolution remains 1080×1440.
  // Avoid using parent CSS transforms for scaling; they break Fabric hit-testing.
  displayWidthPx?: number;  // default 540
  displayHeightPx?: number; // default 720
}

const INTERNAL_W = 1080;
const INTERNAL_H = 1440;

const CarouselPreviewVision = forwardRef<any, CarouselPreviewProps>(
  (
    {
      layout,
      backgroundColor,
      textColor,
      templateSnapshot,
      templateId,
      slideIndex,
      hasHeadline,
      headlineFontFamily,
      bodyFontFamily,
      headlineFontWeight,
      bodyFontWeight,
      contentPaddingPx,
      clampUserTextToContentRect,
      clampUserImageToContentRect,
      pushTextOutOfUserImage,
      lockTextLayout,
      suppressTextInvariantsWhileDraggingUserImage,
      tightUserTextWidth,
      onDebugLog,
      showLayoutOverlays,
      onUserTextChange,
      onUserImageChange,
      displayWidthPx,
      displayHeightPx,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<any>(null);
    const fabricModuleRef = useRef<any>(null);
    const [fabricLoaded, setFabricLoaded] = useState(false);
    const constraintsRef = useRef<{
      contentRectRaw: null | { x: number; y: number; width: number; height: number };
      allowedRect: null | { x: number; y: number; width: number; height: number };
    }>({ contentRectRaw: null, allowedRect: null });
    const interactionRef = useRef<{ clampText: boolean; clampImage: boolean; pushTextOut: boolean }>({ clampText: true, clampImage: true, pushTextOut: true });
    const onUserTextChangeRef = useRef<CarouselPreviewProps["onUserTextChange"]>(undefined);
    const onUserImageChangeRef = useRef<CarouselPreviewProps["onUserImageChange"]>(undefined);
    // When the user moves a single line, we should NOT auto-move other lines (editor-like behavior).
    // IMPORTANT: This must NOT be time-based because renders are async (font/image loads) and may exceed any small window.
    // Instead, treat it as a one-shot "next render only" restriction and clear after enforcement runs.
    const restrictEnforcementToTextIdRef = useRef<string | null>(null);
    // Option #1 (editor-like): after a user moves/resizes a single text line, do NOT run the
    // global post-render invariant enforcement (which can move other lines). We rely on the
    // per-line auto-fix in `object:modified` for the moved line.
    const skipNextGlobalInvariantEnforcementRef = useRef<boolean>(false);
    // Multi-select move persistence:
    // When Fabric moves an `activeSelection`, child objects' coordinates can be selection-relative.
    // Persist by capturing absolute start positions and applying the selection dx/dy on release.
    const selectionDragRef = useRef<null | {
      active: boolean;
      selectionStartTopLeft: { x: number; y: number };
      itemsById: Map<string, { topLeft: { x: number; y: number }; originOffset: { x: number; y: number } }>;
    }>(null);
    const showLayoutOverlaysRef = useRef<boolean>(false);
    const draggingUserImageRef = useRef<boolean>(false);
    const lastOverlayDebugRef = useRef<boolean | null>(null);
    const overlayDataRef = useRef<{
      enabled: boolean;
      contentRect: null | { x: number; y: number; width: number; height: number };
      allowedRect: null | { x: number; y: number; width: number; height: number };
      imageRect: null | { x: number; y: number; width: number; height: number };
      maskCanvas: HTMLCanvasElement | null;
      maskU8: Uint8Array | null;
      maskW: number;
      maskH: number;
    }>({ enabled: false, contentRect: null, allowedRect: null, imageRect: null, maskCanvas: null, maskU8: null, maskW: 0, maskH: 0 });
    const invalidCheckRef = useRef<{ raf: number | null; obj: any | null }>({ raf: null, obj: null });

    const PAD = Number.isFinite(contentPaddingPx as any) ? Math.max(0, Math.round(contentPaddingPx as any)) : 40;
    const clampText = clampUserTextToContentRect !== false;
    const clampImage = clampUserImageToContentRect !== false;
    const pushTextOut = pushTextOutOfUserImage !== false;
    const canvasSlideIndex =
      Number.isInteger(slideIndex as any) ? Math.max(0, Number(slideIndex as any)) : 0;

    const displayW = Math.max(1, Math.round(Number(displayWidthPx ?? 540)));
    const displayH = Math.max(1, Math.round(Number(displayHeightPx ?? 720)));
    const computeDisplayZoom = () => {
      // Prefer width ratio; keep aspect stable (3:4).
      const zx = displayW / INTERNAL_W;
      const zy = displayH / INTERNAL_H;
      const z = Number.isFinite(zx) && Number.isFinite(zy) ? Math.min(zx, zy) : 0.5;
      // Guardrails
      return Math.max(0.05, Math.min(4, z));
    };

    // Debug hook: confirm wiring regardless of Fabric lifecycle.
    useEffect(() => {
      if (onDebugLog && tightUserTextWidth && hasHeadline !== false) {
        try {
          onDebugLog('🧪 TightText debug hook active (pre-fabric)');
        } catch {
          // ignore
        }
      }
    }, [onDebugLog, tightUserTextWidth, hasHeadline]);

    useEffect(() => {
      interactionRef.current = { clampText, clampImage, pushTextOut };
    }, [clampText, clampImage, pushTextOut]);
    useEffect(() => {
      onUserTextChangeRef.current = onUserTextChange;
    }, [onUserTextChange]);
    useEffect(() => {
      onUserImageChangeRef.current = onUserImageChange;
    }, [onUserImageChange]);
    useEffect(() => {
      showLayoutOverlaysRef.current = !!showLayoutOverlays;
    }, [showLayoutOverlays]);

    const computeContentRectRaw = (tpl: CarouselTemplateDefinitionV1 | null | undefined) => {
      if (!tpl?.slides?.length) return null;
      const targetIdx = Number.isInteger(slideIndex as any) ? (slideIndex as number) : 0;
      const slide = tpl.slides.find(s => s.slideIndex === targetIdx) || tpl.slides[targetIdx] || tpl.slides[0];
      const r = slide?.contentRegion as TemplateRect | undefined;
      if (!r) return null;
      return {
        x: r.x,
        y: r.y,
        width: Math.max(1, r.width),
        height: Math.max(1, r.height),
      };
    };

    const computeAllowedRect = (tpl: CarouselTemplateDefinitionV1 | null | undefined) => {
      const raw = computeContentRectRaw(tpl);
      if (!raw) return null;
      return {
        x: raw.x + PAD,
        y: raw.y + PAD,
        width: Math.max(1, raw.width - (PAD * 2)),
        height: Math.max(1, raw.height - (PAD * 2)),
      };
    };

    const decodeB64ToU8Browser = (b64: string): Uint8Array | null => {
      const s = String(b64 || '');
      if (!s) return null;
      try {
        // Browser
        // eslint-disable-next-line no-undef
        const bin = atob(s);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      } catch {
        return null;
      }
    };

    const buildMaskCanvas = (mask: any): HTMLCanvasElement | null => {
      try {
        const w = Math.max(1, Math.floor(Number(mask?.w) || 0));
        const h = Math.max(1, Math.floor(Number(mask?.h) || 0));
        const dataB64 = String(mask?.dataB64 || '');
        if (!w || !h || !dataB64) return null;
        const u8 = decodeB64ToU8Browser(dataB64);
        if (!u8 || u8.length < (w * h)) return null;

        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const ctx = off.getContext('2d');
        if (!ctx) return null;
        const img = ctx.createImageData(w, h);
        for (let i = 0; i < w * h; i++) {
          const solid = u8[i] > 0;
          const p = i * 4;
          if (solid) {
            img.data[p + 0] = 255;
            img.data[p + 1] = 0;
            img.data[p + 2] = 0;
            img.data[p + 3] = 110;
          } else {
            img.data[p + 3] = 0;
          }
        }
        ctx.putImageData(img, 0, 0);
        return off;
      } catch {
        return null;
      }
    };

    const getCurrentUserImageRect = (canvas: any): null | { x: number; y: number; width: number; height: number } => {
      try {
        const objs = canvas?.getObjects?.() || [];
        const img = objs.find((o: any) => o?.type === 'image' && o?.data?.role === 'user-image');
        if (!img) return null;
        const aabb = getAABBTopLeft(img);
        return { x: aabb.x, y: aabb.y, width: Math.max(1, aabb.width), height: Math.max(1, aabb.height) };
      } catch {
        return null;
      }
    };

    const getOtherUserTextAABBs = (canvas: any, self: any): Array<{ left: number; top: number; right: number; bottom: number }> => {
      try {
        const out: Array<{ left: number; top: number; right: number; bottom: number }> = [];
        const objs = canvas?.getObjects?.() || [];
        for (const o of objs) {
          if (!o || o === self) continue;
          if (o?.data?.role !== 'user-text') continue;
          // Skip actively edited lines; they should not be moved/blocked by auto-fix.
          if ((o as any).isEditing) continue;
          const a = getAABBTopLeft(o);
          const pad = 2; // small separation so lines don't visually collide
          out.push({
            left: a.x - pad,
            top: a.y - pad,
            right: a.x + a.width + pad,
            bottom: a.y + a.height + pad,
          });
        }
        return out;
      } catch {
        return [];
      }
    };

    const findNearestValidTopLeft = (
      canvas: any,
      obj: any,
      avoidAabbs?: Array<{ left: number; top: number; right: number; bottom: number }>
    ): null | { x: number; y: number } => {
      const allowed = constraintsRef.current.allowedRect;
      if (!allowed) return null;
      if (!obj) return null;

      const a = getAABBTopLeft(obj);
      const data = overlayDataRef.current;
      const imageRect = getCurrentUserImageRect(canvas) || data.imageRect;
      const maskU8 = data.maskU8;
      const maskW = data.maskW;
      const maskH = data.maskH;

      return findNearestValidTopLeftPure({
        curTopLeft: { x: a.x, y: a.y },
        boxSize: { w: Math.max(1, a.width), h: Math.max(1, a.height) },
        allowedRect: allowed,
        imageRect: imageRect,
        mask: (maskU8 && maskW > 0 && maskH > 0) ? { u8: maskU8, w: maskW, h: maskH } : null,
        avoidAabbs: avoidAabbs,
        stepPx: 4,
        maxRadiusPx: 640,
      });
    };

    const setInvalidHighlight = (obj: any, invalid: boolean) => {
      if (!obj || obj?.data?.role !== 'user-text') return;
      try {
        // Cache original styling once so we can restore it cleanly.
        if (!obj.data.__dnInvalidCache) {
          obj.data.__dnInvalidCache = {
            stroke: obj.stroke,
            strokeWidth: obj.strokeWidth,
            paintFirst: obj.paintFirst,
            backgroundColor: obj.backgroundColor,
            opacity: obj.opacity,
          };
        }
        const prev = !!obj.data.__dnInvalid;
        if (invalid) {
          obj.set?.('stroke', 'rgba(239,68,68,0.95)'); // red-500-ish
          obj.set?.('strokeWidth', 3);
          obj.set?.('paintFirst', 'stroke'); // keep fill readable
          // Make it unmistakable even when selected: tint the text box background + slightly reduce opacity.
          obj.set?.('backgroundColor', 'rgba(239,68,68,0.18)');
          obj.set?.('opacity', 0.9);
          obj.data.__dnInvalid = true;
        } else {
          const c = obj.data.__dnInvalidCache || {};
          obj.set?.('stroke', c.stroke ?? null);
          obj.set?.('strokeWidth', c.strokeWidth ?? 0);
          obj.set?.('paintFirst', c.paintFirst ?? 'fill');
          obj.set?.('backgroundColor', c.backgroundColor ?? null);
          obj.set?.('opacity', typeof c.opacity === 'number' ? c.opacity : 1);
          obj.data.__dnInvalid = false;
        }
        if (typeof obj.setCoords === 'function') obj.setCoords();

        // Low-noise debug log only when the invalid state flips.
        if (prev !== !!obj.data.__dnInvalid) {
          try {
            const lineIndex = Number(obj?.data?.lineIndex ?? 0);
            onDebugLog?.(`🚦 Drag validity: line ${lineIndex + 1} ${invalid ? 'INVALID (over silhouette)' : 'valid'}`);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    };

    const computeInvalidForUserText = (canvas: any, obj: any): boolean => {
      const data = overlayDataRef.current;
      try {
        if (typeof obj?.initDimensions === 'function') obj.initDimensions();
        if (typeof obj?.setCoords === 'function') obj.setCoords();
      } catch {
        // ignore
      }
      const a = getAABBTopLeft(obj);
      const aabb = { left: a.x, top: a.y, right: a.x + a.width, bottom: a.y + a.height };
      const maskU8 = data.maskU8;
      const maskW = data.maskW;
      const maskH = data.maskH;
      const imageRect = getCurrentUserImageRect(canvas) || data.imageRect;
      if (!imageRect) return false;
      // If we have a real mask, use it (silhouette-based).
      if (maskU8 && maskW > 0 && maskH > 0) {
        return aabbIntersectsMask(aabb, imageRect, maskU8, maskW, maskH);
      }
      // Fallback: rectangle overlap with image AABB.
      const imgAabb = { left: imageRect.x, top: imageRect.y, right: imageRect.x + imageRect.width, bottom: imageRect.y + imageRect.height };
      return rectsOverlapAABB(aabb, imgAabb);
    };

    const scheduleInvalidCheck = (canvas: any, obj: any) => {
      if (!canvas || !obj || obj?.data?.role !== 'user-text') return;
      invalidCheckRef.current.obj = obj;
      if (invalidCheckRef.current.raf != null) return;
      invalidCheckRef.current.raf = window.requestAnimationFrame(() => {
        invalidCheckRef.current.raf = null;
        const target = invalidCheckRef.current.obj;
        invalidCheckRef.current.obj = null;
        if (!target) return;
        const invalid = computeInvalidForUserText(canvas, target);
        setInvalidHighlight(target, invalid);
        canvas.requestRenderAll?.();
      });
    };

    const clearDebugOverlays = (canvas: any) => {
      try {
        const objs = canvas?.getObjects?.() || [];
        objs.forEach((o: any) => {
          if (o?.data?.role === 'debug-overlay') {
            try { canvas.remove(o); } catch { /* ignore */ }
          }
        });
      } catch {
        // ignore
      }
    };

    const updateOverlayData = () => {
      const enabled = !!showLayoutOverlays;
      const raw = constraintsRef.current.contentRectRaw;
      const allowed = constraintsRef.current.allowedRect;

      // Layout image bounds + mask are driven by wrap-engine output.
      const li = (layout as any)?.image || null;
      const hasMask = !!li?.mask;
      const hasUrl = !!String(li?.url || '');
      const imageRect =
        (hasMask || hasUrl) && li && Number.isFinite(li.x) && Number.isFinite(li.y) && Number.isFinite(li.width) && Number.isFinite(li.height)
          ? {
              x: Number(li.x) || 0,
              y: Number(li.y) || 0,
              width: Math.max(1, Number(li.width) || 1),
              height: Math.max(1, Number(li.height) || 1),
            }
          : null;

      const mask = li?.mask || null;
      const maskW = Math.max(0, Math.floor(Number(mask?.w) || 0));
      const maskH = Math.max(0, Math.floor(Number(mask?.h) || 0));
      const maskU8 = mask?.dataB64 ? decodeB64ToU8Browser(String(mask.dataB64)) : null;

      overlayDataRef.current = {
        enabled,
        contentRect: raw,
        allowedRect: allowed,
        imageRect,
        maskCanvas: hasMask ? buildMaskCanvas(li.mask) : null,
        maskU8: (maskU8 && maskW > 0 && maskH > 0 && maskU8.length >= maskW * maskH) ? maskU8 : null,
        maskW,
        maskH,
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
          width: INTERNAL_W,
          height: INTERNAL_H,
          backgroundColor,
        });

        // Set zoom for display (keep in sync with CSS sizing; no parent transforms)
        const z = computeDisplayZoom();
        canvas.setZoom(z);
        console.log('[Preview Vision] 🔍 Canvas zoom set to', z, 'for display');
        try {
          canvas.calcOffset?.();
        } catch {
          // ignore
        }

        fabricCanvasRef.current = canvas;
        setFabricLoaded(true);
        console.log('[Preview Vision] ✅ Canvas created and ready');

        // Debug overlays: draw in Fabric's top overlay layer so they can't be occluded by objects.
        const onAfterRender = () => {
          try {
            const data = overlayDataRef.current;
            const c = fabricCanvasRef.current;
            if (!c || !data?.enabled) {
              // Clear top overlay layer if disabled.
              const ctx = c?.contextTop;
              if (ctx) {
                const retina = typeof c.getRetinaScaling === 'function' ? (c.getRetinaScaling() || 1) : 1;
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, (c.getWidth?.() || 1080) * retina, (c.getHeight?.() || 1440) * retina);
                ctx.restore();
              }
              return;
            }
            const ctx = c.contextTop;
            if (!ctx) return;

            // Clear overlay layer
            const retina = typeof c.getRetinaScaling === 'function' ? (c.getRetinaScaling() || 1) : 1;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, (c.getWidth?.() || 1080) * retina, (c.getHeight?.() || 1440) * retina);
            ctx.restore();

            // Ensure transform matches viewportTransform (but avoid double-applying).
            const vpt = c.viewportTransform || [1, 0, 0, 1, 0, 0];
            const cur = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
            const want = {
              a: vpt[0] * retina,
              b: vpt[1] * retina,
              c: vpt[2] * retina,
              d: vpt[3] * retina,
              e: vpt[4] * retina,
              f: vpt[5] * retina,
            };
            const matches =
              !!cur &&
              Math.abs(cur.a - want.a) < 1e-6 &&
              Math.abs(cur.b - want.b) < 1e-6 &&
              Math.abs(cur.c - want.c) < 1e-6 &&
              Math.abs(cur.d - want.d) < 1e-6 &&
              Math.abs(cur.e - want.e) < 1e-3 &&
              Math.abs(cur.f - want.f) < 1e-3;
            if (!matches && typeof ctx.setTransform === 'function') {
              ctx.setTransform(want.a, want.b, want.c, want.d, want.e, want.f);
            }

            const drawRect = (
              r: { x: number; y: number; width: number; height: number },
              stroke: string,
              fill: string,
              dash: number[]
            ) => {
              ctx.save();
              ctx.setLineDash(dash);
              ctx.lineWidth = 4;
              ctx.strokeStyle = stroke;
              ctx.fillStyle = fill;
              ctx.beginPath();
              ctx.rect(r.x, r.y, r.width, r.height);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            };

            // Content region (outer) + allowed rect (inset)
            if (data.contentRect) {
              drawRect(data.contentRect, 'rgba(34,197,94,0.95)', 'rgba(34,197,94,0.08)', [6, 6]);
              ctx.save();
              ctx.fillStyle = 'rgba(34,197,94,0.95)';
              ctx.font = '700 22px Inter, sans-serif';
              ctx.fillText('CONTENT REGION', data.contentRect.x + 10, data.contentRect.y + 28);
              ctx.restore();
            }
            if (data.allowedRect) {
              drawRect(data.allowedRect, 'rgba(6,182,212,0.95)', 'rgba(6,182,212,0.10)', [8, 6]);
              ctx.save();
              ctx.fillStyle = 'rgba(6,182,212,0.95)';
              ctx.font = '700 22px Inter, sans-serif';
              ctx.fillText('ALLOWED (INSET)', data.allowedRect.x + 10, data.allowedRect.y + 28);
              ctx.restore();
            }

            // Image bounds + mask overlay
            if (data.imageRect) {
              ctx.save();
              ctx.setLineDash([6, 4]);
              ctx.lineWidth = 3;
              ctx.strokeStyle = 'rgba(217,70,239,0.95)';
              ctx.strokeRect(data.imageRect.x, data.imageRect.y, data.imageRect.width, data.imageRect.height);
              ctx.restore();
            }
            if (data.imageRect && data.maskCanvas) {
              ctx.save();
              ctx.globalAlpha = 0.55;
              ctx.drawImage(data.maskCanvas, data.imageRect.x, data.imageRect.y, data.imageRect.width, data.imageRect.height);
              ctx.restore();
            }
          } catch {
            // ignore
          }
        };
        canvas.on('after:render', onAfterRender);
        (canvas as any).__dnOverlayRender = { onAfterRender };

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
          if (!interactionRef.current.pushTextOut) return;
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

        // Track active text editing so we can avoid persisting geometry-only updates that would
        // immediately overwrite a just-committed text edit.
        const editStateRef: { active: boolean; lastExitAt: number } = { active: false, lastExitAt: 0 };

        const onObjectMoving = (e: any) => {
          const rect = constraintsRef.current.allowedRect;
          if (!rect) return;
          const obj = e?.target;
          const role = obj?.data?.role;
          const t = String(obj?.type || '').toLowerCase();
          const isSelection = t === 'activeselection' || t === 'group';
          if (!isSelection && role !== 'user-image' && role !== 'user-text') return;
          if (role === 'user-text') {
            // STRICT Lock Layout: do not auto-clamp or push text while locked.
            if (!lockTextLayout && interactionRef.current.clampText) clampObjectToRect(obj, rect);
            // Phase 2: allow overlap but mark invalid against silhouette (mask) while dragging.
            // Only use the legacy rectangle push-out when there is no mask available.
            const hasMask = !!overlayDataRef.current.maskU8;
            if (!lockTextLayout && interactionRef.current.clampText && !hasMask) pushTextOutOfImage(obj);
            if (!lockTextLayout) scheduleInvalidCheck(canvas, obj);
          } else if (isSelection) {
            // Capture multi-select drag start so we can persist via dx/dy on release.
            if (!selectionDragRef.current?.active) {
              try {
                const selAabb = getAABBTopLeft(obj);
                const children: any[] =
                  (typeof (obj as any)?.getObjects === 'function' ? (obj as any).getObjects() : null) ||
                  (Array.isArray((obj as any)?._objects) ? (obj as any)._objects : []) ||
                  [];
                const itemsById = new Map<string, { topLeft: { x: number; y: number }; originOffset: { x: number; y: number } }>();
                children.forEach((child: any, idx: number) => {
                  if (!child || child?.data?.role !== 'user-text') return;
                  const a = getAABBTopLeft(child);
                  const lk = typeof child?.data?.lineKey === 'string' ? child.data.lineKey : null;
                  const liRaw = child?.data?.lineIndex;
                  const li = Number.isFinite(liRaw as any) ? Number(liRaw) : null;
                  const id = lk && lk.length ? `LK:${lk}` : (li != null ? `IDX:${li}` : `FALLBACK:${idx}`);
                  itemsById.set(id, { topLeft: { x: a.x, y: a.y }, originOffset: { x: a.originOffsetX, y: a.originOffsetY } });
                });
                if (itemsById.size > 0) {
                  selectionDragRef.current = {
                    active: true,
                    selectionStartTopLeft: { x: selAabb.x, y: selAabb.y },
                    itemsById,
                  };
                }
              } catch {
                // ignore
              }
            }
          } else if (role === 'user-image') {
            if (suppressTextInvariantsWhileDraggingUserImage) draggingUserImageRef.current = true;
            if (!lockTextLayout && interactionRef.current.clampImage) clampObjectToRect(obj, rect);
          }
          canvas.requestRenderAll?.();
        };
        const onObjectScaling = (e: any) => {
          const rect = constraintsRef.current.allowedRect;
          if (!rect) return;
          const obj = e?.target;
          const role = obj?.data?.role;
          if (role !== 'user-image' && role !== 'user-text') return;
          if (role === 'user-text') {
            if (!lockTextLayout && interactionRef.current.clampText) clampObjectToRect(obj, rect);
            const hasMask = !!overlayDataRef.current.maskU8;
            if (!lockTextLayout && interactionRef.current.clampText && !hasMask) pushTextOutOfImage(obj);
            if (!lockTextLayout) scheduleInvalidCheck(canvas, obj);
          } else if (role === 'user-image') {
            if (!lockTextLayout && interactionRef.current.clampImage) clampObjectToRect(obj, rect);
          }
          canvas.requestRenderAll?.();
        };

        const notifyUserText = (obj: any, includeText: boolean) => {
          const cb = onUserTextChangeRef.current;
          if (!cb) return;
          if (!obj || obj?.data?.role !== 'user-text') return;
          const lineIndex = Number(obj?.data?.lineIndex ?? 0);
          const aabb = getAABBTopLeft(obj);
          const next: any = {
            canvasSlideIndex,
            lineIndex,
            lineKey: typeof obj?.data?.lineKey === 'string' ? obj.data.lineKey : undefined,
            // Persist x/y in the same coordinate system the layout uses:
            // - For center-anchored Y, store obj.top (centerY).
            // - Otherwise store AABB top-left y.
            x: typeof obj?.left === 'number' ? obj.left : aabb.x,
            y: (obj?.originY === 'center' && typeof obj?.top === 'number') ? obj.top : aabb.y,
            maxWidth: Math.max(1, aabb.width),
          };
          if (includeText) next.text = obj.text || '';
          cb(next);
        };

        const notifyUserImage = (obj: any) => {
          const cb = onUserImageChangeRef.current;
          if (!cb) return;
          if (!obj || obj?.data?.role !== 'user-image') return;
          const aabb = getAABBTopLeft(obj);
          // For rotation: save angle separately, but use AABB for position/size
          // so text wrapping works correctly around the rotated bounding box
          const angle = typeof obj.angle === 'number' ? obj.angle : 0;
          cb({
            canvasSlideIndex,
            x: aabb.x,
            y: aabb.y,
            width: Math.max(1, aabb.width),
            height: Math.max(1, aabb.height),
            angle,
          });
        };

        const onObjectModified = (e: any) => {
          const obj = e?.target;
          if (!obj) return;
          // Multi-select drag: Fabric emits object:modified with target type "ActiveSelection" (Fabric 5+).
          // If we don't persist these per-line, the group move is temporary and will snap back on next render.
          // Robust strategy: bake the selection transform into the children (discard), persist each child, then recreate selection.
          try {
            const t = String((obj as any)?.type || '').toLowerCase();
            const isSelection = t === 'activeselection' || t === 'group';
            if (isSelection) {
              const childrenAll: any[] =
                (typeof (obj as any).getObjects === 'function' ? (obj as any).getObjects() : null) ||
                (Array.isArray((obj as any)._objects) ? (obj as any)._objects : []) ||
                [];
              const children = childrenAll.filter((c: any) => c?.data?.role === 'user-text');
              if (children.length > 0) {
                // Skip global enforcement once after this commit so nothing else snaps.
                skipNextGlobalInvariantEnforcementRef.current = true;
                // Clear any stale drag state from the older implementation.
                selectionDragRef.current = null;

                // Bake selection transform into children by discarding the active selection.
                try {
                  canvas.discardActiveObject?.();
                } catch {
                  // ignore
                }

                // Persist each child's now-finalized absolute position.
                children.forEach((child: any) => {
                  try {
                    notifyUserText(child, false);
                  } catch {
                    // ignore per-child
                  }
                });

                // Recreate selection so UX stays the same after release.
                try {
                  const fabric = fabricModuleRef.current;
                  if (fabric && typeof fabric.ActiveSelection === 'function') {
                    const sel = new fabric.ActiveSelection(children, { canvas });
                    canvas.setActiveObject?.(sel);
                  }
                } catch {
                  // ignore
                }

                canvas.requestRenderAll?.();
                return;
              }
            }
          } catch {
            // ignore; fall through to single-object handling
          }
          if (obj?.data?.role === 'user-text') {
            // The state update/persist that follows a user move/resize triggers a re-render; skipping the
            // next global enforcement prevents "one move → whole canvas snaps".
            skipNextGlobalInvariantEnforcementRef.current = true;
            try {
              const id = String(obj?.data?.lineKey || obj?.data?.lineIndex || '');
              if (id) {
                restrictEnforcementToTextIdRef.current = id;
              }
            } catch {
              // ignore
            }
            // STRICT Lock Layout: never auto-nudge on release while locked.
            if (!lockTextLayout) {
              // Phase 3: on release, if invalid, nudge the dragged line minimally until it is valid.
              try {
                const invalid = computeInvalidForUserText(canvas, obj);
                if (invalid) {
                  const next = findNearestValidTopLeft(canvas, obj, getOtherUserTextAABBs(canvas, obj));
                  if (next) {
                    const aabbNow = getAABBTopLeft(obj);
                    obj.left = next.x + aabbNow.originOffsetX;
                    obj.top = next.y + aabbNow.originOffsetY;
                    if (typeof obj.setCoords === 'function') obj.setCoords();
                  }
                }
                const invalidAfter = computeInvalidForUserText(canvas, obj);
                setInvalidHighlight(obj, invalidAfter);
              } catch {
                // ignore
              }
            }
            // If this modification was caused by finishing text editing, skip the geometry-only
            // persist so we don't accidentally re-save stale text from the pre-edit snapshot.
            if (Date.now() - (editStateRef.lastExitAt || 0) > 250) {
              notifyUserText(obj, false);
            }
          }
          if (obj?.data?.role === 'user-image') {
            draggingUserImageRef.current = false;
            notifyUserImage(obj);
          }
        };
        // IMPORTANT: Do NOT persist on every keystroke (text:changed) because it triggers React updates
        // that rebuild the Fabric canvas and kick the user out of edit mode.
        // Commit text ONLY when Fabric signals editing has ended (canvas-level event).

        const onTextEditingEntered = (e: any) => {
          try {
            const obj = e?.target;
            if (!obj || obj?.data?.role !== 'user-text') return;
            editStateRef.active = true;
          } catch {
            // ignore
          }
        };
        const onTextEditingExited = (e: any) => {
          try {
            const obj = e?.target;
            if (!obj || obj?.data?.role !== 'user-text') return;
            editStateRef.active = false;
            editStateRef.lastExitAt = Date.now();
            notifyUserText(obj, true);
          } catch {
            // ignore
          }
        };

        // Debug overlay stacking: template/user images load async and can be added after overlays.
        // Ensure overlays remain visible by bringing them to front any time a non-overlay object is added.
        const onObjectAdded = (e: any) => {
          try {
            if (!showLayoutOverlaysRef.current) return;
            const obj = e?.target;
            if (!obj) return;
            if (obj?.data?.role === 'debug-overlay') return;
            const overlays = (canvas.getObjects?.() || []).filter((o: any) => o?.data?.role === 'debug-overlay');
            if (!overlays.length) return;
            overlays.forEach((o: any) => {
              try {
                if (typeof canvas.bringObjectToFront === 'function') canvas.bringObjectToFront(o);
                else if (typeof canvas.bringToFront === 'function') canvas.bringToFront(o);
              } catch {
                // ignore per-object
              }
            });
            canvas.requestRenderAll?.();
          } catch {
            // ignore
          }
        };

        canvas.on('object:moving', onObjectMoving);
        canvas.on('object:scaling', onObjectScaling);
        canvas.on('object:modified', onObjectModified);
        canvas.on('text:editing:entered', onTextEditingEntered as any);
        canvas.on('text:editing:exited', onTextEditingExited as any);
        canvas.on('object:added', onObjectAdded);
        // Store for cleanup
        (canvas as any).__dnClampHandlers = { onObjectMoving, onObjectScaling, onObjectModified, onTextEditingEntered, onTextEditingExited, onObjectAdded };
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
            const ov = (c as any).__dnOverlayRender;
            if (h) {
              c.off('object:moving', h.onObjectMoving);
              c.off('object:scaling', h.onObjectScaling);
              c.off('object:modified', h.onObjectModified);
              c.off('text:editing:entered', h.onTextEditingEntered);
              c.off('text:editing:exited', h.onTextEditingExited);
              c.off('object:added', h.onObjectAdded);
            }
            if (ov) {
              c.off('after:render', ov.onAfterRender);
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

    // Keep Fabric's pointer mapping accurate when display size changes.
    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      try {
        const z = computeDisplayZoom();
        if (typeof canvas.setZoom === 'function') {
          canvas.setZoom(z);
        }
        if (canvas.viewportTransform && Array.isArray(canvas.viewportTransform)) {
          canvas.viewportTransform[4] = 0;
          canvas.viewportTransform[5] = 0;
        }
        canvas.requestRenderAll?.();
        // Offset depends on DOM layout; refresh after paint.
        window.requestAnimationFrame(() => {
          try {
            canvas.calcOffset?.();
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }
    }, [displayW, displayH, fabricLoaded]);

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
      getImagePosition: (): { x: number; y: number; width: number; height: number; angle?: number } | null => {
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
          // Legacy fallback: allow images with no role, but never template assets.
          objects.find((obj: any) => obj?.type === 'image' && !obj?.data?.role);
        
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

        // Get angle for rotation support
        const angle = typeof imageObj.angle === 'number' ? imageObj.angle : 0;

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
          chosen,
          angle
        });
        console.log(`[Preview Vision] 🧮 Image AABB SENT: x=${Math.round(chosen.x)} y=${Math.round(chosen.y)} w=${Math.round(chosen.width)} h=${Math.round(chosen.height)} angle=${Math.round(angle)}`);
        console.log('[Preview Vision] 📍 Image extends to:', { right: chosen.x + chosen.width, bottom: chosen.y + chosen.height });
        return { ...chosen, angle };
      },
    }), [fabricLoaded]);

    // Re-render when layout or colors change
    useEffect(() => {
      let cancelled = false;
      void (async () => {
        console.log('[Preview Vision] 🎨 Render triggered');
        const canvas = fabricCanvasRef.current;
        const fabric = fabricModuleRef.current;
        const dbg = onDebugLog;
        
        if (!canvas || !fabricLoaded || !fabric) {
          console.log('[Preview Vision] ⏳ Waiting... Canvas:', !!canvas, 'Fabric loaded:', fabricLoaded, 'Fabric module:', !!fabric);
          return;
        }

        // Surface a single high-signal debug line into /editor's Debug panel so we can confirm wiring.
        // This is intentionally before any per-line logs.
        if (dbg && tightUserTextWidth && (hasHeadline !== false)) {
          try {
            dbg(`🧪 TightText enabled: lines=${Array.isArray(layout?.textLines) ? layout.textLines.length : 0}`);
          } catch {
            // ignore
          }
        }

        // Ensure fonts (including italic/bold variants) are loaded before creating Textbox objects.
        // This prevents fallback rendering that can cause odd spacing/kerning and unexpected wraps.
        await ensureTypographyFontsLoaded({
          headlineFontFamily: headlineFontFamily || 'Inter, sans-serif',
          headlineFontWeight: Number.isFinite(headlineFontWeight as any) ? (headlineFontWeight as number) : 700,
          bodyFontFamily: bodyFontFamily || 'Inter, sans-serif',
          bodyFontWeight: Number.isFinite(bodyFontWeight as any) ? (bodyFontWeight as number) : 400,
        });
        if (cancelled) return;

        console.log('[Preview Vision] 🖌️ Rendering vision-based layout on canvas...');

      // Preserve current image position so realign can NEVER move the user's image.
      //
      // IMPORTANT: In `/editor`, image moves are persisted into the layout snapshot via `onUserImageChange`.
      // In that mode, `layout.image` is the source of truth (so Undo can restore image bounds).
      // Therefore we ONLY preserve the live Fabric position when `onUserImageChange` is NOT provided
      // (legacy single-slide generator).
      const existingImageObj =
        canvas.getObjects?.().find((obj: any) => obj?.type === 'image' && obj?.data?.role === 'user-image') ||
        // Legacy fallback: allow images that have no role at all, but NEVER use template assets.
        canvas.getObjects?.().find((obj: any) => obj?.type === 'image' && !obj?.data?.role);
      let preservedImage: null | { left: number; top: number; scaleX: number; scaleY: number; angle: number } = null;
      const shouldPreserveUserImagePosition = !onUserImageChangeRef.current;
      if (shouldPreserveUserImagePosition && existingImageObj) {
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
            angle: existingImageObj.angle || 0,
          };
        } catch {
          preservedImage = {
            left: existingImageObj.left || 0,
            top: existingImageObj.top || 0,
            scaleX: existingImageObj.scaleX || 1,
            scaleY: existingImageObj.scaleY || 1,
            angle: existingImageObj.angle || 0,
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
        canvas.setZoom(computeDisplayZoom());
      }
      if (canvas.viewportTransform && Array.isArray(canvas.viewportTransform)) {
        // Ensure no translation drift
        canvas.viewportTransform[4] = 0;
        canvas.viewportTransform[5] = 0;
      }
      canvas.backgroundColor = backgroundColor;
      console.log('[Preview Vision] 🧹 Canvas cleared, background set to', backgroundColor);

      // Update clamp constraints based on template snapshot (contentRegion inset by 40px).
      constraintsRef.current.contentRectRaw = computeContentRectRaw(templateSnapshot || null);
      constraintsRef.current.allowedRect = computeAllowedRect(templateSnapshot || null);
      updateOverlayData();

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
        // Required so the canvas can be exported (download/share) when using Storage public URLs.
        imgElement.crossOrigin = 'anonymous';
        
        imgElement.onload = () => {
          console.log('[Preview Vision] ✅ Image loaded successfully');
          if (cancelled) return;
          
          // Verify canvas still exists and has required methods
          if (!canvas || typeof canvas.add !== 'function') {
            console.error('[Preview Vision] ❌ Canvas not available for image rendering');
            return;
          }
          
          try {
            const desiredLeft = preservedImage ? preservedImage.left : layout.image!.x;
            const desiredTop = preservedImage ? preservedImage.top : layout.image!.y;
            // Restore angle from preserved image or layout
            const desiredAngle = preservedImage?.angle ?? (layout.image as any)?.angle ?? 0;

            const fabricImage = new fabric.Image(imgElement, {
              left: desiredLeft,
              top: desiredTop,
              originX: 'left',
              originY: 'top',
              // If we preserved an existing image, keep its exact scale so it never "jumps".
              scaleX: preservedImage ? preservedImage.scaleX : (layout.image!.width / imgElement.width),
              scaleY: preservedImage ? preservedImage.scaleY : (layout.image!.height / imgElement.height),
              angle: desiredAngle,
              selectable: true,
            });
            (fabricImage as any).data = { role: 'user-image' };
            // NOTE: Rotation controls enabled for user images

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

            // Re-draw overlay layer now that images may have loaded (overlays are drawn in contextTop).
            try {
              updateOverlayData();
              canvas.requestRenderAll?.();
            } catch {
              // ignore
            }
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
      const effectiveHasHeadline = hasHeadline !== false;
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
          const isHeadlineLine =
            effectiveHasHeadline
              ? (hasDistinctHeadlineSize ? line.baseSize === headlineSize : index === 0)
              : false;
          const baseWeight = isHeadlineLine ? headlineWeight : bodyWeight;
          const originY =
            (line as any)?.positionAnchorY === 'center'
              ? 'center'
              : 'top';
          // IMPORTANT:
          // - In our deterministic layout snapshots, HEADLINE lines store `position.x` as the LEFT edge.
          // - Fabric will interpret `left` differently depending on `originX`.
          // If we set originX=center/right while keeping `left` as a left-edge value, the text can jump
          // off-canvas and violate the contentRegion.
          //
          // Therefore:
          // - For HEADLINE: force originX='left' always; alignment is handled via `textAlign` within the box.
          // - For BODY: keep the existing behavior (origin follows textAlign).
          const isHeadlineBlock = String((line as any)?.block || '').toUpperCase() === 'HEADLINE';
          const originX = isHeadlineBlock
            ? 'left'
            : (line.textAlign === 'center' ? 'center' : line.textAlign === 'right' ? 'right' : 'left');

          // Enhanced (/editor) UX: make each line's selection box hug the text.
          // Since Enhanced is already pre-wrapped into separate lines, use IText (content-sized) instead of Textbox (lane-sized).
          const useTight = !!tightUserTextWidth && effectiveHasHeadline;
          const isSingleLine = !String(line.text || '').includes('\n');
          const laneW = Math.max(1, Math.floor(Number(line.maxWidth || 1)));

          // For "Docs-like" headline alignment, we need a lane-width box so center/right has room to align.
          // If we used IText (tight width), alignment would be visually meaningless. Force Textbox for
          // headline when using center/right.
          const forceLaneWidthBox = isHeadlineBlock && (line.textAlign === 'center' || line.textAlign === 'right');

          const textObj = (useTight && isSingleLine && typeof fabric.IText === 'function' && !forceLaneWidthBox)
            ? new fabric.IText(line.text, {
                left: line.position.x,
                top: line.position.y,
                fontSize: line.baseSize,
                fill: textColor,
                fontFamily: isHeadlineLine ? headlineFont : bodyFont,
                fontWeight: baseWeight,
                textAlign: line.textAlign,
                lineHeight: line.lineHeight,
                originX,
                originY,
                selectable: true,
                editable: true,
                // 12px total horizontal padding (6px each side) via Fabric's padding.
                // NOTE: padding applies uniformly; acceptable per spec (width, not height, was the main concern).
                padding: 6,
                splitByGrapheme: false,
              })
            : new fabric.Textbox(line.text, {
                left: line.position.x,
                top: line.position.y,
                width: laneW, // Hard width constraint for wrap layout.
                fontSize: line.baseSize,
                fill: textColor,
                fontFamily: isHeadlineLine ? headlineFont : bodyFont,
                fontWeight: baseWeight,
                textAlign: line.textAlign,
                lineHeight: line.lineHeight,
                originX,
                originY,
                selectable: true,
                editable: true,
                splitByGrapheme: false, // Wrap at word boundaries, not mid-word
              });
          (textObj as any).data = { role: 'user-text', lineIndex: index, lineKey: (line as any)?.lineKey, block: (line as any)?.block };
          disableRotationControls(textObj);

          // Hard clamp on render: if a layout produced an out-of-bounds position (common when
          // image wrap lanes get tight), keep the text inside the allowed rect so it never "disappears".
          // This is independent of drag-time clamping and runs even on Realign re-renders.
          try {
            const rect = constraintsRef.current.allowedRect;
            // STRICT Lock Layout: never clamp positions during render while locked.
            if (!lockTextLayout && rect && interactionRef.current.clampText) {
              if (typeof (textObj as any).initDimensions === 'function') (textObj as any).initDimensions();
              if (typeof (textObj as any).setCoords === 'function') (textObj as any).setCoords();
              clampObjectToRect(textObj, rect);
            }
          } catch {
            // ignore
          }

          // Text commit is handled at the canvas level via `text:editing:exited` so it's reliable
          // across Fabric object types/versions.

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

          // Debug (only when the parent requests it): report Fabric sizing and which object type we used.
          // Keep it low-noise: only log first few lines per render.
          if (dbg && useTight && index < 8) {
            try {
              if (typeof (textObj as any).initDimensions === 'function') (textObj as any).initDimensions();
              const rawWidth = Number((textObj as any).width || 0);
              const scaledWidth = typeof (textObj as any).getScaledWidth === 'function' ? Number((textObj as any).getScaledWidth()) : rawWidth;
              const lineW0 = typeof (textObj as any).getLineWidth === 'function' ? Number((textObj as any).getLineWidth(0)) : null;
              const br = typeof (textObj as any).getBoundingRect === 'function' ? (textObj as any).getBoundingRect(true, true) : null;
              dbg(
                `🧪 TightText line ${index + 1}: type=${String((textObj as any).type)} align=${String(line.textAlign)} ` +
                  `laneW=${laneW} textW=${lineW0 ?? 'n/a'} objW=${Math.round(rawWidth)} scaledW=${Math.round(scaledWidth)} ` +
                  `padding=${Number((textObj as any).padding || 0)} ` +
                  `bboxW=${br?.width ? Math.round(br.width) : 'n/a'} text="${String(line.text || '').slice(0, 32)}"`
              );
            } catch (e: any) {
              dbg(`🧪 TightText line ${index + 1}: debug failed: ${String(e?.message || e)}`);
            }
          }

          // Hard clamp: if the tight object ends up wider than its lane due to font metrics, fall back to lane width.
          try {
            // STRICT Lock Layout: never swap object types while locked (IText->Textbox fallback looks like a reflow).
            if (!lockTextLayout && useTight && (textObj as any)?.type !== 'textbox') {
              if (typeof (textObj as any).initDimensions === 'function') (textObj as any).initDimensions();
              const w = typeof (textObj as any).getScaledWidth === 'function' ? Number((textObj as any).getScaledWidth()) : Number((textObj as any).width || 0);
              if (Number.isFinite(w) && w > laneW) {
                if (onDebugLog && index < 8) {
                  onDebugLog(
                    `🧪 TightText line ${index + 1}: IText measured wider than lane (w=${Math.round(w)} > laneW=${laneW}) → fallback to Textbox`
                  );
                }
                // Convert to a textbox at lane width so we never violate content margins.
                const tb = new fabric.Textbox(line.text, {
                  left: line.position.x,
                  top: line.position.y,
                  width: laneW,
                  fontSize: line.baseSize,
                  fill: textColor,
                  fontFamily: isHeadlineLine ? headlineFont : bodyFont,
                  fontWeight: baseWeight,
                  textAlign: line.textAlign,
                  lineHeight: line.lineHeight,
                  originX,
                  originY,
                  selectable: true,
                  editable: true,
                  splitByGrapheme: false,
                });
                (tb as any).data = (textObj as any).data;
                disableRotationControls(tb);
                // Re-apply styles if any
                if (line.styles && line.styles.length > 0) {
                  line.styles.forEach((style: any) => {
                    const styleObj: any = {};
                    if (style.fontWeight) {
                      if (style.fontWeight === 'bold') styleObj.fontWeight = 700;
                      else if (style.fontWeight === 'normal') styleObj.fontWeight = baseWeight;
                      else styleObj.fontWeight = style.fontWeight as any;
                    }
                    if (style.fontStyle) styleObj.fontStyle = style.fontStyle;
                    if (style.fill) styleObj.fill = style.fill;
                    if (style.underline) styleObj.underline = style.underline;
                    tb.setSelectionStyles(styleObj, style.start, style.end);
                  });
                }
                canvas.add(tb);
                console.log(`[Preview Vision] ✅ Line ${index + 1} added to canvas (fallback textbox)`);
                return;
              }
            }
          } catch {
            // ignore
          }

          canvas.add(textObj);
          console.log(`[Preview Vision] ✅ Line ${index + 1} added to canvas`);
        } catch (error) {
          console.error(`[Preview Vision] ❌ Error adding line ${index + 1}:`, error);
        }
      });

      // Debug overlays (content rect + image AABB + mask) — purely visual.
      // Also emit a low-noise debug log when toggled or when overlays are enabled (helps verify wiring).
      if (dbg && lastOverlayDebugRef.current !== !!showLayoutOverlays) {
        lastOverlayDebugRef.current = !!showLayoutOverlays;
        try {
          const allowed = constraintsRef.current.allowedRect;
          const raw = constraintsRef.current.contentRectRaw;
          const hasAllowed = !!allowed;
          const hasRaw = !!raw;
          const li = (layout as any)?.image || null;
          const hasMask = !!li?.mask;
          const hasUrl = !!String(li?.url || '');
          const hasFabricUserImage = !!(canvas.getObjects?.() || []).find((o: any) => o?.type === 'image' && o?.data?.role === 'user-image');
          dbg(
            `🧩 Overlays ${showLayoutOverlays ? "ON" : "OFF"}: ` +
              `templateId=${templateId ? String(templateId) : "n/a"} ` +
              `slideIndex=${Number.isInteger(slideIndex as any) ? String(slideIndex) : "n/a"} ` +
              `contentRect=${hasRaw ? `${Math.round(raw!.x)},${Math.round(raw!.y)} ${Math.round(raw!.width)}x${Math.round(raw!.height)}` : "null"} ` +
              `allowedRect=${hasAllowed ? `${Math.round(allowed!.x)},${Math.round(allowed!.y)} ${Math.round(allowed!.width)}x${Math.round(allowed!.height)}` : "null"} ` +
              `layoutImage=${hasUrl ? "yes" : "no"} mask=${hasMask ? "yes" : "no"} fabricUserImage=${hasFabricUserImage ? "yes" : "no"}`
          );
        } catch {
          // ignore
        }
      }
      // Clear legacy object-based overlays (we now draw overlays in the top overlay layer).
      clearDebugOverlays(canvas);

      // Option A (hybrid, product-safe): after any reflow/render, enforce invariants for user text:
      // - Must stay inside allowed rect
      // - Must NOT intersect the silhouette mask (when available)
      // - Must NOT overlap other text lines
      // IMPORTANT: Skip while the user is actively editing text to avoid disrupting typing.
      try {
        // Option #1: if this render was triggered by a user move/resize persist, skip global enforcement once.
        if (skipNextGlobalInvariantEnforcementRef.current) {
          skipNextGlobalInvariantEnforcementRef.current = false;
        } else {
        const cb = onUserTextChangeRef.current;
        const allowed = constraintsRef.current.allowedRect;
        if (allowed) {
          const objsAll = canvas.getObjects?.() || [];
          const textObjs = objsAll.filter((o: any) => o?.data?.role === 'user-text');
          const byId = new Map<string, any>();

          const data = overlayDataRef.current;
          const imageRect = getCurrentUserImageRect(canvas) || data.imageRect;
          const maskU8 = data.maskU8;
          const maskW = data.maskW;
          const maskH = data.maskH;
          const mask = (maskU8 && maskW > 0 && maskH > 0) ? { u8: maskU8, w: maskW, h: maskH } : null;

          // Editor UX: moving one line should not cause other lines to auto-move.
          // After a user drag release, only enforce invariants for that one line on the next render.
          const onlyId = restrictEnforcementToTextIdRef.current || null;

          const items = textObjs.map((o: any, idx: number) => {
            try {
              if (typeof o?.initDimensions === 'function') o.initDimensions();
              if (typeof o?.setCoords === 'function') o.setCoords();
            } catch {
              // ignore
            }
            const a = getAABBTopLeft(o);
            const id = String(o?.data?.lineKey || o?.data?.lineIndex || idx);
            byId.set(id, o);
            return {
              id,
              aabb: { left: a.x, top: a.y, right: a.x + a.width, bottom: a.y + a.height },
              // When onlyId is active, mark all other lines as "editing" so the enforcement loop skips moving them,
              // but still treats their AABBs as obstacles for the moved line.
              isEditing: onlyId ? (id !== onlyId) : !!(o as any).isEditing,
            };
          });

          // If the editor has locked layout for this slide, do NOT auto-move lines here.
          // We still allow manual moves (object:modified handlers) and allow the user to explicitly Realign.
          // Also: when the user is actively dragging the image AND the editor has enabled "auto realign on release",
          // we skip this post-render enforcement so text doesn't "fight" the image drag (it will reflow on release).
          const results = (lockTextLayout || (suppressTextInvariantsWhileDraggingUserImage && draggingUserImageRef.current))
            ? []
            : enforceTextInvariantsSequential({
                items,
                allowedRect: allowed,
                imageRect,
                mask,
                stepPx: 4,
                maxRadiusPx: 640,
                textPaddingPx: 2,
              });

          let changed = false;
          for (const r of results as any[]) {
            const o = byId.get(r.id);
            if (!o) continue;
            // If the user just moved one line, do NOT auto-move any other lines (editor-like).
            if (onlyId && String(r.id) !== String(onlyId)) continue;
            if ((o as any).isEditing) continue;

            if (r.stillInvalid) {
              setInvalidHighlight(o, true);
              continue;
            }

            if (r.moved && r.newTopLeft) {
              const before = getAABBTopLeft(o);
              const aabbNow = getAABBTopLeft(o);
              o.left = r.newTopLeft.x + aabbNow.originOffsetX;
              o.top = r.newTopLeft.y + aabbNow.originOffsetY;
              if (typeof o.setCoords === 'function') o.setCoords();
              setInvalidHighlight(o, false);
              const after = getAABBTopLeft(o);
              const moved = Math.abs(after.x - before.x) > 0.5 || Math.abs(after.y - before.y) > 0.5;
              if (moved) {
                changed = true;
                if (cb) {
                  try {
                    const lineIndex = Number(o?.data?.lineIndex ?? 0);
                    cb({
                      lineIndex,
                      lineKey: typeof o?.data?.lineKey === 'string' ? o.data.lineKey : undefined,
                      x: typeof o?.left === 'number' ? o.left : after.x,
                      y: (o?.originY === 'center' && typeof o?.top === 'number') ? o.top : after.y,
                      maxWidth: Math.max(1, after.width),
                    } as any);
                  } catch {
                    // ignore
                  }
                }
              }
            } else {
              setInvalidHighlight(o, false);
            }
          }

          if (changed) canvas.requestRenderAll?.();
          // Clear the one-shot restriction after this render's enforcement has run.
          if (onlyId) {
            restrictEnforcementToTextIdRef.current = null;
          }
        }
        }
      } catch {
        // ignore
      }

      canvas.renderAll();
      try {
        canvas.calcOffset?.();
      } catch {
        // ignore
      }
      console.log('[Preview Vision] ✅ Render complete! Objects on canvas:', canvas.getObjects().length);
      })();

      return () => {
        cancelled = true;
        try {
          const raf = invalidCheckRef.current.raf;
          if (raf != null) window.cancelAnimationFrame(raf);
          invalidCheckRef.current.raf = null;
          invalidCheckRef.current.obj = null;
        } catch {
          // ignore
        }
      };
    }, [layout, backgroundColor, textColor, fabricLoaded, templateSnapshot, slideIndex, headlineFontFamily, bodyFontFamily, headlineFontWeight, bodyFontWeight, contentPaddingPx, tightUserTextWidth, hasHeadline, onDebugLog, showLayoutOverlays, displayW, displayH]);

    return (
      <div className="flex flex-col items-center space-y-4">
        <div 
          style={{ 
            width: `${displayW}px`,
            height: `${displayH}px`,
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            backgroundColor: '#f9fafb'
          }}
        >
          <canvas 
            ref={canvasRef}
            width={INTERNAL_W}
            height={INTERNAL_H}
            style={{ 
              display: 'block',
              width: `${displayW}px`,
              height: `${displayH}px`,
            }} 
          />
        </div>
      </div>
    );
  }
);

CarouselPreviewVision.displayName = 'CarouselPreviewVision';

export default CarouselPreviewVision;

