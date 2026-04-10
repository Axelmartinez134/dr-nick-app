"use client";

import { supabase } from "@/app/components/auth/AuthContext";
import type { HtmlAspectRatio } from "../lib/htmlDocumentWrapper";
import type { HtmlDesignPreset } from "../lib/presets";

export type HtmlProjectListItem = {
  id: string;
  title: string;
  template_type_id: string;
  updated_at: string;
};

export type HtmlProjectShellData = {
  projects: HtmlProjectListItem[];
  project: any;
  slides: any[];
  htmlSlides: Array<{
    id: string;
    slideIndex: number;
    html: string | null;
    pageTitle: string | null;
    pageType: string | null;
  }>;
  htmlPresetId: string | null;
  htmlStyleGuide: any;
  htmlGenerationStatus: "idle" | "generating" | "partial" | "complete" | "failed";
  htmlGenerationId: string | null;
};

export type HtmlCopyDraft = {
  projectTitle: string;
  slides: Array<{
    slideNumber: number;
    textLines: string[];
  }>;
};

export type HtmlGenerationPage = {
  pageIndex: number;
  totalPages: number;
  page: {
    pageNumber: number;
    title: string;
    html: string;
    needsImage: boolean;
  };
};

export type HtmlRefinementPage = {
  pageIndex: number;
  page: {
    html: string;
  };
};

export type HtmlCarouselRefinementPage = {
  pageIndex: number;
  page: {
    html: string;
  };
};

export type HtmlCarouselRefinementError = {
  pageIndex?: number;
  message: string;
};

export const HTML_RUNTIME_PROJECT_ID_HINT_KEY = "editor.runtimeProjectIdHint";

function getActiveAccountId(): string {
  try {
    return typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
  } catch {
    return "";
  }
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export async function getAuthedRequestHeaders(extraHeaders?: HeadersInit) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Unauthorized");
  const activeAccountId = getActiveAccountId();
  const headers = new Headers(extraHeaders || {});
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (activeAccountId) headers.set("x-account-id", activeAccountId);
  return Object.fromEntries(headers.entries());
}

export function setRuntimeProjectIdHint(projectId: string) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(HTML_RUNTIME_PROJECT_ID_HINT_KEY, String(projectId || "").trim());
  } catch {
    // ignore
  }
}

export function getRuntimeProjectIdHint(): string {
  try {
    return typeof localStorage !== "undefined" ? String(localStorage.getItem(HTML_RUNTIME_PROJECT_ID_HINT_KEY) || "").trim() : "";
  } catch {
    return "";
  }
}

export function clearRuntimeProjectIdHint() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(HTML_RUNTIME_PROJECT_ID_HINT_KEY);
  } catch {
    // ignore
  }
}

export async function authedFetchJson(url: string, init?: RequestInit) {
  const headers = await getAuthedRequestHeaders(init?.headers);
  const response = await fetch(url, {
    ...init,
    headers,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(String(data?.error || `Request failed (${response.status})`));
  }
  return data;
}

export async function loadHtmlProjectShellData(preferredProjectId?: string | null): Promise<HtmlProjectShellData> {
  const initialState = await authedFetchJson("/api/editor/initial-state", {
    method: "POST",
    body: JSON.stringify({ templateTypeId: "regular" }),
  });

  const projects: HtmlProjectListItem[] = Array.isArray(initialState?.projects) ? initialState.projects : [];
  const requestedProjectId = String(preferredProjectId || getRuntimeProjectIdHint() || "").trim();
  const requestedProject = requestedProjectId ? projects.find((project) => String(project?.id || "").trim() === requestedProjectId) : null;
  const fallbackHtmlProject = projects.find((project) => String(project?.template_type_id || "").trim().toLowerCase() === "html") || null;
  const targetProject = requestedProject || fallbackHtmlProject;

  if (!targetProject?.id) {
    throw new Error("No html project available to load.");
  }

  const loaded = await authedFetchJson(`/api/editor/projects/load?id=${encodeURIComponent(String(targetProject.id))}`, {
    method: "GET",
  });
  clearRuntimeProjectIdHint();

  return {
    projects,
    project: loaded.project,
    slides: Array.isArray(loaded.slides) ? loaded.slides : [],
    htmlSlides: Array.isArray(loaded.htmlSlides) ? loaded.htmlSlides : [],
    htmlPresetId: typeof loaded.htmlPresetId === "string" ? loaded.htmlPresetId : null,
    htmlStyleGuide: loaded.htmlStyleGuide ?? null,
    htmlGenerationStatus: String(loaded.htmlGenerationStatus || "idle") as HtmlProjectShellData["htmlGenerationStatus"],
    htmlGenerationId: typeof loaded.htmlGenerationId === "string" ? loaded.htmlGenerationId : null,
  };
}

export async function createProject(templateTypeId: "regular" | "enhanced" | "html") {
  const data = await authedFetchJson("/api/editor/projects/create", {
    method: "POST",
    body: JSON.stringify({ templateTypeId, title: "Untitled Project" }),
  });
  return { project: data?.project, slides: Array.isArray(data?.slides) ? data.slides : [] };
}

export async function archiveProject(projectId: string) {
  return authedFetchJson("/api/editor/projects/archive", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
}

export async function generateHtmlCopy(projectId: string): Promise<{ jobId: string; htmlCopyDraft: HtmlCopyDraft }> {
  const data = await authedFetchJson("/api/editor/projects/jobs/generate-copy", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
  return {
    jobId: String(data?.jobId || ""),
    htmlCopyDraft: (data?.htmlCopyDraft ?? { projectTitle: "", slides: [] }) as HtmlCopyDraft,
  };
}

export async function fetchProjectJobStatus(projectId: string) {
  return authedFetchJson(`/api/editor/projects/jobs/status?projectId=${encodeURIComponent(String(projectId || ""))}`, {
    method: "GET",
  });
}

export async function saveHtmlSlides(args: {
  projectId: string;
  slides: Array<{ slideIndex: number; html: string; pageTitle?: string | null; pageType?: string | null }>;
}) {
  return authedFetchJson("/api/editor/html-projects/save-slides", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function listHtmlPresets(): Promise<HtmlDesignPreset[]> {
  const data = await authedFetchJson("/api/editor/html-projects/presets", {
    method: "GET",
  });
  return Array.isArray(data?.presets) ? (data.presets as HtmlDesignPreset[]) : [];
}

export async function streamGenerateHtmlSlides(args: {
  projectId: string;
  presetId: string;
  content: string;
  aspectRatio?: HtmlAspectRatio;
  outputLanguage?: string;
  onStatus?: (payload: { phase: string }) => void;
  onPage?: (payload: HtmlGenerationPage) => void;
  onComplete?: (payload: {
    htmlGenerationId: string;
    totalPages: number;
    preset: { id: string; name: string; aspectRatio: HtmlDesignPreset["aspectRatio"] };
  }) => void;
}) {
  const headers = await getAuthedRequestHeaders({ Accept: "text/event-stream" });
  const response = await fetch("/api/editor/html-projects/generate-slides", {
    method: "POST",
    headers,
    body: JSON.stringify({
      projectId: args.projectId,
      presetId: args.presetId,
      content: args.content,
      mode: "follow",
      outputLanguage: args.outputLanguage || "auto",
      enableImageSearch: false,
      slideCount: 6,
      aspectRatio: args.aspectRatio || "3:4",
      stream: true,
    }),
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    throw new Error(String(data?.error || `Generate slides failed (${response.status})`));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const event = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim() || "message";
      const dataLine = lines.find((line) => line.startsWith("data:"))?.slice("data:".length).trim() || "{}";
      const payload = JSON.parse(dataLine);
      if (event === "status") {
        args.onStatus?.(payload);
      } else if (event === "page") {
        args.onPage?.(payload as HtmlGenerationPage);
      } else if (event === "complete") {
        args.onComplete?.(payload);
      } else if (event === "error") {
        throw new Error(String(payload?.message || "HTML generation failed"));
      }
    }
  }
}

export async function streamRefineHtmlPage(args: {
  projectId: string;
  pageIndex: number;
  html: string;
  prompt: string;
  aspectRatio?: HtmlAspectRatio;
  manualEdits?: string;
  htmlGenerationId?: string | null;
  onStatus?: (payload: { phase: string }) => void;
  onPage?: (payload: HtmlRefinementPage) => void;
  onComplete?: () => void;
}) {
  const headers = await getAuthedRequestHeaders({ Accept: "text/event-stream" });
  const response = await fetch("/api/editor/html-projects/refine-page", {
    method: "POST",
    headers,
    body: JSON.stringify({
      projectId: args.projectId,
      pageIndex: args.pageIndex,
      html: args.html,
      prompt: args.prompt,
      aspectRatio: args.aspectRatio || "3:4",
      manualEdits: args.manualEdits || "",
      htmlGenerationId: args.htmlGenerationId || null,
    }),
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    throw new Error(String(data?.error || `Refine page failed (${response.status})`));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const event = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim() || "message";
      const dataLine = lines.find((line) => line.startsWith("data:"))?.slice("data:".length).trim() || "{}";
      const payload = JSON.parse(dataLine);
      if (event === "status") {
        args.onStatus?.(payload);
      } else if (event === "page") {
        args.onPage?.(payload as HtmlRefinementPage);
      } else if (event === "complete") {
        args.onComplete?.();
      } else if (event === "error") {
        throw new Error(String(payload?.message || "HTML refinement failed"));
      }
    }
  }
}

export async function streamRefineHtmlCarousel(args: {
  projectId: string;
  pages: Array<{
    pageIndex: number;
    html: string;
    manualEdits?: string;
  }>;
  prompt: string;
  aspectRatio?: HtmlAspectRatio;
  htmlGenerationId?: string | null;
  onStatus?: (payload: { phase: string; totalPages?: number; pageIndex?: number }) => void;
  onPage?: (payload: HtmlCarouselRefinementPage) => void;
  onPageError?: (payload: HtmlCarouselRefinementError) => void;
  onComplete?: (payload: { totalPages: number; appliedPages: number; failedPages: number }) => void;
}) {
  const headers = await getAuthedRequestHeaders({ Accept: "text/event-stream" });
  const response = await fetch("/api/editor/html-projects/refine-content-stream", {
    method: "POST",
    headers,
    body: JSON.stringify({
      projectId: args.projectId,
      pages: args.pages,
      prompt: args.prompt,
      aspectRatio: args.aspectRatio || "3:4",
      htmlGenerationId: args.htmlGenerationId || null,
    }),
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    throw new Error(String(data?.error || `Restyle all slides failed (${response.status})`));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const event = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim() || "message";
      const dataLine = lines.find((line) => line.startsWith("data:"))?.slice("data:".length).trim() || "{}";
      const payload = JSON.parse(dataLine);
      if (event === "status") {
        args.onStatus?.(payload);
      } else if (event === "page") {
        args.onPage?.(payload as HtmlCarouselRefinementPage);
      } else if (event === "complete") {
        args.onComplete?.(payload);
      } else if (event === "error") {
        if (typeof payload?.pageIndex === "number") {
          args.onPageError?.(payload as HtmlCarouselRefinementError);
        } else {
          throw new Error(String(payload?.message || "Carousel restyle failed"));
        }
      }
    }
  }
}
