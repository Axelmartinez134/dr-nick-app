"use client";

import { useCallback, useMemo, useState } from "react";
import { streamRefineHtmlPage, type HtmlRefinementPage } from "../services/htmlProjectsApi";
import type { HtmlAspectRatio } from "../lib/htmlDocumentWrapper";

type RefinementState = "idle" | "running" | "success" | "error";

export function useHtmlPageRefinement(params: {
  projectId: string | null;
  onPage: (payload: HtmlRefinementPage) => void;
  onComplete?: () => Promise<void> | void;
}) {
  const [state, setState] = useState<RefinementState>("idle");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runRefinePage = useCallback(
    async (args: {
      pageIndex: number;
      html: string;
      prompt: string;
      aspectRatio?: HtmlAspectRatio;
      manualEdits?: string;
      htmlGenerationId?: string | null;
    }) => {
      const projectId = String(params.projectId || "").trim();
      if (!projectId) return;
      setState("running");
      setLabel("Refining page...");
      setError(null);

      try {
        await streamRefineHtmlPage({
          projectId,
          pageIndex: args.pageIndex,
          html: args.html,
          prompt: args.prompt,
          aspectRatio: args.aspectRatio || "3:4",
          manualEdits: args.manualEdits || "",
          htmlGenerationId: args.htmlGenerationId || null,
          onStatus: (payload) => {
            const phase = String(payload?.phase || "");
            if (phase === "refining") setLabel("Refining page...");
          },
          onPage: (payload) => {
            setLabel("Refinement applied");
            params.onPage(payload);
          },
          onComplete: async () => {
            setLabel("Refinement complete");
            await params.onComplete?.();
          },
        });
        setState("success");
      } catch (err: any) {
        setState("error");
        setLabel("Refinement failed");
        setError(String(err?.message || "Refine page failed"));
      }
    },
    [params]
  );

  const refinement = useMemo(
    () => ({
      state,
      label,
      error,
      refining: state === "running",
    }),
    [error, label, state]
  );

  return {
    runRefinePage,
    refinement,
  };
}
