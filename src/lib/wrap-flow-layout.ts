import 'server-only';
import type { TextLine, VisionLayoutDecision } from './carousel-types';

export interface WrapFlowOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  margin?: number; // canvas margin
  // Optional override for the usable text/image content bounds (in canvas coordinates).
  // When provided, wrap-flow will keep ALL lines inside this rect instead of using canvas+margin.
  // NOTE: This is how templates provide a slide contentRegion (typically inset by padding).
  contentRect?: { x: number; y: number; width: number; height: number };
  clearancePx?: number; // gap from image AABB
  lineHeight?: number; // multiplier
  headlineFontSize?: number;
  bodyFontSize?: number;
  headlineMinFontSize?: number;
  bodyMinFontSize?: number;
  headlineLineHeight?: number;
  bodyLineHeight?: number;
  blockGapPx?: number; // gap between headline and body blocks
  laneTieBreak?: 'left' | 'right';
  // When the image creates a usable side lane, prefer placing BODY lines in that lane
  // (instead of shrinking to fit everything above the image).
  bodyPreferSideLane?: boolean;
  minUsableLaneWidthPx?: number;
  // If side lane is too skinny and there is enough space below the image,
  // prefer continuing body below the image at full width for readability.
  skinnyLaneWidthPx?: number;
  minBelowSpacePx?: number;
}

export interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Rect = { left: number; top: number; right: number; bottom: number };

const DEFAULTS: Required<Omit<WrapFlowOptions, 'contentRect'>> = {
  canvasWidth: 1080,
  canvasHeight: 1440,
  margin: 40,
  clearancePx: 1,
  lineHeight: 1.2,
  headlineFontSize: 76,
  bodyFontSize: 48,
  headlineMinFontSize: 32,
  bodyMinFontSize: 24,
  headlineLineHeight: 1.15,
  bodyLineHeight: 1.25,
  blockGapPx: 24,
  laneTieBreak: 'right',
  bodyPreferSideLane: true,
  minUsableLaneWidthPx: 280,
  skinnyLaneWidthPx: 360,
  minBelowSpacePx: 240,
};

// Very rough width model; we avoid internal Textbox wrapping by limiting chars per line.
const AVG_CHAR_WIDTH_EM = 0.56; // Arial-ish conservative

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function lineHeightPx(fontSize: number, lh: number) {
  return fontSize * lh;
}

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, ' ').trim();
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

function tokenize(text: string, maxChars: number): string[] {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return [];
  const words = cleaned.split(' ');
  const out: string[] = [];
  for (const w of words) {
    if (w.length > maxChars) out.push(...splitLongWord(w, maxChars));
    else out.push(w);
  }
  return out;
}

function maxCharsForWidth(fontSize: number, widthPx: number) {
  const estCharPx = fontSize * AVG_CHAR_WIDTH_EM;
  return Math.max(1, Math.floor(widthPx / estCharPx));
}

function takeLine(tokens: string[], maxChars: number): { line: string; consumed: number } {
  if (tokens.length === 0) return { line: '', consumed: 0 };
  let line = '';
  let consumed = 0;
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxChars) {
      line = next;
      consumed++;
      continue;
    }
    break;
  }
  // Always consume at least one token (should be possible due to splitLongWord)
  if (!line) {
    line = tokens[0].slice(0, Math.max(1, maxChars - 1)) + '…';
    consumed = 1;
  }
  return { line, consumed };
}

function intersectsYBand(yTop: number, yBottom: number, rect: Rect) {
  return !(yBottom <= rect.top || yTop >= rect.bottom);
}

function laneForYBand(
  yTop: number,
  yBottom: number,
  content: Rect,
  blocked: Rect,
  tieBreak: 'left' | 'right'
): { x: number; width: number; kind: 'FULL' | 'LEFT' | 'RIGHT' } | null {
  if (!intersectsYBand(yTop, yBottom, blocked)) {
    return { x: content.left, width: content.right - content.left, kind: 'FULL' };
  }
  const leftWidth = blocked.left - content.left;
  const rightWidth = content.right - blocked.right;
  // If a side is not available, treat width as 0
  const leftUsable = leftWidth > 0;
  const rightUsable = rightWidth > 0;
  if (!leftUsable && !rightUsable) return null;

  const best =
    rightUsable && (!leftUsable || rightWidth > leftWidth) ? 'RIGHT' :
    leftUsable && (!rightUsable || leftWidth > rightWidth) ? 'LEFT' :
    tieBreak === 'right' ? 'RIGHT' : 'LEFT';

  if (best === 'LEFT') return { x: content.left, width: leftWidth, kind: 'LEFT' };
  return { x: blocked.right, width: rightWidth, kind: 'RIGHT' };
}

function overlapsRect(a: Rect, b: Rect) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function lineRect(line: TextLine): Rect {
  const maxWidth = line.maxWidth ?? 0;
  // Integer-safe rect:
  // - center alignment with odd widths can produce 0.5px edges and trip strict bounds checks.
  // - y placement uses ceil, but keep rect conservative by rounding outward.
  const leftRaw =
    line.textAlign === 'center' ? (line.position.x - (maxWidth / 2)) :
    line.textAlign === 'right' ? (line.position.x - maxWidth) :
    line.position.x;
  const topRaw = line.position.y;
  const left = Math.floor(leftRaw);
  const top = Math.floor(topRaw);
  const right = Math.ceil(leftRaw + maxWidth);
  const bottom = Math.ceil(topRaw + (line.baseSize * line.lineHeight));
  return { left, top, right, bottom };
}

export function wrapFlowLayout(
  headline: string,
  body: string,
  image: ImageBounds,
  opts?: WrapFlowOptions
): { layout: VisionLayoutDecision; meta: { truncated: boolean; usedFonts: { headline: number; body: number } } } {
  const o = { ...DEFAULTS, ...(opts || {}) } as (Required<Omit<WrapFlowOptions, 'contentRect'>> & { contentRect?: { x: number; y: number; width: number; height: number } });

  const contentRect = o.contentRect || {
    x: o.margin,
    y: o.margin,
    width: o.canvasWidth - (o.margin * 2),
    height: o.canvasHeight - (o.margin * 2),
  };

  // IMPORTANT: contentRect can have fractional coordinates (e.g., template contentRegion drawn in Fabric).
  // If we keep it fractional, our integer-safe placement (ceil for x/y, floor for width) can produce a
  // line that is ~0.1–0.9px outside the content bounds and trigger a hard "margin violation".
  // Fix: snap content bounds OUTWARDS to integer pixels, same strategy used for blocked image bounds.
  const cLeftF = clamp(contentRect.x, -10000, 10000);
  const cTopF = clamp(contentRect.y, -10000, 10000);
  const cRightF = cLeftF + clamp(contentRect.width, 0, 20000);
  const cBottomF = cTopF + clamp(contentRect.height, 0, 20000);

  const content: Rect = {
    left: Math.floor(cLeftF),
    top: Math.floor(cTopF),
    right: Math.ceil(cRightF),
    bottom: Math.ceil(cBottomF),
  };

  // Image AABB can be fractional; convert to an integer-safe exclusion rect so rounding doesn't
  // accidentally place text <1px inside the blocked area.
  const imgLeftF = clamp(image.x, -10000, 10000);
  const imgTopF = clamp(image.y, -10000, 10000);
  const imgRightF = imgLeftF + image.width;
  const imgBottomF = imgTopF + image.height;

  // Expand by clearance, then snap OUTWARDS to integer pixels
  const blocked: Rect = {
    left: Math.floor(imgLeftF - o.clearancePx),
    top: Math.floor(imgTopF - o.clearancePx),
    right: Math.ceil(imgRightF + o.clearancePx),
    bottom: Math.ceil(imgBottomF + o.clearancePx),
  };

  const assertNoOverlap = (lines: TextLine[]) => {
    for (let i = 0; i < lines.length; i++) {
      const lr = lineRect(lines[i]);
      if (overlapsRect(lr, blocked)) {
        throw new Error(
          `Wrap-flow overlap detected for line ${i + 1} at (${lr.left},${lr.top})-(${lr.right},${lr.bottom}) intersects image AABB+${o.clearancePx}px`
        );
      }
      // Also assert within content margins
      if (lr.left < content.left || lr.right > content.right || lr.top < content.top || lr.bottom > content.bottom) {
        throw new Error(
          `Wrap-flow margin violation for line ${i + 1} at (${lr.left},${lr.top})-(${lr.right},${lr.bottom}) outside content rect`
        );
      }
    }
  };

  // Iteratively shrink fonts until text fits without truncation (if possible).
  // Typography polish: keep headline above image if possible; allow body to wrap beside.
  let headlineFont = o.headlineFontSize;
  let bodyFont = o.bodyFontSize;

  const minHeadline = o.headlineMinFontSize;
  const minBody = o.bodyMinFontSize;

  let bestLines: TextLine[] = [];
  let bestTruncated = true;

  const fontSeq = (start: number, min: number) => {
    const out: number[] = [];
    for (let f = start; f >= min; f -= 2) out.push(f);
    if (out[out.length - 1] !== min) out.push(min);
    return out;
  };

  const headlineFonts = fontSeq(o.headlineFontSize, minHeadline);
  const bodyFonts = fontSeq(o.bodyFontSize, minBody);

  for (const hf of headlineFonts) {
    headlineFont = hf;
    for (const bf of bodyFonts) {
      bodyFont = bf;

      const lines: TextLine[] = [];
      let y = content.top;

      const headlineTokens = tokenize(headline, 60); // high ceiling; per-line maxChars computed later
      const bodyTokens = tokenize(body, 120);

      let hIdx = 0;
      let bIdx = 0;
      let inHeadline = headlineTokens.length > 0;
      let truncated = false;
      let headlineHitImage = false;

      const placeNextLine = (
        fontSize: number,
        lh: number,
        tokens: string[],
        idx: number,
        block: 'HEADLINE' | 'BODY'
      ): { nextIdx: number; placed: boolean } => {
        const lhPx = lineHeightPx(fontSize, lh);
      // If out of vertical space, truncate
      if (y + lhPx > content.bottom) {
        truncated = true;
        return { nextIdx: idx, placed: false };
      }

      // Typography polish: do not allow headline to enter the image vertical span.
      // If the next headline line would overlap the image span, signal and force smaller headline font.
      if (block === 'HEADLINE' && intersectsYBand(y, y + lhPx, blocked)) {
        headlineHitImage = true;
        return { nextIdx: idx, placed: false };
      }

      const lane = laneForYBand(y, y + lhPx, content, blocked, o.laneTieBreak);
      if (!lane) {
        // Shouldn't happen, but be safe
        y = Math.max(y, blocked.bottom);
        return { nextIdx: idx, placed: false };
      }

      // Edge-case polish: if we are in a skinny side lane, and there is meaningful space below the image,
      // jump below the image and continue full-width to avoid an overly tall/narrow body column.
      if (
        block === 'BODY' &&
        lane.kind !== 'FULL' &&
        lane.width > 0 &&
        lane.width < o.skinnyLaneWidthPx &&
        (content.bottom - blocked.bottom) >= o.minBelowSpacePx
      ) {
        // Move to just below the blocked rect and retry placement.
        y = Math.max(y, blocked.bottom);
        return { nextIdx: idx, placed: false };
      }

      // If lane is unusably narrow, skip below image if we're intersecting it.
      const maxChars = maxCharsForWidth(fontSize, lane.width);
      if (lane.width <= 0 || maxChars < 4) {
        if (intersectsYBand(y, y + lhPx, blocked)) {
          y = Math.max(y, blocked.bottom);
          return { nextIdx: idx, placed: false };
        }
        // otherwise just move down one line
        y += lhPx;
        return { nextIdx: idx, placed: false };
      }

      const { line, consumed } = takeLine(tokens.slice(idx), maxChars);
      if (!line || consumed <= 0) {
        y += lhPx;
        return { nextIdx: idx, placed: false };
      }

      const textAlign: 'left' | 'center' = (block === 'BODY' && lane.kind !== 'FULL') ? 'center' : 'left';

      const textLine: TextLine = {
        text: line,
        baseSize: fontSize,
        // positions filled below after we choose an integer-safe x
        position: { x: 0, y: Math.ceil(y) },
        textAlign,
        lineHeight: lh,
        // Use floor so we never exceed content.right; for centered lines, enforce even widths to avoid 0.5px edges.
        maxWidth: 0,
        styles: [],
      };

      // Choose an integer-safe maxWidth and x within the CONTENT rect.
      const contentWidth = Math.max(1, Math.floor(content.right - content.left));
      let maxWidthPx = Math.max(1, Math.min(Math.floor(lane.width), contentWidth));
      if (textAlign === 'center' && (maxWidthPx % 2) === 1) maxWidthPx -= 1; // keep even
      maxWidthPx = Math.max(1, maxWidthPx);
      textLine.maxWidth = maxWidthPx;

      if (textAlign === 'center') {
        const desiredCenter = lane.x + (lane.width / 2);
        const half = maxWidthPx / 2;
        const minCenter = content.left + half;
        const maxCenter = content.right - half;
        const x = clamp(Math.round(desiredCenter), Math.ceil(minCenter), Math.floor(maxCenter));
        textLine.position.x = x;
      } else {
        const desiredLeft = lane.x;
        const minLeft = content.left;
        const maxLeft = content.right - maxWidthPx;
        const xLeft = clamp(Math.ceil(desiredLeft), Math.ceil(minLeft), Math.floor(maxLeft));
        textLine.position.x = xLeft;
      }

      // Hard guarantee check: line AABB must NOT overlap blocked rect.
      const lr = lineRect(textLine);
      if (overlapsRect(lr, blocked)) {
        // If we're in the image vertical band, jump below and retry; else move down.
        if (intersectsYBand(y, y + lhPx, blocked)) {
          y = Math.max(y, blocked.bottom);
        } else {
          y += lhPx;
        }
        return { nextIdx: idx, placed: false };
      }

      lines.push(textLine);
      y += lhPx; // one object per y line
      return { nextIdx: idx + consumed, placed: true };
    };

    // Headline block
    while (inHeadline && hIdx < headlineTokens.length) {
      const res = placeNextLine(headlineFont, o.headlineLineHeight, headlineTokens, hIdx, 'HEADLINE');
      if (!res.placed) break;
      hIdx = res.nextIdx;
    }

    // If headline couldn't fit above image at this font, try smaller headline (keep body fonts available)
    if (headlineHitImage) {
      continue;
    }

    // If headline incomplete, truncate last available line
    if (hIdx < headlineTokens.length) {
      truncated = true;
    } else {
      // Block gap before body
      y += o.blockGapPx;
      inHeadline = false;
    }

    // BODY lane preference:
    // If the image is creating a usable side lane (especially when the image is on the left),
    // start body at the image top so it wraps beside the image rather than shrinking to fit above it.
    if (!truncated && o.bodyPreferSideLane) {
      // Only makes sense if image overlaps the content area vertically at all
      const overlapsVertically = blocked.bottom > content.top && blocked.top < content.bottom;
      if (overlapsVertically) {
        const rightLaneWidth = content.right - blocked.right;
        const leftLaneWidth = blocked.left - content.left;
        const preferRight = rightLaneWidth >= leftLaneWidth;
        const preferredLaneWidth = preferRight ? rightLaneWidth : leftLaneWidth;

        if (preferredLaneWidth >= o.minUsableLaneWidthPx) {
          // Jump down to the image top so the first body line is forced into a side lane.
          // This is what creates the "Google Docs wrap" look like your reference.
          y = Math.max(y, blocked.top);
        }
      }
    }

    // Body block
    while (!truncated && bIdx < bodyTokens.length) {
      const res = placeNextLine(bodyFont, o.bodyLineHeight, bodyTokens, bIdx, 'BODY');
      if (!res.placed) break;
      bIdx = res.nextIdx;
    }
    if (bIdx < bodyTokens.length) truncated = true;

    // If truncated and we have at least one line, ensure last line ends with ellipsis and fits
    if (truncated && lines.length > 0) {
      const last = lines[lines.length - 1];
      const maxChars = Math.max(1, maxCharsForWidth(last.baseSize, last.maxWidth ?? 0));
      const base = last.text.replace(/…+$/g, '').trim();
      const trimmed = base.length >= maxChars ? base.slice(0, Math.max(1, maxChars - 1)).trimEnd() : base;
      const withEllipsis = trimmed.endsWith('…') ? trimmed : `${trimmed}…`;
      last.text = withEllipsis.replace(/…{2,}$/g, '…');
    }

    // If not truncated, great — return immediately
    if (!truncated) {
      assertNoOverlap(lines);
      bestLines = lines;
      bestTruncated = false;
      break;
    }

    // Keep best (least truncated) attempt so far (prefer more lines placed)
    if (lines.length > bestLines.length) {
      // Best effort still must be overlap-safe; if it fails, throw.
      assertNoOverlap(lines);
      bestLines = lines;
      bestTruncated = true;
    }

    // If we're already at mins and still truncated, stop
    if (headlineFont === minHeadline && bodyFont === minBody) {
      break;
    }
    }
    if (bestLines.length > 0 && !bestTruncated) break;
  }

  const layout: VisionLayoutDecision = {
    canvas: { width: 1080, height: 1440 } as any,
    textLines: bestLines,
    image: {
      x: image.x,
      y: image.y,
      width: image.width,
      height: image.height,
      url: '', // caller will preserve/replace
    },
    margins: { top: 60, right: 60, bottom: 60, left: 60 } as any,
  };

  return {
    layout,
    meta: { truncated: bestTruncated, usedFonts: { headline: headlineFont, body: bodyFont } },
  };
}


