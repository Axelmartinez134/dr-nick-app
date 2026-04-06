import { optimizeHtmlFonts } from "./fontOptimizer";

export type HtmlAspectRatio = "1:1" | "3:4" | "4:5" | "16:9";

export const HTML_SLIDE_DIMENSIONS: Record<HtmlAspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "3:4": { width: 1080, height: 1440 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1920, height: 1080 },
};

function stripUnsafeMarkup(html: string) {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/\son[a-z-]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(srcdoc|srcset)\s*=\s*(['"]).*?\2/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ` $1="#"`);
}

const processedHtmlCache = new Map<string, string>();

export function wrapHtmlDocument(args: {
  html: string;
  aspectRatio?: HtmlAspectRatio;
  interactive?: boolean;
  selectedEditableId?: string | null;
}) {
  const aspectRatio = args.aspectRatio || "3:4";
  const interactive = !!args.interactive;
  const selectedEditableId = String(args.selectedEditableId || "").trim();
  const cacheKey = `${aspectRatio}:${interactive ? "interactive" : "read"}:${selectedEditableId}:${String(args.html || "")}`;
  const cached = processedHtmlCache.get(cacheKey);
  if (cached) return cached;

  const { width, height } = HTML_SLIDE_DIMENSIONS[aspectRatio];
  const sanitizedHtml = stripUnsafeMarkup(args.html);
  const optimized = optimizeHtmlFonts(sanitizedHtml);
  const bodyMarkup = optimized.html
    .replace(/<!doctype[\s\S]*?>/gi, "")
    .replace(/<\/?(html|head|body)[^>]*>/gi, "")
    .trim();
  const fontLinks = optimized.fontUrls
    .map((url) => `<link rel="stylesheet" href="${url}">`)
    .join("");

  const interactionStyles = interactive
    ? `[data-editable-id]{cursor:pointer;transition:outline 0.15s ease, box-shadow 0.15s ease;}[data-editable-id]:hover{outline:2px dashed #94a3b8;outline-offset:2px;}`
    : "";
  const selectedStyle = selectedEditableId
    ? `[data-editable-id="${selectedEditableId.replace(/"/g, '\\"')}"]{outline:2px solid #8b5cf6 !important;outline-offset:2px !important;}`
    : "";
  const interactionScript = interactive
    ? `<script>(function(){document.addEventListener('click',function(event){var target=event.target instanceof Element?event.target.closest('[data-editable-id]'):null;if(!target)return;event.preventDefault();event.stopPropagation();window.parent.postMessage({type:'html-element-select',editableId:target.getAttribute('data-editable-id')||''},'*');},true);})();</script>`
    : "";

  const doc = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">',
    fontLinks,
    `<style>html,body{height:100%;margin:0;overflow:hidden;background:transparent;}*{box-sizing:border-box;}body{font-family:'Inter',sans-serif;}[data-scale-root]{width:${width}px;height:${height}px;overflow:hidden;position:relative;}${interactionStyles}${selectedStyle}</style>`,
    "</head>",
    "<body>",
    `<div data-scale-root="true">${bodyMarkup}</div>`,
    interactionScript,
    "</body>",
    "</html>",
  ].join("");

  processedHtmlCache.set(cacheKey, doc);
  if (processedHtmlCache.size > 60) {
    const firstKey = processedHtmlCache.keys().next().value;
    if (firstKey) processedHtmlCache.delete(firstKey);
  }
  return doc;
}
