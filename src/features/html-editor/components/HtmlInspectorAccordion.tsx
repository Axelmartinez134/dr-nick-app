"use client";

import type { ReactNode } from "react";
import type { HtmlEditableElement, HtmlElementPatch } from "../models/htmlElementModel";
import type { AddElementKind } from "../hooks/useHtmlElementSerializer";

const COLOR_PALETTE = [
  "#000000", "#FFFFFF", "#374151", "#6B7280", "#9CA3AF",
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF",
  "#EC4899", "#F43F5E",
];

const FONT_SIZE_PRESETS = [12, 16, 20, 24, 32, 40, 48, 64, 80, 96];

const FONT_WEIGHT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "inherit", label: "-" },
  { value: "300", label: "L" },
  { value: "400", label: "N" },
  { value: "500", label: "M" },
  { value: "600", label: "SB" },
  { value: "700", label: "B" },
];

const FONT_FAMILY_OPTIONS = [
  "inherit",
  "Inter",
  "DM Sans",
  "Space Grotesk",
  "Manrope",
  "IBM Plex Sans",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
];

function getElementTypeLabel(element: HtmlEditableElement) {
  if (element.type === "block") return "Design";
  if (element.type === "image-slot") return "Image area";
  if (element.type === "image") return "Image";
  return "Text";
}

function getElementIconColors(element: HtmlEditableElement): { bg: string; text: string } {
  if (element.type === "image-slot" || element.type === "image") {
    return { bg: "bg-blue-100", text: "text-blue-600" };
  }
  if (element.type === "block") {
    return { bg: "bg-orange-100", text: "text-orange-600" };
  }
  return { bg: "bg-green-100", text: "text-green-600" };
}

function getElementIcon(element: HtmlEditableElement) {
  if (element.type === "image-slot" || element.type === "image") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    );
  }
  if (element.type === "block") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}

function Field(props: {
  label: string;
  children: ReactNode;
  changed?: boolean;
  onReset?: (() => void) | null;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <div
          className={[
            "text-[10px] font-medium",
            props.changed ? "text-amber-700" : "text-muted-foreground",
          ].join(" ")}
        >
          {props.label}
        </div>
        {props.onReset ? (
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-50"
            onClick={props.onReset}
          >
            Reset
          </button>
        ) : null}
      </div>
      {props.children}
    </div>
  );
}

function parsePxValue(value: string): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const num = parseFloat(raw);
  return Number.isFinite(num) ? num : null;
}

function StepperInput(props: {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  dynamicStep?: boolean;
}) {
  const unit = props.unit ?? "px";
  const min = props.min ?? 0;
  const max = props.max ?? 999;

  const getStep = (current: number) => {
    if (!props.dynamicStep) return props.step ?? 1;
    if (current > 40) return 4;
    if (current > 20) return 2;
    return 1;
  };

  const handleDecrement = () => {
    const current = parsePxValue(props.value) ?? 16;
    const step = getStep(current);
    const next = Math.max(min, current - step);
    props.onChange(unit ? `${next}${unit}` : `${next}`);
  };

  const handleIncrement = () => {
    const current = parsePxValue(props.value) ?? 16;
    const step = getStep(current);
    const next = Math.min(max, current + step);
    props.onChange(unit ? `${next}${unit}` : `${next}`);
  };

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
        onClick={handleDecrement}
      >
        −
      </button>
      <input
        type="number"
        className="h-7 w-14 rounded-md border border-slate-200 bg-white text-center text-xs text-slate-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={parsePxValue(props.value) ?? ""}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (!v) { props.onChange(""); return; }
          const num = parseFloat(v);
          if (Number.isFinite(num)) props.onChange(unit ? `${num}${unit}` : `${num}`);
        }}
      />
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
        onClick={handleIncrement}
      >
        +
      </button>
    </div>
  );
}

function LineHeightStepper(props: { value: string; onChange: (v: string) => void }) {
  const handleDecrement = () => {
    const raw = props.value ? parseFloat(props.value) : 1.4;
    const next = Math.max(0.5, Math.round((raw - 0.1) * 10) / 10);
    props.onChange(`${next}`);
  };
  const handleIncrement = () => {
    const raw = props.value ? parseFloat(props.value) : 1.4;
    const next = Math.min(5, Math.round((raw + 0.1) * 10) / 10);
    props.onChange(`${next}`);
  };
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50" onClick={handleDecrement}>−</button>
      <input
        type="number"
        step={0.1}
        min={0.5}
        max={5}
        className="h-7 w-14 rounded-md border border-slate-200 bg-white text-center text-xs text-slate-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={parsePxValue(props.value) ?? ""}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (!v) { props.onChange(""); return; }
          const num = parseFloat(v);
          if (Number.isFinite(num)) props.onChange(`${num}`);
        }}
      />
      <button type="button" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50" onClick={handleIncrement}>+</button>
    </div>
  );
}

function ColorInput(props: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative shrink-0">
        <input
          type="color"
          value={props.value || "#000000"}
          onChange={(e) => props.onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-slate-200 p-0 transition-colors hover:border-slate-400"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {COLOR_PALETTE.slice(0, 10).map((c) => (
          <button
            key={c}
            type="button"
            className={[
              "h-5 w-5 rounded-full border-2 transition-all",
              (props.value || "").toUpperCase() === c
                ? "border-slate-900 ring-2 ring-slate-900/20 ring-offset-1"
                : "border-slate-200 hover:border-slate-400",
            ].join(" ")}
            style={{ backgroundColor: c }}
            onClick={() => props.onChange(c)}
          />
        ))}
      </div>
    </div>
  );
}

function TextValueInput(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

function stripHtml(value: string) {
  if (typeof window === "undefined") {
    return String(value || "").replace(/<[^>]*>/g, "");
  }
  const doc = new DOMParser().parseFromString(`<div>${String(value || "")}</div>`, "text/html");
  return String(doc.body.textContent || "");
}

function normalizeComparableValue(value: string) {
  return String(value || "").trim() || "inherit";
}

function ToggleChip(props: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      className={[
        "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors",
        props.active
          ? "bg-violet-600 text-white border-violet-600"
          : "border-slate-200 text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

function TextControls(props: {
  element: HtmlEditableElement & { type: "text" };
  onPatch: (patch: HtmlElementPatch) => void;
  onClearFormatting: (elementId: string, plainText: string) => void;
  onApplyFontToAllPages: (fontFamily: string) => void;
  totalPages: number;
}) {
  const el = props.element;
  const currentFontFamily = normalizeComparableValue(el.fontFamily);
  const currentTextAlign = normalizeComparableValue(el.textAlign);
  const currentTextTransform = normalizeComparableValue(el.textTransform);
  const currentFontStyle = normalizeComparableValue(el.fontStyle);
  const currentTextDecoration = normalizeComparableValue(el.textDecoration);
  const richPreviewText = stripHtml(el.html);
  const fontOptions = FONT_FAMILY_OPTIONS.includes(currentFontFamily)
    ? FONT_FAMILY_OPTIONS
    : [currentFontFamily, ...FONT_FAMILY_OPTIONS];
  return (
    <div className="space-y-3">
      {el.richHtml ? (
        <div className="space-y-2">
          <div
            className="min-h-[80px] rounded-md border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-900"
            dangerouslySetInnerHTML={{ __html: el.html }}
          />
          <p className="text-[11px] text-slate-500">
            Styled text is previewed here. Use inline editing on canvas for rich formatting changes.
          </p>
          <button
            type="button"
            className="h-7 rounded-md px-2 text-xs text-slate-600 hover:bg-slate-100"
            onClick={() => props.onClearFormatting(el.id, richPreviewText)}
          >
            Clear formatting
          </button>
        </div>
      ) : (
        <Field label="Text">
          <textarea
            className="min-h-[48px] w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
            value={el.text}
            onChange={(e) => {
              props.onPatch({ text: e.target.value });
            }}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Font Family"
          changed={el.fontFamily !== el.originalFontFamily}
          onReset={
            el.fontFamily !== el.originalFontFamily
              ? () => props.onPatch({ fontFamily: el.originalFontFamily })
              : null
          }
        >
          <select
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
            value={currentFontFamily}
            onChange={(e) => props.onPatch({ fontFamily: e.target.value })}
          >
            {fontOptions.map((option) => (
              <option key={option} value={option}>
                {option === "inherit" ? "Inherit" : option}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Font Size"
          changed={el.fontSize !== el.originalFontSize}
          onReset={
            el.fontSize !== el.originalFontSize
              ? () => props.onPatch({ fontSize: el.originalFontSize })
              : null
          }
        >
          <StepperInput value={el.fontSize} onChange={(v) => props.onPatch({ fontSize: v })} dynamicStep />
        </Field>
      </div>

      <div className="flex flex-wrap gap-1">
        {FONT_SIZE_PRESETS.map((size) => {
          const current = parsePxValue(el.fontSize);
          const active = current === size;
          return (
            <button
              key={size}
              type="button"
              className={[
                "rounded px-1.5 py-0.5 text-[10px] font-medium border transition-colors",
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "border-slate-200 text-slate-500 hover:border-slate-300",
              ].join(" ")}
              onClick={() => props.onPatch({ fontSize: `${size}px` })}
            >
              {size}
            </button>
          );
        })}
      </div>

      <Field label="Font Weight">
        <div className="flex gap-0.5">
          {FONT_WEIGHT_OPTIONS.map((opt) => {
            const current = String(el.fontWeight || "").trim();
            const active = current === opt.value || (!current && opt.value === "inherit");
            return (
              <button
                key={opt.value}
                type="button"
                className={[
                  "h-7 flex-1 rounded-md border text-[11px] font-semibold transition-colors",
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50",
                ].join(" ")}
                onClick={() => props.onPatch({ fontWeight: opt.value })}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="flex flex-wrap gap-1">
        <ToggleChip
          active={currentFontStyle === "italic"}
          title="Italic"
          onClick={() => props.onPatch({ fontStyle: currentFontStyle === "italic" ? "inherit" : "italic" })}
        >
          <span className="italic">I</span>
        </ToggleChip>
        <ToggleChip
          active={currentTextDecoration.includes("underline")}
          title="Underline"
          onClick={() =>
            props.onPatch({
              textDecoration: currentTextDecoration.includes("underline") ? "inherit" : "underline",
            })
          }
        >
          <span className="underline">U</span>
        </ToggleChip>
        <ToggleChip
          active={currentTextTransform === "lowercase"}
          title="Lowercase"
          onClick={() => props.onPatch({ textTransform: currentTextTransform === "lowercase" ? "inherit" : "lowercase" })}
        >
          aa
        </ToggleChip>
        <ToggleChip
          active={currentTextTransform === "capitalize"}
          title="Capitalize"
          onClick={() => props.onPatch({ textTransform: currentTextTransform === "capitalize" ? "inherit" : "capitalize" })}
        >
          Aa
        </ToggleChip>
        <ToggleChip
          active={currentTextTransform === "uppercase"}
          title="Uppercase"
          onClick={() => props.onPatch({ textTransform: currentTextTransform === "uppercase" ? "inherit" : "uppercase" })}
        >
          AA
        </ToggleChip>
        <ToggleChip
          active={currentTextAlign === "left"}
          title="Align left"
          onClick={() => props.onPatch({ textAlign: "left" })}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
          </svg>
        </ToggleChip>
        <ToggleChip
          active={currentTextAlign === "center"}
          title="Align center"
          onClick={() => props.onPatch({ textAlign: "center" })}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M4 18h16" />
          </svg>
        </ToggleChip>
        <ToggleChip
          active={currentTextAlign === "right"}
          title="Align right"
          onClick={() => props.onPatch({ textAlign: "right" })}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M10 12h10M4 18h16" />
          </svg>
        </ToggleChip>
      </div>

      <Field
        label="Text Color"
        changed={el.color !== el.originalColor}
        onReset={
          el.color !== el.originalColor
            ? () => props.onPatch({ color: el.originalColor })
            : null
        }
      >
        <ColorInput value={el.color} onChange={(v) => props.onPatch({ color: v })} />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Letter Spacing"
          changed={el.letterSpacing !== el.originalLetterSpacing}
          onReset={
            el.letterSpacing !== el.originalLetterSpacing
              ? () => props.onPatch({ letterSpacing: el.originalLetterSpacing })
              : null
          }
        >
          <StepperInput value={el.letterSpacing} onChange={(v) => props.onPatch({ letterSpacing: v })} step={0.5} />
        </Field>
        <Field
          label="Line Height"
          changed={el.lineHeight !== el.originalLineHeight}
          onReset={
            el.lineHeight !== el.originalLineHeight
              ? () => props.onPatch({ lineHeight: el.originalLineHeight })
              : null
          }
        >
          <LineHeightStepper value={el.lineHeight} onChange={(v) => props.onPatch({ lineHeight: v })} />
        </Field>
      </div>

      <Field
        label="Background"
        changed={el.backgroundColor !== el.originalBackgroundColor}
        onReset={
          el.backgroundColor !== el.originalBackgroundColor
            ? () => props.onPatch({ backgroundColor: el.originalBackgroundColor })
            : null
        }
      >
        <ColorInput value={el.backgroundColor} onChange={(v) => props.onPatch({ backgroundColor: v })} />
      </Field>

      <Field label="Border Radius">
        <StepperInput value={el.borderRadius} onChange={(v) => props.onPatch({ borderRadius: v })} />
      </Field>

      <details className="border-t border-slate-100 pt-2">
        <summary className="flex cursor-pointer items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 hover:text-slate-900">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          More options
        </summary>
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <Field label="Hex Color">
            <input
              type="text"
              className="h-8 w-28 rounded-md border border-slate-200 bg-white px-2 text-xs font-mono text-slate-900"
              value={el.color}
              onChange={(e) => props.onPatch({ color: e.target.value })}
              placeholder="#000000"
            />
          </Field>

          <div className="grid grid-cols-11 gap-1">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={[
                  "h-5 w-5 rounded-md border-2 transition-all hover:scale-110",
                  (el.color || "").toUpperCase() === c
                    ? "border-violet-600 ring-2 ring-violet-600/20 ring-offset-1"
                    : "border-transparent hover:border-slate-300",
                ].join(" ")}
                style={{ backgroundColor: c }}
                onClick={() => props.onPatch({ color: c })}
              />
            ))}
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-slate-500">Margin</div>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Top"
                changed={el.marginTop !== el.originalMarginTop}
                onReset={el.marginTop !== el.originalMarginTop ? () => props.onPatch({ marginTop: el.originalMarginTop }) : null}
              >
                <TextValueInput value={el.marginTop} onChange={(v) => props.onPatch({ marginTop: v })} placeholder="inherit" />
              </Field>
              <Field
                label="Right"
                changed={el.marginRight !== el.originalMarginRight}
                onReset={el.marginRight !== el.originalMarginRight ? () => props.onPatch({ marginRight: el.originalMarginRight }) : null}
              >
                <TextValueInput value={el.marginRight} onChange={(v) => props.onPatch({ marginRight: v })} placeholder="inherit" />
              </Field>
              <Field
                label="Bottom"
                changed={el.marginBottom !== el.originalMarginBottom}
                onReset={el.marginBottom !== el.originalMarginBottom ? () => props.onPatch({ marginBottom: el.originalMarginBottom }) : null}
              >
                <TextValueInput value={el.marginBottom} onChange={(v) => props.onPatch({ marginBottom: v })} placeholder="inherit" />
              </Field>
              <Field
                label="Left"
                changed={el.marginLeft !== el.originalMarginLeft}
                onReset={el.marginLeft !== el.originalMarginLeft ? () => props.onPatch({ marginLeft: el.originalMarginLeft }) : null}
              >
                <TextValueInput value={el.marginLeft} onChange={(v) => props.onPatch({ marginLeft: v })} placeholder="inherit" />
              </Field>
            </div>
          </div>

          {currentFontFamily !== "inherit" && props.totalPages > 1 ? (
            <button
              type="button"
              className="flex h-6 w-full items-center justify-center gap-1.5 rounded-md px-2 text-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => props.onApplyFontToAllPages(currentFontFamily)}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 12h8M8 17h8M4 7h.01M4 12h.01M4 17h.01" />
              </svg>
              Apply font to all pages
            </button>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function ImageSlotControls(props: {
  element: HtmlEditableElement & { type: "image-slot" };
  onPatch: (patch: HtmlElementPatch) => void;
}) {
  const el = props.element;
  const isLogo = el.slotType === "logo";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={[
          "rounded px-1.5 py-0.5 text-[10px] font-semibold border",
          isLogo
            ? "bg-purple-50 text-purple-600 border-purple-300"
            : "bg-slate-100 text-slate-500 border-slate-200",
        ].join(" ")}>
          {el.slotType || "main"}
        </span>
        {el.searchQuery ? (
          <span className="truncate text-[10px] text-slate-400">{el.searchQuery}</span>
        ) : null}
      </div>

      <Field label="Background Image">
        <input
          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
          value={el.backgroundImage}
          onChange={(e) => props.onPatch({ backgroundImage: e.target.value })}
        />
      </Field>

      <Field
        label="Background Color"
        changed={el.backgroundColor !== el.originalBackgroundColor}
        onReset={
          el.backgroundColor !== el.originalBackgroundColor
            ? () => props.onPatch({ backgroundColor: el.originalBackgroundColor })
            : null
        }
      >
        <ColorInput value={el.backgroundColor} onChange={(v) => props.onPatch({ backgroundColor: v })} />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Background Size">
          <input
            className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
            value={el.backgroundSize}
            onChange={(e) => props.onPatch({ backgroundSize: e.target.value })}
            placeholder="cover"
          />
        </Field>
        <Field label="Background Position">
          <input
            className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
            value={el.backgroundPosition}
            onChange={(e) => props.onPatch({ backgroundPosition: e.target.value })}
            placeholder="center"
          />
        </Field>
      </div>

      <Field label="Border Radius">
        <StepperInput value={el.borderRadius} onChange={(v) => props.onPatch({ borderRadius: v })} />
      </Field>
    </div>
  );
}

function ImageControls(props: {
  element: HtmlEditableElement & { type: "image" };
  onPatch: (patch: HtmlElementPatch) => void;
}) {
  const el = props.element;
  const isImgTag = el.tagName === "img";
  return (
    <div className="space-y-3">
      <Field label="Image URL">
        <input
          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
          value={el.src}
          onChange={(e) => props.onPatch({ src: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        {isImgTag ? (
          <Field label="Object Fit">
            <input
              className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
              value={el.objectFit}
              onChange={(e) => props.onPatch({ objectFit: e.target.value })}
            />
          </Field>
        ) : null}
        <Field label="Border Radius">
          <StepperInput value={el.borderRadius} onChange={(v) => props.onPatch({ borderRadius: v })} />
        </Field>
      </div>

      <Field
        label="Background Color"
        changed={el.backgroundColor !== el.originalBackgroundColor}
        onReset={
          el.backgroundColor !== el.originalBackgroundColor
            ? () => props.onPatch({ backgroundColor: el.originalBackgroundColor })
            : null
        }
      >
        <ColorInput value={el.backgroundColor} onChange={(v) => props.onPatch({ backgroundColor: v })} />
      </Field>

      {!isImgTag ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Background Size">
            <input
              className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
              value={el.backgroundSize}
              onChange={(e) => props.onPatch({ backgroundSize: e.target.value })}
              placeholder="cover"
            />
          </Field>
          <Field label="Background Position">
            <input
              className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
              value={el.backgroundPosition}
              onChange={(e) => props.onPatch({ backgroundPosition: e.target.value })}
              placeholder="center"
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function BlockControls(props: {
  element: HtmlEditableElement & { type: "block" };
  onPatch: (patch: HtmlElementPatch) => void;
}) {
  const el = props.element;
  return (
    <div className="space-y-3">
      <Field
        label="Background"
        changed={el.backgroundColor !== el.originalBackgroundColor}
        onReset={
          el.backgroundColor !== el.originalBackgroundColor
            ? () => props.onPatch({ backgroundColor: el.originalBackgroundColor })
            : null
        }
      >
        <ColorInput value={el.backgroundColor} onChange={(v) => props.onPatch({ backgroundColor: v })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Border Radius">
          <StepperInput value={el.borderRadius} onChange={(v) => props.onPatch({ borderRadius: v })} />
        </Field>
        <Field label="Opacity">
          <input
            className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
            value={el.opacity}
            onChange={(e) => props.onPatch({ opacity: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Border">
        <input
          className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
          value={el.border}
          onChange={(e) => props.onPatch({ border: e.target.value })}
        />
      </Field>
    </div>
  );
}

function TransformControls(props: {
  element: HtmlEditableElement;
  onPatch: (patch: HtmlElementPatch) => void;
}) {
  const el = props.element;
  if (!el.transformable) return null;
  return (
    <div className="border-t border-slate-100 pt-2">
      <div className="text-[10px] font-medium text-muted-foreground mb-1">Transform</div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="X">
          <TextValueInput value={el.translateX} onChange={(v) => props.onPatch({ translateX: v })} placeholder="0px" />
        </Field>
        <Field label="Y">
          <TextValueInput value={el.translateY} onChange={(v) => props.onPatch({ translateY: v })} placeholder="0px" />
        </Field>
        <Field label="Rotate">
          <StepperInput value={el.rotate} onChange={(v) => props.onPatch({ rotate: v })} unit="deg" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Field label="Width">
          <TextValueInput value={el.width} onChange={(v) => props.onPatch({ width: v })} placeholder="auto" />
        </Field>
        <Field label="Height">
          <TextValueInput value={el.height} onChange={(v) => props.onPatch({ height: v })} placeholder="auto" />
        </Field>
      </div>
    </div>
  );
}

const ADD_OPTIONS: Array<{ kind: AddElementKind; label: string }> = [
  { kind: "text", label: "Text" },
  { kind: "image-slot", label: "Image" },
  { kind: "logo-slot", label: "Logo" },
];

export function HtmlInspectorAccordion(props: {
  elements: HtmlEditableElement[];
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  onDeselectElement: () => void;
  onPatchSelectedElement: (patch: HtmlElementPatch) => void;
  onAddElement: (kind: AddElementKind) => void;
  onDuplicateElement: (elementId: string) => void;
  onDeleteElement: (elementId: string) => void;
  onClearRichText: (elementId: string, plainText: string) => void;
  onApplyFontToAllPages: (fontFamily: string) => void;
  totalPages: number;
}) {
  const visibleElements = props.elements.filter((el) => el.listable);
  const selectedId = props.selectedElementId;

  return (
    <div className="space-y-1.5">
      {visibleElements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
          No editable elements found for this slide.
        </div>
      ) : null}

      {visibleElements.map((element) => {
        const expanded = element.id === selectedId;
        const iconColors = getElementIconColors(element);
        const hasBlockBg = element.type === "block" && element.backgroundColor;

        return (
          <div
            key={element.id}
            className={[
              "rounded-lg border transition-all",
              expanded ? "border-slate-400/50 shadow-sm bg-white" : "border-slate-200 bg-white hover:bg-slate-50/50",
            ].join(" ")}
          >
            <button
              type="button"
              className={[
                "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all",
                expanded ? "bg-slate-50/30" : "",
              ].join(" ")}
              onClick={() => expanded ? props.onDeselectElement() : props.onSelectElement(element.id)}
            >
              {hasBlockBg ? (
                <div
                  className="h-8 w-8 shrink-0 rounded-md border border-slate-300"
                  style={{ backgroundColor: element.backgroundColor }}
                />
              ) : (
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconColors.bg} ${iconColors.text}`}>
                  {getElementIcon(element)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-800">{element.label}</div>
                <div className="text-[10px] text-slate-400">{getElementTypeLabel(element)}</div>
              </div>
              <svg
                className={["h-4 w-4 text-slate-400 transition-transform", expanded ? "rotate-180" : ""].join(" ")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expanded ? (
              <div className="border-t border-slate-100/50 px-3 pb-3 pt-3 space-y-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    onClick={() => props.onDuplicateElement(element.id)}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-[11px] text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                    onClick={() => props.onDeleteElement(element.id)}
                  >
                    Delete
                  </button>
                </div>

                {element.type === "text" ? (
                  <TextControls
                    element={element}
                    onPatch={props.onPatchSelectedElement}
                    onClearFormatting={props.onClearRichText}
                    onApplyFontToAllPages={props.onApplyFontToAllPages}
                    totalPages={props.totalPages}
                  />
                ) : element.type === "image-slot" ? (
                  <ImageSlotControls element={element} onPatch={props.onPatchSelectedElement} />
                ) : element.type === "image" ? (
                  <ImageControls element={element} onPatch={props.onPatchSelectedElement} />
                ) : element.type === "block" ? (
                  <BlockControls element={element} onPatch={props.onPatchSelectedElement} />
                ) : null}

                <TransformControls element={element} onPatch={props.onPatchSelectedElement} />

                <div className="rounded-md bg-slate-50 px-2.5 py-2 text-[11px] text-slate-400 italic text-center">
                  For finer adjustments, try asking AI
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5">
        <div className="text-[10px] font-medium text-muted-foreground mb-1.5">Add element</div>
        <div className="flex gap-1.5">
          {ADD_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              className="h-7 flex-1 rounded-md border border-dashed border-slate-200 text-[11px] font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => props.onAddElement(option.kind)}
            >
              + {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
