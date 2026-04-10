"use client";

import { useMemo } from "react";
import {
  createDefaultHtmlGeometry,
  type HtmlEditableElement,
  type HtmlSlotAttributes,
  type HtmlSlotType,
} from "../models/htmlElementModel";

export type { HtmlEditableElement } from "../models/htmlElementModel";

type ParseResult = {
  normalizedHtml: string;
  elements: HtmlEditableElement[];
};

const TEXT_TAGS = new Set(["span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "button", "a", "strong", "em"]);
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
const PARSE_PROBE_ATTR = "data-editor-parse-probe-id";
const BLOCK_TEXT_CHILD_TAGS = new Set(["span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "a", "button"]);
const SLOT_TYPES = new Set<HtmlSlotType>(["background", "main", "logo", "icon", "profile"]);

type StyleValueReader = (node: Element, key: keyof CSSStyleDeclaration) => string;

function hasFullDocumentMarkup(html: string) {
  return /<!doctype\b|<html\b|<head\b|<body\b/i.test(String(html || ""));
}

function serializeParsedDocument(doc: Document, sourceHtml: string) {
  if (!hasFullDocumentMarkup(sourceHtml)) {
    return doc.body.innerHTML;
  }
  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
}

function createTextLabel(value: string) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  if (!compact) return "Text";
  return compact.length > 36 ? `${compact.slice(0, 36).trim()}...` : compact;
}

function readInlineStyle(node: Element, key: keyof CSSStyleDeclaration): string {
  const value = (node as HTMLElement).style?.[key];
  return String(value || "").trim();
}

function createStyleValueReader(sourceDoc: Document): { readStyle: StyleValueReader; cleanup: () => void } {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return {
      readStyle: readInlineStyle,
      cleanup: () => {},
    };
  }

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-20000px";
  host.style.top = "0";
  host.style.width = "2000px";
  host.style.height = "2000px";
  host.style.opacity = "0";
  host.style.pointerEvents = "none";
  host.style.overflow = "hidden";
  host.innerHTML = `${sourceDoc.head.innerHTML}<div data-editor-parse-root="true">${sourceDoc.body.innerHTML}</div>`;
  document.body.appendChild(host);

  return {
    readStyle(node, key) {
      const inlineValue = readInlineStyle(node, key);
      if (inlineValue) return inlineValue;
      const probeId = String(node.getAttribute(PARSE_PROBE_ATTR) || "").trim();
      if (!probeId) return "";
      const liveNode = host.querySelector(`[${PARSE_PROBE_ATTR}="${probeId}"]`);
      if (!(liveNode instanceof HTMLElement)) return "";
      return String(window.getComputedStyle(liveNode)[key] || "").trim();
    },
    cleanup() {
      host.remove();
    },
  };
}

function normalizeSlotType(value: string): HtmlSlotType {
  const normalized = String(value || "").trim().toLowerCase() as HtmlSlotType;
  return SLOT_TYPES.has(normalized) ? normalized : "main";
}

function extractBackgroundImageUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "none") return "";
  const match = raw.match(/url\((['"]?)(.*?)\1\)/i);
  return String(match?.[2] || "").trim();
}

function readBooleanAttribute(node: Element, key: string, fallback: boolean) {
  const value = String(node.getAttribute(key) || "").trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function readTransformGeometry(node: Element, readStyle: StyleValueReader = readInlineStyle) {
  const style = (node as HTMLElement).style;
  const transform = String(style?.transform || "");
  const translateMatch = transform.match(/translate\(\s*([^,]+),\s*([^)]+)\)/i);
  const rotateMatch = transform.match(/rotate\(\s*([^)]+)\)/i);
  const translateX = String(translateMatch?.[1] || "").trim();
  const translateY = String(translateMatch?.[2] || "").trim();
  const width = String(readStyle(node, "width") || (node as HTMLElement).getAttribute("width") || "").trim();
  const height = String(readStyle(node, "height") || (node as HTMLElement).getAttribute("height") || "").trim();
  const rotate = String(rotateMatch?.[1] || "").trim();

  return {
    ...createDefaultHtmlGeometry(),
    translateX,
    translateY,
    width,
    height,
    rotate,
    originalTranslateX: String(node.getAttribute(EDITOR_ORIGINAL_TRANSLATE_X_ATTR) || translateX).trim(),
    originalTranslateY: String(node.getAttribute(EDITOR_ORIGINAL_TRANSLATE_Y_ATTR) || translateY).trim(),
    originalWidth: String(node.getAttribute(EDITOR_ORIGINAL_WIDTH_ATTR) || width).trim(),
    originalHeight: String(node.getAttribute(EDITOR_ORIGINAL_HEIGHT_ATTR) || height).trim(),
    originalRotate: String(node.getAttribute(EDITOR_ORIGINAL_ROTATE_ATTR) || rotate).trim(),
  };
}

function writeEditorMetadata(
  node: Element,
  metadata: {
    selectable: boolean;
    transformable: boolean;
    listable: boolean;
    geometry: ReturnType<typeof readTransformGeometry>;
    originalStyles?: {
      fontFamily?: string;
      fontSize?: string;
      color?: string;
      backgroundColor?: string;
      fontStyle?: string;
      textDecoration?: string;
      letterSpacing?: string;
      lineHeight?: string;
      textAlign?: string;
      marginTop?: string;
      marginRight?: string;
      marginBottom?: string;
      marginLeft?: string;
    };
  }
) {
  node.setAttribute(EDITOR_SELECTABLE_ATTR, String(metadata.selectable));
  node.setAttribute(EDITOR_TRANSFORMABLE_ATTR, String(metadata.transformable));
  node.setAttribute(EDITOR_LISTABLE_ATTR, String(metadata.listable));
  node.setAttribute(EDITOR_ORIGINAL_TRANSLATE_X_ATTR, metadata.geometry.originalTranslateX);
  node.setAttribute(EDITOR_ORIGINAL_TRANSLATE_Y_ATTR, metadata.geometry.originalTranslateY);
  node.setAttribute(EDITOR_ORIGINAL_WIDTH_ATTR, metadata.geometry.originalWidth);
  node.setAttribute(EDITOR_ORIGINAL_HEIGHT_ATTR, metadata.geometry.originalHeight);
  node.setAttribute(EDITOR_ORIGINAL_ROTATE_ATTR, metadata.geometry.originalRotate);
  if (metadata.originalStyles) {
    const s = metadata.originalStyles;
    if (s.fontFamily !== undefined) node.setAttribute(EDITOR_ORIGINAL_FONT_FAMILY_ATTR, s.fontFamily);
    if (s.fontSize !== undefined) node.setAttribute(EDITOR_ORIGINAL_FONT_SIZE_ATTR, s.fontSize);
    if (s.color !== undefined) node.setAttribute(EDITOR_ORIGINAL_COLOR_ATTR, s.color);
    if (s.backgroundColor !== undefined) node.setAttribute(EDITOR_ORIGINAL_BG_COLOR_ATTR, s.backgroundColor);
    if (s.fontStyle !== undefined) node.setAttribute(EDITOR_ORIGINAL_FONT_STYLE_ATTR, s.fontStyle);
    if (s.textDecoration !== undefined) node.setAttribute(EDITOR_ORIGINAL_TEXT_DECORATION_ATTR, s.textDecoration);
    if (s.letterSpacing !== undefined) node.setAttribute(EDITOR_ORIGINAL_LETTER_SPACING_ATTR, s.letterSpacing);
    if (s.lineHeight !== undefined) node.setAttribute(EDITOR_ORIGINAL_LINE_HEIGHT_ATTR, s.lineHeight);
    if (s.textAlign !== undefined) node.setAttribute(EDITOR_ORIGINAL_TEXT_ALIGN_ATTR, s.textAlign);
    if (s.marginTop !== undefined) node.setAttribute(EDITOR_ORIGINAL_MARGIN_TOP_ATTR, s.marginTop);
    if (s.marginRight !== undefined) node.setAttribute(EDITOR_ORIGINAL_MARGIN_RIGHT_ATTR, s.marginRight);
    if (s.marginBottom !== undefined) node.setAttribute(EDITOR_ORIGINAL_MARGIN_BOTTOM_ATTR, s.marginBottom);
    if (s.marginLeft !== undefined) node.setAttribute(EDITOR_ORIGINAL_MARGIN_LEFT_ATTR, s.marginLeft);
  }
}

function clearEditorMetadata(node: Element) {
  node.removeAttribute("data-editable-id");
  node.removeAttribute(EDITOR_SELECTABLE_ATTR);
  node.removeAttribute(EDITOR_TRANSFORMABLE_ATTR);
  node.removeAttribute(EDITOR_LISTABLE_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_TRANSLATE_X_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_TRANSLATE_Y_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_WIDTH_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_HEIGHT_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_ROTATE_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_FONT_FAMILY_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_FONT_SIZE_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_COLOR_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_BG_COLOR_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_FONT_STYLE_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_TEXT_DECORATION_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_LETTER_SPACING_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_LINE_HEIGHT_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_TEXT_ALIGN_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_MARGIN_TOP_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_MARGIN_RIGHT_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_MARGIN_BOTTOM_ATTR);
  node.removeAttribute(EDITOR_ORIGINAL_MARGIN_LEFT_ATTR);
}

function hasAncestorInSet(node: Element | null, seen: Set<Element>) {
  let current = node;
  while (current) {
    if (seen.has(current)) return true;
    current = current.parentElement;
  }
  return false;
}

function isIgnorableText(text: string) {
  const value = String(text || "").trim();
  if (!value) return true;
  if (/^[a-z][a-z-]*\s*:\s*[^;]+;?$/i.test(value)) return true;
  if (value.includes(":") && value.includes(";") && value.split(";").length > 2) return true;
  if (/^\s*[\d.]+\s*(px|em|rem|%|vh|vw|pt|cm|mm)\s*$/i.test(value)) return true;
  if (value.startsWith("function") || value.includes("const ") || value.includes("let ") || value.includes("=>")) return true;
  if (/^\s*\{[\s\S]*\}\s*$/.test(value)) return true;
  if (value.includes("Image area") || value.includes("이미지 영역") || value === "...") return true;
  if (/^(&[a-z]+;|\s)+$/i.test(value)) return true;
  return false;
}

function readSlotAttributes(node: Element): HtmlSlotAttributes {
  return {
    slotId: String(node.getAttribute("data-slot-id") || ""),
    slotType: normalizeSlotType(String(node.getAttribute("data-slot-type") || "main")),
    slotLabel: String(node.getAttribute("data-slot-label") || "Image slot"),
    searchQuery: String(node.getAttribute("data-search-query") || ""),
  };
}

function parsePx(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.endsWith("px")) {
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isFullSpanLength(value: string, axisSize: number) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw === "100%" || raw === "100vw" || raw === "100vh") return true;
  const px = parsePx(raw);
  return px !== null && axisSize > 0 && px >= axisSize * 0.85;
}

function inferCanvasDimensions(root: Element | null, readStyle: StyleValueReader = readInlineStyle) {
  return {
    width: parsePx(readStyle(root || document.body, "width")) || 1080,
    height: parsePx(readStyle(root || document.body, "height")) || 1440,
  };
}

function hasComputedBackgroundImageDescendant(node: Element, readStyle: StyleValueReader) {
  return Array.from(node.querySelectorAll("*")).some((descendant) =>
    Boolean(extractBackgroundImageUrl(readStyle(descendant, "backgroundImage")))
  );
}

function hasOnlyTextLikeChildren(node: Element) {
  const elementChildren = Array.from(node.children);
  if (elementChildren.length === 0) return true;

  return elementChildren.every((child) => {
    const tagName = String(child.tagName || "").toLowerCase();
    if (!BLOCK_TEXT_CHILD_TAGS.has(tagName)) return false;
    return child.querySelector("div, section, article, header, footer, main, ul, ol, .image-slot, img[src], [style*='background-image']") === null;
  });
}

function isStructuralImageNode(
  node: Element,
  canvas: { width: number; height: number },
  readStyle: StyleValueReader = readInlineStyle
) {
  const position = String(readStyle(node, "position") || "").trim().toLowerCase();
  const inset = String(readStyle(node, "inset") || "").trim().toLowerCase();
  const width = readStyle(node, "width");
  const height = readStyle(node, "height");
  const objectFit = readStyle(node, "objectFit").toLowerCase();
  const fullBleed = inset === "0" || (isFullSpanLength(width, canvas.width) && isFullSpanLength(height, canvas.height));
  const hasNestedStructure = node.querySelector("div, section, article, header, footer, main, ul, ol") !== null;

  if (node.getAttribute("data-editor-overlay-root") === "true") return true;
  if (fullBleed) return true;
  if (position !== "absolute" && objectFit !== "contain") return true;
  if (hasNestedStructure) return true;

  return false;
}

export function parseHtmlElements(html: string): ParseResult {
  if (typeof window === "undefined") return { normalizedHtml: String(html || ""), elements: [] };

  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");
  const elements: HtmlEditableElement[] = [];
  let counter = 0;
  const primaryRoot = doc.body.firstElementChild;
  const protectedElements = new Set<Element>();
  const richTextElements = new Set<Element>();
  const probedNodes = Array.from(doc.body.querySelectorAll("*"));
  probedNodes.forEach((node, index) => {
    node.setAttribute(PARSE_PROBE_ATTR, `probe-${index}`);
  });
  const styleReader = createStyleValueReader(doc);
  const readStyle = styleReader.readStyle;
  const canvas = inferCanvasDimensions(primaryRoot, readStyle);

  try {
    const ensureId = (node: Element, prefix: string) => {
      const existing = String(node.getAttribute("data-editable-id") || "").trim();
      if (existing) return existing;
      const next = `${prefix}-${counter++}`;
      node.setAttribute("data-editable-id", next);
      return next;
    };

    for (const node of Array.from(doc.body.querySelectorAll(".image-slot"))) {
    if (node === primaryRoot) continue;
    const id = ensureId(node, "slot");
    const slot = readSlotAttributes(node);
    const geometry = readTransformGeometry(node, readStyle);
    const isBackgroundSlot = slot.slotType === "background";
    const slotBgColor = readStyle(node, "backgroundColor");
    writeEditorMetadata(node, {
      selectable: true,
      transformable: !isBackgroundSlot,
      listable: !isBackgroundSlot,
      geometry,
      originalStyles: { backgroundColor: slotBgColor },
    });
    protectedElements.add(node);
    elements.push({
      ...geometry,
      id,
      type: "image-slot",
      tagName: String(node.tagName || "").toLowerCase(),
      label: slot.slotLabel || "Image area",
      selectable: readBooleanAttribute(node, EDITOR_SELECTABLE_ATTR, true),
      transformable: readBooleanAttribute(node, EDITOR_TRANSFORMABLE_ATTR, true),
      listable: readBooleanAttribute(node, EDITOR_LISTABLE_ATTR, true),
      backgroundImage: readStyle(node, "backgroundImage"),
      backgroundColor: slotBgColor,
      backgroundSize: readStyle(node, "backgroundSize"),
      backgroundPosition: readStyle(node, "backgroundPosition"),
      borderRadius: readStyle(node, "borderRadius"),
      slotId: slot.slotId,
      slotType: slot.slotType,
      slotLabel: slot.slotLabel,
      searchQuery: slot.searchQuery,
      originalBackgroundColor: String(node.getAttribute(EDITOR_ORIGINAL_BG_COLOR_ATTR) || slotBgColor).trim(),
    });
  }

  for (const node of Array.from(doc.body.querySelectorAll("img[src]"))) {
    if (node.closest(".image-slot")) continue;
    if (node === primaryRoot) continue;
    const src = String(node.getAttribute("src") || "");
    if (!src || src.startsWith("data:")) continue;
    if (isStructuralImageNode(node, canvas, readStyle)) {
      clearEditorMetadata(node);
      continue;
    }
    const id = ensureId(node, "img");
    const geometry = readTransformGeometry(node, readStyle);
    const imgBgColor = readStyle(node, "backgroundColor");
    writeEditorMetadata(node, {
      selectable: true,
      transformable: true,
      listable: true,
      geometry,
      originalStyles: { backgroundColor: imgBgColor },
    });
    protectedElements.add(node);
    elements.push({
      ...geometry,
      id,
      type: "image",
      tagName: "img",
      label: "Image",
      selectable: readBooleanAttribute(node, EDITOR_SELECTABLE_ATTR, true),
      transformable: readBooleanAttribute(node, EDITOR_TRANSFORMABLE_ATTR, true),
      listable: readBooleanAttribute(node, EDITOR_LISTABLE_ATTR, true),
      src,
      borderRadius: readStyle(node, "borderRadius"),
      objectFit: readStyle(node, "objectFit"),
      backgroundColor: imgBgColor,
      backgroundSize: readStyle(node, "backgroundSize"),
      backgroundPosition: readStyle(node, "backgroundPosition"),
      originalBackgroundColor: String(node.getAttribute(EDITOR_ORIGINAL_BG_COLOR_ATTR) || imgBgColor).trim(),
    });
  }

  for (const node of Array.from(doc.body.querySelectorAll("*"))) {
    if (node === primaryRoot) continue;
    if (protectedElements.has(node) || node.classList.contains("image-slot")) continue;
    const backgroundUrl = extractBackgroundImageUrl(readStyle(node, "backgroundImage"));
    if (!backgroundUrl || backgroundUrl.startsWith("data:")) continue;
    if (isStructuralImageNode(node, canvas, readStyle)) {
      clearEditorMetadata(node);
      continue;
    }
    const id = ensureId(node, "bg");
    const geometry = readTransformGeometry(node, readStyle);
    const bgNodeBgColor = readStyle(node, "backgroundColor");
    writeEditorMetadata(node, {
      selectable: true,
      transformable: true,
      listable: true,
      geometry,
      originalStyles: { backgroundColor: bgNodeBgColor },
    });
    protectedElements.add(node);
    elements.push({
      ...geometry,
      id,
      type: "image",
      tagName: String(node.tagName || "").toLowerCase(),
      label: "Image",
      selectable: readBooleanAttribute(node, EDITOR_SELECTABLE_ATTR, true),
      transformable: readBooleanAttribute(node, EDITOR_TRANSFORMABLE_ATTR, true),
      listable: readBooleanAttribute(node, EDITOR_LISTABLE_ATTR, true),
      src: backgroundUrl,
      borderRadius: readStyle(node, "borderRadius"),
      objectFit: readStyle(node, "objectFit"),
      backgroundColor: bgNodeBgColor,
      backgroundSize: readStyle(node, "backgroundSize"),
      backgroundPosition: readStyle(node, "backgroundPosition"),
      originalBackgroundColor: String(node.getAttribute(EDITOR_ORIGINAL_BG_COLOR_ATTR) || bgNodeBgColor).trim(),
    });
  }

  for (const node of Array.from(doc.body.querySelectorAll('span[data-richtext="true"], span[data-editable-id]'))) {
    if (protectedElements.has(node)) continue;
    const innerHtml = String((node as HTMLElement).innerHTML || "");
    const textContent = String(node.textContent || "").trim();
    if (!/<(b|i|em|strong|span|br)\b/i.test(innerHtml)) continue;
    if (!textContent) continue;
    const id = ensureId(node, "text");
    const geometry = readTransformGeometry(node, readStyle);
    const rtColor = readStyle(node, "color");
    const rtBgColor = readStyle(node, "backgroundColor");
    const rtFontFamily = readStyle(node, "fontFamily");
    const rtFontSize = readStyle(node, "fontSize");
    const rtFontStyle = readStyle(node, "fontStyle");
    const rtTextDecoration = readStyle(node, "textDecoration");
    const rtLetterSpacing = readStyle(node, "letterSpacing");
    const rtLineHeight = readStyle(node, "lineHeight");
    const rtTextAlign = readStyle(node, "textAlign");
    const rtMarginTop = readStyle(node, "marginTop");
    const rtMarginRight = readStyle(node, "marginRight");
    const rtMarginBottom = readStyle(node, "marginBottom");
    const rtMarginLeft = readStyle(node, "marginLeft");
    writeEditorMetadata(node, {
      selectable: true,
      transformable: true,
      listable: true,
      geometry,
      originalStyles: {
        fontFamily: rtFontFamily,
        fontSize: rtFontSize,
        color: rtColor,
        backgroundColor: rtBgColor,
        fontStyle: rtFontStyle,
        textDecoration: rtTextDecoration,
        letterSpacing: rtLetterSpacing,
        lineHeight: rtLineHeight,
        textAlign: rtTextAlign,
        marginTop: rtMarginTop,
        marginRight: rtMarginRight,
        marginBottom: rtMarginBottom,
        marginLeft: rtMarginLeft,
      },
    });
    protectedElements.add(node);
    richTextElements.add(node);
    elements.push({
      ...geometry,
      id,
      type: "text",
      tagName: "span",
      label: createTextLabel(textContent),
      selectable: readBooleanAttribute(node, EDITOR_SELECTABLE_ATTR, true),
      transformable: readBooleanAttribute(node, EDITOR_TRANSFORMABLE_ATTR, true),
      listable: readBooleanAttribute(node, EDITOR_LISTABLE_ATTR, true),
      text: textContent,
      html: innerHtml,
      richHtml: true,
      color: rtColor,
      backgroundColor: rtBgColor,
      fontSize: rtFontSize,
      fontFamily: rtFontFamily,
      fontWeight: readStyle(node, "fontWeight"),
      fontStyle: rtFontStyle,
      textDecoration: rtTextDecoration,
      letterSpacing: rtLetterSpacing,
      lineHeight: rtLineHeight,
      textAlign: rtTextAlign,
      textTransform: readStyle(node, "textTransform"),
      marginTop: rtMarginTop,
      marginRight: rtMarginRight,
      marginBottom: rtMarginBottom,
      marginLeft: rtMarginLeft,
      borderRadius: readStyle(node, "borderRadius"),
      originalFontFamily: String(node.getAttribute(EDITOR_ORIGINAL_FONT_FAMILY_ATTR) || rtFontFamily).trim(),
      originalFontSize: String(node.getAttribute(EDITOR_ORIGINAL_FONT_SIZE_ATTR) || rtFontSize).trim(),
      originalColor: String(node.getAttribute(EDITOR_ORIGINAL_COLOR_ATTR) || rtColor).trim(),
      originalBackgroundColor: String(node.getAttribute(EDITOR_ORIGINAL_BG_COLOR_ATTR) || rtBgColor).trim(),
      originalFontStyle: String(node.getAttribute(EDITOR_ORIGINAL_FONT_STYLE_ATTR) || rtFontStyle).trim(),
      originalTextDecoration: String(node.getAttribute(EDITOR_ORIGINAL_TEXT_DECORATION_ATTR) || rtTextDecoration).trim(),
      originalLetterSpacing: String(node.getAttribute(EDITOR_ORIGINAL_LETTER_SPACING_ATTR) || rtLetterSpacing).trim(),
      originalLineHeight: String(node.getAttribute(EDITOR_ORIGINAL_LINE_HEIGHT_ATTR) || rtLineHeight).trim(),
      originalTextAlign: String(node.getAttribute(EDITOR_ORIGINAL_TEXT_ALIGN_ATTR) || rtTextAlign).trim(),
      originalMarginTop: String(node.getAttribute(EDITOR_ORIGINAL_MARGIN_TOP_ATTR) || rtMarginTop).trim(),
      originalMarginRight: String(node.getAttribute(EDITOR_ORIGINAL_MARGIN_RIGHT_ATTR) || rtMarginRight).trim(),
      originalMarginBottom: String(node.getAttribute(EDITOR_ORIGINAL_MARGIN_BOTTOM_ATTR) || rtMarginBottom).trim(),
      originalMarginLeft: String(node.getAttribute(EDITOR_ORIGINAL_MARGIN_LEFT_ATTR) || rtMarginLeft).trim(),
    });
  }

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const value = String(node.textContent || "").trim();
      if (!value) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tagName = String(parent.tagName || "").toLowerCase();
      if (tagName === "script" || tagName === "style") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let textNode: Node | null;
  while ((textNode = walker.nextNode())) {
    const value = String(textNode.textContent || "").trim();
    if (!value || isIgnorableText(value)) continue;
    const parent = textNode.parentElement;
    if (!parent || parent === primaryRoot) continue;
    if (hasAncestorInSet(parent, richTextElements) || hasAncestorInSet(parent, protectedElements)) continue;

    const parentTag = parent.tagName.toLowerCase();
    const canOwnEditableText = TEXT_TAGS.has(parentTag);
    const styledAncestor = parent.closest("[style]") || parent;
    const styleNode = styledAncestor instanceof Element ? styledAncestor : parent;
    const id =
      canOwnEditableText
        ? ensureId(parent, "text")
        : `text-${counter++}`;

    let target = parent;
    if (!canOwnEditableText) {
      const wrapper = doc.createElement("span");
      wrapper.setAttribute("data-editable-id", id);
      parent.insertBefore(wrapper, textNode);
      wrapper.appendChild(textNode);
      target = wrapper;
    }

    const geometry = readTransformGeometry(target, readStyle);
    const ptColor = readStyle(styleNode, "color");
    const ptBgColor = readStyle(styleNode, "backgroundColor");
    const ptFontFamily = readStyle(styleNode, "fontFamily");
    const ptFontSize = readStyle(styleNode, "fontSize");
    const ptFontStyle = readStyle(styleNode, "fontStyle");
    const ptTextDecoration = readStyle(styleNode, "textDecoration");
    const ptLetterSpacing = readStyle(styleNode, "letterSpacing");
    const ptLineHeight = readStyle(styleNode, "lineHeight");
    const ptTextAlign = readStyle(styleNode, "textAlign");
    const ptMarginTop = readStyle(styleNode, "marginTop");
    const ptMarginRight = readStyle(styleNode, "marginRight");
    const ptMarginBottom = readStyle(styleNode, "marginBottom");
    const ptMarginLeft = readStyle(styleNode, "marginLeft");
    writeEditorMetadata(target, {
      selectable: true,
      transformable: true,
      listable: true,
      geometry,
      originalStyles: {
        fontFamily: ptFontFamily,
        fontSize: ptFontSize,
        color: ptColor,
        backgroundColor: ptBgColor,
        fontStyle: ptFontStyle,
        textDecoration: ptTextDecoration,
        letterSpacing: ptLetterSpacing,
        lineHeight: ptLineHeight,
        textAlign: ptTextAlign,
        marginTop: ptMarginTop,
        marginRight: ptMarginRight,
        marginBottom: ptMarginBottom,
        marginLeft: ptMarginLeft,
      },
    });
    protectedElements.add(target);
    elements.push({
      ...geometry,
      id,
      type: "text",
      tagName: String(target.tagName || "").toLowerCase(),
      label: createTextLabel(value),
      selectable: readBooleanAttribute(target, EDITOR_SELECTABLE_ATTR, true),
      transformable: readBooleanAttribute(target, EDITOR_TRANSFORMABLE_ATTR, true),
      listable: readBooleanAttribute(target, EDITOR_LISTABLE_ATTR, true),
      text: value,
      html: String((target as HTMLElement).innerHTML || value),
      richHtml: /<(span|b|i|em|strong|br)\b/i.test(String((target as HTMLElement).innerHTML || "")),
      color: ptColor,
      backgroundColor: ptBgColor,
      fontSize: ptFontSize,
      fontFamily: ptFontFamily,
      fontWeight: readStyle(styleNode, "fontWeight"),
      fontStyle: ptFontStyle,
      textDecoration: ptTextDecoration,
      letterSpacing: ptLetterSpacing,
      lineHeight: ptLineHeight,
      textAlign: ptTextAlign,
      textTransform: readStyle(styleNode, "textTransform"),
      marginTop: ptMarginTop,
      marginRight: ptMarginRight,
      marginBottom: ptMarginBottom,
      marginLeft: ptMarginLeft,
      borderRadius: readStyle(styleNode, "borderRadius"),
      originalFontFamily: String(target.getAttribute(EDITOR_ORIGINAL_FONT_FAMILY_ATTR) || ptFontFamily).trim(),
      originalFontSize: String(target.getAttribute(EDITOR_ORIGINAL_FONT_SIZE_ATTR) || ptFontSize).trim(),
      originalColor: String(target.getAttribute(EDITOR_ORIGINAL_COLOR_ATTR) || ptColor).trim(),
      originalBackgroundColor: String(target.getAttribute(EDITOR_ORIGINAL_BG_COLOR_ATTR) || ptBgColor).trim(),
      originalFontStyle: String(target.getAttribute(EDITOR_ORIGINAL_FONT_STYLE_ATTR) || ptFontStyle).trim(),
      originalTextDecoration: String(target.getAttribute(EDITOR_ORIGINAL_TEXT_DECORATION_ATTR) || ptTextDecoration).trim(),
      originalLetterSpacing: String(target.getAttribute(EDITOR_ORIGINAL_LETTER_SPACING_ATTR) || ptLetterSpacing).trim(),
      originalLineHeight: String(target.getAttribute(EDITOR_ORIGINAL_LINE_HEIGHT_ATTR) || ptLineHeight).trim(),
      originalTextAlign: String(target.getAttribute(EDITOR_ORIGINAL_TEXT_ALIGN_ATTR) || ptTextAlign).trim(),
      originalMarginTop: String(target.getAttribute(EDITOR_ORIGINAL_MARGIN_TOP_ATTR) || ptMarginTop).trim(),
      originalMarginRight: String(target.getAttribute(EDITOR_ORIGINAL_MARGIN_RIGHT_ATTR) || ptMarginRight).trim(),
      originalMarginBottom: String(target.getAttribute(EDITOR_ORIGINAL_MARGIN_BOTTOM_ATTR) || ptMarginBottom).trim(),
      originalMarginLeft: String(target.getAttribute(EDITOR_ORIGINAL_MARGIN_LEFT_ATTR) || ptMarginLeft).trim(),
    });
  }

  for (const node of Array.from(doc.body.querySelectorAll("div"))) {
    if (node === primaryRoot) continue;
    if (protectedElements.has(node)) continue;
    if (node.getAttribute("data-editor-overlay-root") === "true") continue;
    if (node.classList.contains("image-slot")) continue;

    const styleAttr = String(node.getAttribute("style") || "");
    const absolute = String(readStyle(node, "position") || "").trim() === "absolute";
    const hasBackground =
      Boolean(readStyle(node, "backgroundColor")) ||
      Boolean(extractBackgroundImageUrl(readStyle(node, "backgroundImage"))) ||
      /background:/i.test(styleAttr);
    const hasBorder = Boolean(readStyle(node, "border"));
    const hasNestedDiv = node.querySelector("div") !== null;
    const hasNestedLayout = node.querySelector("div, section, article, header, footer, main, ul, ol") !== null;
    const hasMediaDescendant =
      node.querySelector(".image-slot, img[src], [style*='background-image']") !== null ||
      hasComputedBackgroundImageDescendant(node, readStyle);
    const hasText = String(node.textContent || "").trim().length >= 3;
    const hasSize = Boolean(readStyle(node, "width")) || Boolean(readStyle(node, "height"));
    const inset = String(readStyle(node, "inset") || "").trim().toLowerCase();
    const width = readStyle(node, "width");
    const height = readStyle(node, "height");
    const fullBleed = inset === "0" || (isFullSpanLength(width, canvas.width) && isFullSpanLength(height, canvas.height));
    const textOnlyChildren = hasOnlyTextLikeChildren(node);

    if (!absolute && !hasBackground && !hasBorder) continue;
    if (absolute && !hasNestedDiv && hasText && !hasBackground && !hasBorder) continue;
    if (absolute && hasNestedDiv && !hasSize) continue;
    if (fullBleed) {
      clearEditorMetadata(node);
      continue;
    }
    if (hasMediaDescendant) {
      clearEditorMetadata(node);
      continue;
    }
    if (hasNestedLayout && !textOnlyChildren) {
      clearEditorMetadata(node);
      continue;
    }

    const id = ensureId(node, "block");
    const geometry = readTransformGeometry(node, readStyle);
    const blockBgColor = readStyle(node, "backgroundColor");
    writeEditorMetadata(node, {
      selectable: true,
      transformable: true,
      listable: true,
      geometry,
      originalStyles: { backgroundColor: blockBgColor },
    });
    protectedElements.add(node);
    elements.push({
      ...geometry,
      id,
      type: "block",
      tagName: "div",
      label: "Design element",
      selectable: readBooleanAttribute(node, EDITOR_SELECTABLE_ATTR, true),
      transformable: readBooleanAttribute(node, EDITOR_TRANSFORMABLE_ATTR, true),
      listable: readBooleanAttribute(node, EDITOR_LISTABLE_ATTR, true),
      backgroundColor: blockBgColor,
      borderRadius: readStyle(node, "borderRadius"),
      opacity: readStyle(node, "opacity"),
      border: readStyle(node, "border"),
      originalBackgroundColor: String(node.getAttribute(EDITOR_ORIGINAL_BG_COLOR_ATTR) || blockBgColor).trim(),
    });
  }

    probedNodes.forEach((node) => {
      node.removeAttribute(PARSE_PROBE_ATTR);
    });
    return {
      normalizedHtml: serializeParsedDocument(doc, html),
      elements,
    };
  } finally {
    styleReader.cleanup();
  }
}

export function useHtmlElementParser(html: string) {
  return useMemo(() => parseHtmlElements(html), [html]);
}
