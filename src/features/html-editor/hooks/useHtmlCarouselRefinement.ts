"use client";

import { useCallback, useMemo, useState } from "react";
import {
  streamRefineHtmlCarousel,
  type HtmlCarouselRefinementError,
  type HtmlCarouselRefinementPage,
} from "../services/htmlProjectsApi";
import type { HtmlAspectRatio } from "../lib/htmlDocumentWrapper";

type CarouselRefinementState = "idle" | "running" | "success" | "error";

export function useHtmlCarouselRefinement(params: {
  projectId: string | null;
  onStatus?: (payload: { phase: string; totalPages?: number; pageIndex?: number }) => void;
  onPage: (payload: HtmlCarouselRefinementPage) => void;
  onPageError?: (payload: HtmlCarouselRefinementError) => void;
  onComplete?: (payload: { totalPages: number; appliedPages: number; failedPages: number }) => Promise<void> | void;
}) {
  const [state, setState] = useState<CarouselRefinementState>("idle");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runRefineCarousel = useCallback(
    async (args: {
      pages: Array<{
        pageIndex: number;
        html: string;
        manualEdits?: string;
      }>;
      prompt: string;
      aspectRatio?: HtmlAspectRatio;
      htmlGenerationId?: string | null;
    }) => {
      const projectId = String(params.projectId || "").trim();
      if (!projectId) return;
      setState("running");
      setLabel("Preparing carousel restyle...");
      setError(null);

      try {
        await streamRefineHtmlCarousel({
          projectId,
          pages: args.pages,
          prompt: args.prompt,
          aspectRatio: args.aspectRatio || "3:4",
          htmlGenerationId: args.htmlGenerationId || null,
          onStatus: (payload) => {
            if (payload.phase === "refining-carousel") {
              setLabel(`Restyling ${Number(payload.totalPages || args.pages.length)} slides...`);
            } else if (payload.phase === "refining-page") {
              setLabel(`Refining slide ${Number(payload.pageIndex || 0) + 1}...`);
            }
            params.onStatus?.(payload);
          },
          onPage: (payload) => {
            setLabel(`Applied slide ${Number(payload.pageIndex || 0) + 1}`);
            params.onPage(payload);
          },
          onPageError: (payload) => {
            setLabel(`Slide ${typeof payload.pageIndex === "number" ? payload.pageIndex + 1 : "?"} failed`);
            params.onPageError?.(payload);
          },
          onComplete: async (payload) => {
            setLabel("Carousel restyle complete");
            await params.onComplete?.(payload);
          },
        });
        setState("success");
      } catch (err: any) {
        setState("error");
        setLabel("Carousel restyle failed");
        setError(String(err?.message || "Restyle all slides failed"));
      }
    },
    [params]
  );

  const carouselRefinement = useMemo(
    () => ({
      state,
      label,
      error,
      running: state === "running",
    }),
    [error, label, state]
  );

  return {
    runRefineCarousel,
    carouselRefinement,
  };
}
