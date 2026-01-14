import type { AABB } from './aabb';
import { rectsOverlapAABB } from './aabb';
import type { ImageRect } from './maskIntersection';
import { aabbIntersectsMask } from './maskIntersection';

export type AllowedRect = { x: number; y: number; width: number; height: number };
export type MaskData = { u8: Uint8Array; w: number; h: number };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// Find the nearest valid top-left position for a text AABB (treated as solid) such that:
// - It stays within `allowedRect`
// - It does not intersect the silhouette mask (if present), otherwise does not intersect the image AABB
// - It does not overlap any other text AABBs (avoid list)
//
// NOTE: This function is intentionally a pure extraction of the logic previously in
// `CarouselPreviewVision.tsx` (diamond search, same step/maxRadius) to avoid behavior changes.
export function findNearestValidTopLeft(params: {
  curTopLeft: { x: number; y: number };
  boxSize: { w: number; h: number };
  allowedRect: AllowedRect;
  imageRect: ImageRect | null;
  mask: MaskData | null;
  avoidAabbs?: AABB[];
  stepPx?: number; // default 4
  maxRadiusPx?: number; // default 640
}): null | { x: number; y: number } {
  const {
    curTopLeft,
    boxSize,
    allowedRect,
    imageRect,
    mask,
    avoidAabbs,
    stepPx,
    maxRadiusPx,
  } = params;

  const w = Math.max(1, boxSize.w);
  const h = Math.max(1, boxSize.h);
  const cur = { x: curTopLeft.x, y: curTopLeft.y };

  const withinAllowed = (p: { x: number; y: number }) =>
    p.x >= allowedRect.x &&
    p.y >= allowedRect.y &&
    (p.x + w) <= (allowedRect.x + allowedRect.width) &&
    (p.y + h) <= (allowedRect.y + allowedRect.height);

  const isInvalidAt = (p: { x: number; y: number }) => {
    if (!imageRect) return false;
    const aabb: AABB = { left: p.x, top: p.y, right: p.x + w, bottom: p.y + h };
    if (mask && mask.u8 && mask.w > 0 && mask.h > 0) {
      return aabbIntersectsMask(aabb, imageRect, mask.u8, mask.w, mask.h);
    }
    const imgAabb: AABB = {
      left: imageRect.x,
      top: imageRect.y,
      right: imageRect.x + imageRect.width,
      bottom: imageRect.y + imageRect.height,
    };
    return rectsOverlapAABB(aabb, imgAabb);
  };

  const overlapsOtherTextAt = (p: { x: number; y: number }) => {
    if (!avoidAabbs || avoidAabbs.length === 0) return false;
    const aabb: AABB = { left: p.x, top: p.y, right: p.x + w, bottom: p.y + h };
    for (const other of avoidAabbs) {
      if (rectsOverlapAABB(aabb, other)) return true;
    }
    return false;
  };

  if (withinAllowed(cur) && !isInvalidAt(cur) && !overlapsOtherTextAt(cur)) return cur;

  const step = clamp(Math.floor(stepPx ?? 4), 1, 64);
  const maxRadius = clamp(Math.floor(maxRadiusPx ?? 640), step, 4096);

  for (let r = step; r <= maxRadius; r += step) {
    for (let dx = -r; dx <= r; dx += step) {
      const dy = r - Math.abs(dx);
      const candidates: Array<{ x: number; y: number }> = [
        { x: cur.x + dx, y: cur.y + dy },
        { x: cur.x + dx, y: cur.y - dy },
      ];
      for (const p of candidates) {
        if (!withinAllowed(p)) continue;
        if (!isInvalidAt(p) && !overlapsOtherTextAt(p)) return p;
      }
    }
  }

  return null;
}

