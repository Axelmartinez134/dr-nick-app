export type HorizontalSmartGuideState = {
  x: number | null;
  kind: "left" | "center" | "right" | null;
};

export function attachHorizontalSmartGuides(params: {
  canvas: any;
  enabledRef: { current: boolean };
  stateRef: { current: HorizontalSmartGuideState };
  thresholdPx?: number;
}) {
  const canvas = params.canvas;
  const enabledRef = params.enabledRef;
  const stateRef = params.stateRef;
  const thresholdPx = Number.isFinite(params.thresholdPx as any) ? Math.max(0, Number(params.thresholdPx)) : 8;

  const clear = (opts?: { deferRender?: boolean }) => {
    stateRef.current = { x: null, kind: null };
    try {
      // IMPORTANT: during IText selection (mouse up), requesting a render immediately can run
      // before Fabric finalizes selectionStart/End, which makes the highlight "disappear" until
      // the next interaction. Deferring one tick keeps selection visuals stable.
      if (opts?.deferRender) {
        window.setTimeout(() => {
          try {
            canvas.requestRenderAll?.();
          } catch {
            // ignore
          }
        }, 0);
      } else {
        canvas.requestRenderAll?.();
      }
    } catch {
      // ignore
    }
  };

  const getRect = (obj: any) => {
    try {
      if (!obj) return null;
      if (typeof obj.getBoundingRect === "function") {
        // absolute coords in canvas space
        const r = obj.getBoundingRect(true, true);
        if (!r) return null;
        return {
          left: Number(r.left) || 0,
          top: Number(r.top) || 0,
          width: Math.max(0, Number(r.width) || 0),
          height: Math.max(0, Number(r.height) || 0),
        };
      }
    } catch {
      // ignore
    }
    return null;
  };

  const anchorsForRect = (r: { left: number; width: number }) => ({
    left: r.left,
    center: r.left + r.width / 2,
    right: r.left + r.width,
  });

  const onObjectMoving = (e: any) => {
    if (!enabledRef.current) return;
    const obj = e?.target;
    if (!obj) return;
    const role = obj?.data?.role;
    if (role !== "user-text") return;
    // Ignore multi-select moves; guides are for single-line alignment.
    const t = String(obj?.type || "").toLowerCase();
    if (t === "activeselection" || t === "group") return;

    const movingRect = getRect(obj);
    if (!movingRect) return;
    const moving = anchorsForRect(movingRect);

    const others: any[] = (canvas.getObjects?.() || []).filter((o: any) => o && o !== obj && o?.data?.role === "user-text");
    if (!others.length) {
      if (stateRef.current.x != null) clear();
      return;
    }

    // NOTE: keep this intentionally loose (any) to avoid TS control-flow edge cases in some builds.
    // The values are fully runtime-validated by our checks.
    let best: any = null;
    for (const o of others) {
      const r = getRect(o);
      if (!r) continue;
      const a = anchorsForRect(r);
      (["left", "center", "right"] as const).forEach((k) => {
        const targetX = (a as any)[k] as number;
        (["left", "center", "right"] as const).forEach((mk) => {
          const movingX = (moving as any)[mk] as number;
          const d = Math.abs(movingX - targetX);
          if (d <= thresholdPx && (!best || d < best.dist)) {
            best = { x: targetX, kind: k, dist: d };
          }
        });
      });
    }

    if (!best) {
      if (stateRef.current.x != null) clear();
      return;
    }

    stateRef.current = {
      x: Number(best.x),
      kind: (best.kind as any) || null,
    };
    try {
      canvas.requestRenderAll?.();
    } catch {
      // ignore
    }
  };

  const onObjectModified = () => clear();
  const onSelectionCleared = () => clear({ deferRender: true });
  const onMouseUp = () => clear({ deferRender: true });

  try {
    canvas.on?.("object:moving", onObjectMoving);
    canvas.on?.("object:modified", onObjectModified);
    canvas.on?.("selection:cleared", onSelectionCleared);
    canvas.on?.("mouse:up", onMouseUp);
  } catch {
    // ignore
  }

  return {
    clear,
    cleanup: () => {
      try {
        canvas.off?.("object:moving", onObjectMoving);
        canvas.off?.("object:modified", onObjectModified);
        canvas.off?.("selection:cleared", onSelectionCleared);
        canvas.off?.("mouse:up", onMouseUp);
      } catch {
        // ignore
      }
    },
  };
}

export function drawHorizontalSmartGuide(params: {
  ctx: CanvasRenderingContext2D;
  canvas: any;
  state: HorizontalSmartGuideState;
  allowedRect: null | { x: number; y: number; width: number; height: number };
  color?: string;
  lineWidthPx?: number;
}) {
  const { ctx, state, allowedRect } = params;
  const x = Number(state?.x);
  if (!Number.isFinite(x)) return;
  const color = String(params.color || "rgba(99,102,241,0.9)");
  const lineWidth = Number.isFinite(params.lineWidthPx as any) ? Math.max(1, Number(params.lineWidthPx)) : 1;

  // Draw within allowed rect when available; otherwise full canvas height.
  const y0 = allowedRect ? allowedRect.y : 0;
  const y1 = allowedRect ? allowedRect.y + allowedRect.height : (params.canvas?.getHeight?.() || 1440);

  try {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.restore();
  } catch {
    // ignore
  }
}

