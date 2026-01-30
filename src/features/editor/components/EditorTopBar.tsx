/* eslint-disable react/no-unstable-nested-components */
"use client";

import { useEffect, useMemo, useState } from "react";
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
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white select-none">
          🎠
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{titleText}</div>
          <div className="text-sm text-slate-600 whitespace-nowrap">{welcomeText}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        {isSuperadmin && accounts.length > 0 ? (
          <div className="flex items-center gap-2">
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
          </div>
        ) : null}
        <input
          className="h-9 w-[320px] max-w-[40vw] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
          value={projectTitleValue}
          onChange={(e) => actions.onChangeProjectTitle(e.target.value)}
          placeholder="Untitled Project"
          disabled={projectTitleDisabled}
          title="Project title"
        />
        <ProjectStatusPill />
        <PromptStatusPill />
        {!isMobile ? (
          <button
            className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
            onClick={actions.onDownloadAll}
            disabled={topExporting}
            title="Download all 6 slides as a ZIP"
          >
            {topExporting ? "Preparing..." : "Download All"}
          </button>
        ) : (
          <button
            className="px-3 py-1.5 rounded-md bg-[#6D28D9] text-white text-sm shadow-sm disabled:opacity-50"
            onClick={actions.onShareAll}
            disabled={topExporting}
            title="Download all slides (saves to Photos when supported)"
          >
            {topExporting ? "Preparing..." : "Download All"}
          </button>
        )}
        <button
          onClick={actions.onSignOut}
          className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm transition-colors"
          title="Sign out"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}

