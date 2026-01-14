import type { AABB } from './aabb';
import { rectsOverlapAABB } from './aabb';
import type { AllowedRect, MaskData } from './nearestValid';
import { findNearestValidTopLeft } from './nearestValid';
import type { ImageRect } from './maskIntersection';
import { aabbIntersectsMask } from './maskIntersection';

export type TextItem = {
  id: string;
  aabb: AABB;
  isEditing?: boolean;
};

export type EnforceResult = {
  id: string;
  moved: boolean;
  newTopLeft?: { x: number; y: number };
  stillInvalid: boolean;
};

export function enforceTextInvariantsSequential(params: {
  items: TextItem[];
  allowedRect: AllowedRect;
  imageRect: ImageRect | null;
  mask: MaskData | null;
  stepPx?: number; // default 4
  maxRadiusPx?: number; // default 640
  textPaddingPx?: number; // default 2
}): EnforceResult[] {
  const { items, allowedRect, imageRect, mask } = params;
  const stepPx = params.stepPx ?? 4;
  const maxRadiusPx = params.maxRadiusPx ?? 640;
  const pad = params.textPaddingPx ?? 2;

  const inflate = (a: AABB): AABB => ({
    left: a.left - pad,
    top: a.top - pad,
    right: a.right + pad,
    bottom: a.bottom + pad,
  });

  const imgAabb: AABB | null = imageRect
    ? {
        left: imageRect.x,
        top: imageRect.y,
        right: imageRect.x + imageRect.width,
        bottom: imageRect.y + imageRect.height,
      }
    : null;

  const isInvalidAabb = (aabb: AABB): boolean => {
    if (!imageRect) return false;
    if (mask && mask.u8 && mask.w > 0 && mask.h > 0) {
      return aabbIntersectsMask(aabb, imageRect, mask.u8, mask.w, mask.h);
    }
    return imgAabb ? rectsOverlapAABB(aabb, imgAabb) : false;
  };

  // Keep a mutable view of current AABBs so later items avoid earlier moves (matches canvas behavior).
  const curAabbs = items.map((it) => it.aabb);

  const out: EnforceResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (it.isEditing) {
      out.push({ id: it.id, moved: false, stillInvalid: false });
      continue;
    }
    const aabb = curAabbs[i]!;
    const w = Math.max(1, aabb.right - aabb.left);
    const h = Math.max(1, aabb.bottom - aabb.top);
    const curTopLeft = { x: aabb.left, y: aabb.top };

    const avoid = curAabbs
      .map((a, idx) => ({ a, idx }))
      .filter((x) => x.idx !== i)
      .map((x) => inflate(x.a));

    // If not invalid, keep.
    if (!isInvalidAabb(aabb)) {
      out.push({ id: it.id, moved: false, stillInvalid: false });
      continue;
    }

    const next = findNearestValidTopLeft({
      curTopLeft,
      boxSize: { w, h },
      allowedRect,
      imageRect,
      mask,
      avoidAabbs: avoid,
      stepPx,
      maxRadiusPx,
    });

    if (!next) {
      out.push({ id: it.id, moved: false, stillInvalid: true });
      continue;
    }

    const moved = Math.abs(next.x - curTopLeft.x) > 0.5 || Math.abs(next.y - curTopLeft.y) > 0.5;
    if (moved) {
      curAabbs[i] = { left: next.x, top: next.y, right: next.x + w, bottom: next.y + h };
      out.push({ id: it.id, moved: true, newTopLeft: next, stillInvalid: false });
    } else {
      out.push({ id: it.id, moved: false, stillInvalid: false });
    }
  }

  return out;
}

