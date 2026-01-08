import React, { useEffect, useMemo, useRef } from "react";

export type InlineStyleRange = {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

type Props = {
  valueText: string;
  valueRanges: InlineStyleRange[];
  onChange: (next: { text: string; ranges: InlineStyleRange[] }) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  minHeightPx?: number;
};

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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function renderHtmlFromTextAndRanges(text: string, ranges: InlineStyleRange[]) {
  // We rely on browser behavior:
  // - Enter -> new block (<div>)
  // - Shift+Enter -> <br>
  // We render paragraphs as <div> blocks split by "\n\n". Inside blocks, "\n" becomes <br>.
  const merged = mergeRanges(ranges);

  const paragraphs = text.split(/\n\n/);
  let globalOffset = 0;
  const blocksHtml = paragraphs.map((p) => {
    const paraStart = globalOffset;
    const paraText = p;
    const paraEnd = paraStart + paraText.length;

    // Build segments for this paragraph only (ranges are global indices in full text).
    const segs: Array<{ start: number; end: number; marks: { b: boolean; i: boolean; u: boolean } }> = [];
    const relevant = merged.filter((r) => r.end > paraStart && r.start < paraEnd);
    if (relevant.length === 0) {
      segs.push({ start: paraStart, end: paraEnd, marks: { b: false, i: false, u: false } });
    } else {
      // Sweep-line over boundaries within the paragraph.
      const cuts = new Set<number>([paraStart, paraEnd]);
      relevant.forEach((r) => {
        cuts.add(Math.max(paraStart, r.start));
        cuts.add(Math.min(paraEnd, r.end));
      });
      const points = Array.from(cuts).sort((a, b) => a - b);
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]!;
        const b = points[i + 1]!;
        const active = relevant.filter((r) => r.start <= a && r.end >= b);
        const marks = {
          b: active.some((r) => !!r.bold),
          i: active.some((r) => !!r.italic),
          u: active.some((r) => !!r.underline),
        };
        segs.push({ start: a, end: b, marks });
      }
    }

    const html = segs
      .map((s) => {
        const slice = text.slice(s.start, s.end);
        const parts = escapeHtml(slice).split("\n").join("<br/>");
        let inner = parts;
        if (s.marks.u) inner = `<u>${inner}</u>`;
        if (s.marks.i) inner = `<em>${inner}</em>`;
        if (s.marks.b) inner = `<strong>${inner}</strong>`;
        return inner;
      })
      .join("");

    // Ensure empty paragraph is still selectable/clickable
    const safe = html.length ? html : "<br/>";

    globalOffset += paraText.length + 2; // account for "\n\n" between paragraphs
    return `<div data-rte-paragraph="1">${safe}</div>`;
  });

  return blocksHtml.join("");
}

function paragraphRootForNode(root: HTMLElement, node: Node | null) {
  if (!node) return null;
  let cur: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (cur && cur !== root) {
    const el = cur as HTMLElement;
    if (el?.getAttribute?.("data-rte-paragraph") === "1") return el;
    // Also treat any DIRECT child block of the root as a paragraph (browser may create <div>/<p> on Enter).
    if (el?.parentElement === root) return el;
    cur = cur.parentNode;
  }
  return null;
}

function parseDomToTextAndRanges(root: HTMLElement): { text: string; ranges: InlineStyleRange[] } {
  const paragraphs: Array<{ text: string; ranges: InlineStyleRange[] }> = [];
  // Prefer our explicit paragraph wrappers, but also support browser-created blocks on Enter.
  const wrapped = Array.from(root.querySelectorAll<HTMLElement>('[data-rte-paragraph="1"]'));
  const directBlocks = Array.from(root.children).filter((c) => (c as HTMLElement).tagName) as HTMLElement[];
  const effectiveParas =
    wrapped.length
      ? wrapped
      : directBlocks.length
        ? directBlocks
        : [root];

  for (const el of effectiveParas) {
    const ranges: InlineStyleRange[] = [];
    let idx = 0;
    let globalBase = 0; // applied later

    const walk = (node: Node, marks: { b: boolean; i: boolean; u: boolean }) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName.toLowerCase();
        const nextMarks = {
          b: marks.b || tag === "b" || tag === "strong",
          i: marks.i || tag === "i" || tag === "em",
          u: marks.u || tag === "u",
        };
        if (tag === "br") {
          idx += 1; // newline char
          return;
        }
        node.childNodes.forEach((c) => walk(c, nextMarks));
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.nodeValue || "";
        const start = idx;
        idx += t.length;
        const end = idx;
        if (t.length && (marks.b || marks.i || marks.u)) {
          ranges.push({
            start,
            end,
            bold: marks.b || undefined,
            italic: marks.i || undefined,
            underline: marks.u || undefined,
          });
        }
        return;
      }
    };

    walk(el, { b: false, i: false, u: false });

    // Build text: we can use innerText, but it collapses some whitespace. Instead, build from DOM:
    // We'll rebuild by walking again and capturing text + "\n" on <br>.
    let out = "";
    const walkText = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName.toLowerCase();
        if (tag === "br") {
          out += "\n";
          return;
        }
        node.childNodes.forEach(walkText);
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.nodeValue || "";
      }
    };
    walkText(el);

    paragraphs.push({ text: out, ranges: mergeRanges(ranges) });
  }

  // Combine paragraphs with "\n\n" and shift ranges by offsets
  let combined = "";
  const outRanges: InlineStyleRange[] = [];
  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p]!;
    const base = combined.length;
    combined += para.text;
    for (const r of para.ranges) {
      outRanges.push({ ...r, start: r.start + base, end: r.end + base });
    }
    if (p !== paragraphs.length - 1) combined += "\n\n";
  }

  return { text: combined, ranges: mergeRanges(outRanges) };
}

export function RichTextInput(props: Props) {
  const { valueText, valueRanges, onChange, disabled, placeholder, className, minHeightPx } = props;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isFocusedRef = useRef(false);
  const lastCommittedRef = useRef<{ text: string; rangesKey: string } | null>(null);

  const rangesKey = useMemo(() => JSON.stringify(mergeRanges(valueRanges)), [valueRanges]);
  const html = useMemo(() => renderHtmlFromTextAndRanges(valueText, valueRanges), [valueText, rangesKey]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const last = lastCommittedRef.current;
    // Avoid clobbering selection while the user is actively typing.
    if (isFocusedRef.current && last && last.text === valueText && last.rangesKey === rangesKey) return;
    el.innerHTML = html || `<div data-rte-paragraph="1"><br/></div>`;
    lastCommittedRef.current = { text: valueText, rangesKey };
  }, [html, valueText, rangesKey]);

  return (
    <div
      ref={rootRef}
      className={className}
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-rte-root="1"
      style={{
        minHeight: minHeightPx ? `${minHeightPx}px` : undefined,
        outline: "none",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        const el = rootRef.current;
        if (!el) return;
        const parsed = parseDomToTextAndRanges(el);
        onChange(parsed);
        lastCommittedRef.current = { text: parsed.text, rangesKey: JSON.stringify(parsed.ranges) };
      }}
      onInput={() => {
        const el = rootRef.current;
        if (!el) return;
        const parsed = parseDomToTextAndRanges(el);
        onChange(parsed);
        lastCommittedRef.current = { text: parsed.text, rangesKey: JSON.stringify(parsed.ranges) };
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        const isMeta = e.metaKey || e.ctrlKey;
        const key = e.key.toLowerCase();
        if (!isMeta || (key !== "b" && key !== "i" && key !== "u")) return;

        const el = rootRef.current;
        if (!el) return;
        const sel = window.getSelection();
        if (!sel) return;

        // Enforce "only apply within current paragraph block"
        const a = paragraphRootForNode(el, sel.anchorNode);
        const f = paragraphRootForNode(el, sel.focusNode);
        if (a && f && a !== f) {
          e.preventDefault();
          return;
        }

        e.preventDefault();
        // Rely on browser execCommand for visual editing. We'll parse DOM back into ranges.
        if (key === "b") document.execCommand("bold");
        if (key === "i") document.execCommand("italic");
        if (key === "u") document.execCommand("underline");
      }}
      aria-label={placeholder}
      data-placeholder={placeholder || ""}
    />
  );
}

