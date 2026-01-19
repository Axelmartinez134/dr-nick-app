import { useCallback, useEffect, useState } from "react";

export type CanvasTextSelectionState = {
  active: boolean;
  lineKey?: string;
  lineIndex?: number;
  block: "HEADLINE" | "BODY";
  // Raw Fabric selection (cursor or highlight)
  selectionStart: number;
  selectionEnd: number;
  // Effective range we apply changes to (full object if no highlight)
  rangeStart: number;
  rangeEnd: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
};

export function useCanvasTextStyling(params: {
  canvasRef: any;
  activeSlideIndex: number;
  currentProjectId: string | null;
  activeCanvasNonce: number;
  applyInlineStyleFromCanvas: (args: {
    lineKey?: string;
    lineIndex?: number;
    block?: "HEADLINE" | "BODY";
    selectionStart: number;
    selectionEnd: number;
    mark: "bold" | "italic" | "underline";
    enabled: boolean;
    preserveCanvasEditing?: boolean;
  }) => void;
}) {
  const { canvasRef, activeSlideIndex, currentProjectId, activeCanvasNonce, applyInlineStyleFromCanvas } = params;

  const [canvasTextSelection, setCanvasTextSelection] = useState<CanvasTextSelectionState | null>(null);

  const computeCanvasTextSelectionState = useCallback(() => {
    try {
      const c = (canvasRef as any)?.current?.canvas;
      if (!c || typeof c.getActiveObject !== "function") {
        setCanvasTextSelection(null);
        return;
      }
      const obj = c.getActiveObject();
      const t = String(obj?.type || "").toLowerCase();
      const isTextObj = !!obj && (t === "i-text" || t === "textbox" || t === "text");
      const isUserText = String(obj?.data?.role || "") === "user-text";
      if (!isTextObj || !isUserText) {
        setCanvasTextSelection(null);
        return;
      }
      const text = String(obj?.text || "");
      const rawA = Number(obj?.selectionStart ?? 0);
      const rawB = Number(obj?.selectionEnd ?? rawA);
      const selA = Number.isFinite(rawA) ? Math.max(0, Math.min(text.length, Math.floor(rawA))) : 0;
      const selB = Number.isFinite(rawB) ? Math.max(0, Math.min(text.length, Math.floor(rawB))) : selA;
      const hasHighlight = selA !== selB;
      const rangeStart = hasHighlight ? Math.min(selA, selB) : 0;
      const rangeEnd = hasHighlight ? Math.max(selA, selB) : text.length;

      const baseBold = obj?.fontWeight === "bold" || obj?.fontWeight === 700;
      const baseItalic = obj?.fontStyle === "italic";
      const baseUnderline = !!obj?.underline;
      let styles: any[] = [];
      if (typeof obj?.getSelectionStyles === "function" && rangeEnd > rangeStart) {
        styles = obj.getSelectionStyles(rangeStart, rangeEnd) || [];
      }
      const getBoldForStyle = (s: any) => {
        const w = s?.fontWeight;
        if (w == null) return baseBold;
        return w === "bold" || w === 700;
      };
      const getItalicForStyle = (s: any) => {
        const st = s?.fontStyle;
        if (st == null) return baseItalic;
        return st === "italic";
      };
      const getUnderlineForStyle = (s: any) => {
        const u = s?.underline;
        if (u == null) return baseUnderline;
        return !!u;
      };
      const allBold = styles.length ? styles.every(getBoldForStyle) : baseBold;
      const allItalic = styles.length ? styles.every(getItalicForStyle) : baseItalic;
      const allUnderline = styles.length ? styles.every(getUnderlineForStyle) : baseUnderline;

      setCanvasTextSelection({
        active: true,
        lineKey: obj?.data?.lineKey,
        lineIndex: obj?.data?.lineIndex,
        block: String(obj?.data?.block || "").toUpperCase() === "HEADLINE" ? "HEADLINE" : "BODY",
        selectionStart: selA,
        selectionEnd: selB,
        rangeStart,
        rangeEnd,
        isBold: allBold,
        isItalic: allItalic,
        isUnderline: allUnderline,
      });
    } catch {
      setCanvasTextSelection(null);
    }
  }, [canvasRef]);

  useEffect(() => {
    const c = (canvasRef as any)?.current?.canvas;
    if (!c) {
      setCanvasTextSelection(null);
      return;
    }
    computeCanvasTextSelectionState();

    const onUpdate = () => computeCanvasTextSelectionState();
    try {
      c.on?.("selection:created", onUpdate);
      c.on?.("selection:updated", onUpdate);
      c.on?.("selection:cleared", onUpdate);
      c.on?.("mouse:up", onUpdate);
      c.on?.("text:editing:entered", onUpdate);
      c.on?.("text:editing:exited", onUpdate);
      c.on?.("text:selection:changed", onUpdate);
    } catch {
      // ignore
    }
    return () => {
      try {
        c.off?.("selection:created", onUpdate);
        c.off?.("selection:updated", onUpdate);
        c.off?.("selection:cleared", onUpdate);
        c.off?.("mouse:up", onUpdate);
        c.off?.("text:editing:entered", onUpdate);
        c.off?.("text:editing:exited", onUpdate);
        c.off?.("text:selection:changed", onUpdate);
      } catch {
        // ignore
      }
    };
  }, [activeSlideIndex, currentProjectId, activeCanvasNonce, computeCanvasTextSelectionState]);

  const reselectUserTextObjectSoon = useCallback(
    (opts: {
      lineKey?: string;
      lineIndex?: number;
      block?: "HEADLINE" | "BODY";
      // If the user was actively editing, preserve editing + selection range.
      wasEditing: boolean;
      selectionStart: number;
      selectionEnd: number;
    }) => {
      const { lineKey, lineIndex, block, wasEditing, selectionStart, selectionEnd } = opts;

      const tryReselect = () => {
        const c = (canvasRef as any)?.current?.canvas;
        if (!c || typeof c.getObjects !== "function" || typeof c.setActiveObject !== "function") return false;
        const objects: any[] = c.getObjects() || [];

        const wantBlock = String(block || "").toUpperCase() === "HEADLINE" ? "HEADLINE" : "BODY";
        const match =
          (lineKey
            ? objects.find(
                (o) =>
                  String(o?.data?.role || "") === "user-text" &&
                  String(o?.data?.lineKey || "") === String(lineKey) &&
                  String(o?.data?.block || "").toUpperCase() === wantBlock
              )
            : null) ||
          (Number.isFinite(lineIndex as any)
            ? objects.find(
                (o) =>
                  String(o?.data?.role || "") === "user-text" &&
                  Number(o?.data?.lineIndex) === Number(lineIndex) &&
                  String(o?.data?.block || "").toUpperCase() === wantBlock
              )
            : null) ||
          null;
        if (!match) return false;

        try {
          c.setActiveObject(match);
          if (wasEditing && typeof match?.enterEditing === "function") match.enterEditing();
          if (wasEditing && typeof match?.setSelectionStart === "function") match.setSelectionStart(selectionStart);
          if (wasEditing && typeof match?.setSelectionEnd === "function") match.setSelectionEnd(selectionEnd);
          c.requestRenderAll?.();
        } catch {
          // ignore
        }
        return true;
      };

      // React state updates can recreate Fabric objects; wait a tick, then reselect.
      setTimeout(() => {
        if (tryReselect()) {
          computeCanvasTextSelectionState();
          return;
        }
        // One more try next frame in case the canvas updates slightly later.
        requestAnimationFrame(() => {
          tryReselect();
          computeCanvasTextSelectionState();
        });
      }, 0);
    },
    [canvasRef, computeCanvasTextSelectionState]
  );

  const applyCanvasInlineMark = useCallback(
    (mark: "bold" | "italic" | "underline", enabled: boolean) => {
      const c = (canvasRef as any)?.current?.canvas;
      if (!c || typeof c.getActiveObject !== "function") return;
      const obj = c.getActiveObject();
      const t = String(obj?.type || "").toLowerCase();
      const isTextObj = !!obj && (t === "i-text" || t === "textbox" || t === "text");
      const isUserText = String(obj?.data?.role || "") === "user-text";
      if (!isTextObj || !isUserText) return;

      const state = canvasTextSelection;
      const text = String(obj?.text || "");
      const prevSelStart =
        state && state.active ? Math.max(0, Math.min(text.length, Math.floor(Number(state.selectionStart) || 0))) : 0;
      const prevSelEnd =
        state && state.active ? Math.max(0, Math.min(text.length, Math.floor(Number(state.selectionEnd) || 0))) : prevSelStart;
      const wasEditing = !!(obj as any)?.isEditing;
      const rangeStart =
        state && state.active ? Math.max(0, Math.min(text.length, Math.floor(Number(state.rangeStart) || 0))) : 0;
      const rangeEnd =
        state && state.active ? Math.max(0, Math.min(text.length, Math.floor(Number(state.rangeEnd) || 0))) : text.length;
      if (rangeEnd <= rangeStart) return;

      if (mark === "bold") {
        obj.setSelectionStyles?.({ fontWeight: enabled ? "bold" : "normal" }, rangeStart, rangeEnd);
      } else if (mark === "italic") {
        obj.setSelectionStyles?.({ fontStyle: enabled ? "italic" : "normal" }, rangeStart, rangeEnd);
      } else {
        obj.setSelectionStyles?.({ underline: enabled }, rangeStart, rangeEnd);
      }
      try {
        // Keep the same object active and restore highlight/cursor.
        if (typeof c.setActiveObject === "function") c.setActiveObject(obj);
        if (wasEditing && typeof (obj as any).enterEditing === "function") (obj as any).enterEditing();
        if (typeof (obj as any).setSelectionStart === "function") (obj as any).setSelectionStart(prevSelStart);
        if (typeof (obj as any).setSelectionEnd === "function") (obj as any).setSelectionEnd(prevSelEnd);
        c.requestRenderAll?.();
      } catch {
        // ignore
      }

      applyInlineStyleFromCanvas({
        lineKey: obj?.data?.lineKey,
        lineIndex: obj?.data?.lineIndex,
        block: String(obj?.data?.block || "").toUpperCase() === "HEADLINE" ? "HEADLINE" : "BODY",
        selectionStart: rangeStart,
        selectionEnd: rangeEnd,
        mark,
        enabled,
        preserveCanvasEditing: wasEditing,
      });
      computeCanvasTextSelectionState();

      // If we weren't in active editing mode, engine state updates can recreate Fabric objects
      // and drop the active selection. Reselect the same logical object.
      if (!wasEditing) {
        reselectUserTextObjectSoon({
          lineKey: obj?.data?.lineKey,
          lineIndex: obj?.data?.lineIndex,
          block: String(obj?.data?.block || "").toUpperCase() === "HEADLINE" ? "HEADLINE" : "BODY",
          wasEditing: false,
          selectionStart: prevSelStart,
          selectionEnd: prevSelEnd,
        });
      }
    },
    [applyInlineStyleFromCanvas, canvasRef, canvasTextSelection, computeCanvasTextSelectionState, reselectUserTextObjectSoon]
  );

  const clearCanvasInlineMarks = useCallback(() => {
    const c = (canvasRef as any)?.current?.canvas;
    if (!c || typeof c.getActiveObject !== "function") return;
    const obj = c.getActiveObject();
    const t = String(obj?.type || "").toLowerCase();
    const isTextObj = !!obj && (t === "i-text" || t === "textbox" || t === "text");
    const isUserText = String(obj?.data?.role || "") === "user-text";
    if (!isTextObj || !isUserText) return;

    const state = canvasTextSelection;
    const text = String(obj?.text || "");
    const prevSelStart =
      state && state.active ? Math.max(0, Math.min(text.length, Math.floor(Number(state.selectionStart) || 0))) : 0;
    const prevSelEnd =
      state && state.active ? Math.max(0, Math.min(text.length, Math.floor(Number(state.selectionEnd) || 0))) : prevSelStart;
    const wasEditing = !!(obj as any)?.isEditing;
    const rangeStart =
      state && state.active ? Math.max(0, Math.min(text.length, Math.floor(Number(state.rangeStart) || 0))) : 0;
    const rangeEnd =
      state && state.active ? Math.max(0, Math.min(text.length, Math.floor(Number(state.rangeEnd) || 0))) : text.length;
    if (rangeEnd <= rangeStart) return;

    obj.setSelectionStyles?.({ fontWeight: "normal", fontStyle: "normal", underline: false }, rangeStart, rangeEnd);
    try {
      if (typeof c.setActiveObject === "function") c.setActiveObject(obj);
      if (wasEditing && typeof (obj as any).enterEditing === "function") (obj as any).enterEditing();
      if (typeof (obj as any).setSelectionStart === "function") (obj as any).setSelectionStart(prevSelStart);
      if (typeof (obj as any).setSelectionEnd === "function") (obj as any).setSelectionEnd(prevSelEnd);
      c.requestRenderAll?.();
    } catch {
      // ignore
    }
    const block: "HEADLINE" | "BODY" = String(obj?.data?.block || "").toUpperCase() === "HEADLINE" ? "HEADLINE" : "BODY";
    applyInlineStyleFromCanvas({
      lineKey: obj?.data?.lineKey,
      lineIndex: obj?.data?.lineIndex,
      block,
      selectionStart: rangeStart,
      selectionEnd: rangeEnd,
      mark: "bold",
      enabled: false,
      preserveCanvasEditing: wasEditing,
    });
    applyInlineStyleFromCanvas({
      lineKey: obj?.data?.lineKey,
      lineIndex: obj?.data?.lineIndex,
      block,
      selectionStart: rangeStart,
      selectionEnd: rangeEnd,
      mark: "italic",
      enabled: false,
      preserveCanvasEditing: wasEditing,
    });
    applyInlineStyleFromCanvas({
      lineKey: obj?.data?.lineKey,
      lineIndex: obj?.data?.lineIndex,
      block,
      selectionStart: rangeStart,
      selectionEnd: rangeEnd,
      mark: "underline",
      enabled: false,
      preserveCanvasEditing: wasEditing,
    });
    computeCanvasTextSelectionState();

    if (!wasEditing) {
      reselectUserTextObjectSoon({
        lineKey: obj?.data?.lineKey,
        lineIndex: obj?.data?.lineIndex,
        block,
        wasEditing: false,
        selectionStart: prevSelStart,
        selectionEnd: prevSelEnd,
      });
    }
  }, [applyInlineStyleFromCanvas, canvasRef, canvasTextSelection, computeCanvasTextSelectionState, reselectUserTextObjectSoon]);

  return { canvasTextSelection, applyCanvasInlineMark, clearCanvasInlineMarks };
}

