"use client";

import { useCallback, useId, useMemo, useState } from "react";
import type { HtmlDesignPreset } from "../lib/presets";
import { HTML_SLIDE_DIMENSIONS, wrapHtmlDocument, type HtmlAspectRatio } from "../lib/htmlDocumentWrapper";

function displayName(preset: HtmlDesignPreset) {
  return preset.localizedName?.en || preset.name;
}

function displayDescription(preset: HtmlDesignPreset) {
  return preset.localizedDescription?.en || preset.description;
}

/**
 * Static preset HTML preview in a sandboxed iframe (no scripts).
 * Sandbox: no allow-scripts. External stylesheets (e.g. Google Fonts) typically still load; adjust if a preset fails to render.
 */
function PresetHtmlIframePreview(props: {
  html: string;
  aspectRatio: HtmlAspectRatio;
  slideKey: number;
}) {
  const srcDoc = useMemo(
    () =>
      wrapHtmlDocument({
        html: props.html,
        aspectRatio: props.aspectRatio,
        interactive: false,
      }),
    [props.html, props.aspectRatio]
  );

  const { width, height } = HTML_SLIDE_DIMENSIONS[props.aspectRatio];
  const maxW = 520;
  const maxH = 420;
  const scale = Math.min(1, maxW / width, maxH / height);

  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-xl bg-slate-200/80 p-4"
      style={{ minHeight: maxH + 32 }}
    >
      <iframe
        key={props.slideKey}
        title="Template slide preview"
        className="rounded-lg border border-slate-300/80 bg-white shadow-sm"
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
        sandbox=""
        srcDoc={srcDoc}
      />
    </div>
  );
}

type DetailTab = "examples" | "design";

export function HtmlTemplateDetailView(props: {
  preset: HtmlDesignPreset;
  locale?: string;
  onBack: () => void;
}) {
  const locale = props.locale || "en";
  const baseId = useId();
  const tabExamplesId = `${baseId}-tab-examples`;
  const tabDesignId = `${baseId}-tab-design`;
  const panelExamplesId = `${baseId}-panel-examples`;
  const panelDesignId = `${baseId}-panel-design`;

  const [tab, setTab] = useState<DetailTab>("examples");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [designIndex, setDesignIndex] = useState(0);

  const exampleUrls = props.preset.exampleImages[locale] ?? props.preset.exampleImages.en ?? [];
  const dims = HTML_SLIDE_DIMENSIONS[props.preset.aspectRatio];
  const aspectRatioCss = `${dims.width} / ${dims.height}`;

  const designTemplates = props.preset.templates || [];
  const activeDesign = designTemplates[designIndex];

  const goExample = useCallback(
    (delta: number) => {
      if (!exampleUrls.length) return;
      setExampleIndex((i) => (i + delta + exampleUrls.length) % exampleUrls.length);
    },
    [exampleUrls.length]
  );

  const goDesign = useCallback(
    (delta: number) => {
      if (!designTemplates.length) return;
      setDesignIndex((i) => (i + delta + designTemplates.length) % designTemplates.length);
    },
    [designTemplates.length]
  );

  const sg = props.preset.styleGuide;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-100 px-4 py-3 md:px-5">
        <button
          type="button"
          className="mb-3 text-sm font-semibold text-slate-600 hover:text-slate-900"
          onClick={props.onBack}
        >
          ← Back to grid
        </button>
        <h3 className="text-lg font-semibold text-slate-900">{displayName(props.preset)}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{displayDescription(props.preset)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
            {props.preset.aspectRatio}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
            {designTemplates.length} page{designTemplates.length === 1 ? "" : "s"}
          </span>
          {props.preset.category ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
              {props.preset.category}
            </span>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-b border-slate-100 px-4 py-3 md:px-5">
        <div role="tablist" aria-label="Template preview" className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            id={tabExamplesId}
            type="button"
            role="tab"
            aria-selected={tab === "examples"}
            aria-controls={panelExamplesId}
            className={[
              "rounded-md px-4 py-2 text-xs font-semibold transition-colors",
              tab === "examples" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
            onClick={() => setTab("examples")}
          >
            Example results
          </button>
          <button
            id={tabDesignId}
            type="button"
            role="tab"
            aria-selected={tab === "design"}
            aria-controls={panelDesignId}
            className={[
              "rounded-md px-4 py-2 text-xs font-semibold transition-colors",
              tab === "design" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
            onClick={() => setTab("design")}
          >
            Design structure
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
        <div id={panelExamplesId} role="tabpanel" aria-labelledby={tabExamplesId} hidden={tab !== "examples"}>
          {exampleUrls.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-600">
              No preview images for this template yet.
            </div>
          ) : (
            <div className="mx-auto max-w-lg">
              <div
                className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-slate-200/90 p-3 shadow-inner"
                style={{ aspectRatio: aspectRatioCss }}
              >
                <img
                  src={exampleUrls[exampleIndex]}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => goExample(-1)}
                  aria-label="Previous example"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">
                  {exampleIndex + 1} / {exampleUrls.length}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => goExample(1)}
                  aria-label="Next example"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          id={panelDesignId}
          role="tabpanel"
          aria-labelledby={tabDesignId}
          hidden={tab !== "design"}
          className="space-y-6"
        >
          {activeDesign ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800">
                  Slide {designIndex + 1}
                  <span className="ml-2 font-normal text-slate-500">
                    · {activeDesign.pageType || "content"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={() => goDesign(-1)}
                  >
                    Prev slide
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={() => goDesign(1)}
                  >
                    Next slide
                  </button>
                </div>
              </div>
              <PresetHtmlIframePreview
                html={activeDesign.html}
                aspectRatio={props.preset.aspectRatio}
                slideKey={designIndex}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
              No template slides in this preset.
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Style guide</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: "Primary", color: sg.primaryColor },
                { label: "Secondary", color: sg.secondaryColor },
                { label: "Accent", color: sg.accentColor },
                { label: "Background", color: sg.backgroundColor },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
                  <span className="h-5 w-5 rounded border border-slate-200" style={{ backgroundColor: color }} />
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="font-mono text-slate-500">{color}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Fonts: </span>
              {sg.fontFamily}
              {sg.headingFontFamily !== sg.fontFamily || sg.bodyFontFamily !== sg.fontFamily ? (
                <>
                  {" "}
                  · heading: {sg.headingFontFamily} · body: {sg.bodyFontFamily}
                </>
              ) : null}
            </div>
            {sg.designPatterns?.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {sg.designPatterns.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-slate-50/90 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            disabled
            title="Coming soon"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-400 shadow-sm"
          >
            Edit design
          </button>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="rounded-lg border border-slate-300 bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 shadow-sm"
          >
            Use this template
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-500 sm:text-right">These actions will be enabled in a later release.</p>
      </div>
    </div>
  );
}
