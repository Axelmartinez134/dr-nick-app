"use client";

import { useCallback } from "react";
import { getAuthedRequestHeaders } from "../services/htmlProjectsApi";

function sanitizeFileName(input: string) {
  const base = String(input || "html-carousel")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "html-carousel";
}

export function useHtmlSlideExport() {
  const downloadAll = useCallback(async (args: { projectId: string; projectTitle: string }) => {
    const headers = await getAuthedRequestHeaders();
    const response = await fetch("/api/editor/html-projects/render", {
      method: "POST",
      headers,
      body: JSON.stringify({ projectId: args.projectId, format: "zip" }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(String(data?.error || `Export failed (${response.status})`));
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(args.projectTitle)}.zip`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, []);

  return {
    downloadAll,
  };
}
