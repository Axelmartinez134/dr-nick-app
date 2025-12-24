import 'server-only';
import { LayoutIntent, SafeZone, validateIntentFitsZone } from './layout-engine';

type FitResult =
  | { ok: true; intent: LayoutIntent; validation: ReturnType<typeof validateIntentFitsZone>; metrics: FitMetrics }
  | { ok: false; reason: string };

export interface FitMetrics {
  headlineFont: number;
  bodyFont: number;
  totalLines: number;
  avgFont: number;
  dynamicGap: number;
  zone: { id: SafeZone['id']; width: number; height: number; area: number };
}

// Keep consistent with layout-engine.ts heuristic
const AVG_CHAR_WIDTH_EM = 0.56;
const LINE_HEIGHT = 1.2;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function maxCharsFor(fontSize: number, maxWidth: number): number {
  const estimatedCharPx = fontSize * AVG_CHAR_WIDTH_EM;
  return Math.max(1, Math.floor(maxWidth / estimatedCharPx));
}

function splitLongWord(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) return [word];
  const parts: string[] = [];
  let i = 0;
  while (i < word.length) {
    const remaining = word.length - i;
    if (remaining <= maxChars) {
      parts.push(word.slice(i));
      break;
    }
    const take = Math.max(1, maxChars - 1);
    parts.push(word.slice(i, i + take) + '-');
    i += take;
  }
  return parts;
}

function wrapTextToLines(text: string, maxChars: number): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const words = cleaned.split(' ');
  const normalizedWords: string[] = [];
  for (const w of words) {
    if (w.length > maxChars) {
      normalizedWords.push(...splitLongWord(w, maxChars));
    } else {
      normalizedWords.push(w);
    }
  }

  const lines: string[] = [];
  let current = '';
  for (const w of normalizedWords) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = w;
  }
  if (current) lines.push(current);
  return lines;
}

function baseFontsForZone(zone: SafeZone): { headline: number; body: number } {
  if (zone.width < 260) return { headline: 40, body: 28 };
  if (zone.width < 350) return { headline: 48, body: 32 };
  if (zone.width < 500) return { headline: 56, body: 36 };
  if (zone.width < 700) return { headline: 64, body: 40 };
  return { headline: 76, body: 48 };
}

function pickAlignment(zone: SafeZone): LayoutIntent['alignItems'] {
  // Narrow columns read best left-aligned. Wide areas also default left for a more "pro" look.
  if (zone.width < 600) return 'flex-start';
  return 'flex-start';
}

export function fitTextToZoneDeterministically(headline: string, body: string, zone: SafeZone): FitResult {
  const trimmedHeadline = headline.trim();
  const trimmedBody = body.trim();

  // We'll iteratively shrink fonts until validation passes.
  const baseFonts = baseFontsForZone(zone);
  const minHeadline = 22;
  const minBody = 18;
  const maxIterations = 14;

  for (let iter = 0; iter < maxIterations; iter++) {
    const scale = Math.pow(0.92, iter);
    const headlineFont = Math.max(minHeadline, Math.round(baseFonts.headline * scale));
    const bodyFont = Math.max(minBody, Math.round(baseFonts.body * scale));

    // Use the same maxWidth concept as validateIntentFitsZone will use (zone padding).
    // We don't have padding here, but validateIntentFitsZone will compute it; so we derive maxWidth from it.
    const probeIntent: LayoutIntent = {
      selectedZone: zone.id,
      alignItems: pickAlignment(zone),
      textLines: [{ text: 'probe', fontSize: bodyFont }],
    };
    const probeValidation = validateIntentFitsZone(probeIntent, zone);
    const maxWidth = probeValidation.computed.maxWidth;

    const headlineMaxChars = maxCharsFor(headlineFont, maxWidth);
    const bodyMaxChars = maxCharsFor(bodyFont, maxWidth);

    const headlineLines = wrapTextToLines(trimmedHeadline, headlineMaxChars);
    const bodyLines = wrapTextToLines(trimmedBody, bodyMaxChars);

    // Avoid pathological explosion of lines: if it’s too many, shrink and try again.
    const totalLines = headlineLines.length + bodyLines.length;
    if (totalLines > 28 && iter < maxIterations - 1) {
      continue;
    }

    const intent: LayoutIntent = {
      selectedZone: zone.id,
      alignItems: pickAlignment(zone),
      textLines: [
        ...headlineLines.map((t) => ({ text: t, fontSize: headlineFont, styles: [] })),
        ...bodyLines.map((t) => ({ text: t, fontSize: bodyFont, styles: [] })),
      ],
    };

    const validation = validateIntentFitsZone(intent, zone);
    if (!validation.ok) {
      // Keep shrinking until it fits.
      continue;
    }

    const avgFont = intent.textLines.reduce((s, l) => s + l.fontSize, 0) / Math.max(1, intent.textLines.length);
    return {
      ok: true,
      intent,
      validation,
      metrics: {
        headlineFont,
        bodyFont,
        totalLines: intent.textLines.length,
        avgFont: round1(avgFont),
        dynamicGap: validation.computed.dynamicGap,
        zone: { id: zone.id, width: zone.width, height: zone.height, area: zone.area },
      },
    };
  }

  return { ok: false, reason: `Could not fit text within zone ${zone.id} within ${maxIterations} scaling attempts` };
}

export function chooseBestZoneDeterministically(headline: string, body: string, zones: SafeZone[]) {
  const candidates: Array<{ fit: Extract<FitResult, { ok: true }>; score: number }> = [];
  const failures: Array<{ zone: SafeZone['id']; reason: string }> = [];

  for (const z of zones) {
    const res = fitTextToZoneDeterministically(headline, body, z);
    if (!res.ok) {
      failures.push({ zone: z.id, reason: res.reason });
      continue;
    }

    // Score: prioritize readability (avg font), then gap, then area, and prefer TOP/BOTTOM slightly.
    const zoneBonus = (z.id === 'TOP' || z.id === 'BOTTOM') ? 150 : 0;
    const widthPenalty = z.width < 260 ? -200 : z.width < 350 ? -80 : 0;
    const score =
      res.metrics.avgFont * 1000 +
      res.metrics.dynamicGap * 20 +
      (z.area / 1000) +
      zoneBonus +
      widthPenalty;

    candidates.push({ fit: res, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return {
    best: candidates[0]?.fit ?? null,
    candidates: candidates.map((c) => ({ zone: c.fit.metrics.zone.id, score: round1(c.score), metrics: c.fit.metrics })),
    failures,
  };
}


