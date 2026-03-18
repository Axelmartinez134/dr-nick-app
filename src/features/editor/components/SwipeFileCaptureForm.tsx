"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";

export type SwipeFileCaptureCategory = { id: string; name: string };

export type SwipeFileCaptureItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  platform: string;
  status: string;
  categoryId: string;
  tags: string[];
  note: string | null;
  enrichStatus: string;
  enrichError: string | null;
  enrichedAt: string | null;
  caption: string | null;
  transcript: string | null;
  authorHandle: string | null;
  title: string | null;
  thumbUrl: string | null;
  createdProjectId: string | null;
};

type SwipeFileCaptureFormProps = {
  mode: "authed" | "public";
  variant?: "link" | "freestyle";
  publicKey?: string;
  initialUrl?: string;
  initialCategoryId?: string;
  autoSelectFirstCategory?: boolean;
  showPasteButton?: boolean;
  secondaryActionLabel?: string;
  secondaryActionTitle?: string;
  onSecondaryAction?: () => void;
  onSaved?: (items: SwipeFileCaptureItem[]) => void;
  autoCloseAfterSuccessMs?: number | null;
  onRequestClose?: () => void;
};

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

function mapItems(rows: any): SwipeFileCaptureItem[] {
  return Array.isArray(rows)
    ? rows.map((r: any) => ({
        id: String(r.id || ""),
        createdAt: String(r.createdAt || r.created_at || ""),
        updatedAt: String(r.updatedAt || r.updated_at || ""),
        url: String(r.url || ""),
        platform: String(r.platform || "unknown"),
        status: String(r.status || "new"),
        categoryId: String(r.categoryId || r.category_id || ""),
        tags: Array.isArray(r.tags) ? (r.tags as any[]).map((t) => String(t || "").trim()).filter(Boolean) : [],
        note: typeof r.note === "string" ? r.note : r.note ?? null,
        enrichStatus: String(r.enrichStatus || r.enrich_status || "idle"),
        enrichError: typeof r.enrichError === "string" ? r.enrichError : r.enrich_error ?? null,
        enrichedAt: typeof r.enrichedAt === "string" ? r.enrichedAt : r.enriched_at ?? null,
        caption: typeof r.caption === "string" ? r.caption : r.caption ?? null,
        transcript: typeof r.transcript === "string" ? r.transcript : r.transcript ?? null,
        authorHandle: typeof r.authorHandle === "string" ? r.authorHandle : r.author_handle ?? null,
        title: typeof r.title === "string" ? r.title : r.title ?? null,
        thumbUrl: typeof r.thumbUrl === "string" ? r.thumbUrl : r.thumb_url ?? null,
        createdProjectId:
          typeof r.createdProjectId === "string" ? r.createdProjectId : r.created_project_id ?? null,
      }))
    : [];
}

export function SwipeFileCaptureForm({
  mode,
  variant = "link",
  publicKey,
  initialUrl = "",
  initialCategoryId = "",
  autoSelectFirstCategory = true,
  showPasteButton = true,
  secondaryActionLabel,
  secondaryActionTitle,
  onSecondaryAction,
  onSaved,
  autoCloseAfterSuccessMs = null,
  onRequestClose,
}: SwipeFileCaptureFormProps) {
  const [categories, setCategories] = useState<SwipeFileCaptureCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [url, setUrl] = useState<string>(initialUrl);
  const [title, setTitle] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const successCloseTimeoutRef = useRef<number | null>(null);

  const freestyleMode = variant === "freestyle";
  const platform = useMemo(() => (freestyleMode ? "freestyle" : derivePlatform(url)), [freestyleMode, url]);
  const publicMode = mode === "public";

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    setCategoryId(initialCategoryId);
  }, [initialCategoryId]);

  useEffect(() => {
    return () => {
      if (successCloseTimeoutRef.current) {
        window.clearTimeout(successCloseTimeoutRef.current);
      }
    };
  }, []);

  const loadCategories = async () => {
    setError(null);
    try {
      if (publicMode) {
        const res = await fetch(`/api/swipe-file/public/categories?k=${encodeURIComponent(String(publicKey || "").trim())}`, {
          method: "GET",
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load categories (${res.status})`));
        const rows: SwipeFileCaptureCategory[] = Array.isArray(j.categories)
          ? j.categories.map((c: any) => ({ id: String(c.id), name: String(c.name || "") }))
          : [];
        setCategories(rows);
        setCategoryId((prev) => {
          if (prev && rows.some((c) => c.id === prev)) return prev;
          if (initialCategoryId && rows.some((c) => c.id === initialCategoryId)) return initialCategoryId;
          return autoSelectFirstCategory ? rows[0]?.id || "" : "";
        });
        return;
      }

      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch("/api/swipe-file/categories", { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load categories (${res.status})`));
      const rows: SwipeFileCaptureCategory[] = Array.isArray(j.categories)
        ? j.categories.map((c: any) => ({ id: String(c.id), name: String(c.name || "") }))
        : [];
      setCategories(rows);
      setCategoryId((prev) => {
        if (prev && rows.some((c) => c.id === prev)) return prev;
        if (initialCategoryId && rows.some((c) => c.id === initialCategoryId)) return initialCategoryId;
        return autoSelectFirstCategory ? rows[0]?.id || "" : "";
      });
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load categories"));
    }
  };

  useEffect(() => {
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicMode, publicKey]);

  const onAddCategory = async () => {
    const name = String(newCategory || "").trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      if (publicMode) {
        const res = await fetch("/api/swipe-file/public/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ k: String(publicKey || "").trim(), name }),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to add category (${res.status})`));
        const rows: SwipeFileCaptureCategory[] = Array.isArray(j.categories)
          ? j.categories.map((c: any) => ({ id: String(c.id), name: String(c.name || "") }))
          : [];
        setCategories(rows);
        const created = rows.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (created?.id) setCategoryId(created.id);
        setNewCategory("");
        return;
      }

      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch("/api/swipe-file/categories", { method: "POST", headers, body: JSON.stringify({ name }) });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to add category (${res.status})`));
      const rows: SwipeFileCaptureCategory[] = Array.isArray(j.categories)
        ? j.categories.map((c: any) => ({ id: String(c.id), name: String(c.name || "") }))
        : [];
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
      if (freestyleMode) {
        const titleTrim = String(title || "").trim();
        const noteTrim = String(note || "").trim();
        if (!titleTrim) throw new Error("Title is required");
        if (!noteTrim) throw new Error("Angle / Notes is required");
        if (noteTrim.length < 1) throw new Error("Angle / Notes must be at least 1 character");
        if (noteTrim.length > 25_000) throw new Error("Angle / Notes must be 25,000 characters or fewer");
      } else if (!String(url || "").trim()) {
        throw new Error("URL is required");
      }
      if (!String(categoryId || "").trim()) throw new Error("Category is required");

      const payload = {
        url: freestyleMode ? null : String(url || "").trim(),
        categoryId,
        tags,
        note: String(note || "").trim() || null,
        title: freestyleMode ? String(title || "").trim() || null : null,
        platform: freestyleMode ? "freestyle" : null,
      };

      const res = publicMode
        ? await fetch("/api/swipe-file/public/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ k: String(publicKey || "").trim(), ...payload }),
          })
        : await (async () => {
            const token = await getToken();
            if (!token) throw new Error("Missing auth token");
            const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
            return await fetch("/api/swipe-file/items", { method: "POST", headers, body: JSON.stringify(payload) });
          })();
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Save failed (${res.status})`));

      const nextItems = mapItems(j.items);
      setSuccess(true);
      onSaved?.(nextItems);

      if (successCloseTimeoutRef.current) {
        window.clearTimeout(successCloseTimeoutRef.current);
        successCloseTimeoutRef.current = null;
      }
      if (autoCloseAfterSuccessMs && onRequestClose) {
        successCloseTimeoutRef.current = window.setTimeout(() => {
          onRequestClose();
        }, autoCloseAfterSuccessMs);
      }
    } catch (e: any) {
      setError(String(e?.message || e || "Save failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 py-4 space-y-3">
      {error ? <div className="text-sm text-red-600">❌ {error}</div> : null}

      <div>
        {freestyleMode ? (
          <>
            <div className="text-xs font-semibold text-slate-700">Title (required)</div>
            <input
              className="mt-2 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Type the swipe title…"
              disabled={busy}
            />
            <div className="mt-1 text-[11px] text-slate-500">
              Item type: <span className="font-semibold text-slate-700">{platform}</span>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold text-slate-700">URL</div>
            <div className="mt-2 relative">
              <input
                className={[
                  "w-full h-11 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 shadow-sm",
                  showPasteButton ? "pl-3 pr-20" : "px-3",
                ].join(" ")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste link…"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {showPasteButton ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={busy}
                  onClick={async () => {
                    setError(null);
                    try {
                      const text = typeof navigator !== "undefined" && navigator.clipboard ? await navigator.clipboard.readText() : "";
                      const next = String(text || "").trim();
                      if (!next) throw new Error("Clipboard is empty");
                      setUrl(next);
                    } catch {
                      setError("Couldn’t read clipboard. Try pasting manually, or allow clipboard access.");
                    }
                  }}
                  title="Paste from clipboard"
                >
                  Paste
                </button>
              ) : null}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Platform detected: <span className="font-semibold text-slate-700">{platform}</span>
            </div>
          </>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-700">Category (required)</div>
        <select
          className="mt-2 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={busy}
        >
          <option value="">{categories.length === 0 ? "Loading…" : "Select a category"}</option>
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
        <div className="text-xs font-semibold text-slate-700">
          Angle / Notes {freestyleMode ? "(required)" : "(optional)"}
        </div>
        <textarea
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          rows={freestyleMode ? 8 : 3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={freestyleMode ? "Talk or type freely here…" : "What do you like about this? What angle to use?"}
          disabled={busy}
        />
        {freestyleMode ? (
          <div className="mt-1 text-[11px] text-slate-500">{String(note || "").length}/25,000 characters</div>
        ) : null}
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
        {busy ? "Saving…" : success ? "Saved ✓" : "Save"}
      </button>
      {success && !busy ? <div className="text-sm text-emerald-700 font-medium text-center">Saved ✓</div> : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-sm text-slate-700 underline"
          onClick={() => {
            setTitle("");
            setUrl("");
            setNote("");
            setTags("");
            setSuccess(false);
            setError(null);
          }}
          disabled={busy}
        >
          Save another
        </button>
        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            className="text-sm text-slate-700 underline"
            onClick={onSecondaryAction}
            disabled={busy}
            title={secondaryActionTitle}
          >
            {secondaryActionLabel}
          </button>
        ) : <span />}
      </div>
    </div>
  );
}
