"use client";

import { useEffect, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";
import { supabase } from "@/app/components/auth/AuthContext";

function safeTrim(s: string) {
  return String(s || "").trim();
}

export function DeleteAccountModal() {
  const open = useEditorSelector((s: any) => !!(s as any).deleteAccountModalOpen);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const [activeAccountId, setActiveAccountId] = useState<string>("");
  const [activeAccountName, setActiveAccountName] = useState<string>("");
  const [availableAccounts, setAvailableAccounts] = useState<Array<{ accountId: string; displayName: string; role: string }>>([]);
  const [confirmText, setConfirmText] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setConfirmText("");
    setBusy(false);
    setError(null);
    setDeleted(false);
    const id = (() => {
      try {
        return typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
      } catch {
        return "";
      }
    })();
    setActiveAccountId(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadAccounts() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token || "";
        if (!token) return;

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
        if (!res.ok || !j?.success) return;

        const accts = Array.isArray(j.accounts) ? j.accounts : [];
        const next = accts
          .map((a: any) => ({
            accountId: String(a?.accountId || "").trim(),
            displayName: String(a?.displayName || "").trim(),
            role: String(a?.role || "").trim(),
          }))
          .filter((a: any) => a.accountId && a.displayName);
        setAvailableAccounts(next);
        const name = next.find((a: { accountId: string; displayName: string }) => a.accountId === rawActive)?.displayName || "";
        setActiveAccountName(name);
      } catch {
        // ignore
      }
    }
    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const close = () => {
    if (busy) return;
    actions?.onCloseDeleteAccountModal?.();
  };

  const canDelete = !busy && !deleted && safeTrim(activeAccountId) && safeTrim(confirmText) === "DELETE";

  const onDelete = async () => {
    if (!canDelete) return;
    setError(null);
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "";
      if (!token) {
        setError("Not authenticated.");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/editor/accounts/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(activeAccountId ? { "x-account-id": activeAccountId } : {}),
        },
        body: JSON.stringify({ accountId: activeAccountId, confirmText }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) {
        setError(String(j?.error || "Failed to delete account"));
        setBusy(false);
        return;
      }
      setDeleted(true);
      setBusy(false);

      // Pick a fallback account, preferring an owner Personal account.
      const personal =
        availableAccounts.find(
          (a) =>
            a.accountId !== activeAccountId &&
            String(a.role || "") === "owner" &&
            String(a.displayName || "").toLowerCase().includes("(personal)")
        )?.accountId || "";
      const fallback = personal || availableAccounts.find((a) => a.accountId !== activeAccountId)?.accountId || "";
      if (fallback) {
        try {
          localStorage.setItem("editor.activeAccountId", fallback);
        } catch {
          // ignore
        }
      } else {
        try {
          localStorage.removeItem("editor.activeAccountId");
        } catch {
          // ignore
        }
      }

      window.location.reload();
    } catch (e: any) {
      setError(String(e?.message || "Failed to delete account"));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[121] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">Delete Account</div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={close}
            disabled={busy}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            This permanently deletes the account’s editor workspace data (projects, templates, recents, ideas, prompts/settings).
          </div>

          <div className="mt-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">Current account</div>
            {activeAccountName ? <div className="mt-1 text-sm text-slate-800">{activeAccountName}</div> : null}
            <div className="mt-1 font-mono text-xs text-slate-700 break-all">
              {safeTrim(activeAccountId) || "(no active account id found)"}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-900">Type DELETE to confirm</div>
            <input
              className="mt-2 w-full h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 bg-white"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={busy || deleted}
            />
          </div>

          {error ? <div className="mt-3 text-sm text-red-600">❌ {error}</div> : null}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm shadow-sm"
            onClick={close}
            disabled={busy}
          >
            Close
          </button>
          <button
            type="button"
            className="h-9 px-3 rounded-md bg-red-600 text-white text-sm shadow-sm disabled:opacity-50"
            disabled={!canDelete}
            onClick={() => void onDelete()}
            title="Delete this account"
          >
            {busy ? "Deleting…" : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

