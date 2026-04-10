import "server-only";

import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase, resolveActiveAccountId } from "../../_utils";
import {
  renderHtmlPagesToImages,
  sanitizeFileName,
} from "@/features/html-editor/server/renderHtmlPages";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  projectId: string;
  format?: "zip";
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

  const projectId = String(body?.projectId || "").trim();
  if (!projectId) return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });

  const { data: project, error: projectErr } = await supabase
    .from("carousel_projects")
    .select("id, title, template_type_id")
    .eq("id", projectId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || "Project not found" }, { status: 404 });
  }
  if (String((project as any)?.template_type_id || "") !== "html") {
    return NextResponse.json({ success: false, error: "Only html projects can export html slides" }, { status: 400 });
  }

  const { data: slides, error: slidesErr } = await supabase
    .from("html_project_slides")
    .select("slide_index, html")
    .eq("project_id", projectId)
    .order("slide_index", { ascending: true });
  if (slidesErr) return NextResponse.json({ success: false, error: slidesErr.message }, { status: 500 });

  if (!(slides || []).length) {
    return NextResponse.json({ success: false, error: "No HTML slides found to export." }, { status: 400 });
  }

  try {
    const zip = new JSZip();
    const folder = zip.folder(sanitizeFileName(String((project as any)?.title || "html-carousel"))) || zip;
    const rendered = await renderHtmlPagesToImages({
      pages: (slides || []).map((slide: any, index: number) => ({
        pageNumber: Number(slide?.slide_index || index) + 1,
        html: String(slide?.html || ""),
      })),
      aspectRatio: "3:4",
      imageType: "png",
    });
    rendered.pages.forEach((page) => {
      folder.file(`slide-${page.pageNumber}.png`, page.buffer);
    });

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${sanitizeFileName(String((project as any)?.title || "html-carousel"))}.zip"`,
      },
    });
  } catch (error: any) {
    console.error("[html-export] render failed", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error?.message || "Failed to render HTML slides for export"),
      },
      { status: 500 }
    );
  }
}
