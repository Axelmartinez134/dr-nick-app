"use client";

import type { HtmlElementPatch } from "../models/htmlElementModel";

export type { HtmlElementPatch } from "../models/htmlElementModel";

export const HTML_EDITOR_OVERLAY_ROOT_ATTR = "data-editor-overlay-root";
const EDITOR_SELECTABLE_ATTR = "data-editor-selectable";
const EDITOR_TRANSFORMABLE_ATTR = "data-editor-transformable";
const EDITOR_LISTABLE_ATTR = "data-editor-listable";
const EDITOR_ORIGINAL_TRANSLATE_X_ATTR = "data-editor-original-translate-x";
const EDITOR_ORIGINAL_TRANSLATE_Y_ATTR = "data-editor-original-translate-y";
const EDITOR_ORIGINAL_WIDTH_ATTR = "data-editor-original-width";
const EDITOR_ORIGINAL_HEIGHT_ATTR = "data-editor-original-height";
const EDITOR_ORIGINAL_ROTATE_ATTR = "data-editor-original-rotate";
const EDITOR_ORIGINAL_FONT_FAMILY_ATTR = "data-editor-original-font-family";
const EDITOR_ORIGINAL_FONT_SIZE_ATTR = "data-editor-original-font-size";
const EDITOR_ORIGINAL_COLOR_ATTR = "data-editor-original-color";
const EDITOR_ORIGINAL_BG_COLOR_ATTR = "data-editor-original-background-color";
const EDITOR_ORIGINAL_FONT_STYLE_ATTR = "data-editor-original-font-style";
const EDITOR_ORIGINAL_TEXT_DECORATION_ATTR = "data-editor-original-text-decoration";
const EDITOR_ORIGINAL_LETTER_SPACING_ATTR = "data-editor-original-letter-spacing";
const EDITOR_ORIGINAL_LINE_HEIGHT_ATTR = "data-editor-original-line-height";
const EDITOR_ORIGINAL_TEXT_ALIGN_ATTR = "data-editor-original-text-align";
const EDITOR_ORIGINAL_MARGIN_TOP_ATTR = "data-editor-original-margin-top";
const EDITOR_ORIGINAL_MARGIN_RIGHT_ATTR = "data-editor-original-margin-right";
const EDITOR_ORIGINAL_MARGIN_BOTTOM_ATTR = "data-editor-original-margin-bottom";
const EDITOR_ORIGINAL_MARGIN_LEFT_ATTR = "data-editor-original-margin-left";

const HTML_EDITOR_OVERLAY_ROOT_STYLE =
  "position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2147483000;";

export type AddElementKind = "text" | "image-slot" | "logo-slot";
export type AddElementResult = {
  html: string;
  editableId: string;
};

function parseHtmlDocument(html: string) {
  const parser = new DOMParser();
  return parser.parseFromString(String(html || ""), "text/html");
}

function hasFullDocumentMarkup(html: string) {
  return /<!doctype\b|<html\b|<head\b|<body\b/i.test(String(html || ""));
}

function serializeHtmlDocument(doc: Document, sourceHtml: string) {
  if (!hasFullDocumentMarkup(sourceHtml)) {
    return doc.body.innerHTML;
  }
  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
}

function buildEditableSelector(elementId: string) {
  return `[data-editable-id="${CSS.escape(String(elementId || ""))}"]`;
}

function extractTransformParts(transform: string) {
  const current = String(transform || "");
  const translateMatch = current.match(/translate\(\s*([^,]+),\s*([^)]+)\)/i);
  const rotateMatch = current.match(/rotate\(\s*([^)]+)\)/i);

  return {
    translateX: String(translateMatch?.[1] || "").trim(),
    translateY: String(translateMatch?.[2] || "").trim(),
    rotate: String(rotateMatch?.[1] || "").trim(),
  };
}

function applyTransformPatch(node: HTMLElement, patch: HtmlElementPatch) {
  const current = extractTransformParts(node.style.transform || "");
  const translateX = typeof patch.translateX === "string" ? patch.translateX : current.translateX;
  const translateY = typeof patch.translateY === "string" ? patch.translateY : current.translateY;
  const rotate = typeof patch.rotate === "string" ? patch.rotate : current.rotate;

  const parts: string[] = [];
  if (translateX || translateY) {
    parts.push(`translate(${translateX || "0px"}, ${translateY || "0px"})`);
  }
  if (rotate) {
    parts.push(`rotate(${rotate})`);
  }

  node.style.transform = parts.join(" ").trim();
  if (!node.style.transform) {
    node.style.removeProperty("transform");
  }
  if (
    node.tagName.toLowerCase() === "span" &&
    (translateX || translateY || rotate || String(node.style.width || "").trim() || String(node.style.height || "").trim())
  ) {
    node.style.display = "inline-block";
  }
}

function applyPatchToNode(node: HTMLElement, patch: HtmlElementPatch) {
  if (typeof patch.html === "string") {
    node.innerHTML = patch.html;
  } else if (typeof patch.text === "string") {
    node.textContent = patch.text;
  }
  if (typeof patch.color === "string") node.style.color = patch.color;
  if (typeof patch.backgroundColor === "string") node.style.backgroundColor = patch.backgroundColor;
  if (typeof patch.fontSize === "string") node.style.fontSize = patch.fontSize;
  if (typeof patch.fontFamily === "string") node.style.fontFamily = patch.fontFamily;
  if (typeof patch.fontWeight === "string") node.style.fontWeight = patch.fontWeight;
  if (typeof patch.fontStyle === "string") node.style.fontStyle = patch.fontStyle;
  if (typeof patch.textDecoration === "string") node.style.textDecoration = patch.textDecoration;
  if (typeof patch.letterSpacing === "string") node.style.letterSpacing = patch.letterSpacing;
  if (typeof patch.lineHeight === "string") node.style.lineHeight = patch.lineHeight;
  if (typeof patch.textAlign === "string") node.style.textAlign = patch.textAlign;
  if (typeof patch.textTransform === "string") node.style.textTransform = patch.textTransform;
  if (typeof patch.marginTop === "string") node.style.marginTop = patch.marginTop;
  if (typeof patch.marginRight === "string") node.style.marginRight = patch.marginRight;
  if (typeof patch.marginBottom === "string") node.style.marginBottom = patch.marginBottom;
  if (typeof patch.marginLeft === "string") node.style.marginLeft = patch.marginLeft;
  if (typeof patch.borderRadius === "string") node.style.borderRadius = patch.borderRadius;
  if (typeof patch.opacity === "string") node.style.opacity = patch.opacity;
  if (typeof patch.border === "string") node.style.border = patch.border;
  if (typeof patch.backgroundImage === "string") node.style.backgroundImage = patch.backgroundImage;
  if (typeof patch.backgroundSize === "string") node.style.backgroundSize = patch.backgroundSize;
  if (typeof patch.backgroundPosition === "string") node.style.backgroundPosition = patch.backgroundPosition;
  if (typeof patch.objectFit === "string") node.style.objectFit = patch.objectFit;
  if (typeof patch.src === "string" && node.tagName.toLowerCase() === "img") {
    node.setAttribute("src", patch.src);
  }
  if (typeof patch.searchQuery === "string") {
    node.setAttribute("data-search-query", patch.searchQuery);
  }
  if (typeof patch.width === "string") node.style.width = patch.width;
  if (typeof patch.height === "string") node.style.height = patch.height;
  if (
    typeof patch.translateX === "string" ||
    typeof patch.translateY === "string" ||
    typeof patch.rotate === "string"
  ) {
    applyTransformPatch(node, patch);
  }
  if (typeof patch.deleted === "boolean") {
    if (patch.deleted) {
      node.setAttribute("data-html-deleted", "true");
      node.style.display = "none";
    } else {
      node.removeAttribute("data-html-deleted");
      if (node.style.display === "none") node.style.display = "";
    }
  }
  if (typeof patch.selectable === "boolean") {
    node.setAttribute(EDITOR_SELECTABLE_ATTR, String(patch.selectable));
  }
  if (typeof patch.transformable === "boolean") {
    node.setAttribute(EDITOR_TRANSFORMABLE_ATTR, String(patch.transformable));
  }
  if (typeof patch.listable === "boolean") {
    node.setAttribute(EDITOR_LISTABLE_ATTR, String(patch.listable));
  }
  if (typeof patch.originalTranslateX === "string") {
    node.setAttribute(EDITOR_ORIGINAL_TRANSLATE_X_ATTR, patch.originalTranslateX);
  }
  if (typeof patch.originalTranslateY === "string") {
    node.setAttribute(EDITOR_ORIGINAL_TRANSLATE_Y_ATTR, patch.originalTranslateY);
  }
  if (typeof patch.originalWidth === "string") {
    node.setAttribute(EDITOR_ORIGINAL_WIDTH_ATTR, patch.originalWidth);
  }
  if (typeof patch.originalHeight === "string") {
    node.setAttribute(EDITOR_ORIGINAL_HEIGHT_ATTR, patch.originalHeight);
  }
  if (typeof patch.originalRotate === "string") {
    node.setAttribute(EDITOR_ORIGINAL_ROTATE_ATTR, patch.originalRotate);
  }
  if (typeof patch.originalFontFamily === "string") {
    node.setAttribute(EDITOR_ORIGINAL_FONT_FAMILY_ATTR, patch.originalFontFamily);
  }
  if (typeof patch.originalFontSize === "string") {
    node.setAttribute(EDITOR_ORIGINAL_FONT_SIZE_ATTR, patch.originalFontSize);
  }
  if (typeof patch.originalColor === "string") {
    node.setAttribute(EDITOR_ORIGINAL_COLOR_ATTR, patch.originalColor);
  }
  if (typeof patch.originalBackgroundColor === "string") {
    node.setAttribute(EDITOR_ORIGINAL_BG_COLOR_ATTR, patch.originalBackgroundColor);
  }
  if (typeof patch.originalFontStyle === "string") {
    node.setAttribute(EDITOR_ORIGINAL_FONT_STYLE_ATTR, patch.originalFontStyle);
  }
  if (typeof patch.originalTextDecoration === "string") {
    node.setAttribute(EDITOR_ORIGINAL_TEXT_DECORATION_ATTR, patch.originalTextDecoration);
  }
  if (typeof patch.originalLetterSpacing === "string") {
    node.setAttribute(EDITOR_ORIGINAL_LETTER_SPACING_ATTR, patch.originalLetterSpacing);
  }
  if (typeof patch.originalLineHeight === "string") {
    node.setAttribute(EDITOR_ORIGINAL_LINE_HEIGHT_ATTR, patch.originalLineHeight);
  }
  if (typeof patch.originalTextAlign === "string") {
    node.setAttribute(EDITOR_ORIGINAL_TEXT_ALIGN_ATTR, patch.originalTextAlign);
  }
  if (typeof patch.originalMarginTop === "string") {
    node.setAttribute(EDITOR_ORIGINAL_MARGIN_TOP_ATTR, patch.originalMarginTop);
  }
  if (typeof patch.originalMarginRight === "string") {
    node.setAttribute(EDITOR_ORIGINAL_MARGIN_RIGHT_ATTR, patch.originalMarginRight);
  }
  if (typeof patch.originalMarginBottom === "string") {
    node.setAttribute(EDITOR_ORIGINAL_MARGIN_BOTTOM_ATTR, patch.originalMarginBottom);
  }
  if (typeof patch.originalMarginLeft === "string") {
    node.setAttribute(EDITOR_ORIGINAL_MARGIN_LEFT_ATTR, patch.originalMarginLeft);
  }
}

function nextGeneratedId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getPrimarySlideRoot(doc: Document) {
  const root = doc.body.firstElementChild;
  return root instanceof HTMLElement ? root : doc.body;
}

function ensureOverlayRootElement(doc: Document) {
  const existing = doc.body.querySelector(`[${HTML_EDITOR_OVERLAY_ROOT_ATTR}="true"]`);
  if (existing instanceof HTMLElement) return existing;

  const root = getPrimarySlideRoot(doc);
  const overlay = doc.createElement("div");
  overlay.setAttribute(HTML_EDITOR_OVERLAY_ROOT_ATTR, "true");
  overlay.setAttribute("style", HTML_EDITOR_OVERLAY_ROOT_STYLE);
  root.appendChild(overlay);
  return overlay;
}

function createDefaultElementMarkup(kind: AddElementKind) {
  const editableId =
    kind === "text" ? nextGeneratedId("text") : kind === "logo-slot" ? nextGeneratedId("logo") : nextGeneratedId("slot");
  const slotId = kind === "logo-slot" ? nextGeneratedId("slot-logo") : nextGeneratedId("slot-main");

  if (kind === "text") {
    return {
      editableId,
      markup: `<span data-editable-id="${editableId}" ${EDITOR_SELECTABLE_ATTR}="true" ${EDITOR_TRANSFORMABLE_ATTR}="true" ${EDITOR_LISTABLE_ATTR}="true" ${EDITOR_ORIGINAL_TRANSLATE_X_ATTR}="-50%" ${EDITOR_ORIGINAL_TRANSLATE_Y_ATTR}="-50%" ${EDITOR_ORIGINAL_WIDTH_ATTR}="" ${EDITOR_ORIGINAL_HEIGHT_ATTR}="" ${EDITOR_ORIGINAL_ROTATE_ATTR}="" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 32px; font-weight: 600; color: #1a1a1a; text-align: center; white-space: nowrap; z-index: 10; cursor: pointer; pointer-events: auto;">New Text</span>`,
    };
  }

  if (kind === "logo-slot") {
    return {
      editableId,
      markup: `<div class="image-slot" data-editable-id="${editableId}" ${EDITOR_SELECTABLE_ATTR}="true" ${EDITOR_TRANSFORMABLE_ATTR}="true" ${EDITOR_LISTABLE_ATTR}="true" ${EDITOR_ORIGINAL_TRANSLATE_X_ATTR}="" ${EDITOR_ORIGINAL_TRANSLATE_Y_ATTR}="" ${EDITOR_ORIGINAL_WIDTH_ATTR}="120px" ${EDITOR_ORIGINAL_HEIGHT_ATTR}="60px" ${EDITOR_ORIGINAL_ROTATE_ATTR}="" data-slot-id="${slotId}" data-slot-type="logo" data-slot-label="Logo" style="position: absolute; left: 20px; top: 20px; width: 120px; height: 60px; background-size: contain; background-repeat: no-repeat; background-position: center; background-image: url('https://placehold.co/120x60/e2e8f0/94a3b8?text=Logo'); z-index: 10; pointer-events: auto;"></div>`,
    };
  }

  return {
    editableId,
    markup: `<div class="image-slot" data-editable-id="${editableId}" ${EDITOR_SELECTABLE_ATTR}="true" ${EDITOR_TRANSFORMABLE_ATTR}="true" ${EDITOR_LISTABLE_ATTR}="true" ${EDITOR_ORIGINAL_TRANSLATE_X_ATTR}="-50%" ${EDITOR_ORIGINAL_TRANSLATE_Y_ATTR}="-50%" ${EDITOR_ORIGINAL_WIDTH_ATTR}="300px" ${EDITOR_ORIGINAL_HEIGHT_ATTR}="200px" ${EDITOR_ORIGINAL_ROTATE_ATTR}="" data-slot-id="${slotId}" data-slot-type="main" data-slot-label="Image" data-search-query="abstract texture background" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 300px; height: 200px; background-image: url('https://placehold.co/300x200/e2e8f0/94a3b8?text=Image'); background-size: cover; background-position: center; border-radius: 8px; z-index: 10; pointer-events: auto;"></div>`,
  };
}

export function applyElementPatchToHtml(html: string, elementId: string, patch: HtmlElementPatch) {
  if (typeof window === "undefined") return String(html || "");
  const doc = parseHtmlDocument(html);
  const node = doc.body.querySelector(buildEditableSelector(elementId)) as HTMLElement | null;
  if (!node) return String(html || "");
  applyPatchToNode(node, patch);

  return serializeHtmlDocument(doc, html);
}

export function renderHtmlFromElementPatches(
  html: string,
  patches: Array<{
    id: string;
    patch: HtmlElementPatch;
  }>
) {
  if (typeof window === "undefined") return String(html || "");
  const doc = parseHtmlDocument(html);
  for (const entry of patches) {
    const node = doc.body.querySelector(buildEditableSelector(entry.id)) as HTMLElement | null;
    if (!node) continue;
    applyPatchToNode(node, entry.patch);
  }
  return serializeHtmlDocument(doc, html);
}

export function ensureOverlayRoot(html: string) {
  if (typeof window === "undefined") return String(html || "");
  const doc = parseHtmlDocument(html);
  ensureOverlayRootElement(doc);
  return serializeHtmlDocument(doc, html);
}

export function addElementToHtml(html: string, kind: AddElementKind): AddElementResult {
  if (typeof window === "undefined") return { html: String(html || ""), editableId: "" };
  const doc = parseHtmlDocument(html);
  const overlayRoot = ensureOverlayRootElement(doc);
  const created = createDefaultElementMarkup(kind);
  const wrapper = doc.createElement("div");
  wrapper.innerHTML = created.markup;
  const element = wrapper.firstElementChild;
  if (element) overlayRoot.appendChild(element);
  return {
    html: serializeHtmlDocument(doc, html),
    editableId: created.editableId,
  };
}

function offsetDuplicatedElement(node: HTMLElement) {
  const style = node.style;
  if (String(style.left || "").trim()) {
    style.left = `calc(${String(style.left).trim()} + 24px)`;
  }
  if (String(style.top || "").trim()) {
    style.top = `calc(${String(style.top).trim()} + 24px)`;
  }

  if (String(style.left || "").trim() || String(style.top || "").trim()) {
    return;
  }

  const transform = String(style.transform || "").trim();
  const translateMatch = transform.match(/translate\(\s*([-\d.]+)px,\s*([-\d.]+)px\)/i);
  if (!translateMatch) return;
  const nextX = (parseFloat(translateMatch[1]) || 0) + 24;
  const nextY = (parseFloat(translateMatch[2]) || 0) + 24;
  style.transform = transform.replace(
    /translate\(\s*([-\d.]+)px,\s*([-\d.]+)px\)/i,
    `translate(${nextX}px, ${nextY}px)`
  );
}

export function duplicateElementInHtml(html: string, elementId: string): AddElementResult {
  if (typeof window === "undefined") return { html: String(html || ""), editableId: "" };
  const doc = parseHtmlDocument(html);
  const original = doc.body.querySelector(buildEditableSelector(elementId)) as HTMLElement | null;
  if (!original || !original.parentNode) return { html: String(html || ""), editableId: "" };

  const clone = original.cloneNode(true) as HTMLElement;
  const cloneEditableId = nextGeneratedId("dup");
  clone.setAttribute("data-editable-id", cloneEditableId);
  clone.querySelectorAll("[data-editable-id]").forEach((node) => {
    const el = node as HTMLElement;
    el.setAttribute("data-editable-id", nextGeneratedId("dup"));
  });
  clone.querySelectorAll("[data-slot-id]").forEach((node) => {
    const el = node as HTMLElement;
    el.setAttribute("data-slot-id", nextGeneratedId("slot"));
  });
  if (clone.hasAttribute("data-slot-id")) {
    clone.setAttribute("data-slot-id", nextGeneratedId("slot"));
  }
  offsetDuplicatedElement(clone);
  original.parentNode.insertBefore(clone, original.nextSibling);
  return {
    html: serializeHtmlDocument(doc, html),
    editableId: cloneEditableId,
  };
}

export function deleteElementInHtml(html: string, elementId: string) {
  if (typeof window === "undefined") return String(html || "");
  const doc = parseHtmlDocument(html);
  const node = doc.body.querySelector(buildEditableSelector(elementId));
  if (!node) return String(html || "");
  node.remove();
  return serializeHtmlDocument(doc, html);
}
