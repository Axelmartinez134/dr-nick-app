"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";

type RecentAsset = {
  id: string;
  url: string;
  storage_bucket: string | null;
  storage_path: string | null;
  kind: string;
  last_used_at: string;
  use_count: number;
};

type LogoProvider = "vectorlogozone" | "lobe-icons" | "developer-icons" | "svgporn" | "gilbarbara" | "simple-icons";

type LogoVariantTile = {
  source: LogoProvider;
  sourceKey: string;
  title: string;
  websiteDomain: string | null;
  tags: string[];
  variantKey: string;
  remoteUrl: string;
  format: "svg" | "other";
};

export function ImageLibraryModal() {
  const open = useEditorSelector((s: any) => !!(s as any).imageLibraryModalOpen);
  const bgRemovalEnabledAtInsert = useEditorSelector((s: any) => !!(s as any).imageLibraryBgRemovalEnabledAtInsert);
  const refs = useEditorSelector((s: any) => (s as any).workspaceRefs);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const imageFileInputRef = (refs ? (refs as any).imageFileInputRef : null) || null;

  const [recents, setRecents] = useState<RecentAsset[]>([]);
  const [recentsLoading, setRecentsLoading] = useState(false);
  const [recentsError, setRecentsError] = useState<string | null>(null);
  const [insertingRecentId, setInsertingRecentId] = useState<string | null>(null);
  const [insertingLogoKey, setInsertingLogoKey] = useState<string | null>(null);
  const showSpinner = (!!insertingRecentId || !!insertingLogoKey) && !!bgRemovalEnabledAtInsert;

  // Phase 3C: Logos (read-only view mode)
  const [logoProvider, setLogoProvider] = useState<LogoProvider>("vectorlogozone");
  const [logoQuery, setLogoQuery] = useState("");
  const [logoSelectedTag, setLogoSelectedTag] = useState<string | null>(null);
  const [logoTags, setLogoTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [logoTagsLoading, setLogoTagsLoading] = useState(false);
  const [logoTiles, setLogoTiles] = useState<LogoVariantTile[]>([]);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [cachingLogoKey, setCachingLogoKey] = useState<string | null>(null);
  const [cachedLogoKeys, setCachedLogoKeys] = useState<Set<string>>(() => new Set());

  const canInteract = useMemo(() => !showSpinner, [showSpinner]);
  const topLogoTags = useMemo(() => logoTags.slice(0, 12), [logoTags]);
  const moreLogoTags = useMemo(() => logoTags.slice(12, 200), [logoTags]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setRecentsLoading(true);
      setRecentsError(null);
      try {
        const rows = (await actions?.fetchRecentAssets?.(30)) as RecentAsset[];
        if (!cancelled) setRecents(rows);
      } catch (e: any) {
        if (!cancelled) setRecentsError(String(e?.message || e || "Failed to load recents"));
      } finally {
        if (!cancelled) setRecentsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [actions, open]);

  // Load logo tags when modal opens (for tag chips + “More tags…” dropdown)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLogoTagsLoading(true);
      setLogoError(null);
      try {
        const tags = (await actions?.fetchLogoTags?.({ source: logoProvider, limit: 200 })) as Array<{ tag: string; count: number }>;
        if (!cancelled) setLogoTags(Array.isArray(tags) ? tags : []);
      } catch (e: any) {
        if (!cancelled) setLogoError(String(e?.message || e || "Failed to load logo tags"));
      } finally {
        if (!cancelled) setLogoTagsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [actions, logoProvider, open]);

  // Debounced search for logo tiles (read-only)
  useEffect(() => {
    if (!open) return;
    if (!actions?.searchLogoVariants) return;

    const q = String(logoQuery || "").trim();
    const tag = logoSelectedTag;
    // conservative: don’t query the whole catalog without a filter
    if (!q && !tag) {
      setLogoTiles([]);
      setLogoError(null);
      setLogoLoading(false);
      return;
    }

    let cancelled = false;
    setLogoLoading(true);
    setLogoError(null);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const tiles = (await actions.searchLogoVariants({
            source: logoProvider,
            q,
            tag,
            limit: 40,
          })) as LogoVariantTile[];
          if (!cancelled) setLogoTiles(Array.isArray(tiles) ? tiles : []);
        } catch (e: any) {
          if (!cancelled) setLogoError(String(e?.message || e || "Failed to search logos"));
        } finally {
          if (!cancelled) setLogoLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [actions, logoProvider, logoQuery, logoSelectedTag, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (canInteract) actions?.onCloseImageLibraryModal?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, canInteract, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (!canInteract) return;
        if (e.target === e.currentTarget) actions.onCloseImageLibraryModal?.();
      }}
    >
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="text-base font-semibold text-slate-900">Add image</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Upload a new image, or (soon) pick from recents and logos.
            </div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={actions.onCloseImageLibraryModal}
            disabled={!canInteract}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
          {/* Left: Sources */}
          <div className="border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/60 p-3">
            <div className="text-xs font-semibold text-slate-700 mb-2">Sources</div>
            <div className="space-y-1">
              <div className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-900">
                Upload
              </div>
              <div className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-500">
                Recents <span className="ml-1 text-[11px]">(coming soon)</span>
              </div>
              <div className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-500">
                Logos <span className="ml-1 text-[11px]">(coming soon)</span>
              </div>
            </div>
          </div>

          {/* Right: Upload panel */}
          <div className="p-5">
            {showSpinner ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Applying background removal…</div>
                <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
                  Working…
                </div>
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Upload</div>
                <div className="mt-0.5 text-xs text-slate-500">JPG, PNG, WebP (max 10MB)</div>
              </div>
              <button
                type="button"
                className="h-10 px-4 rounded-lg bg-[#6D28D9] text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                onClick={() => {
                  const el = imageFileInputRef?.current || null;
                  if (!el || typeof el.click !== "function") {
                    alert("Slides are still rendering. Please wait a moment and try again.");
                    return;
                  }
                  el.click();
                }}
                title="Choose a file to upload"
                disabled={!canInteract}
              >
                Choose file…
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Background removal</div>
                  <div className="text-xs text-slate-500">
                    Removes background on upload (best for photos). Turn off for logos/transparent images.
                  </div>
                </div>
                <button
                  type="button"
                  className={[
                    "h-8 w-14 rounded-full transition-colors",
                    bgRemovalEnabledAtInsert ? "bg-black" : "bg-slate-300",
                  ].join(" ")}
                  onClick={() => actions.onToggleImageLibraryBgRemovalAtInsert?.()}
                  title="Controls whether background removal runs when this image is first inserted"
                  disabled={!canInteract}
                >
                  <span
                    className={[
                      "block h-7 w-7 rounded-full bg-white shadow-sm translate-x-0 transition-transform",
                      bgRemovalEnabledAtInsert ? "translate-x-6" : "translate-x-1",
                    ].join(" ")}
                  />
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Default is Off and resets each time this modal opens.
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">Recents</div>
                  {recentsLoading ? <div className="text-xs text-slate-500">Loading…</div> : null}
                </div>
                {recentsError ? (
                  <div className="mt-2 text-xs text-red-600">{recentsError}</div>
                ) : null}
                {!recentsLoading && !recentsError && recents.length === 0 ? (
                  <div className="mt-2 text-xs text-slate-500">No recent images yet. Upload one to get started.</div>
                ) : null}
                {recents.length > 0 ? (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {recents.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="relative aspect-square rounded-md border border-slate-200 bg-slate-50 overflow-hidden hover:border-slate-300 disabled:opacity-50"
                        disabled={!canInteract || !!insertingRecentId}
                        onClick={async () => {
                          if (!actions?.onInsertRecentImage) return;
                          setRecentsError(null);
                          if (bgRemovalEnabledAtInsert) {
                            setInsertingRecentId(a.id);
                            try {
                              await actions.onInsertRecentImage(a);
                              actions.onCloseImageLibraryModal?.();
                            } catch (e: any) {
                              setRecentsError(String(e?.message || e || "Insert failed"));
                            } finally {
                              setInsertingRecentId(null);
                            }
                          } else {
                            try {
                              await actions.onInsertRecentImage(a);
                              actions.onCloseImageLibraryModal?.();
                            } catch (e: any) {
                              setRecentsError(String(e?.message || e || "Insert failed"));
                            }
                          }
                        }}
                        title="Insert this image"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt="" className="absolute inset-0 w-full h-full object-contain" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">Logos</div>
                  {logoTagsLoading ? <div className="text-xs text-slate-500">Loading tags…</div> : null}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                    value={logoProvider}
                    onChange={(e) => {
                      setLogoProvider((e.target.value as any) || "vectorlogozone");
                      setLogoSelectedTag(null);
                      setLogoQuery("");
                      setLogoTiles([]);
                      setLogoError(null);
                    }}
                    disabled={!canInteract}
                    title="Logo source"
                  >
                    <option value="vectorlogozone">VectorLogoZone</option>
                    <option value="lobe-icons">Lobe Icons</option>
                    <option value="developer-icons">Developer Icons</option>
                    <option value="svgporn">SVG Logos (svgporn)</option>
                    <option value="gilbarbara">SVG Logos (gilbarbara)</option>
                    <option value="simple-icons">Simple Icons</option>
                  </select>
                  <input
                    className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700"
                    value={logoQuery}
                    onChange={(e) => setLogoQuery(e.target.value)}
                    placeholder="Search logos (name, slug, tag, domain)…"
                    disabled={!canInteract}
                  />
                </div>

                {logoError ? <div className="mt-2 text-xs text-red-600">{logoError}</div> : null}

                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-slate-600">Top tags</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {topLogoTags.map((t) => {
                      const active = logoSelectedTag === t.tag;
                      return (
                        <button
                          key={t.tag}
                          type="button"
                          className={[
                            "h-7 px-2 rounded-full border text-[11px] transition-colors",
                            active ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300",
                          ].join(" ")}
                          disabled={!canInteract}
                          onClick={() => setLogoSelectedTag(active ? null : t.tag)}
                          title={`Filter by ${t.tag} (${t.count})`}
                        >
                          {t.tag}
                        </button>
                      );
                    })}
                    <select
                      className="h-7 rounded-full border border-slate-200 bg-white px-2 text-[11px] text-slate-700"
                      value={logoSelectedTag && !topLogoTags.some((x) => x.tag === logoSelectedTag) ? logoSelectedTag : ""}
                      onChange={(e) => setLogoSelectedTag(e.target.value ? e.target.value : null)}
                      disabled={!canInteract}
                      title="More tags…"
                    >
                      <option value="">More tags…</option>
                      {moreLogoTags.map((t) => (
                        <option key={t.tag} value={t.tag}>
                          {t.tag} ({t.count})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Phase 3E: click a tile to cache + insert into the active slide.
                  </div>
                </div>

                <div className="mt-3">
                  {logoLoading ? <div className="text-xs text-slate-500">Searching…</div> : null}
                  {!logoLoading && logoTiles.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      Type a search or select a tag to see logo variants.
                    </div>
                  ) : null}
                  {logoTiles.length > 0 ? (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {logoTiles.map((t) => (
                        (() => {
                          const key = `${t.source}:${t.sourceKey}:${t.variantKey}`;
                          const caching = cachingLogoKey === key;
                          const cached = cachedLogoKeys.has(key);
                          return (
                        <button
                          key={key}
                          type="button"
                          className="relative aspect-square rounded-md border border-slate-200 bg-slate-50 overflow-hidden hover:border-slate-300 disabled:opacity-50"
                          disabled={!canInteract || caching}
                          onClick={async () => {
                            if (!actions?.importLogoVariant) return;
                            if (!actions?.insertCachedLogoToActiveSlide) return;
                            if (!canInteract) return;
                            setLogoError(null);
                            setCachingLogoKey(key);
                            try {
                              const res = await actions.importLogoVariant({
                                source: t.source,
                                sourceKey: t.sourceKey,
                                variantKey: t.variantKey,
                                remoteUrl: t.remoteUrl,
                              });
                              // Mark cached in UI.
                              setCachedLogoKeys((prev) => {
                                const next = new Set(prev);
                                next.add(key);
                                return next;
                              });

                              const url = String(res?.assetUrl || "").trim();
                              const bucket = String(res?.storage?.bucket || "").trim();
                              const path = String(res?.storage?.path || "").trim();
                              if (!url || !bucket || !path) throw new Error("Cached but missing url/storage info");

                              if (bgRemovalEnabledAtInsert) setInsertingLogoKey(key);
                              await actions.insertCachedLogoToActiveSlide({
                                url,
                                storage: { bucket, path },
                                source: t.source,
                                sourceKey: t.sourceKey,
                                variantKey: t.variantKey,
                              });

                              // Close when done (if BG removal is ON, this only happens after reprocess finishes).
                              actions.onCloseImageLibraryModal?.();
                            } catch (e: any) {
                              setLogoError(String(e?.message || e || "Logo import failed"));
                            } finally {
                              setCachingLogoKey(null);
                              setInsertingLogoKey(null);
                            }
                          }}
                          title={`${t.title} — ${t.variantKey}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={t.remoteUrl} alt="" className="absolute inset-0 w-full h-full object-contain" />
                          {cached ? (
                            <div className="absolute left-1 top-1 px-2 py-0.5 rounded-full bg-black text-white text-[10px]">
                              Cached
                            </div>
                          ) : null}
                          {caching ? (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <span className="inline-block h-5 w-5 rounded-full border-2 border-white/70 border-t-white animate-spin" />
                            </div>
                          ) : null}
                        </button>
                          );
                        })()
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Tip: Use Background removal for photos. Keep it off for crisp logos and transparent images.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

