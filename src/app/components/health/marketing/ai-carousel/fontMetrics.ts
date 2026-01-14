'use client';

// Minimal, cached estimate of average character width in "em" units for a given font.
// This is used by wrap-flow layout to avoid assuming "Arial-ish" widths for all fonts.

const cache = new Map<string, number>();
const loadCache = new Map<string, Promise<void>>();

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function primaryFamilyName(fontFamily: string): string {
  const raw = String(fontFamily || '').trim();
  if (!raw) return 'Inter';
  // Take first family before comma; strip quotes.
  const first = raw.split(',')[0]?.trim() || raw;
  return first.replace(/^['"]+|['"]+$/g, '').trim() || 'Inter';
}

export async function ensureTypographyFontsLoaded(opts: {
  headlineFontFamily: string;
  headlineFontWeight: number;
  bodyFontFamily: string;
  bodyFontWeight: number;
}) {
  if (typeof document === 'undefined') return;
  const fonts: any = (document as any).fonts;
  if (!fonts?.load) return;

  const hf = primaryFamilyName(opts.headlineFontFamily);
  const bf = primaryFamilyName(opts.bodyFontFamily);
  const hw = Number.isFinite(opts.headlineFontWeight as any) ? Number(opts.headlineFontWeight) : 700;
  const bw = Number.isFinite(opts.bodyFontWeight as any) ? Number(opts.bodyFontWeight) : 400;

  // Load the variants we actually use: normal + italic, in both regular weight and bold (700).
  const families = [
    { family: hf, weights: Array.from(new Set([hw, 700])) },
    { family: bf, weights: Array.from(new Set([bw, 700])) },
  ];

  const sizePx = 16; // size doesn't matter; just needs to trigger font face loading
  const promises: Promise<any>[] = [];

  for (const f of families) {
    for (const w of f.weights) {
      const keyN = `${f.family}@@normal@@${w}`;
      const keyI = `${f.family}@@italic@@${w}`;

      if (!loadCache.has(keyN)) {
        loadCache.set(keyN, fonts.load(`normal ${w} ${sizePx}px "${f.family}"`).then(() => void 0).catch(() => void 0));
      }
      if (!loadCache.has(keyI)) {
        loadCache.set(keyI, fonts.load(`italic ${w} ${sizePx}px "${f.family}"`).then(() => void 0).catch(() => void 0));
      }

      promises.push(loadCache.get(keyN)!);
      promises.push(loadCache.get(keyI)!);
    }
  }

  await Promise.all(promises);
}

export function estimateAvgCharWidthEm(fontFamily: string, fontWeight: number): number {
  const family = String(fontFamily || '').trim() || 'Inter, sans-serif';
  const weight = Number.isFinite(fontWeight as any) ? Number(fontWeight) : 400;
  const key = `${family}@@${weight}`;
  const cached = cache.get(key);
  if (typeof cached === 'number' && Number.isFinite(cached)) return cached;

  // If we can't measure (e.g., SSR), fall back to wrap-flow's default.
  if (typeof document === 'undefined') return 0.56;

  // Safety: if the font isn't loaded yet, measuring may use a fallback font and UNDER-estimate width,
  // which causes wrap-flow to pack too many characters per line (leading to Fabric.Textbox wrapping + overlaps).
  // Keep this conservative so we never underestimate.
  const isSerifFamily =
    /Droid Serif/i.test(family) ||
    /Noto Serif/i.test(family) ||
    /Playfair Display/i.test(family) ||
    /\bserif\b/i.test(family);
  const conservativeEm = isSerifFamily ? 0.66 : 0.58;

  try {
    const fonts: any = (document as any).fonts;
    if (fonts?.check && !fonts.check(`${weight} 16px ${family}`)) {
      cache.set(key, conservativeEm);
      return conservativeEm;
    }
  } catch {
    // ignore; we'll measure below
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0.56;

    const sizePx = 100; // large for stable measurement
    ctx.font = `${weight} ${sizePx}px ${family}`;

    // Avoid spaces to reduce variability across fonts.
    const sample = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const w = ctx.measureText(sample).width;
    const em = w / sample.length / sizePx;
    // Never underestimate; prefer conservative width for stability.
    const out = clamp(Math.max(em, conservativeEm), 0.35, 1.2);
    cache.set(key, out);
    return out;
  } catch {
    return conservativeEm;
  }
}

// A less-conservative variant intended for deterministic wrap packing.
// This may slightly UNDER-estimate when styles vary (bold/italic), so callers should validate
// the resulting lines against actual measured pixel widths and retry if needed.
export function estimateAvgCharWidthEmRelaxed(fontFamily: string, fontWeight: number): number {
  const family = String(fontFamily || '').trim() || 'Inter, sans-serif';
  const weight = Number.isFinite(fontWeight as any) ? Number(fontWeight) : 400;
  const key = `relaxed::${family}@@${weight}`;
  const cached = cache.get(key);
  if (typeof cached === 'number' && Number.isFinite(cached)) return cached;

  // If we can't measure (e.g., SSR), fall back to wrap-flow's default.
  if (typeof document === 'undefined') return 0.56;

  const isSerifFamily =
    /Droid Serif/i.test(family) ||
    /Noto Serif/i.test(family) ||
    /Playfair Display/i.test(family) ||
    /\bserif\b/i.test(family);
  const conservativeEm = isSerifFamily ? 0.66 : 0.58;

  try {
    const fonts: any = (document as any).fonts;
    // If we can't confirm the font is loaded, avoid measuring a fallback font (which can under-estimate).
    if (fonts?.check && !fonts.check(`${weight} 16px ${family}`)) {
      cache.set(key, conservativeEm);
      return conservativeEm;
    }
  } catch {
    // ignore; we'll measure below
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0.56;

    const sizePx = 100; // large for stable measurement
    ctx.font = `${weight} ${sizePx}px ${family}`;
    const sample = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const w = ctx.measureText(sample).width;
    const em = w / sample.length / sizePx;
    // Relaxed: use the measured value (clamped) without forcing a conservative floor.
    const out = clamp(em, 0.35, 1.2);
    cache.set(key, out);
    return out;
  } catch {
    return conservativeEm;
  }
}

