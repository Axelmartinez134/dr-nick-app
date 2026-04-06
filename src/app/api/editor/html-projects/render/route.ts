import "server-only";

import JSZip from "jszip";
import { chromium } from "playwright";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase, resolveActiveAccountId } from "../../_utils";
import { wrapHtmlDocument } from "@/features/html-editor/lib/htmlDocumentWrapper";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  projectId: string;
  format?: "zip";
};

function stripEditorAttrs(input: string) {
  return String(input || "")
    .replace(/\sdata-editable-id=(['"]).*?\1/gi, "")
    .replace(/\sdata-selected-editable=(['"]).*?\1/gi, "")
    .replace(/\sdata-editor-[a-z-]+=(['"]).*?\1/gi, "")
    .trim();
}

function sanitizeFileName(input: string) {
  const base = String(input || "html-carousel")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "html-carousel";
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

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1440 } });
    const zip = new JSZip();
    const folder = zip.folder(sanitizeFileName(String((project as any)?.title || "html-carousel"))) || zip;

    for (let i = 0; i < (slides || []).length; i += 1) {
      const slide = slides?.[i];
      const html = stripEditorAttrs(String((slide as any)?.html || ""));
      const doc = wrapHtmlDocument({ html, aspectRatio: "3:4", interactive: false });
      await page.setContent(doc, { waitUntil: "load" });
      const imageBuffer = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: 1080, height: 1440 },
      });
      folder.file(`slide-${Number((slide as any)?.slide_index || i) + 1}.png`, imageBuffer);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${sanitizeFileName(String((project as any)?.title || "html-carousel"))}.zip"`,
      },
    });
  } finally {
    await browser.close();
  }
}
