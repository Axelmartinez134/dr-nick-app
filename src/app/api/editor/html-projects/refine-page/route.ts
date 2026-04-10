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
export const maxDuration = 60;

type Body = {
  projectId: string;
  pageIndex: number;
  html: string;
  prompt: string;
  aspectRatio?: HtmlAspectRatio;
  manualEdits?: string;
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
  const html = String(body?.html || "").trim();
  const aspectRatio = (body?.aspectRatio || "3:4") as HtmlAspectRatio;
  const manualEdits = String(body?.manualEdits || "").trim();
  const pageIndex = Number(body?.pageIndex);

  if (!projectId) return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });
  if (!prompt) return NextResponse.json({ success: false, error: "prompt is required" }, { status: 400 });
  if (!html) return NextResponse.json({ success: false, error: "html is required" }, { status: 400 });
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    return NextResponse.json({ success: false, error: "pageIndex must be a valid slide index" }, { status: 400 });
  }
  if (!HTML_SLIDE_DIMENSIONS[aspectRatio]) {
    return NextResponse.json({ success: false, error: "Unsupported aspectRatio" }, { status: 400 });
  }

  const wantsStream = String(request.headers.get("accept") || "").includes("text/event-stream");
  if (!wantsStream) {
    return NextResponse.json({ success: false, error: "Streaming not requested" }, { status: 400 });
  }

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
    return NextResponse.json({ success: false, error: "Only html projects can refine html slides" }, { status: 400 });
  }

  const { data: slideRow, error: slideErr } = await supabase
    .from("html_project_slides")
    .select("slide_index")
    .eq("project_id", projectId)
    .eq("slide_index", pageIndex)
    .maybeSingle();
  if (slideErr || !slideRow) {
    return NextResponse.json({ success: false, error: slideErr?.message || "Slide not found" }, { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      void (async () => {
        try {
          send("status", { phase: "refining" });
          const rawRefinedHtml = await callAnthropicRefinePage({
            html,
            prompt,
            aspectRatio,
            manualEdits,
          });
          const withOverlay = reinsertOverlayRoot({
            previousHtml: html,
            nextHtml: rawRefinedHtml,
          });
          const sanitized = sanitizeHtmlForAspectRatio({
            html: withOverlay,
            aspectRatio,
          });
          if (hasOverlayRoot(html) && !hasOverlayRoot(sanitized.normalizedHtml)) {
            throw new Error("Refined html failed overlay preservation validation");
          }
          if (!sanitized.valid || !sanitized.normalizedHtml.trim()) {
            throw new Error("Refined html failed validation");
          }

          send("page", {
            pageIndex,
            page: {
              html: sanitized.normalizedHtml,
            },
          });
          send("complete", {});
          controller.close();
        } catch (error: any) {
          send("error", {
            message: String(error?.message || "Refinement failed"),
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
