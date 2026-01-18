import type { ReactNode } from "react";
import { RichTextInput } from "@/app/editor/RichTextInput";
import { DebugCard } from "./DebugCard";

export type EditorBottomPanelProps = {
  // Core state
  templateTypeId: "regular" | "enhanced";
  activeSlideIndex: number;
  slideCount: number;
  currentProjectId: string | null;
  loading: boolean;
  switchingSlides: boolean;
  copyGenerating: boolean;
  enhancedLockOn: boolean;

  // Data
  slides: any[];
  layoutData: any;
  inputData: any;
  layoutHistoryLength: number;
  showLayoutOverlays: boolean;

  // Debug/log
  addLog: (msg: string) => void;

  // Headline UI (Enhanced)
  onChangeHeadlineFontSize: (e: any) => void;
  onClickHeadlineAlign: (align: "left" | "center" | "right") => void;
  onChangeHeadlineRichText: (next: any) => void;

  // Body UI
  onChangeBodyFontSize: (e: any) => void;
  onClickBodyAlign: (align: "left" | "center" | "right") => void;
  onChangeBodyRichText: (next: any) => void;

  // AI image prompt card (Enhanced)
  aiImagePromptSaveStatus: "idle" | "saving" | "saved" | "error";
  imagePromptGenerating: boolean;
  imagePromptError: string | null;
  onClickRegenerateImagePrompt: () => void;
  onChangeAiImagePrompt: (next: string) => void;
  onClickGenerateAiImage: () => void;
  aiImageGeneratingThis: boolean;
  aiImageProgressThis: number;
  aiImageStatusThis: string | null;
  aiImageErrorThis: string | null;

  // Controls card
  copyProgressIcon?: ReactNode;
  onClickGenerateCopy: () => void;
  copyError: string | null;
  saveError: string | null;
  error: string | null;
  onClickRetry: () => void;

  // Image controls (Enhanced)
  activeImageSelected: boolean;
  imageBusy: boolean;
  aiKey: (projectId: string, slideIndex: number) => string;
  bgRemovalBusyKeys: Set<string>;
  setActiveSlideImageBgRemoval: (nextEnabled: boolean) => void;
  deleteImageForActiveSlide: (source: "menu" | "button") => void;

  // Layout controls
  realigning: boolean;
  onClickRealignText: () => void;
  onClickUndo: () => void;
  onClickToggleOverlays: () => void;

  // Caption
  captionDraft: string;
  captionCopyStatus: "idle" | "copied" | "error";
  onClickCopyCaption: () => void;
  onChangeCaption: (next: string) => void;

  // Debug card
  debugScreenshot: string | null;
  showDebugPreview: boolean;
  setShowDebugPreview: (next: boolean) => void;
  debugLogs: string[];
};

export function EditorBottomPanel(props: EditorBottomPanelProps) {
  const {
    templateTypeId,
    activeSlideIndex,
    slideCount,
    currentProjectId,
    loading,
    switchingSlides,
    copyGenerating,
    enhancedLockOn,
    slides,
    layoutData,
    inputData,
    layoutHistoryLength,
    showLayoutOverlays,
    addLog,
  } = props;

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
                      onChange={props.onChangeHeadlineFontSize}
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
                            onClick={() => props.onClickHeadlineAlign(a)}
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
                    onChange={props.onChangeHeadlineRichText}
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
                      onChange={props.onChangeBodyFontSize}
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
                            onClick={() => props.onClickBodyAlign(a)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="relative">
                <RichTextInput
                  key={`rte-body:${currentProjectId || "none"}:${activeSlideIndex}`}
                  valueText={slides[activeSlideIndex]?.draftBody || ""}
                  valueRanges={slides[activeSlideIndex]?.draftBodyRanges || []}
                  onDebugLog={addLog}
                  debugId={`body proj=${currentProjectId || "none"} slide=${activeSlideIndex + 1}`}
                  onChange={props.onChangeBodyRichText}
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
                    {props.aiImagePromptSaveStatus === "saving" && (
                      <span className="text-xs text-slate-500">Saving...</span>
                    )}
                    {props.aiImagePromptSaveStatus === "saved" && (
                      <span className="text-xs text-emerald-600">Saved ✓</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
                    onClick={props.onClickRegenerateImagePrompt}
                    disabled={props.imagePromptGenerating || !currentProjectId || copyGenerating || switchingSlides}
                    title="Regenerate AI image prompt for this slide"
                  >
                    {props.imagePromptGenerating ? "Generating..." : "Regenerate"}
                  </button>
                </div>
                <textarea
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 text-sm shadow-sm"
                  rows={4}
                  value={slides[activeSlideIndex]?.draftAiImagePrompt || ""}
                  onChange={(e) => props.onChangeAiImagePrompt(e.target.value)}
                  disabled={loading || switchingSlides || copyGenerating || props.imagePromptGenerating}
                  placeholder="AI-generated image prompt will appear here after Generate Copy..."
                />
                {props.imagePromptError && (
                  <div className="mt-2 text-xs text-red-600">{props.imagePromptError}</div>
                )}

                {/* Generate Image Button with Progress Bar */}
                <div className="mt-4">
                  <button
                    className="w-full h-12 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50 relative overflow-hidden transition-shadow"
                    disabled={
                      !currentProjectId ||
                      props.aiImageGeneratingThis ||
                      copyGenerating ||
                      switchingSlides ||
                      props.imagePromptGenerating ||
                      !(slides[activeSlideIndex]?.draftAiImagePrompt || "").trim()
                    }
                    onClick={props.onClickGenerateAiImage}
                  >
                    {props.aiImageGeneratingThis ? (
                      <>
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-purple-700 to-blue-700 transition-all duration-200"
                          style={{ width: `${props.aiImageProgressThis || 0}%` }}
                        />
                        <span className="relative z-10 flex flex-col items-center justify-center leading-tight">
                          <span className="text-xs opacity-90">{props.aiImageStatusThis || "Working..."}</span>
                          <span className="text-sm font-bold">
                            {Math.round(props.aiImageProgressThis || 0)}%
                          </span>
                        </span>
                      </>
                    ) : (
                      "🎨 Generate Image"
                    )}
                  </button>
                  {props.aiImageErrorThis && (
                    <div className="mt-2 text-xs text-red-600">{props.aiImageErrorThis}</div>
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
              {props.copyProgressIcon}
            </div>
            <div className="space-y-3">
              <button
                className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-md hover:shadow-lg transition-shadow disabled:opacity-50"
                disabled={!currentProjectId || copyGenerating || switchingSlides}
                onClick={props.onClickGenerateCopy}
              >
                {copyGenerating ? "Generating Copy..." : "Generate Copy"}
              </button>

              {props.activeImageSelected ? (
                <>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    {(() => {
                      const pid = currentProjectId;
                      const key = pid ? props.aiKey(pid, activeSlideIndex) : "";
                      const busy = key ? props.bgRemovalBusyKeys.has(key) : false;
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
                          props.setActiveSlideImageBgRemoval(!cur);
                        }}
                        disabled={
                          props.imageBusy ||
                          switchingSlides ||
                          copyGenerating ||
                          !currentProjectId ||
                          (currentProjectId ? props.bgRemovalBusyKeys.has(props.aiKey(currentProjectId, activeSlideIndex)) : false)
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
                        onClick={() => props.setActiveSlideImageBgRemoval(true)}
                        disabled={
                          props.imageBusy ||
                          switchingSlides ||
                          copyGenerating ||
                          !currentProjectId ||
                          (currentProjectId ? props.bgRemovalBusyKeys.has(props.aiKey(currentProjectId, activeSlideIndex)) : false)
                        }
                        title="Try background removal again"
                      >
                        {currentProjectId && props.bgRemovalBusyKeys.has(props.aiKey(currentProjectId, activeSlideIndex))
                          ? "Processing…"
                          : "Try again"}
                      </button>
                    ) : null}
                  </div>
                  <button
                    className="w-full h-10 rounded-lg border border-red-200 bg-white text-red-700 text-sm font-semibold shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                    onClick={() => props.deleteImageForActiveSlide("button")}
                    disabled={props.imageBusy || switchingSlides || copyGenerating || !currentProjectId}
                    title="Delete the selected image from this slide"
                  >
                    {props.imageBusy ? "Working…" : "Delete Image"}
                  </button>
                </>
              ) : null}

              {props.copyError ? <div className="text-xs text-red-600">❌ {props.copyError}</div> : null}
              {templateTypeId !== "regular" ? (
                <>
                  <button
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                    onClick={props.onClickRealignText}
                    disabled={loading || props.realigning || !layoutData || switchingSlides || copyGenerating}
                  >
                    {props.realigning ? "Realigning..." : "Realign Text"}
                  </button>
                </>
              ) : null}

              <button
                className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                onClick={props.onClickUndo}
                disabled={layoutHistoryLength === 0 || props.realigning || switchingSlides || copyGenerating}
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
                onClick={props.onClickToggleOverlays}
              >
                {showLayoutOverlays ? "Hide Layout Overlays" : "Show Layout Overlays"}
              </button>

              {props.saveError && <div className="text-xs text-red-600">❌ {props.saveError}</div>}
              {props.error && <div className="text-xs text-red-600">❌ {props.error}</div>}

              {props.error && inputData && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="text-sm font-semibold text-red-800">Generation Failed</div>
                  <div className="text-xs text-red-700 mt-1">{props.error}</div>
                  <button
                    className="mt-2 w-full h-9 rounded-lg bg-red-600 text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                    onClick={props.onClickRetry}
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
              {props.captionCopyStatus === "copied" ? (
                <span className="text-xs text-emerald-700 font-medium">Copied!</span>
              ) : props.captionCopyStatus === "error" ? (
                <span className="text-xs text-red-600 font-medium">Copy failed</span>
              ) : null}
              <button
                type="button"
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                onClick={props.onClickCopyCaption}
                disabled={copyGenerating}
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
            value={props.captionDraft}
            onChange={(e) => props.onChangeCaption(e.target.value)}
            disabled={copyGenerating}
          />
        </div>

        <DebugCard
          debugScreenshot={props.debugScreenshot || null}
          showDebugPreview={props.showDebugPreview}
          setShowDebugPreview={props.setShowDebugPreview}
          debugLogs={Array.isArray(props.debugLogs) ? props.debugLogs : []}
        />
      </div>
    </section>
  );
}

