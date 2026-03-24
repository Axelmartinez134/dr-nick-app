"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";
import type { CarouselMapExpansion, CarouselMapPromptSection } from "@/features/editor/components/carousel-map/types";

type SavedPromptRow = {
  id: string;
  title: string;
  is_active: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  mapId: string | null;
  expansion: CarouselMapExpansion | null;
  initialTemplateTypeId: "regular" | "enhanced";
  initialSavedPromptId?: string | null;
  onSelectionChange?: (args: { templateTypeId: "regular" | "enhanced"; savedPromptId: string }) => void;
  onPick: (args: { templateTypeId: "regular" | "enhanced"; savedPromptId: string; expansionId: string }) => void;
};

function getActiveAccountHeader(): Record<string, string> {
  try {
    const id = typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
    return id ? { "x-account-id": id } : {};
  } catch {
    return {};
  }
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function authedFetchJson(url: string, init?: RequestInit) {
  const token = await getToken();
  if (!token) throw new Error("Missing auth token");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...getActiveAccountHeader(),
    ...(init?.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(String(json?.error || `Request failed (${res.status})`));
  return json;
}

export function CarouselMapProjectPickerModal({
  open,
  onClose,
  mapId,
  expansion,
  initialTemplateTypeId,
  initialSavedPromptId,
  onSelectionChange,
  onPick,
}: Props) {
  const [templateTypeId, setTemplateTypeId] = useState<"regular" | "enhanced">(initialTemplateTypeId);
  const [savedPromptId, setSavedPromptId] = useState<string>(String(initialSavedPromptId || "").trim());
  const [savedPrompts, setSavedPrompts] = useState<SavedPromptRow[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptSections, setPromptSections] = useState<CarouselMapPromptSection[]>([]);

  useEffect(() => {
    if (!open) return;
    setTemplateTypeId(initialTemplateTypeId);
    setSavedPromptId(String(initialSavedPromptId || "").trim());
    setPromptOpen(false);
    setPromptError(null);
    setPromptSections([]);
  }, [initialSavedPromptId, initialTemplateTypeId, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setPromptsLoading(true);
      setPromptsError(null);
      try {
        const json = await authedFetchJson(`/api/editor/user-settings/poppy-prompts/list?type=${encodeURIComponent(templateTypeId)}`);
        const rows: SavedPromptRow[] = Array.isArray(json.prompts) ? (json.prompts as SavedPromptRow[]) : [];
        if (cancelled) return;
        setSavedPrompts(rows);
        setSavedPromptId((prev) => {
          const requested = String(prev || "").trim();
          const initial = String(initialSavedPromptId || "").trim();
          const keep = requested && rows.some((row) => row.id === requested) ? requested : "";
          if (keep) return keep;
          if (initial && rows.some((row) => row.id === initial)) return initial;
          return rows[0]?.id || "";
        });
      } catch (e: any) {
        if (cancelled) return;
        setSavedPrompts([]);
        setPromptsError(String(e?.message || e || "Failed to load prompts"));
      } finally {
        if (!cancelled) setPromptsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [initialSavedPromptId, open, templateTypeId]);

  useEffect(() => {
    if (!open) return;
    onSelectionChange?.({ templateTypeId, savedPromptId: String(savedPromptId || "").trim() });
  }, [onSelectionChange, open, savedPromptId, templateTypeId]);

  const selectedPrompt = useMemo(
    () => savedPrompts.find((row) => row.id === savedPromptId) || null,
    [savedPromptId, savedPrompts]
  );

  const loadPromptPreview = async () => {
    if (!mapId || !savedPromptId || !expansion?.id) return;
    setPromptLoading(true);
    setPromptError(null);
    try {
      const json = await authedFetchJson(`/api/carousel-map/${encodeURIComponent(mapId)}/prompt-preview`, {
        method: "POST",
        body: JSON.stringify({
          templateTypeId,
          savedPromptId,
          expansionId: expansion.id,
        }),
      });
      setPromptSections(Array.isArray(json.sections) ? (json.sections as CarouselMapPromptSection[]) : []);
    } catch (e: any) {
      setPromptSections([]);
      setPromptError(String(e?.message || e || "Failed to load prompt preview"));
    } finally {
      setPromptLoading(false);
    }
  };

  if (!open || !expansion) return null;

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-black/55 p-3 md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-6xl h-[88vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">Create project + rewrite</div>
            <div className="mt-1 text-xs text-slate-500 truncate">Use this selected Carousel Map expansion to create the project.</div>
          </div>
          <button
            type="button"
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1.4fr_1fr]">
          <div className="min-h-0 overflow-auto p-4 md:p-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-700">Expansion preview</div>
              <div className="mt-3 space-y-2 text-sm text-slate-800">
                <div><span className="font-semibold text-slate-600">Slide 1:</span> {expansion.selectedSlide1Text}</div>
                <div><span className="font-semibold text-slate-600">Slide 2:</span> {expansion.selectedSlide2Text}</div>
                <div><span className="font-semibold text-slate-600">Slide 3:</span> {expansion.slide3}</div>
                <div><span className="font-semibold text-slate-600">Slide 4:</span> {expansion.slide4}</div>
                <div><span className="font-semibold text-slate-600">Slide 5:</span> {expansion.slide5}</div>
                <div><span className="font-semibold text-slate-600">Slide 6:</span> {expansion.slide6}</div>
              </div>
            </div>

            {promptOpen ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Prompt preview</div>
                  <button
                    type="button"
                    className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50"
                    onClick={() => setPromptOpen(false)}
                  >
                    Hide
                  </button>
                </div>
                {promptError ? <div className="mt-3 text-sm text-red-600">❌ {promptError}</div> : null}
                {promptLoading ? <div className="mt-3 text-sm text-slate-600">Loading…</div> : null}
                <div className="mt-3 space-y-3">
                  {promptSections.map((section, idx) => (
                    <div key={section.id || String(idx)} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700">
                        {idx + 1}. {section.title}
                      </div>
                      <div className="p-4 text-xs text-slate-800 whitespace-pre-wrap break-words">{section.content || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="border-l border-slate-100 bg-slate-50/60 p-4 overflow-auto">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-700">Template type</div>
              <select
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                value={templateTypeId}
                onChange={(e) => {
                  setTemplateTypeId(e.target.value === "regular" ? "regular" : "enhanced");
                  setPromptOpen(false);
                  setPromptError(null);
                  setPromptSections([]);
                }}
              >
                <option value="enhanced">Enhanced</option>
                <option value="regular">Regular</option>
              </select>

              <div className="mt-4 text-xs font-semibold text-slate-700">Saved prompt</div>
              <select
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-50"
                value={savedPromptId}
                disabled={promptsLoading || savedPrompts.length === 0}
                onChange={(e) => {
                  setSavedPromptId(String(e.target.value || ""));
                  setPromptOpen(false);
                  setPromptError(null);
                  setPromptSections([]);
                }}
              >
                {savedPrompts.length === 0 ? <option value="">{promptsLoading ? "Loading..." : "No saved prompts found"}</option> : null}
                {savedPrompts.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.is_active ? "★ " : ""}
                    {row.title}
                  </option>
                ))}
              </select>
              {promptsError ? <div className="mt-2 text-[11px] text-red-600">❌ {promptsError}</div> : null}
              {!promptsError && !promptsLoading && savedPrompts.length === 0 ? (
                <div className="mt-2 text-[11px] text-amber-700">No saved prompts found for this template type.</div>
              ) : null}

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold text-slate-700">Summary</div>
                <div className="mt-1 text-[11px] text-slate-600">Template type: {templateTypeId === "regular" ? "Regular" : "Enhanced"}</div>
                <div className="mt-1 text-[11px] text-slate-600">Saved prompt: {selectedPrompt?.title || "No saved prompt selected"}</div>
                <div className="mt-1 text-[11px] text-slate-600">Expansion: Slides 1-6 selected</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                disabled={!savedPromptId || !expansion.id}
                onClick={() =>
                  onPick({
                    templateTypeId,
                    savedPromptId: String(savedPromptId || "").trim(),
                    expansionId: expansion.id,
                  })
                }
              >
                Use this expansion
              </button>
              <button
                type="button"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={!mapId || !savedPromptId || !expansion?.id}
                onClick={() => {
                  setPromptOpen(true);
                  void loadPromptPreview();
                }}
              >
                Show prompt that will be sent
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
