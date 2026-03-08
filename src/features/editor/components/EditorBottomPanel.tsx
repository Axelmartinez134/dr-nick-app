/* eslint-disable react/no-unstable-nested-components */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RichTextInput } from "@/app/editor/RichTextInput";
import { DebugCard } from "./DebugCard";
import { useEditorSelector } from "@/features/editor/store";
import { CaptionRegenHistoryModal } from "@/features/editor/components/CaptionRegenHistoryModal";
import { SLIDE1_GRADIENTS, slide1GradientCss } from "@/features/editor/slide1StylePresets";
import { supabase } from "@/app/components/auth/AuthContext";

export function EditorBottomPanel() {
  const templateTypeId = useEditorSelector((s) => s.templateTypeId);
  // IMPORTANT: Use the canonical store value (not bottomPanelUi) so slide-index-gated controls
  // can't disappear if bottomPanelUi publishing gets out of sync.
  const activeSlideIndexCanonical = useEditorSelector((s: any) => {
    const n = Number((s as any)?.activeSlideIndex);
    return Number.isFinite(n) ? n : 0;
  });
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const isMobile = useEditorSelector((s: any) => !!(s as any).isMobile);
  const currentProjectIdForScriptPrompt = useEditorSelector((s: any) =>
    (s as any)?.bottomPanelUi?.currentProjectId ? String((s as any).bottomPanelUi.currentProjectId) : null
  );
  const fontOptions = useEditorSelector((s: any) => ((s as any).fontOptions || []) as Array<any>);
  const bodyFontKey = useEditorSelector((s: any) => String((s as any).bodyFontKey || ""));
  const ui = useEditorSelector((s: any) => (s as any).bottomPanelUi);
  const actions = useEditorSelector((s: any) => (s as any).actions);
  const aiSettingsPopoverRef = useRef<HTMLDivElement | null>(null);
  const slide1CopyPastePopoverRef = useRef<HTMLDivElement | null>(null);
  const slide1BgPopoverRef = useRef<HTMLDivElement | null>(null);
  const slide1TextPopoverRef = useRef<HTMLDivElement | null>(null);
  const slideNTextPopoverRef = useRef<HTMLDivElement | null>(null);
  const [captionHistoryOpen, setCaptionHistoryOpen] = useState(false);
  const [slide1TextOpen, setSlide1TextOpen] = useState(false);
  const [slide1BgOpen, setSlide1BgOpen] = useState(false);
  const [slide1CopyPasteOpen, setSlide1CopyPasteOpen] = useState(false);
  const [slide1CopyPasteDraft, setSlide1CopyPasteDraft] = useState<string>("");
  const [slide1CopyPasteStatus, setSlide1CopyPasteStatus] = useState<"idle" | "copied" | "applied" | "error">("idle");
  const [slide1CopyPasteError, setSlide1CopyPasteError] = useState<string | null>(null);
  const [slide1GradientPickerOpen, setSlide1GradientPickerOpen] = useState(false);
  const [slide1TextTarget, setSlide1TextTarget] = useState<"body" | "callout">("body");
  const [slide1CalloutDraft, setSlide1CalloutDraft] = useState<string>("");
  const [slide1BodySizeDraft, setSlide1BodySizeDraft] = useState<string>("");
  const slide1BodySizeEditingRef = useRef<boolean>(false);
  const slide1BodySizeHoldTimeoutRef = useRef<number | null>(null);
  const slide1BodySizeHoldIntervalRef = useRef<number | null>(null);

  // Slide 2–6 text overrides (Regular only).
  const [slideTextOpen, setSlideTextOpen] = useState(false);
  const [slideCalloutDraft, setSlideCalloutDraft] = useState<string>("");
  const [slideBodySizeDraft, setSlideBodySizeDraft] = useState<string>("");
  const slideBodySizeEditingRef = useRef<boolean>(false);

  const [scriptPromptCopyStatus, setScriptPromptCopyStatus] = useState<"idle" | "copied" | "error" | "loading">("idle");
  const [scriptPromptPrefetchStatus, setScriptPromptPrefetchStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [scriptPromptPrefetchError, setScriptPromptPrefetchError] = useState<string | null>(null);
  const [scriptPromptCachedText, setScriptPromptCachedText] = useState<string>("");
  const scriptPromptCachedProjectIdRef = useRef<string | null>(null);

  const getActiveAccountHeader = (): Record<string, string> => {
    try {
      const id = typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
      return id ? ({ "x-account-id": id } as Record<string, string>) : ({} as Record<string, string>);
    } catch {
      return {} as Record<string, string>;
    }
  };

  const getToken = async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  };

  const buildScriptPromptPreviewText = (args: { system: string; contextText: string }) => {
    const sys = String(args.system || "").trim();
    const ctx = String(args.contextText || "").trim();
    const firstMsg = "<type your first message here>";
    return [
      `SYSTEM:\n${sys || "-"}`,
      ``,
      `CACHED_CONTEXT_BLOCK (frozen):\n${ctx || "-"}`,
      ``,
      `FIRST_USER_MESSAGE:\n${firstMsg}`,
    ].join("\n");
  };

  const prefetchScriptPrompt = async (projectId: string) => {
    const pid = String(projectId || "").trim();
    if (!pid) return;
    // Avoid refetching if we already have a ready cache for this pid.
    if (scriptPromptCachedProjectIdRef.current === pid && scriptPromptPrefetchStatus === "ready" && !!scriptPromptCachedText) return;
    setScriptPromptPrefetchStatus("loading");
    setScriptPromptPrefetchError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/editor/projects/script-chat/prompt-preview?projectId=${encodeURIComponent(pid)}`, { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load prompt (${res.status})`));
      const text = buildScriptPromptPreviewText({ system: String(j?.system || ""), contextText: String(j?.contextText || "") });
      scriptPromptCachedProjectIdRef.current = pid;
      setScriptPromptCachedText(text);
      setScriptPromptPrefetchStatus("ready");
    } catch (e: any) {
      scriptPromptCachedProjectIdRef.current = pid;
      setScriptPromptCachedText("");
      setScriptPromptPrefetchStatus("error");
      setScriptPromptPrefetchError(String(e?.message || e || "Failed to prepare prompt"));
    }
  };

  // Mobile browsers often block clipboard writes if we await network before copying.
  // Prefetch the prompt preview in the background so the tap-to-copy can be synchronous.
  useEffect(() => {
    if (!isMobile || !isSuperadmin) return;
    const pid = String(currentProjectIdForScriptPrompt || "").trim();
    if (!pid) {
      scriptPromptCachedProjectIdRef.current = null;
      setScriptPromptCachedText("");
      setScriptPromptPrefetchStatus("idle");
      setScriptPromptPrefetchError(null);
      return;
    }
    void prefetchScriptPrompt(pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, isSuperadmin, currentProjectIdForScriptPrompt]);

  const onCopyScriptPrompt = (projectId: string) => {
    const pid = String(projectId || "").trim();
    if (!pid) return;
    if (scriptPromptCopyStatus === "loading") return;

    // If we don't have the prompt cached yet, kick off prefetch and ask user to tap again.
    if (!scriptPromptCachedText || scriptPromptCachedProjectIdRef.current !== pid) {
      void prefetchScriptPrompt(pid);
      setScriptPromptCopyStatus("error");
      window.setTimeout(() => setScriptPromptCopyStatus("idle"), 1400);
      return;
    }

    const text = scriptPromptCachedText;
    setScriptPromptCopyStatus("loading");

    const finishCopied = () => {
      setScriptPromptCopyStatus("copied");
      window.setTimeout(() => setScriptPromptCopyStatus("idle"), 1200);
    };
    const finishError = () => {
      setScriptPromptCopyStatus("error");
      window.setTimeout(() => setScriptPromptCopyStatus("idle"), 1600);
    };

    // IMPORTANT: no awaits before attempting clipboard write (mobile gesture requirement).
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => finishCopied())
          .catch(() => {
            try {
              const ta = document.createElement("textarea");
              ta.value = text;
              ta.setAttribute("readonly", "true");
              ta.style.position = "fixed";
              ta.style.top = "0";
              ta.style.left = "0";
              ta.style.opacity = "0";
              ta.style.pointerEvents = "none";
              document.body.appendChild(ta);
              ta.focus();
              ta.select();
              const ok = document.execCommand("copy");
              document.body.removeChild(ta);
              if (!ok) throw new Error("copy command failed");
              finishCopied();
            } catch {
              finishError();
            }
          });
        return;
      }
    } catch {
      // fall through
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (!ok) throw new Error("copy command failed");
      finishCopied();
    } catch {
      finishError();
    }
  };

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

  // Click-outside to close popovers (Slide 1 + Slide N).
  useEffect(() => {
    const anyOpen = slide1CopyPasteOpen || slide1BgOpen || slide1TextOpen || slideTextOpen;
    if (!anyOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Clicking a trigger toggles; don't treat as outside.
      if (target.closest?.('[data-popover-trigger="slide1-copy-paste"]')) return;
      if (target.closest?.('[data-popover-trigger="slide1-bg"]')) return;
      if (target.closest?.('[data-popover-trigger="slide1-text"]')) return;
      if (target.closest?.('[data-popover-trigger="slide-n-text"]')) return;

      // Clicking inside any open popover should not close it.
      if (slide1CopyPastePopoverRef.current?.contains(target)) return;
      if (slide1BgPopoverRef.current?.contains(target)) return;
      if (slide1TextPopoverRef.current?.contains(target)) return;
      if (slideNTextPopoverRef.current?.contains(target)) return;

      // Outside click: close immediately.
      if (slide1CopyPasteOpen) setSlide1CopyPasteOpen(false);
      if (slide1BgOpen) setSlide1BgOpen(false);
      if (slide1TextOpen) setSlide1TextOpen(false);
      if (slideTextOpen) setSlideTextOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [slide1BgOpen, slide1CopyPasteOpen, slide1TextOpen, slideTextOpen]);

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

  // Slide 2–6: close popover if it can't apply.
  useEffect(() => {
    if (templateTypeId !== "regular" || activeSlideIndexForSlide1Text <= 0) setSlideTextOpen(false);
  }, [activeSlideIndexForSlide1Text, templateTypeId]);

  // Keep Slide 2–6 body size draft in sync when not actively typing.
  useEffect(() => {
    if (!slideTextOpen) {
      slideBodySizeEditingRef.current = false;
      return;
    }
    if (slideBodySizeEditingRef.current) return;
    const s = (ui as any)?.slides?.[activeSlideIndexForSlide1Text] || null;
    setSlideBodySizeDraft(String(Math.round(Number((s as any)?.draftBodyFontSizePx ?? 48)) || 48));
  }, [activeSlideIndexForSlide1Text, slideTextOpen, ui]);

  if (!ui || !actions) return null;

  const {
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

  // Prefer the canonical store slide index; fall back to bottomPanelUi when sane.
  const activeSlideIndex =
    Number.isFinite(Number((ui as any)?.activeSlideIndex)) ? Number((ui as any).activeSlideIndex) : activeSlideIndexCanonical;

  const outreachMessageDraft = String((ui as any)?.outreachMessageDraft || "");
  const outreachMessageCopyStatus = String((ui as any)?.outreachMessageCopyStatus || "idle");
  const projectBackgroundColor = String((ui as any)?.projectBackgroundColor || "#ffffff");
  const isOutreachProject = !!(ui as any)?.isOutreachProject;
  const showOutreachMessage = isSuperadmin && isOutreachProject;

  const clampSlide1BodySize = (n: number) => Math.max(8, Math.min(999, Math.round(Number(n) || 0)));
  const commitSlide1BodySizeLive = (next: number) => {
    const n = clampSlide1BodySize(next);
    setSlide1BodySizeDraft(String(n));
    actions.onChangeBodyFontSize?.({ target: { value: n } } as any);
  };

  const buildSlide1PresetJson = () => {
    const slide0 = (slides as any)?.[0] || null;
    const input0 = slide0?.inputData || null;
    const templateId = String((ui as any)?.slide1TemplateIdSnapshot || "").trim() || null;
    const bodyFontSizePx =
      Number.isFinite(Number(slide0?.draftBodyFontSizePx))
        ? Math.round(Number(slide0.draftBodyFontSizePx))
        : (Number.isFinite(Number(input0?.bodyFontSizePx)) ? Math.round(Number(input0.bodyFontSizePx)) : 48);

    const payload = {
      kind: "dn.slide1_preset",
      v: 1,
      createdAt: new Date().toISOString(),
      templateId,
      slide1: {
        slide1Background: (input0 as any)?.slide1Background ?? null,
        slide1Card: (input0 as any)?.slide1Card ?? null,
        slide1Style: (input0 as any)?.slide1Style ?? null,
        slide1BodyFontKey: (input0 as any)?.slide1BodyFontKey ?? null,
        slide1TextNoise: (input0 as any)?.slide1TextNoise ?? null,
        slide1BodyLineGapPx: (input0 as any)?.slide1BodyLineGapPx ?? 0,
        bodyFontSizePx,
      },
    };
    return JSON.stringify(payload, null, 2);
  };

  const copySlide1Preset = async () => {
    try {
      const json = buildSlide1PresetJson();
      setSlide1CopyPasteDraft(json);
      setSlide1CopyPasteError(null);
      setSlide1CopyPasteStatus("idle");
      try {
        await navigator.clipboard.writeText(json);
        setSlide1CopyPasteStatus("copied");
        window.setTimeout(() => setSlide1CopyPasteStatus("idle"), 1200);
      } catch {
        setSlide1CopyPasteStatus("error");
        setSlide1CopyPasteError("Clipboard blocked. The JSON is in the box below — copy it manually.");
      }
    } catch (e: any) {
      setSlide1CopyPasteStatus("error");
      setSlide1CopyPasteError(String(e?.message || "Failed to build preset"));
    }
  };

  const applySlide1PresetFromText = async (rawText: string) => {
    const text = String(rawText || "").trim();
    if (!text) {
      setSlide1CopyPasteStatus("error");
      setSlide1CopyPasteError("Paste preset JSON first.");
      return;
    }
    try {
      try {
        addLog?.(`📋 Slide 1 preset: apply start (len=${text.length})`);
      } catch {
        // ignore
      }
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");
      if (String((parsed as any).kind || "") !== "dn.slide1_preset") throw new Error("Not a Slide 1 preset");
      if (Number((parsed as any).v || 0) !== 1) throw new Error("Unsupported preset version");

      setSlide1CopyPasteError(null);

      const templateId = String((parsed as any).templateId || "").trim() || null;
      try {
        addLog?.(
          `📋 Slide 1 preset: parsed templateId=${templateId || "—"} currentMapping=${String((ui as any)?.slide1TemplateIdSnapshot || "—")}`
        );
      } catch {
        // ignore
      }
      if (templateId) {
        const ok = await Promise.resolve(actions.onSetCurrentProjectSlide1TemplateIdSnapshot?.(templateId) as any);
        try {
          addLog?.(`📋 Slide 1 preset: template apply result ok=${ok ? "1" : "0"} (requested=${templateId})`);
        } catch {
          // ignore
        }
        if (!ok) {
          setSlide1CopyPasteError("Applied style, but could not apply the pasted Slide 1 template (missing / invalid).");
        }
      }

      const s1 = (parsed as any).slide1 || {};
      try {
        const has = (k: string) => (s1 as any)?.[k] !== undefined;
        addLog?.(
          `📋 Slide 1 preset: applying input keys=` +
            [
              has("slide1Background") ? "bg" : null,
              has("slide1Card") ? "card" : null,
              has("slide1Style") ? "style" : null,
              has("slide1BodyFontKey") ? "font" : null,
              has("slide1TextNoise") ? "textNoise" : null,
              has("slide1BodyLineGapPx") ? "lineGap" : null,
              has("bodyFontSizePx") ? "bodySize" : null,
            ]
              .filter(Boolean)
              .join(",")
        );
      } catch {
        // ignore
      }
      actions.onApplySlide1PresetInput?.({
        slide1Background: s1.slide1Background ?? undefined,
        slide1Card: s1.slide1Card ?? undefined,
        slide1Style: s1.slide1Style ?? undefined,
        slide1BodyFontKey: s1.slide1BodyFontKey ?? undefined,
        slide1TextNoise: s1.slide1TextNoise ?? undefined,
        slide1BodyLineGapPx:
          s1.slide1BodyLineGapPx == null ? undefined : Math.max(-80, Math.min(80, Math.round(Number(s1.slide1BodyLineGapPx) || 0))),
      } as any);

      if (Number.isFinite(Number(s1.bodyFontSizePx))) {
        const n = Math.max(8, Math.min(999, Math.round(Number(s1.bodyFontSizePx))));
        actions.onChangeBodyFontSize?.({ target: { value: n } } as any);
      }

      try {
        addLog?.(`📋 Slide 1 preset: apply done (mappingNow=${String((ui as any)?.slide1TemplateIdSnapshot || "—")})`);
      } catch {
        // ignore
      }
      setSlide1CopyPasteStatus("applied");
      window.setTimeout(() => setSlide1CopyPasteStatus("idle"), 1200);
    } catch (e: any) {
      setSlide1CopyPasteStatus("error");
      setSlide1CopyPasteError(String(e?.message || "Failed to apply preset"));
    }
  };

  const pasteSlide1PresetFromClipboard = async () => {
    setSlide1CopyPasteError(null);
    setSlide1CopyPasteStatus("idle");
    try {
      const text = await navigator.clipboard.readText();
      setSlide1CopyPasteDraft(String(text || ""));
      await applySlide1PresetFromText(String(text || ""));
    } catch {
      setSlide1CopyPasteStatus("error");
      setSlide1CopyPasteError("Clipboard blocked. Paste the JSON into the box and click Apply.");
    }
  };

  const applyBoldComplementarySlide1Colors = () => {
    if (!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn) return;
    if (templateTypeId !== "regular") return;
    if (activeSlideIndex !== 0) return;

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const toHex2 = (n: number) => n.toString(16).padStart(2, "0");
    const rgbToHex = (r: number, g: number, b: number) =>
      `#${toHex2(clamp(Math.round(r), 0, 255))}${toHex2(clamp(Math.round(g), 0, 255))}${toHex2(clamp(Math.round(b), 0, 255))}`;
    const hexToRgb = (h: string) => {
      const s = String(h || "").replace("#", "").trim();
      if (s.length === 3) {
        const r = parseInt(s[0] + s[0], 16);
        const g = parseInt(s[1] + s[1], 16);
        const b = parseInt(s[2] + s[2], 16);
        return { r, g, b };
      }
      if (s.length >= 6) {
        const r = parseInt(s.slice(0, 2), 16);
        const g = parseInt(s.slice(2, 4), 16);
        const b = parseInt(s.slice(4, 6), 16);
        return { r, g, b };
      }
      return { r: 0, g: 0, b: 0 };
    };
    const hslToRgb = (h: number, s: number, l: number) => {
      // h: 0..360, s/l: 0..1
      const hh = ((h % 360) + 360) % 360;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
      const m = l - c / 2;
      let r1 = 0, g1 = 0, b1 = 0;
      if (hh < 60) [r1, g1, b1] = [c, x, 0];
      else if (hh < 120) [r1, g1, b1] = [x, c, 0];
      else if (hh < 180) [r1, g1, b1] = [0, c, x];
      else if (hh < 240) [r1, g1, b1] = [0, x, c];
      else if (hh < 300) [r1, g1, b1] = [x, 0, c];
      else [r1, g1, b1] = [c, 0, x];
      return {
        r: (r1 + m) * 255,
        g: (g1 + m) * 255,
        b: (b1 + m) * 255,
      };
    };
    const rgbToHsl = (r: number, g: number, b: number) => {
      const rr = r / 255, gg = g / 255, bb = b / 255;
      const max = Math.max(rr, gg, bb);
      const min = Math.min(rr, gg, bb);
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === rr) h = 60 * (((gg - bb) / d) % 6);
        else if (max === gg) h = 60 * ((bb - rr) / d + 2);
        else h = 60 * ((rr - gg) / d + 4);
      }
      if (h < 0) h += 360;
      const l = (max + min) / 2;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      return { h, s, l };
    };
    const relLum = (rgb: { r: number; g: number; b: number }) => {
      const f = (u: number) => {
        const c = u / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      const r = f(rgb.r), g = f(rgb.g), b = f(rgb.b);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrastRatio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
      const la = relLum(a);
      const lb = relLum(b);
      const L1 = Math.max(la, lb);
      const L2 = Math.min(la, lb);
      return (L1 + 0.05) / (L2 + 0.05);
    };

    const MIN_CR = 4.5; // prioritize maximum readability

    const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    const maybeGradient = Math.random() < 0.3;

    // Gradient path: pick gradient first, then choose a complementary bold card color that passes contrast for ALL stops.
    const chooseGradientAndBg = () => {
      const grads = SLIDE1_GRADIENTS.slice();
      for (let tries = 0; tries < 40; tries++) {
        const g = grads[Math.floor(Math.random() * grads.length)];
        const stops = Array.isArray((g as any)?.stops) ? ((g as any).stops as any[]) : [];
        const stopHexes = stops.map((s) => String(s?.color || "").trim()).filter(Boolean);
        if (stopHexes.length < 2) continue;
        const firstRgb = hexToRgb(stopHexes[0]);
        const rep = rgbToHsl(firstRgb.r, firstRgb.g, firstRgb.b);
        const bgHue = (rep.h + 180 + rand(-16, 16) + 360) % 360;

        // Try a few lightness bands to find something that contrasts with all gradient stops.
        const lCandidates = [0.28, 0.38, 0.48, 0.58, 0.68];
        const s = clamp(rand(0.82, 0.96), 0, 1);
        for (const l of lCandidates.sort(() => Math.random() - 0.5)) {
          const bgRgb = hslToRgb(bgHue, s, clamp01(l));
          const bgHex = rgbToHex(bgRgb.r, bgRgb.g, bgRgb.b);
          const bg = hexToRgb(bgHex);
          const ok = stopHexes.every((hx) => contrastRatio(bg, hexToRgb(hx)) >= MIN_CR);
          if (ok) return { bgHex, gradientId: String((g as any).id || "").trim() };
        }
      }
      return null;
    };

    // Solid path: pick bold bg and complementary bold text that passes contrast.
    const chooseSolid = () => {
      for (let tries = 0; tries < 60; tries++) {
        const bgHue = rand(0, 360);
        const bgS = clamp(rand(0.82, 0.98), 0, 1);
        const bgL = clamp(rand(0.30, 0.66), 0, 1);
        const bgRgb = hslToRgb(bgHue, bgS, bgL);
        const bgHex = rgbToHex(bgRgb.r, bgRgb.g, bgRgb.b);
        const bg = hexToRgb(bgHex);

        const textHue = (bgHue + 180 + rand(-18, 18) + 360) % 360;
        const textS = clamp(rand(0.88, 1.0), 0, 1);
        // Try extreme lightness values for readability.
        const lOptions = [0.92, 0.12];
        for (const textL of lOptions) {
          const trgb = hslToRgb(textHue, textS, textL);
          const textHex = rgbToHex(trgb.r, trgb.g, trgb.b);
          const cr = contrastRatio(bg, hexToRgb(textHex));
          if (cr >= MIN_CR) return { bgHex, textHex };
        }
      }
      return null;
    };

    let nextCardHex = "#ffffff";
    let nextAccentMode: "solid" | "gradient" = "solid";
    let nextAccentSolidHex: string | null = null;
    let nextGradientId: string | null = null;

    if (maybeGradient) {
      const g = chooseGradientAndBg();
      if (g?.bgHex && g.gradientId) {
        nextCardHex = g.bgHex;
        nextAccentMode = "gradient";
        nextGradientId = g.gradientId;
        nextAccentSolidHex = null;
      } else {
        const solid = chooseSolid();
        if (solid) {
          nextCardHex = solid.bgHex;
          nextAccentMode = "solid";
          nextAccentSolidHex = solid.textHex;
        }
      }
    } else {
      const solid = chooseSolid();
      if (solid) {
        nextCardHex = solid.bgHex;
        nextAccentMode = "solid";
        nextAccentSolidHex = solid.textHex;
      } else {
        // Extremely defensive fallback: pick bold bg, then pure white/black whichever contrasts.
        const bgRgb = hslToRgb(rand(0, 360), 0.95, 0.45);
        nextCardHex = rgbToHex(bgRgb.r, bgRgb.g, bgRgb.b);
        const bg = hexToRgb(nextCardHex);
        const white = { r: 255, g: 255, b: 255 };
        const black = { r: 0, g: 0, b: 0 };
        nextAccentSolidHex = contrastRatio(bg, white) >= contrastRatio(bg, black) ? "#ffffff" : "#000000";
      }
    }

    // Apply atomically so one update can't overwrite the other.
    actions.onSetSlide1CardAndAccent?.({
      cardHex: String(nextCardHex || "#ffffff").trim() || "#ffffff",
      accentMode: nextAccentMode,
      accentSolidHex: nextAccentMode === "solid" ? (String(nextAccentSolidHex || "#ffffff").trim() || "#ffffff") : null,
      gradientId: nextAccentMode === "gradient" ? (String(nextGradientId || "").trim() || null) : null,
    } as any);
  };

  const hexToRgbSafe = (h: string) => {
    const s = String(h || "").replace("#", "").trim();
    if (s.length === 3) {
      const r = parseInt(s[0] + s[0], 16);
      const g = parseInt(s[1] + s[1], 16);
      const b = parseInt(s[2] + s[2], 16);
      return { r, g, b };
    }
    if (s.length >= 6) {
      const r = parseInt(s.slice(0, 2), 16);
      const g = parseInt(s.slice(2, 4), 16);
      const b = parseInt(s.slice(4, 6), 16);
      return { r, g, b };
    }
    return { r: 0, g: 0, b: 0 };
  };
  const relLum = (rgb: { r: number; g: number; b: number }) => {
    const f = (u: number) => {
      const c = u / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const r = f(rgb.r), g = f(rgb.g), b = f(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const pickBWForBg = (bgHex: string) => {
    try {
      const lum = relLum(hexToRgbSafe(bgHex));
      // Threshold tuned for legibility; if background is bright, use black text.
      return lum > 0.55 ? "#000000" : "#ffffff";
    } catch {
      return "#000000";
    }
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
                            onClick={() => {
                              setSlide1BgOpen(false);
                              setSlide1TextOpen(false);
                              setSlide1GradientPickerOpen(false);
                              setSlide1CopyPasteOpen((v) => !v);
                            }}
                            disabled={!currentProjectId || copyGenerating || switchingSlides || enhancedLockOn}
                            title="Copy/Paste Slide 1 setup (style + background + template)"
                            aria-label={slide1CopyPasteOpen ? "Close Copy/Paste" : "Open Copy/Paste"}
                            data-popover-trigger="slide1-copy-paste"
                          >
                            Copy/Paste
                          </button>
                          <button
                            type="button"
                            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                            onClick={() => applyBoldComplementarySlide1Colors()}
                            disabled={!currentProjectId || copyGenerating || switchingSlides || enhancedLockOn}
                            title="Auto-pick bold complementary Card + Text colors (Slide 1)"
                            aria-label="Auto-pick Slide 1 colors"
                          >
                            Colors
                          </button>
                          <button
                            type="button"
                            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                            onClick={() => setSlide1BgOpen((v) => !v)}
                            disabled={!currentProjectId || copyGenerating || switchingSlides}
                            title={!currentProjectId ? "Create or load a project first" : "Slide 1 background (color + texture)"}
                            aria-label={slide1BgOpen ? "Close Slide 1 background controls" : "Open Slide 1 background controls"}
                            data-popover-trigger="slide1-bg"
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
                            data-popover-trigger="slide1-text"
                          >
                            Slide 1 text
                          </button>
                        </div>

                        {slide1CopyPasteOpen ? (
                          <div
                            ref={slide1CopyPastePopoverRef}
                            className="absolute right-0 top-[calc(100%+8px)] z-[75] w-[520px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold text-slate-900">Slide 1 setup</div>
                                <div className="mt-1 text-[10px] text-slate-500">
                                  Includes Background + Card + Slide 1 text settings, plus Slide 1 template snapshot.
                                </div>
                              </div>
                              <button
                                type="button"
                                className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
                                onClick={() => setSlide1CopyPasteOpen(false)}
                                aria-label="Close"
                              >
                                ✕
                              </button>
                            </div>

                            {slide1CopyPasteError ? (
                              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800">
                                {slide1CopyPasteError}
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                                disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                onClick={() => void copySlide1Preset()}
                              >
                                {slide1CopyPasteStatus === "copied" ? "Copied" : "Copy setup"}
                              </button>
                              <button
                                type="button"
                                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                                disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                onClick={() => void pasteSlide1PresetFromClipboard()}
                              >
                                Paste + apply
                              </button>
                              <button
                                type="button"
                                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                                disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                onClick={() => void applySlide1PresetFromText(slide1CopyPasteDraft)}
                              >
                                Apply from box
                              </button>
                              <div className="ml-auto text-[10px] font-semibold text-slate-500">
                                Template: {String((ui as any)?.slide1TemplateIdSnapshot || "—")}
                              </div>
                            </div>

                            <textarea
                              className="mt-3 w-full h-40 rounded-xl border border-slate-200 bg-white p-2 text-[11px] font-mono text-slate-800"
                              value={slide1CopyPasteDraft}
                              onChange={(e) => setSlide1CopyPasteDraft(String(e.target.value || ""))}
                              placeholder='Paste preset JSON here…'
                              spellCheck={false}
                            />
                          </div>
                        ) : null}

                        {slide1BgOpen ? (
                          <div
                            ref={slide1BgPopoverRef}
                            className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[520px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
                          >
                            <div className="text-xs font-semibold text-slate-900">Slide 1 background</div>
                            {(() => {
                              const bg = (slides as any)?.[0]?.inputData?.slide1Background || null;
                              const bgHex = String(bg?.backgroundHex || "").trim() || "#ffffff";
                              const patternId = String(bg?.patternId || "none") as any;
                              const card = (slides as any)?.[0]?.inputData?.slide1Card || null;
                              const cardEnabled = !!(card && typeof card === "object" ? (card as any).enabled : false);
                              const cardHex = String((card as any)?.backgroundHex || "").trim() || "#ffffff";
                              const cardPatternId = String((card as any)?.patternId || "none") as any;
                              const cardBorderEnabled = !!(card && typeof card === "object" ? (card as any).borderEnabled : true);
                              const cardBorderThicknessPx = Math.max(0, Math.round(Number((card as any)?.borderThicknessPx ?? 2) || 0));
                              const cardBorderRadiusPx = Math.max(0, Math.round(Number((card as any)?.borderRadiusPx ?? 49) || 0));
                              const cardEdgeGapPx = Math.max(0, Math.min(80, Math.round(Number((card as any)?.edgeGapPx ?? 20) || 0)));
                              const cardNoiseEnabled = !!(card && typeof card === "object" ? (card as any).noiseEnabled : false);
                              const cardNoiseMode = String((card as any)?.noiseMode || "neutral") === "tinted" ? "tinted" : "neutral";
                              const cardNoiseOpacityPct = Math.max(0, Math.min(40, Math.round(Number((card as any)?.noiseOpacityPct ?? 20) || 0)));
                              const cardNoiseIntensityPct = Math.max(0, Math.min(100, Math.round(Number((card as any)?.noiseIntensityPct ?? 12) || 0)));
                              const cardNoiseTileSizePx = Math.max(32, Math.min(1024, Math.round(Number((card as any)?.noiseTileSizePx ?? 256) || 0)));

                              const borderColor = (() => {
                                try {
                                  const st = (slides as any)?.[0]?.inputData?.slide1Style || null;
                                  const tid = String(st?.themeId || "").trim();
                                  const hex = String(st?.accentSolidHex || "").trim();
                                  return hex || SLIDE1_THEME_ACCENT_BY_ID[tid] || "#000000";
                                } catch {
                                  return "#000000";
                                }
                              })();

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

                                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-[11px] font-semibold text-slate-900 uppercase">Card</div>
                                      <button
                                        type="button"
                                        className={[
                                          "h-7 w-12 rounded-full transition-colors",
                                          cardEnabled ? "bg-black" : "bg-slate-300",
                                          (!currentProjectId || switchingSlides || copyGenerating) ? "opacity-60" : "",
                                        ].join(" ")}
                                        aria-label={cardEnabled ? "Disable card" : "Enable card"}
                                        title={cardEnabled ? "Card enabled" : "Card disabled"}
                                        onClick={() => {
                                          if (!currentProjectId || switchingSlides || copyGenerating) return;
                                          const base =
                                            card && typeof card === "object"
                                              ? { ...(card as any) }
                                              : {
                                                  enabled: false,
                                                  backgroundHex: "#ffffff",
                                                  patternId: "none",
                                                  borderEnabled: true,
                                                  borderThicknessPx: 2,
                                                  borderRadiusPx: 49,
                                                  edgeGapPx: 20,
                                                  noiseEnabled: false,
                                                  noiseMode: "neutral",
                                                  noiseOpacityPct: 20,
                                                  noiseIntensityPct: 12,
                                                  noiseTileSizePx: 256,
                                                };
                                          base.enabled = !cardEnabled;
                                          // Ensure defaults are present.
                                          base.backgroundHex = String(base.backgroundHex || "#ffffff");
                                          base.patternId = String(base.patternId || "none");
                                          base.borderEnabled = typeof base.borderEnabled === "boolean" ? base.borderEnabled : true;
                                          base.borderThicknessPx = Math.max(0, Math.round(Number(base.borderThicknessPx ?? 2) || 0));
                                          base.borderRadiusPx = Math.max(0, Math.round(Number(base.borderRadiusPx ?? 49) || 0));
                                          base.edgeGapPx = Math.max(0, Math.min(80, Math.round(Number(base.edgeGapPx ?? 20) || 0)));
                                          base.noiseEnabled = !!base.noiseEnabled;
                                          base.noiseMode = String(base.noiseMode || "neutral") === "tinted" ? "tinted" : "neutral";
                                          base.noiseOpacityPct = Math.max(0, Math.min(40, Math.round(Number(base.noiseOpacityPct ?? 20) || 0)));
                                          base.noiseIntensityPct = Math.max(0, Math.min(100, Math.round(Number(base.noiseIntensityPct ?? 12) || 0)));
                                          base.noiseTileSizePx = Math.max(32, Math.min(1024, Math.round(Number(base.noiseTileSizePx ?? 256) || 0)));
                                          actions.onSetSlide1Card?.(base as any);
                                        }}
                                      >
                                        <span
                                          className={[
                                            "block h-6 w-6 rounded-full bg-white shadow-sm translate-x-0 transition-transform",
                                            cardEnabled ? "translate-x-5" : "translate-x-1",
                                          ].join(" ")}
                                        />
                                      </button>
                                    </div>

                                    <div className="mt-3 space-y-3">
                                      <div>
                                        <div className="text-[11px] font-semibold text-slate-600 uppercase">Card color</div>
                                        <div className="mt-1 flex items-center gap-2">
                                          <input
                                            type="color"
                                            className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                                            value={cardHex}
                                            disabled={!cardEnabled || !currentProjectId || switchingSlides || copyGenerating}
                                            onChange={(e) => {
                                              const nextHex = String(e.target.value || "").trim() || "#ffffff";
                                              const base =
                                                card && typeof card === "object"
                                                  ? { ...(card as any) }
                                                  : {
                                                      enabled: true,
                                                      backgroundHex: "#ffffff",
                                                      patternId: "none",
                                                      borderEnabled: true,
                                                      borderThicknessPx: 2,
                                                      borderRadiusPx: 49,
                                                  edgeGapPx: 20,
                                                  noiseEnabled: false,
                                                  noiseMode: "neutral",
                                                  noiseOpacityPct: 20,
                                                  noiseIntensityPct: 12,
                                                  noiseTileSizePx: 256,
                                                    };
                                              base.enabled = true;
                                              base.backgroundHex = nextHex;
                                              actions.onSetSlide1Card?.(base as any);
                                            }}
                                            aria-label="Slide 1 card background color"
                                          />
                                          <div className="text-xs text-slate-600 tabular-nums">{cardHex}</div>
                                          <div className="ml-auto text-[10px] text-slate-500">Inset 40px</div>
                                        </div>
                                      </div>

                                      <div>
                                        <div className="text-[11px] font-semibold text-slate-900 uppercase">Card texture</div>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                          {([
                                            { id: "none", name: "None" },
                                            { id: "dots_n8n", name: "n8n dots" },
                                            { id: "paper_grain", name: "Paper grain" },
                                            { id: "subtle_noise", name: "Subtle noise" },
                                            { id: "grid", name: "Grid" },
                                            { id: "wrinkle_grain_black", name: "Wrinkled grain (black)" },
                                          ] as const).map((p) => {
                                            const selected = String(cardPatternId || "none") === p.id;
                                            const ariaDisabled = !cardEnabled || !currentProjectId || switchingSlides || copyGenerating;
                                            return (
                                              <button
                                                key={p.id}
                                                type="button"
                                                className={[
                                                  "h-10 rounded-xl border px-3 text-left text-xs font-semibold transition-colors",
                                                  selected ? "border-black ring-2 ring-black/10 bg-white" : "border-slate-200 hover:bg-white",
                                                  ariaDisabled ? "opacity-60" : "",
                                                ].join(" ")}
                                                style={{ color: "#000000" }}
                                                aria-disabled={ariaDisabled}
                                                onClick={() => {
                                                  if (ariaDisabled) return;
                                                  const base =
                                                    card && typeof card === "object"
                                                      ? { ...(card as any) }
                                                      : {
                                                          enabled: true,
                                                          backgroundHex: cardHex || "#ffffff",
                                                          patternId: "none",
                                                          borderEnabled: true,
                                                          borderThicknessPx: 2,
                                                          borderRadiusPx: 49,
                                                  edgeGapPx: 20,
                                                          noiseEnabled: false,
                                                          noiseMode: "neutral",
                                                          noiseOpacityPct: 20,
                                                          noiseIntensityPct: 12,
                                                          noiseTileSizePx: 256,
                                                        };
                                                  base.enabled = true;
                                                  base.patternId = p.id;
                                                  actions.onSetSlide1Card?.(base as any);
                                                }}
                                                title={p.name}
                                              >
                                                {p.name}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      <div>
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="text-[11px] font-semibold text-slate-900 uppercase">Borders</div>
                                          <button
                                            type="button"
                                            className={[
                                              "h-7 w-12 rounded-full transition-colors",
                                              cardBorderEnabled ? "bg-red-600" : "bg-slate-300",
                                              (!cardEnabled || !currentProjectId || switchingSlides || copyGenerating) ? "opacity-60" : "",
                                            ].join(" ")}
                                            aria-label={cardBorderEnabled ? "Disable borders" : "Enable borders"}
                                            title={cardBorderEnabled ? "Borders enabled" : "Borders disabled"}
                                            onClick={() => {
                                              if (!cardEnabled || !currentProjectId || switchingSlides || copyGenerating) return;
                                              const base =
                                                card && typeof card === "object"
                                                  ? { ...(card as any) }
                                                  : {
                                                      enabled: true,
                                                      backgroundHex: cardHex || "#ffffff",
                                                      patternId: cardPatternId || "none",
                                                      borderEnabled: true,
                                                      borderThicknessPx: 2,
                                                      borderRadiusPx: 49,
                                                  edgeGapPx: 20,
                                                      noiseEnabled: false,
                                                      noiseMode: "neutral",
                                                      noiseOpacityPct: 20,
                                                      noiseIntensityPct: 12,
                                                      noiseTileSizePx: 256,
                                                    };
                                              base.enabled = true;
                                              base.borderEnabled = !cardBorderEnabled;
                                              actions.onSetSlide1Card?.(base as any);
                                            }}
                                          >
                                            <span
                                              className={[
                                                "block h-6 w-6 rounded-full bg-white shadow-sm translate-x-0 transition-transform",
                                                cardBorderEnabled ? "translate-x-5" : "translate-x-1",
                                              ].join(" ")}
                                            />
                                          </button>
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                          {/* Thickness */}
                                          <div>
                                            <div className="text-[11px] font-semibold text-slate-600 uppercase">Thickness</div>
                                            <div className="mt-1 flex items-stretch gap-2">
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                                value={String(cardBorderThicknessPx)}
                                                disabled={!cardEnabled || !cardBorderEnabled || !currentProjectId || switchingSlides || copyGenerating}
                                                onChange={(e) => {
                                                  const raw = String(e.target.value || "").replace(/[^\d]/g, "");
                                                  const n = Math.max(0, Math.min(20, Number(raw) || 0));
                                                  const base =
                                                    card && typeof card === "object"
                                                      ? { ...(card as any) }
                                                      : {
                                                          enabled: true,
                                                          backgroundHex: cardHex || "#ffffff",
                                                          patternId: cardPatternId || "none",
                                                          borderEnabled: true,
                                                          borderThicknessPx: 2,
                                                          borderRadiusPx: 49,
                                                          edgeGapPx: 20,
                                                          noiseEnabled: false,
                                                          noiseMode: "neutral",
                                                          noiseOpacityPct: 20,
                                                          noiseIntensityPct: 12,
                                                          noiseTileSizePx: 256,
                                                        };
                                                  base.enabled = true;
                                                  base.borderThicknessPx = n;
                                                  actions.onSetSlide1Card?.(base as any);
                                                }}
                                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement | null)?.blur?.(); }}
                                                title="Border thickness in px. Min 0, max 20."
                                              />
                                              <div className="hidden md:flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                                {([
                                                  { dir: "up" as const, label: "Increase thickness", delta: +1, glyph: "▲" },
                                                  { dir: "down" as const, label: "Decrease thickness", delta: -1, glyph: "▼" },
                                                ] as const).map((btn) => {
                                                  const disabled = !cardEnabled || !cardBorderEnabled || !currentProjectId || switchingSlides || copyGenerating;
                                                  return (
                                                    <button
                                                      key={btn.dir}
                                                      type="button"
                                                      className={[
                                                        "w-10 flex-1 text-[10px] font-bold leading-none transition-colors select-none",
                                                        btn.dir === "up" ? "border-b border-slate-200" : "",
                                                        disabled ? "text-slate-300" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100",
                                                      ].join(" ")}
                                                      onMouseDown={(e) => e.preventDefault()}
                                                      onClick={() => {
                                                        if (disabled) return;
                                                        const next = Math.max(0, Math.min(20, cardBorderThicknessPx + btn.delta));
                                                        const base =
                                                          card && typeof card === "object"
                                                            ? { ...(card as any) }
                                                            : {
                                                                enabled: true,
                                                                backgroundHex: cardHex || "#ffffff",
                                                                patternId: cardPatternId || "none",
                                                                borderEnabled: true,
                                                                borderThicknessPx: 2,
                                                                borderRadiusPx: 49,
                                                                edgeGapPx: 20,
                                                                noiseEnabled: false,
                                                                noiseMode: "neutral",
                                                                noiseOpacityPct: 20,
                                                                noiseIntensityPct: 12,
                                                                noiseTileSizePx: 256,
                                                              };
                                                        base.enabled = true;
                                                        base.borderThicknessPx = next;
                                                        actions.onSetSlide1Card?.(base as any);
                                                      }}
                                                      aria-label={btn.label}
                                                      aria-disabled={disabled}
                                                      title={btn.label}
                                                    >
                                                      {btn.glyph}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          </div>
                                          {/* Radius */}
                                          <div>
                                            <div className="text-[11px] font-semibold text-slate-600 uppercase">Radius</div>
                                            <div className="mt-1 flex items-stretch gap-2">
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                                value={String(cardBorderRadiusPx)}
                                                disabled={!cardEnabled || !currentProjectId || switchingSlides || copyGenerating}
                                                onChange={(e) => {
                                                  const raw = String(e.target.value || "").replace(/[^\d]/g, "");
                                                  const n = Math.max(0, Math.min(200, Number(raw) || 0));
                                                  const base =
                                                    card && typeof card === "object"
                                                      ? { ...(card as any) }
                                                      : {
                                                          enabled: true,
                                                          backgroundHex: cardHex || "#ffffff",
                                                          patternId: cardPatternId || "none",
                                                          borderEnabled: true,
                                                          borderThicknessPx: 2,
                                                          borderRadiusPx: 49,
                                                          edgeGapPx: 20,
                                                          noiseEnabled: false,
                                                          noiseMode: "neutral",
                                                          noiseOpacityPct: 20,
                                                          noiseIntensityPct: 12,
                                                          noiseTileSizePx: 256,
                                                        };
                                                  base.enabled = true;
                                                  base.borderRadiusPx = n;
                                                  actions.onSetSlide1Card?.(base as any);
                                                }}
                                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement | null)?.blur?.(); }}
                                                title="Border radius in px. Min 0, max 200."
                                              />
                                              <div className="hidden md:flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                                {([
                                                  { dir: "up" as const, label: "Increase radius", delta: +1, glyph: "▲" },
                                                  { dir: "down" as const, label: "Decrease radius", delta: -1, glyph: "▼" },
                                                ] as const).map((btn) => {
                                                  const disabled = !cardEnabled || !currentProjectId || switchingSlides || copyGenerating;
                                                  return (
                                                    <button
                                                      key={btn.dir}
                                                      type="button"
                                                      className={[
                                                        "w-10 flex-1 text-[10px] font-bold leading-none transition-colors select-none",
                                                        btn.dir === "up" ? "border-b border-slate-200" : "",
                                                        disabled ? "text-slate-300" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100",
                                                      ].join(" ")}
                                                      onMouseDown={(e) => e.preventDefault()}
                                                      onClick={() => {
                                                        if (disabled) return;
                                                        const next = Math.max(0, Math.min(200, cardBorderRadiusPx + btn.delta));
                                                        const base =
                                                          card && typeof card === "object"
                                                            ? { ...(card as any) }
                                                            : {
                                                                enabled: true,
                                                                backgroundHex: cardHex || "#ffffff",
                                                                patternId: cardPatternId || "none",
                                                                borderEnabled: true,
                                                                borderThicknessPx: 2,
                                                                borderRadiusPx: 49,
                                                                edgeGapPx: 20,
                                                                noiseEnabled: false,
                                                                noiseMode: "neutral",
                                                                noiseOpacityPct: 20,
                                                                noiseIntensityPct: 12,
                                                                noiseTileSizePx: 256,
                                                              };
                                                        base.enabled = true;
                                                        base.borderRadiusPx = next;
                                                        actions.onSetSlide1Card?.(base as any);
                                                      }}
                                                      aria-label={btn.label}
                                                      aria-disabled={disabled}
                                                      title={btn.label}
                                                    >
                                                      {btn.glyph}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Card Edge gap */}
                                        <div className="mt-3">
                                          <div className="text-[11px] font-semibold text-slate-600 uppercase">Card Edge gap</div>
                                          <div className="mt-1 flex items-stretch gap-2">
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              pattern="[0-9]*"
                                              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                              value={String(cardEdgeGapPx)}
                                              disabled={!cardEnabled || !currentProjectId || switchingSlides || copyGenerating}
                                              onChange={(e) => {
                                                const raw = String(e.target.value || "").replace(/[^\d]/g, "");
                                                const n = Math.max(0, Math.min(80, Number(raw) || 0));
                                                const base =
                                                  card && typeof card === "object"
                                                    ? { ...(card as any) }
                                                    : {
                                                        enabled: true,
                                                        backgroundHex: cardHex || "#ffffff",
                                                        patternId: cardPatternId || "none",
                                                        borderEnabled: true,
                                                        borderThicknessPx: 2,
                                                        borderRadiusPx: 49,
                                                        edgeGapPx: 20,
                                                        noiseEnabled: false,
                                                        noiseMode: "neutral",
                                                        noiseOpacityPct: 20,
                                                        noiseIntensityPct: 12,
                                                        noiseTileSizePx: 256,
                                                      };
                                                base.enabled = true;
                                                base.edgeGapPx = n;
                                                actions.onSetSlide1Card?.(base as any);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key !== "Enter") return;
                                                (e.target as HTMLInputElement | null)?.blur?.();
                                              }}
                                              title="Card edge gap in px. Min 0, max 80."
                                            />

                                            <div className="hidden md:flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                              {([
                                                { dir: "up" as const, label: "Increase gap", delta: +1, glyph: "▲" },
                                                { dir: "down" as const, label: "Decrease gap", delta: -1, glyph: "▼" },
                                              ] as const).map((btn) => {
                                                const disabled = !cardEnabled || !currentProjectId || switchingSlides || copyGenerating;
                                                return (
                                                  <button
                                                    key={btn.dir}
                                                    type="button"
                                                    className={[
                                                      "w-10 flex-1 text-[10px] font-bold leading-none transition-colors select-none",
                                                      btn.dir === "up" ? "border-b border-slate-200" : "",
                                                      disabled ? "text-slate-300" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100",
                                                    ].join(" ")}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                      if (disabled) return;
                                                      const next = Math.max(0, Math.min(80, cardEdgeGapPx + btn.delta));
                                                      const base =
                                                        card && typeof card === "object"
                                                          ? { ...(card as any) }
                                                          : {
                                                              enabled: true,
                                                              backgroundHex: cardHex || "#ffffff",
                                                              patternId: cardPatternId || "none",
                                                              borderEnabled: true,
                                                              borderThicknessPx: 2,
                                                              borderRadiusPx: 49,
                                                              edgeGapPx: 20,
                                                              noiseEnabled: false,
                                                              noiseMode: "neutral",
                                                              noiseOpacityPct: 20,
                                                              noiseIntensityPct: 12,
                                                              noiseTileSizePx: 256,
                                                            };
                                                      base.enabled = true;
                                                      base.edgeGapPx = next;
                                                      actions.onSetSlide1Card?.(base as any);
                                                    }}
                                                    aria-label={btn.label}
                                                    aria-disabled={disabled}
                                                    title={btn.label}
                                                  >
                                                    {btn.glyph}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                          <div className="mt-1 text-[10px] text-slate-500">0 = full-bleed · 80 = max gap</div>
                                        </div>

                                        <div className="mt-2 text-[10px] text-slate-500">
                                          Border color: <span className="font-semibold">{borderColor}</span> (from Slide 1 accent)
                                        </div>

                                        {/* Noise (Card only) */}
                                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-[11px] font-semibold text-slate-900 uppercase">Noise</div>
                                            <button
                                              type="button"
                                              className={[
                                                "h-7 w-12 rounded-full transition-colors",
                                                cardNoiseEnabled ? "bg-black" : "bg-slate-300",
                                                (!cardEnabled || !currentProjectId || switchingSlides || copyGenerating) ? "opacity-60" : "",
                                              ].join(" ")}
                                              aria-label={cardNoiseEnabled ? "Disable noise" : "Enable noise"}
                                              title={cardNoiseEnabled ? "Noise enabled" : "Noise disabled"}
                                              onClick={() => {
                                                if (!cardEnabled || !currentProjectId || switchingSlides || copyGenerating) return;
                                                const base =
                                                  card && typeof card === "object"
                                                    ? { ...(card as any) }
                                                    : {
                                                        enabled: true,
                                                        backgroundHex: cardHex || "#ffffff",
                                                        patternId: cardPatternId || "none",
                                                        borderEnabled: true,
                                                        borderThicknessPx: 2,
                                                        borderRadiusPx: 49,
                                                        edgeGapPx: 20,
                                                        noiseEnabled: false,
                                                        noiseMode: "neutral",
                                                        noiseOpacityPct: 20,
                                                        noiseIntensityPct: 12,
                                                        noiseTileSizePx: 256,
                                                      };
                                                base.enabled = true;
                                                base.noiseEnabled = !cardNoiseEnabled;
                                                base.noiseMode = String(base.noiseMode || "neutral") === "tinted" ? "tinted" : "neutral";
                                                base.noiseOpacityPct = Math.max(0, Math.min(40, Math.round(Number(base.noiseOpacityPct ?? 20) || 0)));
                                                base.noiseIntensityPct = Math.max(0, Math.min(100, Math.round(Number(base.noiseIntensityPct ?? 12) || 0)));
                                                base.noiseTileSizePx = Math.max(32, Math.min(1024, Math.round(Number(base.noiseTileSizePx ?? 256) || 0)));
                                                actions.onSetSlide1Card?.(base as any);
                                              }}
                                            >
                                              <span
                                                className={[
                                                  "block h-6 w-6 rounded-full bg-white shadow-sm translate-x-0 transition-transform",
                                                  cardNoiseEnabled ? "translate-x-5" : "translate-x-1",
                                                ].join(" ")}
                                              />
                                            </button>
                                          </div>

                                          <div className="mt-3 space-y-3">
                                            <div>
                                              <div className="text-[11px] font-semibold text-slate-600 uppercase">Mode</div>
                                              <div className="mt-2 grid grid-cols-2 gap-2">
                                                {([
                                                  { id: "neutral" as const, name: "Neutral" },
                                                  { id: "tinted" as const, name: "Tinted" },
                                                ] as const).map((m) => {
                                                  const selected = cardNoiseMode === m.id;
                                                  const ariaDisabled = !cardEnabled || !cardNoiseEnabled || !currentProjectId || switchingSlides || copyGenerating;
                                                  return (
                                                    <button
                                                      key={m.id}
                                                      type="button"
                                                      className={[
                                                        "h-9 rounded-xl border px-3 text-left text-xs font-semibold transition-colors",
                                                        selected ? "border-black ring-2 ring-black/10 bg-white" : "border-slate-200 hover:bg-slate-50",
                                                        ariaDisabled ? "opacity-60" : "",
                                                      ].join(" ")}
                                                      style={{ color: "#000000" }}
                                                      aria-disabled={ariaDisabled}
                                                      onClick={() => {
                                                        if (ariaDisabled) return;
                                                        const base =
                                                          card && typeof card === "object"
                                                            ? { ...(card as any) }
                                                            : {
                                                                enabled: true,
                                                                backgroundHex: cardHex || "#ffffff",
                                                                patternId: cardPatternId || "none",
                                                                borderEnabled: true,
                                                                borderThicknessPx: 2,
                                                                borderRadiusPx: 49,
                                                                edgeGapPx: 20,
                                                                noiseEnabled: true,
                                                                noiseMode: "neutral",
                                                                noiseOpacityPct: 20,
                                                                noiseIntensityPct: 12,
                                                                noiseTileSizePx: 256,
                                                              };
                                                        base.enabled = true;
                                                        base.noiseEnabled = true;
                                                        base.noiseMode = m.id;
                                                        actions.onSetSlide1Card?.(base as any);
                                                      }}
                                                      title={m.name}
                                                    >
                                                      {m.name}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>

                                            <div>
                                              <div className="flex items-center justify-between gap-3">
                                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Opacity</div>
                                                <div className="text-[10px] font-semibold text-slate-700 tabular-nums">{cardNoiseOpacityPct}%</div>
                                              </div>
                                              <input
                                                type="range"
                                                min={0}
                                                max={40}
                                                step={1}
                                                className="mt-2 w-full"
                                                value={cardNoiseOpacityPct}
                                                disabled={!cardEnabled || !cardNoiseEnabled || !currentProjectId || switchingSlides || copyGenerating}
                                                onChange={(e) => {
                                                  const n = Math.max(0, Math.min(40, Math.round(Number(e.target.value) || 0)));
                                                  const base =
                                                    card && typeof card === "object"
                                                      ? { ...(card as any) }
                                                      : {
                                                          enabled: true,
                                                          backgroundHex: cardHex || "#ffffff",
                                                          patternId: cardPatternId || "none",
                                                          borderEnabled: true,
                                                          borderThicknessPx: 2,
                                                          borderRadiusPx: 49,
                                                          edgeGapPx: 20,
                                                          noiseEnabled: true,
                                                          noiseMode: "neutral",
                                                          noiseOpacityPct: 20,
                                                          noiseIntensityPct: 12,
                                                          noiseTileSizePx: 256,
                                                        };
                                                  base.enabled = true;
                                                  base.noiseEnabled = true;
                                                  base.noiseOpacityPct = n;
                                                  actions.onSetSlide1Card?.(base as any);
                                                }}
                                                aria-label="Noise opacity"
                                              />
                                              <div className="mt-1 text-[10px] text-slate-500">0–40%</div>
                                            </div>

                                            <div>
                                              <div className="flex items-center justify-between gap-3">
                                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Intensity</div>
                                                <div className="text-[10px] font-semibold text-slate-700 tabular-nums">{cardNoiseIntensityPct}</div>
                                              </div>
                                              <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                step={1}
                                                className="mt-2 w-full"
                                                value={cardNoiseIntensityPct}
                                                disabled={!cardEnabled || !cardNoiseEnabled || !currentProjectId || switchingSlides || copyGenerating}
                                                onChange={(e) => {
                                                  const n = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                                                  const base =
                                                    card && typeof card === "object"
                                                      ? { ...(card as any) }
                                                      : {
                                                          enabled: true,
                                                          backgroundHex: cardHex || "#ffffff",
                                                          patternId: cardPatternId || "none",
                                                          borderEnabled: true,
                                                          borderThicknessPx: 2,
                                                          borderRadiusPx: 49,
                                                          edgeGapPx: 20,
                                                          noiseEnabled: true,
                                                          noiseMode: "neutral",
                                                          noiseOpacityPct: 20,
                                                          noiseIntensityPct: 12,
                                                          noiseTileSizePx: 256,
                                                        };
                                                  base.enabled = true;
                                                  base.noiseEnabled = true;
                                                  base.noiseIntensityPct = n;
                                                  actions.onSetSlide1Card?.(base as any);
                                                }}
                                                aria-label="Noise intensity"
                                              />
                                              <div className="mt-1 text-[10px] text-slate-500">0–100</div>
                                            </div>

                                            <div>
                                              <div className="text-[11px] font-semibold text-slate-600 uppercase">Tile size</div>
                                              <div className="mt-1 flex items-stretch gap-2">
                                                <input
                                                  type="text"
                                                  inputMode="numeric"
                                                  pattern="[0-9]*"
                                                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                                  value={String(cardNoiseTileSizePx)}
                                                  disabled={!cardEnabled || !cardNoiseEnabled || !currentProjectId || switchingSlides || copyGenerating}
                                                  onChange={(e) => {
                                                    const raw = String(e.target.value || "").replace(/[^\d]/g, "");
                                                    const n = Math.max(32, Math.min(1024, Number(raw) || 0));
                                                    const base =
                                                      card && typeof card === "object"
                                                        ? { ...(card as any) }
                                                        : {
                                                            enabled: true,
                                                            backgroundHex: cardHex || "#ffffff",
                                                            patternId: cardPatternId || "none",
                                                            borderEnabled: true,
                                                            borderThicknessPx: 2,
                                                            borderRadiusPx: 49,
                                                            edgeGapPx: 20,
                                                            noiseEnabled: true,
                                                            noiseMode: "neutral",
                                                            noiseOpacityPct: 20,
                                                            noiseIntensityPct: 12,
                                                            noiseTileSizePx: 256,
                                                          };
                                                    base.enabled = true;
                                                    base.noiseEnabled = true;
                                                    base.noiseTileSizePx = n;
                                                    actions.onSetSlide1Card?.(base as any);
                                                  }}
                                                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement | null)?.blur?.(); }}
                                                  title="Noise tile size in px. Min 32, max 1024."
                                                />
                                                <div className="hidden md:flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                                  {([
                                                    { dir: "up" as const, label: "Increase tile size", delta: +1, glyph: "▲" },
                                                    { dir: "down" as const, label: "Decrease tile size", delta: -1, glyph: "▼" },
                                                  ] as const).map((btn) => {
                                                    const disabled = !cardEnabled || !cardNoiseEnabled || !currentProjectId || switchingSlides || copyGenerating;
                                                    return (
                                                      <button
                                                        key={btn.dir}
                                                        type="button"
                                                        className={[
                                                          "w-10 flex-1 text-[10px] font-bold leading-none transition-colors select-none",
                                                          btn.dir === "up" ? "border-b border-slate-200" : "",
                                                          disabled ? "text-slate-300" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100",
                                                        ].join(" ")}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => {
                                                          if (disabled) return;
                                                          const next = Math.max(32, Math.min(1024, cardNoiseTileSizePx + btn.delta));
                                                          const base =
                                                            card && typeof card === "object"
                                                              ? { ...(card as any) }
                                                              : {
                                                                  enabled: true,
                                                                  backgroundHex: cardHex || "#ffffff",
                                                                  patternId: cardPatternId || "none",
                                                                  borderEnabled: true,
                                                                  borderThicknessPx: 2,
                                                                  borderRadiusPx: 49,
                                                                  edgeGapPx: 20,
                                                                  noiseEnabled: true,
                                                                  noiseMode: "neutral",
                                                                  noiseOpacityPct: 20,
                                                                  noiseIntensityPct: 12,
                                                                  noiseTileSizePx: 256,
                                                                };
                                                          base.enabled = true;
                                                          base.noiseEnabled = true;
                                                          base.noiseTileSizePx = next;
                                                          actions.onSetSlide1Card?.(base as any);
                                                        }}
                                                        aria-label={btn.label}
                                                        aria-disabled={disabled}
                                                        title={btn.label}
                                                      >
                                                        {btn.glyph}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                              <div className="mt-1 text-[10px] text-slate-500">Bigger = smoother · smaller = finer</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
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
                                        const ariaDisabled = (!currentProjectId || switchingSlides || copyGenerating) || cardEnabled;
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            className={[
                                              "h-10 rounded-xl border px-3 text-left text-xs font-semibold transition-colors",
                                              selected ? "border-black ring-2 ring-black/10 bg-slate-50" : "border-slate-200 hover:bg-slate-50",
                                              ariaDisabled ? "opacity-60" : "",
                                            ].join(" ")}
                                            style={{ color: "#000000" }}
                                            aria-disabled={ariaDisabled}
                                            onClick={() => {
                                              if (ariaDisabled) return;
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
                                    {cardEnabled ? (
                                      <div className="mt-2 text-[10px] text-slate-500">Outer background stays solid while Card is on (texture applies to card).</div>
                                    ) : (
                                      <div className="mt-2 text-[10px] text-slate-500">Textures are neutral (black/white) so your color stays vivid.</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}

                        {slide1TextOpen ? (
                          <div
                            ref={slide1TextPopoverRef}
                            className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[360px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
                          >
                            <div className="text-xs font-semibold text-slate-900">Slide 1 only</div>
                            <div className="mt-3 flex items-center gap-2">
                              {(["body", "callout"] as const).map((t) => {
                                const active = slide1TextTarget === t;
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    className={[
                                      "h-8 px-3 rounded-full text-xs font-semibold border transition-colors",
                                      active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                                    ].join(" ")}
                                    onClick={() => {
                                      setSlide1GradientPickerOpen(false);
                                      setSlide1TextTarget(t);
                                      if (t === "callout") {
                                        const cur = (slides as any)?.[0]?.inputData?.slide1Callout?.text;
                                        setSlide1CalloutDraft(String(cur || ""));
                                      }
                                    }}
                                    disabled={!currentProjectId || switchingSlides || copyGenerating}
                                    aria-label={t === "body" ? "Edit Body" : "Edit Callout"}
                                  >
                                    {t === "body" ? "Body" : "Callout"}
                                  </button>
                                );
                              })}
                            </div>

                            {slide1TextTarget === "callout" ? (
                              (() => {
                                const callout = (slides as any)?.[0]?.inputData?.slide1Callout || null;
                                const bg = (slides as any)?.[0]?.inputData?.slide1Background || null;
                                const bgHex = String(bg?.backgroundHex || "").trim() || String(projectBackgroundColor || "#ffffff");
                                const curText = String(callout?.text || slide1CalloutDraft || "");
                                const hasText = curText.trim().length > 0;
                                const disabledControls = !hasText || !currentProjectId || switchingSlides || copyGenerating || enhancedLockOn;
                                const fontSizePx = Math.max(8, Math.min(999, Math.round(Number(callout?.fontSizePx ?? 28) || 28)));
                                const colorHex = String(callout?.colorHex || "").trim() || pickBWForBg(bgHex);

                                return (
                                  <div className="mt-3 space-y-3">
                                    <div>
                                      <div className="text-[11px] font-semibold text-slate-600 uppercase">Callout text</div>
                                      <textarea
                                        className="mt-1 w-full h-20 rounded-xl border border-slate-200 bg-white p-2 text-sm font-semibold text-slate-800"
                                        value={slide1CalloutDraft}
                                        disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                        onChange={(e) => {
                                          const v = String(e.target.value || "");
                                          setSlide1CalloutDraft(v);
                                          if (v.trim().length === 0) return;
                                          const next = callout && typeof callout === "object" ? { ...(callout as any) } : {};
                                          next.text = v;
                                          next.fontSizePx = Math.max(8, Math.min(999, Math.round(Number(next.fontSizePx ?? 28) || 28)));
                                          next.colorHex = String(next.colorHex || "").trim() || pickBWForBg(bgHex);
                                          actions.onSetSlide1Callout?.(next as any);
                                        }}
                                        onBlur={() => {
                                          const v = String(slide1CalloutDraft || "");
                                          const trimmed = v.trim();
                                          if (!trimmed.length) {
                                            if (callout) actions.onSetSlide1Callout?.(null as any);
                                            return;
                                          }
                                          const next = callout && typeof callout === "object" ? { ...(callout as any) } : {};
                                          next.text = v;
                                          next.fontSizePx = Math.max(8, Math.min(999, Math.round(Number(next.fontSizePx ?? 28) || 28)));
                                          next.colorHex = String(next.colorHex || "").trim() || pickBWForBg(bgHex);
                                          actions.onSetSlide1Callout?.(next as any);
                                        }}
                                        placeholder="Callout…"
                                      />
                                      <div className="mt-1 text-[10px] text-slate-500">Controls enable after you type.</div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <div className="text-[11px] font-semibold text-slate-600 uppercase">Size</div>
                                        <input
                                          type="number"
                                          className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                          value={fontSizePx}
                                          disabled={disabledControls}
                                          onChange={(e) => {
                                            const n = Math.max(8, Math.min(999, Math.round(Number(e.target.value) || 28)));
                                            const next = callout && typeof callout === "object" ? { ...(callout as any) } : { text: curText };
                                            next.text = curText;
                                            next.fontSizePx = n;
                                            next.colorHex = String(next.colorHex || "").trim() || colorHex;
                                            actions.onSetSlide1Callout?.(next as any);
                                          }}
                                          title="Callout font size. Min 8, max 999."
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-semibold text-slate-600 uppercase">Color</div>
                                        <div className="mt-1 flex items-center gap-2">
                                          <input
                                            type="color"
                                            className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                                            value={colorHex}
                                            disabled={disabledControls}
                                            onChange={(e) => {
                                              const nextHex = String(e.target.value || "").trim() || colorHex;
                                              const next = callout && typeof callout === "object" ? { ...(callout as any) } : { text: curText };
                                              next.text = curText;
                                              next.fontSizePx = fontSizePx;
                                              next.colorHex = nextHex;
                                              actions.onSetSlide1Callout?.(next as any);
                                            }}
                                            aria-label="Callout color"
                                          />
                                          <div className="text-xs text-slate-600 tabular-nums">{colorHex}</div>
                                        </div>
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-[11px] font-semibold text-slate-600 uppercase">Font</div>
                                      <select
                                        className="mt-1 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
                                        value={(() => {
                                          const localBody = String((slides as any)?.[0]?.inputData?.slide1BodyFontKey || "").trim();
                                          const global = String(bodyFontKey || "").trim();
                                          const local = String((callout as any)?.fontKey || "").trim();
                                          return local || localBody || global || "";
                                        })()}
                                        disabled={disabledControls}
                                        onChange={(e) => {
                                          const nextKey = String(e.target.value || "").trim();
                                          const localBody = String((slides as any)?.[0]?.inputData?.slide1BodyFontKey || "").trim();
                                          const global = String(bodyFontKey || "").trim();
                                          const effectiveDefault = localBody || global || "";
                                          const next = callout && typeof callout === "object" ? { ...(callout as any) } : { text: curText };
                                          next.text = curText;
                                          next.fontSizePx = fontSizePx;
                                          next.colorHex = colorHex;
                                          next.fontKey = nextKey && nextKey !== effectiveDefault ? nextKey : null;
                                          actions.onSetSlide1Callout?.(next as any);
                                        }}
                                        aria-label="Callout font"
                                      >
                                        <option value={String((slides as any)?.[0]?.inputData?.slide1BodyFontKey || "").trim() || String(bodyFontKey || "").trim() || ""}>
                                          Default (Body)
                                        </option>
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

                                    <div className={disabledControls ? "opacity-50 pointer-events-none" : ""}>
                                      <div className="text-[11px] font-semibold text-slate-900 uppercase">Text noise</div>
                                      {(() => {
                                        const noise = (callout as any)?.textNoise || null;
                                        const enabled = !!noise?.enabled;
                                        const mode = String(noise?.mode || "neutral") === "tinted" ? "tinted" : "neutral";
                                        const opacityPct = Math.max(0, Math.min(40, Math.round(Number(noise?.opacityPct ?? 20) || 0)));
                                        const intensityPct = Math.max(0, Math.min(100, Math.round(Number(noise?.intensityPct ?? 12) || 0)));
                                        const tileSizePx = Math.max(32, Math.min(1024, Math.round(Number(noise?.tileSizePx ?? 256) || 0)));
                                        const setNoise = (patch: any) => {
                                          const base = callout && typeof callout === "object" ? { ...(callout as any) } : { text: curText };
                                          base.text = curText;
                                          base.fontSizePx = fontSizePx;
                                          base.colorHex = colorHex;
                                          base.textNoise = patch;
                                          actions.onSetSlide1Callout?.(base as any);
                                        };
                                        return (
                                          <div className="mt-2 space-y-3">
                                            <button
                                              type="button"
                                              className={[
                                                "w-full h-9 rounded-lg border text-sm font-semibold shadow-sm transition-colors",
                                                enabled ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                                              ].join(" ")}
                                              onClick={() => {
                                                if (enabled) {
                                                  setNoise(null);
                                                  return;
                                                }
                                                setNoise({ enabled: true, mode: "neutral", opacityPct: 20, intensityPct: 12, tileSizePx: 256 });
                                              }}
                                              title={enabled ? "Text noise enabled" : "Text noise disabled"}
                                            >
                                              {enabled ? "Noise: On" : "Noise: Off"}
                                            </button>

                                            {enabled ? (
                                              <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                  <div className="text-[11px] font-semibold text-slate-600 uppercase">Mode</div>
                                                  <div className="mt-1 flex items-center gap-2">
                                                    {(["neutral", "tinted"] as const).map((m) => (
                                                      <button
                                                        key={m}
                                                        type="button"
                                                        className={[
                                                          "flex-1 h-9 rounded-lg border text-xs font-semibold transition-colors",
                                                          mode === m ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                                                        ].join(" ")}
                                                        onClick={() => setNoise({ enabled: true, mode: m, opacityPct, intensityPct, tileSizePx })}
                                                      >
                                                        {m === "neutral" ? "Neutral" : "Tinted"}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                                <div>
                                                  <div className="text-[11px] font-semibold text-slate-600 uppercase">Opacity</div>
                                                  <input
                                                    type="range"
                                                    min={0}
                                                    max={40}
                                                    step={1}
                                                    className="mt-2 w-full"
                                                    value={opacityPct}
                                                    onChange={(e) => {
                                                      const n = Math.max(0, Math.min(40, Math.round(Number(e.target.value) || 0)));
                                                      setNoise({ enabled: true, mode, opacityPct: n, intensityPct, tileSizePx });
                                                    }}
                                                    aria-label="Callout noise opacity"
                                                  />
                                                  <div className="mt-1 text-[10px] text-slate-500">0–40%</div>
                                                </div>
                                                <div>
                                                  <div className="text-[11px] font-semibold text-slate-600 uppercase">Intensity</div>
                                                  <input
                                                    type="range"
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    className="mt-2 w-full"
                                                    value={intensityPct}
                                                    onChange={(e) => {
                                                      const n = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                                                      setNoise({ enabled: true, mode, opacityPct, intensityPct: n, tileSizePx });
                                                    }}
                                                    aria-label="Callout noise intensity"
                                                  />
                                                  <div className="mt-1 text-[10px] text-slate-500">0–100</div>
                                                </div>
                                                <div>
                                                  <div className="text-[11px] font-semibold text-slate-600 uppercase">Tile size</div>
                                                  <input
                                                    type="number"
                                                    className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                                    value={tileSizePx}
                                                    min={32}
                                                    max={1024}
                                                    onChange={(e) => {
                                                      const n = Math.max(32, Math.min(1024, Math.round(Number(e.target.value) || 256)));
                                                      setNoise({ enabled: true, mode, opacityPct, intensityPct, tileSizePx: n });
                                                    }}
                                                    aria-label="Callout noise tile size"
                                                  />
                                                </div>
                                              </div>
                                            ) : null}
                                          </div>
                                        );
                                      })()}
                                    </div>

                                    <div className={disabledControls ? "opacity-50 pointer-events-none" : ""}>
                                      <div className="text-[11px] font-semibold text-slate-600 uppercase">Line gap</div>
                                      <input
                                        type="number"
                                        className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                        value={Math.max(-80, Math.min(80, Math.round(Number((callout as any)?.lineGapPx ?? 0) || 0)))}
                                        min={-80}
                                        max={80}
                                        step={1}
                                        onChange={(e) => {
                                          const n = Math.max(-80, Math.min(80, Math.round(Number(e.target.value) || 0)));
                                          const next = callout && typeof callout === "object" ? { ...(callout as any) } : { text: curText };
                                          next.text = curText;
                                          next.fontSizePx = fontSizePx;
                                          next.colorHex = colorHex;
                                          next.lineGapPx = n;
                                          actions.onSetSlide1Callout?.(next as any);
                                        }}
                                        aria-label="Callout line gap"
                                      />
                                      <div className="mt-1 text-[10px] text-slate-500">-80 to +80px</div>
                                    </div>
                                  </div>
                                );
                              })()
                            ) : null}

                            {slide1TextTarget === "body" ? (
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
                            ) : null}

                            {slide1TextTarget === "body" ? (
                              <>
                                {/* Line gap (Slide 1 BODY only) */}
                                {(() => {
                                  const raw = (slides as any)?.[0]?.inputData?.slide1BodyLineGapPx;
                                  const gapPx = Math.max(-80, Math.min(80, Math.round(Number(raw ?? 0) || 0)));
                                  const disabled = !currentProjectId || switchingSlides || copyGenerating || enhancedLockOn;
                                  return (
                                    <div className="mt-3">
                                      <div className="text-[11px] font-semibold text-slate-600 uppercase">Line gap</div>
                                      <div className="mt-1 flex items-stretch gap-2">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                          value={String(gapPx)}
                                          disabled={disabled}
                                          onChange={(e) => {
                                            const cleaned = String(e.target.value || "").trim().replace(/[^\d-]/g, "");
                                            // Keep only a single leading '-'
                                            const norm = cleaned.startsWith("-")
                                              ? "-" + cleaned.slice(1).replace(/-/g, "")
                                              : cleaned.replace(/-/g, "");
                                            const n = Math.max(-80, Math.min(80, Math.round(Number(norm) || 0)));
                                            actions.onSetSlide1BodyLineGapPx?.(n);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") (e.target as HTMLInputElement | null)?.blur?.();
                                          }}
                                          title="Extra px between lines (Slide 1 BODY only). Min 0, max 80."
                                        />
                                        <div className="hidden md:flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                          {([
                                            { dir: "up" as const, label: "Increase line gap", delta: +1, glyph: "▲" },
                                            { dir: "down" as const, label: "Decrease line gap", delta: -1, glyph: "▼" },
                                          ] as const).map((btn) => (
                                            <button
                                              key={btn.dir}
                                              type="button"
                                              className={[
                                                "w-10 flex-1 text-[10px] font-bold leading-none transition-colors select-none",
                                                btn.dir === "up" ? "border-b border-slate-200" : "",
                                                disabled ? "text-slate-300" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100",
                                              ].join(" ")}
                                              onMouseDown={(e) => e.preventDefault()}
                                              onClick={() => {
                                                if (disabled) return;
                                                const next = Math.max(-80, Math.min(80, gapPx + btn.delta));
                                                actions.onSetSlide1BodyLineGapPx?.(next);
                                              }}
                                              aria-label={btn.label}
                                              aria-disabled={disabled}
                                              title={btn.label}
                                            >
                                              {btn.glyph}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="mt-1 text-[10px] text-slate-500">-80 = tight · 0 = default · 80 = loose</div>
                                    </div>
                                  );
                                })()}
                              </>
                            ) : null}

                            {slide1TextTarget === "body" ? (
                              <>
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

                                {/* Text Noise (Slide 1 BODY only) */}
                                {(() => {
                                  const tn = (slides as any)?.[0]?.inputData?.slide1TextNoise || null;
                                  const enabled = !!(tn && typeof tn === "object" ? (tn as any).enabled : false);
                                  const mode = String((tn as any)?.mode || "neutral") === "tinted" ? "tinted" : "neutral";
                                  const opacityPct = Math.max(0, Math.min(40, Math.round(Number((tn as any)?.opacityPct ?? 20) || 0)));
                                  const intensityPct = Math.max(0, Math.min(100, Math.round(Number((tn as any)?.intensityPct ?? 12) || 0)));
                                  const tileSizePx = Math.max(32, Math.min(1024, Math.round(Number((tn as any)?.tileSizePx ?? 256) || 0)));
                                  const ariaDisabled = !currentProjectId || switchingSlides || copyGenerating || enhancedLockOn;
                                  const ariaDisabledInner = ariaDisabled || !enabled;

                                  return (
                                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-[11px] font-semibold text-slate-900 uppercase">Text noise</div>
                                        <button
                                          type="button"
                                          className={[
                                            "h-7 w-12 rounded-full transition-colors",
                                            enabled ? "bg-black" : "bg-slate-300",
                                            ariaDisabled ? "opacity-60" : "",
                                          ].join(" ")}
                                          aria-label={enabled ? "Disable text noise" : "Enable text noise"}
                                          title={enabled ? "Text noise enabled" : "Text noise disabled"}
                                          onClick={() => {
                                            if (ariaDisabled) return;
                                            const base =
                                              tn && typeof tn === "object"
                                                ? { ...(tn as any) }
                                                : {
                                                    enabled: false,
                                                    mode: "neutral",
                                                    opacityPct: 20,
                                                    intensityPct: 12,
                                                    tileSizePx: 256,
                                                  };
                                            base.enabled = !enabled;
                                            base.mode = String(base.mode || "neutral") === "tinted" ? "tinted" : "neutral";
                                            base.opacityPct = Math.max(0, Math.min(40, Math.round(Number(base.opacityPct ?? 20) || 0)));
                                            base.intensityPct = Math.max(0, Math.min(100, Math.round(Number(base.intensityPct ?? 12) || 0)));
                                            base.tileSizePx = Math.max(32, Math.min(1024, Math.round(Number(base.tileSizePx ?? 256) || 0)));
                                            actions.onSetSlide1TextNoise?.(base as any);
                                          }}
                                        >
                                          <span
                                            className={[
                                              "block h-6 w-6 rounded-full bg-white shadow-sm translate-x-0 transition-transform",
                                              enabled ? "translate-x-5" : "translate-x-1",
                                            ].join(" ")}
                                          />
                                        </button>
                                      </div>

                                  <div className="mt-3 space-y-3">
                                    <div>
                                      <div className="text-[11px] font-semibold text-slate-600 uppercase">Mode</div>
                                      <div className="mt-2 grid grid-cols-2 gap-2">
                                        {([
                                          { id: "neutral" as const, name: "Neutral" },
                                          { id: "tinted" as const, name: "Tinted" },
                                        ] as const).map((m) => {
                                          const selected = mode === m.id;
                                          const d = ariaDisabledInner;
                                          return (
                                            <button
                                              key={m.id}
                                              type="button"
                                              className={[
                                                "h-9 rounded-xl border px-3 text-left text-xs font-semibold transition-colors",
                                                selected ? "border-black ring-2 ring-black/10 bg-white" : "border-slate-200 hover:bg-slate-50",
                                                d ? "opacity-60" : "",
                                              ].join(" ")}
                                              style={{ color: "#000000" }}
                                              aria-disabled={d}
                                              onClick={() => {
                                                if (d) return;
                                                const base =
                                                  tn && typeof tn === "object"
                                                    ? { ...(tn as any) }
                                                    : {
                                                        enabled: true,
                                                        mode: "neutral",
                                                        opacityPct: 20,
                                                        intensityPct: 12,
                                                        tileSizePx: 256,
                                                      };
                                                base.enabled = true;
                                                base.mode = m.id;
                                                actions.onSetSlide1TextNoise?.(base as any);
                                              }}
                                              title={m.name}
                                            >
                                              {m.name}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-[11px] font-semibold text-slate-600 uppercase">Opacity</div>
                                        <div className="text-[10px] font-semibold text-slate-700 tabular-nums">{opacityPct}%</div>
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={40}
                                        step={1}
                                        className="mt-2 w-full"
                                        value={opacityPct}
                                        disabled={ariaDisabledInner}
                                        onChange={(e) => {
                                          const n = Math.max(0, Math.min(40, Math.round(Number(e.target.value) || 0)));
                                          const base =
                                            tn && typeof tn === "object"
                                              ? { ...(tn as any) }
                                              : { enabled: true, mode: "neutral", opacityPct: 20, intensityPct: 12, tileSizePx: 256 };
                                          base.enabled = true;
                                          base.opacityPct = n;
                                          actions.onSetSlide1TextNoise?.(base as any);
                                        }}
                                        aria-label="Text noise opacity"
                                      />
                                      <div className="mt-1 text-[10px] text-slate-500">0–40%</div>
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-[11px] font-semibold text-slate-600 uppercase">Intensity</div>
                                        <div className="text-[10px] font-semibold text-slate-700 tabular-nums">{intensityPct}</div>
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        className="mt-2 w-full"
                                        value={intensityPct}
                                        disabled={ariaDisabledInner}
                                        onChange={(e) => {
                                          const n = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                                          const base =
                                            tn && typeof tn === "object"
                                              ? { ...(tn as any) }
                                              : { enabled: true, mode: "neutral", opacityPct: 20, intensityPct: 12, tileSizePx: 256 };
                                          base.enabled = true;
                                          base.intensityPct = n;
                                          actions.onSetSlide1TextNoise?.(base as any);
                                        }}
                                        aria-label="Text noise intensity"
                                      />
                                      <div className="mt-1 text-[10px] text-slate-500">0–100</div>
                                    </div>

                                    <div>
                                      <div className="text-[11px] font-semibold text-slate-600 uppercase">Tile size</div>
                                      <div className="mt-1 flex items-stretch gap-2">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                          value={String(tileSizePx)}
                                          disabled={ariaDisabledInner}
                                          onChange={(e) => {
                                            const raw = String(e.target.value || "").replace(/[^\d]/g, "");
                                            const n = Math.max(32, Math.min(1024, Number(raw) || 0));
                                            const base =
                                              tn && typeof tn === "object"
                                                ? { ...(tn as any) }
                                                : { enabled: true, mode: "neutral", opacityPct: 20, intensityPct: 12, tileSizePx: 256 };
                                            base.enabled = true;
                                            base.tileSizePx = n;
                                            actions.onSetSlide1TextNoise?.(base as any);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") (e.target as HTMLInputElement | null)?.blur?.();
                                          }}
                                          title="Noise tile size in px. Min 32, max 1024."
                                        />
                                        <div className="hidden md:flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                          {([
                                            { dir: "up" as const, label: "Increase tile size", delta: +1, glyph: "▲" },
                                            { dir: "down" as const, label: "Decrease tile size", delta: -1, glyph: "▼" },
                                          ] as const).map((btn) => {
                                            const d = ariaDisabledInner;
                                            return (
                                              <button
                                                key={btn.dir}
                                                type="button"
                                                className={[
                                                  "w-10 flex-1 text-[10px] font-bold leading-none transition-colors select-none",
                                                  btn.dir === "up" ? "border-b border-slate-200" : "",
                                                  d ? "text-slate-300" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100",
                                                ].join(" ")}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                  if (d) return;
                                                  const next = Math.max(32, Math.min(1024, tileSizePx + btn.delta));
                                                  const base =
                                                    tn && typeof tn === "object"
                                                      ? { ...(tn as any) }
                                                      : { enabled: true, mode: "neutral", opacityPct: 20, intensityPct: 12, tileSizePx: 256 };
                                                  base.enabled = true;
                                                  base.tileSizePx = next;
                                                  actions.onSetSlide1TextNoise?.(base as any);
                                                }}
                                                aria-label={btn.label}
                                                aria-disabled={d}
                                                title={btn.label}
                                              >
                                                {btn.glyph}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div className="mt-1 text-[10px] text-slate-500">Bigger = smoother · smaller = finer</div>
                                    </div>
                                  </div>
                                </div>
                                  );
                                })()}
                              </>
                            ) : null}
                          </div>
                    ) : null}
                    {false && activeSlideIndex >= 1 ? (
                      <div className="relative">
                        <button
                          type="button"
                          className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                          onClick={() => {
                            setSlideTextOpen((v) => {
                              const next = !v;
                              if (next) {
                                const s = (slides as any)?.[activeSlideIndex] || null;
                                const callout = (s as any)?.inputData?.slideCallout || null;
                                const calloutText = String(callout?.text || "");
                                setSlideCalloutDraft(calloutText);
                                setSlideBodySizeDraft(String(Math.round(Number((s as any)?.draftBodyFontSizePx ?? 48)) || 48));
                              }
                              return next;
                            });
                          }}
                          disabled={!currentProjectId || copyGenerating || switchingSlides || enhancedLockOn}
                          title={!currentProjectId ? "Create or load a project first" : `Slide ${activeSlideIndex + 1} text (callout + body size/color)`}
                          aria-label={slideTextOpen ? "Close Slide text controls" : "Open Slide text controls"}
                        >
                          Slide {activeSlideIndex + 1} text
                        </button>

                        {slideTextOpen ? (
                          <div className="absolute right-0 top-[calc(100%+8px)] z-[75] w-[520px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold text-slate-900">Slide {activeSlideIndex + 1} text</div>
                                <div className="mt-1 text-[10px] text-slate-500">
                                  Regular-only. Callout is off by default (null) and appears only when you type.
                                </div>
                              </div>
                              <button
                                type="button"
                                className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
                                onClick={() => setSlideTextOpen(false)}
                                aria-label="Close"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <div className="col-span-2">
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Callout</div>
                                <textarea
                                  className="mt-1 w-full min-h-[76px] rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-800"
                                  value={slideCalloutDraft}
                                  disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                  onChange={(e) => {
                                    const v = String(e.target.value || "");
                                    setSlideCalloutDraft(v);
                                    const trimmed = v.trim();
                                    const s = (slides as any)?.[activeSlideIndex] || null;
                                    const prev = (s as any)?.inputData?.slideCallout || null;
                                    if (!trimmed) {
                                      actions.onSetSlideCallout?.({ slideIndex: activeSlideIndex, next: null } as any);
                                      return;
                                    }
                                    const next = prev && typeof prev === "object" ? { ...(prev as any) } : { text: trimmed };
                                    next.text = v;
                                    next.fontSizePx = Math.max(8, Math.min(999, Math.round(Number(next.fontSizePx ?? 28) || 28)));
                                    next.colorHex = String(next.colorHex || "").trim() || "#000000";
                                    next.lineGapPx = Math.max(-80, Math.min(80, Math.round(Number(next.lineGapPx ?? 0) || 0)));
                                    actions.onSetSlideCallout?.({ slideIndex: activeSlideIndex, next } as any);
                                  }}
                                  placeholder="(optional) Type callout…"
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Callout font size</div>
                                <input
                                  type="number"
                                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                  value={(() => {
                                    const s = (slides as any)?.[activeSlideIndex] || null;
                                    const c = (s as any)?.inputData?.slideCallout || null;
                                    return Math.max(8, Math.min(999, Math.round(Number(c?.fontSizePx ?? 28) || 28)));
                                  })()}
                                  min={8}
                                  max={999}
                                  step={1}
                                  disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn || !String(slideCalloutDraft || "").trim()}
                                  onChange={(e) => {
                                    const n = Math.max(8, Math.min(999, Math.round(Number(e.target.value) || 28)));
                                    const s = (slides as any)?.[activeSlideIndex] || null;
                                    const prev = (s as any)?.inputData?.slideCallout || null;
                                    const text = String(slideCalloutDraft || "");
                                    if (!text.trim()) return;
                                    const next = prev && typeof prev === "object" ? { ...(prev as any) } : { text };
                                    next.text = text;
                                    next.fontSizePx = n;
                                    next.colorHex = String(next.colorHex || "").trim() || "#000000";
                                    next.lineGapPx = Math.max(-80, Math.min(80, Math.round(Number(next.lineGapPx ?? 0) || 0)));
                                    actions.onSetSlideCallout?.({ slideIndex: activeSlideIndex, next } as any);
                                  }}
                                  title="Callout font size. Min 8, max 999."
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Callout color</div>
                                <div className="mt-1 flex items-center gap-2">
                                  <input
                                    type="color"
                                    className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                                    value={(() => {
                                      const s = (slides as any)?.[activeSlideIndex] || null;
                                      const c = (s as any)?.inputData?.slideCallout || null;
                                      return String(c?.colorHex || "").trim() || "#000000";
                                    })()}
                                    disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn || !String(slideCalloutDraft || "").trim()}
                                    onChange={(e) => {
                                      const nextHex = String(e.target.value || "").trim() || "#000000";
                                      const s = (slides as any)?.[activeSlideIndex] || null;
                                      const prev = (s as any)?.inputData?.slideCallout || null;
                                      const text = String(slideCalloutDraft || "");
                                      if (!text.trim()) return;
                                      const next = prev && typeof prev === "object" ? { ...(prev as any) } : { text };
                                      next.text = text;
                                      next.fontSizePx = Math.max(8, Math.min(999, Math.round(Number(next.fontSizePx ?? 28) || 28)));
                                      next.colorHex = nextHex;
                                      next.lineGapPx = Math.max(-80, Math.min(80, Math.round(Number(next.lineGapPx ?? 0) || 0)));
                                      actions.onSetSlideCallout?.({ slideIndex: activeSlideIndex, next } as any);
                                    }}
                                    aria-label="Callout color"
                                  />
                                  <div className="text-xs text-slate-600 tabular-nums">
                                    {(() => {
                                      const s = (slides as any)?.[activeSlideIndex] || null;
                                      const c = (s as any)?.inputData?.slideCallout || null;
                                      return String(c?.colorHex || "").trim() || "#000000";
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Body size</div>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                  value={slideBodySizeDraft}
                                  disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                  onFocus={() => {
                                    slideBodySizeEditingRef.current = true;
                                  }}
                                  onChange={(e) => {
                                    const raw = String(e.target.value || "");
                                    setSlideBodySizeDraft(raw.replace(/[^\d]/g, ""));
                                  }}
                                  onBlur={() => {
                                    slideBodySizeEditingRef.current = false;
                                    const raw = String(slideBodySizeDraft || "").trim();
                                    const n = Math.round(Number(raw));
                                    if (!Number.isFinite(n)) return;
                                    actions.onChangeBodyFontSize?.({ target: { value: n } } as any);
                                  }}
                                  title="Body font size (BODY only). Min 8, max 120."
                                />
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Body text color</div>
                                <div className="mt-1 flex items-center gap-2">
                                  <input
                                    type="color"
                                    className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                                    value={(() => {
                                      const s = (slides as any)?.[activeSlideIndex] || null;
                                      const hex = String((s as any)?.inputData?.bodyTextColorHex || "").trim();
                                      return hex || String((ui as any)?.projectTextColor || "#000000");
                                    })()}
                                    disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                    onChange={(e) => {
                                      const nextHex = String(e.target.value || "").trim() || "#000000";
                                      actions.onSetSlideBodyTextColorHex?.({ slideIndex: activeSlideIndex, colorHex: nextHex } as any);
                                    }}
                                    aria-label="Body text color"
                                  />
                                  <div className="text-xs text-slate-600 tabular-nums">
                                    {(() => {
                                      const s = (slides as any)?.[activeSlideIndex] || null;
                                      const hex = String((s as any)?.inputData?.bodyTextColorHex || "").trim();
                                      return hex || String((ui as any)?.projectTextColor || "#000000");
                                    })()}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="mt-2 w-full h-9 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                                  disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                  onClick={() => actions.onSetSlideBodyTextColorHex?.({ slideIndex: activeSlideIndex, colorHex: null } as any)}
                                  title="Reset to the project text color"
                                >
                                  Reset to default
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                      </div>
                    ) : null}
                    {templateTypeId === "regular" && activeSlideIndex >= 1 && activeSlideIndex <= 5 ? (
                      <div className="relative">
                        <button
                          type="button"
                          className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                          onClick={() => {
                            setSlideTextOpen((v) => {
                              const next = !v;
                              if (next) {
                                const s = (slides as any)?.[activeSlideIndex] || null;
                                const callout = (s as any)?.inputData?.slideCallout || null;
                                setSlideCalloutDraft(String(callout?.text || ""));
                                setSlideBodySizeDraft(String(Math.round(Number((s as any)?.draftBodyFontSizePx ?? 48)) || 48));
                              }
                              return next;
                            });
                          }}
                          disabled={!currentProjectId || copyGenerating || switchingSlides || enhancedLockOn}
                          title={`Slide ${activeSlideIndex + 1} text (callout + body size/color)`}
                          data-popover-trigger="slide-n-text"
                        >
                          Slide {activeSlideIndex + 1} text
                        </button>

                        {slideTextOpen ? (
                          <div
                            ref={slideNTextPopoverRef}
                            className="absolute right-0 top-[calc(100%+8px)] z-[75] w-[520px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold text-slate-900">Slide {activeSlideIndex + 1} text</div>
                                <div className="mt-1 text-[10px] text-slate-500">
                                  Regular-only. Callout is off by default (null) and appears only when you type.
                                </div>
                              </div>
                              <button
                                type="button"
                                className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
                                onClick={() => setSlideTextOpen(false)}
                                aria-label="Close"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <div className="col-span-2">
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Callout</div>
                                <textarea
                                  className="mt-1 w-full min-h-[76px] rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-800"
                                  value={slideCalloutDraft}
                                  disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                  onChange={(e) => {
                                    const v = String(e.target.value || "");
                                    setSlideCalloutDraft(v);
                                    const trimmed = v.trim();
                                    const s = (slides as any)?.[activeSlideIndex] || null;
                                    const prev = (s as any)?.inputData?.slideCallout || null;
                                    if (!trimmed) {
                                      actions.onSetSlideCallout?.({ slideIndex: activeSlideIndex, next: null } as any);
                                      return;
                                    }
                                    const next = prev && typeof prev === "object" ? { ...(prev as any) } : { text: trimmed };
                                    next.text = v;
                                    next.fontSizePx = Math.max(8, Math.min(999, Math.round(Number(next.fontSizePx ?? 28) || 28)));
                                    next.colorHex = String(next.colorHex || "").trim() || "#000000";
                                    next.lineGapPx = Math.max(-80, Math.min(80, Math.round(Number(next.lineGapPx ?? 0) || 0)));
                                    actions.onSetSlideCallout?.({ slideIndex: activeSlideIndex, next } as any);
                                  }}
                                  placeholder="(optional) Type callout…"
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Callout font size</div>
                                <input
                                  type="number"
                                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                  value={(() => {
                                    const s = (slides as any)?.[activeSlideIndex] || null;
                                    const c = (s as any)?.inputData?.slideCallout || null;
                                    return Math.max(8, Math.min(999, Math.round(Number(c?.fontSizePx ?? 28) || 28)));
                                  })()}
                                  min={8}
                                  max={999}
                                  step={1}
                                  disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn || !String(slideCalloutDraft || "").trim()}
                                  onChange={(e) => {
                                    const n = Math.max(8, Math.min(999, Math.round(Number(e.target.value) || 28)));
                                    const s = (slides as any)?.[activeSlideIndex] || null;
                                    const prev = (s as any)?.inputData?.slideCallout || null;
                                    const text = String(slideCalloutDraft || "");
                                    if (!text.trim()) return;
                                    const next = prev && typeof prev === "object" ? { ...(prev as any) } : { text };
                                    next.text = text;
                                    next.fontSizePx = n;
                                    next.colorHex = String(next.colorHex || "").trim() || "#000000";
                                    next.lineGapPx = Math.max(-80, Math.min(80, Math.round(Number(next.lineGapPx ?? 0) || 0)));
                                    actions.onSetSlideCallout?.({ slideIndex: activeSlideIndex, next } as any);
                                  }}
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Callout color</div>
                                <div className="mt-1 flex items-center gap-2">
                                  <input
                                    type="color"
                                    className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                                    value={(() => {
                                      const s = (slides as any)?.[activeSlideIndex] || null;
                                      const c = (s as any)?.inputData?.slideCallout || null;
                                      return String(c?.colorHex || "").trim() || "#000000";
                                    })()}
                                    disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn || !String(slideCalloutDraft || "").trim()}
                                    onChange={(e) => {
                                      const nextHex = String(e.target.value || "").trim() || "#000000";
                                      const s = (slides as any)?.[activeSlideIndex] || null;
                                      const prev = (s as any)?.inputData?.slideCallout || null;
                                      const text = String(slideCalloutDraft || "");
                                      if (!text.trim()) return;
                                      const next = prev && typeof prev === "object" ? { ...(prev as any) } : { text };
                                      next.text = text;
                                      next.fontSizePx = Math.max(8, Math.min(999, Math.round(Number(next.fontSizePx ?? 28) || 28)));
                                      next.colorHex = nextHex;
                                      next.lineGapPx = Math.max(-80, Math.min(80, Math.round(Number(next.lineGapPx ?? 0) || 0)));
                                      actions.onSetSlideCallout?.({ slideIndex: activeSlideIndex, next } as any);
                                    }}
                                    aria-label="Callout color"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Body size</div>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                                  value={slideBodySizeDraft}
                                  disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                  onFocus={() => {
                                    slideBodySizeEditingRef.current = true;
                                  }}
                                  onChange={(e) => {
                                    const raw = String(e.target.value || "");
                                    setSlideBodySizeDraft(raw.replace(/[^\d]/g, ""));
                                  }}
                                  onBlur={() => {
                                    slideBodySizeEditingRef.current = false;
                                    const raw = String(slideBodySizeDraft || "").trim();
                                    const n = Math.round(Number(raw));
                                    if (!Number.isFinite(n)) return;
                                    actions.onChangeBodyFontSize?.({ target: { value: n } } as any);
                                  }}
                                />
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold text-slate-600 uppercase">Body text color</div>
                                <div className="mt-1 flex items-center gap-2">
                                  <input
                                    type="color"
                                    className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                                    value={(() => {
                                      const s = (slides as any)?.[activeSlideIndex] || null;
                                      const hex = String((s as any)?.inputData?.bodyTextColorHex || "").trim();
                                      return hex || String((ui as any)?.projectTextColor || "#000000");
                                    })()}
                                    disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                    onChange={(e) => {
                                      const nextHex = String(e.target.value || "").trim() || "#000000";
                                      actions.onSetSlideBodyTextColorHex?.({ slideIndex: activeSlideIndex, colorHex: nextHex } as any);
                                    }}
                                    aria-label="Body text color"
                                  />
                                  <button
                                    type="button"
                                    className="h-10 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50 disabled:opacity-50"
                                    disabled={!currentProjectId || switchingSlides || copyGenerating || enhancedLockOn}
                                    onClick={() => actions.onSetSlideBodyTextColorHex?.({ slideIndex: activeSlideIndex, colorHex: null } as any)}
                                    title="Reset to the project text color"
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>
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
                  {(ui as any)?.selectedImageTarget ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                      {(() => {
                      const pid = currentProjectId;
                      const key = pid ? ui.aiKey(pid, activeSlideIndex) : "";
                      const busy = key ? ui.bgRemovalBusyKeys.has(key) : false;
                      const target = (ui as any)?.selectedImageTarget || null;
                      const layout = (layoutData as any)?.layout || null;
                      const selectedImg = (() => {
                        if (!layout) return null;
                        if (!target) return (layout as any)?.image || null;
                        if (String(target?.kind || "") === "sticker") {
                          const id = String((target as any)?.stickerId || "").trim();
                          const extras = Array.isArray((layout as any)?.extraImages) ? ((layout as any).extraImages as any[]) : [];
                          const hit = extras.find((x: any) => String(x?.id || "") === id) || null;
                          if (!hit && String((layout as any)?.image?.id || "") === id) return (layout as any)?.image || null;
                          return hit;
                        }
                        return (layout as any)?.image || null;
                      })();

                      const enabled = ((selectedImg as any)?.bgRemovalEnabled ?? true) as boolean;
                      const statusRaw = String((selectedImg as any)?.bgRemovalStatus || (enabled ? "idle" : "disabled"));
                      const statusLabel = busy ? (enabled ? "processing" : "saving") : statusRaw;

                      return (
                        <>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="text-xs text-slate-500">
                            BG removal: <span className="font-semibold text-slate-800">{statusLabel}</span>
                          </div>
                          {busy ? <div className="text-[11px] text-slate-500">Working…</div> : null}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Background removal</div>
                            <div className="text-xs text-slate-500">Improves text wrapping around subject.</div>
                          </div>
                          <button
                            type="button"
                            className={[
                              "h-8 w-14 rounded-full transition-colors",
                              ((selectedImg as any)?.bgRemovalEnabled ?? true) ? "bg-black" : "bg-slate-300",
                            ].join(" ")}
                            onClick={() => {
                              const cur = ((selectedImg as any)?.bgRemovalEnabled ?? true) as boolean;
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
                                ((selectedImg as any)?.bgRemovalEnabled ?? true) ? "translate-x-6" : "translate-x-1",
                              ].join(" ")}
                            />
                          </button>
                        </div>
                        {String((selectedImg as any)?.bgRemovalStatus || "") === "failed" ? (
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
                        </>
                      );
                      })()}
                    </div>
                  ) : null}
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

              {/* Mobile-only: Script Chat prompt copy (moved from overlay) */}
              {isMobile && isSuperadmin ? (
                <div className="pt-1">
                  <div className="flex items-center justify-end gap-2 mb-1">
                    {scriptPromptCopyStatus === "copied" ? (
                      <span className="text-xs text-emerald-700 font-medium">Copied!</span>
                    ) : scriptPromptCopyStatus === "error" ? (
                      <span className="text-xs text-red-600 font-medium">Copy failed</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                    onClick={() => void onCopyScriptPrompt(String(currentProjectId || ""))}
                    disabled={
                      !currentProjectId ||
                      switchingSlides ||
                      copyGenerating ||
                      scriptPromptCopyStatus === "loading" ||
                      scriptPromptPrefetchStatus === "loading"
                    }
                    title={!currentProjectId ? "Create or load a project first" : "Copy the full Script prompt preview"}
                  >
                    {scriptPromptPrefetchStatus === "loading"
                      ? "Preparing prompt…"
                      : scriptPromptCopyStatus === "loading"
                        ? "Copying…"
                        : "Copy Script Prompt"}
                  </button>
                  {scriptPromptPrefetchStatus === "error" && scriptPromptPrefetchError ? (
                    <div className="mt-2 text-[11px] text-red-600">{scriptPromptPrefetchError}</div>
                  ) : null}
                </div>
              ) : null}
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

