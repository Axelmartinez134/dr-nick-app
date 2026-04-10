import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import { HTML_SLIDE_DIMENSIONS, wrapHtmlDocument, type HtmlAspectRatio } from "../lib/htmlDocumentWrapper";

export const HTML_RENDER_STORAGE_BUCKET = "carousel-project-images" as const;

export type HtmlRenderPageInput = {
  pageNumber: number;
  html: string;
};

export type HtmlRenderedPage = {
  pageNumber: number;
  buffer: Buffer;
  contentType: "image/png" | "image/jpeg";
  extension: "png" | "jpeg";
  width: number;
  height: number;
};

export type HtmlStorageRenderImage = {
  pageNumber: number;
  url: string;
  path: string;
};

export function stripEditorAttrs(input: string) {
  return String(input || "")
    .replace(/\sdata-editable-id=(['"]).*?\1/gi, "")
    .replace(/\sdata-selected-editable=(['"]).*?\1/gi, "")
    .replace(/\sdata-editor-[a-z-]+=(['"]).*?\1/gi, "")
    .trim();
}

export function sanitizeFileName(input: string) {
  const base = String(input || "html-carousel")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "html-carousel";
}

export function createHtmlRenderServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function assertHtmlRenderBucketExists(
  svc: SupabaseClient,
  bucket = HTML_RENDER_STORAGE_BUCKET
): Promise<string | null> {
  try {
    const { data: buckets, error } = await svc.storage.listBuckets();
    if (error || !Array.isArray(buckets)) return null;
    const exists = buckets.some((item: any) => item?.name === bucket);
    if (exists) return null;
    return `Bucket not found: "${bucket}". Create a PUBLIC bucket named "${bucket}" in this Supabase project, then retry.`;
  } catch {
    return null;
  }
}

async function waitForRenderStability(page: Page) {
  await page.evaluate(async () => {
    const doc = document;
    try {
      if ("fonts" in doc) {
        await (doc as any).fonts.ready;
      }
    } catch {
      // ignore font readiness failures
    }

    const images = Array.from(doc.images || []);
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      })
    );
  });
  await page.waitForTimeout(150);
}

export async function renderHtmlPagesToImages(args: {
  pages: HtmlRenderPageInput[];
  aspectRatio: HtmlAspectRatio;
  imageType?: "png" | "jpeg";
  jpegQuality?: number;
}): Promise<{
  pages: HtmlRenderedPage[];
  pageCount: number;
  aspectRatio: HtmlAspectRatio;
}> {
  const aspectRatio = args.aspectRatio;
  const imageType = args.imageType || "png";
  const jpegQuality = args.jpegQuality ?? 90;
  const { width, height } = HTML_SLIDE_DIMENSIONS[aspectRatio];
  const validPages = (args.pages || []).filter((page) => String(page?.html || "").trim());

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width, height } });
    const rendered: HtmlRenderedPage[] = [];

    for (const entry of validPages) {
      const doc = wrapHtmlDocument({
        html: stripEditorAttrs(entry.html),
        aspectRatio,
        interactive: false,
      });
      await page.setContent(doc, { waitUntil: "load" });
      await waitForRenderStability(page);
      const buffer = await page.screenshot({
        type: imageType,
        quality: imageType === "jpeg" ? jpegQuality : undefined,
        clip: { x: 0, y: 0, width, height },
      });
      rendered.push({
        pageNumber: Number(entry.pageNumber || rendered.length + 1),
        buffer,
        contentType: imageType === "jpeg" ? "image/jpeg" : "image/png",
        extension: imageType,
        width,
        height,
      });
    }

    return {
      pages: rendered,
      pageCount: rendered.length,
      aspectRatio,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export async function uploadRenderedPagesToStorage(args: {
  svc: SupabaseClient;
  bucket?: string;
  baseDir: string;
  renderedPages: HtmlRenderedPage[];
  upsert?: boolean;
}): Promise<HtmlStorageRenderImage[]> {
  const bucket = args.bucket || HTML_RENDER_STORAGE_BUCKET;
  const baseDir = String(args.baseDir || "").replace(/^\/+/, "").replace(/\/+$/, "");
  const upsert = args.upsert ?? true;
  const results: HtmlStorageRenderImage[] = [];

  for (const rendered of args.renderedPages) {
    const pageNumber = Math.max(1, Number(rendered.pageNumber || 1));
    const path = `${baseDir}/page-${String(pageNumber).padStart(2, "0")}.${rendered.extension}`;
    const { error } = await args.svc.storage.from(bucket).upload(path, rendered.buffer, {
      contentType: rendered.contentType,
      upsert,
    });
    if (error) {
      throw new Error(`Failed to upload rendered page ${pageNumber}: ${error.message}`);
    }
    const { data } = args.svc.storage.from(bucket).getPublicUrl(path);
    results.push({
      pageNumber,
      path,
      url: data.publicUrl,
    });
  }

  return results;
}
