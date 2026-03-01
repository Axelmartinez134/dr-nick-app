/* eslint-disable react/no-unstable-nested-components */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RichTextInput } from "@/app/editor/RichTextInput";
import { DebugCard } from "./DebugCard";
import { useEditorSelector } from "@/features/editor/store";
import { CaptionRegenHistoryModal } from "@/features/editor/components/CaptionRegenHistoryModal";
import { SLIDE1_GRADIENTS, slide1GradientCss } from "@/features/editor/slide1StylePresets";

export function EditorBottomPanel() {
  const templateTypeId = useEditorSelector((s) => s.templateTypeId);
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const fontOptions = useEditorSelector((s: any) => ((s as any).fontOptions || []) as Array<any>);
  const bodyFontKey = useEditorSelector((s: any) => String((s as any).bodyFontKey || ""));
  const ui = useEditorSelector((s: any) => (s as any).bottomPanelUi);
  const actions = useEditorSelector((s: any) => (s as any).actions);
  const aiSettingsPopoverRef = useRef<HTMLDivElement | null>(null);
  const [captionHistoryOpen, setCaptionHistoryOpen] = useState(false);
  const [slide1TextOpen, setSlide1TextOpen] = useState(false);
  const [slide1BgOpen, setSlide1BgOpen] = useState(false);
  const [slide1GradientPickerOpen, setSlide1GradientPickerOpen] = useState(false);
  const [slide1BodySizeDraft, setSlide1BodySizeDraft] = useState<string>("");
  const slide1BodySizeEditingRef = useRef<boolean>(false);
  const slide1BodySizeHoldTimeoutRef = useRef<number | null>(null);
  const slide1BodySizeHoldIntervalRef = useRef<number | null>(null);

  const stopSlide1BodySizeHold = () => {
    if (slide1BodySizeHoldTimeoutRef.current) window.clearTimeout(slide1BodySizeHoldTimeoutRef.current);
    if (slide1BodySizeHoldIntervalRef.current) window.clearInterval(slide1BodySizeHoldIntervalRef.current);
    slide1BodySizeHoldTimeoutRef.current = null;
    slide1BodySizeHoldIntervalRef.current = null;
  };

  const SLIDE1_THEME_ACCENT_BY_ID: Record<string, string> = useMemo(
    () => ({
      "kalypso-uofbw2": "#ff0000",
      "kalypso-9-ljhze": "#89e842",
      "kalypso-odmodm": "#002e7a",
      "kalypso-kuyz7-r": "#d2e120",
      "kalypso-6-n8-muc": "#2ff33f",
      "kalypso-s0-yx87": "#720cf5",
    }),
    []
  );

  // Dismiss Gemini settings popover on outside click (and not on the ⚙️ toggle button).
  // NOTE: must be unconditionally declared (hooks cannot be after an early return).
  const aiImageSettingsOpenForDismiss = !!ui?.aiImageSettingsOpen;
  useEffect(() => {
    if (!aiImageSettingsOpenForDismiss) return;
    if (!actions) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (aiSettingsPopoverRef.current?.contains(target)) return;
      if (target.closest?.('[data-ai-settings-toggle="1"]')) return;
      actions.onClickToggleAiImageSettings?.();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [aiImageSettingsOpenForDismiss, actions]);

  // Hide Slide 1 text panel when it can't apply.
  const activeSlideIndexForSlide1Text = Number((ui as any)?.activeSlideIndex ?? -1);
  const slide1BodySizeCurrentForSync = Math.round(Number((ui as any)?.slides?.[0]?.draftBodyFontSizePx ?? 48)) || 48;
  useEffect(() => {
    if (templateTypeId !== "regular" || activeSlideIndexForSlide1Text !== 0) setSlide1TextOpen(false);
  }, [activeSlideIndexForSlide1Text, templateTypeId]);
  useEffect(() => {
    if (!slide1TextOpen) setSlide1GradientPickerOpen(false);
  }, [slide1TextOpen]);
  useEffect(() => {
    if (templateTypeId !== "regular" || activeSlideIndexForSlide1Text !== 0) setSlide1BgOpen(false);
  }, [activeSlideIndexForSlide1Text, templateTypeId]);

  // Keep the input draft in sync when not actively typing.
  useEffect(() => {
    if (!slide1TextOpen) {
      slide1BodySizeEditingRef.current = false;
      stopSlide1BodySizeHold();
      return;
    }
    if (slide1BodySizeEditingRef.current) return;
    setSlide1BodySizeDraft(String(slide1BodySizeCurrentForSync));
  }, [slide1BodySizeCurrentForSync, slide1TextOpen]);

  if (!ui || !actions) return null;

  const {
    activeSlideIndex,
    slideCount,
    currentProjectId,
    loading,
    switchingSlides,
    copyGenerating,
    copyProgressLabel,
    enhancedLockOn,
    slides,
    layoutData,
    inputData,
    layoutHistoryLength,
    showLayoutOverlays,
    addLog,
    aiImagePromptDraft,
    aiImageGenModel,
    aiImageAutoRemoveBgEnabled,
    aiImageSettingsOpen,
    aiImageAspectRatio,
    aiImageSize,
  } = ui;

  const outreachMessageDraft = String((ui as any)?.outreachMessageDraft || "");
  const outreachMessageCopyStatus = String((ui as any)?.outreachMessageCopyStatus || "idle");
  const isOutreachProject = !!(ui as any)?.isOutreachProject;
  const showOutreachMessage = isSuperadmin && isOutreachProject;

  const clampSlide1BodySize = (n: number) => Math.max(8, Math.min(999, Math.round(Number(n) || 0)));
  const commitSlide1BodySizeLive = (next: number) => {
    const n = clampSlide1BodySize(next);
    setSlide1BodySizeDraft(String(n));
    actions.onChangeBodyFontSize?.({ target: { value: n } } as any);
  };

  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1400px] mx-auto px-6 py-4">
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            {/* Headline Card (Enhanced only) */}
            {templateTypeId !== "regular" ? (
              <div className="relative rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white text-sm font-bold flex items-center justify-center">H</span>
                    <label className="text-sm font-semibold text-slate-900">Headline</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={24}
                      max={120}
                      step={1}
                      className="w-16 h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 text-center"
                      value={Number(slides[activeSlideIndex]?.draftHeadlineFontSizePx ?? 76)}
                      disabled={loading || switchingSlides || copyGenerating || enhancedLockOn}
                      onChange={actions.onChangeHeadlineFontSize}
                      title="Font size (24–120px)"
                    />
                    <div className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden shadow-sm">
                      {(["left", "center", "right"] as const).map((a) => {
                        const active = (slides[activeSlideIndex]?.draftHeadlineTextAlign || "left") === a;
                        const label = a === "left" ? "L" : a === "center" ? "C" : "R";
                        return (
                          <button
                            key={a}
                            type="button"
                            className={[
                              "h-8 w-8 text-xs font-semibold transition-colors",
                              active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
                            ].join(" ")}
                            disabled={loading || switchingSlides || copyGenerating || enhancedLockOn}
                            title={a === "left" ? "Align Left" : a === "center" ? "Align Center" : "Align Right"}
                            onClick={() => actions.onClickHeadlineAlign(a)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <RichTextInput
                    key={`rte-headline:${currentProjectId || "none"}:${activeSlideIndex}`}
                    valueText={slides[activeSlideIndex]?.draftHeadline || ""}
                    valueRanges={slides[activeSlideIndex]?.draftHeadlineRanges || []}
                    onDebugLog={addLog}
                    debugId={`headline proj=${currentProjectId || "none"} slide=${activeSlideIndex + 1}`}
                    onChange={actions.onChangeHeadlineRichText}
                    disabled={loading || switchingSlides || copyGenerating || enhancedLockOn}
                    placeholder={enhancedLockOn ? "Headline locked" : "Enter headline..."}
                    minHeightPx={40}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm"
                  />
                </div>

                {enhancedLockOn ? (
                  <div
                    className="absolute inset-0 rounded-xl border border-slate-200 z-20"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(135deg, rgba(15,23,42,0.06) 0px, rgba(15,23,42,0.06) 12px, rgba(255,255,255,0.10) 12px, rgba(255,255,255,0.10) 24px)",
                      backgroundColor: "rgba(248,250,252,0.55)",
                      pointerEvents: "auto",
                    }}
                    aria-hidden="true"
                  >
                    <div className="absolute top-3 right-3 px-3 py-2 rounded-full bg-white/90 border border-slate-200 shadow-sm flex items-center gap-2">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 text-slate-600"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                      </svg>
                      <div className="leading-tight">
                        <div className="text-xs font-semibold text-slate-900">Layout locked</div>
                        <div className="text-[11px] font-medium text-slate-600">Edit on canvas</div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Outreach message (superadmin-only; Outreach-created projects only) */}
            {showOutreachMessage ? (
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-slate-700 text-white text-sm flex items-center justify-center">💬</span>
                    <span className="text-sm font-semibold text-slate-900">Outreach message</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {outreachMessageCopyStatus === "copied" ? (
                      <span className="text-xs text-emerald-700 font-medium">Copied!</span>
                    ) : outreachMessageCopyStatus === "error" ? (
                      <span className="text-xs text-red-600 font-medium">Copy failed</span>
                    ) : null}
                    <button
                      type="button"
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                      onClick={actions.onClickCopyOutreachMessage}
                      disabled={copyGenerating}
                      title="Copy outreach message to clipboard"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <textarea
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm"
                  rows={4}
                  placeholder="Write an outreach message..."
                  value={outreachMessageDraft}
                  onChange={(e) => actions.onChangeOutreachMessage?.(e.target.value)}
                  disabled={copyGenerating}
                />
              </div>
            ) : null}

            {/* Body Card */}
            <div className="relative rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-slate-700 text-white text-sm font-bold flex items-center justify-center">¶</span>
                  <label className="text-sm font-semibold text-slate-900">Body</label>
                </div>
                {templateTypeId !== "regular" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={24}
                      max={120}
                      step={1}
                      className="w-16 h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 text-center"
                      value={Number(slides[activeSlideIndex]?.draftBodyFontSizePx ?? 48)}
                      disabled={loading || switchingSlides || copyGenerating || enhancedLockOn}
                      onChange={actions.onChangeBodyFontSize}
                      title="Font size (24–120px)"
                    />
                    <div className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden shadow-sm">
                      {(["left", "center", "right"] as const).map((a) => {
                        const active = (slides[activeSlideIndex]?.draftBodyTextAlign || "left") === a;
                        const label = a === "left" ? "L" : a === "center" ? "C" : "R";
                        return (
                          <button
                            key={a}
                            type="button"
                            className={[
                              "h-8 w-8 text-xs font-semibold transition-colors",
                              active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
                            ].join(" ")}
                            disabled={loading || switchingSlides || copyGenerating || enhancedLockOn}
                            title={a === "left" ? "Align Left" : a === "center" ? "Align Center" : "Align Right"}
                            onClick={() => actions.onClickBodyAlign(a)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center gap-2">
                    {activeSlideIndex === 0 ? (
                      <div className="relative">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                            onClick={() => setSlide1BgOpen((v) => !v)}
                            disabled={!currentProjectId || copyGenerating || switchingSlides}
                            title={!currentProjectId ? "Create or load a project first" : "Slide 1 background (color + texture)"}
                            aria-label={slide1BgOpen ? "Close Slide 1 background controls" : "Open Slide 1 background controls"}
                          >
                            Background
                          </button>

                          <button
                            type="button"
                            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                            onClick={() => {
                              setSlide1TextOpen((v) => {
                                const next = !v;
                                if (next) setSlide1BodySizeDraft(String(slide1BodySizeCurrentForSync));
                                return next;
                              });
                            }}
                            disabled={!currentProjectId || copyGenerating || switchingSlides}
                            title={!currentProjectId ? "Create or load a project first" : "Slide 1 local text styling (size/font/color)"}
                            aria-label={slide1TextOpen ? "Close Slide 1 text controls" : "Open Slide 1 text controls"}
                          >
                            Slide 1 text
                          </button>
                        </div>

                        {slide1BgOpen ? (
                          <div className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[360px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                            <div className="text-xs font-semibold text-slate-900">Slide 1 background</div>
                            {(() => {
                              const bg = (slides as any)?.[0]?.inputData?.slide1Background || null;
                              const bgHex = String(bg?.backgroundHex || "").trim() || "#ffffff";
                              const patternId = String(bg?.patternId || "none") as any;
                              return (
                                <div className="mt-3 space-y-3">
                                  <div>
                                    <div className="text-[11px] font-semibold text-slate-600 uppercase">Color</div>
                                    <div className="mt-1 flex items-center gap-2">
                                      <input
                                        type="color"
                                        className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                                        value={bgHex}
                                        disabled={!currentProjectId || switchingSlides || copyGenerating}
                                        onChange={(e) => {
                                          const nextHex = String(e.target.value || "").trim() || "#ffffff";
                                          const next = { backgroundHex: nextHex, patternId: (patternId || "none") as any };
                                          actions.onSetSlide1Background?.(next as any);
                                        }}
                                        aria-label="Slide 1 background color"
                                      />
                                      <div className="text-xs text-slate-600 tabular-nums">{bgHex}</div>
                                      <button
                                        type="button"
                                        className="ml-auto h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                                        disabled={!currentProjectId || switchingSlides || copyGenerating}
                                        onClick={() => actions.onSetSlide1Background?.(null)}
                                        title="Revert to Style background"
                                      >
                                        Use Style Background
                                      </button>
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-semibold text-slate-900 uppercase">Texture</div>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                      {([
                                        { id: "none", name: "None" },
                                        { id: "dots_n8n", name: "n8n dots" },
                                        { id: "paper_grain", name: "Paper grain" },
                                        { id: "subtle_noise", name: "Subtle noise" },
                                        { id: "grid", name: "Grid" },
                                        { id: "wrinkle_grain_black", name: "Wrinkled grain (black)" },
                                      ] as const).map((p) => {
                                        const selected = String(patternId || "none") === p.id;
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            className={[
                                              "h-10 rounded-xl border px-3 text-left text-xs font-semibold transition-colors",
                                              selected ? "border-black ring-2 ring-black/10 bg-slate-50" : "border-slate-200 hover:bg-slate-50",
                                            ].join(" ")}
                                            style={{ color: "#000000" }}
                                            aria-disabled={!currentProjectId || switchingSlides || copyGenerating}
                                            onClick={() => {
                                              if (!currentProjectId || switchingSlides || copyGenerating) return;
                                              // "Exact" preset: force black base for the wrinkled grain look.
                                              const forcedHex = p.id === "wrinkle_grain_black" ? "#0b0b0b" : bgHex;
                                              const next = { backgroundHex: forcedHex, patternId: p.id };
                                              actions.onSetSlide1Background?.(next as any);
                                            }}
                                            title={p.name}
                                          >
                                            {p.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-500">Textures are neutral (black/white) so your color stays vivid.</div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}

                        {slide1TextOpen ? (
                          <div className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[360px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                            <div className="text-xs font-semibold text-slate-900">Slide 1 only</div>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Body size</div>
                                <div className="mt-1 flex items-stretch gap-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                    value={slide1BodySizeDraft}
                                    disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                    onFocus={() => {
                                      slide1BodySizeEditingRef.current = true;
                                    }}
                                    onChange={(e) => {
                                      const raw = String(e.target.value || "");
                                      // Only keep digits (so typing is frictionless on mobile + desktop).
                                      setSlide1BodySizeDraft(raw.replace(/[^\d]/g, ""));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key !== "Enter") return;
                                      (e.target as HTMLInputElement | null)?.blur?.();
                                    }}
                                    onBlur={() => {
                                      slide1BodySizeEditingRef.current = false;
                                      const raw = String(slide1BodySizeDraft || "").trim();
                                      const n = Math.round(Number(raw));
                                      if (!Number.isFinite(n)) {
                                        setSlide1BodySizeDraft(String(slide1BodySizeCurrentForSync));
                                        return;
                                      }
                                      // Commit (clamps in the action handler).
                                      actions.onChangeBodyFontSize?.({ target: { value: n } } as any);
                                    }}
                                    title="Body font size (Slide 1 only). Min 8, max 999."
                                  />

                                  {/* Desktop-friendly steppers that don't interrupt typing. */}
                                  <div className="hidden md:flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                    {([
                                      { dir: "up" as const, label: "Increase", delta: +1, glyph: "▲" },
                                      { dir: "down" as const, label: "Decrease", delta: -1, glyph: "▼" },
                                    ] as const).map((btn) => {
                                      const disabled = !currentProjectId || switchingSlides || copyGenerating || enhancedLockOn;
                                      const stepOnce = () => {
                                        const raw = String(slide1BodySizeDraft || "").trim();
                                        const base = Number.isFinite(Number(raw)) ? Number(raw) : Number(slide1BodySizeCurrentForSync);
                                        commitSlide1BodySizeLive(base + btn.delta);
                                      };
                                      const startHold = (e: any) => {
                                        if (disabled) return;
                                        // Keep the input focused (don't trigger blur/commit).
                                        try {
                                          e?.preventDefault?.();
                                        } catch {
                                          // ignore
                                        }
                                        stopSlide1BodySizeHold();
                                        stepOnce();
                                        // Constant-speed repeat while held.
                                        slide1BodySizeHoldTimeoutRef.current = window.setTimeout(() => {
                                          slide1BodySizeHoldIntervalRef.current = window.setInterval(() => {
                                            stepOnce();
                                          }, 80);
                                        }, 250);
                                      };
                                      return (
                                        <button
                                          key={btn.dir}
                                          type="button"
                                          className={[
                                            "w-10 flex-1 text-[10px] font-bold leading-none transition-colors select-none",
                                            btn.dir === "up" ? "border-b border-slate-200" : "",
                                            disabled ? "text-slate-300" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100",
                                          ].join(" ")}
                                          onMouseDown={(e) => {
                                            // Prevent the button from stealing focus from the input.
                                            e.preventDefault();
                                          }}
                                          onPointerDown={startHold}
                                          onPointerUp={stopSlide1BodySizeHold}
                                          onPointerCancel={stopSlide1BodySizeHold}
                                          onPointerLeave={stopSlide1BodySizeHold}
                                          aria-label={btn.label}
                                          aria-disabled={disabled}
                                          title={`${btn.label} (hold to repeat)`}
                                        >
                                          {btn.glyph}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="mt-1 text-[10px] text-slate-500">Min 8 · Max 999 (auto-fits if needed)</div>
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Text color</div>
                                {(() => {
                                  const st = (slides as any)?.[0]?.inputData?.slide1Style || null;
                                  const mode = String(st?.accentMode || "solid") === "gradient" ? "gradient" : "solid";
                                  const tid = String(st?.themeId || "").trim();
                                  const hex = String(st?.accentSolidHex || "").trim();
                                  const effective = hex || SLIDE1_THEME_ACCENT_BY_ID[tid] || "#000000";
                                  const gradientId = String(st?.gradientId || "").trim();
                                  const currentGradient = SLIDE1_GRADIENTS.find((g) => g.id === gradientId) || null;
                                  if (mode === "gradient") {
                                    return (
                                      <div className="mt-1 space-y-2">
                                        <button
                                          type="button"
                                          className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                                          disabled={!currentProjectId || switchingSlides || copyGenerating}
                                          onClick={() => setSlide1GradientPickerOpen((v) => !v)}
                                          title="Pick a gradient preset"
                                        >
                                          {currentGradient ? (
                                            <span className="flex items-center justify-between gap-2">
                                              <span className="flex items-center gap-2">
                                                <span
                                                  className="inline-block w-10 h-6 rounded-md border border-slate-200"
                                                  style={{ backgroundImage: slide1GradientCss(currentGradient as any) }}
                                                />
                                                <span className="text-xs font-semibold text-slate-800">{currentGradient.name}</span>
                                              </span>
                                              <span className="text-[11px] text-slate-500">Change…</span>
                                            </span>
                                          ) : (
                                            "Change gradient…"
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                                          disabled={!currentProjectId || switchingSlides || copyGenerating}
                                          onClick={() => {
                                            const cur = (slides as any)?.[0]?.inputData?.slide1Style || null;
                                            const next = cur && typeof cur === "object" ? { ...(cur as any) } : { themeId: tid || "custom" };
                                            next.accentMode = "solid";
                                            next.gradientId = null;
                                            actions.onSetSlide1Style?.(next);
                                          }}
                                          title="Switch to a solid accent color"
                                        >
                                          Switch to Solid
                                        </button>
                                        {slide1GradientPickerOpen ? (
                                          <div className="max-h-[180px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
                                            {SLIDE1_GRADIENTS.map((g) => {
                                              const selected = g.id === gradientId;
                                              return (
                                                <button
                                                  key={g.id}
                                                  type="button"
                                                  className={[
                                                    "w-full flex items-center justify-between gap-3 px-3 py-2 text-left",
                                                    selected ? "bg-slate-50" : "hover:bg-slate-50",
                                                  ].join(" ")}
                                                  disabled={!currentProjectId || switchingSlides || copyGenerating}
                                                  onClick={() => {
                                                    const cur = (slides as any)?.[0]?.inputData?.slide1Style || null;
                                                    const next = cur && typeof cur === "object" ? { ...(cur as any) } : { themeId: tid || "custom" };
                                                    next.accentMode = "gradient";
                                                    next.gradientId = g.id;
                                                    actions.onSetSlide1Style?.(next);
                                                    setSlide1GradientPickerOpen(false);
                                                  }}
                                                >
                                                  <span className="flex items-center gap-2">
                                                    <span
                                                      className="inline-block w-12 h-7 rounded-md border border-slate-200"
                                                      style={{ backgroundImage: slide1GradientCss(g as any) }}
                                                    />
                                                    <span className="text-xs font-semibold text-slate-800">{g.name}</span>
                                                  </span>
                                                  {selected ? <span className="text-[11px] font-semibold text-slate-600">Selected</span> : null}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="mt-1 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="color"
                                          className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                                          value={effective}
                                          disabled={!currentProjectId || switchingSlides || copyGenerating}
                                          onChange={(e) => {
                                            const nextHex = String(e.target.value || "").trim() || "#000000";
                                            const cur = (slides as any)?.[0]?.inputData?.slide1Style || null;
                                            const next = cur && typeof cur === "object" ? { ...(cur as any) } : { themeId: tid || "custom" };
                                            next.accentMode = "solid";
                                            next.gradientId = null;
                                            next.accentSolidHex = nextHex;
                                            actions.onSetSlide1Style?.(next);
                                          }}
                                          aria-label="Slide 1 text color"
                                        />
                                        <div className="text-xs text-slate-600 tabular-nums">{effective}</div>
                                      </div>
                                      <button
                                        type="button"
                                        className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                                        disabled={!currentProjectId || switchingSlides || copyGenerating}
                                        onClick={() => setSlide1GradientPickerOpen((v) => !v)}
                                        title="Use a gradient preset instead of a solid color"
                                      >
                                        Use gradient…
                                      </button>
                                      {slide1GradientPickerOpen ? (
                                        <div className="max-h-[180px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
                                          {SLIDE1_GRADIENTS.map((g) => (
                                            <button
                                              key={g.id}
                                              type="button"
                                              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                                              disabled={!currentProjectId || switchingSlides || copyGenerating}
                                              onClick={() => {
                                                const cur = (slides as any)?.[0]?.inputData?.slide1Style || null;
                                                const next = cur && typeof cur === "object" ? { ...(cur as any) } : { themeId: tid || "custom" };
                                                next.accentMode = "gradient";
                                                next.gradientId = g.id;
                                                actions.onSetSlide1Style?.(next);
                                                setSlide1GradientPickerOpen(false);
                                              }}
                                            >
                                              <span className="flex items-center gap-2">
                                                <span
                                                  className="inline-block w-12 h-7 rounded-md border border-slate-200"
                                                  style={{ backgroundImage: slide1GradientCss(g as any) }}
                                                />
                                                <span className="text-xs font-semibold text-slate-800">{g.name}</span>
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="text-[11px] font-semibold text-slate-600 uppercase">Body font (Slide 1)</div>
                              <select
                                className="mt-1 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
                                value={(() => {
                                  const local = String((slides as any)?.[0]?.inputData?.slide1BodyFontKey || "").trim();
                                  const global = String(bodyFontKey || "").trim();
                                  return local || global || "";
                                })()}
                                disabled={!currentProjectId || switchingSlides || copyGenerating}
                                onChange={(e) => {
                                  const next = String(e.target.value || "").trim();
                                  const global = String(bodyFontKey || "").trim();
                                  actions.onSetSlide1BodyFontKey?.(next && next !== global ? next : null);
                                }}
                                aria-label="Slide 1 body font"
                              >
                                <option value={String(bodyFontKey || "").trim() || ""}>Global default</option>
                                {fontOptions.map((o: any) => (
                                  <option
                                    key={`${o.family}@@${o.weight}`}
                                    value={`${o.family}@@${o.weight}`}
                                    style={String(o?.label || "").startsWith("Slide —") ? { color: "#2563eb" } : undefined}
                                  >
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                      onClick={() => actions?.onOpenBodyEmphasisModal?.()}
                      disabled={!currentProjectId || copyGenerating || switchingSlides}
                      title={!currentProjectId ? "Create or load a project first" : "Regenerate emphasis styles for this slide (Regular only)"}
                    >
                      Regenerate Emphasis Styles
                    </button>
                    <button
                      type="button"
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                      onClick={() => actions?.onOpenBodyRegenModal?.()}
                      disabled={!currentProjectId || copyGenerating || switchingSlides}
                      title={!currentProjectId ? "Create or load a project first" : "Regenerate body for this slide (Regular only)"}
                    >
                      Regenerate
                    </button>
                  </div>
                )}
              </div>
              <div className="relative">
                <RichTextInput
                  key={`rte-body:${currentProjectId || "none"}:${activeSlideIndex}`}
                  valueText={slides[activeSlideIndex]?.draftBody || ""}
                  valueRanges={slides[activeSlideIndex]?.draftBodyRanges || []}
                  onDebugLog={addLog}
                  debugId={`body proj=${currentProjectId || "none"} slide=${activeSlideIndex + 1}`}
                  onChange={actions.onChangeBodyRichText}
                  disabled={loading || switchingSlides || copyGenerating || enhancedLockOn}
                  placeholder={enhancedLockOn ? "Body locked" : "Enter body..."}
                  minHeightPx={96}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm"
                />
              </div>

              {enhancedLockOn ? (
                <div
                  className="absolute inset-0 rounded-xl border border-slate-200 z-20"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, rgba(15,23,42,0.06) 0px, rgba(15,23,42,0.06) 12px, rgba(255,255,255,0.10) 12px, rgba(255,255,255,0.10) 24px)",
                    backgroundColor: "rgba(248,250,252,0.55)",
                    pointerEvents: "auto",
                  }}
                  aria-hidden="true"
                >
                  <div className="absolute top-3 right-3 px-3 py-2 rounded-full bg-white/90 border border-slate-200 shadow-sm flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4 text-slate-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                    <div className="leading-tight">
                      <div className="text-xs font-semibold text-slate-900">Layout locked</div>
                      <div className="text-[11px] font-medium text-slate-600">Edit on canvas</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* AI Image Prompt Card (Enhanced only) */}
            {templateTypeId === "enhanced" && (
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white text-sm flex items-center justify-center">🎨</span>
                    <label className="text-sm font-semibold text-slate-900">AI Image Prompt</label>
                    {ui.aiImagePromptSaveStatus === "saving" && (
                      <span className="text-xs text-slate-500">Saving...</span>
                    )}
                    {ui.aiImagePromptSaveStatus === "saved" && (
                      <span className="text-xs text-emerald-600">Saved ✓</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
                    onClick={actions.onClickRegenerateImagePrompt}
                    disabled={ui.imagePromptGenerating || !currentProjectId || copyGenerating || switchingSlides}
                    title="Regenerate AI image prompt for this slide"
                  >
                    {ui.imagePromptGenerating ? "Generating..." : "Regenerate"}
                  </button>
                </div>
                <textarea
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 text-sm shadow-sm"
                  rows={4}
                  value={String(aiImagePromptDraft ?? slides[activeSlideIndex]?.draftAiImagePrompt ?? "")}
                  onChange={(e) => actions.onChangeAiImagePrompt(e.target.value)}
                  disabled={loading || switchingSlides || copyGenerating || ui.imagePromptGenerating}
                  placeholder="AI-generated image prompt will appear here after Generate Copy..."
                />
                {ui.imagePromptError && (
                  <div className="mt-2 text-xs text-red-600">{ui.imagePromptError}</div>
                )}

                {/* Generate Image Button with Progress Bar */}
                <div className="mt-4">
                  <div className="relative">
                    <div className="flex flex-col gap-2 md:flex-row md:flex-nowrap md:items-stretch">
                      <div className="flex items-stretch gap-2 min-w-0">
                        <select
                          className="h-12 flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm md:flex-none md:w-[280px] md:max-w-[280px]"
                          value={String(aiImageGenModel || "gpt-image-1.5")}
                          disabled={ui.aiImageGeneratingThis || copyGenerating || switchingSlides || ui.imagePromptGenerating}
                          onChange={(e) => actions.onChangeAiImageGenModel(e.target.value as any)}
                          title="AI image generation model (per-user default)"
                        >
                          <option value="gpt-image-1.5">GPT Image (gpt-image-1.5)</option>
                          <option value="gemini-3-pro-image-preview">Gemini 3 Pro (gemini-3-pro-image-preview)</option>
                        </select>

                        {String(aiImageGenModel) === "gemini-3-pro-image-preview" ? (
                          <button
                            type="button"
                            data-ai-settings-toggle="1"
                            className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                            onClick={actions.onClickToggleAiImageSettings}
                            disabled={ui.aiImageGeneratingThis || copyGenerating || switchingSlides || ui.imagePromptGenerating}
                            title="Image settings (session only)"
                          >
                            ⚙️
                          </button>
                        ) : null}
                      </div>

                      <div
                        className="h-12 w-full md:w-auto rounded-lg border border-slate-200 bg-white px-3 shadow-sm flex items-center justify-between gap-2"
                        title="If ON, AI-generated images will auto-run background removal (per project)."
                      >
                        <span className="text-xs font-semibold text-slate-700">BG Removal?</span>
                        <button
                          type="button"
                          className={[
                            "h-8 w-14 rounded-full transition-colors",
                            (aiImageAutoRemoveBgEnabled ?? true) ? "bg-black" : "bg-slate-300",
                          ].join(" ")}
                          onClick={() => actions.onToggleAiImageAutoRemoveBg?.()}
                          disabled={!currentProjectId || ui.aiImageGeneratingThis || copyGenerating || switchingSlides || ui.imagePromptGenerating}
                        >
                          <span
                            className={[
                              "block h-7 w-7 rounded-full bg-white shadow-sm translate-x-0 transition-transform",
                              (aiImageAutoRemoveBgEnabled ?? true) ? "translate-x-6" : "translate-x-1",
                            ].join(" ")}
                          />
                        </button>
                      </div>

                      <button
                        className="h-12 w-full md:flex-1 min-w-0 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50 relative overflow-hidden transition-shadow"
                        disabled={
                          !currentProjectId ||
                          ui.aiImageGeneratingThis ||
                          copyGenerating ||
                          switchingSlides ||
                          ui.imagePromptGenerating ||
                          !String(aiImagePromptDraft ?? slides[activeSlideIndex]?.draftAiImagePrompt ?? "").trim()
                        }
                        onClick={actions.onClickGenerateAiImage}
                      >
                        {ui.aiImageGeneratingThis ? (
                          <>
                            <div
                              className="absolute inset-0 bg-gradient-to-r from-purple-700 to-blue-700 transition-all duration-200"
                              style={{ width: `${ui.aiImageProgressThis || 0}%` }}
                            />
                            <span className="relative z-10 flex flex-col items-center justify-center leading-tight">
                              <span className="text-xs opacity-90">{ui.aiImageStatusThis || "Working..."}</span>
                              <span className="text-sm font-bold">{Math.round(ui.aiImageProgressThis || 0)}%</span>
                            </span>
                          </>
                        ) : (
                          "🎨 Generate Image"
                        )}
                      </button>
                    </div>

                    {String(aiImageGenModel) === "gemini-3-pro-image-preview" && aiImageSettingsOpen ? (
                      <div
                        ref={aiSettingsPopoverRef}
                        className="absolute right-0 mt-2 w-[320px] rounded-xl border border-slate-200 bg-white shadow-lg p-3 z-20"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="text-xs font-semibold text-slate-700">Gemini image settings (session only)</div>
                          <button
                            type="button"
                            className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50"
                            onClick={actions.onClickToggleAiImageSettings}
                            title="Close"
                            aria-label="Close"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs text-slate-600">
                            Aspect ratio
                            <select
                              className="mt-1 w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
                              value={String(aiImageAspectRatio || "3:4")}
                              onChange={(e) => actions.onChangeAiImageAspectRatio(e.target.value)}
                            >
                              {["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"].map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs text-slate-600">
                            Size
                            <select
                              className="mt-1 w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
                              value={String(aiImageSize || "1K")}
                              onChange={(e) => actions.onChangeAiImageSize(e.target.value)}
                            >
                              {["1K","2K","4K"].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          These settings apply to the next Gemini image generation only (not saved yet).
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {ui.aiImageErrorThis && (
                    <div className="mt-2 text-xs text-red-600">{ui.aiImageErrorThis}</div>
                  )}
                  <div className="mt-2 text-xs text-slate-500 text-center">
                    Uses AI to create an image matching this prompt. Takes 90 seconds to 2 minutes.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls Card */}
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-lg bg-slate-600 text-white text-sm flex items-center justify-center">⚙️</span>
              <span className="text-sm font-semibold text-slate-900">Controls</span>
              {copyGenerating ? (
                <span
                  className={[
                    "ml-1 inline-flex items-center gap-2 text-xs",
                    String(copyProgressLabel || "").toLowerCase().includes("transcrib") ? "text-red-600" : "text-slate-600",
                  ].join(" ")}
                >
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
                  <span className="font-medium">{String(copyProgressLabel || "Working…")}</span>
                </span>
              ) : null}
            </div>
            <div className="space-y-3">
              <button
                className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-md hover:shadow-lg transition-shadow disabled:opacity-50"
                disabled={!currentProjectId || copyGenerating || switchingSlides}
                onClick={actions.onClickGenerateCopy}
              >
                {copyGenerating ? "Generating Copy..." : "Generate Copy"}
              </button>

              {templateTypeId === "regular" ? (
                (() => {
                  const bodies = Array.isArray(slides) ? slides.map((s: any) => String(s?.draftBody || "").trim()) : [];
                  const allBodiesFilled = bodies.length === 6 && bodies.every((t: string) => !!t);
                  const hasGenerateCopyCompletedOnce = !!(ui as any)?.hasGenerateCopyCompletedOnce;
                  const eligible = allBodiesFilled || hasGenerateCopyCompletedOnce;
                  const disabled = !currentProjectId || copyGenerating || switchingSlides || !eligible;
                  const tooltip = !eligible
                    ? "Add copy to the slides or press Generate Copy for this button to be available."
                    : "Regenerate emphasis styles for all slides (Regular only).";
                  return (
                    <span title={tooltip} className="block">
                      <button
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                        disabled={disabled}
                        onClick={() => actions.onOpenEmphasisAllModal?.()}
                      >
                        Regenerate Emphasis Styles
                      </button>
                    </span>
                  );
                })()
              ) : null}

              {!currentProjectId ? (
                <div className="text-xs text-slate-500">
                  Create or select a project to enable Generate Copy.
                </div>
              ) : null}

              {ui.activeImageSelected ? (
                <>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    {(() => {
                      const pid = currentProjectId;
                      const key = pid ? ui.aiKey(pid, activeSlideIndex) : "";
                      const busy = key ? ui.bgRemovalBusyKeys.has(key) : false;
                      const enabled = ((layoutData as any)?.layout?.image?.bgRemovalEnabled ?? true) as boolean;
                      const statusRaw = String((layoutData as any)?.layout?.image?.bgRemovalStatus || (enabled ? "idle" : "disabled"));
                      const statusLabel = busy ? (enabled ? "processing" : "saving") : statusRaw;
                      return (
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="text-xs text-slate-500">
                            BG removal: <span className="font-semibold text-slate-800">{statusLabel}</span>
                          </div>
                          {busy ? <div className="text-[11px] text-slate-500">Working…</div> : null}
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Background removal</div>
                        <div className="text-xs text-slate-500">Improves text wrapping around subject.</div>
                      </div>
                      <button
                        type="button"
                        className={[
                          "h-8 w-14 rounded-full transition-colors",
                          ((layoutData as any)?.layout?.image?.bgRemovalEnabled ?? true) ? "bg-black" : "bg-slate-300",
                        ].join(" ")}
                        onClick={() => {
                          const cur = ((layoutData as any)?.layout?.image?.bgRemovalEnabled ?? true) as boolean;
                          actions.setActiveSlideImageBgRemoval(!cur);
                        }}
                        disabled={
                          ui.imageBusy ||
                          switchingSlides ||
                          copyGenerating ||
                          !currentProjectId ||
                          (currentProjectId ? ui.bgRemovalBusyKeys.has(ui.aiKey(currentProjectId, activeSlideIndex)) : false)
                        }
                        title="Toggle background removal for this image (persists per slide)"
                      >
                        <span
                          className={[
                            "block h-7 w-7 rounded-full bg-white shadow-sm translate-x-0 transition-transform",
                            ((layoutData as any)?.layout?.image?.bgRemovalEnabled ?? true) ? "translate-x-6" : "translate-x-1",
                          ].join(" ")}
                        />
                      </button>
                    </div>
                    {String((layoutData as any)?.layout?.image?.bgRemovalStatus || "") === "failed" ? (
                      <button
                        type="button"
                        className="mt-2 w-full h-9 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-semibold shadow-sm disabled:opacity-50"
                        onClick={() => actions.setActiveSlideImageBgRemoval(true)}
                        disabled={
                          ui.imageBusy ||
                          switchingSlides ||
                          copyGenerating ||
                          !currentProjectId ||
                          (currentProjectId ? ui.bgRemovalBusyKeys.has(ui.aiKey(currentProjectId, activeSlideIndex)) : false)
                        }
                        title="Try background removal again"
                      >
                        {currentProjectId && ui.bgRemovalBusyKeys.has(ui.aiKey(currentProjectId, activeSlideIndex))
                          ? "Processing…"
                          : "Try again"}
                      </button>
                    ) : null}
                  </div>
                  <button
                    className="w-full h-10 rounded-lg border border-red-200 bg-white text-red-700 text-sm font-semibold shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                    onClick={() => actions.deleteImageForActiveSlide("button")}
                    disabled={ui.imageBusy || switchingSlides || copyGenerating || !currentProjectId}
                    title="Delete the selected image from this slide"
                  >
                    {ui.imageBusy ? "Working…" : "Delete Image"}
                  </button>
                </>
              ) : null}

              {ui.copyError ? <div className="text-xs text-red-600">❌ {ui.copyError}</div> : null}
              {templateTypeId !== "regular" ? (
                <>
                  <button
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                    onClick={actions.onClickRealignText}
                    disabled={loading || ui.realigning || !layoutData || switchingSlides || copyGenerating}
                  >
                    {ui.realigning ? "Realigning..." : "Realign Text"}
                  </button>
                </>
              ) : null}

              <button
                className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                onClick={actions.onClickUndo}
                disabled={layoutHistoryLength === 0 || ui.realigning || switchingSlides || copyGenerating}
              >
                Undo
              </button>

              <button
                className={[
                  "w-full h-10 rounded-lg text-sm font-semibold shadow-sm transition-all border",
                  showLayoutOverlays
                    ? "bg-gradient-to-b from-slate-600 to-slate-700 text-white border-slate-500 hover:from-slate-500 hover:to-slate-600"
                    : "bg-gradient-to-b from-slate-100 to-slate-200 text-slate-600 border-slate-300 hover:from-slate-50 hover:to-slate-100",
                ].join(" ")}
                onClick={actions.onClickToggleOverlays}
              >
                {showLayoutOverlays ? "Hide Layout Overlays" : "Show Layout Overlays"}
              </button>

              <button
                type="button"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                onClick={actions.onOpenBrandAlignmentModal}
                disabled={switchingSlides || copyGenerating}
                title="Check if your slides + caption align with your brand (Phase 0: prompt setup)"
              >
                Check Alignment
              </button>

              {ui.saveError && <div className="text-xs text-red-600">❌ {ui.saveError}</div>}
              {ui.error && <div className="text-xs text-red-600">❌ {ui.error}</div>}

              {ui.error && inputData && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="text-sm font-semibold text-red-800">Generation Failed</div>
                  <div className="text-xs text-red-700 mt-1">{ui.error}</div>
                  <button
                    className="mt-2 w-full h-9 rounded-lg bg-red-600 text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                    onClick={actions.onClickRetry}
                    disabled={!inputData || loading || switchingSlides}
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Caption Card */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-500 text-white text-sm flex items-center justify-center">✍️</span>
              <span className="text-sm font-semibold text-slate-900">Caption</span>
            </div>
            <div className="flex items-center gap-2">
              {ui.captionRegenGenerating ? (
                <span className="text-xs text-slate-500">Generating...</span>
              ) : null}
                {ui.captionCopyStatus === "copied" ? (
                <span className="text-xs text-emerald-700 font-medium">Copied!</span>
                ) : ui.captionCopyStatus === "error" ? (
                <span className="text-xs text-red-600 font-medium">Copy failed</span>
              ) : null}
              {isSuperadmin ? (
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                  onClick={() => setCaptionHistoryOpen(true)}
                  disabled={!currentProjectId || copyGenerating || ui.captionRegenGenerating}
                  title={!currentProjectId ? "Create or load a project first" : "View caption regeneration history"}
                  aria-label="View caption regen history"
                >
                  History
                </button>
              ) : null}
              <button
                type="button"
                className="h-8 w-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                onClick={() => actions.onOpenPromptModal?.("caption")}
                disabled={copyGenerating}
                title="Edit caption regenerate prompt"
                aria-label="Edit caption regenerate prompt"
              >
                ⚙️
              </button>
              <button
                type="button"
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                onClick={actions.onClickRegenerateCaption}
                disabled={ui.captionRegenGenerating || !currentProjectId || copyGenerating || switchingSlides}
                title="Regenerate caption with Claude"
              >
                {ui.captionRegenGenerating ? "Generating..." : "Regenerate"}
              </button>
              <button
                type="button"
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                  onClick={actions.onClickCopyCaption}
                disabled={copyGenerating || ui.captionRegenGenerating}
                title="Copy caption to clipboard"
              >
                Copy
              </button>
            </div>
          </div>
          <textarea
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm"
            rows={3}
            placeholder="Write a caption..."
            value={ui.captionDraft}
            onChange={(e) => actions.onChangeCaption(e.target.value)}
            disabled={copyGenerating || ui.captionRegenGenerating}
          />
          {ui.captionRegenError ? (
            <div className="mt-2 text-xs text-red-600">❌ {ui.captionRegenError}</div>
          ) : null}
        </div>

        <CaptionRegenHistoryModal
          open={captionHistoryOpen}
          onClose={() => setCaptionHistoryOpen(false)}
          projectId={currentProjectId || null}
        />

        <DebugCard
          debugScreenshot={ui.debugScreenshot || null}
          showDebugPreview={ui.showDebugPreview}
          setShowDebugPreview={actions.setShowDebugPreview}
          debugLogs={Array.isArray(ui.debugLogs) ? ui.debugLogs : []}
        />
      </div>
    </section>
  );
}

