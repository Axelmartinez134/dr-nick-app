"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./EditorShell.module.css";

function SlideCard({
  index,
  active,
}: {
  index: number;
  active: boolean;
}) {
  const isPrimary = index === 1;
  return (
    <div
      className={[
        "relative flex-shrink-0 bg-white rounded-sm shadow-[0_10px_30px_rgba(2,6,23,0.10)] border border-slate-200 overflow-hidden",
        "w-[420px] h-[560px]", // 1080x1440 scaled (3:4)
        active ? "ring-2 ring-violet-500 border-violet-300" : "",
        !active ? "opacity-75" : "",
      ].join(" ")}
      aria-label={`Slide ${index}`}
    >
      <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
        {isPrimary ? "Slide 1 (placeholder shell)" : `Slide ${index} (placeholder)`}
      </div>
    </div>
  );
}

export default function EditorShell() {
  const slideCount = 6;
  const [activeSlideIndex, setActiveSlideIndex] = useState(0); // 0..5
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const slideRefs = useMemo(
    () =>
      Array.from({ length: slideCount }).map(() => ({
        current: null as HTMLDivElement | null,
      })),
    [slideCount]
  );

  const canGoPrev = activeSlideIndex > 0;
  const canGoNext = activeSlideIndex < slideCount - 1;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportWidth(el.clientWidth);
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Slide strip translation: no manual scrolling; arrows move slides.
  // We center the active slide in the viewport.
  const CARD_W = 420;
  const GAP = 24; // gap-6
  // Inner gutter so shadows/rings don't get clipped by overflow-x-hidden at the viewport edges.
  const VIEWPORT_PAD = 40;
  const totalW = slideCount * CARD_W + (slideCount - 1) * GAP;
  const viewportContentWidth = Math.max(0, viewportWidth - VIEWPORT_PAD * 2);
  const centerOffset = VIEWPORT_PAD + Math.max(0, (viewportContentWidth - CARD_W) / 2);
  const rawTranslate = centerOffset - activeSlideIndex * (CARD_W + GAP);
  const minTranslate = Math.min(0, viewportContentWidth - totalW);
  const maxTranslate = 0;
  const translateX = Math.max(minTranslate, Math.min(maxTranslate, rawTranslate));

  const goPrev = () => setActiveSlideIndex((i) => Math.max(0, i - 1));
  const goNext = () => setActiveSlideIndex((i) => Math.min(slideCount - 1, i + 1));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar (visual only for now) */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">aiCarousels</div>
            <div className="text-[11px] text-slate-500">Editor</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 text-sm bg-white shadow-sm">
            Save Draft
          </button>
          <button className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 text-sm bg-white shadow-sm">
            Remove Watermark
          </button>
          <button className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm">
            Download
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        <aside className="w-[400px] bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              AI Carousel Generator
            </div>
            <div className="mt-3 space-y-2">
              <button className="w-full py-2.5 rounded-lg bg-violet-600 text-white font-semibold text-sm">
                Generate Carousel…
              </button>
              <button className="w-full py-2.5 rounded-lg bg-violet-100 text-violet-800 font-semibold text-sm">
                Import Carousel…
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 overflow-auto">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Template Settings</div>
              <button className="text-xs text-violet-700 font-semibold">Surprise Me</button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase">Platform Format</div>
              <div className="flex items-center gap-2">
                <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white">
                  <option>LinkedIn (4:5, Recommended)</option>
                </select>
              </div>
              <button className="w-full h-10 rounded-md border border-slate-200 bg-white text-slate-700 text-sm">
                Select Template…
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              {[
                "Color Palette",
                "Text Settings",
                "Background Effects",
                "Counter & Corners",
                "Creator Info",
              ].map((label) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">{label}</div>
                  <div className="w-5 h-5 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Workspace */}
        <main className={`flex-1 min-w-0 flex flex-col ${styles.workspace}`}>
          {/* Slides row */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-[1400px] flex items-center gap-3">
              <button
                className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700"
                aria-label="Previous"
                onClick={goPrev}
                disabled={!canGoPrev}
              >
                ←
              </button>
              <div
                ref={viewportRef}
                className="flex-1 overflow-x-hidden overflow-y-visible"
                style={{ paddingLeft: VIEWPORT_PAD, paddingRight: VIEWPORT_PAD }}
              >
                <div
                  className="flex items-center gap-6 px-2 py-6"
                  style={{
                    transform: `translateX(${translateX}px)`,
                    transition: "transform 300ms ease",
                    width: totalW,
                  }}
                >
                  {Array.from({ length: slideCount }).map((_, i) => (
                    <div
                      key={i}
                      ref={(node) => {
                        slideRefs[i].current = node;
                      }}
                      className="relative"
                    >
                      <SlideCard index={i + 1} active={i === activeSlideIndex} />
                    </div>
                  ))}
                </div>
              </div>
              <button
                className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700"
                aria-label="Next"
                onClick={goNext}
                disabled={!canGoNext}
              >
                →
              </button>
            </div>
          </div>

          {/* Bottom panel */}
          <section className="bg-white border-t border-slate-200">
            <div className="max-w-[1400px] mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Slide Settings</div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 text-sm bg-white shadow-sm">
                    Reorder
                  </button>
                  <button className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 text-sm bg-white shadow-sm">
                    Delete
                  </button>
                  <button className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm">
                    Add Slide +
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Slide Type</span>
                    <span className="ml-auto text-xs text-slate-500">Slide #{activeSlideIndex + 1}</span>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 rounded-md bg-violet-100 text-violet-800 text-sm font-semibold">
                        Text
                      </button>
                      <button className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 text-sm font-semibold bg-white">
                        Text + Image
                      </button>
                      <button className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 text-sm font-semibold bg-white">
                        Image
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1">Title</label>
                    <input
                      className="w-full h-10 rounded-md border border-slate-200 px-3 text-slate-900"
                      placeholder="Amazing title here!"
                      value=""
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1">Paragraph</label>
                    <textarea
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
                      rows={3}
                      placeholder="A message that will leave viewers wanting more."
                      value=""
                      readOnly
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-900">Controls (placeholder)</div>
                  <button className="w-full h-10 rounded-lg bg-[#6D28D9] text-white text-sm font-semibold shadow-sm">
                    Generate Layout
                  </button>
                  <button className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm">
                    Realign Text
                  </button>
                  <button className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm">
                    Undo
                  </button>
                  <div className="text-xs text-slate-500">
                    Shell-first: next we’ll move the real editor inputs/buttons into this bottom panel.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}


