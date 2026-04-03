/* eslint-disable react/no-unstable-nested-components */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const isMobile = useEditorSelector((s: any) => !!(s as any).isMobile);
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

  const [driveDraftById, setDriveDraftById] = useState<Record<string, string>>({});
  const driveTimerByIdRef = useRef<Record<string, number | null>>({});
  const driveDirtyByIdRef = useRef<Record<string, boolean>>({});
  const saveDriveNow = useMemo(() => {
    return async (projectId: string, nextText: string) => {
      const pid = String(projectId || "").trim();
      if (!pid) return;
      try {
        const ok = await actions.onChangeProjectReviewDriveFolderUrl?.({ projectId: pid, next: nextText });
        if (ok === false) throw new Error("Save failed");
        driveDirtyByIdRef.current[pid] = false;
      } catch {
        // ignore; modal uses global "Saving..." disabled state like other Review fields
      }
    };
  }, [actions]);

  useEffect(() => {
    if (!open) {
      // Cleanup timers + drafts when closing (prevents stale debounced saves).
      try {
        Object.values(driveTimerByIdRef.current || {}).forEach((t) => {
          if (t) window.clearTimeout(t);
        });
      } catch {
        // ignore
      }
      driveTimerByIdRef.current = {};
      driveDirtyByIdRef.current = {};
      setDriveDraftById({});
      return;
    }

    // Initialize / sync drafts from server unless user is mid-edit for that project.
    setDriveDraftById((prev) => {
      const out: Record<string, string> = { ...prev };
      let changed = false;
      (filteredProjects || []).forEach((p: any) => {
        const pid = String(p?.id || "").trim();
        if (!pid) return;
        const serverText = String(p?.review_drive_folder_url || "");
        const isDirty = !!driveDirtyByIdRef.current?.[pid];
        if (out[pid] === undefined) {
          out[pid] = serverText;
          changed = true;
          return;
        }
        if (!isDirty && out[pid] !== serverText) {
          out[pid] = serverText;
          changed = true;
        }
      });
      return changed ? out : prev;
    });
  }, [filteredProjects, open]);

  const [copied, setCopied] = useState(false);
  const [manualCopyOpen, setManualCopyOpen] = useState(false);
  const manualCopyRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setManualCopyOpen(false);
  }, [open]);

  useEffect(() => {
    // iOS Safari: when a fixed full-screen modal has a scrollable region,
    // reaching the scroll boundary can "rubber-band" the underlying page.
    // Lock body scroll while this modal is open on mobile.
    if (!open || !isMobile) return;
    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;
    const prevBodyWidth = body.style.width;
    const prevHtmlOverflow = html.style.overflow;
    const scrollY = window.scrollY || 0;

    try {
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
    } catch {
      // ignore
    }

    return () => {
      try {
        html.style.overflow = prevHtmlOverflow;
        body.style.overflow = prevBodyOverflow;
        body.style.position = prevBodyPosition;
        body.style.top = prevBodyTop;
        body.style.left = prevBodyLeft;
        body.style.right = prevBodyRight;
        body.style.width = prevBodyWidth;
        window.scrollTo(0, scrollY);
      } catch {
        // ignore
      }
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (!manualCopyOpen) return;
    const t = window.setTimeout(() => {
      try {
        manualCopyRef.current?.focus();
        manualCopyRef.current?.select();
      } catch {
        // ignore
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [manualCopyOpen]);

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
  }, [currentProjectId, filteredProjects, open, workspaceRefs]);

  if (!open || !isSuperadmin) return null;

  const outerCls = isMobile
    ? "fixed inset-0 z-[80] flex items-stretch justify-stretch bg-black/40"
    : "fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4";
  const innerCls = isMobile
    ? "w-full h-full overflow-hidden bg-white border border-slate-200 shadow-2xl flex flex-col"
    : "w-full max-w-[980px] max-h-[85vh] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl";

  return (
    <div
      className={outerCls}
      onMouseDown={(e) => {
        // Close on outside click (backdrop).
        if (e.target === e.currentTarget) actions.onCloseShareCarousels?.();
      }}
    >
      <div
        className={innerCls}
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
            className={isMobile ? "h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-sm font-semibold" : "h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"}
            onClick={actions.onCloseShareCarousels}
            aria-label="Close"
            title="Close"
          >
            {isMobile ? "Close" : "✕"}
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
                setManualCopyOpen(false);
              } catch {
                // Clipboard can fail on iOS; fall back to manual copy.
                setCopied(false);
                setManualCopyOpen(true);
              }
            }}
            title="Copy review link"
          >
            {copied ? "Copied ✓" : linkLoading ? "Preparing…" : "Copy link"}
          </button>
          <button
            type="button"
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
            disabled={!fullUrl || !!linkLoading}
            onClick={() => {
              if (!fullUrl) return;
              try {
                window.open(fullUrl, "_blank", "noopener,noreferrer");
              } catch {
                // ignore
              }
            }}
            aria-label="Open review link in new tab"
            title="Open review link"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4"
            >
              <path
                d="M11 4H16V9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 11L16 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 11V13.5C16 14.8807 14.8807 16 13.5 16H6.5C5.11929 16 4 14.8807 4 13.5V6.5C4 5.11929 5.11929 4 6.5 4H9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
          {manualCopyOpen && fullUrl ? (
            <div className="w-full">
              <div className="text-[11px] text-slate-500 mb-1">Copy failed — tap the box to select the link:</div>
              <input
                ref={manualCopyRef}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-mono text-slate-900 shadow-sm"
                readOnly
                value={fullUrl}
                onFocus={(e) => {
                  try {
                    e.currentTarget.select();
                  } catch {
                    // ignore
                  }
                }}
              />
            </div>
          ) : null}
        </div>

        <div
          className={
            isMobile
              ? "px-5 py-4 flex-1 min-h-0 overflow-y-auto overscroll-contain"
              : "px-5 py-4 overflow-auto max-h-[65vh]"
          }
          style={isMobile ? ({ WebkitOverflowScrolling: "touch" as any } as any) : undefined}
        >
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
                const driveDraft = driveDraftById[pid] ?? String(p?.review_drive_folder_url || "");
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

                      <div className="pt-1">
                        <div className="text-[11px] font-semibold text-slate-700 mb-1">Google Drive folder link</div>
                        <input
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-900 shadow-sm disabled:opacity-60"
                          value={driveDraft}
                          disabled={busy}
                          placeholder="Paste folder URL (optional)"
                          onChange={(e) => {
                            const next = e.target.value;
                            driveDirtyByIdRef.current[pid] = true;
                            setDriveDraftById((prev) => ({ ...prev, [pid]: next }));
                            const t0 = driveTimerByIdRef.current[pid];
                            if (t0) window.clearTimeout(t0);
                            driveTimerByIdRef.current[pid] = window.setTimeout(() => void saveDriveNow(pid, next), 600);
                          }}
                          onBlur={() => {
                            const t0 = driveTimerByIdRef.current[pid];
                            if (t0) window.clearTimeout(t0);
                            driveTimerByIdRef.current[pid] = null;
                            const cur = String((driveDraftById as any)?.[pid] ?? driveDraft ?? "");
                            void saveDriveNow(pid, cur);
                          }}
                        />
                      </div>
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

