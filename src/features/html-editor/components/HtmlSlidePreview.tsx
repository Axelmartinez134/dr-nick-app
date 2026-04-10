"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { useHtmlSlideRenderer } from "../hooks/useHtmlSlideRenderer";
import { wrapHtmlDocument } from "../lib/htmlDocumentWrapper";
import { elementStateToPatch } from "../lib/htmlPageState";
import type { HtmlEditableElement, HtmlElementPatch } from "../models/htmlElementModel";
import {
  HTML_IFRAME_MESSAGE_TYPES,
  type HtmlIframeToParentMessage,
  type HtmlParentToIframeMessage,
} from "../runtime/iframeProtocol";

export type HtmlSlidePreviewHandle = {
  sendElementUpdate: (editableId: string, patch: HtmlElementPatch) => void;
  highlight: (editableId: string | null) => void;
  flushInlineEdit: () => void;
  syncStructure: (html: string) => void;
  sendFontCss: (css: string) => void;
};

type Props = {
  slideIndex?: number;
  html: string;
  title: string;
  aspectRatio?: "1:1" | "3:4" | "4:5" | "16:9";
  interactive?: boolean;
  documentKey?: string;
  elements?: HtmlEditableElement[];
  selectedEditableId?: string | null;
  onSelectEditableId?: (editableId: string, slideIndex: number) => void;
  onDeselectAll?: () => void;
  onTextCommit?: (editableId: string, text: string, html: string, slideIndex: number) => void;
  onTransform?: (editableId: string, patch: HtmlElementPatch, slideIndex: number) => void;
  onRequestUndo?: () => void;
  onRequestRedo?: () => void;
  onRequestSave?: () => void;
  onRequestDeleteSelected?: () => void;
  showHeader?: boolean;
  className?: string;
  bodyClassName?: string;
  previewLabel?: string;
};

export const HtmlSlidePreview = forwardRef<HtmlSlidePreviewHandle, Props>(function HtmlSlidePreview(props, ref) {
  const {
    html,
    title,
    slideIndex = 0,
    aspectRatio,
    interactive,
    documentKey,
    elements = [],
    selectedEditableId,
    onSelectEditableId,
    onDeselectAll,
    onTextCommit,
    onTransform,
    onRequestUndo,
    onRequestRedo,
    onRequestSave,
    onRequestDeleteSelected,
    showHeader = true,
    className,
    bodyClassName,
    previewLabel,
  } = props;

  const rendered = useHtmlSlideRenderer({
    html,
    aspectRatio: aspectRatio || "3:4",
    interactive,
    slideIndex,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [scale, setScale] = useState(1);

  const lastLoadedKeyRef = useRef<string | null>(null);
  const lastHtmlRef = useRef<string>(String(html || ""));
  const lastElementsRef = useRef<HtmlEditableElement[]>(elements);
  const skipNextStructuralSyncRef = useRef(false);

  const debugLog = useCallback((_stage: string, _payload?: unknown) => {}, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const updateScale = () => {
      const width = node.clientWidth || rendered.dimensions.width;
      setScale(Math.min(width / rendered.dimensions.width, 1));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, [rendered.dimensions.width]);

  const flushInlineEditInIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return null;
    const editing = doc.querySelector('[data-editable-id][contenteditable="true"]') as HTMLElement | null;
    if (!editing) return null;
    const editableId = String(editing.getAttribute("data-editable-id") || "").trim();
    if (!editableId) return null;

    const clone = editing.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-editable-id]").forEach((node) => node.removeAttribute("data-editable-id"));
    clone.querySelectorAll("font").forEach((fontNode) => {
      const font = fontNode as HTMLElement;
      const span = doc.createElement("span");
      if (font.getAttribute("color")) span.style.color = font.getAttribute("color") || "";
      if (font.getAttribute("size")) {
        const sizeMap: Record<string, string> = {
          "1": "8px",
          "2": "10px",
          "3": "12px",
          "4": "14px",
          "5": "18px",
          "6": "24px",
          "7": "36px",
        };
        span.style.fontSize = sizeMap[font.getAttribute("size") || ""] || `${font.getAttribute("size")}px`;
      }
      if (font.getAttribute("face")) span.style.fontFamily = font.getAttribute("face") || "";
      span.innerHTML = font.innerHTML;
      font.parentNode?.replaceChild(span, font);
    });
    clone.querySelectorAll("[style]").forEach((node) => {
      const el = node as HTMLElement;
      el.style.removeProperty("cursor");
      if (!(el.getAttribute("style") || "").trim()) el.removeAttribute("style");
    });

    const innerHtml = String(clone.innerHTML || "").replace(/\s*\n\s*/g, " ").replace(/\s+$/g, "");
    editing.removeAttribute("contenteditable");
    editing.style.outline = "";
    editing.style.outlineOffset = "";
    onTextCommit?.(editableId, editing.textContent || "", innerHtml, slideIndex);
    return { editableId, html: innerHtml };
  }, [onTextCommit, slideIndex]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const loadKey = interactive ? `interactive:${documentKey || title}` : `readonly:${rendered.srcDoc}`;
    if (lastLoadedKeyRef.current === loadKey) return;
    debugLog("iframe-load-cycle", {
      slideIndex,
      title,
      interactive: !!interactive,
      previousLoadKey: lastLoadedKeyRef.current,
      nextLoadKey: loadKey,
      htmlLength: String(html || "").length,
      elementCount: elements.length,
    });
    if (interactive) {
      flushInlineEditInIframe();
    }
    lastLoadedKeyRef.current = loadKey;
    lastHtmlRef.current = String(html || "");
    lastElementsRef.current = elements;
    skipNextStructuralSyncRef.current = false;
    iframe.srcdoc = rendered.srcDoc;
  }, [documentKey, elements, flushInlineEditInIframe, html, interactive, rendered.srcDoc, title]);

  const postToIframe = useCallback((message: HtmlParentToIframeMessage) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    debugLog("post-to-iframe", message);
    iframe.contentWindow.postMessage(message, "*");
  }, [debugLog]);

  const syncStructureInIframe = useCallback(
    (nextHtml: string) => {
      const srcDoc = wrapHtmlDocument({
        html: nextHtml,
        aspectRatio: aspectRatio || "3:4",
        interactive,
        slideIndex,
      });
      postToIframe({ type: HTML_IFRAME_MESSAGE_TYPES.syncDocument, srcDoc });
    },
    [aspectRatio, interactive, postToIframe, slideIndex]
  );

  useImperativeHandle(ref, () => ({
    sendElementUpdate(editableId: string, patch: HtmlElementPatch) {
      skipNextStructuralSyncRef.current = true;
      postToIframe({ type: HTML_IFRAME_MESSAGE_TYPES.updateElement, element: { id: editableId, patch } });
    },
    highlight(editableId: string | null) {
      postToIframe({ type: HTML_IFRAME_MESSAGE_TYPES.highlight, id: editableId });
    },
    flushInlineEdit() {
      if (!flushInlineEditInIframe()) {
        postToIframe({ type: HTML_IFRAME_MESSAGE_TYPES.flushInlineEdit });
      }
    },
    syncStructure(html: string) {
      skipNextStructuralSyncRef.current = true;
      syncStructureInIframe(html);
    },
    sendFontCss(css: string) {
      postToIframe({ type: HTML_IFRAME_MESSAGE_TYPES.updateFontCss, css });
    },
  }), [flushInlineEditInIframe, postToIframe, syncStructureInIframe]);

  useEffect(() => {
    if (!interactive) return;
    const onMessage = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      const d = event?.data as HtmlIframeToParentMessage | undefined;
      if (!d || typeof d.type !== "string") return;
      const messageSlideIndex = typeof d.slideIndex === "number" ? d.slideIndex : slideIndex;

      if (d.type === HTML_IFRAME_MESSAGE_TYPES.elementSelect) {
        const editableId = String(d.editableId || "").trim();
        if (editableId) onSelectEditableId?.(editableId, messageSlideIndex);
      }
      if (d.type === HTML_IFRAME_MESSAGE_TYPES.elementDeselect) {
        onDeselectAll?.();
      }
      if (d.type === HTML_IFRAME_MESSAGE_TYPES.elementTextCommit) {
        const editableId = String(d.editableId || "").trim();
        const text = String(d.text || "");
        const innerHtml = String(d.html || "");
        if (editableId) {
          debugLog("receive-text-commit", { editableId, textLength: text.length, htmlLength: innerHtml.length });
          skipNextStructuralSyncRef.current = true;
          onTextCommit?.(editableId, text, innerHtml, messageSlideIndex);
        }
      }
      if (d.type === HTML_IFRAME_MESSAGE_TYPES.elementTransform) {
        const editableId = String(d.editableId || "").trim();
        if (editableId) {
          debugLog("receive-transform", d);
          skipNextStructuralSyncRef.current = true;
          onTransform?.(editableId, {
            translateX: typeof d.translateX === "string" ? d.translateX : undefined,
            translateY: typeof d.translateY === "string" ? d.translateY : undefined,
            width: typeof d.width === "string" ? d.width : undefined,
            height: typeof d.height === "string" ? d.height : undefined,
            rotate: typeof d.rotate === "string" ? d.rotate : undefined,
          }, messageSlideIndex);
        }
      }
      if (d.type === HTML_IFRAME_MESSAGE_TYPES.requestUndo) {
        onRequestUndo?.();
      }
      if (d.type === HTML_IFRAME_MESSAGE_TYPES.requestRedo) {
        onRequestRedo?.();
      }
      if (d.type === HTML_IFRAME_MESSAGE_TYPES.requestSave) {
        onRequestSave?.();
      }
      if (d.type === HTML_IFRAME_MESSAGE_TYPES.requestDeleteSelected) {
        onRequestDeleteSelected?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [interactive, onDeselectAll, onRequestDeleteSelected, onRequestRedo, onRequestSave, onRequestUndo, onSelectEditableId, onTextCommit, onTransform, slideIndex]);

  useEffect(() => {
    if (!interactive) return;
    postToIframe({ type: HTML_IFRAME_MESSAGE_TYPES.highlight, id: selectedEditableId || null });
  }, [interactive, selectedEditableId, postToIframe]);

  useEffect(() => {
    if (!interactive) {
      debugLog("inactive-preview-state", {
        slideIndex,
        htmlLength: String(html || "").length,
        elementCount: elements.length,
      });
      lastElementsRef.current = elements;
      return;
    }

    const previous = lastElementsRef.current;
    const previousById = new Map(previous.map((element) => [element.id, JSON.stringify(elementStateToPatch(element))]));
    const changed = elements
      .filter((element) => previousById.get(element.id) !== JSON.stringify(elementStateToPatch(element)))
      .map((element) => ({
        id: element.id,
        patch: elementStateToPatch(element),
      }));

    lastElementsRef.current = elements;
    if (changed.length === 0) return;
    debugLog("send-update-elements", {
      changedCount: changed.length,
      changed,
    });
    postToIframe({ type: HTML_IFRAME_MESSAGE_TYPES.updateElements, elements: changed });
  }, [debugLog, elements, interactive, postToIframe]);

  useEffect(() => {
    if (!interactive) {
      debugLog("inactive-structural-state", {
        slideIndex,
        htmlLength: String(html || "").length,
      });
      lastHtmlRef.current = String(html || "");
      return;
    }
    const nextHtml = String(html || "");
    if (nextHtml === lastHtmlRef.current) return;
    if (skipNextStructuralSyncRef.current) {
      debugLog("skip-structural-sync", {
        previousHtmlLength: lastHtmlRef.current.length,
        nextHtmlLength: nextHtml.length,
      });
      skipNextStructuralSyncRef.current = false;
      lastHtmlRef.current = nextHtml;
      return;
    }
    debugLog("run-structural-sync", {
      previousHtmlLength: lastHtmlRef.current.length,
      nextHtmlLength: nextHtml.length,
    });
    syncStructureInIframe(nextHtml);
    lastHtmlRef.current = nextHtml;
  }, [debugLog, html, interactive, syncStructureInIframe]);

  return (
    <div className={["w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm", className || ""].join(" ").trim()}>
      {showHeader ? (
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-xs text-slate-500">
            {previewLabel || (interactive ? "Interactive iframe preview" : "Read-only iframe preview")}
          </div>
        </div>
      ) : null}
      <div className={bodyClassName || "p-4"}>
        <div ref={containerRef} className="relative w-full overflow-hidden rounded-2xl bg-slate-100" style={{ paddingBottom: rendered.paddingBottom }}>
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: rendered.dimensions.width,
              height: rendered.dimensions.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <iframe
              ref={iframeRef}
              title={title}
              sandbox={interactive ? "allow-same-origin allow-scripts" : "allow-same-origin"}
              className="block border-0 bg-white"
              style={{ width: rendered.dimensions.width, height: rendered.dimensions.height }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
