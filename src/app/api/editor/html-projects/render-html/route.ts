import "server-only";

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase, resolveActiveAccountId } from "../../_utils";
import {
  assertHtmlRenderBucketExists,
  createHtmlRenderServiceClient,
  HTML_RENDER_STORAGE_BUCKET,
  renderHtmlPagesToImages,
  uploadRenderedPagesToStorage,
  type HtmlRenderPageInput,
} from "@/features/html-editor/server/renderHtmlPages";
import type { HtmlAspectRatio } from "@/features/html-editor/lib/htmlDocumentWrapper";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  html?: string;
  pages?: Array<{ pageNumber?: number; html?: string }>;
  aspectRatio?: HtmlAspectRatio;
  format?: "storage";
};

function normalizePages(body: Body | null): HtmlRenderPageInput[] {
  const pages = Array.isArray(body?.pages) ? body!.pages : [];
  if (pages.length) {
    return pages
      .map((page, index) => ({
        pageNumber: Math.max(1, Number(page?.pageNumber || index + 1)),
        html: String(page?.html || ""),
      }))
      .filter((page) => page.html.trim());
  }

  const html = String(body?.html || "").trim();
  return html ? [{ pageNumber: 1, html }] : [];
}

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

  const format = body?.format || "storage";
  if (format !== "storage") {
    return NextResponse.json({ success: false, error: 'Only format "storage" is currently supported' }, { status: 400 });
  }

  const aspectRatio = (body?.aspectRatio || "4:5") as HtmlAspectRatio;
  const pages = normalizePages(body);
  if (!pages.length) {
    return NextResponse.json({ success: false, error: "html or pages[] is required" }, { status: 400 });
  }

  const svc = createHtmlRenderServiceClient();
  if (!svc) {
    return NextResponse.json(
      { success: false, error: "Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const bucketErr = await assertHtmlRenderBucketExists(svc, HTML_RENDER_STORAGE_BUCKET);
  if (bucketErr) {
    return NextResponse.json({ success: false, error: bucketErr }, { status: 400 });
  }

  try {
    const rendered = await renderHtmlPagesToImages({
      pages,
      aspectRatio,
      imageType: "jpeg",
      jpegQuality: 90,
    });
    const renderRunId = randomUUID();
    const baseDir = `accounts/${accountId}/users/${user.id}/html-renders/${renderRunId}`;
    const images = await uploadRenderedPagesToStorage({
      svc,
      bucket: HTML_RENDER_STORAGE_BUCKET,
      baseDir,
      renderedPages: rendered.pages,
      upsert: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        images: images.map((image) => ({ pageNumber: image.pageNumber, url: image.url })),
        pageCount: images.length,
        aspectRatio,
      },
    });
  } catch (error: any) {
    console.error("[html-render-html] render failed", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error?.message || "Failed to render HTML pages"),
      },
      { status: 500 }
    );
  }
}
