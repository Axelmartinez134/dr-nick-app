import { useCallback } from "react";

export function useFabricCanvasBinding(params: {
  canvasRef: any;
  slideCanvasRefs: { current: Array<{ current: any }> };
  lastActiveFabricCanvasRef: { current: any };
  setActiveCanvasNonce: (updater: any) => void;
}) {
  const { canvasRef, slideCanvasRefs, lastActiveFabricCanvasRef, setActiveCanvasNonce } = params;

  const bindActiveSlideCanvasMobile = useCallback(
    (slideIndex: number) => {
      return (node: any) => {
        (canvasRef as any).current = node;
        try {
          slideCanvasRefs.current[slideIndex]!.current = node;
        } catch {
          // ignore
        }
      };
    },
    [canvasRef, slideCanvasRefs]
  );

  const bindActiveSlideCanvasDesktop = useCallback(
    (slideIndex: number) => {
      return (node: any) => {
        (canvasRef as any).current = node;
        try {
          slideCanvasRefs.current[slideIndex]!.current = node;
        } catch {
          // ignore
        }
        try {
          const fabricCanvas = (node as any)?.canvas || null;
          if (fabricCanvas && lastActiveFabricCanvasRef.current !== fabricCanvas) {
            lastActiveFabricCanvasRef.current = fabricCanvas;
            setActiveCanvasNonce((x: number) => x + 1);
          }
        } catch {
          // ignore
        }
      };
    },
    [canvasRef, lastActiveFabricCanvasRef, setActiveCanvasNonce, slideCanvasRefs]
  );

  return { bindActiveSlideCanvasMobile, bindActiveSlideCanvasDesktop };
}

