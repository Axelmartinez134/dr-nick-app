import "server-only";

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase, resolveActiveAccountId } from "../../_utils";
import { extractJsonObject, sanitizeHtmlForAspectRatio, sanitizeText } from "../_shared";
import { getHtmlPresetById, type HtmlDesignPreset } from "@/features/html-editor/lib/presets";
import { HTML_SLIDE_DIMENSIONS, type HtmlAspectRatio } from "@/features/html-editor/lib/htmlDocumentWrapper";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  projectId: string;
  presetId: string;
  content?: string;
  mode?: "follow";
  outputLanguage?: string;
  enableImageSearch?: boolean;
  slideCount?: number;
  aspectRatio?: HtmlAspectRatio;
};

type StructuredContent = {
  projectTitle: string;
  slides: Array<{ slideNumber: number; textLines: string[] }>;
};

type GeneratedPage = {
  pageNumber: number;
  title: string;
  html: string;
  needsImage: boolean;
};

function escapeHtml(text: string) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildStructuredContentFromSlides(projectTitle: string, slides: any[]): StructuredContent {
  return {
    projectTitle: sanitizeText(projectTitle || "Untitled HTML Carousel"),
    slides: Array.from({ length: 6 }).map((_, index) => {
      const row = slides[index] || {};
      const first = sanitizeText(String(row?.headline || ""));
      const rest = String(row?.body || "")
        .split(/\r?\n/)
        .map((line) => sanitizeText(line))
        .filter(Boolean);
      const textLines = [first, ...rest].filter(Boolean);
      return {
        slideNumber: index + 1,
        textLines: textLines.length ? textLines : [`Slide ${index + 1}`],
      };
    }),
  };
}

function parseStructuredContent(content: string): StructuredContent {
  const raw = String(content || "").trim();
  const titleMatch = raw.match(/PROJECT_TITLE:\s*([\s\S]*?)\n\s*CAROUSEL_TEXTLINES:/i);
  const projectTitle = sanitizeText(titleMatch?.[1] || "");
  if (!projectTitle) {
    throw new Error("Structured content is missing PROJECT_TITLE");
  }

  const slides: StructuredContent["slides"] = [];
  const pattern = /SLIDE\s+(\d+)\s+\(textLines\):\s*([\s\S]*?)(?=\n\s*SLIDE\s+\d+\s+\(textLines\):|$)/gi;
  let match: RegExpExecArray | null = null;
  while ((match = pattern.exec(raw))) {
    const slideNumber = Number(match[1] || 0);
    const textLines = String(match[2] || "")
      .split(/\r?\n/)
      .map((line) => sanitizeText(line))
      .filter(Boolean);
    slides.push({
      slideNumber,
      textLines: textLines.length ? textLines : [`Slide ${slideNumber}`],
    });
  }
  if (slides.length !== 6) {
    throw new Error("Structured content must include exactly 6 slide sections");
  }
  return { projectTitle, slides };
}

function deriveRole(index: number, total: number) {
  if (index === 0) return "cover";
  if (index === total - 1) return "cta";
  return "content";
}

function buildGenerationPrompt(args: {
  preset: HtmlDesignPreset;
  content: string;
  aspectRatio: HtmlAspectRatio;
  slideCount: number;
  outputLanguage: string;
}) {
  const { width, height } = HTML_SLIDE_DIMENSIONS[args.aspectRatio];
  const presetTemplates = args.preset.templates
    .map(
      (template, index) =>
        `Template ${index + 1} (${template.pageType || "content"} - ${template.name}):\n${template.html}`
    )
    .join("\n\n");

  return [
    "You generate complete Instagram carousel slide HTML.",
    "Return ONLY valid JSON in this exact shape:",
    `{"pages":[{"pageNumber":1,"title":"...","html":"<div style=\\"width:${width}px;height:${height}px;overflow:hidden;...\\">...</div>"}]}`,
    "Rules:",
    `- Return exactly ${args.slideCount} pages in order.`,
    `- Each page root must be exactly ${width}px by ${height}px with overflow:hidden.`,
    "- Inline styles only for layout-critical styling.",
    "- No JavaScript, no script tags, no event handlers, no animations.",
    "- If imagery is useful, include .image-slot elements with data-slot-id, data-slot-type, data-slot-label, and preferably data-search-query.",
    "- Keep text in parseable semantic elements.",
    `- Use output language: ${args.outputLanguage}.`,
    "",
    "STYLE GUIDE:",
    JSON.stringify(args.preset.styleGuide, null, 2),
    "",
    "REFERENCE TEMPLATES:",
    presetTemplates,
    "",
    "CONTENT:",
    args.content,
  ].join("\n");
}

async function callAnthropicPages(args: {
  preset: HtmlDesignPreset;
  content: string;
  aspectRatio: HtmlAspectRatio;
  slideCount: number;
  outputLanguage: string;
}): Promise<GeneratedPage[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing env var: ANTHROPIC_API_KEY");
  const prompt = buildGenerationPrompt(args);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 8192,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json)?.slice(0, 400) || "Unknown Anthropic error";
    throw new Error(msg);
  }
  const text = String(json?.content?.[0]?.text || "");
  const payload = extractJsonObject(text);
  const pages = Array.isArray(payload?.pages) ? payload.pages : [];
  if (pages.length !== args.slideCount) {
    throw new Error("Generated html payload did not return 6 pages");
  }
  return pages.map((page: any, index: number) => ({
    pageNumber: Number(page?.pageNumber || index + 1),
    title: sanitizeText(String(page?.title || `Slide ${index + 1}`)),
    html: String(page?.html || ""),
    needsImage: String(page?.html || "").includes("image-slot"),
  }));
}

function fallbackSlotStyles(args: { preset: HtmlDesignPreset }) {
  return `background:linear-gradient(135deg, ${args.preset.styleGuide.accentColor}, ${args.preset.styleGuide.primaryColor});background-size:cover;background-position:center;`;
}

function ensureImageSlotPrefill(html: string, preset: HtmlDesignPreset) {
  return String(html || "").replace(/(<[^>]*class=["'][^"']*image-slot[^"']*["'][^>]*style=["'])([^"']*)(["'][^>]*>)/gi, (full, before, style, after) => {
    const styleText = String(style || "");
    if (/background(?:-image)?\s*:/i.test(styleText)) return full;
    return `${before}${styleText}${styleText.trim().endsWith(";") || !styleText.trim() ? "" : ";"}${fallbackSlotStyles({ preset })}${after}`;
  });
}

function buildDeterministicPage(args: {
  preset: HtmlDesignPreset;
  slide: { slideNumber: number; textLines: string[] };
  aspectRatio: HtmlAspectRatio;
  role: "cover" | "content" | "cta";
}) {
  const { width, height } = HTML_SLIDE_DIMENSIONS[args.aspectRatio];
  const lines = args.slide.textLines.map((line) => escapeHtml(line));
  const title = lines[0] || `Slide ${args.slide.slideNumber}`;
  const supporting = lines.slice(1);
  const chip = escapeHtml(args.preset.category.toUpperCase());
  const includeImageSlot = args.role !== "cta" || args.slide.slideNumber % 2 === 0;
  const html = `
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(args.preset.styleGuide.headingFontFamily).replace(/%20/g, "+")}:wght@400;500;600;700;800&family=${encodeURIComponent(args.preset.styleGuide.bodyFontFamily).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap">
<div style="width:${width}px;height:${height}px;overflow:hidden;position:relative;background:${args.preset.styleGuide.backgroundColor};color:${args.preset.styleGuide.primaryColor};font-family:'${escapeHtml(args.preset.styleGuide.bodyFontFamily)}',sans-serif;padding:76px;display:flex;flex-direction:column;gap:26px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">
    <div style="display:inline-flex;align-items:center;gap:12px;border-radius:999px;padding:12px 18px;background:rgba(255,255,255,0.72);font-size:22px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${args.preset.styleGuide.accentColor};">${chip}</div>
    <div style="width:140px;height:140px;border-radius:32px;background:linear-gradient(135deg,${args.preset.styleGuide.accentColor},${args.preset.styleGuide.secondaryColor});opacity:0.95;"></div>
  </div>
  <div style="font-family:'${escapeHtml(args.preset.styleGuide.headingFontFamily)}',sans-serif;font-size:${args.role === "cover" ? 102 : 74}px;line-height:${args.role === "cover" ? 0.94 : 1};font-weight:800;letter-spacing:-0.04em;max-width:820px;">${title}</div>
  <div style="display:grid;grid-template-columns:${includeImageSlot ? "1.05fr 0.95fr" : "1fr"};gap:26px;flex:1;align-items:stretch;">
    <div style="display:flex;flex-direction:column;gap:18px;">
      ${supporting
        .map(
          (line, index) =>
            `<div style="border-radius:28px;background:rgba(255,255,255,0.78);padding:22px 24px;box-shadow:0 12px 34px rgba(15,23,42,0.08);font-size:${args.role === "cover" ? 28 : 30}px;line-height:1.45;color:${index === 0 ? args.preset.styleGuide.primaryColor : "#475569"};">${line}</div>`
        )
        .join("") || `<div style="border-radius:28px;background:rgba(255,255,255,0.78);padding:22px 24px;box-shadow:0 12px 34px rgba(15,23,42,0.08);font-size:30px;line-height:1.45;color:#475569;">${escapeHtml(args.preset.description)}</div>`}
    </div>
    ${
      includeImageSlot
        ? `<div class="image-slot" data-slot-id="slot-${args.slide.slideNumber}" data-slot-type="${args.role === "cover" ? "main" : args.role === "cta" ? "logo" : "background"}" data-slot-label="${args.role === "cta" ? "Brand mark" : "Visual"}" data-search-query="${escapeHtml(args.preset.category)} visual editorial" style="border-radius:36px;${fallbackSlotStyles({ preset: args.preset })}"></div>`
        : ""
    }
  </div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;">
    ${args.preset.styleGuide.designPatterns
      .slice(0, 3)
      .map(
        (pattern) =>
          `<div style="border-radius:999px;padding:10px 14px;background:${args.preset.styleGuide.primaryColor};color:${args.preset.styleGuide.secondaryColor};font-size:18px;font-weight:700;">${escapeHtml(pattern)}</div>`
      )
      .join("")}
  </div>
</div>`;
  return {
    pageNumber: args.slide.slideNumber,
    title: sanitizeText(String(args.slide.textLines[0] || `Slide ${args.slide.slideNumber}`)).slice(0, 80),
    html,
    needsImage: includeImageSlot,
  };
}

function sanitizeGeneratedHtml(args: { html: string; aspectRatio: HtmlAspectRatio; preset: HtmlDesignPreset }) {
  return sanitizeHtmlForAspectRatio({
    html: ensureImageSlotPrefill(args.html, args.preset),
    aspectRatio: args.aspectRatio,
  });
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
  const projectId = sanitizeText(String(body?.projectId || ""));
  const presetId = sanitizeText(String(body?.presetId || ""));
  const slideCount = Number(body?.slideCount || 6);
  const aspectRatio = (body?.aspectRatio || "3:4") as HtmlAspectRatio;
  const outputLanguage = sanitizeText(String(body?.outputLanguage || "auto")) || "auto";

  if (!projectId) return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });
  if (!presetId) return NextResponse.json({ success: false, error: "presetId is required" }, { status: 400 });
  if (slideCount !== 6) return NextResponse.json({ success: false, error: "slideCount must be 6" }, { status: 400 });
  if (!HTML_SLIDE_DIMENSIONS[aspectRatio]) {
    return NextResponse.json({ success: false, error: "Unsupported aspectRatio" }, { status: 400 });
  }

  const preset = getHtmlPresetById(presetId);
  if (!preset) return NextResponse.json({ success: false, error: "Preset not found" }, { status: 404 });

  const { data: project, error: projectErr } = await supabase
    .from("carousel_projects")
    .select("id, title, template_type_id, html_generation_status")
    .eq("id", projectId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: projectErr?.message || "Project not found" }, { status: 404 });
  }
  if (String((project as any)?.template_type_id || "") !== "html") {
    return NextResponse.json({ success: false, error: "Only html projects can generate html slides" }, { status: 400 });
  }

  const { data: slidesRows, error: slidesErr } = await supabase
    .from("carousel_project_slides")
    .select("slide_index, headline, body")
    .eq("project_id", projectId)
    .order("slide_index", { ascending: true });
  if (slidesErr) return NextResponse.json({ success: false, error: slidesErr.message }, { status: 500 });

  const structured = body?.content
    ? parseStructuredContent(String(body.content || ""))
    : buildStructuredContentFromSlides(String((project as any)?.title || "Untitled HTML Carousel"), slidesRows || []);
  if (!structured.projectTitle || structured.slides.length !== 6) {
    return NextResponse.json({ success: false, error: "Html copy draft is required before slide generation" }, { status: 400 });
  }

  const content = [
    "PROJECT_TITLE:",
    structured.projectTitle,
    "",
    "CAROUSEL_TEXTLINES:",
    ...structured.slides.flatMap((slide) => [`SLIDE ${slide.slideNumber} (textLines):`, ...slide.textLines, ""]),
  ]
    .join("\n")
    .trim();

  const wantsStream =
    String(request.headers.get("accept") || "").includes("text/event-stream") || Boolean((body as any)?.stream);
  if (!wantsStream) {
    return NextResponse.json({ success: false, error: "Streaming not requested" }, { status: 400 });
  }

  const htmlGenerationId = randomUUID();
  const { error: initUpdateErr } = await supabase
    .from("carousel_projects")
    .update({
      html_generation_id: htmlGenerationId,
      html_generation_status: "generating",
      html_preset_id: preset.id,
      html_style_guide: preset.styleGuide,
    })
    .eq("id", projectId);
  if (initUpdateErr) {
    return NextResponse.json({ success: false, error: `Failed to initialize generation state: ${initUpdateErr.message}` }, { status: 500 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, payload: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      const run = async () => {
        let emittedPages = 0;
        try {
          send("status", { phase: "resolving_preset" });
          send("status", { phase: "generating" });

          let pages: GeneratedPage[] = [];
          try {
            pages = await callAnthropicPages({
              preset,
              content,
              aspectRatio,
              slideCount,
              outputLanguage,
            });
          } catch {
            pages = structured.slides.map((slide, index) =>
              buildDeterministicPage({
                preset,
                slide,
                aspectRatio,
                role: deriveRole(index, structured.slides.length),
              })
            );
          }

          for (let index = 0; index < pages.length; index += 1) {
            const page = pages[index]!;
            const sanitized = sanitizeGeneratedHtml({ html: ensureImageSlotPrefill(page.html, preset), aspectRatio, preset });
            if (!sanitized.valid || !sanitized.normalizedHtml) {
              throw new Error(`Slide ${index + 1} failed html validation`);
            }
            const pageType = deriveRole(index, pages.length);
            const { error: slideUpdateErr } = await supabase
              .from("html_project_slides")
              .update({
                html: sanitized.normalizedHtml,
                page_title: page.title,
                page_type: pageType,
              })
              .eq("project_id", projectId)
              .eq("slide_index", index);
            if (slideUpdateErr) {
              throw new Error(`Slide ${index + 1} failed to persist: ${slideUpdateErr.message}`);
            }

            emittedPages += 1;
            send("page", {
              pageIndex: index,
              totalPages: -1,
              page: {
                pageNumber: page.pageNumber,
                title: page.title,
                html: sanitized.normalizedHtml,
                needsImage: sanitized.needsImage,
              },
            });
          }

          const { error: completeUpdateErr } = await supabase
            .from("carousel_projects")
            .update({
              html_generation_status: "complete",
              html_generation_id: htmlGenerationId,
              html_preset_id: preset.id,
              html_style_guide: preset.styleGuide,
            })
            .eq("id", projectId);
          if (completeUpdateErr) {
            send("warning", { message: `Slides generated but project state failed to save: ${completeUpdateErr.message}` });
          }

          send("complete", {
            htmlGenerationId,
            totalPages: pages.length,
            preset: {
              id: preset.id,
              name: preset.name,
              aspectRatio: preset.aspectRatio,
            },
          });
          controller.close();
        } catch (error: any) {
          await supabase
            .from("carousel_projects")
            .update({
              html_generation_status: emittedPages > 0 ? "partial" : "failed",
              html_generation_id: htmlGenerationId,
              html_preset_id: preset.id,
              html_style_guide: preset.styleGuide,
            })
            .eq("id", projectId)
            .then(({ error: errUpdateErr }) => {
              if (errUpdateErr) {
                send("warning", { message: `Error state also failed to persist: ${errUpdateErr.message}` });
              }
            });
          send("error", {
            message: String(error?.message || "HTML generation failed"),
            partial: emittedPages > 0,
          });
          controller.close();
        }
      };

      run().catch((error: any) => {
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message: String(error?.message || "Generation failed") })}\n\n`)
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
