import { useCallback, useEffect } from "react";

export function useActiveImageSelection(params: {
  canvasRef: any;
  activeSlideIndex: number;
  activeCanvasNonce: number;
  // Used only to re-attach listeners when the active slide's layout swaps.
  activeLayout: any;
  setActiveImageSelected: (next: boolean) => void;
}) {
  const { canvasRef, activeSlideIndex, activeCanvasNonce, activeLayout, setActiveImageSelected } = params;

  const syncActiveImageSelected = useCallback(() => {
    try {
      const c = (canvasRef as any)?.current?.canvas;
      const obj = c?.getActiveObject?.() || null;
      const role = obj?.data?.role || null;
      setActiveImageSelected(role === "user-image");
    } catch {
      setActiveImageSelected(false);
    }
  }, [canvasRef]);

  // Track whether the active canvas selection is the user image, so we can show a Delete button.
  useEffect(() => {
    const c = (canvasRef as any)?.current?.canvas;
    if (!c || typeof c.on !== "function") {
      // Canvas may not be mounted yet; re-run when `activeCanvasNonce` changes.
      setActiveImageSelected(false);
      return;
    }
    const onSel = () => syncActiveImageSelected();
    try {
      c.on("selection:created", onSel);
      c.on("selection:updated", onSel);
      c.on("selection:cleared", onSel);
      c.on("mouse:down", onSel);
    } catch {
      // ignore
    }
    // Initialize
    onSel();
    return () => {
      try {
        c.off("selection:created", onSel);
        c.off("selection:updated", onSel);
        c.off("selection:cleared", onSel);
        c.off("mouse:down", onSel);
      } catch {
        // ignore
      }
    };
    // Intentionally keep the same re-attach triggers as the original inline effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlideIndex, activeLayout, activeCanvasNonce]);

  return null;
}

