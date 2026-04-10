"use client";

import { createHtmlSlidePageState, type HtmlSlidePageState } from "./htmlPageState";

export type HtmlEditorSlideSnapshot = {
  id: string;
  slideIndex: number;
  html: string | null;
  pageTitle: string | null;
  pageType: string | null;
};

export type HtmlEditorSelectionSnapshot = {
  slideIndex: number;
  elementId: string;
} | null;

export type HtmlEditorSnapshot = {
  projectId: string;
  accountId: string;
  activeSlideIndex: number;
  selectedElementSelection: HtmlEditorSelectionSnapshot;
  htmlSlides: HtmlEditorSlideSnapshot[];
  baselineHtmlSlides: HtmlEditorSlideSnapshot[];
  capturedAt: number;
  reason?: string;
};

export function cloneHtmlSlidesForSnapshot(slides: HtmlEditorSlideSnapshot[]): HtmlEditorSlideSnapshot[] {
  return slides.map((slide) => ({
    id: String(slide?.id || ""),
    slideIndex: Number(slide?.slideIndex || 0),
    html: slide?.html == null ? null : String(slide.html),
    pageTitle: slide?.pageTitle == null ? null : String(slide.pageTitle),
    pageType: slide?.pageType == null ? null : String(slide.pageType),
  }));
}

export function captureHtmlEditorSnapshot(args: {
  projectId: string;
  accountId: string;
  activeSlideIndex: number;
  selectedElementSelection: HtmlEditorSelectionSnapshot;
  htmlSlides: HtmlEditorSlideSnapshot[];
  baselineHtmlSlides: HtmlEditorSlideSnapshot[];
  reason?: string;
}): HtmlEditorSnapshot {
  return {
    projectId: String(args.projectId || "").trim(),
    accountId: String(args.accountId || "").trim(),
    activeSlideIndex: Math.max(0, Number(args.activeSlideIndex || 0)),
    selectedElementSelection: args.selectedElementSelection
      ? {
          slideIndex: Math.max(0, Number(args.selectedElementSelection.slideIndex || 0)),
          elementId: String(args.selectedElementSelection.elementId || "").trim(),
        }
      : null,
    htmlSlides: cloneHtmlSlidesForSnapshot(args.htmlSlides),
    baselineHtmlSlides: cloneHtmlSlidesForSnapshot(args.baselineHtmlSlides),
    capturedAt: Date.now(),
    reason: args.reason ? String(args.reason) : undefined,
  };
}

export function buildPageStatesFromHtmlSlides(slides: HtmlEditorSlideSnapshot[]): HtmlSlidePageState[] {
  return cloneHtmlSlidesForSnapshot(slides).map((slide) => createHtmlSlidePageState(String(slide?.html || "")));
}

export function normalizeSelectionForSnapshot(
  selection: HtmlEditorSelectionSnapshot,
  pageStates: HtmlSlidePageState[]
): HtmlEditorSelectionSnapshot {
  if (!selection) return null;
  const slideIndex = Math.max(0, Number(selection.slideIndex || 0));
  const elementId = String(selection.elementId || "").trim();
  if (!elementId) return null;
  const state = pageStates[slideIndex];
  if (!state) return null;
  const exists = state.elements.some((element) => element.id === elementId && !element.deleted);
  return exists ? { slideIndex, elementId } : null;
}
