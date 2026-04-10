import "server-only";

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase, resolveActiveAccountId } from "../../../_utils";
import { SYSTEM_HTML_PRESETS, type HtmlDesignPreset } from "@/features/html-editor/lib/presets";
import type { HtmlAspectRatio } from "@/features/html-editor/lib/htmlDocumentWrapper";
import {
  assertHtmlRenderBucketExists,
  createHtmlRenderServiceClient,
  HTML_RENDER_STORAGE_BUCKET,
  renderHtmlPagesToImages,
  uploadRenderedPagesToStorage,
} from "@/features/html-editor/server/renderHtmlPages";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  presetIds?: string[];
  aspectRatio?: HtmlAspectRatio;
  offset?: number;
  limit?: number;
  writeToDb?: boolean;
};

type PreviewManifestEntry = {
  presetId: string;
  name: string;
  aspectRatio: HtmlAspectRatio;
  thumbnailUrl: string;
  exampleImages: Record<string, string[]>;
};

function selectPresets(body: Body | null): HtmlDesignPreset[] {
  const requestedIds = new Set((body?.presetIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  const aspectRatio = body?.aspectRatio || "4:5";
  const offset = Math.max(0, Number(body?.offset || 0));
  const limit = Math.max(1, Math.min(25, Number(body?.limit || 10)));

  const base = SYSTEM_HTML_PRESETS.filter((preset) => {
    if (preset.aspectRatio !== aspectRatio) return false;
    if (requestedIds.size && !requestedIds.has(preset.id)) return false;
    return true;
  });

  return requestedIds.size ? base : base.slice(offset, offset + limit);
}

function mergePreviewImages(existing: unknown, url: string) {
  const next: Record<string, string[]> =
    existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Record<string, string[]>) } : {};
  const currentEn = Array.isArray(next.en) ? next.en.filter(Boolean) : [];
  next.en = [url, ...currentEn.filter((value) => value !== url).slice(1)];
  return next;
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

  const aspectRatio = body?.aspectRatio || "4:5";
  const presets = selectPresets(body);
  if (!presets.length) {
    return NextResponse.json({ success: false, error: "No presets matched the requested generation slice" }, { status: 400 });
  }

  const svc = createHtmlRenderServiceClient();
  if (!svc) {
    return NextResponse.json(
      { success: false, error: "Server missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const bucketErr = await assertHtmlRenderBucketExists(svc, HTML_RENDER_STORAGE_BUCKET);
  if (bucketErr) return NextResponse.json({ success: false, error: bucketErr }, { status: 400 });

  const writeToDb = body?.writeToDb !== false;
  const presetIds = presets.map((preset) => preset.id);
  const { data: existingRows, error: existingErr } = await svc
    .from("html_design_presets")
    .select("id, example_images")
    .in("id", presetIds);
  if (existingErr) {
    return NextResponse.json({ success: false, error: existingErr.message }, { status: 500 });
  }
  const existingById = new Map((existingRows || []).map((row: any) => [String(row.id), row]));

  const generatedAt = new Date().toISOString();
  const manifest: PreviewManifestEntry[] = [];
  const failures: Array<{ presetId: string; name: string; error: string }> = [];

  for (const preset of presets) {
    const firstTemplate = preset.templates.find((template) => String(template?.html || "").trim());
    if (!firstTemplate) {
      failures.push({ presetId: preset.id, name: preset.name, error: "Preset has no renderable template HTML" });
      continue;
    }

    try {
      const rendered = await renderHtmlPagesToImages({
        pages: [{ pageNumber: 1, html: firstTemplate.html }],
        aspectRatio: preset.aspectRatio,
        imageType: "jpeg",
        jpegQuality: 90,
      });
      const renderRunId = randomUUID();
      const baseDir = `accounts/${accountId}/users/${user.id}/html-preset-previews/${preset.id}/${renderRunId}`;
      const images = await uploadRenderedPagesToStorage({
        svc,
        bucket: HTML_RENDER_STORAGE_BUCKET,
        baseDir,
        renderedPages: rendered.pages,
        upsert: true,
      });
      const thumbnailUrl = images[0]?.url;
      if (!thumbnailUrl) {
        failures.push({ presetId: preset.id, name: preset.name, error: "No preview image was produced" });
        continue;
      }

      const exampleImages = mergePreviewImages(existingById.get(preset.id)?.example_images, thumbnailUrl);
      manifest.push({
        presetId: preset.id,
        name: preset.name,
        aspectRatio: preset.aspectRatio,
        thumbnailUrl,
        exampleImages,
      });

      if (writeToDb) {
        const { error: updateErr } = await svc
          .from("html_design_presets")
          .update({
            thumbnail_url: thumbnailUrl,
            example_images: exampleImages,
          })
          .eq("id", preset.id);
        if (updateErr) {
          failures.push({ presetId: preset.id, name: preset.name, error: `Preview generated but DB update failed: ${updateErr.message}` });
        }
      }
    } catch (error: any) {
      failures.push({
        presetId: preset.id,
        name: preset.name,
        error: String(error?.message || "Failed to generate preview"),
      });
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      generatedAt,
      aspectRatio,
      writeToDb,
      processedPresetCount: presets.length,
      generatedPreviewCount: manifest.length,
      manifest,
      failures,
    },
  });
}
