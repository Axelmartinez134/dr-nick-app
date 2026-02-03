/* eslint-disable react/no-unstable-nested-components */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorSelector } from "@/features/editor/store";

function formatUpdatedAt(s: string) {
  const t = Date.parse(String(s || ""));
  if (!t) return "";
  try {
    return new Date(t).toLocaleString();
  } catch {
    return "";
  }
}

function Badge({ label, on }: { label: string; on: boolean }) {
  const cls = on
    ? "bg-slate-900 text-white border-slate-900"
    : "bg-white text-slate-600 border-slate-200";
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>{label}</span>;
}

function IosToggle(props: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const { label, value, disabled, onChange } = props;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <button
        type="button"
        className={["h-8 w-14 rounded-full transition-colors", value ? "bg-black" : "bg-slate-300", disabled ? "opacity-60" : ""].join(
          " "
        )}
        onClick={() => onChange(!value)}
        disabled={disabled}
        aria-label={label}
        title={label}
      >
        <span
          className={[
            "block h-7 w-7 rounded-full bg-white shadow-sm translate-x-0 transition-transform",
            value ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function ShareCarouselsModal() {
  const open = useEditorSelector((s: any) => !!(s as any).shareCarouselsModalOpen);
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const currentProjectId = useEditorSelector((s: any) => (s as any).currentProjectId ? String((s as any).currentProjectId) : null);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const linkPath = useEditorSelector((s: any) => ((s as any).shareCarouselsLinkPath ? String((s as any).shareCarouselsLinkPath) : null));
  const linkLoading = useEditorSelector((s: any) => !!(s as any).shareCarouselsLinkLoading);
  const linkError = useEditorSelector((s: any) => ((s as any).shareCarouselsLinkError ? String((s as any).shareCarouselsLinkError) : null));

  const loading = useEditorSelector((s: any) => !!(s as any).shareCarouselsProjectsLoading);
  const error = useEditorSelector((s: any) => ((s as any).shareCarouselsProjectsError ? String((s as any).shareCarouselsProjectsError) : null));
  const projects = useEditorSelector((s: any) => (Array.isArray((s as any).shareCarouselsProjects) ? (s as any).shareCarouselsProjects : []));
  const savingIds = useEditorSelector((s: any) => (s as any).shareCarouselsSavingIds as Set<string>);

  // Modal list filter: show ONLY ready-for-approval projects (and exclude posted).
  const filteredProjects = useMemo(() => {
    return (projects || []).filter((p: any) => !!p?.review_ready && !p?.review_posted);
  }, [projects]);

  const includedCount = useMemo(() => {
    return filteredProjects.length;
  }, [filteredProjects]);

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  const fullUrl = useMemo(() => {
    if (!linkPath) return null;
    try {
      return `${window.location.origin}${linkPath}`;
    } catch {
      return linkPath;
    }
  }, [linkPath]);

  const [currentThumb, setCurrentThumb] = useState<string | null>(null);
  const workspaceRefs = useEditorSelector((s: any) => (s as any).workspaceRefs);

  useEffect(() => {
    if (!open) return;
    setCurrentThumb(null);
    if (!currentProjectId) return;
    // Only attempt thumb for the currently loaded project (fast-path).
    const inList = (filteredProjects || []).some((p: any) => String(p?.id || "") === String(currentProjectId));
    if (!inList) return;
    try {
      const slideCanvasRefs = (workspaceRefs as any)?.slideCanvasRefs;
      const handle = slideCanvasRefs?.current?.[0]?.current || null;
      const fabricCanvas = handle?.canvas || handle || null;
      if (!fabricCanvas || typeof fabricCanvas.toDataURL !== "function") return;
      // Small multiplier for thumbnail (fast).
      const dataUrl = fabricCanvas.toDataURL({ format: "png", multiplier: 0.35 });
      if (typeof dataUrl === "string" && dataUrl.startsWith("data:image")) setCurrentThumb(dataUrl);
    } catch {
      // ignore
    }
  }, [currentProjectId, open, projects, workspaceRefs]);

  if (!open || !isSuperadmin) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        // Close on outside click (backdrop).
        if (e.target === e.currentTarget) actions.onCloseShareCarousels?.();
      }}
    >
      <div
        className="w-full max-w-[980px] max-h-[85vh] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Share carousels</div>
            <div className="mt-0.5 text-xs text-slate-600">
              {loading ? "Loading projects…" : `${includedCount} ready to share`}{" "}
              <span className="text-slate-400">•</span> Live link (Ready=true, Posted=false)
            </div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
            onClick={actions.onCloseShareCarousels}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-9 px-3 rounded-lg bg-black text-white text-sm font-semibold shadow-sm disabled:opacity-60"
            disabled={!!linkLoading}
            onClick={async () => {
              try {
                await actions.onClickCopyShareCarouselsLink?.();
                setCopied(true);
              } catch {
                // ignore; linkError will show if present
              }
            }}
            title="Copy review link"
          >
            {copied ? "Copied ✓" : linkLoading ? "Preparing…" : "Copy link"}
          </button>
          <button
            type="button"
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
            disabled={!!loading}
            onClick={() => void actions.onRefreshShareCarousels?.()}
            title="Refresh list"
          >
            Refresh
          </button>
          {fullUrl ? (
            <div className="min-w-0 text-xs text-slate-600 truncate">
              Link: <span className="font-mono text-[11px]">{fullUrl}</span>
            </div>
          ) : null}
          {linkError ? <div className="w-full text-xs text-red-600">Link error: {linkError}</div> : null}
        </div>

        <div className="px-5 py-4 overflow-auto max-h-[65vh]">
          {error ? <div className="text-sm text-red-700 mb-3">{error}</div> : null}
          {loading ? (
            <div className="text-sm text-slate-600">Loading…</div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-sm text-slate-600">No ready projects found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map((p: any) => {
                const pid = String(p?.id || "");
                const busy = !!savingIds?.has?.(pid);
                const showThumb = currentProjectId && pid === String(currentProjectId) && !!currentThumb;
                return (
                  <div key={pid} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="p-3 flex gap-3">
                      <div className="w-[90px] h-[120px] rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                        {showThumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={currentThumb!} alt="Slide 1 thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-[11px] text-slate-400 font-semibold">Slide 1</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 truncate">{String(p?.title || "Untitled Project")}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">{formatUpdatedAt(String(p?.updated_at || ""))}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge label="Ready" on={!!p?.review_ready} />
                          <Badge label="Posted" on={!!p?.review_posted} />
                          <Badge label="Approved" on={!!p?.review_approved} />
                          <Badge label="Scheduled" on={!!p?.review_scheduled} />
                        </div>
                      </div>
                    </div>

                    <div className="px-3 pb-3 space-y-2">
                      <IosToggle
                        label="Ready for approval"
                        value={!!p?.review_ready}
                        disabled={busy}
                        onChange={(next) => actions.onToggleProjectReviewReady?.({ projectId: pid, next })}
                      />
                      <IosToggle
                        label="Posted"
                        value={!!p?.review_posted}
                        disabled={busy}
                        onChange={(next) => actions.onToggleProjectReviewPosted?.({ projectId: pid, next })}
                      />
                      <IosToggle
                        label="Approved"
                        value={!!p?.review_approved}
                        disabled={busy}
                        onChange={(next) => actions.onToggleProjectReviewApproved?.({ projectId: pid, next })}
                      />
                      <IosToggle
                        label="Scheduled"
                        value={!!p?.review_scheduled}
                        disabled={busy}
                        onChange={(next) => actions.onToggleProjectReviewScheduled?.({ projectId: pid, next })}
                      />
                      {busy ? <div className="text-[11px] text-slate-500">Saving…</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

