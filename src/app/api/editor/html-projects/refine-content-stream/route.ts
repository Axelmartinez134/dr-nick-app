import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase, resolveActiveAccountId } from "../../_utils";
import {
  callAnthropicRefinePage,
  hasOverlayRoot,
  reinsertOverlayRoot,
  sanitizeHtmlForAspectRatio,
  sanitizeText,
} from "../_shared";
import { HTML_SLIDE_DIMENSIONS, type HtmlAspectRatio } from "@/features/html-editor/lib/htmlDocumentWrapper";

export const runtime = "nodejs";
export const maxDuration = 180;

type Body = {
  projectId: string;
  pages: Array<{
    pageIndex: number;
    html: string;
    manualEdits?: string;
  }>;
  prompt: string;
  aspectRatio?: HtmlAspectRatio;
  htmlGenerationId?: string | null;
};

export async function POST(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });
  const accountId = acct.accountId;

  let body: Body | null = null;
  try {
    body = (await request.json()) as Body;
  } catch {
    body = null;
  }

  const projectId = sanitizeText(String(body?.projectId || ""));
  const prompt = sanitizeText(String(body?.prompt || ""));
  const pages = Array.isArray(body?.pages) ? body.pages : [];
  const aspectRatio = (body?.aspectRatio || "3:4") as HtmlAspectRatio;

  if (!projectId) return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });
  if (!prompt) return NextResponse.json({ success: false, error: "prompt is required" }, { status: 400 });
  if (!pages.length) return NextResponse.json({ success: false, error: "pages are required" }, { status: 400 });
  if (!HTML_SLIDE_DIMENSIONS[aspectRatio]) {
    return NextResponse.json({ success: false, error: "Unsupported aspectRatio" }, { status: 400 });
  }

  const wantsStream = String(request.headers.get("accept") || "").includes("text/event-stream");
  if (!wantsStream) {
    return NextResponse.json({ success: false, error: "Streaming not requested" }, { status: 400 });
  }

  const seen = new Set<number>();
  const normalizedPages = pages.map((page) => ({
    pageIndex: Number(page?.pageIndex),
    html: String(page?.html || "").trim(),
    manualEdits: String(page?.manualEdits || "").trim(),
  }));
  for (const page of normalizedPages) {
    if (!Number.isInteger(page.pageIndex) || page.pageIndex < 0) {
      return NextResponse.json({ success: false, error: "All pageIndex values must be valid slide indices" }, { status: 400 });
    }
    if (!page.html) {
      return NextResponse.json({ success: false, error: `Slide ${page.pageIndex + 1} is missing html` }, { status: 400 });
    }
    if (seen.has(page.pageIndex)) {
      return NextResponse.json({ success: false, error: `Duplicate pageIndex ${page.pageIndex}` }, { status: 400 });
    }
    seen.add(page.pageIndex);
  }
  normalizedPages.sort((a, b) => a.pageIndex - b.pageIndex);

  const { data: project, error: projectErr } = await supabase
    .from("carousel_projects")
    .select("id, template_type_id")
    .eq("id", projectId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || "Project not found" }, { status: 404 });
  }
  if (String((project as any)?.template_type_id || "") !== "html") {
    return NextResponse.json({ success: false, error: "Only html projects can restyle html slides" }, { status: 400 });
  }

  const { data: slideRows, error: slidesErr } = await supabase
    .from("html_project_slides")
    .select("slide_index")
    .eq("project_id", projectId);
  if (slidesErr) {
    return NextResponse.json({ success: false, error: slidesErr.message }, { status: 500 });
  }
  const existingIndices = new Set((slideRows || []).map((row: any) => Number(row?.slide_index)));
  const missingPage = normalizedPages.find((page) => !existingIndices.has(page.pageIndex));
  if (missingPage) {
    return NextResponse.json({ success: false, error: `Slide ${missingPage.pageIndex + 1} does not exist` }, { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      void (async () => {
        let appliedPages = 0;
        let failedPages = 0;
        try {
          send("status", { phase: "refining-carousel", totalPages: normalizedPages.length });
          for (const page of normalizedPages) {
            send("status", {
              phase: "refining-page",
              pageIndex: page.pageIndex,
              totalPages: normalizedPages.length,
            });
            try {
              const rawRefinedHtml = await callAnthropicRefinePage({
                html: page.html,
                prompt,
                aspectRatio,
                manualEdits: page.manualEdits,
              });
              const withOverlay = reinsertOverlayRoot({
                previousHtml: page.html,
                nextHtml: rawRefinedHtml,
              });
              const sanitized = sanitizeHtmlForAspectRatio({
                html: withOverlay,
                aspectRatio,
              });
              if (hasOverlayRoot(page.html) && !hasOverlayRoot(sanitized.normalizedHtml)) {
                throw new Error("Refined html failed overlay preservation validation");
              }
              if (!sanitized.valid || !sanitized.normalizedHtml.trim()) {
                throw new Error("Refined html failed validation");
              }
              appliedPages += 1;
              send("page", {
                pageIndex: page.pageIndex,
                page: {
                  html: sanitized.normalizedHtml,
                },
              });
            } catch (error: any) {
              failedPages += 1;
              send("error", {
                pageIndex: page.pageIndex,
                message: String(error?.message || "Carousel restyle failed"),
              });
            }
          }
          send("complete", {
            totalPages: normalizedPages.length,
            appliedPages,
            failedPages,
          });
          controller.close();
        } catch (error: any) {
          send("error", {
            message: String(error?.message || "Carousel restyle failed"),
          });
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
