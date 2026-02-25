"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, useAuth } from "@/app/components/auth/AuthContext";

type Category = { id: string; name: string };

function derivePlatform(urlRaw: string): string {
  const raw = String(urlRaw || "").trim();
  if (!raw) return "unknown";
  try {
    const u = new URL(raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`);
    const h = String(u.hostname || "").toLowerCase();
    if (h.includes("instagram.com")) return "instagram";
    if (h.includes("tiktok.com")) return "tiktok";
    if (h.includes("youtube.com") || h.includes("youtu.be")) return "youtube";
    if (h === "x.com" || h.includes("twitter.com")) return "x";
    return "web";
  } catch {
    return "unknown";
  }
}

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

export default function SwipeFileCapturePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();

  const urlFromQuery = useMemo(() => {
    const raw = sp?.get("url") || "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [sp]);

  const [isSuperadmin, setIsSuperadmin] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");

  const [url, setUrl] = useState<string>(urlFromQuery);
  const [tags, setTags] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("");

  const platform = useMemo(() => derivePlatform(url), [url]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setUrl(urlFromQuery);
  }, [urlFromQuery]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing auth token");
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
        const res = await fetch("/api/editor/accounts/me", { method: "GET", headers });
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !j?.success) {
          setIsSuperadmin(false);
          return;
        }
        setIsSuperadmin(!!j.isSuperadmin);
      } catch {
        if (!cancelled) setIsSuperadmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const loadCategories = async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch("/api/swipe-file/categories", { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load categories (${res.status})`));
      const rows: Category[] = Array.isArray(j.categories) ? j.categories.map((c: any) => ({ id: String(c.id), name: String(c.name || "") })) : [];
      setCategories(rows);
      if (!categoryId) setCategoryId(rows[0]?.id || "");
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load categories"));
    }
  };

  useEffect(() => {
    if (isSuperadmin !== true) return;
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin]);

  const onAddCategory = async () => {
    const name = String(newCategory || "").trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch("/api/swipe-file/categories", { method: "POST", headers, body: JSON.stringify({ name }) });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to add category (${res.status})`));
      const rows: Category[] = Array.isArray(j.categories) ? j.categories.map((c: any) => ({ id: String(c.id), name: String(c.name || "") })) : [];
      setCategories(rows);
      const created = rows.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (created?.id) setCategoryId(created.id);
      setNewCategory("");
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to add category"));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      if (!String(url || "").trim()) throw new Error("URL is required");
      if (!String(categoryId || "").trim()) throw new Error("Category is required");

      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch("/api/swipe-file/items", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: String(url || "").trim(),
          categoryId,
          tags,
          note: String(note || "").trim() || null,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Save failed (${res.status})`));
      setSuccess(true);
    } catch (e: any) {
      setError(String(e?.message || e || "Save failed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-sm text-gray-700">Loading…</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-sm text-gray-700">Redirecting…</div>
      </main>
    );
  }

  if (isSuperadmin === false) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="text-lg font-semibold text-slate-900">Swipe File</div>
          <div className="mt-2 text-sm text-slate-600">Access denied.</div>
        </div>
      </main>
    );
  }

  if (isSuperadmin === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-sm text-gray-700">Checking access…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-base font-semibold text-slate-900">Save to Swipe File</div>
          <div className="mt-1 text-xs text-slate-500">Fast capture — enrichment happens later on desktop.</div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error ? <div className="text-sm text-red-600">❌ {error}</div> : null}
          {success ? <div className="text-sm text-emerald-700 font-medium">Saved ✓</div> : null}

          <div>
            <div className="text-xs font-semibold text-slate-700">URL</div>
            <input
              className="mt-2 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste link…"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <div className="mt-1 text-[11px] text-slate-500">
              Platform detected: <span className="font-semibold text-slate-700">{platform}</span>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700">Category (required)</div>
            <select
              className="mt-2 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={busy}
            >
              {categories.length === 0 ? <option value="">Loading…</option> : null}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-2">
              <input
                className="flex-1 h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="+ New category (optional)"
                disabled={busy}
              />
              <button
                type="button"
                className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                onClick={() => void onAddCategory()}
                disabled={busy || !String(newCategory || "").trim()}
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700">Angle / Notes (optional)</div>
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What do you like about this? What angle to use?"
              disabled={busy}
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700">Tags (optional)</div>
            <input
              className="mt-2 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comma,separated,tags"
              disabled={busy}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <button
            type="button"
            className="w-full h-11 rounded-lg bg-black text-white text-sm font-semibold shadow-md hover:shadow-lg transition-shadow disabled:opacity-50"
            onClick={() => void onSubmit()}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="text-sm text-slate-700 underline"
              onClick={() => {
                setUrl("");
                setNote("");
                setTags("");
                setSuccess(false);
              }}
              disabled={busy}
            >
              Save another
            </button>
            <button
              type="button"
              className="text-sm text-slate-700 underline"
              onClick={() => router.push("/editor")}
              disabled={busy}
              title="Open the editor (Swipe File is available from the top bar)"
            >
              Open editor
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

