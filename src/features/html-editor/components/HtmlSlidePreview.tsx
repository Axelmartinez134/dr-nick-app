"use client";

import { useEffect, useRef, useState } from "react";
import { useHtmlSlideRenderer } from "../hooks/useHtmlSlideRenderer";

export function HtmlSlidePreview(props: {
  html: string;
  title: string;
  aspectRatio?: "1:1" | "3:4" | "4:5" | "16:9";
  interactive?: boolean;
  selectedEditableId?: string | null;
  onSelectEditableId?: (editableId: string) => void;
  showHeader?: boolean;
  className?: string;
  bodyClassName?: string;
  previewLabel?: string;
}) {
  const {
    html,
    title,
    aspectRatio,
    interactive,
    selectedEditableId,
    onSelectEditableId,
    showHeader = true,
    className,
    bodyClassName,
    previewLabel,
  } = props;
  const rendered = useHtmlSlideRenderer({
    html,
    aspectRatio: aspectRatio || "3:4",
    interactive,
    selectedEditableId,
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

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

  useEffect(() => {
    if (!onSelectEditableId) return;
    const onMessage = (event: MessageEvent) => {
      if (event?.data?.type !== "html-element-select") return;
      const editableId = String(event?.data?.editableId || "").trim();
      if (!editableId) return;
      onSelectEditableId?.(editableId);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelectEditableId]);

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
              title={title}
              sandbox={interactive ? "allow-same-origin allow-scripts" : "allow-same-origin"}
              className="block border-0 bg-white"
              style={{ width: rendered.dimensions.width, height: rendered.dimensions.height }}
              srcDoc={rendered.srcDoc}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
