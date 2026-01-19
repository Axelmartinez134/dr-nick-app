import { createRef, useMemo, useRef, useState } from "react";

export function useMultiCanvasRefs(params: { slideCount: number }) {
  const { slideCount } = params;

  // Used to re-attach Fabric selection listeners once the active slide canvas is actually mounted.
  const [activeCanvasNonce, setActiveCanvasNonce] = useState(0);
  const lastActiveFabricCanvasRef = useRef<any>(null);

  // One ref per slide preview canvas so we can export/share all slides.
  const slideCanvasRefs = useRef<Array<React.RefObject<any>>>(
    Array.from({ length: slideCount }, () => createRef<any>())
  );

  // DOM refs for the slide strip.
  const slideRefs = useMemo(
    () =>
      Array.from({ length: slideCount }).map(() => ({
        current: null as HTMLDivElement | null,
      })),
    [slideCount]
  );

  return { activeCanvasNonce, setActiveCanvasNonce, lastActiveFabricCanvasRef, slideCanvasRefs, slideRefs };
}

