/* eslint-disable react/no-unstable-nested-components */
"use client";

import { useEffect, useMemo, useState } from "react";
import { SavedProjectsCard } from "@/features/editor/components/SavedProjectsCard";
import { useEditorSelector } from "@/features/editor/store";
import { supabase, useAuth } from "@/app/components/auth/AuthContext";

export function EditorSidebar() {
  const { user } = useAuth();
  const isMobile = useEditorSelector((s) => !!(s as any).isMobile);
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const topExporting = useEditorSelector((s: any) => !!(s as any).topExporting);
  const templateTypeId = useEditorSelector((s) => s.templateTypeId);
  const newProjectTemplateTypeId = useEditorSelector((s) => s.newProjectTemplateTypeId);
  const switchingSlides = useEditorSelector((s) => s.switchingSlides);
  const loading = useEditorSelector((s) => s.loading);

  const templateTypePromptPreviewLine = useEditorSelector((s) => s.templateTypePromptPreviewLine);
  const templateTypeEmphasisPromptPreviewLine = useEditorSelector((s) => s.templateTypeEmphasisPromptPreviewLine);
  const templateTypeImageGenPromptPreviewLine = useEditorSelector((s) => s.templateTypeImageGenPromptPreviewLine);

  const fontOptions = useEditorSelector((s) => s.fontOptions);
  const headlineFontKey = useEditorSelector((s) => s.headlineFontKey);
  const bodyFontKey = useEditorSelector((s) => s.bodyFontKey);

  const projectBackgroundColor = useEditorSelector((s) => s.projectBackgroundColor);
  const projectTextColor = useEditorSelector((s) => s.projectTextColor);
  const projectBackgroundEffectEnabled = useEditorSelector((s: any) => (s as any).projectBackgroundEffectEnabled);
  const projectBackgroundEffectType = useEditorSelector((s: any) => (s as any).projectBackgroundEffectType);
  const themeIdLastApplied = useEditorSelector((s: any) => (s as any).themeIdLastApplied);
  const themeIsCustomized = useEditorSelector((s: any) => (s as any).themeIsCustomized);

  const actions = useEditorSelector((s) => s.actions);

  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<{ accountId: string; displayName: string; role: string }>>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>("");
  const [accountsRefreshNonce, setAccountsRefreshNonce] = useState(0);

  const canShowAccountSwitcher = useMemo(() => {
    // Phase 1: mobile-only account switching for superadmins.
    return !!isMobile && !!isSuperadmin;
  }, [isMobile, isSuperadmin]);

  useEffect(() => {
    if (!canShowAccountSwitcher) return;
    let cancelled = false;

    async function loadAccountContext() {
      const userId = user?.id;
      if (!userId) {
        setAccounts([]);
        setActiveAccountId("");
        setAccountsLoading(false);
        setAccountsError(null);
        return;
      }

      setAccountsLoading(true);
      setAccountsError(null);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token || "";
        if (!token) throw new Error("Missing session");

        const rawActive = (() => {
          try {
            return typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
          } catch {
            return "";
          }
        })();

        const res = await fetch("/api/editor/accounts/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(rawActive ? { "x-account-id": rawActive } : {}),
          },
        });
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !j?.success) {
          throw new Error(String(j?.error || "Failed to load accounts"));
        }

        const nextAccounts = Array.isArray(j.accounts) ? j.accounts : [];
        const nextActive = String(j.activeAccountId || "").trim();
        setAccounts(nextAccounts);
        setActiveAccountId(nextActive);

        // Keep store's superadmin flag aligned (defensive; TopBar also does this).
        try {
          actions?.setIsSuperadmin?.(!!j.isSuperadmin);
        } catch {
          // ignore
        }

        if (nextActive) {
          try {
            localStorage.setItem("editor.activeAccountId", nextActive);
          } catch {
            // ignore
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        setAccounts([]);
        setActiveAccountId("");
        setAccountsError(String(e?.message || "Failed to load accounts"));
      } finally {
        if (cancelled) return;
        setAccountsLoading(false);
      }
    }

    void loadAccountContext();
    return () => {
      cancelled = true;
    };
  }, [actions, accountsRefreshNonce, canShowAccountSwitcher, user?.id]);

  return (
    <div className="p-4 space-y-4 overflow-auto">
      {/* Project Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white text-sm flex items-center justify-center">➕</span>
          <span className="text-sm font-semibold text-slate-900">Project</span>
        </div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Current project type: <span className="font-semibold uppercase">{templateTypeId}</span>
          </div>
          <div className="text-xs text-slate-600">New project type:</div>
        </div>
        <select
          className="mb-3 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
          value={newProjectTemplateTypeId}
          onChange={(e) => actions.onChangeNewProjectTemplateTypeId(e.target.value === "regular" ? "regular" : "enhanced")}
          disabled={switchingSlides}
          title="Choose the type for the next new project (does not change the current project)"
        >
          <option value="enhanced">Enhanced</option>
          <option value="regular">Regular</option>
        </select>
        <button
          className="w-full h-10 rounded-lg bg-black text-white text-sm font-semibold shadow-md hover:shadow-lg transition-shadow disabled:opacity-50"
          onClick={actions.onClickNewProject}
          disabled={switchingSlides}
        >
          New Project
        </button>
      </div>

      {/* Saved Projects Card */}
      <SavedProjectsCard />

      {/* Mobile-only: tools menu (Phase 1) */}
      {isMobile ? (
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-[#6D28D9] text-white text-sm flex items-center justify-center">🧰</span>
            <span className="text-sm font-semibold text-slate-900">Tools</span>
          </div>

          <div className="space-y-3">
            {canShowAccountSwitcher ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-xs font-semibold text-slate-700">Account</div>
                  {accountsLoading ? (
                    <div className="text-[11px] text-slate-500">Loading…</div>
                  ) : accounts.length > 0 ? (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                      onClick={() => {
                        setAccountsRefreshNonce((n) => n + 1);
                      }}
                      title="Refresh accounts"
                    >
                      Refresh
                    </button>
                  ) : null}
                </div>

                <select
                  className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                  value={activeAccountId}
                  disabled={accountsLoading || accounts.length <= 1}
                  onChange={(e) => {
                    const next = String(e.target.value || "").trim();
                    if (!next || next === activeAccountId) return;
                    try {
                      localStorage.setItem("editor.activeAccountId", next);
                    } catch {
                      // ignore
                    }
                    actions?.onCloseMobileDrawer?.();
                    // Hard reload so the editor bootstraps cleanly under the new account context.
                    window.location.reload();
                  }}
                  title="Switch account (reloads editor)"
                  aria-label="Switch account"
                >
                  {accounts.length === 0 ? <option value="">{accountsLoading ? "Loading…" : "No accounts"}</option> : null}
                  {accounts.map((a: any) => (
                    <option key={String(a.accountId)} value={String(a.accountId)}>
                      {String(a.displayName || "Account")}
                    </option>
                  ))}
                </select>

                {accountsError ? <div className="mt-2 text-xs text-red-600">{accountsError}</div> : null}
                <div className="mt-2 text-[11px] text-slate-500">Switching accounts reloads the editor.</div>
              </div>
            ) : null}

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold text-slate-700 mb-2">Export / Save</div>
              <div className="space-y-2">
                <button
                  type="button"
                  className="w-full h-11 rounded-md bg-[#6D28D9] text-white text-sm font-semibold disabled:opacity-50"
                  disabled={topExporting || switchingSlides}
                  onClick={() => {
                    actions?.onCloseMobileDrawer?.();
                    actions?.onShareAll?.();
                  }}
                  title="Download all slides using the iPhone share/save flow"
                >
                  {topExporting ? "Preparing..." : "Download All"}
                </button>
                <button
                  type="button"
                  className="w-full h-11 rounded-md border border-slate-200 bg-white text-slate-700 text-sm font-semibold disabled:opacity-50"
                  disabled={topExporting || switchingSlides}
                  onClick={() => {
                    actions?.onCloseMobileDrawer?.();
                    actions?.onDownloadAll?.();
                  }}
                  title="Fallback: downloads a ZIP to the Files app"
                >
                  {topExporting ? "Preparing..." : "Download ZIP (Files)"}
                </button>
              </div>
            </div>

            {isSuperadmin ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700 mb-2">Review &amp; Share</div>
                <button
                  type="button"
                  className="w-full h-11 rounded-md bg-black text-white text-sm font-semibold disabled:opacity-50"
                  disabled={topExporting}
                  onClick={() => {
                    actions?.onCloseMobileDrawer?.();
                    actions?.onOpenShareCarousels?.();
                  }}
                  title="Open the review queue (Ready=true, Posted=false)"
                >
                  Open queue
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Template Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm flex items-center justify-center">🎨</span>
            <span className="text-sm font-semibold text-slate-900">Template</span>
          </div>
          <button
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors"
            onClick={actions.onOpenTemplateSettings}
            disabled={switchingSlides}
            title="Edit template type settings"
          >
            Edit Template
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex w-full items-stretch gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
              onClick={() => actions.onOpenPromptModal("prompt")}
              disabled={switchingSlides}
              title="Edit Poppy Prompt"
            >
              <div className="text-xs font-semibold text-slate-700">Poppy Prompt</div>
              <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                {templateTypePromptPreviewLine || "Click to edit..."}
              </div>
            </button>
            <button
              type="button"
              className="shrink-0 h-auto px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
              onClick={() => actions.onOpenPoppyPromptsLibrary()}
              disabled={switchingSlides}
              title="Select a saved Poppy prompt"
            >
              Select
            </button>
          </div>

          <button
            type="button"
            className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 hover:bg-slate-50 transition-colors"
            onClick={() => actions.onOpenPromptModal("emphasis")}
            title="Edit Text Styling Prompt"
          >
            <div className="text-xs font-semibold text-slate-700">Text Styling Prompt</div>
            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
              {templateTypeEmphasisPromptPreviewLine || "Click to edit..."}
            </div>
          </button>

          {templateTypeId === "enhanced" && (
            <button
              type="button"
              className="w-full text-left rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 hover:bg-slate-50 transition-colors"
              onClick={() => actions.onOpenPromptModal("image")}
              title="Edit Image Generation Prompt"
            >
              <div className="text-xs font-semibold text-slate-700">Image Generation Prompt</div>
              <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                {templateTypeImageGenPromptPreviewLine || "Click to edit..."}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Typography Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-slate-700 text-white text-xs font-bold flex items-center justify-center">Aa</span>
          <span className="text-sm font-semibold text-slate-900">Typography (Global)</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Headline Font</div>
            <select
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
              value={headlineFontKey}
              onChange={(e) => actions.onChangeHeadlineFontKey(e.target.value || "")}
            >
              {fontOptions.map((o) => (
                <option key={`${o.family}@@${o.weight}`} value={`${o.family}@@${o.weight}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Body Font</div>
            <select
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm"
              value={bodyFontKey}
              onChange={(e) => actions.onChangeBodyFontKey(e.target.value || "")}
            >
              {fontOptions.map((o) => (
                <option key={`${o.family}@@${o.weight}`} value={`${o.family}@@${o.weight}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Colors Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 text-white text-sm flex items-center justify-center">🖌️</span>
          <span className="text-sm font-semibold text-slate-900">Colors</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Theme</div>
            <div className="flex items-center gap-2">
              <select
                className="flex-1 h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm disabled:opacity-50"
                value={(() => {
                  const tid = String((themeIdLastApplied as any) || "").trim();
                  const isCustom = !tid || !!themeIsCustomized || !projectBackgroundEffectEnabled;
                  return isCustom ? "custom" : tid;
                })()}
                onChange={(e) => {
                  const v = e.target.value === "n8n_dots_dark" ? "n8n_dots_dark" : "custom";
                  actions.onSelectTheme(v as any);
                }}
                disabled={loading || switchingSlides}
                aria-label="Theme"
                title="Apply a theme preset (then tweak with Custom)"
              >
                <option value="custom">Custom</option>
                <option value="n8n_dots_dark">n8n Dots (Dark)</option>
              </select>
              {themeIdLastApplied ? (
                <button
                  type="button"
                  className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => actions.onResetThemeDefaults()}
                  disabled={loading || switchingSlides}
                  title="Reset to the selected theme’s default settings"
                >
                  Reset
                </button>
              ) : null}
            </div>
            {themeIdLastApplied && themeIsCustomized ? (
              <div className="mt-1 text-[11px] text-slate-500">
                Custom (from {String(themeIdLastApplied) === "n8n_dots_dark" ? "n8n Dots (Dark)" : String(themeIdLastApplied)})
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Effect</div>
            <select
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 bg-white shadow-sm disabled:opacity-50"
              value={String(projectBackgroundEffectType || "none") === "dots_n8n" ? "dots_n8n" : "none"}
              onChange={(e) => {
                const v = e.target.value === "dots_n8n" ? "dots_n8n" : "none";
                actions.onChangeBackgroundEffectType(v as any);
              }}
              disabled={loading || switchingSlides}
              aria-label="Effect"
              title="Controls the slide canvas background effect (project-wide)"
            >
              <option value="none">None</option>
              <option value="dots_n8n">Dots (n8n)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Canvas base</div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                  value={projectBackgroundColor || "#ffffff"}
                  onChange={(e) => actions.onChangeBackgroundColor(e.target.value)}
                  disabled={loading || switchingSlides}
                  aria-label="Canvas base color"
                />
                <div className="text-xs text-slate-600 tabular-nums">{projectBackgroundColor || "#ffffff"}</div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Text</div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer"
                  value={projectTextColor || "#000000"}
                  onChange={(e) => actions.onChangeTextColor(e.target.value)}
                  disabled={loading || switchingSlides}
                  aria-label="Text color"
                />
                <div className="text-xs text-slate-600 tabular-nums">{projectTextColor || "#000000"}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
            onClick={actions.onOpenIdeasModal}
            disabled={switchingSlides}
            title="Generate topic ideas from Poppy"
          >
            💡 Generate Ideas
          </button>
        </div>
      </div>
    </div>
  );
}

