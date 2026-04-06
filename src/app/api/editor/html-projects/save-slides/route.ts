import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase, resolveActiveAccountId } from "../../_utils";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  projectId: string;
  slides: Array<{
    slideIndex: number;
    html: string;
    pageTitle?: string | null;
    pageType?: string | null;
  }>;
};

function sanitizeHtml(input: string) {
  return String(input || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z-]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(srcdoc|srcset)\s*=\s*(['"]).*?\2/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ` $1="#"`)
    .trim();
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
  const slides = Array.isArray(body?.slides) ? body!.slides : [];
  if (!projectId) return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });
  if (!slides.length) return NextResponse.json({ success: false, error: "slides are required" }, { status: 400 });

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
    return NextResponse.json({ success: false, error: "Only html projects can save html slides" }, { status: 400 });
  }

  await Promise.all(
    slides.map((slide) =>
      supabase
        .from("html_project_slides")
        .update({
          html: sanitizeHtml(String(slide?.html || "")),
          page_title: slide?.pageTitle ? String(slide.pageTitle) : null,
          page_type: slide?.pageType ? String(slide.pageType) : null,
        })
        .eq("project_id", projectId)
        .eq("slide_index", Number(slide?.slideIndex || 0))
    )
  );

  return NextResponse.json({ success: true });
}
