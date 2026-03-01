"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";
import type { Slide1Style } from "@/features/editor/store/types";
import { SLIDE1_GRADIENTS, slide1GradientCss } from "@/features/editor/slide1StylePresets";

type ThemeDef = {
  id: string;
  name: string;
  background: string;
  accent: string;
};

type GradientDef = {
  id: string;
  name: string;
  angleDeg: number;
  stops: Array<{ at: number; color: string }>;
};

// Kalypso-like themes (subset; expand later from your token library).
const THEMES: ThemeDef[] = [
  { id: "kalypso-uofbw2", name: "Classic Dark", background: "#000000", accent: "#ff0000" },
  { id: "kalypso-9-ljhze", name: "Deep Forest", background: "#0c0d0b", accent: "#89e842" },
  { id: "kalypso-odmodm", name: "ODMODM", background: "#c4bc00", accent: "#002e7a" },
  { id: "kalypso-kuyz7-r", name: "Pure Silver", background: "#f9faed", accent: "#d2e120" },
  { id: "kalypso-6-n8-muc", name: "Wild Fire", background: "#000000", accent: "#2ff33f" },
  { id: "kalypso-s0-yx87", name: "Soft Lavender", background: "#f3edfa", accent: "#720cf5" },
] as const;

const GRADIENTS: GradientDef[] = SLIDE1_GRADIENTS as any;

function gradientCss(g: GradientDef): string {
  return slide1GradientCss(g as any);
}

export function SlideStyleModal() {
  const open = useEditorSelector((s: any) => !!(s as any).slideStyleModalOpen);
  const isMobile = useEditorSelector((s: any) => !!(s as any).isMobile);
  const templateTypeId = useEditorSelector((s: any) => ((s as any).templateTypeId === "enhanced" ? "enhanced" : "regular"));
  const activeSlideIndex = useEditorSelector((s: any) => Number.isFinite((s as any).activeSlideIndex) ? Number((s as any).activeSlideIndex) : 0);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const slides = useEditorSelector((s: any) => (s as any)?.bottomPanelUi?.slides || (s as any)?.workspaceUi?.slides || []);
  const currentStyle = useMemo(() => {
    const raw = slides?.[0]?.inputData?.slide1Style;
    if (!raw || typeof raw !== "object") return null;
    const themeId = String((raw as any)?.themeId || "").trim();
    const accentModeRaw = String((raw as any)?.accentMode || "solid").trim();
    const gradientId = String((raw as any)?.gradientId || "").trim();
    const accentSolidHex = String((raw as any)?.accentSolidHex || "").trim();
    if (!themeId) return null;
    return {
      themeId,
      accentMode: accentModeRaw === "gradient" ? "gradient" : "solid",
      gradientId: gradientId || null,
      accentSolidHex: accentSolidHex || null,
    } as Slide1Style;
  }, [slides]);

  const [draftThemeId, setDraftThemeId] = useState<string>("");
  const [draftMode, setDraftMode] = useState<"solid" | "gradient">("solid");
  const [draftGradientId, setDraftGradientId] = useState<string>(GRADIENTS[0]?.id || "sunset_glow");

  useEffect(() => {
    if (!open) return;
    const nextTheme = currentStyle?.themeId || THEMES[0]?.id || "";
    const nextMode = currentStyle?.accentMode || "solid";
    const nextGrad = currentStyle?.gradientId || GRADIENTS[0]?.id || "sunset_glow";
    setDraftThemeId(nextTheme);
    setDraftMode(nextMode);
    setDraftGradientId(nextGrad);
  }, [open, currentStyle]);

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

  const draftTheme = THEMES.find((t) => t.id === draftThemeId) || THEMES[0]!;
  const draftGradient = GRADIENTS.find((g) => g.id === draftGradientId) || GRADIENTS[0]!;
  const solidAccent = draftMode === "solid" ? (String(currentStyle?.accentSolidHex || "").trim() || draftTheme.accent) : draftTheme.accent;

  const apply = () => {
    const themeId = String(draftTheme?.id || "").trim();
    if (!themeId) return;
    const next: Slide1Style = {
      themeId,
      accentMode: draftMode,
      gradientId: draftMode === "gradient" ? String(draftGradient?.id || "").trim() || null : null,
      accentSolidHex: null,
      backgroundHex: null,
    };
    actions?.onSetSlide1Style?.(next);
    actions?.onCloseSlideStyleModal?.();
  };

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
              Slide 1 (Regular) only. MVP applies <span className="font-semibold">Background</span> +{" "}
              <span className="font-semibold">Accent (body text)</span> (solid or preset gradient).
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-sm font-semibold"
              onClick={() => {
                actions?.onSetSlide1Style?.(null);
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-600 uppercase">Themes</div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {THEMES.map((t) => {
                  const selected = t.id === draftThemeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={[
                        "text-left rounded-xl border bg-white shadow-sm p-3 hover:bg-slate-50 transition-colors",
                        selected ? "border-black ring-2 ring-black/20" : "border-slate-200",
                      ].join(" ")}
                      onClick={() => setDraftThemeId(t.id)}
                      title={`Use theme: ${t.name}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-3 h-3 rounded border border-slate-200" style={{ background: t.background }} />
                              Background
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="w-3 h-3 rounded border border-slate-200" style={{ background: t.accent }} />
                              Accent
                            </span>
                          </div>
                        </div>
                        <div className="w-16 h-10 rounded-lg border border-slate-200 overflow-hidden" style={{ background: t.background }}>
                          <div className="h-full w-full flex items-center justify-center text-[10px] font-extrabold" style={{ color: t.accent }}>
                            Aa
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <div className="text-xs font-semibold text-slate-600 uppercase">Accent</div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className={[
                    "h-9 px-3 rounded-full border text-[12px] font-semibold",
                    draftMode === "solid" ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => setDraftMode("solid")}
                >
                  Solid
                </button>
                <button
                  type="button"
                  className={[
                    "h-9 px-3 rounded-full border text-[12px] font-semibold",
                    draftMode === "gradient" ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => setDraftMode("gradient")}
                >
                  Gradient
                </button>
              </div>

              <div className="mt-4">
                <div className="text-[11px] font-semibold text-slate-700">Preview</div>
                <div className="mt-2 h-16 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center" style={{ background: draftTheme.background }}>
                  <div
                    className="text-2xl font-extrabold tracking-tight"
                    style={
                      draftMode === "solid"
                        ? { color: solidAccent }
                        : {
                            backgroundImage: gradientCss(draftGradient),
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            color: "transparent",
                          }
                    }
                  >
                    Heading Here
                  </div>
                </div>
              </div>

              {draftMode === "gradient" ? (
                <div className="mt-4">
                  <div className="text-[11px] font-semibold text-slate-700">Swap list</div>
                  <div className="mt-2 space-y-2">
                    {GRADIENTS.map((g) => {
                      const selected = g.id === draftGradientId;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          className={[
                            "w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left",
                            selected ? "border-black ring-2 ring-black/10" : "border-slate-200 hover:bg-slate-50",
                          ].join(" ")}
                          onClick={() => setDraftGradientId(g.id)}
                          title={`Use gradient: ${g.name}`}
                        >
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-slate-900">{g.name}</div>
                          </div>
                          <div className="w-20 h-8 rounded-lg border border-slate-200 overflow-hidden" style={{ backgroundImage: gradientCss(g) }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-[11px] text-slate-500">
                  Uses the selected theme’s <span className="font-semibold">Accent</span> color.
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button type="button" className="h-9 px-3 rounded-lg bg-black text-white text-sm font-semibold hover:bg-slate-900" onClick={apply}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

