"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorSelector, useEditorStore } from "@/features/editor/store";
import { supabase } from "@/app/components/auth/AuthContext";
import { outreachApi } from "@/features/editor/services";

function canonicalizeInstagramPostOrReelUrlClient(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (!(raw.startsWith("http://") || raw.startsWith("https://"))) return raw;
  try {
    const u = new URL(raw);
    u.search = "";
    u.hash = "";
    const parts = String(u.pathname || "")
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    // Common paste variant: /reels/<shortcode>/ (plural) → /reel/<shortcode>/
    if (parts[0] === "reels") parts[0] = "reel";
    u.pathname = `/${parts.join("/")}${parts.length ? "/" : ""}`;
    return u.toString();
  } catch {
    return raw;
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

function sanitizeTemplateName(s: string): string {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function normLabel(s: any): string {
  return String(s || "").trim().toLowerCase();
}

export function OutreachModal() {
  const editorStore = useEditorStore();
  const open = useEditorSelector((s: any) => !!(s as any).outreachModalOpen);
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const actions = useEditorSelector((s: any) => (s as any).actions);
  const loadingTemplates = useEditorSelector((s: any) => !!(s as any).loadingTemplates);
  const templates = useEditorSelector((s: any) => (Array.isArray((s as any).templates) ? (s as any).templates : []));

  const [tab, setTab] = useState<"single" | "following" | "pipeline">("single");

  // Phase 1 (Reel/Post outreach): introduce a mode toggle.
  // Default: Reel/Post (we wire scrape behavior in Phase 2+).
  const [singleMode, setSingleMode] = useState<"reel" | "profile">("reel");
  const [reelUrl, setReelUrl] = useState("");

  const [instagramUrl, setInstagramUrl] = useState("");
  const [scrapeElapsedSec, setScrapeElapsedSec] = useState<number>(0);
  const scrapeAbortRef = useRef<AbortController | null>(null);

  // Helper: wait until the created project is actually loaded in the editor store.
  // This is important for "best-effort" post-create actions (Review flags, Generate Copy, etc.)
  // because some store updates only apply to the currently loaded project.
  const waitForProjectLoaded = async (pid: string) => {
    const target = String(pid || "").trim();
    if (!target) return false;
    const start = Date.now();
    while (Date.now() - start < 15_000) {
      const cur = String((editorStore.getState() as any)?.currentProjectId || "").trim();
      if (cur && cur === target) return true;
      await new Promise((r) => window.setTimeout(r, 150));
    }
    return false;
  };

  const setReelReviewFieldsBestEffort = async (args: { projectId: string; reelUrl: string }) => {
    const projectId = String(args.projectId || "").trim();
    const reelUrl = String(args.reelUrl || "").trim();
    if (!projectId || !reelUrl) return;
    try {
      await waitForProjectLoaded(projectId);
      await actions?.onChangeProjectReviewSource?.({ projectId, next: reelUrl });
      await actions?.onToggleProjectReviewReady?.({ projectId, next: true });
      // Ensure the overlay reflects it immediately even if the action doesn't patch current state for some reason.
      editorStore.setState({ reviewSource: reelUrl, reviewReady: true } as any);
    } catch {
      // ignore (best-effort)
    }
  };
  const [baseTemplateId, setBaseTemplateId] = useState<string>("");
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scraped, setScraped] = useState<{
    fullName: string | null;
    username: string | null;
    profilePicUrlHD: string | null;
    raw: any;
  } | null>(null);
  const [reelScraped, setReelScraped] = useState<outreachApi.ReelScrape | null>(null);
  // Pipeline optimization: if we already enriched the profile (HD avatar saved),
  // we can skip re-scraping the owner's profile when creating templates from a Reel URL.
  const [forcedReelOwnerUsername, setForcedReelOwnerUsername] = useState<string | null>(null);
  const [forcedReelOwnerFullName, setForcedReelOwnerFullName] = useState<string | null>(null);
  const [forcedReelOwnerProfilePicUrlHD, setForcedReelOwnerProfilePicUrlHD] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdTemplate, setCreatedTemplate] = useState<{ id: string; name: string } | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [persistBusy, setPersistBusy] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persistedTargetId, setPersistedTargetId] = useState<string | null>(null);

  // Following scrape tab (Phase 3: read-only list)
  const [seedInstagramUrl, setSeedInstagramUrl] = useState("");
  const [followingMaxResults, setFollowingMaxResults] = useState<number>(25);
  const [followingMaxSpendUsd, setFollowingMaxSpendUsd] = useState<number>(5);
  const [followingBusy, setFollowingBusy] = useState(false);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const [followingSeedUsername, setFollowingSeedUsername] = useState<string | null>(null);
  const [followingItems, setFollowingItems] = useState<Array<outreachApi.ScrapeFollowingItem>>([]);
  const [followingSearch, setFollowingSearch] = useState<string>("");
  const [followingVisibleCount, setFollowingVisibleCount] = useState<number>(25);
  const [followingSelectedKeys, setFollowingSelectedKeys] = useState<Set<string>>(() => new Set());
  const [liteQualifyBatchLimit, setLiteQualifyBatchLimit] = useState<number>(10); // Phase 5
  const [enrichBatchLimit, setEnrichBatchLimit] = useState<number>(5); // Phase 7
  const [liteQualifyBusy, setLiteQualifyBusy] = useState(false);
  const [liteQualifyError, setLiteQualifyError] = useState<string | null>(null);
  const [liteQualifyPendingUsernames, setLiteQualifyPendingUsernames] = useState<Set<string>>(() => new Set());
  const [liteQualByUsername, setLiteQualByUsername] = useState<Record<string, outreachApi.LiteQualification>>({});
  const [minScoreFilter, setMinScoreFilter] = useState<number | null>(null);
  const [saveProspectsBusy, setSaveProspectsBusy] = useState(false);
  const [saveProspectsError, setSaveProspectsError] = useState<string | null>(null);
  const [saveProspectsSummary, setSaveProspectsSummary] = useState<{ attempted: number; inserted: number } | null>(null);
  const [enrichBusy, setEnrichBusy] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichPendingUsernames, setEnrichPendingUsernames] = useState<Set<string>>(() => new Set());
  const [enrichedHdByUsername, setEnrichedHdByUsername] = useState<Record<string, string>>({});
  const [enrichQualifySaveBusy, setEnrichQualifySaveBusy] = useState(false);
  const [enrichQualifySaveError, setEnrichQualifySaveError] = useState<string | null>(null);
  const [enrichQualifySaveSummary, setEnrichQualifySaveSummary] = useState<outreachApi.EnrichQualifySaveSummary | null>(null);
  const [enrichQualifySaveLogs, setEnrichQualifySaveLogs] = useState<string[]>([]);
  const [enrichedOkByUsername, setEnrichedOkByUsername] = useState<Record<string, true>>({});
  const [dbCheckedByUsername, setDbCheckedByUsername] = useState<Record<string, true>>({});
  const [dbEnrichedByUsername, setDbEnrichedByUsername] = useState<Record<string, true>>({});
  const [followingCountByUsername, setFollowingCountByUsername] = useState<Record<string, number>>({});
  const [createRowBusyUsernames, setCreateRowBusyUsernames] = useState<Set<string>>(() => new Set());
  const [createRowErrorByUsername, setCreateRowErrorByUsername] = useState<Record<string, string>>({});
  const [createdProjectIdByUsername, setCreatedProjectIdByUsername] = useState<Record<string, string>>({});

  // Pipeline tab
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineRows, setPipelineRows] = useState<outreachApi.PipelineLead[]>([]);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [pipelineStageFilter, setPipelineStageFilter] = useState<outreachApi.PipelineStage | ''>('');
  const [pipelineBackfilledForOpen, setPipelineBackfilledForOpen] = useState(false);
  const [pipelineReelUrlDraftByUsername, setPipelineReelUrlDraftByUsername] = useState<Record<string, string>>({});
  const [pipelineLastContactDraftByUsername, setPipelineLastContactDraftByUsername] = useState<Record<string, string>>({});
  const [pipelineStageDraftByUsername, setPipelineStageDraftByUsername] = useState<Record<string, outreachApi.PipelineStage>>({});
  const [pipelineEditBusyByUsername, setPipelineEditBusyByUsername] = useState<Record<string, true>>({});
  const [pipelineCreateBusyByUsername, setPipelineCreateBusyByUsername] = useState<Record<string, true>>({});
  const [pipelineRowErrorByUsername, setPipelineRowErrorByUsername] = useState<Record<string, string>>({});
  const [pipelineAddBusyByUsername, setPipelineAddBusyByUsername] = useState<Record<string, true>>({});
  const [pipelineAddedByUsername, setPipelineAddedByUsername] = useState<Record<string, true>>({});
  const [pipelineAddErrorByUsername, setPipelineAddErrorByUsername] = useState<Record<string, string>>({});
  const [pipelineCtx, setPipelineCtx] = useState<null | { username: string; x: number; y: number }>(null);
  const [pipelineDeleteBusyByUsername, setPipelineDeleteBusyByUsername] = useState<Record<string, true>>({});

  const pipelineDidInitForOpenRef = useRef(false);
  const pipelineBusyRef = useRef(false);
  const pipelineSearchRef = useRef('');
  const pipelineStageFilterRef = useRef<outreachApi.PipelineStage | ''>('');

  // Following tab: load latest persisted scrape session on open (Option A).
  const loadedFollowingSessionForOpenRef = useRef(false);

  const resetAll = useCallback(() => {
    if (
      scrapeBusy ||
      createBusy ||
      projectBusy ||
      persistBusy ||
      followingBusy ||
      liteQualifyBusy ||
      saveProspectsBusy ||
      enrichBusy ||
      enrichQualifySaveBusy
    )
      return;
    // Keep the last selected tab (less annoying when reopening the modal).
    setSingleMode("reel");
    setReelUrl("");
    setInstagramUrl("");
    setBaseTemplateId("");
    setScrapeError(null);
    setScraped(null);
    setReelScraped(null);
    setForcedReelOwnerUsername(null);
    setForcedReelOwnerFullName(null);
    setForcedReelOwnerProfilePicUrlHD(null);
    setCreateError(null);
    setCreatedTemplate(null);
    setProjectError(null);
    setCreatedProjectId(null);
    setPersistError(null);
    setPersistedTargetId(null);

    setSeedInstagramUrl("");
    setFollowingMaxResults(25);
    setFollowingMaxSpendUsd(5);
    setFollowingError(null);
    setFollowingSeedUsername(null);
    setFollowingItems([]);
    setFollowingSearch("");
    setFollowingVisibleCount(25);
    setFollowingSelectedKeys(new Set());
    setLiteQualifyBatchLimit(10);
    setEnrichBatchLimit(5);
    setLiteQualifyBusy(false);
    setLiteQualifyError(null);
    setLiteQualifyPendingUsernames(new Set());
    setLiteQualByUsername({});
    setMinScoreFilter(null);
    setSaveProspectsBusy(false);
    setSaveProspectsError(null);
    setSaveProspectsSummary(null);
    setEnrichBusy(false);
    setEnrichError(null);
    setEnrichPendingUsernames(new Set());
    setEnrichedHdByUsername({});
    setEnrichQualifySaveBusy(false);
    setEnrichQualifySaveError(null);
    setEnrichQualifySaveSummary(null);
    setEnrichQualifySaveLogs([]);
    setEnrichedOkByUsername({});
    setDbCheckedByUsername({});
    setDbEnrichedByUsername({});
    setFollowingCountByUsername({});
    setCreateRowBusyUsernames(new Set());
    setCreateRowErrorByUsername({});
    setCreatedProjectIdByUsername({});
  }, [
    createBusy,
    enrichBusy,
    enrichQualifySaveBusy,
    followingBusy,
    liteQualifyBusy,
    persistBusy,
    projectBusy,
    saveProspectsBusy,
    scrapeBusy,
  ]);

  const followingFiltered = useMemo(() => {
    const q = String(followingSearch || "").trim().toLowerCase();
    const rows = Array.isArray(followingItems) ? followingItems : [];
    let out = rows;
    if (q) {
      out = out.filter((it) => {
        const u = String(it?.username || "").toLowerCase();
        const n = String(it?.fullName || "").toLowerCase();
        return u.includes(q) || n.includes(q);
      });
    }
    const min = minScoreFilter;
    if (typeof min === "number" && Number.isFinite(min)) {
      out = out.filter((it) => {
        const uname = String(it?.username || "").replace(/^@+/, "").trim().toLowerCase();
        if (!uname) return false;
        const qual = liteQualByUsername[uname];
        const score = typeof qual?.score === "number" ? qual.score : null;
        return score !== null && score >= min;
      });
    }
    return out;
  }, [followingItems, followingSearch, liteQualByUsername, minScoreFilter]);

  const followingShown = useMemo(() => {
    const n = Math.max(0, Number(followingVisibleCount || 0));
    return followingFiltered.slice(0, n);
  }, [followingFiltered, followingVisibleCount]);

  const followingSelectedCount = useMemo(() => {
    return followingSelectedKeys?.size ? followingSelectedKeys.size : 0;
  }, [followingSelectedKeys]);

  const selectedUsernames = useMemo(() => {
    const keys = Array.from(followingSelectedKeys || []);
    const raw = keys
      .map((k) => String(k || ""))
      .filter((k) => k.startsWith("u:"))
      .map((k) => k.slice(2).trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const uniq: string[] = [];
    for (const u of raw) {
      const norm = u.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      uniq.push(norm);
    }
    return uniq;
  }, [followingSelectedKeys]);

  function tryExtractInstagramUsernameFromProfileUrl(input: string): string | null {
    const raw = String(input || '').trim();
    if (!raw) return null;
    try {
      const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      const host = u.hostname.toLowerCase();
      if (!host.includes('instagram.com')) return null;
      const parts = u.pathname.split('/').map((p) => p.trim()).filter(Boolean);
      const first = String(parts?.[0] || '').trim().toLowerCase();
      if (!first) return null;
      // Don't treat /reel/xyz or /p/xyz as usernames.
      if (first === 'reel' || first === 'reels' || first === 'p' || first === 'tv') return null;
      return first;
    } catch {
      return null;
    }
  }

  function getSeedInfoBestEffort(): { seedUsername: string | null; seedInstagramUrl: string | null } {
    const seedFromState = String(followingSeedUsername || '').trim();
    const urlFromState = String(seedInstagramUrl || '').trim();
    const seedFromUrl = tryExtractInstagramUsernameFromProfileUrl(urlFromState);
    const seedFromItems = String((followingItems?.[0] as any)?.seedUsername || '').trim();
    const seed = seedFromState || seedFromUrl || seedFromItems || null;
    const url = urlFromState || (seed ? `https://www.instagram.com/${seed}/` : null);
    return { seedUsername: seed, seedInstagramUrl: url };
  }

  function extractFollowingCountBestEffort(raw: any): number | null {
    const candidates = [
      raw?.followingCount,
      raw?.followingsCount,
      raw?.following_count,
      raw?.edge_follow?.count,
      raw?.edgeFollow?.count,
      raw?.counts?.follows,
      raw?.counts?.following,
    ];
    for (const v of candidates) {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
    }
    return null;
  }

  // IMPORTANT: only run this once per modal-open.
  // Previously this effect depended on `resetAll`, which depended on busy flags.
  // That caused the effect to re-run during batch actions (enrich/qualify/save) and wipe the table.
  const didInitForOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      didInitForOpenRef.current = false;
      return;
    }
    if (didInitForOpenRef.current) return;
    didInitForOpenRef.current = true;

    // Clear any in-flight UI flags (defensive) and reset modal state.
    setScrapeBusy(false);
    setCreateBusy(false);
    setProjectBusy(false);
    setPersistBusy(false);
    setFollowingBusy(false);
    setLiteQualifyBusy(false);
    setSaveProspectsBusy(false);
    setEnrichBusy(false);

    // Keep the last selected tab (less annoying when reopening the modal).
    setSingleMode("reel");
    setReelUrl("");
    setInstagramUrl("");
    setBaseTemplateId("");
    setScrapeError(null);
    setScraped(null);
    setReelScraped(null);
    setCreateError(null);
    setCreatedTemplate(null);
    setProjectError(null);
    setCreatedProjectId(null);
    setPersistError(null);
    setPersistedTargetId(null);

    setSeedInstagramUrl("");
    setFollowingMaxResults(25);
    setFollowingMaxSpendUsd(5);
    setFollowingError(null);
    setFollowingSeedUsername(null);
    setFollowingItems([]);
    setFollowingSearch("");
    setFollowingVisibleCount(25);
    setFollowingSelectedKeys(new Set());
    setLiteQualifyBatchLimit(10);
    setEnrichBatchLimit(5);
    setLiteQualifyError(null);
    setLiteQualifyPendingUsernames(new Set());
    setLiteQualByUsername({});
    setMinScoreFilter(null);
    setSaveProspectsError(null);
    setSaveProspectsSummary(null);
    setEnrichError(null);
    setEnrichPendingUsernames(new Set());
    setEnrichedHdByUsername({});
    setEnrichQualifySaveBusy(false);
    setEnrichQualifySaveError(null);
    setEnrichQualifySaveSummary(null);
    setEnrichQualifySaveLogs([]);
    setEnrichedOkByUsername({});
    setDbCheckedByUsername({});
    setDbEnrichedByUsername({});
    setFollowingCountByUsername({});
    setCreateRowBusyUsernames(new Set());
    setCreateRowErrorByUsername({});
    setCreatedProjectIdByUsername({});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Only attempt once per modal open.
    if (loadedFollowingSessionForOpenRef.current) return;
    loadedFollowingSessionForOpenRef.current = true;

    void (async () => {
      try {
        const token = await getSessionToken();
        const accountHeader = getActiveAccountHeader();
        const out = await outreachApi.loadLatestFollowingScrapeSession({ token, headers: accountHeader });
        const s = out?.session || null;
        if (!s?.id) return;
        const items = Array.isArray(s.items) ? (s.items as any[]) : [];
        if (!items.length) return;
        // Restore following tab state. Do not override the current tab; just preload data.
        setSeedInstagramUrl(String(s.seedInstagramUrl || "").trim());
        setFollowingSeedUsername(String(s.seedUsername || "").trim() || null);
        setFollowingItems(items);
        setFollowingVisibleCount(Math.max(25, Math.min(5000, items.length)));
        if (typeof s.maxResults === "number" && Number.isFinite(s.maxResults)) setFollowingMaxResults(Math.max(1, Math.min(5000, s.maxResults)));
        if (typeof s.maxSpendUsd === "number" && Number.isFinite(s.maxSpendUsd)) setFollowingMaxSpendUsd(Math.max(0.5, Math.min(5, s.maxSpendUsd)));

        // Hydrate saved scores/enrichment from DB so the table reflects persistence.
        try {
          const usernames = items
            .map((it: any) => String(it?.username || "").replace(/^@+/, "").trim().toLowerCase())
            .filter(Boolean);
          const CHUNK = 500;
          for (let i = 0; i < usernames.length; i += CHUNK) {
            const chunk = usernames.slice(i, i + CHUNK);
            const rows = await outreachApi.hydrateFollowingFromDb({ token, usernames: chunk, headers: accountHeader });
            if (!rows?.length) continue;
            setDbCheckedByUsername((prev) => {
              const next = { ...(prev || {}) };
              for (const u of chunk) next[u] = true;
              return next;
            });
            setDbEnrichedByUsername((prev) => {
              const next = { ...(prev || {}) };
              for (const r of rows) if (r?.enriched?.ok) next[String(r.username || "").toLowerCase()] = true;
              return next;
            });
            setEnrichedOkByUsername((prev) => {
              const next = { ...(prev || {}) };
              for (const r of rows) if (r?.enriched?.ok) next[String(r.username || "").toLowerCase()] = true;
              return next;
            });
            setEnrichedHdByUsername((prev) => {
              const next = { ...(prev || {}) };
              for (const r of rows) {
                const u = String(r?.username || "").toLowerCase();
                const hd = String(r?.enriched?.profilePicUrlHD || "").trim();
                if (u && hd) next[u] = hd;
              }
              return next;
            });
            setFollowingCountByUsername((prev) => {
              const next = { ...(prev || {}) };
              for (const r of rows) {
                const u = String(r?.username || "").toLowerCase();
                const n = r?.enriched?.followingCount;
                if (u && typeof n === "number" && Number.isFinite(n)) next[u] = Math.floor(n);
              }
              return next;
            });
            setLiteQualByUsername((prev) => {
              const next = { ...(prev || {}) };
              for (const r of rows) {
                const u = String(r?.username || "").toLowerCase();
                const ai = (r as any)?.ai ?? null;
                if (u && ai && typeof ai.score === "number") {
                  next[u] = {
                    score: ai.score,
                    niche: String(ai.niche || ""),
                    reason: String(ai.reason || ""),
                    has_offer: Boolean(ai.has_offer),
                    credential: ai.credential ?? null,
                  } as any;
                }
              }
              return next;
            });
          }
        } catch {
          // ignore; best-effort UI hydration
        }
      } catch {
        // ignore (best-effort)
      }
    })();
  }, [open]);

  useEffect(() => {
    // Reset the "loaded once" guard on close.
    if (open) return;
    loadedFollowingSessionForOpenRef.current = false;
  }, [open]);

  useEffect(() => {
    if (open) return;
    pipelineDidInitForOpenRef.current = false;
    setPipelineBackfilledForOpen(false);
  }, [open]);

  // UX: auto-select the base template named "Outreach Template" when opening the modal,
  // but never override a user's manual selection.
  useEffect(() => {
    if (!open) return;
    if (String(baseTemplateId || "").trim()) return;
    const desired = "outreach template";
    const hit = (templates || []).find((t: any) => normLabel(t?.name) === desired);
    const id = String(hit?.id || "").trim();
    if (id) setBaseTemplateId(id);
  }, [baseTemplateId, open, templates]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions?.onCloseOutreachModal?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, open]);

  const canScrape = useMemo(() => {
    if (singleMode === "profile") return !!String(instagramUrl || "").trim();
    return !!String(reelUrl || "").trim();
  }, [instagramUrl, reelUrl, singleMode]);

  useEffect(() => {
    // Scrape progress ticker (prevents "frozen UI" feel).
    if (!scrapeBusy) {
      setScrapeElapsedSec(0);
      return;
    }
    const start = Date.now();
    setScrapeElapsedSec(0);
    const id = window.setInterval(() => {
      const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setScrapeElapsedSec(sec);
    }, 500);
    return () => window.clearInterval(id);
  }, [scrapeBusy]);

  const scrapeProgressLabel = useMemo(() => {
    if (!scrapeBusy) return null;
    const m = Math.floor(scrapeElapsedSec / 60);
    const s = String(scrapeElapsedSec % 60).padStart(2, "0");
    const base = `Scraping… ${m}:${s}`;
    if (scrapeElapsedSec >= 45) return `${base} (Instagram is slow right now)`;
    return base;
  }, [scrapeBusy, scrapeElapsedSec]);

  const busyLabel = useMemo(() => {
    if (enrichQualifySaveBusy) return "Enriching + qualifying…";
    if (pipelineBusy) return "Loading pipeline…";
    if (enrichBusy) return "Enriching…";
    if (saveProspectsBusy) return "Saving prospects…";
    if (liteQualifyBusy) return "Qualifying…";
    if (followingBusy) return "Scraping following…";
    if (scrapeBusy) return singleMode === "reel" ? scrapeProgressLabel || "Scraping…" : "Scraping…";
    if (createBusy) return "Creating template…";
    if (projectBusy) return "Creating project…";
    if (persistBusy) return "Saving record…";
    return null;
  }, [
    createBusy,
    enrichBusy,
    enrichQualifySaveBusy,
    pipelineBusy,
    followingBusy,
    liteQualifyBusy,
    persistBusy,
    projectBusy,
    saveProspectsBusy,
    scrapeBusy,
    scrapeProgressLabel,
    singleMode,
  ]);

  const anyBusy = !!busyLabel;

  useEffect(() => {
    pipelineBusyRef.current = pipelineBusy;
    pipelineSearchRef.current = pipelineSearch;
    pipelineStageFilterRef.current = pipelineStageFilter;
  }, [pipelineBusy, pipelineSearch, pipelineStageFilter]);

  useEffect(() => {
    if (!pipelineCtx) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPipelineCtx(null);
    };
    const onMouseDown = () => setPipelineCtx(null);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [pipelineCtx]);

  const topError = useMemo(() => {
    return scrapeError || createError || projectError || persistError || null;
  }, [createError, persistError, projectError, scrapeError]);

  async function getSessionToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    if (!token) throw new Error("Not authenticated");
    return token;
  }

  const canScrapeFollowing = useMemo(() => {
    return !!String(seedInstagramUrl || "").trim();
  }, [seedInstagramUrl]);

  const handleScrapeFollowing = useCallback(async () => {
    if (!canScrapeFollowing || followingBusy || anyBusy) return;
    setFollowingBusy(true);
    setFollowingError(null);
    setFollowingSeedUsername(null);
    setFollowingItems([]);
    setFollowingSelectedKeys(new Set());
    setFollowingVisibleCount(25);
    setLiteQualifyError(null);
    setLiteQualifyPendingUsernames(new Set());
    setLiteQualByUsername({});
    setMinScoreFilter(null);
    setSaveProspectsError(null);
    setSaveProspectsSummary(null);
    try {
      const token = await getSessionToken();
      const accountHeader = getActiveAccountHeader();
      const out = await outreachApi.scrapeFollowing({
        token,
        seedInstagramUrl,
        maxResults: followingMaxResults,
        maxSpendUsd: followingMaxSpendUsd,
        headers: accountHeader,
      });
      setFollowingSeedUsername(out.seedUsername || null);
      setFollowingItems(Array.isArray(out.items) ? out.items : []);
    } catch (e: any) {
      setFollowingError(String(e?.message || e || "Scrape following failed"));
    } finally {
      setFollowingBusy(false);
    }
  }, [anyBusy, canScrapeFollowing, followingBusy, followingMaxResults, followingMaxSpendUsd, seedInstagramUrl]);

  const handleSaveSelectedProspects = useCallback(async () => {
    if (anyBusy || saveProspectsBusy) return;
    const toSave = selectedUsernames;
    if (!toSave.length) {
      setSaveProspectsError("Select at least one row with a valid username.");
      return;
    }
    const seedInfo = getSeedInfoBestEffort();
    const seedU = String(seedInfo.seedUsername || '').trim();
    const seedUrl = String(seedInfo.seedInstagramUrl || '').trim();
    if (!seedU || !seedUrl) {
      setSaveProspectsError("Missing seed info. Run a scrape first.");
      return;
    }
    if (!String(baseTemplateId || "").trim()) {
      setSaveProspectsError("Select a base template first (we store it with the prospect).");
      return;
    }

    setSaveProspectsBusy(true);
    setSaveProspectsError(null);
    setSaveProspectsSummary(null);

    try {
      const token = await getSessionToken();
      const accountHeader = getActiveAccountHeader();

      // Chunk saves to avoid oversized payloads (raw JSON can be large).
      const CHUNK = 100;
      let attemptedTotal = 0;
      let insertedTotal = 0;

      for (let i = 0; i < toSave.length; i += CHUNK) {
        const chunkUsernames = toSave.slice(i, i + CHUNK);
        const items = chunkUsernames
          .map((u) => {
            const hit = (followingItems || []).find(
              (it) => String(it?.username || "").replace(/^@+/, "").trim().toLowerCase() === u
            );
            if (!hit) return null;
            const ai = liteQualByUsername[u] ?? null;
            return {
              username: hit.username,
              fullName: hit.fullName,
              profilePicUrl: hit.profilePicUrl,
              isVerified: hit.isVerified,
              isPrivate: hit.isPrivate,
              raw: hit.raw,
              ...(ai ? { ai: { ...ai, mode: "lite" } } : {}),
            };
          })
          .filter(Boolean) as any[];

        const out = await outreachApi.persistProspects({
          token,
          seedInstagramUrl: seedUrl,
          seedUsername: seedU,
          baseTemplateId: baseTemplateId || null,
          items,
          headers: accountHeader,
        });
        attemptedTotal += out.attempted;
        insertedTotal += out.inserted;
      }

      setSaveProspectsSummary({ attempted: attemptedTotal, inserted: insertedTotal });
    } catch (e: any) {
      setSaveProspectsError(String(e?.message || e || "Save selected failed"));
    } finally {
      setSaveProspectsBusy(false);
    }
  }, [
    anyBusy,
    baseTemplateId,
    followingItems,
    followingSeedUsername,
    liteQualByUsername,
    saveProspectsBusy,
    seedInstagramUrl,
    selectedUsernames,
  ]);

  const handleEnrichSelected = useCallback(async () => {
    if (anyBusy || enrichBusy) return;
    const seedInfo = getSeedInfoBestEffort();
    const seedU = String(seedInfo.seedUsername || '').trim();
    if (!seedU) {
      setEnrichError("Missing seed username. Run a scrape first.");
      return;
    }
    const limit = Math.max(1, Math.min(25, Number(enrichBatchLimit || 5)));
    const toEnrich = selectedUsernames.slice(0, limit);
    if (!toEnrich.length) {
      setEnrichError("Select at least one row with a valid username.");
      return;
    }

    setEnrichBusy(true);
    setEnrichError(null);
    setEnrichPendingUsernames(new Set(toEnrich));
    try {
      const token = await getSessionToken();
      const accountHeader = getActiveAccountHeader();
      const results = await outreachApi.enrichProspects({ token, seedUsername: seedU, usernames: toEnrich, headers: accountHeader });
      const nextPending = new Set(enrichPendingUsernames || []);
      const nextHd = { ...(enrichedHdByUsername || {}) };
      for (const r of results) {
        const uname = String((r as any)?.username || "").replace(/^@+/, "").trim().toLowerCase();
        if (!uname) continue;
        nextPending.delete(uname);
        if ((r as any)?.ok && (r as any)?.profilePicUrlHD) {
          nextHd[uname] = String((r as any).profilePicUrlHD);
        }
      }
      setEnrichPendingUsernames(nextPending);
      setEnrichedHdByUsername(nextHd);
    } catch (e: any) {
      setEnrichError(String(e?.message || e || "Enrich failed"));
      setEnrichPendingUsernames(new Set());
    } finally {
      setEnrichBusy(false);
    }
  }, [anyBusy, enrichBatchLimit, enrichBusy, enrichPendingUsernames, enrichedHdByUsername, followingSeedUsername, selectedUsernames]);

  const handleEnrich80Plus = useCallback(async () => {
    if (anyBusy || enrichBusy) return;
    const seedInfo = getSeedInfoBestEffort();
    const seedU = String(seedInfo.seedUsername || '').trim();
    if (!seedU) {
      setEnrichError("Missing seed username. Run a scrape first.");
      return;
    }
    const limit = Math.max(1, Math.min(25, Number(enrichBatchLimit || 5)));
    const candidates = Object.entries(liteQualByUsername || {})
      .filter(([, q]) => typeof (q as any)?.score === "number" && (q as any).score >= 80)
      .sort((a, b) => Number((b[1] as any).score) - Number((a[1] as any).score))
      .map(([u]) => u);
    const toEnrich = candidates.slice(0, limit);
    if (!toEnrich.length) {
      setEnrichError("No rows with score ≥ 80 yet. Run Lite qualify first.");
      return;
    }
    setEnrichBusy(true);
    setEnrichError(null);
    setEnrichPendingUsernames(new Set(toEnrich));
    try {
      const token = await getSessionToken();
      const accountHeader = getActiveAccountHeader();
      const results = await outreachApi.enrichProspects({ token, seedUsername: seedU, usernames: toEnrich, headers: accountHeader });
      const nextPending = new Set(enrichPendingUsernames || []);
      const nextHd = { ...(enrichedHdByUsername || {}) };
      for (const r of results) {
        const uname = String((r as any)?.username || "").replace(/^@+/, "").trim().toLowerCase();
        if (!uname) continue;
        nextPending.delete(uname);
        if ((r as any)?.ok && (r as any)?.profilePicUrlHD) {
          nextHd[uname] = String((r as any).profilePicUrlHD);
        }
      }
      setEnrichPendingUsernames(nextPending);
      setEnrichedHdByUsername(nextHd);
    } catch (e: any) {
      setEnrichError(String(e?.message || e || "Enrich failed"));
      setEnrichPendingUsernames(new Set());
    } finally {
      setEnrichBusy(false);
    }
  }, [anyBusy, enrichBatchLimit, enrichBusy, enrichPendingUsernames, enrichedHdByUsername, followingSeedUsername, liteQualByUsername]);

  const handleCreateFromRow = useCallback(
    async (args: { username: string }) => {
      const uname = String(args.username || "").replace(/^@+/, "").trim().toLowerCase();
      if (!uname) return;
      if (anyBusy) return;
      if (!String(baseTemplateId || "").trim()) {
        setCreateRowErrorByUsername((prev) => ({ ...(prev || {}), [uname]: "Select a base template first." }));
        return;
      }

      // Mark row busy.
      setCreateRowBusyUsernames((prev) => {
        const next = new Set(prev || []);
        next.add(uname);
        return next;
      });
      setCreateRowErrorByUsername((prev) => {
        const next = { ...(prev || {}) };
        delete next[uname];
        return next;
      });

      try {
        const token = await getSessionToken();
        const accountHeader = getActiveAccountHeader();

        // Ensure the prospect row exists in DB (safe even if already saved; dedupe index prevents duplicates).
        const hit = (followingItems || []).find((it) => String(it?.username || "").replace(/^@+/, "").trim().toLowerCase() === uname);
        if (!hit) throw new Error("Row not found in current results.");
        const seedInfo = getSeedInfoBestEffort();
        const seedU = String(seedInfo.seedUsername || '').trim();
        const seedUrl = String(seedInfo.seedInstagramUrl || '').trim();
        if (!seedU || !seedUrl) throw new Error("Missing seed info. Run a scrape first.");

        await outreachApi.persistProspects({
          token,
          seedInstagramUrl: seedUrl,
          seedUsername: seedU,
          baseTemplateId: baseTemplateId || null,
          items: [
            {
              username: hit.username,
              fullName: hit.fullName,
              profilePicUrl: hit.profilePicUrl,
              isVerified: hit.isVerified,
              isPrivate: hit.isPrivate,
              raw: hit.raw,
              ...(liteQualByUsername[uname] ? { ai: { ...liteQualByUsername[uname], mode: "lite" } } : {}),
            },
          ],
          headers: accountHeader,
        });

        // Ensure we have an HD avatar URL. If missing, enrich this one username (updates DB too).
        let hdUrl = String(enrichedHdByUsername?.[uname] || "").trim();
        if (!hdUrl) {
          const enrich = await outreachApi.enrichProspects({ token, seedUsername: seedU, usernames: [uname], headers: accountHeader });
          const row = enrich?.[0] as any;
          if (row?.ok && row?.profilePicUrlHD) {
            hdUrl = String(row.profilePicUrlHD).trim();
            setEnrichedHdByUsername((prev) => ({ ...(prev || {}), [uname]: hdUrl }));
          }
        }
        if (!hdUrl) throw new Error("Missing profilePicUrlHD (enrichment returned none).");

        // Create template using existing server route.
        const scrapedForTemplate = {
          fullName: hit.fullName ?? null,
          username: hit.username ?? uname,
          profilePicUrlHD: hdUrl,
          raw: null,
        };
        const tpl = await apiCreateTemplate({ baseTemplateId, scraped: scrapedForTemplate });

        // Create project + mappings + caption, then load it.
        const title =
          sanitizeTemplateName(String(hit.fullName || "").trim()) ||
          (hit.username ? `@${String(hit.username || "").replace(/^@+/, "")}` : `@${uname}`) ||
          "Untitled Project";
        const { projectId } = await apiCreateRegularProject({ title });
        await apiApplyProjectMappings({ projectId, templateId: tpl.templateId });

        const nameForCaption = sanitizeTemplateName(String(hit.fullName || "").trim()) || `@${uname}` || "there";
        await apiUpdateProjectOutreachMessage({
          projectId,
          outreachMessage: buildOutreachMessage({ name: nameForCaption }),
        });

        // Mark row as created (persist ids).
        await outreachApi.markCreated({
          token,
          seedUsername: seedU,
          prospectUsername: uname,
          createdTemplateId: tpl.templateId,
          createdProjectId: projectId,
          baseTemplateId: baseTemplateId || null,
          headers: accountHeader,
        });

        setCreatedProjectIdByUsername((prev) => ({ ...(prev || {}), [uname]: projectId }));
        actions?.onLoadProject?.(projectId);
      } catch (e: any) {
        setCreateRowErrorByUsername((prev) => ({ ...(prev || {}), [uname]: String(e?.message || e || "Failed") }));
      } finally {
        setCreateRowBusyUsernames((prev) => {
          const next = new Set(prev || []);
          next.delete(uname);
          return next;
        });
      }
    },
    [
      actions,
      anyBusy,
      baseTemplateId,
      enrichedHdByUsername,
      followingItems,
      followingSeedUsername,
      liteQualByUsername,
      seedInstagramUrl,
    ]
  );

  const handleLiteQualifySelected = useCallback(async () => {
    if (anyBusy || liteQualifyBusy) return;
    const batchLimit = Math.max(1, Math.min(50, Number(liteQualifyBatchLimit || 10)));
    const toQualify = selectedUsernames.slice(0, batchLimit);
    if (!toQualify.length) {
      setLiteQualifyError("Select at least one row with a valid username.");
      return;
    }

    setLiteQualifyBusy(true);
    setLiteQualifyError(null);
    setLiteQualifyPendingUsernames(new Set(toQualify));

    try {
      const token = await getSessionToken();
      const accountHeader = getActiveAccountHeader();

      const items = toQualify
        .map((u) => {
          const hit = (followingItems || []).find(
            (it) => String(it?.username || "").replace(/^@+/, "").trim().toLowerCase() === u
          );
          if (!hit) return null;
          return {
            username: hit.username,
            fullName: hit.fullName,
            profilePicUrl: hit.profilePicUrl,
            isVerified: hit.isVerified,
            isPrivate: hit.isPrivate,
            raw: hit.raw,
          };
        })
        .filter(Boolean) as Array<
        Pick<outreachApi.ScrapeFollowingItem, "username" | "fullName" | "profilePicUrl" | "isVerified" | "isPrivate" | "raw">
      >;

      const results = await outreachApi.qualifyLite({ token, items, headers: accountHeader });

      const nextQual = { ...(liteQualByUsername || {}) };
      const nextPending = new Set(liteQualifyPendingUsernames || []);
      for (const r of results) {
        const uname = String((r as any)?.username || "")
          .replace(/^@+/, "")
          .trim()
          .toLowerCase();
        if (!uname) continue;
        nextPending.delete(uname);
        if ((r as any)?.ok && (r as any)?.data) {
          nextQual[uname] = (r as any).data as outreachApi.LiteQualification;
        }
      }
      setLiteQualByUsername(nextQual);
      setLiteQualifyPendingUsernames(nextPending);
    } catch (e: any) {
      setLiteQualifyError(String(e?.message || e || "Lite qualification failed"));
      setLiteQualifyPendingUsernames(new Set());
    } finally {
      setLiteQualifyBusy(false);
    }
  }, [
    anyBusy,
    followingItems,
    liteQualByUsername,
    liteQualifyBatchLimit,
    liteQualifyBusy,
    liteQualifyPendingUsernames,
    selectedUsernames,
  ]);

  const handleQualifyAndSaveSelected = useCallback(async () => {
    if (anyBusy || liteQualifyBusy || saveProspectsBusy) return;

    const selected = selectedUsernames;
    if (!selected.length) {
      setLiteQualifyError("Select at least one row with a valid username.");
      return;
    }

    const seedInfo = getSeedInfoBestEffort();
    const seedU = String(seedInfo.seedUsername || '').trim();
    const seedUrl = String(seedInfo.seedInstagramUrl || '').trim();
    if (!seedU || !seedUrl) {
      setSaveProspectsError("Missing seed info. Run a scrape first.");
      return;
    }
    if (!String(baseTemplateId || "").trim()) {
      setSaveProspectsError("Select a base template first (we store it with the prospect).");
      return;
    }

    // Safety rail: keep one-click workloads bounded for stability + cost.
    // (qualify-lite max 50 per call, persist-prospects max 200 per request)
    const HARD_CAP = 200;
    if (selected.length > HARD_CAP) {
      setLiteQualifyError(`Too many selected rows (${selected.length}). Select up to ${HARD_CAP} per click, then run again.`);
      return;
    }

    // Only call DeepSeek for rows that don't already have a score.
    const toQualify = selected.filter((u) => typeof (liteQualByUsername?.[u] as any)?.score !== "number");

    setLiteQualifyError(null);
    setSaveProspectsError(null);
    setSaveProspectsSummary(null);

    try {
      const token = await getSessionToken();
      const accountHeader = getActiveAccountHeader();
      const qualMapLocal: Record<string, outreachApi.LiteQualification> = { ...(liteQualByUsername || {}) };

      // 1) Qualify (DeepSeek) in safe chunks (50 max per request).
      if (toQualify.length) {
        setLiteQualifyBusy(true);
        setLiteQualifyPendingUsernames(new Set(toQualify));
        try {
          const nextPending = new Set(toQualify);

          const CHUNK = 50;
          for (let i = 0; i < toQualify.length; i += CHUNK) {
            const chunkUsernames = toQualify.slice(i, i + CHUNK);
            const items = chunkUsernames
              .map((u) => {
                const hit = (followingItems || []).find(
                  (it) => String(it?.username || "").replace(/^@+/, "").trim().toLowerCase() === u
                );
                if (!hit) return null;
                return {
                  username: hit.username,
                  fullName: hit.fullName,
                  profilePicUrl: hit.profilePicUrl,
                  isVerified: hit.isVerified,
                  isPrivate: hit.isPrivate,
                  raw: hit.raw,
                };
              })
              .filter(Boolean) as Array<
              Pick<outreachApi.ScrapeFollowingItem, "username" | "fullName" | "profilePicUrl" | "isVerified" | "isPrivate" | "raw">
            >;

            const results = await outreachApi.qualifyLite({ token, items, headers: accountHeader });
            for (const r of results) {
              const uname = String((r as any)?.username || "")
                .replace(/^@+/, "")
                .trim()
                .toLowerCase();
              if (!uname) continue;
              nextPending.delete(uname);
              if ((r as any)?.ok && (r as any)?.data) {
                qualMapLocal[uname] = (r as any).data as outreachApi.LiteQualification;
              }
            }
            setLiteQualifyPendingUsernames(new Set(nextPending));
          }

          setLiteQualByUsername(qualMapLocal);
          setLiteQualifyPendingUsernames(new Set());
        } finally {
          setLiteQualifyBusy(false);
        }
      }

      // 2) Persist selected prospects (with whatever AI we now have) to DB.
      setSaveProspectsBusy(true);
      try {
        const CHUNK = 100;
        let attemptedTotal = 0;
        let insertedTotal = 0;

        for (let i = 0; i < selected.length; i += CHUNK) {
          const chunkUsernames = selected.slice(i, i + CHUNK);
          const items = chunkUsernames
            .map((u) => {
              const hit = (followingItems || []).find(
                (it) => String(it?.username || "").replace(/^@+/, "").trim().toLowerCase() === u
              );
              if (!hit) return null;
              const ai = qualMapLocal[u] ?? liteQualByUsername[u] ?? null;
              return {
                username: hit.username,
                fullName: hit.fullName,
                profilePicUrl: hit.profilePicUrl,
                isVerified: hit.isVerified,
                isPrivate: hit.isPrivate,
                raw: hit.raw,
                ...(ai ? { ai: { ...ai, mode: "lite" } } : {}),
              };
            })
            .filter(Boolean) as any[];

          const out = await outreachApi.persistProspects({
            token,
            seedInstagramUrl: seedUrl,
            seedUsername: seedU,
            baseTemplateId: baseTemplateId || null,
            items,
            headers: accountHeader,
          });
          attemptedTotal += out.attempted;
          insertedTotal += out.inserted;
        }

        setSaveProspectsSummary({ attempted: attemptedTotal, inserted: insertedTotal });
      } finally {
        setSaveProspectsBusy(false);
      }
    } catch (e: any) {
      const msg = String(e?.message || e || "Qualify + Save failed");
      // Prefer showing the error in the Save area since that's the end goal.
      setSaveProspectsError(msg);
    }
  }, [
    anyBusy,
    baseTemplateId,
    getSeedInfoBestEffort,
    followingItems,
    followingSeedUsername,
    liteQualByUsername,
    liteQualifyBusy,
    saveProspectsBusy,
    seedInstagramUrl,
    selectedUsernames,
  ]);

  const handleEnrichQualifySaveSelected = useCallback(async () => {
    if (anyBusy || enrichQualifySaveBusy) return;

    const selected = selectedUsernames;
    if (!selected.length) {
      setEnrichQualifySaveError("Select at least one row with a valid username.");
      return;
    }
    const HARD_CAP = 25;
    if (selected.length > HARD_CAP) {
      setEnrichQualifySaveError(`Too many selected usernames (${selected.length}). Select up to ${HARD_CAP} per click, then run again.`);
      return;
    }

    const seedInfo = getSeedInfoBestEffort();
    const seedU = String(seedInfo.seedUsername || "").trim();
    const seedUrl = String(seedInfo.seedInstagramUrl || "").trim();
    if (!seedU || !seedUrl) {
      setEnrichQualifySaveError("Missing seed info. Run a scrape first.");
      return;
    }
    if (!String(baseTemplateId || "").trim()) {
      setEnrichQualifySaveError("Select a base template first (we store it with the prospect).");
      return;
    }

    setEnrichQualifySaveBusy(true);
    setEnrichQualifySaveError(null);
    setEnrichQualifySaveSummary(null);
    setEnrichQualifySaveLogs([]);

    try {
      const token = await getSessionToken();
      const accountHeader = getActiveAccountHeader();

      const items = selected
        .map((u) => {
          const hit = (followingItems || []).find((it) => String(it?.username || "").replace(/^@+/, "").trim().toLowerCase() === u);
          if (!hit) return null;
          return {
            username: hit.username,
            fullName: hit.fullName,
            profilePicUrl: hit.profilePicUrl,
            isVerified: hit.isVerified,
            isPrivate: hit.isPrivate,
            raw: hit.raw,
          };
        })
        .filter(Boolean) as Array<
        Pick<outreachApi.ScrapeFollowingItem, "username" | "fullName" | "profilePicUrl" | "isVerified" | "isPrivate" | "raw">
      >;

      const pushLog = (line: string) => {
        const txt = String(line || '').trim();
        if (!txt) return;
        setEnrichQualifySaveLogs((prev) => {
          const next = [...(prev || []), txt];
          return next.length > 200 ? next.slice(next.length - 200) : next;
        });
      };

      const out = await outreachApi.enrichQualifySaveFollowingStream({
        token,
        seedInstagramUrl: seedUrl,
        seedUsername: seedU,
        baseTemplateId: baseTemplateId || null,
        items,
        headers: accountHeader,
        onEvent: (evt) => {
          if (evt.type === 'stage') pushLog(`[${evt.stage}] ${evt.message}`);
          if (evt.type === 'progress') pushLog(`[${evt.stage}] ${evt.done}/${evt.total}`);
          if (evt.type === 'row') {
            const u = String(evt.username || '').trim();
            if (evt.ok) pushLog(`[${evt.stage}] @${u} ok`);
            else pushLog(`[${evt.stage}] @${u} ERROR: ${String(evt.error || 'Failed')}`);
          }
          if (evt.type === 'fatal') pushLog(`[fatal] ${String(evt.error || 'Failed')}`);
        },
      });

      setEnrichQualifySaveSummary(out.summary || null);

      const nextQual = { ...(liteQualByUsername || {}) };
      const nextHd = { ...(enrichedHdByUsername || {}) };
      const failures: string[] = [];

      for (const r of out.results || []) {
        const uname = String((r as any)?.username || "")
          .replace(/^@+/, "")
          .trim()
          .toLowerCase();
        if (!uname) continue;

        const enr = (r as any)?.enriched ?? null;
        if (enr?.ok) {
          setEnrichedOkByUsername((prev) => ({ ...(prev || {}), [uname]: true }));
          setDbCheckedByUsername((prev) => ({ ...(prev || {}), [uname]: true }));
          setDbEnrichedByUsername((prev) => ({ ...(prev || {}), [uname]: true }));
          if (typeof enr?.followingCount === "number" && Number.isFinite(enr.followingCount)) {
            setFollowingCountByUsername((prev) => ({ ...(prev || {}), [uname]: Math.floor(enr.followingCount) }));
          }
        }
        if (enr?.ok && enr?.profilePicUrlHD) nextHd[uname] = String(enr.profilePicUrlHD);

        const qual = (r as any)?.qualified ?? null;
        if (qual?.ok && qual?.data) {
          nextQual[uname] = qual.data as outreachApi.LiteQualification;
        } else {
          const e1 = typeof enr?.error === "string" ? enr.error : null;
          const e2 = typeof qual?.error === "string" ? qual.error : null;
          if (e1 || e2) failures.push(`@${uname}: ${String(e1 || e2)}`);
        }
      }

      setLiteQualByUsername(nextQual);
      setEnrichedHdByUsername(nextHd);

      if (failures.length) {
        setEnrichQualifySaveError(`Some rows failed. ${failures.length} issue(s). First few: ${failures.slice(0, 5).join(" • ")}`);
      }
    } catch (e: any) {
      setEnrichQualifySaveError(String(e?.message || e || "Enrich + Qualify + Save failed"));
    } finally {
      setEnrichQualifySaveBusy(false);
    }
  }, [
    anyBusy,
    baseTemplateId,
    enrichedHdByUsername,
    enrichQualifySaveBusy,
    followingItems,
    getSeedInfoBestEffort,
    liteQualByUsername,
    selectedUsernames,
  ]);

  const handleSelectNext25NotEnriched = useCallback(async () => {
    if (anyBusy) return;
    const HARD_CAP = 25;

    const rows = followingFiltered;
    const allUsernamesInOrder = rows
      .map((it) => String(it?.username || '').replace(/^@+/, '').trim().toLowerCase())
      .filter(Boolean);
    if (!allUsernamesInOrder.length) return;

    // Best-effort DB lookup so we don't re-enrich duplicates across multiple seed scrapes.
    try {
      const unknown = allUsernamesInOrder.filter((u) => !dbCheckedByUsername[u]);
      if (unknown.length) {
        const token = await getSessionToken();
        const accountHeader = getActiveAccountHeader();
        const chunk = unknown.slice(0, 400);
        const enrichedSet = await outreachApi.getAlreadyEnrichedFollowingUsernames({ token, usernames: chunk, headers: accountHeader });

        setDbCheckedByUsername((prev) => {
          const next = { ...(prev || {}) };
          for (const u of chunk) next[u] = true;
          return next;
        });
        setDbEnrichedByUsername((prev) => {
          const next = { ...(prev || {}) };
          for (const u of enrichedSet) next[u] = true;
          return next;
        });
      }
    } catch (e: any) {
      setEnrichQualifySaveError(String(e?.message || e || 'Failed to load enrichment status'));
    }

    const isEnriched = (u: string) => !!enrichedOkByUsername[u] || !!dbEnrichedByUsername[u];

    const picked: Array<{ username: string; idx: number }> = [];
    for (let i = 0; i < rows.length; i++) {
      const u = String(rows[i]?.username || '').replace(/^@+/, '').trim().toLowerCase();
      if (!u) continue;
      if (isEnriched(u)) continue;
      picked.push({ username: u, idx: i });
      if (picked.length >= HARD_CAP) break;
    }

    setFollowingSelectedKeys(new Set(picked.map((p) => `u:${p.username}`)));

    const maxIdx = picked.reduce((m, p) => Math.max(m, p.idx), -1);
    if (maxIdx >= 0) setFollowingVisibleCount((n) => Math.max(Number(n || 0), maxIdx + 1));
  }, [anyBusy, dbCheckedByUsername, dbEnrichedByUsername, enrichedOkByUsername, followingFiltered]);

  const handlePipelineRefresh = useCallback(async () => {
    if (pipelineBusyRef.current) return;
    setPipelineBusy(true);
    setPipelineError(null);
    try {
      const token = await getSessionToken();
      const accountHeader = getActiveAccountHeader();
      const out = await outreachApi.pipelineList({
        token,
        q: String(pipelineSearchRef.current || '').trim() || null,
        stage: pipelineStageFilterRef.current ? (pipelineStageFilterRef.current as any) : null,
        headers: accountHeader,
      });
      const rows = Array.isArray(out?.rows) ? out.rows : [];
      setPipelineRows(rows);
      // Seed drafts so inputs stay stable while typing.
      setPipelineReelUrlDraftByUsername((prev) => {
        const next = { ...(prev || {}) };
        for (const r of rows) {
          const u = String(r?.username || '').toLowerCase();
          if (!u) continue;
          if (next[u] === undefined) next[u] = String(r?.sourcePostUrl || '');
        }
        return next;
      });
      setPipelineLastContactDraftByUsername((prev) => {
        const next = { ...(prev || {}) };
        for (const r of rows) {
          const u = String(r?.username || '').toLowerCase();
          if (!u) continue;
          if (next[u] === undefined) next[u] = String(r?.lastContactDate || '');
        }
        return next;
      });
      setPipelineStageDraftByUsername((prev) => {
        const next = { ...(prev || {}) };
        for (const r of rows) {
          const u = String(r?.username || '').toLowerCase();
          if (!u) continue;
          if (!next[u] && r?.pipelineStage) next[u] = r.pipelineStage as any;
        }
        return next;
      });
    } catch (e: any) {
      setPipelineError(String(e?.message || e || 'Failed to load pipeline'));
    } finally {
      setPipelineBusy(false);
    }
  }, []);

  const handlePipelineBackfillOnce = useCallback(async () => {
    if (pipelineBackfilledForOpen) return;
    setPipelineBackfilledForOpen(true);
    try {
      const token = await getSessionToken();
      const accountHeader = getActiveAccountHeader();
      await outreachApi.pipelineBackfill({ token, headers: accountHeader });
    } catch {
      // ignore (best-effort)
    }
  }, [pipelineBackfilledForOpen]);

  useEffect(() => {
    if (!open) return;
    if (tab !== 'pipeline') return;
    void (async () => {
      if (pipelineDidInitForOpenRef.current) return;
      pipelineDidInitForOpenRef.current = true;
      await handlePipelineBackfillOnce();
      await handlePipelineRefresh();
    })();
  }, [open, tab, handlePipelineBackfillOnce, handlePipelineRefresh]);

  async function apiScrapeInstagramProfile(args: { instagramUrl: string }) {
    const token = await getSessionToken();
    const instagramUrl = String(args.instagramUrl || "").trim();
    if (!instagramUrl) throw new Error("Instagram URL is required");

    const res = await fetch("/api/editor/outreach/apify-probe", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ instagramUrl }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) throw new Error(String(j?.error || `Scrape failed (${res.status})`));
    const d = j?.data || null;
    return {
      fullName: typeof d?.fullName === "string" ? d.fullName : d?.fullName ?? null,
      username: typeof d?.username === "string" ? d.username : d?.username ?? null,
      profilePicUrlHD: typeof d?.profilePicUrlHD === "string" ? d.profilePicUrlHD : d?.profilePicUrlHD ?? null,
      raw: d?.raw ?? null,
    };
  }

  async function apiScrapeInstagramReel(args: { reelUrl: string; signal?: AbortSignal }) {
    const token = await getSessionToken();
    const reelUrl = canonicalizeInstagramPostOrReelUrlClient(String(args.reelUrl || "").trim());
    if (!reelUrl) throw new Error("Reel/Post URL is required");
    const accountHeader = getActiveAccountHeader();
    return await outreachApi.scrapeReel({ token, reelUrl, headers: accountHeader, signal: args.signal });
  }

  async function apiCreateTemplate(args: {
    baseTemplateId: string;
    scraped: { fullName: string | null; username: string | null; profilePicUrlHD: string | null; raw: any };
  }) {
    const token = await getSessionToken();
    const accountHeader = getActiveAccountHeader();
    const res = await fetch("/api/editor/outreach/create-template", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...accountHeader },
      body: JSON.stringify({ baseTemplateId: args.baseTemplateId, scraped: args.scraped }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) throw new Error(String(j?.error || `Create template failed (${res.status})`));
    const templateId = String(j?.templateId || "").trim();
    const templateName = String(j?.templateName || "").trim();
    if (!templateId) throw new Error("Create template returned no templateId");
    return { templateId, templateName };
  }

  async function apiCreateRegularProject(args: { title: string }) {
    const token = await getSessionToken();
    const accountHeader = getActiveAccountHeader();
    const res = await fetch("/api/editor/projects/create", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...accountHeader },
      body: JSON.stringify({ templateTypeId: "regular", title: args.title }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to create project (${res.status})`));
    const projectId = String(j?.project?.id || "").trim();
    if (!projectId) throw new Error("Project creation returned no id");
    return { projectId };
  }

  async function apiApplyProjectMappings(args: { projectId: string; templateId: string }) {
    const token = await getSessionToken();
    const accountHeader = getActiveAccountHeader();
    const res = await fetch("/api/editor/projects/update-mappings", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...accountHeader },
      body: JSON.stringify({
        projectId: args.projectId,
        slide1TemplateIdSnapshot: args.templateId,
        slide2to5TemplateIdSnapshot: args.templateId,
        slide6TemplateIdSnapshot: args.templateId,
      }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to apply template mappings (${res.status})`));
  }

  async function apiUpdateProjectOutreachMessage(args: { projectId: string; outreachMessage: string }) {
    const token = await getSessionToken();
    const accountHeader = getActiveAccountHeader();
    const res = await fetch("/api/editor/projects/update", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...accountHeader },
      body: JSON.stringify({ projectId: args.projectId, outreachMessage: args.outreachMessage }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to set outreach message (${res.status})`));
  }

  function buildOutreachMessage(args: { name: string; topicLine?: string | null }) {
    const safeName = String(args.name || "").trim() || "there";
    const topic = String(args.topicLine || "").trim();
    const about = topic ? ` about ${topic}` : "";
    return `Hey ${safeName}, made you this carousel from one of your recent posts${about}.\n\nThis same format helped grow @thefittestdoc from 50K to 240K in 6 months through consistent posting.\n\nWant the full version?`;
  }

  async function apiPersistTarget(args: {
    instagramUrl: string;
    scraped: { fullName: string | null; username: string | null; profilePicUrlHD: string | null; raw: any } | null;
    baseTemplateId: string | null;
    createdTemplateId: string;
    createdProjectId: string;
    sourcePost?: {
      url: string | null;
      shortcode: string | null;
      caption: string | null;
      transcript: string | null;
      raw: any;
      scrapedAt?: string | null;
    } | null;
  }) {
    const token = await getSessionToken();
    const accountHeader = getActiveAccountHeader();
    const res = await fetch("/api/editor/outreach/persist-target", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...accountHeader },
      body: JSON.stringify({
        instagramUrl: args.instagramUrl,
        fullName: args.scraped?.fullName ?? null,
        username: args.scraped?.username ?? null,
        profilePicUrlHD: args.scraped?.profilePicUrlHD ?? null,
        rawJson: args.scraped?.raw ?? null,
        baseTemplateId: args.baseTemplateId,
        createdTemplateId: args.createdTemplateId,
        createdProjectId: args.createdProjectId,
        sourcePostUrl: args.sourcePost?.url ?? null,
        sourcePostShortcode: args.sourcePost?.shortcode ?? null,
        sourcePostCaption: args.sourcePost?.caption ?? null,
        sourcePostTranscript: args.sourcePost?.transcript ?? null,
        sourcePostRawJson: args.sourcePost?.raw ?? null,
        sourcePostScrapedAt: args.sourcePost?.scrapedAt ?? null,
      }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to save outreach record (${res.status})`));
    return { id: String(j?.id || "").trim() };
  }

  const handleScrape = async () => {
    if (!canScrape || scrapeBusy) return;
    setScrapeBusy(true);
    setScrapeError(null);
    setCreateError(null);
    setProjectError(null);
    setPersistError(null);
    setScraped(null);
    setReelScraped(null);
    try {
      if (singleMode === "profile") {
      const data = await apiScrapeInstagramProfile({ instagramUrl });
      setScraped(data);
      } else {
        const controller = new AbortController();
        scrapeAbortRef.current = controller;
        const data = await apiScrapeInstagramReel({ reelUrl, signal: controller.signal });
        setReelScraped(data);
      }
    } catch (e: any) {
      if (String(e?.name || "") === "AbortError") {
        // User cancelled; no error toast needed.
      } else {
      setScrapeError(String(e?.message || e || "Scrape failed"));
      }
    } finally {
      scrapeAbortRef.current = null;
      setScrapeBusy(false);
    }
  };

  const displayHandle = useMemo(() => {
    const u = String(scraped?.username || "").trim();
    if (!u) return null;
    return u.startsWith("@") ? u : `@${u}`;
  }, [scraped?.username]);

  const reelOwnerUsername = useMemo(() => {
    const u = String(reelScraped?.ownerUsername || "").replace(/^@+/, "").trim();
    return u || (String(forcedReelOwnerUsername || "").trim() ? String(forcedReelOwnerUsername || "").trim() : null);
  }, [forcedReelOwnerUsername, reelScraped?.ownerUsername]);

  const reelOwnerProfileUrl = useMemo(() => {
    if (!reelOwnerUsername) return null;
    return `https://www.instagram.com/${reelOwnerUsername}/`;
  }, [reelOwnerUsername]);

  const canCreateTemplates = useMemo(() => {
    const hasBase = !!String(baseTemplateId || "").trim();
    if (!hasBase) return false;
    if (singleMode === "profile") {
      return !!scraped && !!displayHandle && !!String(scraped?.profilePicUrlHD || "").trim();
    }
    // Reel/Post mode: we will scrape the owner's profile on-demand to get the avatar.
    return !!reelOwnerUsername && !!reelOwnerProfileUrl;
  }, [baseTemplateId, displayHandle, reelOwnerProfileUrl, reelOwnerUsername, scraped, singleMode]);

  const projectTitle = useMemo(() => {
    if (singleMode === "reel") {
      const name = sanitizeTemplateName(String(reelScraped?.ownerFullName || "").trim());
      return name || (reelOwnerUsername ? `@${reelOwnerUsername}` : "") || "Untitled Project";
    }
    const name = sanitizeTemplateName(String(scraped?.fullName || "").trim());
    return name || displayHandle || "Untitled Project";
  }, [displayHandle, reelOwnerUsername, reelScraped?.ownerFullName, scraped?.fullName, singleMode]);

  const handleCreateTemplate = async () => {
    if (!canCreateTemplates || createBusy) return;
    setCreateBusy(true);
    setCreateError(null);
    setCreatedTemplate(null);
    setProjectError(null);

    try {
      if (singleMode === "reel") {
        if (!reelOwnerProfileUrl) throw new Error("Missing reel owner profile URL");
        const forcedHd =
          reelOwnerUsername &&
          String(forcedReelOwnerUsername || "").trim().toLowerCase() === String(reelOwnerUsername || "").trim().toLowerCase() &&
          String(forcedReelOwnerProfilePicUrlHD || "").trim()
            ? String(forcedReelOwnerProfilePicUrlHD || "").trim()
            : null;

        // If we already have an HD avatar saved (from Enrich+Qualify+Save), skip re-scraping the owner's profile.
        const ownerProfile = forcedHd
          ? ({
              fullName: String(forcedReelOwnerFullName || "").trim() || null,
              username: reelOwnerUsername,
              profilePicUrlHD: forcedHd,
              raw: null,
            } as any)
          : await (async () => {
              setScrapeBusy(true);
              const p = await apiScrapeInstagramProfile({ instagramUrl: reelOwnerProfileUrl });
              setScraped(p);
              setInstagramUrl(reelOwnerProfileUrl);
              setScrapeBusy(false);
              return p;
            })();

        if (!String(ownerProfile?.profilePicUrlHD || "").trim()) {
          throw new Error("Scrape missing profilePicUrlHD (owner profile).");
        }

        const scrapedForTemplate = {
          fullName: String(reelScraped?.ownerFullName || "").trim() || ownerProfile.fullName || null,
          username: reelOwnerUsername,
          profilePicUrlHD: ownerProfile.profilePicUrlHD,
          raw: { profile: ownerProfile.raw ?? null, post: reelScraped?.raw ?? null },
        };

        const out = await apiCreateTemplate({ baseTemplateId, scraped: scrapedForTemplate });
        setCreatedTemplate({ id: out.templateId, name: out.templateName });
        actions?.onRefreshTemplatesList?.();
        return;
      }

      const out = await apiCreateTemplate({
        baseTemplateId,
        scraped: {
          fullName: scraped?.fullName ?? null,
          username: scraped?.username ?? null,
          profilePicUrlHD: scraped?.profilePicUrlHD ?? null,
          raw: scraped?.raw ?? null,
        },
      });
      setCreatedTemplate({ id: out.templateId, name: out.templateName });
      actions?.onRefreshTemplatesList?.();
    } catch (e: any) {
      setScrapeBusy(false);
      setCreateError(String(e?.message || e || "Create template failed"));
    } finally {
      setCreateBusy(false);
      // Clear forced overrides after any attempt so normal Single Profile flow isn't affected.
      setForcedReelOwnerUsername(null);
      setForcedReelOwnerFullName(null);
      setForcedReelOwnerProfilePicUrlHD(null);
    }
  };

  const canCreateProject = useMemo(() => {
    return !!createdTemplate?.id && !createdProjectId;
  }, [createdProjectId, createdTemplate?.id]);

  const canPersistTarget = useMemo(() => {
    if (!createdTemplate?.id || !createdProjectId || persistedTargetId) return false;
    if (singleMode === "reel") return !!reelScraped && !!reelOwnerProfileUrl;
    return true;
  }, [createdProjectId, createdTemplate?.id, persistedTargetId, reelOwnerProfileUrl, reelScraped, singleMode]);

  const persistTarget = async (args: { projectId: string }) => {
    const pid = String(args.projectId || "").trim();
    if (!pid) return;
    if (!createdTemplate?.id) return;
    if (persistBusy) return;
    setPersistBusy(true);
    setPersistError(null);
    try {
      const effectiveInstagramUrl = singleMode === "reel" ? String(reelOwnerProfileUrl || "").trim() : String(instagramUrl || "").trim();
      if (!effectiveInstagramUrl) throw new Error("Missing Instagram profile URL for outreach record");

      const effectiveScraped =
        singleMode === "reel"
          ? ({
              fullName: String(reelScraped?.ownerFullName || "").trim() || scraped?.fullName || null,
              username: reelOwnerUsername || scraped?.username || null,
              profilePicUrlHD: scraped?.profilePicUrlHD ?? null,
              raw: { profile: scraped?.raw ?? null, post: reelScraped?.raw ?? null },
            } as any)
          : scraped;

      const out = await apiPersistTarget({
        instagramUrl: effectiveInstagramUrl,
        scraped: effectiveScraped,
        baseTemplateId: baseTemplateId || null,
        createdTemplateId: createdTemplate.id,
        createdProjectId: pid,
        sourcePost:
          singleMode === "reel"
            ? {
                url: reelScraped?.reelUrl ?? null,
                shortcode: reelScraped?.shortcode ?? null,
                caption: reelScraped?.caption ?? null,
                transcript: reelScraped?.transcript ?? null,
                raw: reelScraped?.raw ?? null,
                scrapedAt: new Date().toISOString(),
              }
            : null,
      });
      setPersistedTargetId(out.id);
    } catch (e: any) {
      setPersistError(String(e?.message || e || "Failed to save outreach record"));
    } finally {
      setPersistBusy(false);
    }
  };

  const handleCreateProject = async () => {
    if (!canCreateProject || projectBusy || createBusy) return;
    setProjectBusy(true);
    setProjectError(null);
    setPersistError(null);
    try {
      const { projectId } = await apiCreateRegularProject({ title: projectTitle });
      await apiApplyProjectMappings({ projectId, templateId: String(createdTemplate?.id || "") });

      setCreatedProjectId(projectId);

      // Save the outreach DM message onto the project (separate from the IG caption).
      try {
        if (singleMode === "reel") {
          const token = await getSessionToken();
          const accountHeader = getActiveAccountHeader();
          let topicLine: string | null = null;
          try {
            const topic = await outreachApi.generateTopicLine({
              token,
              caption: reelScraped?.caption ?? null,
              transcript: reelScraped?.transcript ?? null,
              headers: accountHeader,
            });
            topicLine = String(topic.topicLine || "").trim() || null;
          } catch {
            topicLine = null;
          }
          const nameForCaption =
            sanitizeTemplateName(String(reelScraped?.ownerFullName || "").trim()) ||
            (reelOwnerUsername ? `@${reelOwnerUsername}` : "") ||
            "there";
          await apiUpdateProjectOutreachMessage({
            projectId,
            outreachMessage: buildOutreachMessage({ name: nameForCaption, topicLine }),
          });
        } else {
        const nameForCaption = String(scraped?.fullName || "").trim() || String(displayHandle || "").trim() || "there";
          await apiUpdateProjectOutreachMessage({
            projectId,
            outreachMessage: buildOutreachMessage({ name: nameForCaption }),
          });
        }
      } catch (e: any) {
        setProjectError(String(e?.message || e || "Failed to set outreach message"));
      }

      // 3) Persist outreach record (Phase 6) then load the newly created project.
      // If persistence fails, keep the modal open so user can retry "Save record" without creating another project.
      await persistTarget({ projectId });

      actions?.onLoadProject?.(projectId);
      // Reel/Post: set review fields after project load (avoid race where UI doesn't reflect updates).
      if (singleMode === "reel" && reelScraped?.reelUrl) {
        void setReelReviewFieldsBestEffort({ projectId, reelUrl: reelScraped.reelUrl });
      }
    } catch (e: any) {
      setProjectError(String(e?.message || e || "Create project failed"));
    } finally {
      setProjectBusy(false);
    }
  };

  const canRunAll = useMemo(() => {
    if (singleMode === "profile") return !!String(instagramUrl || "").trim() && !!String(baseTemplateId || "").trim();
    return !!String(reelUrl || "").trim() && !!String(baseTemplateId || "").trim();
  }, [baseTemplateId, instagramUrl, reelUrl, singleMode]);

  const handleRunOutreach = async () => {
    if (!canRunAll || anyBusy) return;

    setScrapeError(null);
    setCreateError(null);
    setProjectError(null);
    setPersistError(null);
    setPersistedTargetId(null);
    setCreatedTemplate(null);
    setCreatedProjectId(null);

    try {
      if (singleMode === "profile") {
        // 1) Scrape profile
      setScrapeBusy(true);
      const scrapedData = await apiScrapeInstagramProfile({ instagramUrl });
      setScraped(scrapedData);
      setScrapeBusy(false);

      // 2) Create template
      setCreateBusy(true);
      const tpl = await apiCreateTemplate({ baseTemplateId, scraped: scrapedData });
      setCreatedTemplate({ id: tpl.templateId, name: tpl.templateName });
      setCreateBusy(false);
      actions?.onRefreshTemplatesList?.();

      // 3) Create project + mappings
      setProjectBusy(true);
        const { projectId } = await apiCreateRegularProject({
          title:
            sanitizeTemplateName(scrapedData.fullName || "") ||
            `@${String(scrapedData.username || "").replace(/^@+/, "")}` ||
            "Untitled Project",
        });
      await apiApplyProjectMappings({ projectId, templateId: tpl.templateId });
      setCreatedProjectId(projectId);
      setProjectBusy(false);

      // 4) Persist record (Phase 6)
      setPersistBusy(true);
      const persisted = await apiPersistTarget({
        instagramUrl,
        scraped: scrapedData,
        baseTemplateId: baseTemplateId || null,
        createdTemplateId: tpl.templateId,
        createdProjectId: projectId,
      });
      setPersistedTargetId(persisted.id);
      setPersistBusy(false);

        // 5) Outreach message
      setProjectBusy(true);
      const nameForCaption =
        String(scrapedData.fullName || "").trim() ||
        (scrapedData.username ? `@${String(scrapedData.username || "").replace(/^@+/, "")}` : "") ||
        "there";
        await apiUpdateProjectOutreachMessage({
          projectId,
          outreachMessage: buildOutreachMessage({ name: nameForCaption }),
        });
      setProjectBusy(false);

      actions?.onLoadProject?.(projectId);
      actions?.onCloseOutreachModal?.();
      } else {
        // Reel/Post outreach (Phase 7): scrape reel → scrape owner profile → topic line → template → project → persist → review flags.
        setScrapeBusy(true);
        const reelData = await apiScrapeInstagramReel({ reelUrl });
        setReelScraped(reelData);
        setScrapeBusy(false);

        const ownerUsername =
          String(reelData?.ownerUsername || "")
            .replace(/^@+/, "")
            .trim() || String(forcedReelOwnerUsername || "").replace(/^@+/, "").trim();
        if (!ownerUsername) throw new Error("Reel scrape missing ownerUsername");
        const ownerProfileUrl = `https://www.instagram.com/${ownerUsername}/`;

        const forcedHd =
          String(forcedReelOwnerProfilePicUrlHD || "").trim() &&
          String(forcedReelOwnerUsername || "")
            .replace(/^@+/, "")
            .trim()
            .toLowerCase() === String(ownerUsername || '').trim().toLowerCase()
            ? String(forcedReelOwnerProfilePicUrlHD || "").trim()
            : null;

        // Optimization: if we already enriched this profile (HD avatar saved), skip scraping the owner profile again.
        const ownerProfile = forcedHd
          ? ({
              fullName: String(forcedReelOwnerFullName || "").trim() || null,
              username: ownerUsername,
              profilePicUrlHD: forcedHd,
              raw: null,
            } as any)
          : await (async () => {
              setScrapeBusy(true);
              const p = await apiScrapeInstagramProfile({ instagramUrl: ownerProfileUrl });
              setScraped(p);
              setScrapeBusy(false);
              return p;
            })();

        // Keep these in sync so persistence uses the right profile URL.
        setInstagramUrl(ownerProfileUrl);
        if (forcedHd) {
          setScraped(ownerProfile);
        }

        const token = await getSessionToken();
        const accountHeader = getActiveAccountHeader();
        let topicLine: string | null = null;
        try {
          const topic = await outreachApi.generateTopicLine({
            token,
            caption: reelData.caption,
            transcript: reelData.transcript,
            headers: accountHeader,
          });
          topicLine = String(topic.topicLine || "").trim() || null;
        } catch {
          topicLine = null;
        }

        const scrapedForTemplate = {
          fullName: String(reelData.ownerFullName || "").trim() || ownerProfile.fullName || null,
          username: ownerUsername,
          profilePicUrlHD: ownerProfile.profilePicUrlHD,
          raw: { profile: ownerProfile.raw ?? null, post: reelData.raw ?? null },
        };

        setCreateBusy(true);
        const tpl = await apiCreateTemplate({ baseTemplateId, scraped: scrapedForTemplate });
        setCreatedTemplate({ id: tpl.templateId, name: tpl.templateName });
        setCreateBusy(false);
        actions?.onRefreshTemplatesList?.();

        setProjectBusy(true);
        const { projectId } = await apiCreateRegularProject({
          title: sanitizeTemplateName(scrapedForTemplate.fullName || "") || `@${ownerUsername}` || "Untitled Project",
        });
        await apiApplyProjectMappings({ projectId, templateId: tpl.templateId });
        setCreatedProjectId(projectId);

        const nameForCaption = sanitizeTemplateName(String(scrapedForTemplate.fullName || "").trim()) || `@${ownerUsername}` || "there";
        await apiUpdateProjectOutreachMessage({
          projectId,
          outreachMessage: buildOutreachMessage({ name: nameForCaption, topicLine }),
        });
        setProjectBusy(false);

        setPersistBusy(true);
        const persisted = await apiPersistTarget({
          instagramUrl: ownerProfileUrl,
          scraped: scrapedForTemplate,
          baseTemplateId: baseTemplateId || null,
          createdTemplateId: tpl.templateId,
          createdProjectId: projectId,
          sourcePost: {
            url: reelData.reelUrl,
            shortcode: reelData.shortcode,
            caption: reelData.caption,
            transcript: reelData.transcript,
            raw: reelData.raw,
            scrapedAt: new Date().toISOString(),
          },
        });
        setPersistedTargetId(persisted.id);
        setPersistBusy(false);

        // Load project and set review flags (best-effort).
        actions?.onLoadProject?.(projectId);
        void setReelReviewFieldsBestEffort({ projectId, reelUrl: reelData.reelUrl });

        actions?.onCloseOutreachModal?.();

        // Phase 10: Auto-generate copy for Reel/Post outreach.
        // - If transcript exists: trigger Generate Copy after project loads.
        // - If transcript missing: show "Transcribing…" in the Generate Copy status area (red),
        //   run Whisper, then trigger Generate Copy when transcript is ready.
        const hasTranscript = !!String(reelData.transcript || "").trim();
        if (hasTranscript) {
          void (async () => {
            try {
              await waitForProjectLoaded(projectId);
              actions?.onClickGenerateCopy?.();
            } catch {
              // ignore
            }
          })();
        } else {
          try {
            actions?.onSetGenerateCopyUi?.({
              projectId,
              state: "running",
              label: "Transcribing… Copy will generate when ready.",
              error: null,
            });
          } catch {
            // ignore
          }

          void (async () => {
            try {
              const vid = await outreachApi.downloadReelVideo({
                token,
                reelUrl: reelData.reelUrl,
                shortcode: reelData.shortcode,
                projectId,
                headers: accountHeader,
              });
              const tr = await outreachApi.transcribeStoredReelVideo({
                token,
                bucket: vid.bucket,
                path: vid.path,
                headers: accountHeader,
              });
              await outreachApi.updateTarget({
                token,
                id: persisted.id,
                patch: {
                  sourcePostTranscript: tr.transcript,
                  sourcePostVideoStorageBucket: vid.bucket,
                  sourcePostVideoStoragePath: vid.path,
                  sourcePostWhisperUsed: true,
                },
                headers: accountHeader,
              });

              await waitForProjectLoaded(projectId);
              actions?.onClickGenerateCopy?.();
            } catch (e: any) {
              try {
                actions?.onSetGenerateCopyUi?.({
                  projectId,
                  state: "error",
                  label: "Error",
                  error: String(e?.message || e || "Transcription failed"),
                });
              } catch {
                // ignore
              }
            }
          })();
        }
      }
    } catch (e: any) {
      // Ensure busy flags are cleared; keep modal open with error.
      setScrapeBusy(false);
      setCreateBusy(false);
      setProjectBusy(false);
      setPersistBusy(false);
      const msg = String(e?.message || e || "Outreach failed");
      // Put it in the top error bucket so user sees it immediately.
      setProjectError(msg);
    }
  };

  const TabButton = (props: { id: "single" | "following" | "pipeline"; label: string }) => {
    const active = tab === props.id;
    return (
      <button
        type="button"
        className={[
          "h-9 px-3 rounded-xl text-sm font-semibold border shadow-sm transition-colors",
          active ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
        ].join(" ")}
        onClick={() => setTab(props.id)}
        disabled={anyBusy}
        aria-pressed={active}
      >
        {props.label}
      </button>
    );
  };

  const AvatarThumb = (props: { url: string | null }) => {
    const url = String(props.url || "").trim();
    return (
      <div
        className="h-9 w-9 rounded-full border border-slate-200 bg-slate-100 shrink-0"
        style={url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        title={url || ""}
        aria-label="Profile photo"
      />
    );
  };

  const ModeButton = (props: { id: "reel" | "profile"; label: string }) => {
    const active = singleMode === props.id;
    return (
      <button
        type="button"
        className={[
          "h-9 px-3 rounded-xl text-sm font-semibold border shadow-sm transition-colors",
          active ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
        ].join(" ")}
        onClick={() => {
          if (anyBusy) return;
          setSingleMode(props.id);
          // Avoid confusing stale results when switching modes.
          setScrapeError(null);
          setScraped(null);
          setReelScraped(null);
          setCreateError(null);
          setCreatedTemplate(null);
          setProjectError(null);
          setCreatedProjectId(null);
          setPersistError(null);
          setPersistedTargetId(null);
        }}
        disabled={anyBusy}
        aria-pressed={active}
      >
        {props.label}
      </button>
    );
  };

  const BusyOverlay = (props: { label: string | null }) => {
    const label = String(props.label || "").trim();
    if (!label) return null;
    return (
      <div className="absolute inset-0 z-[2] flex items-center justify-center bg-white/30 backdrop-blur-[1px]">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
          <div className="text-sm font-semibold text-slate-900">{label}</div>
        </div>
      </div>
    );
  };

  if (!open || !isSuperadmin) return null;

  return (
    <div
      className="fixed inset-0 z-[122] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) actions?.onCloseOutreachModal?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Outreach"
    >
      <div className="w-full max-w-6xl max-h-[85vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-sm font-semibold text-slate-900">Outreach</div>
            {busyLabel ? (
              <span className="px-2 py-1 rounded-full text-[11px] font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                {busyLabel}
              </span>
            ) : null}
            {persistedTargetId ? (
              <span className="px-2 py-1 rounded-full text-[11px] font-semibold border border-green-200 bg-green-50 text-green-800">
                Saved
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm transition-colors disabled:opacity-60"
              onClick={resetAll}
              title="Reset"
              disabled={anyBusy}
            >
              Reset
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm transition-colors disabled:opacity-60"
              onClick={actions?.onCloseOutreachModal}
              title="Close"
              disabled={anyBusy}
            >
              Close
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto p-5 space-y-4">
          <BusyOverlay label={busyLabel} />
          <div className="flex items-center gap-2">
            <TabButton id="single" label="Single profile" />
            <TabButton id="following" label="Scrape following" />
            <TabButton id="pipeline" label="Pipeline" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Base template</div>
            <select
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-60"
              value={baseTemplateId}
              onChange={(e) => setBaseTemplateId(String(e.target.value || ""))}
              disabled={loadingTemplates}
              aria-label="Select base template"
              title="Select base template"
            >
              <option value="">
                {loadingTemplates ? "Loading templates…" : templates.length > 0 ? "Select template…" : "No templates found"}
              </option>
              {templates.map((t: any) => (
                <option key={String(t?.id || "")} value={String(t?.id || "")}>
                  {String(t?.name || "Template")}
                </option>
              ))}
            </select>
          </div>

          {tab === "single" ? (
            <>
          <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Mode</div>
                <div className="flex items-center gap-2">
                  <ModeButton id="reel" label="Reel/Post" />
                  <ModeButton id="profile" label="Profile" />
                </div>
                <div className="text-[11px] text-slate-500">
                      {singleMode === "reel"
                        ? "Reel/Post mode is live (scrape reel → create template → create project)."
                        : "Profile mode is live (scrape profile → create template → create project)."}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  {singleMode === "reel" ? "Instagram Reel/Post" : "Instagram profile"}
                </div>
            <div className="flex items-center gap-2">
              <input
                className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                    value={singleMode === "reel" ? reelUrl : instagramUrl}
                    onChange={(e) => (singleMode === "reel" ? setReelUrl(e.target.value) : setInstagramUrl(e.target.value))}
                    onBlur={() => {
                      if (singleMode !== "reel") return;
                      const next = canonicalizeInstagramPostOrReelUrlClient(reelUrl);
                      if (next && next !== reelUrl) setReelUrl(next);
                    }}
                    placeholder={singleMode === "reel" ? "https://www.instagram.com/p/SHORTCODE/" : "https://www.instagram.com/username/"}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="h-10 px-4 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                disabled={!canScrape || scrapeBusy || anyBusy}
                onClick={() => void handleScrape()}
                    title={singleMode === "profile" ? "Scrape Instagram profile" : "Scrape Instagram Reel/Post"}
              >
                {scrapeBusy ? "Scraping…" : "Scrape"}
              </button>
                  {singleMode === "reel" && scrapeBusy ? (
                    <button
                      type="button"
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold shadow-sm hover:bg-slate-50"
                      onClick={() => {
                        try {
                          scrapeAbortRef.current?.abort();
                        } catch {
                          // ignore
                        }
                      }}
                      title="Cancel the scrape request"
                    >
                      Cancel
                    </button>
                  ) : null}
            </div>
                {singleMode === "reel" && scrapeBusy && scrapeProgressLabel ? (
                  <div className="text-[11px] text-slate-600">{scrapeProgressLabel}</div>
                ) : null}
                {singleMode === "reel" && !scrapeBusy ? (
                  <div className="text-[11px] text-slate-500">
                    Tip: paste `/reel/SHORTCODE/` or `/p/SHORTCODE/`. If you paste `/reels/…`, we’ll auto-fix it.
                  </div>
                ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-700">Scraped data</div>
                {singleMode !== "profile" ? (
                  reelScraped ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-600">Owner name</div>
                          <div className="mt-1 text-sm text-slate-900">
                            {reelScraped.ownerFullName ? String(reelScraped.ownerFullName) : <span className="text-slate-400">—</span>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-600">Handle</div>
                          <div className="mt-1 text-sm font-mono text-slate-900">
                            {reelScraped.ownerUsername ? `@${String(reelScraped.ownerUsername).replace(/^@+/, "")}` : <span className="text-slate-400">—</span>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-600">Shortcode</div>
                          <div className="mt-1 text-sm text-slate-900">
                            {reelScraped.shortcode ? String(reelScraped.shortcode) : <span className="text-slate-400">—</span>}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-600">Caption</div>
                          <div className="mt-2 max-h-40 overflow-auto text-xs text-slate-800 whitespace-pre-wrap">
                            {reelScraped.caption ? String(reelScraped.caption) : <span className="text-slate-400">—</span>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-[11px] font-semibold text-slate-600">Transcript</div>
                          <div className="mt-2 max-h-40 overflow-auto text-xs text-slate-800 whitespace-pre-wrap">
                            {reelScraped.transcript ? String(reelScraped.transcript) : <span className="text-slate-400">—</span>}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-600">Raw JSON</div>
                        <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800">
                          {JSON.stringify(reelScraped.raw ?? {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-600">Run a scrape to preview reel/post data here.</div>
                  )
                ) : scraped ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[11px] font-semibold text-slate-600">Profile photo URL</div>
                    <div
                      className="mt-1 break-all text-sm text-slate-900 overflow-hidden"
                      style={{
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                      }}
                    >
                      {scraped.profilePicUrlHD ? scraped.profilePicUrlHD : <span className="text-slate-400">—</span>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[11px] font-semibold text-slate-600">Profile name</div>
                    <div className="mt-1 text-sm text-slate-900">
                      {scraped.fullName ? scraped.fullName : <span className="text-slate-400">—</span>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[11px] font-semibold text-slate-600">Handle</div>
                    <div className="mt-1 text-sm text-slate-900">
                      {displayHandle ? displayHandle : <span className="text-slate-400">—</span>}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-600">Raw JSON</div>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800">
                    {JSON.stringify(scraped.raw ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">Run a scrape to preview profile data here.</div>
            )}
          </div>

          {topError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{topError}</div>
          ) : null}

              <div className="sticky bottom-0 z-[1] -mx-5 px-5 py-3 bg-white border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              className="mr-auto h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
              disabled={!canRunAll || anyBusy}
              title="One-click: scrape → create template → create project"
              onClick={() => void handleRunOutreach()}
            >
              Run outreach
            </button>
            {createdTemplate ? (
              <div className="mr-auto rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Created template: <span className="font-semibold">{createdTemplate.name}</span>
              </div>
            ) : null}
            <button
              type="button"
              className="h-10 px-4 rounded-xl bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-60"
              disabled={!canCreateTemplates || createBusy || anyBusy}
              title="Duplicate base template and apply scraped avatar/name/handle"
              onClick={() => void handleCreateTemplate()}
            >
              {createBusy ? "Creating…" : "Create Templates"}
            </button>
            <button
              type="button"
              className="h-10 px-4 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold shadow-sm disabled:opacity-60"
              disabled={!canCreateProject || projectBusy || anyBusy}
              title="Create a new Regular project and load it"
              onClick={() => void handleCreateProject()}
            >
              {projectBusy ? "Creating…" : "Create Project"}
            </button>
            <button
              type="button"
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
              disabled={!canPersistTarget || persistBusy || anyBusy}
              title="Save outreach record (mini CRM)"
              onClick={() => void persistTarget({ projectId: String(createdProjectId || "") })}
            >
              {persistBusy ? "Saving…" : "Save record"}
            </button>
          </div>
            </>
          ) : tab === "following" ? (
            <>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Seed Instagram profile</div>
                <div className="flex items-center gap-2">
                  <input
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                    value={seedInstagramUrl}
                    onChange={(e) => setSeedInstagramUrl(e.target.value)}
                    placeholder="https://www.instagram.com/username/"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={anyBusy}
                  />
                  <button
                    type="button"
                    className="h-10 px-4 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                    disabled={!canScrapeFollowing || anyBusy}
                    onClick={() => void handleScrapeFollowing()}
                    title="Scrape following list (budget-capped)"
                  >
                    {followingBusy ? "Scraping…" : "Scrape"}
                  </button>
        </div>
      </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700">Max results (up to)</div>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                    value={String(followingMaxResults)}
                    onChange={(e) => setFollowingMaxResults(Number(e.target.value))}
                    disabled={anyBusy}
                    aria-label="Max results"
                  >
                    {[1, 25, 100, 500, 1000, 5000].map((n) => (
                      <option key={n} value={String(n)}>
                        {n.toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-500">Best-effort cap. Real protection is Max spend.</div>
    </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700">Max spend (USD)</div>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                    value={String(followingMaxSpendUsd)}
                    onChange={(e) => setFollowingMaxSpendUsd(Number(e.target.value))}
                    disabled={anyBusy}
                    aria-label="Max spend"
                    title="Hard cap for Apify charges for this run"
                  >
                    {[0.5, 1, 2, 5].map((n) => (
                      <option key={String(n)} value={String(n)}>
                        ${n}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-500">Hard cap (Apify run spend limit). Default: $5.</div>
                </div>
              </div>

              {followingError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{followingError}</div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-slate-700">Results</div>
                    {followingSeedUsername ? (
                      <span className="text-xs text-slate-600">
                        Seed: <span className="font-semibold">@{String(followingSeedUsername).replace(/^@+/, "")}</span>{" "}
                        <span className="text-slate-400">•</span> Rows:{" "}
                        <span className="font-semibold">{followingFiltered.length.toLocaleString()}</span>
                        {followingFiltered.length !== followingItems.length ? (
                          <>
                            {" "}
                            <span className="text-slate-400">•</span> Total:{" "}
                            <span className="font-semibold">{followingItems.length.toLocaleString()}</span>
                          </>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Run a scrape to preview accounts here.</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      className="h-9 w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                      value={followingSearch}
                      onChange={(e) => setFollowingSearch(e.target.value)}
                      placeholder="Search name or @handle…"
                      disabled={anyBusy}
                      aria-label="Search results"
                    />
                    <input
                      className="h-9 w-[120px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                      value={minScoreFilter === null ? "" : String(minScoreFilter)}
                      onChange={(e) => {
                        const raw = String(e.target.value || "").trim();
                        if (!raw) return setMinScoreFilter(null);
                        const n = Number(raw);
                        if (!Number.isFinite(n)) return;
                        const clamped = Math.max(0, Math.min(100, Math.floor(n)));
                        setMinScoreFilter(clamped);
                      }}
                      placeholder="Min score"
                      disabled={anyBusy}
                      inputMode="numeric"
                      aria-label="Min score filter"
                      title="Filter to rows with score >= this value"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-600">
                    Selected rows: <span className="font-semibold">{followingSelectedCount.toLocaleString()}</span>{" "}
                    <span className="text-slate-400">•</span> Selected usernames:{" "}
                    <span className="font-semibold">{selectedUsernames.length.toLocaleString()}</span>
                    {selectedUsernames.length ? (
                      <>
                        {" "}
                        <span className="text-slate-400">•</span> Enrich + Qualify + Save will run 1 profile scrape + 1 DeepSeek call per username (max 25).
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="h-9 px-3 rounded-xl bg-[#2563EB] text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                      disabled={anyBusy || selectedUsernames.length === 0}
                      title="Enrich (profile scrape) then qualify (DeepSeek) then save to Outreach targets. Max 25 per click."
                      onClick={() => void handleEnrichQualifySaveSelected()}
                    >
                      {enrichQualifySaveBusy ? "Working…" : "Enrich + Qualify + Save"}
                    </button>
                    <button
                      type="button"
                      className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
                      disabled={anyBusy || followingSelectedCount === 0}
                      title="Clear selection"
                      onClick={() => setFollowingSelectedKeys(new Set())}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {enrichQualifySaveError ? (
                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {enrichQualifySaveError}
                  </div>
                ) : null}

                {enrichQualifySaveSummary ? (
                  <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                    Done. Attempted: <span className="font-semibold">{enrichQualifySaveSummary.attempted}</span>{" "}
                    <span className="text-green-700">•</span> Enriched ok:{" "}
                    <span className="font-semibold">{enrichQualifySaveSummary.enrichedOk}</span>{" "}
                    <span className="text-green-700">•</span> Qualified ok:{" "}
                    <span className="font-semibold">{enrichQualifySaveSummary.qualifiedOk}</span>{" "}
                    <span className="text-green-700">•</span> Saved:{" "}
                    <span className="font-semibold">{enrichQualifySaveSummary.savedOk}</span>
                  </div>
                ) : null}

                {enrichQualifySaveLogs.length ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold text-slate-700">Live logs</div>
                    <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-[11px] text-slate-800 whitespace-pre-wrap">
                      {enrichQualifySaveLogs.join("\n")}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
                    disabled={anyBusy || followingFiltered.length === 0}
                    title="Select the next 25 usernames that have not been enriched yet"
                    onClick={() => void handleSelectNext25NotEnriched()}
                  >
                    Select next 25 not enriched
                  </button>
                  <div className="text-xs text-slate-500">Tip: after running, click again to select the next batch.</div>
                </div>

                {followingFiltered.length ? (
                  <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-white border-b border-slate-200">
                        <tr className="text-left text-[11px] font-semibold text-slate-600">
                          <th className="px-3 py-2 w-[56px]">#</th>
                          <th className="px-3 py-2 w-[44px]">
                            <input
                              type="checkbox"
                              aria-label="Select all shown"
                              disabled={anyBusy || followingShown.length === 0}
                              checked={followingShown.length > 0 && followingShown.every((it, idx) => {
                                const u = String(it?.username || "").trim();
                                const key = u ? `u:${u.toLowerCase()}` : `i:${idx}`;
                                return followingSelectedKeys.has(key);
                              })}
                              onChange={(e) => {
                                const next = new Set(followingSelectedKeys);
                                const checked = !!e.target.checked;
                                if (checked) {
                                  followingShown.forEach((it, idx) => {
                                    const u = String(it?.username || "").trim();
                                    const key = u ? `u:${u.toLowerCase()}` : `i:${idx}`;
                                    next.add(key);
                                  });
                                } else {
                                  followingShown.forEach((it, idx) => {
                                    const u = String(it?.username || "").trim();
                                    const key = u ? `u:${u.toLowerCase()}` : `i:${idx}`;
                                    next.delete(key);
                                  });
                                }
                                setFollowingSelectedKeys(next);
                              }}
                            />
                          </th>
                          <th className="px-3 py-2 w-[52px]">Photo</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Handle</th>
                          <th className="px-3 py-2 w-[56px]">Link</th>
                          <th className="px-3 py-2 w-[110px]">Following</th>
                          <th className="px-3 py-2 w-[90px]">Score</th>
                          <th className="px-3 py-2 w-[70px]">HD</th>
                          <th className="px-3 py-2 w-[90px]">Verified</th>
                          <th className="px-3 py-2 w-[90px]">Private</th>
                          <th className="px-3 py-2 w-[160px]">Action</th>
                          <th className="px-3 py-2 w-[70px]">Raw</th>
                        </tr>
                      </thead>
                      <tbody>
                        {followingShown.map((it, idx) => {
                          const uname = String(it?.username || "").trim();
                          const handle = uname ? (uname.startsWith("@") ? uname : `@${uname}`) : "—";
                          const key = uname ? `u:${uname.toLowerCase()}` : `i:${idx}`;
                          const checked = followingSelectedKeys.has(key);
                          const unameNorm = String(uname || "").replace(/^@+/, "").trim().toLowerCase();
                          const qual = unameNorm ? liteQualByUsername[unameNorm] : null;
                          const pending = unameNorm ? liteQualifyPendingUsernames.has(unameNorm) : false;
                          const hd = unameNorm ? enrichedHdByUsername[unameNorm] : null;
                          const alreadyEnriched = unameNorm ? !!enrichedOkByUsername[unameNorm] || !!dbEnrichedByUsername[unameNorm] : false;
                          const followingCountFallback = extractFollowingCountBestEffort(it?.raw);
                          const enriching = unameNorm ? enrichPendingUsernames.has(unameNorm) : false;
                          const rowBusy = unameNorm ? createRowBusyUsernames.has(unameNorm) : false;
                          const rowCreatedProjectId = unameNorm ? createdProjectIdByUsername[unameNorm] : null;
                          const rowErr = unameNorm ? createRowErrorByUsername[unameNorm] : null;
                          const hasRaw = !!it?.raw;
                          return (
                            <tr
                              key={`${uname || "row"}-${idx}`}
                              className={[
                                "border-b border-slate-100 last:border-b-0",
                                checked ? "bg-purple-50/40" : "",
                              ].join(" ")}
                            >
                              <td className="px-3 py-2 text-slate-500 font-mono text-[12px]">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${handle}`}
                                  disabled={anyBusy}
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = new Set(followingSelectedKeys);
                                    if (e.target.checked) next.add(key);
                                    else next.delete(key);
                                    setFollowingSelectedKeys(next);
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <AvatarThumb url={it?.profilePicUrl ?? null} />
                              </td>
                              <td className="px-3 py-2 text-slate-900">{it?.fullName ? String(it.fullName) : <span className="text-slate-400">—</span>}</td>
                              <td className="px-3 py-2 font-mono text-[12px] text-slate-800">{handle}</td>
                              <td className="px-3 py-2">
                                {unameNorm ? (
                                  <a
                                    href={`https://www.instagram.com/${unameNorm}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                                    title="Open Instagram profile"
                                    aria-label={`Open ${handle} on Instagram`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M14 3h7v7"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M10 14L21 3"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M21 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-900">
                                {unameNorm && typeof followingCountByUsername[unameNorm] === "number" ? (
                                  <span className="font-semibold">{followingCountByUsername[unameNorm].toLocaleString()}</span>
                                ) : followingCountFallback !== null ? (
                                  <span className="text-slate-700">{followingCountFallback.toLocaleString()}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-900">
                                {pending ? (
                                  <span className="text-slate-500">…</span>
                                ) : qual && typeof qual.score === "number" ? (
                                  <span className="font-semibold">{qual.score}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-900">
                                {enriching ? (
                                  <span className="text-slate-500">…</span>
                                ) : hd ? (
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border border-green-200 bg-green-50 text-green-800" title={hd}>
                                    HD
                                  </span>
                                ) : alreadyEnriched ? (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200 bg-slate-50 text-slate-700"
                                    title="Already enriched (saved in DB)"
                                  >
                                    Enriched
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-800">{it?.isVerified === null ? "—" : it.isVerified ? "Yes" : "No"}</td>
                              <td className="px-3 py-2 text-slate-800">{it?.isPrivate === null ? "—" : it.isPrivate ? "Yes" : "No"}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
                                    disabled={anyBusy || !unameNorm || !!pipelineAddBusyByUsername[unameNorm] || !!pipelineAddedByUsername[unameNorm]}
                                    title="Add this lead to Pipeline (stage: todo)"
                                    onClick={() => {
                                      if (!unameNorm) return;
                                      const seedInfo = getSeedInfoBestEffort();
                                      const seedU = String(seedInfo.seedUsername || '').trim();
                                      const seedUrl = String(seedInfo.seedInstagramUrl || '').trim();
                                      if (!seedU || !seedUrl) {
                                        setPipelineAddErrorByUsername((p) => ({ ...(p || {}), [unameNorm]: 'Missing seed info. Run a scrape first.' }));
                                        return;
                                      }
                                      void (async () => {
                                        try {
                                          setPipelineAddBusyByUsername((p) => ({ ...(p || {}), [unameNorm]: true }));
                                          setPipelineAddErrorByUsername((p) => {
                                            const n = { ...(p || {}) };
                                            delete n[unameNorm];
                                            return n;
                                          });
                                          const token = await getSessionToken();
                                          const accountHeader = getActiveAccountHeader();
                                          const res = await outreachApi.pipelineAdd({
                                            token,
                                            seedInstagramUrl: seedUrl,
                                            seedUsername: seedU,
                                            baseTemplateId: baseTemplateId || null,
                                            row: {
                                              username: unameNorm,
                                              fullName: it?.fullName ?? null,
                                              profilePicUrl: it?.profilePicUrl ?? null,
                                              isVerified: it?.isVerified ?? null,
                                              isPrivate: it?.isPrivate ?? null,
                                              raw: it?.raw ?? null,
                                            },
                                            headers: accountHeader,
                                          });
                                          if (!res?.applied) {
                                            // Typically means it was already in pipeline.
                                            setPipelineAddErrorByUsername((p) => ({ ...(p || {}), [unameNorm]: 'Already in pipeline (or no rows updated).' }));
                                          }
                                          setPipelineAddedByUsername((p) => ({ ...(p || {}), [unameNorm]: true }));
                                          if (pipelineDidInitForOpenRef.current) {
                                            await handlePipelineRefresh();
                                          }
                                        } catch (e: any) {
                                          const msg = String(e?.message || e || 'Add to pipeline failed');
                                          try {
                                            // eslint-disable-next-line no-console
                                            console.error('pipelineAdd failed', { username: unameNorm, error: msg, raw: e });
                                          } catch {
                                            // ignore
                                          }
                                          setPipelineAddErrorByUsername((p) => ({ ...(p || {}), [unameNorm]: msg }));
                                        } finally {
                                          setPipelineAddBusyByUsername((p) => {
                                            const n = { ...(p || {}) };
                                            delete n[unameNorm];
                                            return n;
                                          });
                                        }
                                      })();
                                    }}
                                  >
                                    {pipelineAddBusyByUsername[unameNorm] ? 'Adding…' : pipelineAddedByUsername[unameNorm] ? 'Added' : 'Add'}
                                  </button>
                                  <button
                                    type="button"
                                    className="h-8 px-3 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                                    disabled={anyBusy || !unameNorm || rowBusy}
                                    onClick={() => void handleCreateFromRow({ username: unameNorm })}
                                    title="Enrich if needed, then create template + project"
                                  >
                                    {rowBusy ? "Working…" : rowCreatedProjectId ? "Created" : "Create project"}
                                  </button>
                                  {rowErr ? (
                                    <span className="text-[11px] text-red-700" title={rowErr}>
                                      Error
                                    </span>
                                  ) : null}
                                  {pipelineAddErrorByUsername[unameNorm] ? (
                                    <span
                                      className="text-[11px] text-red-700 max-w-[240px] truncate"
                                      title={pipelineAddErrorByUsername[unameNorm]}
                                    >
                                      {pipelineAddErrorByUsername[unameNorm]}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
                                  disabled={!hasRaw}
                                  title="View raw JSON (debug)"
                                  onClick={() => {
                                    try {
                                      const txt = JSON.stringify(it?.raw ?? {}, null, 2);
                                      // Use a simple browser dialog for now (fast debugging).
                                      // Phase 9 polish can make this a proper expand/collapse panel.
                                      window.prompt("Raw JSON (copy)", txt);
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-600">No rows yet.</div>
                )}

                {enrichError ? (
                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{enrichError}</div>
                ) : null}

                {followingFiltered.length > followingShown.length ? (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-600">
                      Showing <span className="font-semibold">{followingShown.length.toLocaleString()}</span> of{" "}
                      <span className="font-semibold">{followingFiltered.length.toLocaleString()}</span>
                    </div>
                    <button
                      type="button"
                      className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
                      disabled={anyBusy}
                      onClick={() => setFollowingVisibleCount((n) => Math.min(followingFiltered.length, Math.max(0, Number(n || 0)) + 25))}
                      title="Load more rows"
                    >
                      Load more
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-700">Pipeline</div>
                    <div className="text-[11px] text-slate-500">Leads with a pipeline stage (deduped by @handle).</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="h-9 w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                      value={pipelineSearch}
                      onChange={(e) => setPipelineSearch(e.target.value)}
                      placeholder="Search name or @handle…"
                      disabled={anyBusy}
                      aria-label="Search pipeline"
                    />
                    <select
                      className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                      value={pipelineStageFilter}
                      onChange={(e) => setPipelineStageFilter(e.target.value as any)}
                      disabled={anyBusy}
                      aria-label="Stage filter"
                    >
                      <option value="">All stages</option>
                      {(['todo', 'dm_sent', 'responded_needs_followup', 'booked', 'sent_contract', 'closed'] as const).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
                      disabled={anyBusy}
                      onClick={() => void handlePipelineRefresh()}
                      title="Refresh pipeline"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {pipelineError ? (
                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{pipelineError}</div>
                ) : null}

                {pipelineRows.length ? (
                  <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-white border-b border-slate-200">
                        <tr className="text-left text-[11px] font-semibold text-slate-600">
                          <th className="px-3 py-2 w-[56px]">#</th>
                          <th className="px-3 py-2 w-[52px]">Photo</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Handle</th>
                          <th className="px-3 py-2 w-[56px]">Link</th>
                          <th className="px-3 py-2 w-[90px]">Score</th>
                          <th className="px-3 py-2 w-[110px]">Following</th>
                          <th className="px-3 py-2 w-[200px]">Stage</th>
                          <th className="px-3 py-2 w-[140px]">Last contact</th>
                          <th className="px-3 py-2 w-[320px]">Reel URL</th>
                          <th className="px-3 py-2 w-[170px]">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pipelineRows.map((r, idx) => {
                          const uname = String(r?.username || '').toLowerCase();
                          const handle = uname ? `@${uname}` : '—';
                          const editBusy = !!pipelineEditBusyByUsername[uname];
                          const createBusy = !!pipelineCreateBusyByUsername[uname];
                          const delBusy = !!pipelineDeleteBusyByUsername[uname];
                          const rowErr = pipelineRowErrorByUsername[uname] || null;
                          const reelDraft = pipelineReelUrlDraftByUsername[uname] ?? String(r?.sourcePostUrl || '');
                          const lastContactDraft = pipelineLastContactDraftByUsername[uname] ?? String(r?.lastContactDate || '');
                          const stageDraft = pipelineStageDraftByUsername[uname] ?? (r?.pipelineStage as any);

                          return (
                            <tr key={uname || String(idx)} className="border-b border-slate-100 last:border-b-0">
                              <td className="px-3 py-2 text-slate-500 font-mono text-[12px]">{idx + 1}</td>
                              <td className="px-3 py-2">
                                <div
                                  className="inline-block"
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    if (!uname) return;
                                    setPipelineCtx({ username: uname, x: e.clientX, y: e.clientY });
                                  }}
                                  title="Right click for options"
                                >
                                  <AvatarThumb url={r?.profilePicUrl ?? null} />
                                </div>
                              </td>
                              <td className="px-3 py-2 text-slate-900">{r?.fullName ? String(r.fullName) : <span className="text-slate-400">—</span>}</td>
                              <td className="px-3 py-2 font-mono text-[12px] text-slate-800">{handle}</td>
                              <td className="px-3 py-2">
                                {uname ? (
                                  <a
                                    href={`https://www.instagram.com/${uname}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                                    title="Open Instagram profile"
                                    aria-label={`Open ${handle} on Instagram`}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M14 3h7v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      <path
                                        d="M21 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-900">
                                {typeof r?.aiScore === 'number' ? <span className="font-semibold">{r.aiScore}</span> : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-900">
                                {typeof r?.followingCount === 'number' ? (
                                  <span className="text-slate-700">{r.followingCount.toLocaleString()}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                                  value={stageDraft}
                                  disabled={anyBusy || editBusy}
                                  onChange={(e) => {
                                    const next = e.target.value as any;
                                    setPipelineStageDraftByUsername((prev) => ({ ...(prev || {}), [uname]: next }));
                                    void (async () => {
                                      try {
                                        const token = await getSessionToken();
                                        const accountHeader = getActiveAccountHeader();
                                        setPipelineEditBusyByUsername((p) => ({ ...(p || {}), [uname]: true }));
                                        setPipelineRowErrorByUsername((p) => {
                                          const n = { ...(p || {}) };
                                          delete n[uname];
                                          return n;
                                        });
                                        await outreachApi.pipelineUpdate({ token, username: uname, patch: { pipelineStage: next }, headers: accountHeader });
                                        await handlePipelineRefresh();
                                      } catch (err: any) {
                                        setPipelineRowErrorByUsername((p) => ({ ...(p || {}), [uname]: String(err?.message || err || 'Update failed') }));
                                      } finally {
                                        setPipelineEditBusyByUsername((p) => {
                                          const n = { ...(p || {}) };
                                          delete n[uname];
                                          return n;
                                        });
                                      }
                                    })();
                                  }}
                                >
                                  {(['todo', 'dm_sent', 'responded_needs_followup', 'booked', 'sent_contract', 'closed'] as const).map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                                    value={lastContactDraft}
                                    disabled={anyBusy || editBusy}
                                    onChange={(e) => setPipelineLastContactDraftByUsername((p) => ({ ...(p || {}), [uname]: e.target.value }))}
                                    onBlur={() => {
                                      void (async () => {
                                        try {
                                          const token = await getSessionToken();
                                          const accountHeader = getActiveAccountHeader();
                                          setPipelineEditBusyByUsername((p) => ({ ...(p || {}), [uname]: true }));
                                          await outreachApi.pipelineUpdate({
                                            token,
                                            username: uname,
                                            patch: { lastContactDate: String((pipelineLastContactDraftByUsername[uname] ?? '')).trim() || null },
                                            headers: accountHeader,
                                          });
                                          await handlePipelineRefresh();
                                        } catch (err: any) {
                                          setPipelineRowErrorByUsername((p) => ({ ...(p || {}), [uname]: String(err?.message || err || 'Update failed') }));
                                        } finally {
                                          setPipelineEditBusyByUsername((p) => {
                                            const n = { ...(p || {}) };
                                            delete n[uname];
                                            return n;
                                          });
                                        }
                                      })();
                                    }}
                                  />
                                  {editBusy ? <span className="text-[11px] text-slate-500">Saving…</span> : null}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                                    value={reelDraft}
                                    disabled={anyBusy || editBusy}
                                    placeholder="https://www.instagram.com/reel/…/"
                                    onChange={(e) => setPipelineReelUrlDraftByUsername((p) => ({ ...(p || {}), [uname]: e.target.value }))}
                                    onBlur={() => {
                                      void (async () => {
                                        try {
                                          const token = await getSessionToken();
                                          const accountHeader = getActiveAccountHeader();
                                          setPipelineEditBusyByUsername((p) => ({ ...(p || {}), [uname]: true }));
                                          await outreachApi.pipelineUpdate({
                                            token,
                                            username: uname,
                                            patch: { sourcePostUrl: String((pipelineReelUrlDraftByUsername[uname] ?? '')).trim() || null },
                                            headers: accountHeader,
                                          });
                                        } catch (err: any) {
                                          setPipelineRowErrorByUsername((p) => ({ ...(p || {}), [uname]: String(err?.message || err || 'Update failed') }));
                                        } finally {
                                          setPipelineEditBusyByUsername((p) => {
                                            const n = { ...(p || {}) };
                                            delete n[uname];
                                            return n;
                                          });
                                        }
                                      })();
                                    }}
                                  />
                                  {editBusy ? <span className="text-[11px] text-slate-500">Saving…</span> : null}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="h-8 px-3 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                                    disabled={anyBusy || createBusy || delBusy}
                                    title="Create template + project from the saved Reel URL"
                                    onClick={() => {
                                      const reelUrl = String(pipelineReelUrlDraftByUsername[uname] ?? r?.sourcePostUrl ?? '').trim();
                                      if (!reelUrl) {
                                        setPipelineRowErrorByUsername((p) => ({ ...(p || {}), [uname]: 'Missing Reel URL' }));
                                        return;
                                      }
                                      void (async () => {
                                        try {
                                          setPipelineCreateBusyByUsername((p) => ({ ...(p || {}), [uname]: true }));
                                          setPipelineRowErrorByUsername((p) => {
                                            const n = { ...(p || {}) };
                                            delete n[uname];
                                            return n;
                                          });

                                          // Optimization: if we already enriched this profile, reuse its HD avatar and skip re-scraping.
                                          setForcedReelOwnerUsername(uname);
                                          setForcedReelOwnerFullName(String(r?.fullName || '').trim() || null);
                                          setForcedReelOwnerProfilePicUrlHD(String(r?.profilePicUrlHD || '').trim() || null);

                                          setSingleMode('reel');
                                          setReelUrl(reelUrl);
                                          await handleRunOutreach();
                                        } catch (err: any) {
                                          setPipelineRowErrorByUsername((p) => ({ ...(p || {}), [uname]: String(err?.message || err || 'Create failed') }));
                                        } finally {
                                          setPipelineCreateBusyByUsername((p) => {
                                            const n = { ...(p || {}) };
                                            delete n[uname];
                                            return n;
                                          });
                                        }
                                      })();
                                    }}
                                  >
                                    {createBusy ? 'Working…' : 'Create template'}
                                  </button>
                                  {rowErr ? (
                                    <span className="text-[11px] text-red-700" title={rowErr}>
                                      Error
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-600">No pipeline leads yet.</div>
                )}
              </div>

              {pipelineCtx ? (
                <div
                  className="fixed z-[9999] rounded-xl border border-slate-200 bg-white shadow-lg"
                  style={{ left: pipelineCtx.x, top: pipelineCtx.y }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 rounded-t-xl disabled:opacity-60"
                    disabled={anyBusy || !!pipelineDeleteBusyByUsername[pipelineCtx.username]}
                    onClick={() => {
                      const u = pipelineCtx.username;
                      setPipelineCtx(null);
                      void (async () => {
                        try {
                          setPipelineDeleteBusyByUsername((p) => ({ ...(p || {}), [u]: true }));
                          const token = await getSessionToken();
                          const accountHeader = getActiveAccountHeader();
                          await outreachApi.pipelineUpdate({ token, username: u, patch: { pipelineStage: null }, headers: accountHeader });
                          await handlePipelineRefresh();
                        } catch (e: any) {
                          setPipelineRowErrorByUsername((p) => ({ ...(p || {}), [u]: String(e?.message || e || 'Delete failed') }));
                        } finally {
                          setPipelineDeleteBusyByUsername((p) => {
                            const n = { ...(p || {}) };
                            delete n[u];
                            return n;
                          });
                        }
                      })();
                    }}
                  >
                    {pipelineDeleteBusyByUsername[pipelineCtx.username] ? 'Deleting…' : 'Delete row'}
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-b-xl"
                    onClick={() => setPipelineCtx(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

