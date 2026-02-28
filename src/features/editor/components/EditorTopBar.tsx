/* eslint-disable react/no-unstable-nested-components */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";
import { supabase, useAuth } from "@/app/components/auth/AuthContext";

export function EditorTopBar() {
  const { user } = useAuth();
  const titleText = useEditorSelector((s) => s.titleText);
  const projectTitleValue = useEditorSelector((s) => s.projectTitle);
  const projectTitleDisabled = useEditorSelector((s) => s.projectTitleDisabled);
  const isMobile = useEditorSelector((s) => s.isMobile);
  const topExporting = useEditorSelector((s) => s.topExporting);

  const promptSaveStatus = useEditorSelector((s) => s.promptSaveStatus);
  const projectSaveStatus = useEditorSelector((s) => s.projectSaveStatus);
  const slideSaveStatus = useEditorSelector((s) => s.slideSaveStatus);
  const actions = useEditorSelector((s) => s.actions);

  const [editorFirstName, setEditorFirstName] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<{ accountId: string; displayName: string; role: string }>>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>("");
  const [isSuperadmin, setIsSuperadmin] = useState<boolean>(false);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false);

  const [mobileRenameOpen, setMobileRenameOpen] = useState<boolean>(false);
  const [mobileRenameDraft, setMobileRenameDraft] = useState<string>("");
  const mobileTitleRef = useRef<HTMLDivElement | null>(null);
  const [mobileTitleFontPx, setMobileTitleFontPx] = useState<number>(14);

  // Keep the editor store's superadmin flag in sync with the top-bar auth context.
  // Important: `actions` may be a noop object on first render, so this must re-run when `actions` updates.
  useEffect(() => {
    try {
      actions?.setIsSuperadmin?.(!!isSuperadmin);
    } catch {
      // ignore
    }
  }, [actions, isSuperadmin]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountMenuOpen(false);
    };
    const onMouseDown = () => {
      // Best-effort close; menu item handlers preventDefault.
      setAccountMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadName() {
      const userId = user?.id;
      if (!userId) {
        setEditorFirstName(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("editor_users")
          .select("first_name")
          .eq("user_id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setEditorFirstName(null);
          return;
        }
        const raw = (data as any)?.first_name;
        const cleaned = typeof raw === "string" ? raw.trim() : "";
        setEditorFirstName(cleaned || null);
      } catch {
        if (cancelled) return;
        setEditorFirstName(null);
      }
    }

    void loadName();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadAccountContext() {
      const userId = user?.id;
      if (!userId) {
        setAccounts([]);
        setActiveAccountId("");
        setIsSuperadmin(false);
        setAccountsLoading(false);
        return;
      }

      setAccountsLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token || "";
        if (!token) {
          if (cancelled) return;
          setAccounts([]);
          setActiveAccountId("");
          setIsSuperadmin(false);
          setAccountsLoading(false);
          return;
        }

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
          setAccounts([]);
          setActiveAccountId("");
          setIsSuperadmin(false);
          setAccountsLoading(false);
          return;
        }

        const nextAccounts = Array.isArray(j.accounts) ? j.accounts : [];
        const nextActive = String(j.activeAccountId || "").trim();
        setAccounts(nextAccounts);
        setActiveAccountId(nextActive);
        setIsSuperadmin(!!j.isSuperadmin);
        setAccountsLoading(false);

        // Keep localStorage aligned with resolved account so subsequent requests are consistent.
        if (nextActive) {
          try {
            localStorage.setItem("editor.activeAccountId", nextActive);
          } catch {
            // ignore
          }
        }
      } catch {
        if (cancelled) return;
        setAccounts([]);
        setActiveAccountId("");
        setIsSuperadmin(false);
        setAccountsLoading(false);
      }
    }

    void loadAccountContext();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const welcomeText = useMemo(() => {
    return editorFirstName ? `Welcome, ${editorFirstName}` : "Welcome";
  }, [editorFirstName]);

  useEffect(() => {
    if (!isMobile) return;
    // Fit-to-space behavior: shrink from 14px down to 12px if needed.
    // If still too long, we allow truncation (3 lines max).
    const el = mobileTitleRef.current;
    if (!el) return;

    const raf = window.requestAnimationFrame(() => {
      try {
        let size = 14;
        const min = 12;
        // Try a few steps max; keeps it lightweight.
        for (let i = 0; i < 4; i++) {
          el.style.fontSize = `${size}px`;
          // Force reflow for accurate measures.
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          el.offsetHeight;
          const overflowY = el.scrollHeight > el.clientHeight + 1;
          const overflowX = el.scrollWidth > el.clientWidth + 1;
          if (!overflowY && !overflowX) break;
          if (size <= min) break;
          size = Math.max(min, size - 1);
        }
        setMobileTitleFontPx(size);
      } catch {
        setMobileTitleFontPx(12);
      }
    });

    return () => window.cancelAnimationFrame(raf);
  }, [isMobile, projectTitleValue, isSuperadmin, topExporting]);

  useEffect(() => {
    if (!isMobile) return;
    if (!mobileRenameOpen) return;
    setMobileRenameDraft(String(projectTitleValue || ""));
  }, [isMobile, mobileRenameOpen, projectTitleValue]);

  const PromptStatusPill = () => {
    if (promptSaveStatus === "idle") return null;
    const base = "px-3 py-1 rounded-full text-xs font-semibold border";
    if (promptSaveStatus === "saving") {
      return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Poppy Prompt: Saving…</span>;
    }
    if (promptSaveStatus === "saved") {
      return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Poppy Prompt: Saved ✓</span>;
    }
    return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Poppy Prompt: Save Failed</span>;
  };

  const ProjectStatusPill = () => {
    if (projectSaveStatus === "idle" && slideSaveStatus === "idle") return null;
    const base = "px-3 py-1 rounded-full text-xs font-semibold border";
    const status =
      projectSaveStatus === "saving" || slideSaveStatus === "saving"
        ? "saving"
        : projectSaveStatus === "error" || slideSaveStatus === "error"
          ? "error"
          : projectSaveStatus === "saved" || slideSaveStatus === "saved"
            ? "saved"
            : "idle";
    if (status === "saving") return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Saving…</span>;
    if (status === "saved") return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Saved ✓</span>;
    if (status === "error") return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Save Failed</span>;
    return null;
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white select-none">
          🎠
        </div>
        {!isMobile ? (
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{titleText}</div>
            <div className="text-sm text-slate-600 whitespace-nowrap">{welcomeText}</div>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            {isSuperadmin ? (
              <button
                type="button"
                className="h-10 px-3 rounded-md bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800"
                onClick={actions?.onOpenSwipeFileModal}
                title="Open Swipe File"
              >
                Swipe File
              </button>
            ) : (
              <div className="text-sm font-semibold text-slate-900 truncate">{titleText}</div>
            )}
          </div>
        )}
      </div>

      {/* Mobile: show carousel name (3 lines max, shrink-to-fit, tap to rename) */}
      {isMobile ? (
        <div className="flex-1 min-w-0 px-1">
          <button
            type="button"
            className="w-full h-12 px-2 rounded-md border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            onClick={() => setMobileRenameOpen(true)}
            disabled={projectTitleDisabled}
            title={projectTitleValue || "Untitled Project"}
            aria-label="Rename carousel"
          >
            <div
              ref={mobileTitleRef}
              className="w-full text-left leading-4 overflow-hidden"
              style={{
                fontSize: `${mobileTitleFontPx}px`,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical" as any,
                WebkitLineClamp: 3 as any,
                wordBreak: "break-word",
              }}
            >
              {projectTitleValue || "Untitled Project"}
            </div>
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-2 min-w-0 shrink-0 ml-auto">
        {!isMobile && isSuperadmin ? (
          <button
            onClick={actions?.onOpenOutreachModal}
            className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm transition-colors"
            title="Outreach (superadmin)"
            type="button"
          >
            Outreach
          </button>
        ) : null}
        {!isMobile && isSuperadmin ? (
          <button
            onClick={actions?.onOpenSwipeFileModal}
            className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm transition-colors"
            title="Swipe File (superadmin)"
            type="button"
          >
            Swipe File
          </button>
        ) : null}
        {!isMobile && isSuperadmin && accounts.length > 0 ? (
          <div className="flex items-center gap-2 relative">
            <div className="text-xs font-semibold text-slate-600 whitespace-nowrap">Account</div>
            <select
              className="h-9 max-w-[220px] rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm"
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
                // Hard reload so the editor bootstraps cleanly under the new account context.
                window.location.reload();
              }}
              title="Switch account"
              aria-label="Switch account"
            >
              {accounts.map((a: any) => (
                <option key={String(a.accountId)} value={String(a.accountId)}>
                  {String(a.displayName || "Account")}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm shadow-sm disabled:opacity-50"
              onMouseDown={(e) => {
                // Prevent the global menu close handler from immediately firing.
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => setAccountMenuOpen((v) => !v)}
              disabled={accountsLoading}
              title="Account settings"
              aria-label="Account settings"
            >
              ⚙️
            </button>

            {accountMenuOpen ? (
              <div
                className="absolute right-0 top-11 w-64 rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden z-50"
                onMouseDown={(e) => {
                  // Keep menu open for internal clicks (items will close manually).
                  e.stopPropagation();
                }}
              >
                <div className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-100">
                  Account actions
                </div>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-slate-50"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    actions?.onOpenCreateAccountModal?.();
                  }}
                >
                  + New Account
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    actions?.onOpenDeleteAccountModal?.();
                  }}
                >
                  Delete current account…
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {!isMobile ? (
          <input
            className="h-9 w-[320px] max-w-[40vw] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
            value={projectTitleValue}
            onChange={(e) => actions.onChangeProjectTitle(e.target.value)}
            placeholder="Untitled Project"
            disabled={projectTitleDisabled}
            title="Project title"
          />
        ) : null}
        {!isMobile ? (
          <>
            <ProjectStatusPill />
            <PromptStatusPill />
          </>
        ) : null}
        {!isMobile ? (
          <>
            <button
              className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
              onClick={actions.onDownloadAll}
              disabled={topExporting}
              title="Download all 6 slides as a ZIP"
            >
              {topExporting ? "Preparing..." : "Download All"}
            </button>
            <button
              className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
              onClick={actions.onDownloadPdf}
              disabled={topExporting}
              title="Download all 6 slides as a PDF"
            >
              {topExporting ? "Preparing..." : "Download PDF"}
            </button>
            {isSuperadmin ? (
              <button
                className="px-3 py-1.5 rounded-md bg-black text-white text-sm shadow-sm disabled:opacity-50"
                onClick={actions.onOpenShareCarousels}
                disabled={topExporting}
                title="Share carousels for client review"
              >
                Share carousels
              </button>
            ) : null}
          </>
        ) : null}
        {isMobile && isSuperadmin ? (
          <button
            className="h-10 px-3 rounded-md bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-50"
            onClick={actions.onOpenShareCarousels}
            disabled={topExporting}
            title="Open review queue and share link"
            aria-label="Open share carousels"
            type="button"
          >
            Share
          </button>
        ) : null}
        <button
          onClick={actions.onSignOut}
          className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm transition-colors"
          title="Sign out"
        >
          Sign Out
        </button>
      </div>

      {/* Mobile rename sheet */}
      {isMobile && mobileRenameOpen ? (
        <div className="fixed inset-0 z-[90] bg-black/40" role="dialog" aria-modal="true">
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl border-t border-slate-200 shadow-2xl">
            <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">Rename carousel</div>
                <div className="mt-0.5 text-xs text-slate-600">This updates the title for this carousel project.</div>
              </div>
              <button
                type="button"
                className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-sm font-semibold"
                onClick={() => setMobileRenameOpen(false)}
                aria-label="Close rename"
              >
                Close
              </button>
            </div>

            <div className="px-5 pb-4">
              <input
                className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm"
                value={mobileRenameDraft}
                onChange={(e) => setMobileRenameDraft(e.target.value)}
                placeholder="Untitled Project"
                autoFocus
                inputMode="text"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="flex-1 h-12 rounded-xl bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                  onClick={() => {
                    actions?.onChangeProjectTitle?.(String(mobileRenameDraft || ""));
                    setMobileRenameOpen(false);
                  }}
                  disabled={projectTitleDisabled}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="h-12 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold shadow-sm hover:bg-slate-50"
                  onClick={() => setMobileRenameOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="pb-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      ) : null}
    </header>
  );
}

