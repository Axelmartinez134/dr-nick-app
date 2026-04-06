"use client";

import { useCallback, useMemo, useState } from "react";
import { streamGenerateHtmlSlides, type HtmlGenerationPage } from "../services/htmlProjectsApi";

type GenerationState = "idle" | "running" | "success" | "error";

export function useHtmlSlideGeneration(params: {
  projectId: string | null;
  onPage: (payload: HtmlGenerationPage) => void;
  onComplete: (payload: { htmlGenerationId: string }) => Promise<void> | void;
}) {
  const [state, setState] = useState<GenerationState>("idle");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runGenerateSlides = useCallback(
    async (args: { presetId: string; content: string }) => {
      const projectId = String(params.projectId || "").trim();
      if (!projectId) return;
      setState("running");
      setLabel("Resolving preset...");
      setError(null);
      try {
        await streamGenerateHtmlSlides({
          projectId,
          presetId: args.presetId,
          content: args.content,
          onStatus: (payload) => {
            const phase = String(payload?.phase || "");
            if (phase === "resolving_preset") setLabel("Resolving preset...");
            else if (phase === "generating") setLabel("Generating slides...");
          },
          onPage: (payload) => {
            setLabel(`Generated slide ${Number(payload?.pageIndex || 0) + 1}...`);
            params.onPage(payload);
          },
          onComplete: async (payload) => {
            setLabel("Generation complete");
            await params.onComplete({ htmlGenerationId: String(payload?.htmlGenerationId || "") });
          },
        });
        setState("success");
      } catch (err: any) {
        setState("error");
        setLabel("Generation failed");
        setError(String(err?.message || "Generate slides failed"));
      }
    },
    [params]
  );

  const generation = useMemo(
    () => ({
      state,
      label,
      error,
      generating: state === "running",
    }),
    [error, label, state]
  );

  return {
    runGenerateSlides,
    generation,
  };
}
