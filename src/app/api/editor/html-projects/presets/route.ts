import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase, resolveActiveAccountId } from "../../_utils";
import { SYSTEM_HTML_PRESETS } from "@/features/html-editor/lib/presets";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authed = await getAuthedSupabase(request);
  if (!authed.ok) {
    return NextResponse.json({ success: false, error: authed.error }, { status: authed.status });
  }
  const { supabase, user } = authed;

  const acct = await resolveActiveAccountId({ request, supabase, userId: user.id });
  if (!acct.ok) return NextResponse.json({ success: false, error: acct.error }, { status: acct.status });

  const basePresets = SYSTEM_HTML_PRESETS
    .filter((preset) => preset.isVisible !== false)
    .sort((a, b) => {
      const aFeaturedOrder = a.featuredOrder ?? Number.MAX_SAFE_INTEGER;
      const bFeaturedOrder = b.featuredOrder ?? Number.MAX_SAFE_INTEGER;
      if (aFeaturedOrder !== bFeaturedOrder) return aFeaturedOrder - bFeaturedOrder;
      return a.name.localeCompare(b.name);
    });

  const presetIds = basePresets.map((preset) => preset.id);
  const { data: dbRows } = await supabase
    .from("html_design_presets")
    .select("id, example_images, thumbnail_url")
    .in("id", presetIds);
  const dbById = new Map((dbRows || []).map((row: any) => [String(row.id), row]));
  const presets = basePresets.map((preset) => {
    const dbRow = dbById.get(preset.id);
    if (!dbRow) return preset;
    return {
      ...preset,
      thumbnailUrl: typeof dbRow.thumbnail_url === "string" && dbRow.thumbnail_url.trim() ? dbRow.thumbnail_url : preset.thumbnailUrl,
      exampleImages:
        dbRow.example_images && typeof dbRow.example_images === "object" && !Array.isArray(dbRow.example_images)
          ? (dbRow.example_images as Record<string, string[]>)
          : preset.exampleImages,
    };
  });

  return NextResponse.json({
    success: true,
    presets,
  });
}
