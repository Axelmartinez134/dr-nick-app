export type TemplateRect = { x: number; y: number; width: number; height: number };

export function getTemplateContentRectRaw(templateSnapshot: any | null): TemplateRect | null {
  const slide0 =
    Array.isArray(templateSnapshot?.slides)
      ? (templateSnapshot.slides.find((s: any) => s?.slideIndex === 0) || templateSnapshot.slides[0])
      : null;
  const region = slide0?.contentRegion;
  if (!region) return null;
  if (
    typeof region.x !== 'number' ||
    typeof region.y !== 'number' ||
    typeof region.width !== 'number' ||
    typeof region.height !== 'number'
  ) {
    return null;
  }
  return {
    x: region.x,
    y: region.y,
    width: Math.max(1, region.width),
    height: Math.max(1, region.height),
  };
}

export function computeDefaultUploadedImagePlacement(
  templateSnapshot: any | null,
  imageW: number,
  imageH: number
): TemplateRect {
  const region = getTemplateContentRectRaw(templateSnapshot);
  const outer = region || { x: 0, y: 0, width: 1080, height: 1440 };
  // Keep inside content region with a bit of padding.
  const PAD = 40;
  const inset = {
    x: outer.x + PAD,
    y: outer.y + PAD,
    width: Math.max(1, outer.width - PAD * 2),
    height: Math.max(1, outer.height - PAD * 2),
  };
  const maxW = inset.width * 0.7;
  const maxH = inset.height * 0.7;
  const iw = Math.max(1, Number(imageW) || 1);
  const ih = Math.max(1, Number(imageH) || 1);
  const scale = Math.min(maxW / iw, maxH / ih, 1);
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const x = Math.round(inset.x + (inset.width - w) / 2);
  const y = Math.round(inset.y + (inset.height - h) / 2);
  return { x, y, width: w, height: h };
}

