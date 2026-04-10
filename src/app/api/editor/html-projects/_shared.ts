import "server-only";

import { HTML_SLIDE_DIMENSIONS, type HtmlAspectRatio } from "@/features/html-editor/lib/htmlDocumentWrapper";

export function sanitizeText(input: string) {
  return String(input || "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ").trim();
}

function extractFirstBalancedJsonObject(text: string): string {
  const raw = String(text || "");
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i] || "";
    if (start === -1) {
      if (ch === "{") {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  throw new Error("Model did not return valid JSON");
}

export function extractJsonObject(text: string) {
  const trimmed = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return JSON.parse(extractFirstBalancedJsonObject(trimmed));
  }
}

export function sanitizeHtmlForAspectRatio(args: { html: string; aspectRatio: HtmlAspectRatio }) {
  const { width, height } = HTML_SLIDE_DIMENSIONS[args.aspectRatio];
  let html = String(args.html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z-]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(srcdoc|srcset)\s*=\s*(['"]).*?\2/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ` $1="#"`)
    .trim();

  const dimensionRegex = new RegExp(`width\\s*:\\s*${width}px`, "i");
  const heightRegex = new RegExp(`height\\s*:\\s*${height}px`, "i");
  const overflowRegex = /overflow\s*:\s*hidden/i;
  if (!dimensionRegex.test(html) || !heightRegex.test(html) || !overflowRegex.test(html)) {
    html = `<div style="width:${width}px;height:${height}px;overflow:hidden;position:relative;">${html}</div>`;
  }

  const hasSlot = /class=["'][^"']*image-slot/i.test(html);
  return {
    valid: true,
    normalizedHtml: html,
    errors: [] as string[],
    needsImage: hasSlot,
  };
}

export function buildRefinementPrompt(args: {
  html: string;
  prompt: string;
  aspectRatio: HtmlAspectRatio;
  manualEdits: string;
}) {
  const { width, height } = HTML_SLIDE_DIMENSIONS[args.aspectRatio];
  return [
    "You refine a single Instagram carousel slide HTML document.",
    'Return ONLY valid JSON in this exact shape: {"page":{"html":"<div ...>...</div>"}}',
    "Rules:",
    `- The slide root must remain exactly ${width}px by ${height}px with overflow:hidden.`,
    "- Return exactly one page.",
    "- Preserve inline layout-critical styles unless the user instruction requires changing them.",
    "- Preserve any [data-editor-overlay-root] subtree and all of its children exactly.",
    "- Do not remove user-added overlay text, image slots, or logo slots.",
    "- No JavaScript, no script tags, no event handlers, no animations.",
    "- Keep editable text in semantic text elements.",
    "",
    "USER INSTRUCTION:",
    args.prompt,
    "",
    args.manualEdits
      ? ["MANUAL EDITS TO PRESERVE:", args.manualEdits, ""].join("\n")
      : "",
    "CURRENT SLIDE HTML:",
    args.html,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function callAnthropicRefinePage(args: {
  html: string;
  prompt: string;
  aspectRatio: HtmlAspectRatio;
  manualEdits: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing env var: ANTHROPIC_API_KEY");
  const prompt = buildRefinementPrompt(args);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 8192,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json)?.slice(0, 400) || "Unknown Anthropic error";
    throw new Error(msg);
  }

  const text = String(json?.content?.[0]?.text || "");
  const payload = extractJsonObject(text);
  const html = String(payload?.page?.html || "");
  if (!html.trim()) {
    throw new Error("Refinement did not return page html");
  }
  return html;
}

function locateOverlayRootRange(html: string) {
  const startMatch = /<div\b[^>]*data-editor-overlay-root=(['"])true\1[^>]*>/i.exec(html);
  if (!startMatch || typeof startMatch.index !== "number") return null;
  const startIndex = startMatch.index;
  let cursor = startIndex + startMatch[0].length;
  let depth = 1;

  while (cursor < html.length) {
    const nextOpen = html.slice(cursor).search(/<div\b/i);
    const nextClose = html.slice(cursor).search(/<\/div>/i);
    if (nextClose === -1) return null;

    const openIndex = nextOpen === -1 ? -1 : cursor + nextOpen;
    const closeIndex = cursor + nextClose;

    if (openIndex !== -1 && openIndex < closeIndex) {
      depth += 1;
      cursor = openIndex + 4;
      continue;
    }

    depth -= 1;
    cursor = closeIndex + "</div>".length;
    if (depth === 0) {
      return {
        start: startIndex,
        end: cursor,
      };
    }
  }

  return null;
}

export function extractOverlayRootHtml(html: string) {
  const range = locateOverlayRootRange(String(html || ""));
  if (!range) return "";
  return String(html || "").slice(range.start, range.end);
}

export function hasOverlayRoot(html: string) {
  return /data-editor-overlay-root=(['"])true\1/i.test(String(html || ""));
}

export function reinsertOverlayRoot(args: { previousHtml: string; nextHtml: string }) {
  const nextHtml = String(args.nextHtml || "");
  if (hasOverlayRoot(nextHtml)) return nextHtml;
  const overlayHtml = extractOverlayRootHtml(String(args.previousHtml || ""));
  if (!overlayHtml) return nextHtml;

  const lastClosingDiv = nextHtml.toLowerCase().lastIndexOf("</div>");
  if (lastClosingDiv === -1) {
    return `${nextHtml}${overlayHtml}`;
  }

  return `${nextHtml.slice(0, lastClosingDiv)}${overlayHtml}${nextHtml.slice(lastClosingDiv)}`;
}
