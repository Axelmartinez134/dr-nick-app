import type { AABB } from './aabb';
import { rectsOverlapAABB } from './aabb';

export type ImageRect = { x: number; y: number; width: number; height: number };

// Returns true if the given AABB intersects any "solid" pixel in the mask when the mask
// is mapped into the imageRect.
//
// NOTE: This is intentionally identical to the inlined helper previously used in
// `CarouselPreviewVision.tsx` so the refactor does not change behavior.
export function aabbIntersectsMask(
  aabb: AABB,
  imageRect: ImageRect,
  maskU8: Uint8Array,
  maskW: number,
  maskH: number
): boolean {
  // Intersect AABB with image rect first (cheap reject).
  const imgAabb: AABB = {
    left: imageRect.x,
    top: imageRect.y,
    right: imageRect.x + imageRect.width,
    bottom: imageRect.y + imageRect.height,
  };
  if (!rectsOverlapAABB(aabb, imgAabb)) return false;
  if (imageRect.width <= 1 || imageRect.height <= 1 || maskW <= 0 || maskH <= 0) return true;

  const ixL = Math.max(aabb.left, imgAabb.left);
  const ixR = Math.min(aabb.right, imgAabb.right);
  const ixT = Math.max(aabb.top, imgAabb.top);
  const ixB = Math.min(aabb.bottom, imgAabb.bottom);
  if (ixR <= ixL || ixB <= ixT) return false;

  const toCol = (x: number) => Math.floor(((x - imageRect.x) / imageRect.width) * maskW);
  const toColCeil = (x: number) => Math.ceil(((x - imageRect.x) / imageRect.width) * maskW);
  const toRow = (y: number) => Math.floor(((y - imageRect.y) / imageRect.height) * maskH);
  const toRowCeil = (y: number) => Math.ceil(((y - imageRect.y) / imageRect.height) * maskH);

  const c0 = Math.max(0, Math.min(maskW - 1, toCol(ixL)));
  const c1 = Math.max(0, Math.min(maskW, toColCeil(ixR)));
  const r0 = Math.max(0, Math.min(maskH - 1, toRow(ixT)));
  const r1 = Math.max(0, Math.min(maskH, toRowCeil(ixB)));

  for (let r = r0; r < r1; r++) {
    const rowOff = r * maskW;
    for (let c = c0; c < c1; c++) {
      if (maskU8[rowOff + c] > 0) return true;
    }
  }
  return false;
}

