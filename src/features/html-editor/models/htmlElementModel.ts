"use client";

export type HtmlSlotType = "background" | "main" | "logo" | "icon" | "profile";

export type HtmlElementGeometry = {
  translateX: string;
  translateY: string;
  width: string;
  height: string;
  rotate: string;
  deleted: boolean;
  originalTranslateX: string;
  originalTranslateY: string;
  originalWidth: string;
  originalHeight: string;
  originalRotate: string;
};

type HtmlEditableElementBase = HtmlElementGeometry & {
  id: string;
  type: "text" | "image-slot" | "image" | "block";
  tagName: string;
  label: string;
  selectable: boolean;
  transformable: boolean;
  listable: boolean;
};

export type HtmlTextElement = HtmlEditableElementBase & {
  type: "text";
  text: string;
  html: string;
  richHtml: boolean;
  color: string;
  backgroundColor: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  letterSpacing: string;
  lineHeight: string;
  textAlign: string;
  textTransform: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  borderRadius: string;
  originalFontFamily: string;
  originalFontSize: string;
  originalColor: string;
  originalBackgroundColor: string;
  originalFontStyle: string;
  originalTextDecoration: string;
  originalLetterSpacing: string;
  originalLineHeight: string;
  originalTextAlign: string;
  originalMarginTop: string;
  originalMarginRight: string;
  originalMarginBottom: string;
  originalMarginLeft: string;
};

export type HtmlImageSlotElement = HtmlEditableElementBase & {
  type: "image-slot";
  backgroundImage: string;
  backgroundColor: string;
  backgroundSize: string;
  backgroundPosition: string;
  borderRadius: string;
  slotId: string;
  slotType: HtmlSlotType;
  slotLabel: string;
  searchQuery: string;
  originalBackgroundColor: string;
};

export type HtmlImageElement = HtmlEditableElementBase & {
  type: "image";
  src: string;
  borderRadius: string;
  objectFit: string;
  backgroundColor: string;
  backgroundSize: string;
  backgroundPosition: string;
  originalBackgroundColor: string;
};

export type HtmlBlockElement = HtmlEditableElementBase & {
  type: "block";
  backgroundColor: string;
  borderRadius: string;
  opacity: string;
  border: string;
  originalBackgroundColor: string;
};

export type HtmlEditableElement =
  | HtmlTextElement
  | HtmlImageSlotElement
  | HtmlImageElement
  | HtmlBlockElement;

export type HtmlSlotAttributes = {
  slotId: string;
  slotType: HtmlSlotType;
  slotLabel: string;
  searchQuery: string;
};

export type HtmlElementPatch = Partial<{
  text: string;
  html: string;
  richHtml: boolean;
  color: string;
  backgroundColor: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  letterSpacing: string;
  lineHeight: string;
  textAlign: string;
  textTransform: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  borderRadius: string;
  opacity: string;
  border: string;
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  objectFit: string;
  src: string;
  searchQuery: string;
  translateX: string;
  translateY: string;
  width: string;
  height: string;
  rotate: string;
  deleted: boolean;
  originalTranslateX: string;
  originalTranslateY: string;
  originalWidth: string;
  originalHeight: string;
  originalRotate: string;
  originalFontFamily: string;
  originalFontSize: string;
  originalColor: string;
  originalBackgroundColor: string;
  originalFontStyle: string;
  originalTextDecoration: string;
  originalLetterSpacing: string;
  originalLineHeight: string;
  originalTextAlign: string;
  originalMarginTop: string;
  originalMarginRight: string;
  originalMarginBottom: string;
  originalMarginLeft: string;
  selectable: boolean;
  transformable: boolean;
  listable: boolean;
}>;

export function createDefaultHtmlGeometry(): HtmlElementGeometry {
  return {
    translateX: "",
    translateY: "",
    width: "",
    height: "",
    rotate: "",
    deleted: false,
    originalTranslateX: "",
    originalTranslateY: "",
    originalWidth: "",
    originalHeight: "",
    originalRotate: "",
  };
}
