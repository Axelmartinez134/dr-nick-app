"use client";

import { parseHtmlElements } from "../hooks/useHtmlElementParser";
import { renderHtmlFromElementPatches } from "../hooks/useHtmlElementSerializer";
import type { HtmlEditableElement, HtmlElementPatch } from "../models/htmlElementModel";

export type HtmlSlidePageState = {
  baseHtml: string;
  elements: HtmlEditableElement[];
};

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripTags(value: string) {
  if (typeof window === "undefined") {
    return String(value || "").replace(/<[^>]*>/g, "");
  }
  const doc = new DOMParser().parseFromString(`<div>${String(value || "")}</div>`, "text/html");
  return String(doc.body.textContent || "");
}

export function createHtmlSlidePageState(html: string): HtmlSlidePageState {
  const parsed = parseHtmlElements(String(html || ""));
  return {
    baseHtml: parsed.normalizedHtml,
    elements: parsed.elements,
  };
}

export function elementStateToPatch(element: HtmlEditableElement): HtmlElementPatch {
  const base: HtmlElementPatch = {
    translateX: element.translateX,
    translateY: element.translateY,
    width: element.width,
    height: element.height,
    rotate: element.rotate,
    deleted: element.deleted,
    originalTranslateX: element.originalTranslateX,
    originalTranslateY: element.originalTranslateY,
    originalWidth: element.originalWidth,
    originalHeight: element.originalHeight,
    originalRotate: element.originalRotate,
    selectable: element.selectable,
    transformable: element.transformable,
    listable: element.listable,
  };

  if (element.type === "text") {
    return {
      ...base,
      text: element.text,
      html: element.html,
      richHtml: element.richHtml,
      color: element.color,
      backgroundColor: element.backgroundColor,
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      fontWeight: element.fontWeight,
      fontStyle: element.fontStyle,
      textDecoration: element.textDecoration,
      letterSpacing: element.letterSpacing,
      lineHeight: element.lineHeight,
      textAlign: element.textAlign,
      textTransform: element.textTransform,
      marginTop: element.marginTop,
      marginRight: element.marginRight,
      marginBottom: element.marginBottom,
      marginLeft: element.marginLeft,
      borderRadius: element.borderRadius,
      originalFontFamily: element.originalFontFamily,
      originalFontSize: element.originalFontSize,
      originalColor: element.originalColor,
      originalBackgroundColor: element.originalBackgroundColor,
      originalFontStyle: element.originalFontStyle,
      originalTextDecoration: element.originalTextDecoration,
      originalLetterSpacing: element.originalLetterSpacing,
      originalLineHeight: element.originalLineHeight,
      originalTextAlign: element.originalTextAlign,
      originalMarginTop: element.originalMarginTop,
      originalMarginRight: element.originalMarginRight,
      originalMarginBottom: element.originalMarginBottom,
      originalMarginLeft: element.originalMarginLeft,
    };
  }

  if (element.type === "image-slot") {
    return {
      ...base,
      backgroundImage: element.backgroundImage,
      backgroundColor: element.backgroundColor,
      backgroundSize: element.backgroundSize,
      backgroundPosition: element.backgroundPosition,
      borderRadius: element.borderRadius,
      searchQuery: element.searchQuery,
      originalBackgroundColor: element.originalBackgroundColor,
    };
  }

  if (element.type === "image") {
    return {
      ...base,
      src: element.src,
      borderRadius: element.borderRadius,
      objectFit: element.objectFit,
      backgroundColor: element.backgroundColor,
      backgroundSize: element.backgroundSize,
      backgroundPosition: element.backgroundPosition,
      originalBackgroundColor: element.originalBackgroundColor,
    };
  }

  return {
    ...base,
    backgroundColor: element.backgroundColor,
    borderRadius: element.borderRadius,
    opacity: element.opacity,
    border: element.border,
    originalBackgroundColor: element.originalBackgroundColor,
  };
}

export function patchHtmlSlidePageState(
  state: HtmlSlidePageState,
  editableId: string,
  patch: HtmlElementPatch
): HtmlSlidePageState {
  return {
    ...state,
    elements: state.elements.map((element) => {
      if (element.id !== editableId) return element;

      const common = {
        ...element,
        translateX: typeof patch.translateX === "string" ? patch.translateX : element.translateX,
        translateY: typeof patch.translateY === "string" ? patch.translateY : element.translateY,
        width: typeof patch.width === "string" ? patch.width : element.width,
        height: typeof patch.height === "string" ? patch.height : element.height,
        rotate: typeof patch.rotate === "string" ? patch.rotate : element.rotate,
        deleted: typeof patch.deleted === "boolean" ? patch.deleted : element.deleted,
        originalTranslateX:
          typeof patch.originalTranslateX === "string" ? patch.originalTranslateX : element.originalTranslateX,
        originalTranslateY:
          typeof patch.originalTranslateY === "string" ? patch.originalTranslateY : element.originalTranslateY,
        originalWidth: typeof patch.originalWidth === "string" ? patch.originalWidth : element.originalWidth,
        originalHeight: typeof patch.originalHeight === "string" ? patch.originalHeight : element.originalHeight,
        originalRotate: typeof patch.originalRotate === "string" ? patch.originalRotate : element.originalRotate,
        selectable: typeof patch.selectable === "boolean" ? patch.selectable : element.selectable,
        transformable: typeof patch.transformable === "boolean" ? patch.transformable : element.transformable,
        listable: typeof patch.listable === "boolean" ? patch.listable : element.listable,
      };

      if (element.type === "text") {
        const nextHtml =
          typeof patch.html === "string"
            ? patch.html
            : typeof patch.text === "string"
              ? escapeHtml(patch.text)
              : element.html;
        const nextText =
          typeof patch.text === "string"
            ? patch.text
            : typeof patch.html === "string"
              ? stripTags(patch.html)
              : element.text;

        return {
          ...common,
          type: "text",
          text: nextText,
          html: nextHtml,
          richHtml: typeof patch.html === "string" ? /<(span|b|i|em|strong|br)\b/i.test(nextHtml) : typeof patch.text === "string" ? false : element.richHtml,
          color: typeof patch.color === "string" ? patch.color : element.color,
          backgroundColor: typeof patch.backgroundColor === "string" ? patch.backgroundColor : element.backgroundColor,
          fontSize: typeof patch.fontSize === "string" ? patch.fontSize : element.fontSize,
          fontFamily: typeof patch.fontFamily === "string" ? patch.fontFamily : element.fontFamily,
          fontWeight: typeof patch.fontWeight === "string" ? patch.fontWeight : element.fontWeight,
          fontStyle: typeof patch.fontStyle === "string" ? patch.fontStyle : element.fontStyle,
          textDecoration: typeof patch.textDecoration === "string" ? patch.textDecoration : element.textDecoration,
          letterSpacing: typeof patch.letterSpacing === "string" ? patch.letterSpacing : element.letterSpacing,
          lineHeight: typeof patch.lineHeight === "string" ? patch.lineHeight : element.lineHeight,
          textAlign: typeof patch.textAlign === "string" ? patch.textAlign : element.textAlign,
          textTransform: typeof patch.textTransform === "string" ? patch.textTransform : element.textTransform,
          marginTop: typeof patch.marginTop === "string" ? patch.marginTop : element.marginTop,
          marginRight: typeof patch.marginRight === "string" ? patch.marginRight : element.marginRight,
          marginBottom: typeof patch.marginBottom === "string" ? patch.marginBottom : element.marginBottom,
          marginLeft: typeof patch.marginLeft === "string" ? patch.marginLeft : element.marginLeft,
          borderRadius: typeof patch.borderRadius === "string" ? patch.borderRadius : element.borderRadius,
          originalFontFamily: typeof patch.originalFontFamily === "string" ? patch.originalFontFamily : element.originalFontFamily,
          originalFontSize: typeof patch.originalFontSize === "string" ? patch.originalFontSize : element.originalFontSize,
          originalColor: typeof patch.originalColor === "string" ? patch.originalColor : element.originalColor,
          originalBackgroundColor: typeof patch.originalBackgroundColor === "string" ? patch.originalBackgroundColor : element.originalBackgroundColor,
          originalFontStyle: typeof patch.originalFontStyle === "string" ? patch.originalFontStyle : element.originalFontStyle,
          originalTextDecoration:
            typeof patch.originalTextDecoration === "string" ? patch.originalTextDecoration : element.originalTextDecoration,
          originalLetterSpacing:
            typeof patch.originalLetterSpacing === "string" ? patch.originalLetterSpacing : element.originalLetterSpacing,
          originalLineHeight:
            typeof patch.originalLineHeight === "string" ? patch.originalLineHeight : element.originalLineHeight,
          originalTextAlign:
            typeof patch.originalTextAlign === "string" ? patch.originalTextAlign : element.originalTextAlign,
          originalMarginTop:
            typeof patch.originalMarginTop === "string" ? patch.originalMarginTop : element.originalMarginTop,
          originalMarginRight:
            typeof patch.originalMarginRight === "string" ? patch.originalMarginRight : element.originalMarginRight,
          originalMarginBottom:
            typeof patch.originalMarginBottom === "string" ? patch.originalMarginBottom : element.originalMarginBottom,
          originalMarginLeft:
            typeof patch.originalMarginLeft === "string" ? patch.originalMarginLeft : element.originalMarginLeft,
        };
      }

      if (element.type === "image-slot") {
        return {
          ...common,
          type: "image-slot",
          backgroundImage: typeof patch.backgroundImage === "string" ? patch.backgroundImage : element.backgroundImage,
          backgroundColor: typeof patch.backgroundColor === "string" ? patch.backgroundColor : element.backgroundColor,
          backgroundSize: typeof patch.backgroundSize === "string" ? patch.backgroundSize : element.backgroundSize,
          backgroundPosition: typeof patch.backgroundPosition === "string" ? patch.backgroundPosition : element.backgroundPosition,
          borderRadius: typeof patch.borderRadius === "string" ? patch.borderRadius : element.borderRadius,
          slotId: element.slotId,
          slotType: element.slotType,
          slotLabel: element.slotLabel,
          searchQuery: typeof patch.searchQuery === "string" ? patch.searchQuery : element.searchQuery,
          originalBackgroundColor: typeof patch.originalBackgroundColor === "string" ? patch.originalBackgroundColor : element.originalBackgroundColor,
        };
      }

      if (element.type === "image") {
        return {
          ...common,
          type: "image",
          src: typeof patch.src === "string" ? patch.src : element.src,
          borderRadius: typeof patch.borderRadius === "string" ? patch.borderRadius : element.borderRadius,
          objectFit: typeof patch.objectFit === "string" ? patch.objectFit : element.objectFit,
          backgroundColor: typeof patch.backgroundColor === "string" ? patch.backgroundColor : element.backgroundColor,
          backgroundSize: typeof patch.backgroundSize === "string" ? patch.backgroundSize : element.backgroundSize,
          backgroundPosition: typeof patch.backgroundPosition === "string" ? patch.backgroundPosition : element.backgroundPosition,
          originalBackgroundColor: typeof patch.originalBackgroundColor === "string" ? patch.originalBackgroundColor : element.originalBackgroundColor,
        };
      }

      return {
        ...common,
        type: "block",
        backgroundColor: typeof patch.backgroundColor === "string" ? patch.backgroundColor : element.backgroundColor,
        borderRadius: typeof patch.borderRadius === "string" ? patch.borderRadius : element.borderRadius,
        opacity: typeof patch.opacity === "string" ? patch.opacity : element.opacity,
        border: typeof patch.border === "string" ? patch.border : element.border,
        originalBackgroundColor: typeof patch.originalBackgroundColor === "string" ? patch.originalBackgroundColor : element.originalBackgroundColor,
      };
    }),
  };
}

export function renderHtmlSlidePageState(state: HtmlSlidePageState) {
  return renderHtmlFromElementPatches(
    state.baseHtml,
    state.elements.map((element) => ({
      id: element.id,
      patch: elementStateToPatch(element),
    }))
  );
}
