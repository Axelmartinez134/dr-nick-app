"use client";

import type { HtmlElementPatch } from "../models/htmlElementModel";

export const HTML_IFRAME_MESSAGE_TYPES = {
  highlight: "highlight",
  flushInlineEdit: "flush-inline-edit",
  syncDocument: "sync-document",
  updateElement: "update-element",
  updateElements: "update-elements",
  updateFontCss: "update-font-css",
  elementSelect: "html-element-select",
  elementHover: "html-element-hover",
  elementDeselect: "html-element-deselect",
  elementTextCommit: "html-element-text-commit",
  elementTransform: "html-element-transform",
  requestUndo: "html-request-undo",
  requestRedo: "html-request-redo",
  requestSave: "html-request-save",
  requestDeleteSelected: "html-request-delete-selected",
} as const;

export type HtmlParentToIframeMessage =
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.highlight;
      id: string | null;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.flushInlineEdit;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.syncDocument;
      srcDoc: string;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.updateElement;
      element: {
        id: string;
        patch: HtmlElementPatch;
      };
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.updateElements;
      elements: Array<{
        id: string;
        patch: HtmlElementPatch;
      }>;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.updateFontCss;
      css: string;
    };

export type HtmlIframeToParentMessage =
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.elementSelect;
      editableId: string;
      slideIndex?: number;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.elementHover;
      editableId: string;
      slideIndex?: number;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.elementDeselect;
      slideIndex?: number;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.elementTextCommit;
      editableId: string;
      text: string;
      html: string;
      slideIndex?: number;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.elementTransform;
      editableId: string;
      translateX?: string;
      translateY?: string;
      width?: string;
      height?: string;
      rotate?: string;
      slideIndex?: number;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.requestUndo;
      slideIndex?: number;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.requestRedo;
      slideIndex?: number;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.requestSave;
      slideIndex?: number;
    }
  | {
      type: typeof HTML_IFRAME_MESSAGE_TYPES.requestDeleteSelected;
      slideIndex?: number;
    };
