"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";
import { supabase } from "@/app/components/auth/AuthContext";

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
  const open = useEditorSelector((s: any) => !!(s as any).outreachModalOpen);
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const actions = useEditorSelector((s: any) => (s as any).actions);
  const loadingTemplates = useEditorSelector((s: any) => !!(s as any).loadingTemplates);
  const templates = useEditorSelector((s: any) => (Array.isArray((s as any).templates) ? (s as any).templates : []));

  const [instagramUrl, setInstagramUrl] = useState("");
  const [baseTemplateId, setBaseTemplateId] = useState<string>("");
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scraped, setScraped] = useState<{
    fullName: string | null;
    username: string | null;
    profilePicUrlHD: string | null;
    raw: any;
  } | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdTemplate, setCreatedTemplate] = useState<{ id: string; name: string } | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [persistBusy, setPersistBusy] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persistedTargetId, setPersistedTargetId] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    if (scrapeBusy || createBusy || projectBusy || persistBusy) return;
    setInstagramUrl("");
    setBaseTemplateId("");
    setScrapeError(null);
    setScraped(null);
    setCreateError(null);
    setCreatedTemplate(null);
    setProjectError(null);
    setCreatedProjectId(null);
    setPersistError(null);
    setPersistedTargetId(null);
  }, [createBusy, persistBusy, projectBusy, scrapeBusy]);

  useEffect(() => {
    if (!open) return;
    setScrapeBusy(false);
    setCreateBusy(false);
    setProjectBusy(false);
    setPersistBusy(false);
    resetAll();
  }, [open, resetAll]);

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
    return !!String(instagramUrl || "").trim();
  }, [instagramUrl]);

  const busyLabel = useMemo(() => {
    if (scrapeBusy) return "Scraping…";
    if (createBusy) return "Creating template…";
    if (projectBusy) return "Creating project…";
    if (persistBusy) return "Saving record…";
    return null;
  }, [createBusy, persistBusy, projectBusy, scrapeBusy]);

  const anyBusy = !!busyLabel;

  const topError = useMemo(() => {
    return scrapeError || createError || projectError || persistError || null;
  }, [createError, persistError, projectError, scrapeError]);

  async function getSessionToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    if (!token) throw new Error("Not authenticated");
    return token;
  }

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

  async function apiPersistTarget(args: {
    instagramUrl: string;
    scraped: { fullName: string | null; username: string | null; profilePicUrlHD: string | null; raw: any } | null;
    baseTemplateId: string | null;
    createdTemplateId: string;
    createdProjectId: string;
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
    try {
      const data = await apiScrapeInstagramProfile({ instagramUrl });
      setScraped(data);
    } catch (e: any) {
      setScrapeError(String(e?.message || e || "Scrape failed"));
    } finally {
      setScrapeBusy(false);
    }
  };

  const displayHandle = useMemo(() => {
    const u = String(scraped?.username || "").trim();
    if (!u) return null;
    return u.startsWith("@") ? u : `@${u}`;
  }, [scraped?.username]);

  const canCreateTemplates = useMemo(() => {
    return !!String(baseTemplateId || "").trim() && !!scraped && !!displayHandle && !!String(scraped?.profilePicUrlHD || "").trim();
  }, [baseTemplateId, displayHandle, scraped]);

  const projectTitle = useMemo(() => {
    const name = sanitizeTemplateName(String(scraped?.fullName || "").trim());
    return name || displayHandle || "Untitled Project";
  }, [displayHandle, scraped?.fullName]);

  const handleCreateTemplate = async () => {
    if (!canCreateTemplates || createBusy) return;
    setCreateBusy(true);
    setCreateError(null);
    setCreatedTemplate(null);
    setProjectError(null);

    try {
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
    } catch (e: any) {
      setCreateError(String(e?.message || e || "Create template failed"));
    } finally {
      setCreateBusy(false);
    }
  };

  const canCreateProject = useMemo(() => {
    return !!createdTemplate?.id && !createdProjectId;
  }, [createdProjectId, createdTemplate?.id]);

  const canPersistTarget = useMemo(() => {
    return !!createdTemplate?.id && !!createdProjectId && !persistedTargetId;
  }, [createdProjectId, createdTemplate?.id, persistedTargetId]);

  const persistTarget = async (args: { projectId: string }) => {
    const pid = String(args.projectId || "").trim();
    if (!pid) return;
    if (!createdTemplate?.id) return;
    if (persistBusy) return;
    setPersistBusy(true);
    setPersistError(null);
    try {
      const out = await apiPersistTarget({
        instagramUrl,
        scraped,
        baseTemplateId: baseTemplateId || null,
        createdTemplateId: createdTemplate.id,
        createdProjectId: pid,
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

      // 3) Persist outreach record (Phase 6) then load the newly created project.
      // If persistence fails, keep the modal open so user can retry "Save record" without creating another project.
      await persistTarget({ projectId });
      actions?.onLoadProject?.(projectId);
    } catch (e: any) {
      setProjectError(String(e?.message || e || "Create project failed"));
    } finally {
      setProjectBusy(false);
    }
  };

  const canRunAll = useMemo(() => {
    return !!String(instagramUrl || "").trim() && !!String(baseTemplateId || "").trim();
  }, [baseTemplateId, instagramUrl]);

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
      // 1) Scrape
      setScrapeBusy(true);
      const scrapedData = await apiScrapeInstagramProfile({ instagramUrl });
      setScraped(scrapedData);
      setScrapeBusy(false);

      // 2) Create template
      setCreateBusy(true);
      const tpl = await apiCreateTemplate({ baseTemplateId, scraped: scrapedData });
      setCreatedTemplate({ id: tpl.templateId, name: tpl.templateName });
      setCreateBusy(false);

      // 3) Create project + mappings
      setProjectBusy(true);
      const { projectId } = await apiCreateRegularProject({ title: sanitizeTemplateName(scrapedData.fullName || "") || `@${String(scrapedData.username || "").replace(/^@+/, "")}` || "Untitled Project" });
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

      // 5) Load project + close modal
      actions?.onLoadProject?.(projectId);
      actions?.onCloseOutreachModal?.();
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
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
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

        <div className="p-5 space-y-4">
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

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Instagram profile</div>
            <div className="flex items-center gap-2">
              <input
                className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://www.instagram.com/username/"
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
                title="Scrape Instagram profile"
              >
                {scrapeBusy ? "Scraping…" : "Scrape"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-700">Scraped data</div>
            {scraped ? (
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

          <div className="flex items-center justify-end gap-2">
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
        </div>
      </div>
    </div>
  );
}

