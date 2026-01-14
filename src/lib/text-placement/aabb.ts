export type AABB = { left: number; top: number; right: number; bottom: number };

// Axis-aligned bounding box overlap test.
// NOTE: This is intentionally identical to the inlined helper previously used in CarouselPreviewVision
// so the refactor does not change behavior.
export function rectsOverlapAABB(a: AABB, b: AABB): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

