import { useCallback } from "react";

export function useCanvasExport(params: {
  slideCount: number;
  slideCanvasRefs: { current: Array<{ current: any }> };
  projectTitle: string;
  topExporting: boolean;
  setTopExporting: (next: boolean) => void;
  setMobileSaveBusy: (next: number | null) => void;
  setMobileSaveOpen: (next: boolean) => void;
}) {
  const {
    slideCount,
    slideCanvasRefs,
    projectTitle,
    topExporting,
    setTopExporting,
    setMobileSaveBusy,
    setMobileSaveOpen,
  } = params;

  const sanitizeFileName = useCallback((s: string) => {
    const base = String(s || "").trim() || "Project";
    // Remove characters that are invalid in common filesystems.
    const cleaned = base.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
    return cleaned.slice(0, 80) || "Project";
  }, []);

  const getNextBundleName = useCallback((baseName: string) => {
    try {
      const key = `editor.downloadAll.bundleIndex:${baseName}`;
      const raw = localStorage.getItem(key);
      const n = raw ? Number(raw) : 0;
      const next = Number.isFinite(n) && n > 0 ? n : 0;
      const name = next === 0 ? baseName : `${baseName}_${next}`;
      localStorage.setItem(key, String(next + 1));
      return name;
    } catch {
      // Fallback to timestamp if localStorage is unavailable.
      return `${baseName}_${Date.now()}`;
    }
  }, []);

  const getFabricCanvasFromHandle = useCallback((handle: any) => {
    return handle?.canvas || handle || null;
  }, []);

  const getFabricCanvasSize = useCallback(
    (handle: any): { w: number; h: number } => {
      const fabricCanvas = getFabricCanvasFromHandle(handle);
      const w = Number(fabricCanvas?.getWidth?.() ?? fabricCanvas?.width ?? 0);
      const h = Number(fabricCanvas?.getHeight?.() ?? fabricCanvas?.height ?? 0);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        throw new Error("Canvas not ready");
      }
      return { w, h };
    },
    [getFabricCanvasFromHandle]
  );

  const exportFabricCanvasPngBlob = useCallback(async (handle: any) => {
    const fabricCanvas = getFabricCanvasFromHandle(handle);
    if (!fabricCanvas || typeof fabricCanvas.toDataURL !== "function") {
      throw new Error("Canvas not ready");
    }
    const currentZoom = fabricCanvas.getZoom?.() ?? 1;
    try {
      try {
        fabricCanvas.discardActiveObject?.();
      } catch {
        // ignore
      }
      fabricCanvas.setZoom?.(1);
      fabricCanvas.renderAll?.();
      await new Promise((r) => setTimeout(r, 80));
      const dataURL = fabricCanvas.toDataURL({
        format: "png",
        quality: 3.0,
        multiplier: 3,
      });
      const res = await fetch(dataURL);
      return await res.blob();
    } finally {
      fabricCanvas.setZoom?.(currentZoom);
      fabricCanvas.renderAll?.();
    }
  }, [getFabricCanvasFromHandle]);

  const handleDownloadAll = useCallback(
    async (opts?: { allowWhenExporting?: boolean }) => {
      if (topExporting && !opts?.allowWhenExporting) return;
      setTopExporting(true);
      try {
        const baseName = sanitizeFileName(projectTitle);
        const bundleName = getNextBundleName(baseName);

        // Ensure all slide canvases are mounted.
        const handles = slideCanvasRefs.current.map((r) => r.current);
        if (handles.some((h) => !getFabricCanvasFromHandle(h))) {
          alert("Slides are still rendering. Please wait a moment and try again.");
          return;
        }

        // Keep this lazy require to avoid SSR/bundle surprises.
        const JSZipMod = await import("jszip");
        const JSZip = (JSZipMod as any)?.default || (JSZipMod as any);
        const zip = new JSZip();
        const folder = zip.folder(bundleName) || zip;

        for (let i = 0; i < slideCount; i++) {
          const blob = await exportFabricCanvasPngBlob(handles[i]);
          folder.file(`slide-${i + 1}.png`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.download = `${bundleName}.zip`;
        link.href = url;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      } catch (e: any) {
        console.error("[Editor] Download All failed:", e);
        alert(e?.message || "Download failed. Please try again.");
      } finally {
        setTopExporting(false);
      }
    },
    [
      exportFabricCanvasPngBlob,
      getFabricCanvasFromHandle,
      getNextBundleName,
      projectTitle,
      sanitizeFileName,
      setTopExporting,
      slideCanvasRefs,
      slideCount,
      topExporting,
    ]
  );

  const handleDownloadPdf = useCallback(
    async () => {
      if (topExporting) return;
      setTopExporting(true);
      try {
        const baseName = sanitizeFileName(projectTitle);
        const bundleName = getNextBundleName(baseName);

        // Ensure all slide canvases are mounted.
        const handles = slideCanvasRefs.current.map((r) => r.current);
        if (handles.some((h) => !getFabricCanvasFromHandle(h))) {
          alert("Slides are still rendering. Please wait a moment and try again.");
          return;
        }

        // Use the real canvas size for the PDF page size (full-bleed).
        const { w: pageW, h: pageH } = getFabricCanvasSize(handles[0]);

        // Lazy import to avoid SSR/bundle surprises.
        const PdfLibMod = await import("pdf-lib");
        const PDFDocument = (PdfLibMod as any)?.PDFDocument || (PdfLibMod as any)?.default?.PDFDocument;
        if (!PDFDocument) throw new Error("PDF engine not available");

        const pdfDoc = await PDFDocument.create();

        for (let i = 0; i < slideCount; i++) {
          const pngBlob = await exportFabricCanvasPngBlob(handles[i]);
          const buf = await pngBlob.arrayBuffer();
          const png = await pdfDoc.embedPng(buf);
          const page = pdfDoc.addPage([pageW, pageH]);
          page.drawImage(png, { x: 0, y: 0, width: pageW, height: pageH });
        }

        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.download = `${bundleName}.pdf`;
        link.href = url;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      } catch (e: any) {
        console.error("[Editor] Download PDF failed:", e);
        alert(e?.message || "Download failed. Please try again.");
      } finally {
        setTopExporting(false);
      }
    },
    [
      exportFabricCanvasPngBlob,
      getFabricCanvasFromHandle,
      getFabricCanvasSize,
      getNextBundleName,
      projectTitle,
      sanitizeFileName,
      setTopExporting,
      slideCanvasRefs,
      slideCount,
      topExporting,
    ]
  );

  const shareSingleSlide = useCallback(
    async (slideIndex: number) => {
      const handle = slideCanvasRefs.current[slideIndex]?.current;
      if (!getFabricCanvasFromHandle(handle)) {
        alert("Slide is still rendering. Please wait a moment and try again.");
        return;
      }
      if (typeof navigator === "undefined" || typeof (navigator as any).share !== "function") {
        alert("Sharing is not supported on this device/browser.");
        return;
      }
      setMobileSaveBusy(slideIndex);
      try {
        const baseName = sanitizeFileName(projectTitle);
        const blob = await exportFabricCanvasPngBlob(handle);
        const file = new File([blob], `${baseName}-slide-${slideIndex + 1}.png`, { type: "image/png" });
        const canShareSingle =
          typeof (navigator as any).canShare !== "function" || (navigator as any).canShare({ files: [file] });
        if (!canShareSingle) {
          alert("Sharing files is not supported on this device/browser.");
          return;
        }
        await (navigator as any).share({
          title: baseName,
          text: `Slide ${slideIndex + 1}`,
          files: [file],
        });
      } catch (e: any) {
        if (String(e?.name || "").toLowerCase().includes("abort")) return;
        alert("Share failed. Please try again.");
      } finally {
        setMobileSaveBusy(null);
      }
    },
    [
      exportFabricCanvasPngBlob,
      getFabricCanvasFromHandle,
      projectTitle,
      sanitizeFileName,
      setMobileSaveBusy,
      slideCanvasRefs,
    ]
  );

  const handleShareAll = useCallback(async () => {
    if (topExporting) return;
    setTopExporting(true);
    try {
      const baseName = sanitizeFileName(projectTitle);
      const bundleName = getNextBundleName(baseName);
      const handles = slideCanvasRefs.current.map((r) => r.current);
      if (handles.some((h) => !getFabricCanvasFromHandle(h))) {
        alert("Slides are still rendering. Please wait a moment and try again.");
        return;
      }

      if (typeof navigator === "undefined" || typeof (navigator as any).share !== "function") {
        // No share sheet at all -> fallback to ZIP (Files app).
        await handleDownloadAll({ allowWhenExporting: true });
        return;
      }

      // Capability probe: generate ONE file and see if multi-file share is supported via canShare().
      // If it isn't, we prefer a per-slide Save flow (no ZIP) on mobile.
      const blob0 = await exportFabricCanvasPngBlob(handles[0]);
      const file0 = new File([blob0], `${bundleName}-slide-1.png`, { type: "image/png" });
      const canShareSingle =
        typeof (navigator as any).canShare !== "function" || (navigator as any).canShare({ files: [file0] });
      if (!canShareSingle) {
        await handleDownloadAll({ allowWhenExporting: true });
        return;
      }

      const canShareMulti =
        typeof (navigator as any).canShare === "function" ? (navigator as any).canShare({ files: [file0, file0] }) : false;

      if (!canShareMulti) {
        // Mobile-friendly fallback: per-slide share UI (no ZIP).
        setMobileSaveOpen(true);
        return;
      }

      // Multi-file sharing supported -> generate the rest and share all.
      const files: File[] = [file0];
      for (let i = 1; i < slideCount; i++) {
        const blob = await exportFabricCanvasPngBlob(handles[i]);
        files.push(new File([blob], `${bundleName}-slide-${i + 1}.png`, { type: "image/png" }));
      }

      await (navigator as any).share({ title: bundleName, text: bundleName, files });
    } catch (e: any) {
      console.error("[Editor] Share All failed:", e);
      // If user cancels share, don't show an error.
      if (String(e?.name || "").toLowerCase().includes("abort")) return;
      alert("Save failed. Please try again.");
    } finally {
      setTopExporting(false);
    }
  }, [
    exportFabricCanvasPngBlob,
    getFabricCanvasFromHandle,
    getNextBundleName,
    handleDownloadAll,
    projectTitle,
    sanitizeFileName,
    setMobileSaveOpen,
    setTopExporting,
    slideCanvasRefs,
    slideCount,
    topExporting,
  ]);

  const handleTopDownload = useCallback(() => {
    // Replaced by "Download All" ZIP in the top bar (kept function name for minimal UI churn).
    void handleDownloadAll();
  }, [handleDownloadAll]);

  return { handleTopDownload, handleDownloadAll, handleDownloadPdf, handleShareAll, shareSingleSlide };
}

