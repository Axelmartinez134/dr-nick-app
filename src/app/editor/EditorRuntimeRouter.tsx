"use client";

import { useEffect, useState } from "react";
import EditorShell from "./EditorShell";
import { HtmlEditorShell } from "@/features/html-editor/components/HtmlEditorShell";
import { supabase } from "../components/auth/AuthContext";

type RuntimeKind = "fabric" | "html";
const HTML_RUNTIME_PROJECT_ID_HINT_KEY = "editor.runtimeProjectIdHint";

type ResolveState =
  | { status: "loading" }
  | { status: "ready"; runtime: RuntimeKind; initialProjectId: string | null }
  | { status: "error"; message: string };

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Editor failed to load</h1>
        <p className="text-gray-600">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    </main>
  );
}

function getRuntimeProjectIdHint(): string {
  try {
    return typeof localStorage !== "undefined" ? String(localStorage.getItem(HTML_RUNTIME_PROJECT_ID_HINT_KEY) || "").trim() : "";
  } catch {
    return "";
  }
}

function clearRuntimeProjectIdHint() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(HTML_RUNTIME_PROJECT_ID_HINT_KEY);
  } catch {
    // ignore
  }
}

function resolveRuntimeFromProjects(projects: any[]): { runtime: RuntimeKind; initialProjectId: string | null } {
  const hintProjectId = getRuntimeProjectIdHint();
  const hintedProject =
    hintProjectId && Array.isArray(projects) ? projects.find((project) => String(project?.id || "").trim() === hintProjectId) : null;
  if (hintedProject) {
    return {
      runtime: String(hintedProject?.template_type_id || "").trim().toLowerCase() === "html" ? "html" : "fabric",
      initialProjectId: String(hintedProject?.id || "").trim() || null,
    };
  }
  clearRuntimeProjectIdHint();
  const mostRecentProject = Array.isArray(projects) ? projects[0] : null;
  return {
    runtime: String(mostRecentProject?.template_type_id || "").trim().toLowerCase() === "html" ? "html" : "fabric",
    initialProjectId: null,
  };
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

function getActiveAccountId(): string {
  try {
    return typeof localStorage !== "undefined" ? String(localStorage.getItem("editor.activeAccountId") || "").trim() : "";
  } catch {
    return "";
  }
}

export function EditorRuntimeRouter() {
  const [resolveTick, setResolveTick] = useState(0);
  const [state, setState] = useState<ResolveState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function resolveRuntime() {
      setState({ status: "loading" });
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Unauthorized");
        }
        const activeAccountId = getActiveAccountId();
        const response = await fetch("/api/editor/initial-state", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...(activeAccountId ? { "x-account-id": activeAccountId } : {}),
          },
          body: JSON.stringify({ templateTypeId: "regular" }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          throw new Error(String(data?.error || "Failed to resolve editor runtime"));
        }
        if (controller.signal.aborted) return;
        const resolved = resolveRuntimeFromProjects(data?.projects || []);
        setState({ status: "ready", runtime: resolved.runtime, initialProjectId: resolved.initialProjectId });
      } catch (error: any) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: String(error?.message || "Failed to resolve editor runtime"),
        });
      }
    }

    void resolveRuntime();
    return () => controller.abort();
  }, [resolveTick]);

  if (state.status === "loading") {
    return <LoadingScreen message="Loading editor..." />;
  }

  if (state.status === "error") {
    return <ErrorScreen message={state.message} onRetry={() => setResolveTick((tick) => tick + 1)} />;
  }

  return state.runtime === "html" ? <HtmlEditorShell /> : <EditorShell initialProjectId={state.initialProjectId} />;
}
