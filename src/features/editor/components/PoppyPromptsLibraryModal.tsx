"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";

export function PoppyPromptsLibraryModal() {
  const open = useEditorSelector((s: any) => !!(s as any).poppyPromptsLibraryOpen);
  const templateTypeId = useEditorSelector((s: any) => (s as any).templateTypeId === "enhanced" ? "enhanced" : "regular");
  const status = useEditorSelector((s: any) => String((s as any).poppyPromptsLibraryStatus || "idle"));
  const error = useEditorSelector((s: any) => ((s as any).poppyPromptsLibraryError as any) || null);
  const prompts = useEditorSelector((s: any) => (Array.isArray((s as any).poppyPromptsLibraryPrompts) ? (s as any).poppyPromptsLibraryPrompts : []));
  const poppyActivePromptId = useEditorSelector((s: any) => {
    const id = String((s as any).poppyActivePromptId || "").trim();
    return id || null;
  });

  // Brand voice (Alignment): stored per-account and reused as the canonical brand voice doc.
  const brandAlignmentPrompt = useEditorSelector((s: any) => String((s as any).brandAlignmentPrompt || ""));
  const brandAlignmentPromptSaveStatus = useEditorSelector(
    (s: any) => (String((s as any).brandAlignmentPromptSaveStatus || "idle") as any) || "idle"
  );
  const brandAlignmentPromptSaveError = useEditorSelector((s: any) => ((s as any).brandAlignmentPromptSaveError as any) || null);

  const actions = useEditorSelector((s: any) => (s as any).actions);

  const [brandVoiceOpen, setBrandVoiceOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftTitleById, setDraftTitleById] = useState<Record<string, string>>({});
  const [draftPromptById, setDraftPromptById] = useState<Record<string, string>>({});
  const [saveStatusById, setSaveStatusById] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [saveErrorById, setSaveErrorById] = useState<Record<string, string | null>>({});
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [createBusy, setCreateBusy] = useState(false);

  const saveTimeoutsRef = useRef<Record<string, number>>({});

  const promptById = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of prompts || []) {
      const id = String((p as any)?.id || "").trim();
      if (id) m.set(id, p);
    }
    return m;
  }, [prompts]);

  const close = () => {
    try {
      actions.onClosePoppyPromptsLibrary();
    } catch {
      // ignore
    }
  };

  const reload = async () => {
    const rows = await actions.fetchPoppyPromptsLibrary({ templateTypeId });
    actions?.setPoppyPromptsLibraryUi?.({ status: "done", error: null, prompts: rows });
    return rows as any[];
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        actions?.setPoppyPromptsLibraryUi?.({ status: "loading", error: null, prompts: [] });
      } catch {
        // ignore
      }
      try {
        const rows = await actions.fetchPoppyPromptsLibrary({ templateTypeId });
        if (cancelled) return;
        actions?.setPoppyPromptsLibraryUi?.({ status: "done", error: null, prompts: rows });
      } catch (e: any) {
        if (cancelled) return;
        actions?.setPoppyPromptsLibraryUi?.({ status: "error", error: String(e?.message || "Failed to load prompts"), prompts: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateTypeId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Reset transient UI each time the modal opens (drafts will be rehydrated on expand).
    setBrandVoiceOpen(false);
    setExpandedId(null);
    setDraftTitleById({});
    setDraftPromptById({});
    setSaveStatusById({});
    setSaveErrorById({});
    setBusyIds({});
    setCreateBusy(false);
  }, [open]);

  const scheduleSave = (id: string, nextTitle: string, nextPrompt: string) => {
    const key = String(id || "").trim();
    if (!key) return;
    const prev = saveTimeoutsRef.current[key];
    if (prev) window.clearTimeout(prev);
    saveTimeoutsRef.current[key] = window.setTimeout(async () => {
      setSaveStatusById((m) => ({ ...m, [key]: "saving" }));
      setSaveErrorById((m) => ({ ...m, [key]: null }));
      try {
        await actions.updatePoppyPrompt({ id: key, title: nextTitle, prompt: nextPrompt });
        setSaveStatusById((m) => ({ ...m, [key]: "saved" }));
        window.setTimeout(() => setSaveStatusById((m) => ({ ...m, [key]: "idle" })), 1200);
        // If this is the active prompt, hydrate the main Poppy Prompt editor immediately.
        try {
          if (poppyActivePromptId && key === poppyActivePromptId) {
            actions.hydrateActivePoppyPrompt({ id: key, prompt: nextPrompt });
          }
        } catch {
          // ignore
        }
      } catch (e: any) {
        setSaveStatusById((m) => ({ ...m, [key]: "error" }));
        setSaveErrorById((m) => ({ ...m, [key]: String(e?.message || "Save failed") }));
        window.setTimeout(() => setSaveStatusById((m) => ({ ...m, [key]: "idle" })), 2000);
      }
    }, 600);
  };

  const ensureDrafts = (id: string) => {
    const key = String(id || "").trim();
    if (!key) return;
    const p = promptById.get(key) || null;
    if (!p) return;
    setDraftTitleById((m) => (m[key] !== undefined ? m : { ...m, [key]: String(p.title || "") }));
    setDraftPromptById((m) => (m[key] !== undefined ? m : { ...m, [key]: String(p.prompt || "") }));
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">
            Saved Poppy Prompts ({templateTypeId === "enhanced" ? "Enhanced" : "Regular"})
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={close}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">
          {/* Sticky brand voice editor (Alignment) */}
          <div className="sticky top-0 z-10 -mx-5 px-5 pt-0 pb-4 bg-white">
            <div
              className={[
                "rounded-xl border p-4 shadow-sm cursor-pointer select-none",
                brandVoiceOpen ? "border-blue-300 bg-blue-50" : "border-blue-200 bg-blue-50 hover:bg-blue-100/40",
              ].join(" ")}
              onClick={() => setBrandVoiceOpen((v) => !v)}
              role="button"
              tabIndex={0}
              title={brandVoiceOpen ? "Click to collapse" : "Click to edit brand voice"}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-blue-900">Brand Voice</div>
                  {!brandVoiceOpen ? (
                    <div className="mt-0.5 text-[11px] text-blue-900/70 truncate">
                      {String(brandAlignmentPrompt || "").split("\n")[0] || "Click to edit..."}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-xs text-blue-900/80">
                      This sets the voice + rules used for all carousel copy generation for this client.
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {brandAlignmentPromptSaveStatus === "saving" ? (
                    <span className="text-xs text-blue-700">Saving...</span>
                  ) : brandAlignmentPromptSaveStatus === "saved" ? (
                    <span className="text-xs text-emerald-600">Saved ✓</span>
                  ) : brandAlignmentPromptSaveStatus === "error" ? (
                    <span className="text-xs text-red-600">Save failed</span>
                  ) : null}
                  <span className="text-xs text-blue-900/60">{brandVoiceOpen ? "▾" : "▸"}</span>
                </div>
              </div>

              {brandVoiceOpen ? (
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={10}
                    value={brandAlignmentPrompt}
                    onChange={(e) => actions?.onChangeBrandAlignmentPrompt?.(e.target.value)}
                    placeholder="Paste your brand voice + rules here..."
                  />
                  {brandAlignmentPromptSaveStatus === "error" && brandAlignmentPromptSaveError ? (
                    <div className="mt-2 text-xs text-red-600">❌ {String(brandAlignmentPromptSaveError)}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="text-sm font-semibold text-slate-900">Prompts</div>
              <div className="mt-0.5 text-xs text-slate-600">Select and edit your style prompts below.</div>
            </div>
          </div>

          {status === "loading" ? (
            <div className="text-sm text-slate-600">Loading…</div>
          ) : status === "error" ? (
            <div className="text-sm text-red-600">❌ {error || "Failed to load prompts"}</div>
          ) : prompts.length === 0 ? (
            <div className="text-sm text-slate-600">
              No saved prompts yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {prompts.map((p: any) => {
                const active = !!p?.is_active;
                const id = String(p?.id || "").trim();
                const openRow = expandedId && id && expandedId === id;
                const draftTitle = draftTitleById[id] ?? String(p?.title || "");
                const draftPrompt = draftPromptById[id] ?? String(p?.prompt || "");
                const saveStatus = saveStatusById[id] || "idle";
                const saveErr = saveErrorById[id] || null;
                const rowBusy = !!busyIds[id];
                return (
                  <div
                    key={id}
                    className={["group rounded-lg border bg-white px-3 py-2", openRow ? "border-slate-300" : "border-slate-200 hover:bg-slate-50"].join(" ")}
                    onClick={() => {
                      if (!id) return;
                      if (expandedId === id) {
                        setExpandedId(null);
                      } else {
                        setExpandedId(id);
                        ensureDrafts(id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{draftTitle}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                          {String(draftPrompt || "").split("\n")[0] || ""}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {active ? (
                          <span className="rounded-full bg-blue-600 text-white text-[11px] font-semibold px-2 py-0.5">
                            Active
                          </span>
                        ) : null}
                        {/* Hover actions (collapsed) */}
                        {!openRow ? (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <button
                              type="button"
                              className="h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!id || rowBusy) return;
                                setBusyIds((m) => ({ ...m, [id]: true }));
                                try {
                                  const created = await actions.duplicatePoppyPrompt({ id });
                                  const rows = await reload();
                                  const newId = String((created as any)?.id || "");
                                  if (newId) {
                                    setExpandedId(newId);
                                    ensureDrafts(newId);
                                  } else if (rows.length > 0) {
                                    setExpandedId(String((rows[0] as any)?.id || "") || null);
                                  }
                                } finally {
                                  setBusyIds((m) => ({ ...m, [id]: false }));
                                }
                              }}
                              disabled={rowBusy}
                              title="Duplicate"
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              className="h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!id || rowBusy) return;
                                if (active) return;
                                setBusyIds((m) => ({ ...m, [id]: true }));
                                try {
                                  const activated = await actions.setActivePoppyPrompt({ id });
                                  try {
                                    actions.hydrateActivePoppyPrompt({
                                      id: String((activated as any)?.id || "") || id,
                                      prompt: String((activated as any)?.prompt || draftPromptById[id] || ""),
                                    });
                                  } catch {
                                    // ignore
                                  }
                                  await reload();
                                  close();
                                  actions.onOpenPromptModal("prompt");
                                } finally {
                                  setBusyIds((m) => ({ ...m, [id]: false }));
                                }
                              }}
                              disabled={rowBusy || active}
                              title="Make Active Prompt"
                            >
                              Make Active
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {openRow ? (
                      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-700">Title</div>
                          {saveStatus === "saving" ? (
                            <div className="text-xs text-slate-500">Saving…</div>
                          ) : saveStatus === "saved" ? (
                            <div className="text-xs text-emerald-600">Saved ✓</div>
                          ) : saveStatus === "error" ? (
                            <div className="text-xs text-red-600">Save failed</div>
                          ) : null}
                        </div>
                        <input
                          className="mt-1 w-full h-9 rounded-md border border-slate-200 px-3 text-sm text-slate-900"
                          value={draftTitle}
                          onChange={(e) => {
                            const next = e.target.value;
                            setDraftTitleById((m) => ({ ...m, [id]: next }));
                            scheduleSave(id, next, draftPromptById[id] ?? draftPrompt);
                          }}
                        />

                        <div className="mt-3 text-xs font-semibold text-slate-700">Prompt</div>
                        <textarea
                          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                          rows={10}
                          value={draftPrompt}
                          onChange={(e) => {
                            const next = e.target.value;
                            setDraftPromptById((m) => ({ ...m, [id]: next }));
                            scheduleSave(id, draftTitleById[id] ?? draftTitle, next);
                          }}
                        />

                        {saveStatus === "error" && saveErr ? (
                          <div className="mt-2 text-xs text-red-600">❌ {saveErr}</div>
                        ) : null}

                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                            onClick={async () => {
                              if (!id || rowBusy) return;
                              setBusyIds((m) => ({ ...m, [id]: true }));
                              try {
                                const created = await actions.duplicatePoppyPrompt({ id });
                                await reload();
                                const newId = String((created as any)?.id || "");
                                if (newId) {
                                  setExpandedId(newId);
                                  ensureDrafts(newId);
                                }
                              } finally {
                                setBusyIds((m) => ({ ...m, [id]: false }));
                              }
                            }}
                            disabled={rowBusy}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                            onClick={async () => {
                              if (!id || rowBusy) return;
                              if (active) return;
                              setBusyIds((m) => ({ ...m, [id]: true }));
                              try {
                                const activated = await actions.setActivePoppyPrompt({ id });
                                try {
                                  actions.hydrateActivePoppyPrompt({
                                    id: String((activated as any)?.id || "") || id,
                                    prompt: String((activated as any)?.prompt || draftPromptById[id] || ""),
                                  });
                                } catch {
                                  // ignore
                                }
                                await reload();
                                close();
                                actions.onOpenPromptModal("prompt");
                              } finally {
                                setBusyIds((m) => ({ ...m, [id]: false }));
                              }
                            }}
                            disabled={rowBusy || active}
                          >
                            Make Active Prompt
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Click a prompt to open and edit. Auto-saves as you type.
            </div>
            <button
              type="button"
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-50"
              disabled={createBusy}
              onClick={async () => {
                if (createBusy) return;
                setCreateBusy(true);
                try {
                  const created = await actions.createPoppyPrompt({ templateTypeId, title: "New Prompt", prompt: "" });
                  await reload();
                  const newId = String((created as any)?.id || "");
                  if (newId) {
                    setExpandedId(newId);
                    ensureDrafts(newId);
                  }
                } finally {
                  setCreateBusy(false);
                }
              }}
              title="Create a new saved prompt"
            >
              Create New Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

