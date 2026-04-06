"use client";

import type { HtmlEditableElement } from "./useHtmlElementParser";

export type HtmlElementPatch = Partial<{
  text: string;
  html: string;
  color: string;
  backgroundColor: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  borderRadius: string;
  opacity: string;
  border: string;
  backgroundImage: string;
  objectFit: string;
  src: string;
  searchQuery: string;
}>;

export function applyElementPatchToHtml(html: string, elementId: string, patch: HtmlElementPatch) {
  if (typeof window === "undefined") return String(html || "");
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");
  const node = doc.body.querySelector(`[data-editable-id="${CSS.escape(String(elementId || ""))}"]`) as HTMLElement | null;
  if (!node) return String(html || "");

  if (typeof patch.text === "string") node.textContent = patch.text;
  if (typeof patch.html === "string") node.innerHTML = patch.html;
  if (typeof patch.color === "string") node.style.color = patch.color;
  if (typeof patch.backgroundColor === "string") node.style.backgroundColor = patch.backgroundColor;
  if (typeof patch.fontSize === "string") node.style.fontSize = patch.fontSize;
  if (typeof patch.fontFamily === "string") node.style.fontFamily = patch.fontFamily;
  if (typeof patch.fontWeight === "string") node.style.fontWeight = patch.fontWeight;
  if (typeof patch.borderRadius === "string") node.style.borderRadius = patch.borderRadius;
  if (typeof patch.opacity === "string") node.style.opacity = patch.opacity;
  if (typeof patch.border === "string") node.style.border = patch.border;
  if (typeof patch.backgroundImage === "string") node.style.backgroundImage = patch.backgroundImage;
  if (typeof patch.objectFit === "string") node.style.objectFit = patch.objectFit;
  if (typeof patch.src === "string" && node.tagName.toLowerCase() === "img") {
    node.setAttribute("src", patch.src);
  }
  if (typeof patch.searchQuery === "string") {
    node.setAttribute("data-search-query", patch.searchQuery);
  }

  return doc.body.innerHTML;
}
