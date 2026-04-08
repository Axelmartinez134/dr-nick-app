"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/components/auth/AuthContext";
import { useEditorSelector } from "@/features/editor/store";
import { exportFabricCanvasPngBlobFromHandle, getFabricCanvasFromHandle } from "@/features/editor/hooks/useCanvasExport";

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

export function ScriptChatOverlayButton() {
  const isSuperadmin = useEditorSelector((s: any) => !!(s as any).isSuperadmin);
  const isMobile = useEditorSelector((s: any) => !!(s as any).isMobile);
  const currentProjectId = useEditorSelector((s: any) => ((s as any).currentProjectId ? String((s as any).currentProjectId) : null));
  const projectTitle = useEditorSelector((s: any) => String((s as any).projectTitle || ""));
  const reviewReady = useEditorSelector((s: any) => !!(s as any).reviewReady);
  const reviewPosted = useEditorSelector((s: any) => !!(s as any).reviewPosted);
  const slides = useEditorSelector((s: any) => (s as any)?.bottomPanelUi?.slides || (s as any)?.workspaceUi?.slides || []);
  const workspaceRefs = useEditorSelector((s: any) => (s as any).workspaceRefs);
  const actions = useEditorSelector((s: any) => (s as any).actions);

  const pid = useMemo(() => (currentProjectId ? String(currentProjectId) : ""), [currentProjectId]);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error" | "loading">("idle");
  const [copySlidesStatus, setCopySlidesStatus] = useState<"idle" | "copied" | "error" | "loading">("idle");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "loading" | "uploaded" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [driveFolderId, setDriveFolderId] = useState<string>("");
  const [driveFolderIdLoading, setDriveFolderIdLoading] = useState<boolean>(false);

  const buildPromptPreviewText = (args: { system: string; contextText: string }) => {
    const sys = String(args.system || "").trim();
    const ctx = String(args.contextText || "").trim();
    const firstMsg = "<type your first message here>";
    return [
      `SYSTEM:\n${sys || "-"}`,
      ``,
      `CACHED_CONTEXT_BLOCK (frozen):\n${ctx || "-"}`,
      ``,
      `FIRST_USER_MESSAGE:\n${firstMsg}`,
    ].join("\n");
  };

  const carouselSlidesCopyText = useMemo(() => {
    const title = String(projectTitle || "").trim() || "-";
    const slideSections = Array.from({ length: 6 }).map((_, idx) => {
      const linesRaw = (slides as any[])?.[idx]?.layoutData?.layout?.textLines;
      const lines = Array.isArray(linesRaw)
        ? linesRaw
            .map((line: any) => String(line?.text ?? ""))
            .map((text) => text.trim())
            .filter((text) => text.length > 0)
        : null;
      const joined = lines && lines.length > 0 ? lines.join("\n") : "(no text lines)";
      return `SLIDE ${idx + 1} (textLines):\n${joined}`;
    });
    return [`PROJECT_TITLE:\n${title}`, `CAROUSEL_TEXTLINES:\n${slideSections.join("\n\n")}`].join("\n\n");
  }, [projectTitle, slides]);

  const canCopyCarouselSlides = useMemo(() => {
    const rows = Array.isArray(slides) ? slides : [];
    if (rows.length !== 6) return false;
    return rows.every((slide: any) => Array.isArray(slide?.layoutData?.layout?.textLines));
  }, [slides]);
  const canUploadToDrive = !!reviewReady && !reviewPosted;

  useEffect(() => {
    setUploadStatus("idle");
    setUploadError(null);
  }, [pid]);

  useEffect(() => {
    if (!isSuperadmin || !pid) return;
    let cancelled = false;

    const loadDriveFolderId = async () => {
      setDriveFolderIdLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing auth token");
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
        const res = await fetch("/api/editor/user-settings/google-drive-folder-id", { method: "GET", headers });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load Drive Folder ID (${res.status})`));
        if (cancelled) return;
        setDriveFolderId(String(j?.googleDriveFolderId || ""));
      } catch {
        if (cancelled) return;
        setDriveFolderId("");
      } finally {
        if (!cancelled) setDriveFolderIdLoading(false);
      }
    };

    void loadDriveFolderId();
    const onDriveFolderIdUpdated = () => {
      void loadDriveFolderId();
    };
    window.addEventListener("editor:drive-folder-id-updated", onDriveFolderIdUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("editor:drive-folder-id-updated", onDriveFolderIdUpdated);
    };
  }, [isSuperadmin, pid]);

  // Mobile UX: hide overlay buttons (Copy action is moved into the bottom Controls card).
  if (isMobile) return null;
  if (!isSuperadmin || !pid) return null;

  const copyPlainText = async (text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through
    }

    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (!ok) throw new Error("copy command failed");
    return true;
  };

  const copyScriptPrompt = async () => {
    if (copyStatus === "loading") return;
    setCopyStatus("loading");
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...getActiveAccountHeader() };
      const res = await fetch(`/api/editor/projects/script-chat/prompt-preview?projectId=${encodeURIComponent(pid)}`, { method: "GET", headers });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(String(j?.error || `Failed to load prompt (${res.status})`));

      const text = buildPromptPreviewText({ system: String(j?.system || ""), contextText: String(j?.contextText || "") });
      await copyPlainText(text);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1200);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 1600);
    }
  };

  const copyCarouselSlides = async () => {
    if (!canCopyCarouselSlides || copySlidesStatus === "loading") return;
    setCopySlidesStatus("loading");
    try {
      await copyPlainText(carouselSlidesCopyText);
      setCopySlidesStatus("copied");
      window.setTimeout(() => setCopySlidesStatus("idle"), 1200);
    } catch {
      setCopySlidesStatus("error");
      window.setTimeout(() => setCopySlidesStatus("idle"), 1600);
    }
  };

  const uploadToDrive = async () => {
    if (!pid || uploadStatus === "loading") return;
    setUploadStatus("loading");
    setUploadError(null);
    try {
      const slideCanvasRefs = (workspaceRefs as any)?.slideCanvasRefs;
      const handles = Array.isArray(slideCanvasRefs?.current) ? slideCanvasRefs.current.map((r: any) => r?.current) : [];
      if (handles.length < 6 || handles.slice(0, 6).some((handle: any) => !getFabricCanvasFromHandle(handle))) {
        throw new Error("Slides are still rendering. Please wait a moment and try again.");
      }

      const fd = new FormData();
      fd.append("projectId", pid);
      fd.append("projectTitle", String(projectTitle || "").trim());
      for (let i = 0; i < 6; i += 1) {
        const blob = await exportFabricCanvasPngBlobFromHandle(handles[i]);
        fd.append("slides", new File([blob], `slide-${i + 1}.png`, { type: "image/png" }));
      }

      const token = await getToken();
      if (!token) throw new Error("Missing auth token");
      const res = await fetch("/api/editor/review/projects/upload-to-drive", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...getActiveAccountHeader(),
        },
        body: fd,
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) {
        console.error("[upload-to-drive] request failed", {
          status: res.status,
          debugId: j?.debugId || null,
          error: j?.error || null,
        });
        const debugSuffix = j?.debugId ? ` [debugId: ${String(j.debugId)}]` : "";
        throw new Error(String(j?.error || `Drive upload failed (${res.status})`) + debugSuffix);
      }

      setUploadStatus("uploaded");
      window.setTimeout(() => setUploadStatus("idle"), 1500);
    } catch (e: any) {
      console.error("[upload-to-drive] unexpected error", e);
      setUploadStatus("error");
      setUploadError(String(e?.message || e || "Drive upload failed"));
    }
  };

  return (
    <div className="absolute right-[5px] top-[5px] z-[50] flex items-center gap-2">
      {copySlidesStatus === "copied" || copyStatus === "copied" ? (
        <div className="text-[11px] font-semibold text-emerald-700 bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-2 py-1 shadow-lg">
          Copied
        </div>
      ) : copySlidesStatus === "error" || copyStatus === "error" ? (
        <div className="text-[11px] font-semibold text-red-600 bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-2 py-1 shadow-lg">
          Copy failed
        </div>
      ) : uploadStatus === "uploaded" ? (
        <div className="text-[11px] font-semibold text-emerald-700 bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-2 py-1 shadow-lg">
          Uploaded ✓
        </div>
      ) : uploadStatus === "error" ? (
        <div
          className="text-[11px] font-semibold text-red-600 bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-2 py-1 shadow-lg"
          title={uploadError || "Drive upload failed"}
        >
          Upload failed
        </div>
      ) : null}

      <button
        type="button"
        className="h-9 px-3 rounded-xl border border-slate-200 bg-white/95 backdrop-blur text-[12px] font-semibold text-slate-800 shadow-lg hover:bg-white disabled:opacity-60"
        onClick={() => void copyCarouselSlides()}
        disabled={!canCopyCarouselSlides || copySlidesStatus === "loading"}
        title={canCopyCarouselSlides ? "Copy the live project title and carousel slide text lines" : "Generate/Realign first"}
      >
        {copySlidesStatus === "loading" ? "Copying…" : "Copy Carousel Slides"}
      </button>
      <button
        type="button"
        className="h-9 px-3 rounded-xl border border-slate-200 bg-white/95 backdrop-blur text-[12px] font-semibold text-slate-800 shadow-lg hover:bg-white disabled:opacity-60"
        onClick={() => void copyScriptPrompt()}
        disabled={copyStatus === "loading"}
        title="Copy the full Script prompt preview"
      >
        {copyStatus === "loading" ? "Copying…" : "Copy Script Prompt"}
      </button>
      <button
        type="button"
        className={[
          "h-9 px-3 rounded-xl border backdrop-blur text-[12px] font-semibold shadow-lg disabled:opacity-60",
          uploadStatus === "error"
            ? "border-red-200 bg-red-50/95 text-red-700 hover:bg-red-50"
            : uploadStatus === "uploaded"
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-700 hover:bg-emerald-50"
              : "border-slate-200 bg-white/95 text-slate-800 hover:bg-white",
        ].join(" ")}
        onClick={() => void uploadToDrive()}
        disabled={uploadStatus === "loading" || driveFolderIdLoading || !String(driveFolderId || "").trim() || !canUploadToDrive}
        title={
          !String(driveFolderId || "").trim()
            ? "Set Drive Folder ID first"
            : !canUploadToDrive
              ? "Only ready, unposted projects can upload to Drive"
              : uploadError || "Upload the current carousel to Google Drive"
        }
      >
        {uploadStatus === "loading" ? "Uploading…" : uploadStatus === "uploaded" ? "Uploaded ✓" : uploadStatus === "error" ? "Upload failed" : "Upload to Drive"}
      </button>
      <button
        type="button"
        className="h-9 px-3 rounded-xl border border-slate-200 bg-white/95 backdrop-blur text-[12px] font-semibold text-slate-800 shadow-lg hover:bg-white"
        onClick={() => actions?.onOpenScriptChatModal?.(pid)}
        title="Chat with AI to draft a Reel script"
      >
        Create Script
      </button>
    </div>
  );
}

