"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";

type TemplateTypeId = "regular" | "enhanced" | "html";

type Idea = {
  id: string;
  createdAt: string;
  title: string;
  slideOutline: string[];
  angleText: string;
};

type SavedPrompt = {
  id: string;
  title: string;
  is_active: boolean;
};

function getActiveAccountHeader(): Record<string, string> {
  try {
    const id = typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
    return id ? ({ "x-account-id": id } as Record<string, string>) : ({} as Record<string, string>);
  } catch {
    return {} as Record<string, string>;
  }
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export function SwipeIdeasPickerModal(props: {
  open: boolean;
  onClose: () => void;
  swipeItemId: string | null;
  swipeItemLabel: string;
  initialTemplateTypeId: TemplateTypeId;
  initialSavedPromptId: string;
  angleNotesSnapshot: string;
  sourceDigestTopicId?: string | null;
  requireIdeaSelection?: boolean;
  onSelectionChange?: (args: { templateTypeId: TemplateTypeId; savedPromptId: string }) => void;
  onPick: (args: { ideaId: string | null; templateTypeId: TemplateTypeId; savedPromptId: string }) => void;
}) {
  const {
    open,
    onClose,
    swipeItemId,
    swipeItemLabel,
    initialTemplateTypeId,
    initialSavedPromptId,
    angleNotesSnapshot,
    sourceDigestTopicId,
    requireIdeaSelection,
    onSelectionChange,
    onPick,
  } = props;

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [templateTypeId, setTemplateTypeId] = useState<TemplateTypeId>(initialTemplateTypeId);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [savedPromptId, setSavedPromptId] = useState<string>(initialSavedPromptId);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);

  const selectedIdea = useMemo(() => ideas.find((i) => i.id === selectedId) || null, [ideas, selectedId]);

  const [promptOpen, setPromptOpen] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptSections, setPromptSections] = useState<Array<{ id: string; title: string; content: string }>>([]);

  const allowHtml = !String(sourceDigestTopicId || "").trim();

  const emitSelectionChange = (args: { templateTypeId: TemplateTypeId; savedPromptId: string }) => {
    onSelectionChange?.(args);
  };

  const refreshPrompts = async (args: { templateTypeId: TemplateTypeId; preferredPromptId?: string }) => {
    setPromptsLoading(true);
    setPromptsError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/editor/user-settings/poppy-prompts/list?type=${encodeURIComponent(args.templateTypeId)}`, {
        method: "GET",
        headers,
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load prompts (${res.status})`));
      const rows: SavedPrompt[] = Array.isArray(j.prompts)
        ? j.prompts.map((p: any) => ({ id: String(p.id), title: String(p.title || "Prompt"), is_active: !!p.is_active }))
        : [];
      setSavedPrompts(rows);

      const preferredPromptId = String(args.preferredPromptId || "").trim();
      const preferredExists = preferredPromptId ? rows.some((p) => p.id === preferredPromptId) : false;
      const nextPromptId = preferredExists ? preferredPromptId : rows.find((p) => p.is_active)?.id || rows[0]?.id || "";
      setSavedPromptId(nextPromptId);
      emitSelectionChange({ templateTypeId: args.templateTypeId, savedPromptId: nextPromptId });
    } catch (e: any) {
      setSavedPrompts([]);
      setSavedPromptId("");
      setPromptsError(String(e?.message || e || "Failed to load prompts"));
      emitSelectionChange({ templateTypeId: args.templateTypeId, savedPromptId: "" });
    } finally {
      setPromptsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTemplateTypeId(initialTemplateTypeId === "html" && !allowHtml ? "enhanced" : initialTemplateTypeId);
    setSavedPromptId(initialSavedPromptId);
  }, [open, initialTemplateTypeId, initialSavedPromptId, allowHtml]);

  useEffect(() => {
    if (!open) return;
    const preferredPromptId = templateTypeId === initialTemplateTypeId ? initialSavedPromptId : "";
    void refreshPrompts({ templateTypeId, preferredPromptId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateTypeId]);

  useEffect(() => {
    if (!open) return;
    const itemId = String(swipeItemId || "").trim();
    if (!itemId) return;

    let cancelled = false;
    void (async () => {
      setStatus("loading");
      setError(null);
      setIdeas([]);
      setSelectedId("");
      setPromptOpen(false);
      setPromptLoading(false);
      setPromptError(null);
      setPromptSections([]);
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing auth token");
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
        const ideasQuery = String(sourceDigestTopicId || "").trim()
          ? `?sourceDigestTopicId=${encodeURIComponent(String(sourceDigestTopicId || "").trim())}`
          : "";
        const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/ideas${ideasQuery}`, { method: "GET", headers });
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load ideas (${res.status})`));
        const rows: Idea[] = Array.isArray(j.ideas)
          ? (j.ideas as any[]).map((r) => ({
              id: String(r.id),
              createdAt: String(r.createdAt || ""),
              title: String(r.title || ""),
              slideOutline: Array.isArray(r.slideOutline) ? r.slideOutline.map((x: any) => String(x ?? "")) : [],
              angleText: String(r.angleText || ""),
            }))
          : [];
        setIdeas(rows);
        setStatus("ready");
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          setError(String(e?.message || e || "Failed to load ideas"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, sourceDigestTopicId, swipeItemId]);

  const loadPromptPreview = async (args: { ideaId: string | null }) => {
    const itemId = String(swipeItemId || "").trim();
    if (!itemId) return;
    setPromptLoading(true);
    setPromptError(null);
    setPromptSections([]);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/swipe-file/items/${encodeURIComponent(itemId)}/ideas/prompt-preview`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          templateTypeId,
          savedPromptId: String(savedPromptId || "").trim(),
          ideaId: args.ideaId,
          angleNotesSnapshot: String(angleNotesSnapshot || ""),
          sourceDigestTopicId: String(sourceDigestTopicId || "").trim() || null,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load prompt (${res.status})`));
      const sections = Array.isArray(j.sections) ? (j.sections as any[]) : [];
      setPromptSections(
        sections.map((s) => ({
          id: String(s?.id || ""),
          title: String(s?.title || ""),
          content: String(s?.content || ""),
        }))
      );
    } catch (e: any) {
      setPromptError(String(e?.message || e || "Failed to load prompt"));
      setPromptSections([]);
    } finally {
      setPromptLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[145] flex items-stretch justify-center bg-black/50 p-2 md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl h-full bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900 truncate">Pick an idea</div>
            <div className="mt-0.5 text-xs text-slate-500 truncate" title={swipeItemLabel}>
              {swipeItemLabel || "Swipe item"}
            </div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_360px]">
          <main className="min-h-0 overflow-auto p-4">
            {status === "loading" ? <div className="text-sm text-slate-600">Loading…</div> : null}
            {status === "error" ? <div className="text-sm text-red-600">❌ {error || "Failed to load"}</div> : null}
            {status === "ready" && ideas.length === 0 ? (
              <div className="text-sm text-slate-600">
                No saved ideas yet. Click “Generate ideas” first, then select one to save it.
              </div>
            ) : null}

            <div className="space-y-2">
              {ideas.map((it) => {
                const active = it.id === selectedId;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={[
                      "w-full text-left rounded-xl border px-4 py-3 transition-colors",
                      active ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50",
                    ].join(" ")}
                    onClick={() => setSelectedId(it.id)}
                    title={it.title}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{it.title || "Idea"}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {it.createdAt ? new Date(it.createdAt).toLocaleString() : ""}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">{active ? "Selected" : ""}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1">
                      {(Array.isArray(it.slideOutline) ? it.slideOutline : []).slice(0, 2).map((s, idx) => (
                        <div key={idx} className="text-xs text-slate-700 truncate">
                          <span className="font-semibold text-slate-600">S{idx + 1}:</span> {String(s || "").trim() || "—"}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </main>

          <aside className="border-l border-slate-100 bg-slate-50/50 p-4 overflow-auto">
            <div className="text-xs font-semibold text-slate-700">Preview</div>
            <div className="mt-2 text-[11px] text-slate-500">This idea will become the “angle” used for copy generation.</div>

            {selectedIdea ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">{selectedIdea.title}</div>
                <div className="mt-2 space-y-1">
                  {selectedIdea.slideOutline.slice(0, 6).map((s, i) => (
                    <div key={i} className="text-xs text-slate-700">
                      <span className="font-semibold text-slate-600">S{i + 1}:</span> {String(s || "").trim() || "—"}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-600">Select an idea to preview it.</div>
            )}

            <div className="mt-4 space-y-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-xs font-semibold text-slate-700">Create project + rewrite</div>
                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-slate-700">Template type</div>
                  <select
                    className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                    value={templateTypeId}
                    onChange={(e) => {
                      const next =
                        e.target.value === "regular" ? "regular" : e.target.value === "html" ? "html" : "enhanced";
                      setTemplateTypeId(next);
                      setSavedPromptId("");
                      setPromptOpen(false);
                      setPromptError(null);
                      setPromptSections([]);
                      emitSelectionChange({ templateTypeId: next, savedPromptId: "" });
                    }}
                  >
                    <option value="enhanced">Enhanced</option>
                    <option value="regular">Regular</option>
                    {allowHtml ? <option value="html">HTML</option> : null}
                  </select>
                </div>
                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-slate-700">Saved prompt</div>
                  <select
                    className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-50"
                    value={savedPromptId}
                    onChange={(e) => {
                      const next = String(e.target.value || "");
                      setSavedPromptId(next);
                      setPromptOpen(false);
                      setPromptError(null);
                      setPromptSections([]);
                      emitSelectionChange({ templateTypeId, savedPromptId: next });
                    }}
                    disabled={promptsLoading || savedPrompts.length === 0}
                  >
                    {savedPrompts.length === 0 ? (
                      <option value="">{promptsLoading ? "Loading..." : "No saved prompts found"}</option>
                    ) : null}
                    {savedPrompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.is_active ? "★ " : ""}
                        {p.title}
                      </option>
                    ))}
                  </select>
                  {promptsError ? <div className="mt-2 text-[11px] text-red-600">❌ {promptsError}</div> : null}
                  {!promptsError && !promptsLoading && savedPrompts.length === 0 ? (
                    <div className="mt-2 text-[11px] text-amber-700">No saved prompts found for this template type.</div>
                  ) : null}
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] font-semibold text-slate-700">Summary</div>
                  <div className="mt-1 text-[11px] text-slate-600">
                    Template type: {templateTypeId === "regular" ? "Regular" : templateTypeId === "html" ? "HTML" : "Enhanced"}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">
                    Saved prompt: {savedPrompts.find((p) => p.id === savedPromptId)?.title || "No saved prompt selected"}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">
                    Selected idea: {selectedIdea ? selectedIdea.title : requireIdeaSelection ? "Select an idea" : "Continue without idea"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                disabled={!selectedIdea || !savedPromptId}
                onClick={() =>
                  onPick({
                    ideaId: selectedIdea ? selectedIdea.id : null,
                    templateTypeId,
                    savedPromptId: String(savedPromptId || "").trim(),
                  })
                }
              >
                Use selected idea
              </button>
              {!requireIdeaSelection ? (
                <button
                  type="button"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50"
                  disabled={!savedPromptId}
                  onClick={() =>
                    onPick({
                      ideaId: null,
                      templateTypeId,
                      savedPromptId: String(savedPromptId || "").trim(),
                    })
                  }
                  title="Continue using Angle/Notes (no idea selected)"
                >
                  Continue without idea
                </button>
              ) : null}
              <button
                type="button"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={!String(swipeItemId || "").trim() || !String(savedPromptId || "").trim() || (!!requireIdeaSelection && !selectedIdea)}
                onClick={() => {
                  setPromptOpen(true);
                  void loadPromptPreview({ ideaId: selectedIdea ? selectedIdea.id : null });
                }}
                title="See the exact LLM prompt (split into sections)"
              >
                Show prompt that will be sent
              </button>
            </div>
          </aside>
        </div>
      </div>

      {promptOpen ? (
        <div
          className="fixed inset-0 z-[155] flex items-stretch justify-center bg-black/50 p-2 md:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPromptOpen(false);
          }}
        >
          <div className="w-full max-w-4xl h-full bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900 truncate">Prompt preview</div>
                <div className="mt-0.5 text-xs text-slate-500 truncate">Shown in the same order the LLM receives it.</div>
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => setPromptOpen(false)}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-4">
              {promptError ? <div className="text-sm text-red-600">❌ {promptError}</div> : null}
              {promptLoading ? <div className="text-sm text-slate-600">Loading…</div> : null}

              {!promptLoading && !promptError && promptSections.length === 0 ? (
                <div className="text-sm text-slate-600">No prompt sections.</div>
              ) : null}

              <div className="space-y-3">
                {promptSections.map((sec, idx) => (
                  <div key={sec.id || String(idx)} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <div className="text-xs font-semibold text-slate-700">
                        {idx + 1}. {sec.title || "Section"}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="text-xs text-slate-800 whitespace-pre-wrap break-words">{sec.content || "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 p-4 flex justify-end">
              <button
                type="button"
                className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50"
                onClick={() => setPromptOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

