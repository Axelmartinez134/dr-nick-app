"use client";

import { useMemo } from "react";

export type HtmlEditableElement =
  | {
      id: string;
      type: "text";
      tagName: string;
      label: string;
      text: string;
      html: string;
      color: string;
      backgroundColor: string;
      fontSize: string;
      fontFamily: string;
      fontWeight: string;
      borderRadius: string;
    }
  | {
      id: string;
      type: "image-slot";
      tagName: string;
      label: string;
      backgroundImage: string;
      backgroundColor: string;
      borderRadius: string;
      slotType: string;
      searchQuery: string;
    }
  | {
      id: string;
      type: "image";
      tagName: string;
      label: string;
      src: string;
      borderRadius: string;
      objectFit: string;
      backgroundColor: string;
    }
  | {
      id: string;
      type: "block";
      tagName: string;
      label: string;
      backgroundColor: string;
      borderRadius: string;
      opacity: string;
      border: string;
    };

type ParseResult = {
  normalizedHtml: string;
  elements: HtmlEditableElement[];
};

function readInlineStyle(node: Element, key: keyof CSSStyleDeclaration): string {
  const value = (node as HTMLElement).style?.[key];
  return String(value || "").trim();
}

export function parseHtmlElements(html: string): ParseResult {
  if (typeof window === "undefined") return { normalizedHtml: String(html || ""), elements: [] };

  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");
  const elements: HtmlEditableElement[] = [];
  let counter = 0;

  const ensureId = (node: Element, prefix: string) => {
    const existing = String(node.getAttribute("data-editable-id") || "").trim();
    if (existing) return existing;
    const next = `${prefix}-${counter++}`;
    node.setAttribute("data-editable-id", next);
    return next;
  };

  const candidates = Array.from(doc.body.querySelectorAll("*"));
  for (const node of candidates) {
    const tagName = String(node.tagName || "").toLowerCase();
    const textContent = String(node.textContent || "").trim();
    const style = (node as HTMLElement).style;

    if (node.classList.contains("image-slot")) {
      const id = ensureId(node, "slot");
      elements.push({
        id,
        type: "image-slot",
        tagName,
        label: String(node.getAttribute("data-slot-label") || "Image slot"),
        backgroundImage: readInlineStyle(node, "backgroundImage"),
        backgroundColor: readInlineStyle(node, "backgroundColor"),
        borderRadius: readInlineStyle(node, "borderRadius"),
        slotType: String(node.getAttribute("data-slot-type") || "main"),
        searchQuery: String(node.getAttribute("data-search-query") || ""),
      });
      continue;
    }

    if (tagName === "img") {
      const id = ensureId(node, "img");
      elements.push({
        id,
        type: "image",
        tagName,
        label: String(node.getAttribute("alt") || `Image ${elements.length + 1}`),
        src: String(node.getAttribute("src") || ""),
        borderRadius: readInlineStyle(node, "borderRadius"),
        objectFit: readInlineStyle(node, "objectFit"),
        backgroundColor: readInlineStyle(node, "backgroundColor"),
      });
      continue;
    }

    const isTextLike =
      ["span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "button", "a", "strong", "em"].includes(tagName) &&
      textContent.length > 0;
    if (isTextLike) {
      const id = ensureId(node, "text");
      elements.push({
        id,
        type: "text",
        tagName,
        label: `${tagName.toUpperCase()} text`,
        text: textContent,
        html: (node as HTMLElement).innerHTML,
        color: readInlineStyle(node, "color"),
        backgroundColor: readInlineStyle(node, "backgroundColor"),
        fontSize: readInlineStyle(node, "fontSize"),
        fontFamily: readInlineStyle(node, "fontFamily"),
        fontWeight: readInlineStyle(node, "fontWeight"),
        borderRadius: readInlineStyle(node, "borderRadius"),
      });
      continue;
    }

    const hasBlockStyling =
      !!style &&
      (Boolean(readInlineStyle(node, "backgroundColor")) ||
        Boolean(readInlineStyle(node, "borderRadius")) ||
        Boolean(readInlineStyle(node, "opacity")) ||
        Boolean(readInlineStyle(node, "border")));
    if (hasBlockStyling && ["div", "section", "article"].includes(tagName)) {
      const id = ensureId(node, "block");
      elements.push({
        id,
        type: "block",
        tagName,
        label: `${tagName.toUpperCase()} block`,
        backgroundColor: readInlineStyle(node, "backgroundColor"),
        borderRadius: readInlineStyle(node, "borderRadius"),
        opacity: readInlineStyle(node, "opacity"),
        border: readInlineStyle(node, "border"),
      });
    }
  }

  return {
    normalizedHtml: doc.body.innerHTML,
    elements,
  };
}

export function useHtmlElementParser(html: string) {
  return useMemo(() => parseHtmlElements(html), [html]);
}
