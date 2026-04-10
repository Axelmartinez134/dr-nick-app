"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

type Side = "left" | "right";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ResizablePanel(props: {
  side: Side;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  children: ReactNode;
  className?: string;
}) {
  const { side, defaultWidth, minWidth = 240, maxWidth = 600, children, className } = props;
  const [width, setWidth] = useState(defaultWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: width };
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
    },
    [width]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      const nextWidth = side === "left"
        ? dragRef.current.startWidth + delta
        : dragRef.current.startWidth - delta;
      setWidth(clamp(nextWidth, minWidth, maxWidth));
    },
    [maxWidth, minWidth, side]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleSide = side === "left" ? "right-0" : "left-0";

  return (
    <div
      className={["relative shrink-0", className || ""].join(" ").trim()}
      style={{ width }}
    >
      {children}
      <div
        className={[
          "absolute top-0 z-10 h-full w-1.5 cursor-col-resize select-none",
          "hover:bg-slate-300/40 active:bg-slate-400/40 transition-colors",
          handleSide,
        ].join(" ")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
}
