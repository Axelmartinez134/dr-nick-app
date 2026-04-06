"use client";

import { useRef } from "react";
import { HtmlSlidePreview } from "./HtmlSlidePreview";
import { useHtmlSlidesViewport } from "../hooks/useHtmlSlidesViewport";
import { useHtmlWorkspaceNavigation } from "../hooks/useHtmlWorkspaceNavigation";

type WorkflowStage = "generate-copy" | "choose-preset" | "generate-slides" | "editing";

function PlaceholderSlideCard(props: {
  slideNumber: number;
  stage: WorkflowStage;
  title: string;
  description: string;
  copyPreview: string;
  active: boolean;
}) {
  const badge =
    props.stage === "generate-copy"
      ? "Generate copy"
      : props.stage === "choose-preset"
        ? "Choose preset"
        : props.stage === "generate-slides"
          ? "Generate html"
          : "Slide ready";

  return (
    <div
      className={[
        "h-[560px] w-full rounded-sm border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(2,6,23,0.10)] transition-all",
        props.active ? "ring-2 ring-violet-500 border-violet-300" : "",
      ].join(" ")}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Slide {props.slideNumber}</div>
            <div className="mt-3 text-xl font-semibold text-slate-900">{props.title}</div>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {badge}
          </span>
        </div>

        <div
          className="mt-6 flex-1 rounded-sm border border-slate-200"
          style={{
            backgroundColor: "#EEF0F3",
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(16, 24, 40, 0.14) 1px, transparent 0)",
            backgroundSize: "14px 14px",
          }}
        >
          <div className="flex h-full items-center justify-center p-6">
            <div className="w-full rounded-sm border border-slate-200 bg-white/95 p-6 shadow-sm">
              <div className="text-sm leading-6 text-slate-600">{props.description}</div>
              <div className="mt-5 rounded-sm border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Copy Snapshot</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {props.copyPreview || "No copy for this slide yet."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HtmlSlidesStrip(props: {
  stage: WorkflowStage;
  activeSlideIndex: number;
  htmlSlides: Array<{ id: string; slideIndex: number; html: string | null; pageTitle: string | null; pageType: string | null }>;
  copySlides: any[];
  selectedElementId: string | null;
  onSelectEditableId: (editableId: string) => void;
  onSelectSlide: (slideIndex: number) => void;
  placeholderTitle: string;
  placeholderDescription: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { canGoPrev, canGoNext, goPrev, goNext, switchToSlide } = useHtmlWorkspaceNavigation({
    slideCount: props.htmlSlides.length,
    activeSlideIndex: props.activeSlideIndex,
    onSelectSlide: props.onSelectSlide,
  });
  const { VIEWPORT_PAD, totalW, translateX } = useHtmlSlidesViewport({
    viewportRef,
    slideCount: props.htmlSlides.length,
    activeSlideIndex: props.activeSlideIndex,
  });

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="h-10 w-10 shrink-0 rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm disabled:opacity-50"
          aria-label="Previous slide"
          disabled={!canGoPrev}
          onClick={goPrev}
        >
          ←
        </button>

        <div ref={viewportRef} className="flex-1 overflow-x-hidden overflow-y-visible pb-8" style={{ paddingLeft: VIEWPORT_PAD, paddingRight: VIEWPORT_PAD }}>
          <div
            className="flex items-center gap-6 px-2 py-6"
            style={{
              width: totalW,
              transform: `translateX(${translateX}px)`,
              transition: "transform 300ms ease",
            }}
          >
            {props.htmlSlides.map((slide, index) => {
              const active = index === props.activeSlideIndex;
              const copySlide = props.copySlides[index] || null;
              const html = String(slide?.html || "");
              const copyPreview = [String(copySlide?.headline || "").trim(), String(copySlide?.body || "").trim()].filter(Boolean).join("\n");

              return (
                <div
                  key={slide.id || String(index)}
                  className="relative shrink-0"
                  role="button"
                  tabIndex={0}
                  aria-label={`Select slide ${index + 1}`}
                  aria-pressed={active}
                  onClick={() => switchToSlide(index)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    switchToSlide(index);
                  }}
                >
                  <div
                    className={[
                      "w-[420px] overflow-hidden rounded-sm border border-slate-200 bg-white shadow-[0_10px_30px_rgba(2,6,23,0.10)] transition-all duration-300",
                      active ? "ring-2 ring-violet-500 border-violet-300" : "hover:border-slate-300",
                    ].join(" ")}
                  >
                    {html.trim() ? (
                      <div className={active ? "" : "pointer-events-none"}>
                        <HtmlSlidePreview
                          html={html}
                          title={String(slide?.pageTitle || `Slide ${index + 1}`)}
                          interactive={active}
                          selectedEditableId={active ? props.selectedElementId : null}
                          onSelectEditableId={active ? props.onSelectEditableId : undefined}
                          showHeader={false}
                          className="rounded-none border-0 bg-transparent shadow-none"
                          bodyClassName="p-0"
                          previewLabel={active ? "Interactive iframe preview" : "Read-only iframe preview"}
                        />
                      </div>
                    ) : (
                      <PlaceholderSlideCard
                        slideNumber={index + 1}
                        stage={props.stage}
                        title={props.placeholderTitle}
                        description={props.placeholderDescription}
                        copyPreview={copyPreview}
                        active={active}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="h-10 w-10 shrink-0 rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm disabled:opacity-50"
          aria-label="Next slide"
          disabled={!canGoNext}
          onClick={goNext}
        >
          →
        </button>
      </div>
    </div>
  );
}
