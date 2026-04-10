import { optimizeHtmlFonts } from "./fontOptimizer";
import { buildHtmlIframeRuntimeScript } from "../runtime/buildIframeRuntime";

export type HtmlAspectRatio = "1:1" | "3:4" | "4:5" | "9:16" | "16:9";

export const HTML_SLIDE_DIMENSIONS: Record<HtmlAspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "3:4": { width: 1080, height: 1440 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
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

function extractHeadAssets(html: string) {
  const source = String(html || "");
  const styleTags = Array.from(source.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)).map((match) => match[0]);
  const stylesheetLinks = Array.from(
    source.matchAll(/<link\b[^>]*rel\s*=\s*(['"]?)stylesheet\1[^>]*>/gi)
  ).map((match) => match[0]);

  const htmlWithoutHeadAssets = source
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link\b[^>]*rel\s*=\s*(['"]?)stylesheet\1[^>]*>/gi, "");

  return {
    styleTags,
    stylesheetLinks,
    htmlWithoutHeadAssets,
  };
}

export function wrapHtmlDocument(args: {
  html: string;
  aspectRatio?: HtmlAspectRatio;
  interactive?: boolean;
  slideIndex?: number;
}) {
  const aspectRatio = args.aspectRatio || "3:4";
  const interactive = !!args.interactive;

  const { width, height } = HTML_SLIDE_DIMENSIONS[aspectRatio];
  const sanitizedHtml = stripUnsafeMarkup(args.html);
  const optimized = optimizeHtmlFonts(sanitizedHtml);
  const extracted = extractHeadAssets(optimized.html);
  const bodyMarkup = extracted.htmlWithoutHeadAssets
    .replace(/<!doctype[\s\S]*?>/gi, "")
    .replace(/<\/?(html|head|body)[^>]*>/gi, "")
    .trim();
  const fontLinks = optimized.fontUrls
    .map((url) => `<link rel="stylesheet" href="${url}">`)
    .join("");
  const preservedHeadAssets = [...extracted.stylesheetLinks, ...extracted.styleTags].join("");

  const baseStyles = `html,body{height:100%;margin:0;overflow:hidden;background:transparent;}*{box-sizing:border-box;}body{font-family:'Inter',sans-serif;}[data-scale-root]{width:${width}px;height:${height}px;overflow:hidden;position:relative;}`;
  const interactionStyles = interactive
    ? `[data-editable-id]{cursor:pointer;transition:outline 0.12s ease;}[data-editor-overlay]{pointer-events:none;}`
    : "";

  const doc = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">',
    fontLinks,
    preservedHeadAssets,
    `<style>${baseStyles}${interactionStyles}</style>`,
    "</head>",
    "<body>",
    `<div data-scale-root="true">${bodyMarkup}</div>`,
    interactive ? buildHtmlIframeRuntimeScript(args.slideIndex) : "",
    "</body>",
    "</html>",
  ].join("");

  return doc;
}
