"use client";

import { useMemo } from "react";
import { HTML_SLIDE_DIMENSIONS, wrapHtmlDocument, type HtmlAspectRatio } from "../lib/htmlDocumentWrapper";

export function useHtmlSlideRenderer(args: {
  html: string;
  aspectRatio?: HtmlAspectRatio;
  interactive?: boolean;
  slideIndex?: number;
}) {
  const aspectRatio = args.aspectRatio || "3:4";
  const dimensions = HTML_SLIDE_DIMENSIONS[aspectRatio];

  const srcDoc = useMemo(
    () =>
      wrapHtmlDocument({
        html: args.html,
        aspectRatio,
        interactive: args.interactive,
        slideIndex: args.slideIndex,
      }),
    [args.html, aspectRatio, args.interactive, args.slideIndex]
  );
  const paddingBottom = `${(dimensions.height / dimensions.width) * 100}%`;

  return {
    srcDoc,
    dimensions,
    paddingBottom,
  };
}
