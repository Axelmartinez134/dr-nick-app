"use client";

import type { HtmlSlidePageState } from "./htmlPageState";
import type { HtmlEditableElement } from "../models/htmlElementModel";

function quoteLabel(element: HtmlEditableElement) {
  const label = String(element.label || element.id || element.type).replace(/\s+/g, " ").trim();
  return label ? `"${label}"` : `"${element.id}"`;
}

function pushIfChanged(
  lines: string[],
  element: HtmlEditableElement,
  fieldLabel: string,
  previous: string,
  next: string
) {
  const before = String(previous || "").trim();
  const after = String(next || "").trim();
  if (before === after) return;
  lines.push(`- ${quoteLabel(element)} (${element.type}): ${fieldLabel} changed from ${before || "empty"} to ${after || "empty"}`);
}

function summarizeElementDiff(previous: HtmlEditableElement, next: HtmlEditableElement) {
  const lines: string[] = [];

  if (
    String(previous.translateX || "") !== String(next.translateX || "") ||
    String(previous.translateY || "") !== String(next.translateY || "")
  ) {
    lines.push(
      `- ${quoteLabel(next)} (${next.type}): moved from translate(${previous.translateX || "0px"}, ${previous.translateY || "0px"}) to translate(${next.translateX || "0px"}, ${next.translateY || "0px"})`
    );
  }
  if (String(previous.width || "") !== String(next.width || "") || String(previous.height || "") !== String(next.height || "")) {
    lines.push(
      `- ${quoteLabel(next)} (${next.type}): resized from ${previous.width || "auto"} x ${previous.height || "auto"} to ${next.width || "auto"} x ${next.height || "auto"}`
    );
  }
  if (String(previous.rotate || "") !== String(next.rotate || "")) {
    lines.push(`- ${quoteLabel(next)} (${next.type}): rotate changed from ${previous.rotate || "0deg"} to ${next.rotate || "0deg"}`);
  }

  if (previous.type === "text" && next.type === "text") {
    pushIfChanged(lines, next, "text", previous.text, next.text);
    if (String(previous.text || "").trim() === String(next.text || "").trim() && String(previous.html || "").trim() !== String(next.html || "").trim()) {
      lines.push(`- ${quoteLabel(next)} (${next.type}): text formatting markup changed`);
    }
    pushIfChanged(lines, next, "font size", previous.fontSize, next.fontSize);
    pushIfChanged(lines, next, "font family", previous.fontFamily, next.fontFamily);
    pushIfChanged(lines, next, "font weight", previous.fontWeight, next.fontWeight);
    pushIfChanged(lines, next, "font style", previous.fontStyle, next.fontStyle);
    pushIfChanged(lines, next, "text decoration", previous.textDecoration, next.textDecoration);
    pushIfChanged(lines, next, "letter spacing", previous.letterSpacing, next.letterSpacing);
    pushIfChanged(lines, next, "line height", previous.lineHeight, next.lineHeight);
    pushIfChanged(lines, next, "text align", previous.textAlign, next.textAlign);
    pushIfChanged(lines, next, "text transform", previous.textTransform, next.textTransform);
    pushIfChanged(lines, next, "margin top", previous.marginTop, next.marginTop);
    pushIfChanged(lines, next, "margin right", previous.marginRight, next.marginRight);
    pushIfChanged(lines, next, "margin bottom", previous.marginBottom, next.marginBottom);
    pushIfChanged(lines, next, "margin left", previous.marginLeft, next.marginLeft);
    pushIfChanged(lines, next, "text color", previous.color, next.color);
    pushIfChanged(lines, next, "background color", previous.backgroundColor, next.backgroundColor);
    pushIfChanged(lines, next, "border radius", previous.borderRadius, next.borderRadius);
  } else if (previous.type === "image-slot" && next.type === "image-slot") {
    pushIfChanged(lines, next, "background image", previous.backgroundImage, next.backgroundImage);
    pushIfChanged(lines, next, "background color", previous.backgroundColor, next.backgroundColor);
    pushIfChanged(lines, next, "background size", previous.backgroundSize, next.backgroundSize);
    pushIfChanged(lines, next, "background position", previous.backgroundPosition, next.backgroundPosition);
    pushIfChanged(lines, next, "border radius", previous.borderRadius, next.borderRadius);
    pushIfChanged(lines, next, "search query", previous.searchQuery, next.searchQuery);
  } else if (previous.type === "image" && next.type === "image") {
    pushIfChanged(lines, next, "image source", previous.src, next.src);
    pushIfChanged(lines, next, "object fit", previous.objectFit, next.objectFit);
    pushIfChanged(lines, next, "background color", previous.backgroundColor, next.backgroundColor);
    pushIfChanged(lines, next, "background size", previous.backgroundSize, next.backgroundSize);
    pushIfChanged(lines, next, "background position", previous.backgroundPosition, next.backgroundPosition);
    pushIfChanged(lines, next, "border radius", previous.borderRadius, next.borderRadius);
  } else if (previous.type === "block" && next.type === "block") {
    pushIfChanged(lines, next, "background color", previous.backgroundColor, next.backgroundColor);
    pushIfChanged(lines, next, "border radius", previous.borderRadius, next.borderRadius);
    pushIfChanged(lines, next, "opacity", previous.opacity, next.opacity);
    pushIfChanged(lines, next, "border", previous.border, next.border);
  }

  return lines;
}

export function buildManualEditsSummary(args: {
  baseline: HtmlSlidePageState | null | undefined;
  current: HtmlSlidePageState | null | undefined;
}) {
  const baseline = args.baseline;
  const current = args.current;
  if (!baseline || !current) return "";

  const previousById = new Map(baseline.elements.map((element) => [element.id, element]));
  const nextById = new Map(current.elements.map((element) => [element.id, element]));
  const lines: string[] = [];

  for (const element of current.elements) {
    const previous = previousById.get(element.id);
    if (!previous) {
      lines.push(`- ${quoteLabel(element)} (${element.type}): added`);
      continue;
    }
    lines.push(...summarizeElementDiff(previous, element));
  }

  for (const element of baseline.elements) {
    if (nextById.has(element.id)) continue;
    lines.push(`- ${quoteLabel(element)} (${element.type}): removed`);
  }

  return lines.join("\n").trim();
}
