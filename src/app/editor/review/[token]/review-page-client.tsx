"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CarouselPreviewVision = dynamic(
  () => import("../../../components/health/marketing/ai-carousel/CarouselPreviewVision"),
  { ssr: false }
);

type SlideDto = {
  slide_index: number;
  headline: string;
  body: string;
  layout_snapshot: any;
  input_snapshot: any;
  ai_image_prompt: string;
  updated_at: string;
};

type ProjectDto = {
  id: string;
  title: string;
  updated_at: string;
  caption: string;
  template_type_id: string;
  slide1_template_id_snapshot: string | null;
  slide2_5_template_id_snapshot: string | null;
  slide6_template_id_snapshot: string | null;
  project_background_color: string;
  project_text_color: string;
  background_effect_enabled: boolean;
  background_effect_type: "none" | "dots_n8n";
  background_effect_settings: any;
  review_ready: boolean;
  review_posted: boolean;
  review_approved: boolean;
  review_scheduled: boolean;
  review_comment: string;
  review_source: string;
  slides: SlideDto[];
};

type FeedResp =
  | { success: true; projects: ProjectDto[]; templateSnapshotsById: Record<string, any> }
  | { success: false; error: string };

const EMPTY_LAYOUT: any = {
  canvas: { width: 1080, height: 1440 },
  textLines: [],
  margins: { top: 60, right: 60, bottom: 60, left: 60 },
};

function sanitizeFileName(name: string): string {
  const s = String(name || "").trim() || "carousel";
  return s
    .replace(/[\\/:"*?<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function linkifyTextToNodes(text: string): Array<string | { href: string; label: string }> {
  const s = String(text || "");
  const re = /((https?:\/\/|www\.)[^\s]+)/gi;
  const out: Array<string | { href: string; label: string }> = [];
  let last = 0;
  for (;;) {
    const m = re.exec(s);
    if (!m) break;
    const start = m.index;
    const raw = m[1] || "";
    if (start > last) out.push(s.slice(last, start));
    const trimmed = raw.replace(/[)\].,;!?]+$/g, "");
    const href = trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed;
    out.push({ href, label: trimmed });
    last = start + raw.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function getFabricCanvasFromHandle(handle: any): any | null {
  const h = handle || null;
  const c = (h as any)?.canvas || h;
  if (!c || typeof c.toDataURL !== "function") return null;
  return c;
}

function getFabricCanvasSize(handle: any): { w: number; h: number } {
  const c = getFabricCanvasFromHandle(handle) || ((handle as any)?.canvas || handle || null);
  const w =
    (typeof c?.getWidth === "function" ? Number(c.getWidth()) : NaN) ||
    (typeof c?.width === "number" ? Number(c.width) : NaN) ||
    1080;
  const h =
    (typeof c?.getHeight === "function" ? Number(c.getHeight()) : NaN) ||
    (typeof c?.height === "number" ? Number(c.height) : NaN) ||
    1440;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

const preloadCache = new Map<string, Promise<void>>();

function preloadImage(url: string): Promise<void> {
  const u = String(url || "").trim();
  if (!u) return Promise.resolve();
  const existing = preloadCache.get(u);
  if (existing) return existing;
  const p = new Promise<void>((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve();
      img.onerror = () => resolve(); // best-effort; export will still wait on Fabric objects
      img.src = u;
      // If already cached, load can be synchronous in some browsers; treat it as loaded.
      if (img.complete && (img.naturalWidth || 0) > 0) resolve();
    } catch {
      resolve();
    }
  });
  preloadCache.set(u, p);
  return p;
}

function getFabricImageElement(obj: any): any | null {
  try {
    const el = (typeof obj?.getElement === "function" ? obj.getElement() : null) || obj?._element || obj?._originalElement || null;
    return el || null;
  } catch {
    return null;
  }
}

function isFabricImageLoaded(obj: any): boolean {
  const el: any = getFabricImageElement(obj);
  if (!el) return false;
  const complete = typeof el?.complete === "boolean" ? !!el.complete : true;
  const w = Number(el?.naturalWidth || el?.width || 0);
  const h = Number(el?.naturalHeight || el?.height || 0);
  return complete && w > 0 && h > 0;
}

async function waitForFabricAssetsReady(args: {
  handle: any;
  expectedPrimary: boolean;
  expectedStickers: number;
  timeoutMs: number;
}): Promise<boolean> {
  const { handle, expectedPrimary, expectedStickers, timeoutMs } = args;
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const canvas = getFabricCanvasFromHandle(handle);
    if (!canvas) {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    const objs: any[] = (typeof canvas.getObjects === "function" ? canvas.getObjects() : []) || [];
    const imageObjs = objs.filter((o) => String(o?.type || "").toLowerCase() === "image");
    const primaryCount = objs.filter((o) => String(o?.data?.role || "") === "user-image").length;
    const stickerCount = objs.filter((o) => String(o?.data?.role || "") === "user-image-sticker").length;

    // If the layout expects images, ensure the corresponding Fabric objects exist before exporting.
    if (expectedPrimary && primaryCount < 1) {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    if (expectedStickers > 0 && stickerCount < expectedStickers) {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }

    // Ensure every Fabric image object has a fully loaded <img> element.
    if (!imageObjs.every(isFabricImageLoaded)) {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    return true;
  }
  return false;
}

async function exportFabricCanvasPngBlob(handle: any, multiplier: number): Promise<Blob> {
  const fabricCanvas = getFabricCanvasFromHandle(handle);
  if (!fabricCanvas) throw new Error("Canvas not ready");
  // IMPORTANT:
  // `CarouselPreviewVision` sets a display zoom so the 1080×1440 canvas fits the UI.
  // If we export while zoomed out, the PNG appears "smaller" inside the frame.
  // Mirror `/editor` export behavior: temporarily set zoom=1 for export, then restore.
  const currentZoom = (typeof fabricCanvas.getZoom === "function" ? fabricCanvas.getZoom() : 1) ?? 1;
  try {
    try {
      fabricCanvas.discardActiveObject?.();
    } catch {
      // ignore
    }
    fabricCanvas.setZoom?.(1);
    fabricCanvas.renderAll?.();
    // Let Fabric settle (fonts/images) so the export matches the current render.
    await new Promise((r) => setTimeout(r, 80));
    const dataUrl = fabricCanvas.toDataURL({ format: "png", quality: 3.0, multiplier });
    const res = await fetch(dataUrl);
    return await res.blob();
  } finally {
    fabricCanvas.setZoom?.(currentZoom);
    fabricCanvas.renderAll?.();
  }
}

function IosToggle(props: { label: string; value: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  const { label, value, disabled, onChange } = props;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-semibold text-slate-800">{label}</div>
      <button
        type="button"
        className={[
          "h-8 w-14 rounded-full transition-colors",
          value ? "bg-black" : "bg-slate-300",
          disabled ? "opacity-60" : "",
        ].join(" ")}
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

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={[
            "inline-block rounded-full transition-colors",
            i === active ? "bg-slate-900" : "bg-slate-300",
          ].join(" ")}
          style={{ width: 6, height: 6 }}
        />
      ))}
    </div>
  );
}

function useGlobalCanvasDisplaySize() {
  const [vw, setVw] = useState<number>(() => (typeof window !== "undefined" ? window.innerWidth : 1200));
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Match editor’s 540×720 scale, but adapt down for small viewports.
  const displayW = Math.max(280, Math.min(540, Math.floor(vw - 32)));
  const displayH = Math.round((displayW * 1440) / 1080);
  return { displayW, displayH };
}

export default function ReviewPageClient(props: { token: string }) {
  const token = String(props.token || "").trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [templatesById, setTemplatesById] = useState<Record<string, any>>({});

  const { displayW, displayH } = useGlobalCanvasDisplaySize();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/editor/review-public/${encodeURIComponent(token)}`, { method: "GET", cache: "no-store" });
        const j = (await res.json().catch(() => null)) as FeedResp | null;
        if (!res.ok || !j || (j as any).success !== true) {
          throw new Error(String((j as any)?.error || `Request failed (${res.status})`));
        }
        if (cancelled) return;
        setProjects(Array.isArray((j as any).projects) ? ((j as any).projects as ProjectDto[]) : []);
        setTemplatesById(((j as any).templateSnapshotsById as any) || {});
      } catch (e: any) {
        if (cancelled) return;
        setError(String(e?.message || e || "Failed to load"));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }
    if (token) void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-slate-700">Missing token.</div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-slate-700">Loading…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="text-lg font-semibold text-slate-900">Review link error</div>
          <div className="mt-2 text-sm text-slate-700">{error}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8]">
      <div className="max-w-[900px] mx-auto px-4 py-6">
        <div className="text-lg font-semibold text-slate-900 text-center">
          {projects.length} {projects.length === 1 ? "carousel" : "carousels"} to review
        </div>

        <div className="mt-6 space-y-6">
          {projects.map((p) => (
            <ReviewProjectCard
              key={p.id}
              token={token}
              project={p}
              templatesById={templatesById}
              displayW={displayW}
              displayH={displayH}
              onLocalPatch={(patch) => {
                setProjects((prev) => prev.map((x) => (x.id === p.id ? ({ ...x, ...patch } as any) : x)));
              }}
            />
          ))}
          {projects.length === 0 ? (
            <div className="text-sm text-slate-600">No projects are marked Ready for approval.</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function ReviewProjectCard(props: {
  token: string;
  project: ProjectDto;
  templatesById: Record<string, any>;
  displayW: number;
  displayH: number;
  onLocalPatch: (patch: Partial<ProjectDto>) => void;
}) {
  const { token, project, templatesById, displayW, displayH, onLocalPatch } = props;

  const [activeSlide, setActiveSlide] = useState(0);
  const [copyOk, setCopyOk] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  const [approveBusy, setApproveBusy] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);

  const [commentDraft, setCommentDraft] = useState<string>(() => String(project.review_comment || ""));
  const [commentStatus, setCommentStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const commentTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Keep draft in sync if server state changes (e.g. refresh).
    setCommentDraft(String(project.review_comment || ""));
  }, [project.review_comment]);

  useEffect(() => {
    if (!copyOk) return;
    const t = window.setTimeout(() => setCopyOk(false), 1000);
    return () => window.clearTimeout(t);
  }, [copyOk]);

  const computeTemplateIdForSlide = useCallback(
    (i: number): string | null => {
      if (i === 0) return project.slide1_template_id_snapshot;
      if (i >= 1 && i <= 4) return project.slide2_5_template_id_snapshot;
      if (i === 5) return project.slide6_template_id_snapshot;
      return null;
    },
    [project.slide1_template_id_snapshot, project.slide2_5_template_id_snapshot, project.slide6_template_id_snapshot]
  );

  const templateId = computeTemplateIdForSlide(activeSlide);
  const templateSnap = templateId ? templatesById[templateId] : null;
  const layout = project.slides?.[activeSlide]?.layout_snapshot ?? EMPTY_LAYOUT;
  const inputSnap = project.slides?.[activeSlide]?.input_snapshot ?? null;
  const isEnhanced = project.template_type_id === "enhanced";
  const lockTextLayout = isEnhanced ? !!(inputSnap as any)?.editor?.layoutLocked : false;
  // Important: CarouselPreviewVision has a "preserve user-image position" fallback that can drift across re-renders
  // when `onUserImageChange` is not provided. In /editor, image geometry is always driven by `layout.image`.
  // For the public review page we want the same deterministic behavior without persisting anything.
  const noopUserImageChange = useCallback(() => {}, []);

  const canGoPrev = activeSlide > 0;
  const canGoNext = activeSlide < 5;
  const goPrev = useCallback(() => setActiveSlide((v) => Math.max(0, v - 1)), []);
  const goNext = useCallback(() => setActiveSlide((v) => Math.min(5, v + 1)), []);

  // Best-effort preload all slide images for snappier UX and more reliable exports.
  useEffect(() => {
    try {
      const urls: string[] = [];
      for (let i = 0; i < 6; i++) {
        const lay = (project.slides?.[i]?.layout_snapshot as any) || null;
        const u = String(lay?.image?.url || "").trim();
        if (u) urls.push(u);
        const extras = Array.isArray(lay?.extraImages) ? (lay.extraImages as any[]) : [];
        extras.forEach((x) => {
          const eu = String(x?.url || "").trim();
          if (eu) urls.push(eu);
        });
      }
      urls.forEach((u) => void preloadImage(u));
    } catch {
      // ignore
    }
  }, [project.id, project.slides]);

  const swipeRef = useRef<{ down: boolean; startX: number; lastX: number }>({ down: false, startX: 0, lastX: 0 });
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e as any).pointerType && (e as any).pointerType === "mouse" && (e as any).button !== 0) return;
    swipeRef.current = { down: true, startX: (e as any).clientX ?? 0, lastX: (e as any).clientX ?? 0 };
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!swipeRef.current.down) return;
    swipeRef.current.lastX = (e as any).clientX ?? 0;
  }, []);
  const onPointerUp = useCallback(() => {
    if (!swipeRef.current.down) return;
    swipeRef.current.down = false;
    const dx = swipeRef.current.lastX - swipeRef.current.startX;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setActiveSlide((v) => Math.min(5, v + 1));
    else setActiveSlide((v) => Math.max(0, v - 1));
  }, []);

  const postApprove = useCallback(
    async (next: boolean) => {
      if (approveBusy) return;
      setApproveBusy(true);
      onLocalPatch({ review_approved: next });
      try {
        const res = await fetch(
          `/api/editor/review-public/${encodeURIComponent(token)}/projects/${encodeURIComponent(project.id)}/approve`,
          { method: "POST", body: JSON.stringify({ approved: next }), headers: { "Content-Type": "application/json" } }
        );
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Request failed (${res.status})`));
      } catch {
        // revert
        onLocalPatch({ review_approved: !next });
      } finally {
        setApproveBusy(false);
      }
    },
    [approveBusy, onLocalPatch, project.id, token]
  );

  const postScheduled = useCallback(
    async (next: boolean) => {
      if (scheduleBusy) return;
      setScheduleBusy(true);
      onLocalPatch({ review_scheduled: next });
      try {
        const res = await fetch(
          `/api/editor/review-public/${encodeURIComponent(token)}/projects/${encodeURIComponent(project.id)}/schedule`,
          { method: "POST", body: JSON.stringify({ scheduled: next }), headers: { "Content-Type": "application/json" } }
        );
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Request failed (${res.status})`));
      } catch {
        onLocalPatch({ review_scheduled: !next });
      } finally {
        setScheduleBusy(false);
      }
    },
    [onLocalPatch, project.id, scheduleBusy, token]
  );

  const saveComment = useCallback(
    async (nextComment: string) => {
      setCommentStatus("saving");
      try {
        const res = await fetch(
          `/api/editor/review-public/${encodeURIComponent(token)}/projects/${encodeURIComponent(project.id)}/comment`,
          { method: "POST", body: JSON.stringify({ comment: nextComment }), headers: { "Content-Type": "application/json" } }
        );
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.success) throw new Error(String(j?.error || `Request failed (${res.status})`));
        onLocalPatch({ review_comment: String(j.review_comment || nextComment) });
        setCommentStatus("saved");
        window.setTimeout(() => setCommentStatus("idle"), 1200);
      } catch {
        setCommentStatus("error");
        window.setTimeout(() => setCommentStatus("idle"), 1600);
      }
    },
    [onLocalPatch, project.id, token]
  );

  const onChangeComment = useCallback(
    (v: string) => {
      setCommentDraft(v);
      if (commentTimerRef.current) window.clearTimeout(commentTimerRef.current);
      commentTimerRef.current = window.setTimeout(() => {
        void saveComment(v);
      }, 600);
    },
    [saveComment]
  );

  const onBlurComment = useCallback(() => {
    if (commentTimerRef.current) window.clearTimeout(commentTimerRef.current);
    void saveComment(commentDraft);
  }, [commentDraft, saveComment]);

  const onCopyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(String(project.caption || ""));
      setCopyOk(true);
    } catch {
      // ignore
    }
  }, [project.caption]);

  const zipRefs = useRef<Array<{ current: any }>>(Array.from({ length: 6 }).map(() => ({ current: null })));
  const [pdfBusy, setPdfBusy] = useState(false);
  const exportBusy = zipBusy || pdfBusy;

  const getNextBundleName = useCallback((base: string): string => {
    try {
      const key = `dn.review.zip.counter.${project.id}`;
      const raw = localStorage.getItem(key) || "0";
      const n = Math.max(0, Math.min(99, Number(raw) || 0));
      const next = n + 1;
      localStorage.setItem(key, String(next));
      return next <= 1 ? base : `${base}_${next - 1}`;
    } catch {
      return base;
    }
  }, [project.id]);

  const getNextPdfBundleName = useCallback((base: string): string => {
    try {
      const key = `dn.review.pdf.counter.${project.id}`;
      const raw = localStorage.getItem(key) || "0";
      const n = Math.max(0, Math.min(99, Number(raw) || 0));
      const next = n + 1;
      localStorage.setItem(key, String(next));
      return next <= 1 ? base : `${base}_${next - 1}`;
    } catch {
      return base;
    }
  }, [project.id]);

  const onDownloadZip = useCallback(async () => {
    if (exportBusy) return;
    setZipBusy(true);
    try {
      // Clear any stale refs from previous exports/projects before mounting hidden canvases.
      for (let i = 0; i < 6; i++) (zipRefs.current[i] as any).current = null;

      const JSZipMod = await import("jszip");
      const JSZip = (JSZipMod as any)?.default || (JSZipMod as any);
      const zip = new JSZip();
      const base = sanitizeFileName(project.title);
      const bundleName = getNextBundleName(base);

      // Ensure hidden canvases exist (they mount only while zipBusy).
      const t0 = Date.now();
      while (Date.now() - t0 < 6000) {
        const ok = zipRefs.current.every((r) => !!getFabricCanvasFromHandle((r as any)?.current));
        if (ok) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      // Wait for images/assets to finish loading into Fabric before export.
      for (let i = 0; i < 6; i++) {
        const lay = project.slides?.[i]?.layout_snapshot ?? EMPTY_LAYOUT;
        const expectedPrimary = !!String((lay as any)?.image?.url || "").trim();
        const expectedStickers = Array.isArray((lay as any)?.extraImages)
          ? (lay as any).extraImages.filter((x: any) => !!String(x?.url || "").trim()).length
          : 0;
        const ok = await waitForFabricAssetsReady({
          handle: (zipRefs.current[i] as any)?.current,
          expectedPrimary,
          expectedStickers,
          timeoutMs: 15_000,
        });
        if (!ok) throw new Error("Slides are still loading images. Please wait a moment and try again.");
      }

      for (let i = 0; i < 6; i++) {
        const blob = await exportFabricCanvasPngBlob(zipRefs.current[i]?.current, 3);
        const ab = await blob.arrayBuffer();
        const fileName = `${bundleName}_slide_${i + 1}.png`;
        zip.file(fileName, ab);
      }

      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bundleName}.zip`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setZipBusy(false);
    }
  }, [exportBusy, getNextBundleName, project.slides, project.title]);

  const onDownloadPdf = useCallback(async () => {
    if (exportBusy) return;
    setPdfBusy(true);
    try {
      // Clear any stale refs from previous exports/projects before mounting hidden canvases.
      for (let i = 0; i < 6; i++) (zipRefs.current[i] as any).current = null;

      const PdfLibMod = await import("pdf-lib");
      const PDFDocument = (PdfLibMod as any)?.PDFDocument || (PdfLibMod as any)?.default?.PDFDocument;
      if (!PDFDocument) throw new Error("PDF engine not available");

      const pdfDoc = await PDFDocument.create();
      const base = sanitizeFileName(project.title);
      const bundleName = getNextPdfBundleName(base);

      // Ensure hidden canvases exist (they mount only while exporting).
      const t0 = Date.now();
      while (Date.now() - t0 < 6000) {
        const ok = zipRefs.current.every((r) => !!getFabricCanvasFromHandle((r as any)?.current));
        if (ok) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      if (!zipRefs.current.every((r) => !!getFabricCanvasFromHandle((r as any)?.current))) {
        throw new Error("Slides are still rendering. Please wait a moment and try again.");
      }

      // Wait for images/assets to finish loading into Fabric before export.
      for (let i = 0; i < 6; i++) {
        const lay = project.slides?.[i]?.layout_snapshot ?? EMPTY_LAYOUT;
        const expectedPrimary = !!String((lay as any)?.image?.url || "").trim();
        const expectedStickers = Array.isArray((lay as any)?.extraImages)
          ? (lay as any).extraImages.filter((x: any) => !!String(x?.url || "").trim()).length
          : 0;
        const ok = await waitForFabricAssetsReady({
          handle: (zipRefs.current[i] as any)?.current,
          expectedPrimary,
          expectedStickers,
          timeoutMs: 15_000,
        });
        if (!ok) throw new Error("Slides are still loading images. Please wait a moment and try again.");
      }

      const { w: pageW, h: pageH } = getFabricCanvasSize(zipRefs.current[0]?.current);

      for (let i = 0; i < 6; i++) {
        const pngBlob = await exportFabricCanvasPngBlob(zipRefs.current[i]?.current, 3);
        const buf = await pngBlob.arrayBuffer();
        const png = await pdfDoc.embedPng(buf);
        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(png, { x: 0, y: 0, width: pageW, height: pageH });
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bundleName}.pdf`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setPdfBusy(false);
    }
  }, [exportBusy, getNextPdfBundleName, project.slides, project.title]);

  const hiddenExportCanvases = useMemo(() => {
    if (!exportBusy) return null;
    return (
      <div style={{ position: "absolute", left: -100000, top: -100000, width: 1, height: 1, overflow: "hidden" }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const tid = computeTemplateIdForSlide(i);
          const snap = tid ? templatesById[tid] : null;
          const lay = project.slides?.[i]?.layout_snapshot ?? EMPTY_LAYOUT;
          if (!tid || !snap) return null;
          return (
            <CarouselPreviewVision
              key={i}
              ref={(node: any) => {
                (zipRefs.current[i] as any).current = node;
              }}
              templateId={tid}
              slideIndex={i}
              layout={lay}
              backgroundColor={project.project_background_color}
              textColor={project.project_text_color}
              deferInit={false}
              backgroundEffectEnabled={project.background_effect_enabled}
              backgroundEffectType={project.background_effect_type}
              enableTemplateImageMasks={true}
              enableTemplateArrowShapes={true}
              templateSnapshot={snap}
              hasHeadline={project.template_type_id !== "regular"}
              tightUserTextWidth={project.template_type_id !== "regular"}
              contentPaddingPx={40}
              clampUserTextToContentRect={true}
              clampUserImageToContentRect={false}
              pushTextOutOfUserImage={project.template_type_id !== "regular"}
              lockTextLayout={
                project.template_type_id === "enhanced" ? !!(project.slides?.[i]?.input_snapshot as any)?.editor?.layoutLocked : false
              }
              onUserImageChange={noopUserImageChange}
              // export-only; do not attach any handlers
            />
          );
        })}
      </div>
    );
  }, [computeTemplateIdForSlide, exportBusy, noopUserImageChange, project, templatesById]);

  const sourceNodes = useMemo(() => linkifyTextToNodes(String(project.review_source || "")), [project.review_source]);

  return (
    <article className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{project.title || "Untitled Project"}</div>
          {String(project.review_source || "").trim() ? (
            <div className="mt-1 text-[12px] text-slate-700 whitespace-pre-wrap break-words">
              {sourceNodes.map((n, idx) =>
                typeof n === "string" ? (
                  <span key={idx}>{n}</span>
                ) : (
                  <a
                    key={idx}
                    href={n.href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-slate-900 hover:text-black"
                  >
                    {n.label}
                  </a>
                )
              )}
            </div>
          ) : null}
          <div className="text-[11px] text-slate-500">Updated {project.updated_at ? new Date(project.updated_at).toLocaleString() : ""}</div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700 disabled:opacity-50"
            onClick={goPrev}
            disabled={!canGoPrev}
            aria-label="Previous slide"
            title="Previous"
          >
            ←
          </button>
          <div className="relative" style={{ width: displayW, height: displayH }}>
            <div style={{ pointerEvents: "none" }}>
              {templateId && templateSnap ? (
                <CarouselPreviewVision
                  templateId={templateId}
                  slideIndex={activeSlide}
                  layout={layout}
                  backgroundColor={project.project_background_color}
                  textColor={project.project_text_color}
                  deferInit={false}
                  backgroundEffectEnabled={project.background_effect_enabled}
                  backgroundEffectType={project.background_effect_type}
                  enableTemplateImageMasks={true}
                  enableTemplateArrowShapes={true}
                  templateSnapshot={templateSnap}
                  hasHeadline={project.template_type_id !== "regular"}
                  tightUserTextWidth={project.template_type_id !== "regular"}
                  contentPaddingPx={40}
                  clampUserTextToContentRect={true}
                  clampUserImageToContentRect={false}
                  pushTextOutOfUserImage={project.template_type_id !== "regular"}
                  lockTextLayout={lockTextLayout}
                  onUserImageChange={noopUserImageChange}
                  frameStyle={{ borderRadius: 0 }}
                  displayWidthPx={displayW}
                  displayHeightPx={displayH}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">Loading…</div>
              )}
            </div>
            {/* swipe surface */}
            <div
              className="absolute inset-0"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              role="presentation"
            />
          </div>
          <button
            type="button"
            className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700 disabled:opacity-50"
            onClick={goNext}
            disabled={!canGoNext}
            aria-label="Next slide"
            title="Next"
          >
            →
          </button>
        </div>
        <Dots count={6} active={activeSlide} />
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Caption</div>
          <button
            type="button"
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50"
            onClick={() => void onCopyCaption()}
            title="Copy caption"
          >
            {copyOk ? "Copied ✓" : "Copy caption"}
          </button>
        </div>
        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{project.caption || ""}</div>

        <div className="mt-4 space-y-2">
          <IosToggle
            label="Approved"
            value={!!project.review_approved}
            disabled={approveBusy}
            onChange={(next) => void postApprove(next)}
          />
          <IosToggle
            label="VA step: Scheduled"
            value={!!project.review_scheduled}
            disabled={scheduleBusy}
            onChange={(next) => void postScheduled(next)}
          />
        </div>

        {project.review_approved ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="h-10 flex-1 rounded-xl bg-[#6D28D9] text-white text-sm font-semibold shadow-sm disabled:opacity-60"
              onClick={() => void onDownloadZip()}
              disabled={exportBusy}
              title="Download all slides as a ZIP"
            >
              {zipBusy ? "Preparing…" : "Download All (ZIP)"}
            </button>
            <button
              type="button"
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60"
              onClick={() => void onDownloadPdf()}
              disabled={exportBusy}
              title="Download all slides as a PDF"
            >
              {pdfBusy ? "Preparing…" : "Download PDF"}
            </button>
          </div>
        ) : null}

        <div className="mt-4">
          <div className="text-sm font-semibold text-slate-900">Comment</div>
          <textarea
            className="mt-2 w-full min-h-[96px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm"
            value={commentDraft}
            onChange={(e) => onChangeComment(e.target.value)}
            onBlur={onBlurComment}
            placeholder="Leave a single note for this carousel…"
          />
          <div className="mt-1 text-xs text-slate-600">
            {commentStatus === "saving"
              ? "Saving…"
              : commentStatus === "saved"
                ? "Saved ✓"
                : commentStatus === "error"
                  ? "Save failed"
                  : ""}
          </div>
        </div>
      </div>

      {hiddenExportCanvases}
    </article>
  );
}

