"use client";

/**
 * Preset cards use a single interactive surface (role="button" on the main block) so we never nest
 * <button> inside <button> when adding a separate "Details" control later. Browse modal passes
 * onOpenPresetDetails; workspace preset picker omits it (click only selects preset).
 *
 * Grid thumbnails use object-cover inside a frame sized by HTML_SLIDE_DIMENSIONS (Mirr-style slide preview).
 */
import { useMemo, useState } from "react";
import type { HtmlDesignPreset } from "../lib/presets";
import { HTML_SLIDE_DIMENSIONS, type HtmlAspectRatio } from "../lib/htmlDocumentWrapper";

const ASPECT_RATIO_FILTERS = ["all", "1:1", "4:5", "3:4", "9:16", "16:9"] as const;
const GALLERY_SECTIONS = ["all", "featured", "my-templates", "favorites"] as const;
type GallerySection = (typeof GALLERY_SECTIONS)[number];

function presetDisplayName(preset: HtmlDesignPreset) {
  return preset.localizedName?.en || preset.name;
}

function presetDisplayDescription(preset: HtmlDesignPreset) {
  return preset.localizedDescription?.en || preset.description;
}

function matchesSearch(preset: HtmlDesignPreset, searchValue: string) {
  const query = String(searchValue || "").trim().toLowerCase();
  if (!query) return true;

  const haystack = [
    presetDisplayName(preset),
    presetDisplayDescription(preset),
    preset.category,
    ...(preset.styleGuide.designPatterns || []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function gallerySectionLabel(section: GallerySection) {
  switch (section) {
    case "all":
      return "All Templates";
    case "featured":
      return "Featured";
    case "my-templates":
      return "My Templates";
    case "favorites":
      return "Favorites";
  }
}

function PlaceholderPanel(props: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{props.description}</div>
    </div>
  );
}

function PresetCard(props: {
  preset: HtmlDesignPreset;
  selected: boolean;
  onSelect: (presetId: string) => void;
  onOpenPresetDetails?: (preset: HtmlDesignPreset) => void;
  /** Featured strip: eager for LCP; main grid: lazy for below-the-fold. */
  imageLoading?: "eager" | "lazy";
}) {
  const { preset, selected } = props;
  const previewImage = preset.thumbnailUrl || preset.exampleImages.en?.[0] || null;
  const displayName = presetDisplayName(preset);
  const { width: slideW, height: slideH } = HTML_SLIDE_DIMENSIONS[preset.aspectRatio as HtmlAspectRatio];
  /** CSS aspect-ratio uses physical slide dimensions, e.g. `1080 / 1350` for 4:5 */
  const aspectRatioCss = `${slideW} / ${slideH}`;
  const imageLoading = props.imageLoading ?? "lazy";

  const activate = () => {
    props.onSelect(preset.id);
    props.onOpenPresetDetails?.(preset);
  };

  return (
    <div
      className={[
        "mx-auto w-full max-w-[220px] sm:max-w-[240px] rounded-2xl border bg-slate-100/95 p-2 shadow-sm outline-none transition-[box-shadow,border-color]",
        selected
          ? "border-slate-900 ring-2 ring-slate-900 ring-offset-2 ring-offset-white"
          : "border-slate-200/90 hover:border-slate-300 focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2 focus-within:ring-offset-white",
      ].join(" ")}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={displayName}
        title={displayName}
        className="cursor-pointer rounded-lg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        }}
      >
        <div
          className="relative w-full overflow-hidden rounded-xl border border-slate-200/90 bg-slate-200/50 shadow-sm"
          style={{ aspectRatio: aspectRatioCss }}
        >
          {previewImage ? (
            <img
              src={previewImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading={imageLoading}
            />
          ) : (
            <div
              className="absolute inset-0 h-full w-full"
              style={{
                background: `linear-gradient(135deg, ${preset.styleGuide.backgroundColor}, ${preset.styleGuide.secondaryColor})`,
              }}
            />
          )}
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700 shadow-sm ring-1 ring-black/5">
            {preset.aspectRatio}
          </div>
          {preset.isFeatured ? (
            <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-violet-600/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
              Featured
            </span>
          ) : null}
        </div>
        <p className="mt-2 truncate px-0.5 text-center text-xs font-semibold text-slate-800">{displayName}</p>
      </div>
    </div>
  );
}

export function HtmlPresetGallery(props: {
  presets: HtmlDesignPreset[];
  selectedPresetId: string | null;
  onSelect: (presetId: string) => void;
  /** When set (e.g. browse modal), activating a card also opens template detail for that preset. */
  onOpenPresetDetails?: (preset: HtmlDesignPreset) => void;
}) {
  const [activeSection, setActiveSection] = useState<GallerySection>("all");
  const [searchValue, setSearchValue] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [aspectRatioFilter, setAspectRatioFilter] = useState<(typeof ASPECT_RATIO_FILTERS)[number]>("all");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(props.presets.map((preset) => preset.category).filter(Boolean)))],
    [props.presets]
  );
  const sectionPresets = useMemo(() => {
    if (activeSection === "featured") {
      return props.presets.filter((preset) => preset.isFeatured);
    }
    if (activeSection === "all") {
      return props.presets;
    }
    return [];
  }, [activeSection, props.presets]);
  const filteredPresets = useMemo(() => {
    return sectionPresets.filter((preset) => {
      if (categoryFilter !== "all" && preset.category !== categoryFilter) return false;
      if (aspectRatioFilter !== "all" && preset.aspectRatio !== aspectRatioFilter) return false;
      if (!matchesSearch(preset, searchValue)) return false;
      return true;
    });
  }, [aspectRatioFilter, categoryFilter, searchValue, sectionPresets]);

  const featuredPresets = useMemo(() => {
    if (activeSection !== "all") return [];
    if (searchValue.trim() || categoryFilter !== "all" || aspectRatioFilter !== "all") return [];
    return props.presets.filter((preset) => preset.isFeatured);
  }, [activeSection, aspectRatioFilter, categoryFilter, props.presets, searchValue]);

  const activeFilterSummary = useMemo(() => {
    const summary: string[] = [];
    if (activeSection === "featured") summary.push("section: featured");
    if (searchValue.trim()) summary.push(`search: "${searchValue.trim()}"`);
    if (aspectRatioFilter !== "all") summary.push(`ratio: ${aspectRatioFilter}`);
    if (categoryFilter !== "all") summary.push(`category: ${categoryFilter}`);
    if (!summary.length) {
      return activeSection === "featured" ? "Featured presets" : "All presets";
    }
    return summary.join(" • ");
  }, [activeSection, aspectRatioFilter, categoryFilter, searchValue]);

  const sectionDescription =
    activeSection === "my-templates"
      ? "Custom workspace templates will appear here once template creation is enabled."
      : activeSection === "favorites"
        ? "Saved favorite presets will appear here once favoriting is enabled."
        : "Choose a visual system before generating HTML slides.";

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Preset Gallery</div>
          <div className="mt-1 text-xs text-slate-500">{sectionDescription}</div>
        </div>

        <div className="flex min-w-[260px] flex-1 justify-end">
          <label className="w-full max-w-sm">
            <span className="sr-only">Search presets</span>
            <input
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(String(e.target.value || ""))}
              placeholder="Search preset name, description, or pattern"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              disabled={activeSection === "my-templates" || activeSection === "favorites"}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {GALLERY_SECTIONS.map((section) => {
          const active = activeSection === section;
          return (
            <button
              key={section}
              type="button"
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors",
                active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
              ].join(" ")}
              onClick={() => setActiveSection(section)}
            >
              {gallerySectionLabel(section)}
            </button>
          );
        })}
      </div>

      {activeSection === "all" || activeSection === "featured" ? (
        <>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Aspect ratio</span>
                {ASPECT_RATIO_FILTERS.map((ratio) => {
                  const active = aspectRatioFilter === ratio;
                  return (
                    <button
                      key={ratio}
                      type="button"
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                      ].join(" ")}
                      onClick={() => setAspectRatioFilter(ratio)}
                    >
                      {ratio === "all" ? "All" : ratio}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Category</span>
                {categories.map((category) => {
                  const active = categoryFilter === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                      ].join(" ")}
                      onClick={() => setCategoryFilter(category)}
                    >
                      {category === "all" ? "All categories" : category}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{filteredPresets.length}</span> preset
              {filteredPresets.length === 1 ? "" : "s"}
            </div>
            <div>{activeFilterSummary}</div>
          </div>

          {featuredPresets.length ? (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Featured</div>
                  <div className="mt-1 text-xs text-slate-500">Starting points picked for the current catalog.</div>
                </div>
                <div className="text-xs text-slate-500">{featuredPresets.length} featured</div>
              </div>
              <div className="grid justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {featuredPresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    selected={preset.id === props.selectedPresetId}
                    onSelect={props.onSelect}
                    onOpenPresetDetails={props.onOpenPresetDetails}
                    imageLoading="eager"
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            <div className="mb-3 text-sm font-semibold text-slate-900">
              {activeSection === "featured" ? "Featured presets" : featuredPresets.length ? "All matching presets" : "Presets"}
            </div>
            {filteredPresets.length ? (
              <div className="grid justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredPresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    selected={preset.id === props.selectedPresetId}
                    onSelect={props.onSelect}
                    onOpenPresetDetails={props.onOpenPresetDetails}
                    imageLoading="lazy"
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No presets match the current search and filters.
              </div>
            )}
          </div>
        </>
      ) : activeSection === "my-templates" ? (
        <PlaceholderPanel
          title="My Templates Coming Soon"
          description="This section is reserved for workspace-level and user-created HTML presets. The data model already supports future custom templates, but creation and management are not enabled yet."
        />
      ) : (
        <PlaceholderPanel
          title="Favorites Coming Soon"
          description="Favoriting is planned as lightweight saved curation on top of the preset catalog. This placeholder keeps the gallery structure aligned with the future Mirr-style entry surface."
        />
      )}
    </section>
  );
}
