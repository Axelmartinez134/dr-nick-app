"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";
import { listHtmlPresets } from "../services/htmlProjectsApi";
import type { HtmlDesignPreset } from "../lib/presets";
import { HtmlPresetGallery } from "./HtmlPresetGallery";
import { HtmlTemplateDetailView } from "./HtmlTemplateDetailView";

type BrowseView = "grid" | "detail";

export function HtmlTemplatesBrowseModal() {
  const open = useEditorSelector((s: any) => !!(s as any).htmlTemplatesBrowseModalOpen);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const [presets, setPresets] = useState<HtmlDesignPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalSelectedPresetId, setModalSelectedPresetId] = useState<string | null>(null);
  const [view, setView] = useState<BrowseView>("grid");
  const [detailPreset, setDetailPreset] = useState<HtmlDesignPreset | null>(null);

  const close = useCallback(() => {
    actions?.onCloseHtmlTemplatesBrowseModal?.();
    setModalSelectedPresetId(null);
    setView("grid");
    setDetailPreset(null);
  }, [actions]);

  const backToGrid = useCallback(() => {
    setView("grid");
    setDetailPreset(null);
  }, []);

  useEffect(() => {
    if (!open) {
      setView("grid");
      setDetailPreset(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listHtmlPresets()
      .then((next) => {
        if (!cancelled) setPresets(next);
      })
      .catch((e: any) => {
        if (!cancelled) setError(String(e?.message || "Failed to load templates"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  /**
   * Backdrop (mousedown on scrim): always close the entire modal, including from template detail.
   * Escape: from detail → back to grid first; from grid → close modal.
   */
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/50 p-2 md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDownCapture={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        if (view === "detail") {
          backToGrid();
        } else {
          close();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="html-templates-browse-title"
        className="flex h-full w-full max-w-6xl min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 md:px-5">
          <div className="min-w-0">
            <h2 id="html-templates-browse-title" className="text-base font-semibold text-slate-900">
              Browse templates
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Browsing only — your project preset is unchanged.
            </p>
          </div>
          <button
            type="button"
            autoFocus={view === "grid"}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={close}
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex min-h-[200px] flex-1 items-center justify-center text-sm text-slate-500">Loading templates…</div>
          ) : error ? (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-800">{error}</div>
          ) : presets.length === 0 ? (
            <div className="m-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No templates are available yet.
            </div>
          ) : view === "detail" && detailPreset ? (
            <HtmlTemplateDetailView preset={detailPreset} onBack={backToGrid} />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-5">
              <div className="-mt-2">
                <HtmlPresetGallery
                  presets={presets}
                  selectedPresetId={modalSelectedPresetId}
                  onSelect={(presetId) => setModalSelectedPresetId(presetId)}
                  onOpenPresetDetails={(preset) => {
                    setModalSelectedPresetId(preset.id);
                    setDetailPreset(preset);
                    setView("detail");
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
