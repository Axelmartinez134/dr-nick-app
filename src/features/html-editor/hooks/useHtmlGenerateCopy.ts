"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { fetchProjectJobStatus, generateHtmlCopy, type HtmlCopyDraft } from "../services/htmlProjectsApi";

type CopyUiState = "idle" | "running" | "success" | "error";

export function useHtmlGenerateCopy(params: {
  projectId: string | null;
  onCompleted: (draft: HtmlCopyDraft) => Promise<void> | void;
}) {
  const { projectId, onCompleted } = params;
  const [state, setState] = useState<CopyUiState>("idle");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);
  const pollRef = useRef<number | null>(null);
  const resetRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (resetRef.current) window.clearTimeout(resetRef.current);
    pollRef.current = null;
    resetRef.current = null;
  }, []);

  const stepLabelFor = useCallback((progressCode: string) => {
    const code = String(progressCode || "").toLowerCase();
    if (code.includes("poppy")) return "Poppy is cooking...";
    if (code.includes("claude")) return "Claude is cooking...";
    if (code.includes("parse")) return "Structuring html copy...";
    if (code.includes("save")) return "Saving html copy...";
    return "Working...";
  }, []);

  const runGenerateCopy = useCallback(async () => {
    const pid = String(projectId || "").trim();
    if (!pid) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    clearTimers();
    setState("running");
    setLabel("Starting...");
    setError(null);

    const pollOnce = async () => {
      try {
        if (runIdRef.current !== runId) return;
        const data = await fetchProjectJobStatus(pid);
        const job = data?.activeJob || null;
        if (!job) return;
        const status = String(job?.status || "");
        const jobError = String(job?.error || "");
        if ((status === "pending" || status === "running") && jobError.startsWith("progress:")) {
          setLabel(stepLabelFor(jobError.slice("progress:".length)));
        } else if (status === "pending") {
          setLabel("Queued...");
        } else if (status === "running") {
          setLabel("Working...");
        } else if (status === "completed") {
          setLabel("Done");
        }
      } catch {
        // Ignore polling errors while the main request is in flight.
      }
    };

    void pollOnce();
    pollRef.current = window.setInterval(() => {
      void pollOnce();
    }, 500);

    try {
      const result = await generateHtmlCopy(pid);
      if (runIdRef.current !== runId) return;
      await onCompleted(result.htmlCopyDraft);
      setState("success");
      setLabel("Done");
    } catch (err: any) {
      if (runIdRef.current !== runId) return;
      setState("error");
      setLabel("Error");
      setError(String(err?.message || "Generate Copy failed"));
    } finally {
      if (runIdRef.current !== runId) return;
      clearTimers();
      resetRef.current = window.setTimeout(() => {
        if (runIdRef.current !== runId) return;
        setState("idle");
        setLabel("");
      }, 1400);
    }
  }, [clearTimers, onCompleted, projectId, stepLabelFor]);

  const copyGenerating = state === "running";
  const copyProgress = useMemo(
    () => ({ state, label, error, copyGenerating }),
    [copyGenerating, error, label, state]
  );

  return {
    runGenerateCopy,
    copyProgress,
  };
}
