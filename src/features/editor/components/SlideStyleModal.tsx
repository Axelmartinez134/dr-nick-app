"use client";

import { useEffect, useMemo } from "react";
import { useEditorSelector } from "@/features/editor/store";

type StyleDef = {
  id: string;
  name: string;
  blurb: string;
  swatches: [string, string, string];
};

const STYLES: StyleDef[] = [
  { id: "aurora", name: "Aurora", blurb: "Soft gradient blobs in corners.", swatches: ["#7C3AED", "#2563EB", "#14B8A6"] },
  { id: "spotlight", name: "Spotlight", blurb: "A subtle spotlight behind the text.", swatches: ["#111827", "#F59E0B", "#EF4444"] },
  { id: "ribbon", name: "Ribbon", blurb: "Diagonal ribbon + corner accents.", swatches: ["#0EA5E9", "#22C55E", "#A855F7"] },
  { id: "frame", name: "Frame", blurb: "Clean framed look with depth.", swatches: ["#0F172A", "#94A3B8", "#E2E8F0"] },
  { id: "paper", name: "Paper", blurb: "Layered paper cut-out shapes.", swatches: ["#F97316", "#FDBA74", "#FEF3C7"] },
  { id: "neon", name: "Neon", blurb: "High-contrast neon accents.", swatches: ["#22C55E", "#06B6D4", "#A78BFA"] },
  { id: "minimal", name: "Minimal", blurb: "Tiny accents, lots of breathing room.", swatches: ["#0F172A", "#64748B", "#CBD5E1"] },
  { id: "confetti", name: "Confetti", blurb: "Playful micro-shapes, still clean.", swatches: ["#F43F5E", "#3B82F6", "#10B981"] },
];

function SwatchRow({ colors }: { colors: [string, string, string] }) {
  return (
    <div className="flex items-center gap-1">
      {colors.map((c) => (
        <span key={c} className="w-3 h-3 rounded-full border border-slate-200" style={{ background: c }} />
      ))}
    </div>
  );
}

export function SlideStyleModal() {
  const open = useEditorSelector((s: any) => !!(s as any).slideStyleModalOpen);
  const isMobile = useEditorSelector((s: any) => !!(s as any).isMobile);
  const templateTypeId = useEditorSelector((s: any) => ((s as any).templateTypeId === "enhanced" ? "enhanced" : "regular"));
  const activeSlideIndex = useEditorSelector((s: any) => Number.isFinite((s as any).activeSlideIndex) ? Number((s as any).activeSlideIndex) : 0);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const slides = useEditorSelector((s: any) => (s as any)?.bottomPanelUi?.slides || (s as any)?.workspaceUi?.slides || []);
  const currentStyleId = useMemo(() => {
    const raw = slides?.[0]?.inputData?.slideStyleId;
    const v = raw == null ? "" : String(raw);
    return v.trim() || null;
  }, [slides]);

  useEffect(() => {
    if (!open) return;
    // Desktop-only MVP: if opened on mobile or outside Slide 1 Regular, close.
    if (isMobile) {
      actions?.onCloseSlideStyleModal?.();
      return;
    }
    if (templateTypeId !== "regular" || activeSlideIndex !== 0) {
      actions?.onCloseSlideStyleModal?.();
    }
  }, [open, isMobile, templateTypeId, activeSlideIndex, actions]);

  if (!open) return null;
  if (isMobile) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-[820px] max-h-[85vh] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Slide 1 Style</div>
            <div className="mt-0.5 text-xs text-slate-600">
              Applies locked decorative styling to <span className="font-semibold">Slide 1</span> (Regular). Does not change global Typography/Colors.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-sm font-semibold"
              onClick={() => {
                actions?.onSetSlide1StyleId?.(null);
                actions?.onCloseSlideStyleModal?.();
              }}
              title="Reset Slide 1 to the default look"
            >
              Reset
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-sm font-semibold"
              onClick={() => actions?.onCloseSlideStyleModal?.()}
              aria-label="Close"
              title="Close"
            >
              Close
            </button>
          </div>
        </div>

        <div className="px-5 py-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {STYLES.map((s) => {
              const selected = !!currentStyleId && currentStyleId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={[
                    "text-left rounded-xl border bg-white shadow-sm p-4 hover:bg-slate-50 transition-colors",
                    selected ? "border-black ring-2 ring-black/20" : "border-slate-200",
                  ].join(" ")}
                  onClick={() => {
                    actions?.onSetSlide1StyleId?.(s.id);
                    actions?.onCloseSlideStyleModal?.();
                  }}
                  title={`Apply "${s.name}"`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{s.name}</div>
                      <div className="mt-1 text-xs text-slate-600">{s.blurb}</div>
                    </div>
                    <SwatchRow colors={s.swatches} />
                  </div>
                  <div className="mt-3 h-10 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden relative">
                    <div className="absolute -left-3 -top-3 w-10 h-10 rounded-full opacity-30" style={{ background: s.swatches[0] }} />
                    <div className="absolute left-10 top-2 w-16 h-6 rounded-full opacity-25" style={{ background: s.swatches[1] }} />
                    <div className="absolute right-2 bottom-2 w-10 h-3 rounded-md opacity-25" style={{ background: s.swatches[2] }} />
                  </div>
                  {selected ? <div className="mt-2 text-xs font-semibold text-slate-900">Selected ✓</div> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

