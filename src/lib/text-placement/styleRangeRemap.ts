export type InlineStyleRange = {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

type DiffOp = -1 | 0 | 1; // delete, equal, insert

import diff from 'fast-diff';

function sameMarks(a: InlineStyleRange, b: InlineStyleRange) {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.underline === !!b.underline;
}

function mergeRanges(ranges: InlineStyleRange[]) {
  const sorted = [...ranges]
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: InlineStyleRange[] = [];
  for (const r of sorted) {
    const prev = out[out.length - 1];
    if (prev && sameMarks(prev, r) && r.start <= prev.end) {
      prev.end = Math.max(prev.end, r.end);
      continue;
    }
    out.push({ ...r });
  }
  return out;
}

// Best-effort remap of style ranges from oldText -> newText.
// We preserve ranges that fall entirely in the common prefix/suffix and drop/clip styles in the edited middle.
// This is intentionally conservative to avoid incorrect styling.
export function remapRangesByCommonPrefixSuffix(params: {
  oldText: string;
  newText: string;
  ranges: InlineStyleRange[];
}): InlineStyleRange[] {
  const oldText = String(params.oldText || '');
  const newText = String(params.newText || '');
  const ranges = Array.isArray(params.ranges) ? params.ranges : [];

  if (!ranges.length) return [];
  if (oldText === newText) return mergeRanges(ranges);

  const oldLen = oldText.length;
  const newLen = newText.length;

  // Common prefix
  let p = 0;
  const pMax = Math.min(oldLen, newLen);
  while (p < pMax && oldText[p] === newText[p]) p++;

  // Common suffix (excluding prefix region)
  let s = 0;
  const sMax = Math.min(oldLen - p, newLen - p);
  while (s < sMax && oldText[oldLen - 1 - s] === newText[newLen - 1 - s]) s++;

  const oldSuffixStart = oldLen - s;
  const newSuffixStart = newLen - s;
  const delta = newLen - oldLen;

  const out: InlineStyleRange[] = [];

  for (const r of ranges) {
    const start = Math.max(0, Math.min(oldLen, Math.floor(r.start)));
    const end = Math.max(0, Math.min(oldLen, Math.floor(r.end)));
    if (end <= start) continue;

    // Prefix-only segment
    if (start < p) {
      const pe = Math.min(end, p);
      if (pe > start) out.push({ ...r, start, end: pe });
    }

    // Suffix-only segment (shift by delta)
    if (end > oldSuffixStart) {
      const ss = Math.max(start, oldSuffixStart);
      const se = end;
      const ns = ss + delta;
      const ne = se + delta;
      // Clamp to new text
      const cs = Math.max(0, Math.min(newLen, ns));
      const ce = Math.max(0, Math.min(newLen, ne));
      if (ce > cs) out.push({ ...r, start: cs, end: ce });
    }

    // Anything in the middle edited region is dropped (conservative).
  }

  return mergeRanges(out);
}

// Stronger remap: uses a diff to map old indices -> new indices.
// Policy: inserted chars inherit style if they are inserted inside a styled range
// (implemented by mapping start with LOW bias and end with HIGH bias at boundaries).
export function remapRangesByDiff(params: {
  oldText: string;
  newText: string;
  ranges: InlineStyleRange[];
}): InlineStyleRange[] {
  const oldText = String(params.oldText || '');
  const newText = String(params.newText || '');
  const ranges = Array.isArray(params.ranges) ? params.ranges : [];

  if (!ranges.length) return [];
  if (oldText === newText) return mergeRanges(ranges);

  const ops = (diff(oldText, newText) as Array<[DiffOp, string]>) || [];
  const oldLen = oldText.length;
  const newLen = newText.length;

  // Boundary maps: for every boundary between characters in old text (0..oldLen),
  // we compute a corresponding boundary in new text.
  // - lowBias: before inserts at that boundary
  // - highBias: after inserts at that boundary
  const low = new Array<number>(oldLen + 1);
  const high = new Array<number>(oldLen + 1);

  let o = 0;
  let n = 0;
  low[0] = 0;
  high[0] = 0;

  for (const [op, text] of ops) {
    const len = text.length;
    if (!len) continue;

    if (op === 0) {
      // equal: advance both, boundaries map 1:1
      for (let i = 1; i <= len; i++) {
        if (o + i <= oldLen) {
          low[o + i] = n + i;
          high[o + i] = n + i;
        }
      }
      o += len;
      n += len;
      continue;
    }

    if (op === -1) {
      // delete: old advances, new stays; all boundaries within deleted run map to current new boundary
      for (let i = 1; i <= len; i++) {
        if (o + i <= oldLen) {
          low[o + i] = n;
          high[o + i] = n;
        }
      }
      o += len;
      continue;
    }

    if (op === 1) {
      // insert: new advances, old stays; affects the boundary at `o`
      if (typeof low[o] !== 'number') low[o] = n;
      if (typeof high[o] !== 'number') high[o] = n;
      high[o] = (high[o] as number) + len; // after inserts
      n += len;
      continue;
    }
  }

  // Fill any unset boundaries (should be rare) with best-effort monotonic values.
  // Ensure low/high are non-decreasing.
  let lastLow = 0;
  let lastHigh = 0;
  for (let i = 0; i <= oldLen; i++) {
    if (typeof low[i] !== 'number') low[i] = lastLow;
    if (typeof high[i] !== 'number') high[i] = lastHigh;
    lastLow = low[i]!;
    lastHigh = Math.max(high[i]!, lastHigh);
    high[i] = lastHigh;
  }

  const out: InlineStyleRange[] = [];
  for (const r of ranges) {
    const s0 = Math.max(0, Math.min(oldLen, Math.floor(r.start)));
    const e0 = Math.max(0, Math.min(oldLen, Math.floor(r.end)));
    if (e0 <= s0) continue;

    // LOW bias for start (before inserts), HIGH bias for end (after inserts)
    const s1 = Math.max(0, Math.min(newLen, low[s0]!));
    const e1 = Math.max(0, Math.min(newLen, high[e0]!));
    if (e1 <= s1) continue;

    out.push({ ...r, start: s1, end: e1 });
  }

  return mergeRanges(out);
}

