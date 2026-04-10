# Template System Parity Plan

> Generated: 2026-04-09  
> Updated: 2026-04-10 — Phase 17F expanded (template detail + §9 active plan); cross-link from `HTML_TEMPLATE_TYPE_IMPLEMENTATION_PLAN.md`.
>
> This document defines the implementation contract for rebuilding the HTML preset/template system to match Mirr's catalog architecture. It replaces the old Phase 17 (Media & Asset Parity) in the gap analysis, which becomes Phase 18.

## 1. Mirr's Template System — Complete Specification (from HAR)

### Catalog Stats

| Metric | Value |
|--------|-------|
| Total presets | 366 |
| Aspect ratios | 5: `1:1` (105), `4:5` (130), `3:4` (49), `9:16` (43), `16:9` (39) |
| Categories | 7: business (68), design (79), education (33), lifestyle (69), marketing (77), tech (38), uncategorized (2) |
| Featured | 17 presets |
| Templates per preset | 1–10 (mode: 5, with 129 presets having exactly 5) |
| PageType values | `cover`, `content`, `cta` (3 presets have templates with null pageType) |
| ExampleImages | Per-locale dict with `en` and `ko` keys, each an array of 1–5 PNG URLs |
| Localization | 311/366 have `localizedName`, 269/366 have `localizedDescription` |
| All are system presets | `isSystem: true`, `isVisible: true` for all 366 |
| workspaceId | null for all (system presets) |
| userId | 52/366 have a userId (creator tracking, not ownership gating) |

### Mirr Preset Data Model (exact fields from API response)

```typescript
type MirrPreset = {
  id: string;                       // UUID
  workspaceId: string | null;       // null for system presets
  userId: string | null;            // creator tracking
  isSystem: boolean;                // always true for system catalog
  isVisible: boolean;               // always true in the served catalog
  isFeatured: boolean;              // 17 presets are featured
  featuredOrder: number | null;     // all null in current data — likely future sort key
  name: string;                     // English name
  localizedName: Record<string, string> | null;  // { en: "...", ko: "..." }
  description: string;              // English description
  localizedDescription: Record<string, string> | null;  // { en: "...", ko: "..." }
  aspectRatio: "1:1" | "4:5" | "3:4" | "9:16" | "16:9";
  templates: Array<{
    html: string;                   // full HTML for one page
    pageType?: "cover" | "content" | "cta";  // optional, 3 presets have null
  }>;
  styleGuide: {
    fontFamily: string;             // single font name
    primaryColor: string;           // hex
    secondaryColor: string;         // hex
    accentColor: string;            // hex
    backgroundColor: string;        // hex
    designPatterns: string[];       // 3–5 pattern names
  };
  category: string | null;          // one of 7 categories or null
  exampleImages: {                  // per-locale rendered page previews
    en: string[];                   // 1–5 PNG URLs
    ko: string[];
  };
  createdAt: string;                // ISO timestamp
  updatedAt: string;                // ISO timestamp
};
```

### Mirr API Contract

```
GET /api/v1/carousel-lab/presets
Response: { success: true, data: MirrPreset[] }   // all 366 in one response
```

All filtering (category, aspect ratio, search) is client-side. The API serves the full catalog in a single request.

### Mirr Example Image URL Pattern

```
https://storage.mirra.my/media/carousel-examples/{preset-id}/{locale}/page-{n}.png
```

Each image is a rendered screenshot of one template page. Presets with 1 template have 1 example image; presets with 5 templates have 5 example images.

## 2. Our Current State

### Data Model

| Field | Mirr | Ours | Gap |
|-------|------|------|-----|
| `id` | UUID | UUID | Match |
| `workspaceId` | `null` for system | Not in TS type | **Missing** — DB has `account_id` which serves the same purpose |
| `userId` | Creator tracking | Not present | **Missing** — not critical for V1 |
| `isSystem` | `true` for all system | `boolean` in TS | Match |
| `isVisible` | `true` for all served | Not in TS type | **Missing** — DB has no `is_visible` column |
| `isFeatured` | `boolean` | `boolean` | Match |
| `featuredOrder` | `number | null` | Not in TS type | **Missing** — DB has `featured_order` column |
| `name` | string | string | Match |
| `localizedName` | `{ en, ko }` | Not present | **Missing** — DB has `localized_name` jsonb |
| `description` | string | string | Match |
| `localizedDescription` | `{ en, ko }` | Not present | **Missing** — DB has `localized_description` jsonb |
| `aspectRatio` | 5 values | `"3:4"` literal only | **Major gap** — locked to one ratio |
| `templates[].pageType` | `cover/content/cta` | `templates[].role` | **Naming mismatch** |
| `templates[].html` | Full HTML per page | Full HTML per page | Match |
| `templates[].id` | Not present | Present | Extra field (useful, keep) |
| `templates[].name` | Not present | Present | Extra field (useful, keep) |
| `styleGuide` fields | 6 fields | 8 fields (adds `headingFontFamily`, `bodyFontFamily`) | **Richer** — keep ours, map Mirr's single `fontFamily` |
| `category` | 7 values + null | string | Match structurally |
| `exampleImages` | `{ en: string[], ko: string[] }` | `string[]` (always empty) | **Major gap** — wrong shape and no data |
| `thumbnailUrl` | Not in Mirr API | In our DB schema | Extra field |
| `createdAt` / `updatedAt` | Present | Not in TS type | DB has them |

### Catalog

| Metric | Mirr | Ours | Gap |
|--------|------|------|-----|
| Total presets | 366 | 5 | **Massive gap** |
| Aspect ratios in catalog | 5 | 1 (`3:4`) | **Major gap** |
| Categories covered | 7 | 4 | Partial |
| Templates per preset | 1–10 | 2 | Low variety |
| Preview images | 1–5 per preset per locale | None | **Major gap** |
| Source of truth | DB-served | Code constant | Architecture gap |

### API

| | Mirr | Ours | Gap |
|-|------|------|-----|
| Route | `GET /presets` → full catalog | `GET /presets` → code constant | Functional but not scalable |
| Response shape | `{ success, data: Preset[] }` | `{ success, presets: Preset[] }` | Key name differs (`data` vs `presets`) |
| Client filtering | Category, aspect ratio, search | Category only | **Missing** aspect-ratio and search |

### Gallery UI

| Feature | Mirr | Ours | Gap |
|---------|------|------|-----|
| Preview image cards | Real rendered page screenshots | Gradient swatch cards | **Major gap** |
| Aspect ratio filter | Pill buttons | Not present | **Missing** |
| Category filter | Chips | Dropdown select | Functional but less visual |
| Search | Text input | Not present | **Missing** |
| Featured section | Highlighted presets | `isFeatured` badge only | Partial |
| Grid layout for many cards | Handles 100+ | 2-column grid for 5 | Needs scaling |
| Sections (System / My Templates / etc.) | Tabs/sections | Not present | **Missing** (foundation-only for V1) |
| Template detail after pick | Modal/sheet: **Example results** vs **Design structure** tabs, pills, footer actions | Browse-only grid; no second-level detail | **Missing** (Phase 17F) |

## 3. Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Source of truth | Code canonical, shaped exactly like DB model | Speed now, DB switch later with zero UI/API contract change |
| `role` → `pageType` rename | **Yes, do it now** | Reduces translation layers, matches Mirr exactly, cleaner for template import |
| Aspect ratio widening | Widen type to all 5 ratios now, ship `4:5` + `3:4` templates first | Model supports future ratios without change |
| ExampleImages shape | Change from `string[]` to `Record<string, string[]>` matching Mirr's `{ en: [...] }` | Matches Mirr exactly, supports future localization |
| Localization fields | Add to type but leave null/empty for V1 | Architecture supports it, no content needed yet |
| DB schema changes | Add `is_visible` column; otherwise existing schema already matches | Small migration |
| Preview images | Required for parity — generate or create placeholder images for each preset | This is the #1 visual parity gap |
| Template count | Increase to 50+ presets as first pass, then scale toward Mirr's 366 | Start with the most impactful categories |
| Catalog file structure | Split into per-category modules | Maintainability as catalog grows |
| Template detail UX | Mirr-style **two tabs** in browse flow: (1) example PNG carousel from `exampleImages[locale]`, (2) **design/structure** from `templates[].html` + `pageType` + `styleGuide`, rendered in sandboxed previews | Matches HAR: no extra API for design tab — data is already in `GET …/presets`-equivalent payload |
| Primary actions in detail | **Edit design** / **Use this template** visible but **disabled** until apply/generate flows are wired | Avoids mutating `htmlPresetId` or project state accidentally from browse-only modal |

## 4. Phase Sequence

**Why this phase order changes from the earlier draft**

The earlier ordering put gallery rebuild and large catalog expansion too early. After cross-checking the current HTML editor architecture against Mirr's full-document templates, that sequence is too risky. Mirr's preset pages are complete HTML documents with `<style>` blocks, class selectors, and more varied slot semantics than our current inline-style-heavy templates. If we import many Mirr-style templates before the parser / serializer / runtime / manual-edits chain is verified against class-based documents, we will create a hard-to-debug mix of failures:

- inspector controls rendering blank or partial values because styles come from classes instead of inline declarations
- changed-state / reset logic drifting because "original" values are read from the wrong source
- manual-edits summaries under-reporting changes on imported templates
- large-catalog gallery work masking lower-level parser/runtime incompatibilities

For that reason, the revised implementation order below pulls **template compatibility** ahead of gallery polish and bulk catalog expansion. The goal is to make the system safe for Mirr-style presets first, then make it large and polished.

### Phase 17A: Data Contract Refactor

**Goal:** Align the preset data model exactly with the target contract.

**Changes:**

1. **`src/features/html-editor/lib/presets.ts`** — Refactor types:
   - Rename `HtmlPresetTemplateRole` → `HtmlPresetPageType`
   - Rename `HtmlPresetTemplate.role` → `HtmlPresetTemplate.pageType`
   - Widen `HtmlDesignPreset.aspectRatio` from `"3:4"` literal to `"1:1" | "3:4" | "4:5" | "9:16" | "16:9"` and add `"9:16": { width: 1080, height: 1920 }` to `HTML_SLIDE_DIMENSIONS`
   - Widen `data-slot-type` to `"background" | "main" | "logo" | "icon" | "profile"` (was missing `icon` and `profile`)
   - Change `exampleImages` from `string[]` to `Record<string, string[]>` (e.g., `{ en: [...] }`)
   - Add optional fields: `localizedName?: Record<string, string>`, `localizedDescription?: Record<string, string>`, `isSystem?: boolean`, `isVisible?: boolean`, `featuredOrder?: number | null`, `thumbnailUrl?: string | null`, `workspaceId?: string | null`, `userId?: string | null`
   - Update existing 5 presets to use `pageType` instead of `role` and `exampleImages: { en: [] }` instead of `exampleImages: []`

2. **`src/app/api/editor/html-projects/generate-slides/route.ts`** — Update all references from `template.role` to `template.pageType`

3. **`src/app/api/editor/html-projects/presets/route.ts`** — Change response key from `presets` to `data` to match Mirr's API shape (or keep `presets` and adjust client — decide based on minimal change)

4. **`src/features/html-editor/services/htmlProjectsApi.ts`** — Update `listHtmlPresets` return type

5. **`src/features/html-editor/components/HtmlPresetGallery.tsx`** — Update to use `pageType` and new `exampleImages` shape

6. **`supabase/migrations/20260409_000002_add_is_visible_to_html_design_presets.sql`** — Add `is_visible` column

7. **Forward migration instead of seed rewrite** — Do **not** edit an already-applied migration in place. If the DB contract needs `pageType`-aligned metadata or `is_visible`, add a new forward migration that updates existing rows safely.

**Done when:**
- All types use `pageType` not `role`
- Aspect ratio type supports all 5 values
- ExampleImages shape matches Mirr
- API and client use the unified contract
- No linter errors

---

### Phase 17B: Class-Based Template Compatibility

**Goal:** Make the editor pipeline safe for Mirr-style full-document, class-based templates before importing them at scale.

**Why this happens before gallery or catalog scale-up:**

- Mirr templates are not just inline-style HTML fragments; they are full documents with `<head>`, `<style>`, `@import`, and many semantic CSS classes.
- Our current parser, serializer, runtime patching, and manual-edits system were proven against a smaller inline-style-first preset catalog.
- Importing a large catalog before this pass would make it impossible to tell whether failures come from catalog scale, gallery filtering, or fundamental template compatibility.

**Changes:**

1. **`src/features/html-editor/hooks/useHtmlElementParser.ts`**
   - Verify element discovery against class-based layouts and full-document markup
   - Ensure editable text / block / image-slot extraction still works when important styles come from computed styles rather than inline-only values
   - Confirm widened slot types (`icon`, `profile`) work in the parser path

2. **`src/features/html-editor/hooks/useHtmlElementSerializer.ts`**
   - Verify patch application does not break class-based templates
   - Keep element-level inline overrides scoped to actual edits rather than flattening class-driven design structure

3. **`src/features/html-editor/runtime/buildIframeRuntime.ts`**
   - Verify in-iframe patching, drag, selection, and inline text editing still behave on class-heavy templates
   - Confirm no assumptions exist that only inline-style layouts are transformable/editable

4. **`src/features/html-editor/lib/htmlManualEdits.ts`**
   - Verify diff summaries stay meaningful when baseline templates use class-driven styling

5. **`src/features/html-editor/lib/htmlDocumentWrapper.ts`**
   - Confirm full-document presets (`<!DOCTYPE html>`, `<head>`, `<style>`, `@import`) are wrapped/normalized safely without losing needed styling

6. **Add a small imported-template fixture set**
   - Before large catalog import, introduce a few representative Mirr-style full-document templates across different slot types / ratios and use them as the compatibility test bed

**Done when:**

- Full-document presets with `<style>` blocks render correctly in the HTML editor
- Parser / serializer / runtime / manual-edits all behave correctly on class-based templates
- `icon` and `profile` slot types are supported through the editor pipeline
- We can safely import more Mirr-like templates without first rewriting the editor again

---

### Phase 17C: Gallery Rebuild

**Goal:** Rebuild the preset browser UI to handle a real catalog.

**Changes:**

1. **`src/features/html-editor/components/HtmlPresetGallery.tsx`** — Full rebuild:
   - Search input (filters by name and description)
   - Aspect ratio pills (`All`, `1:1`, `4:5`, `3:4`, `9:16`, `16:9`)
   - Category chips (horizontal scrollable row)
   - Preview image cards: if `exampleImages.en[0]` exists, render it as the card thumbnail; fallback to gradient swatch
   - Featured section at top when no filters active
   - Responsive grid: 2 columns on medium, 3 on large, 4 on XL
   - Handle 50–400 cards without performance degradation (virtual scroll or paginated view if needed)
   - Show total count and active filter summary

2. **`src/features/html-editor/components/HtmlEditorWorkspace.tsx`** — Adjust gallery mounting area if layout needs change

**Done when:**
- Gallery has search, aspect-ratio pills, and category chips
- Preview images render when available
- Gallery handles 50+ presets without performance issues
- Filters combine correctly (search AND aspect ratio AND category)

---

### Phase 17D: Catalog Expansion

**Goal:** Add real template packs after the system is proven compatible with Mirr-style documents.

**Reasoning for the revised scope:**

- The original plan targeted `50+` presets immediately. That is still the direction, but the first pass should prove the architecture with a smaller, high-quality import set before scaling.
- A staged import makes failures attributable. If something breaks, we know whether it is the compatibility layer or the content volume.
- The catalog can now safely contain multiple aspect ratios, but **project creation / generation should still be treated as `4:5`-first for now** until the slide-creation flow is widened beyond the current `4:5` assumption. Non-`4:5` presets can exist in the catalog ahead of that work, but they should not be treated as fully supported generation targets yet.

**Changes:**

1. **Split preset files:**
   - `src/features/html-editor/lib/presets/index.ts` — exports combined catalog + `getHtmlPresetById`
   - `src/features/html-editor/lib/presets/business.ts`
   - `src/features/html-editor/lib/presets/marketing.ts`
   - `src/features/html-editor/lib/presets/design.ts`
   - `src/features/html-editor/lib/presets/tech.ts`
   - `src/features/html-editor/lib/presets/education.ts`
   - `src/features/html-editor/lib/presets/lifestyle.ts`

2. **Add presets across multiple aspect ratios in two passes:**
   - **Pass 1:** high-quality imported packs, starting with the most immediately usable presets
   - **Pass 2:** scale toward `50+` once the compatibility + gallery layers are proven stable
   - Each preset should have 3–5 template pages with proper `pageType` assignments
   - Each preset needs `styleGuide` and `designPatterns`
   - New presets should adopt the full-document format with `<style>` blocks and class-based styling, not the current fragment-only style

3. **Update seed migration** — Add new preset IDs to `html_design_presets` for FK support

4. **Standard future-import runbook** — every new imported pack should follow the same repeatable sequence:
   - Identify the exact source slice in the Mirr catalog HAR (`style.har` entry `151`) by category / aspect ratio / preset IDs before touching code
   - Extract the raw preset objects exactly as served by Mirr; do not rewrite or hand-author template HTML
   - Create or expand a dedicated import module under `src/features/html-editor/lib/` that keeps the raw Mirr payload and maps it into our `HtmlDesignPreset` shape
   - Preserve full-document template HTML, locale-specific `exampleImages`, source `styleGuide`, and Mirr preset IDs
   - Generate deterministic local `template.id` / `template.name` values only where our app requires them
   - Add a forward seed migration for the imported preset IDs so `carousel_projects.html_preset_id` remains FK-safe
   - If the pack extends a category already partially imported, create a follow-up migration that inserts only the remaining IDs rather than regenerating prior migrations
   - Run a quick verification pass after import: gallery loads, thumbnails render, preset selection persists, and at least one imported preset can be generated / opened if that aspect ratio is currently supported

5. **Current operational rule for future imports**
   - Until the creation flow is widened, prefer importing `4:5` packs first when the goal is immediate usability
   - Other aspect ratios (`1:1`, `3:4`, `9:16`, `16:9`) can still be imported for catalog parity and future readiness, but they should be treated as library coverage rather than fully supported creation paths

**Done when:**
- Initial high-quality import set is stable, then scalable toward 50+
- Each category has multiple presets
- File structure is modular and maintainable
- All presets have proper metadata

---

### Phase 17E: Preview Image Generation

**Goal:** Generate and own our own preset preview images so the gallery can show real template thumbnails without depending on Mirr-hosted example-image URLs long-term.

**Why this phase matters:**

- Right now the gallery can display previews, but imported presets are borrowing Mirr-hosted `exampleImages` URLs rather than using our own rendering/storage pipeline.
- That is good enough for catalog proving, but it is not a durable product architecture. We need a first-party preview pipeline before the preset system is truly self-owned.
- Preview generation is also the missing bridge between "code canonical preset catalog" and "DB-ready preset metadata with `thumbnailUrl` / `exampleImages` that we can regenerate whenever imports change."

**What Mirr actually does (from HAR + extracted code):**

- Mirr does **not** use a project-export ZIP route for previews.
- Mirr uses a dedicated `POST /api/v1/carousel-lab/render-html` path that accepts raw HTML and returns first-party storage URLs.
- The request shape supports:
  - `pages: [{ pageNumber, html }]`
  - `aspectRatio`
  - `format: "storage"`
- The response shape is:
  - `data.images: [{ pageNumber, url }]`
  - `data.pageCount`
  - `data.aspectRatio`
- The rendered files are stored at URLs like:
  - `https://storage.mirra.my/synced-media/carousel/{userId}/{timestamp}/page-01.jpeg`
- In the extracted Mirr client code, this render path is exposed as a reusable `renderPageToImage` capability, and the resulting URLs are cached / threaded into downstream flows such as refinement (`pageImages` passed into `refine-content-stream`).

**Mirr-aligned conclusion:**

We should copy the **pipeline shape**, not improvise a one-off thumbnail hack:

1. raw preset pages in
2. dedicated HTML render route
3. storage-backed image URLs out
4. preview URLs written back into preset metadata
5. same render pipeline reusable later for AI/refinement/export-adjacent work

**Important implementation note:**

The existing render route is project-based (`projectId` -> saved HTML slides) and ZIP-oriented. It cannot directly render arbitrary preset templates by itself. So Phase 17E requires a **new raw-pages render path** built from shared rendering primitives, not the current project-only export route unchanged.

**Changes:**

1. **Create a shared raw-pages render helper**
   - Extract the Playwright screenshot logic from `src/app/api/editor/html-projects/render/route.ts` into a reusable server helper
   - Keep `wrapHtmlDocument(...)` as the document wrapper entry point so preset previews and project export render through the same HTML shell
   - The helper should accept:
     - `pages: Array<{ pageNumber: number; html: string }>`
     - `aspectRatio`
     - output mode metadata needed for storage vs direct-return flows

2. **Add a Mirr-aligned raw HTML render route**
   - Introduce a new route dedicated to rendering arbitrary HTML pages rather than saved project slides
   - Preferred contract:
     - `POST /api/editor/html-projects/render-html`
     - body: `{ pages, aspectRatio, format: "storage" }`
     - response: `{ success: true, data: { images, pageCount, aspectRatio } }`
   - This route should be able to power preset previews now and other image-based flows later

3. **Implement first-party storage output**
   - Reuse the same Supabase storage upload patterns already used elsewhere in the app
   - Store outputs in a Mirr-like run folder shape rather than a one-file-only shortcut
   - Recommended path pattern:
     - `html-preset-previews/{scope-or-user}/{renderRunId}/page-01.jpeg`
   - Return public URLs in the same ordered `{ pageNumber, url }` structure Mirr uses

4. **Build a preset-preview generation tool on top of that route/helper**
   - Preferred shape: admin-only script or internal tool
   - Iterate the code-canonical preset catalog
   - For Phase 17E first pass:
     - use `4:5` presets only
     - render only page 1 for each preset
     - store that page as both `thumbnailUrl` and `exampleImages.en[0]`
   - This path should not create fake projects or write temporary project rows

5. **Write generated preview metadata back into the catalog**
   - Because the preset source of truth is still code-canonical, the generator should emit a generated metadata manifest or generated TS module
   - That generated output should populate:
     - `thumbnailUrl`
     - `exampleImages.en`
   - The DB seed path should mirror those same URLs into `html_design_presets`

6. **Keep gallery consumption unchanged**
   - `HtmlPresetGallery.tsx` already prefers `thumbnailUrl || exampleImages.en?.[0]`
   - Once first-party previews exist, the gallery should improve automatically without another UI rewrite

7. **Add repeatability and cache awareness**
   - Skip blank templates cleanly
   - Surface which preset IDs failed to render
   - Make reruns idempotent so new imports can regenerate previews cleanly
   - Keep preview outputs grouped by render run so bad batches are attributable
   - Preserve the possibility of a later client-side cache layer similar to Mirr's `cachedImageUrls` / `renderPageToImage` pattern

**Exact implementation map (by file / responsibility):**

1. **`src/app/api/editor/html-projects/render/route.ts`**
   - Remove the in-route ownership of the Playwright screenshot internals
   - Reuse the new shared helper for ZIP export
   - Keep project export behavior intact

2. **New shared server helper**
   - Example location: `src/features/html-editor/server/renderHtmlPages.ts`
   - Responsibilities:
     - sanitize editor attrs
     - wrap raw HTML
     - compute viewport from aspect ratio
     - render page(s) to image buffer(s)
     - support storage-return and direct-buffer callers

3. **New render route**
   - Example location: `src/app/api/editor/html-projects/render-html/route.ts`
   - Responsibilities:
     - auth / authorization
     - accept raw `pages`
     - call the shared render helper
     - upload outputs to storage
     - return Mirr-like `{ images, pageCount, aspectRatio }`

4. **New preset preview generator**
   - Example location: `scripts/generate-html-preset-previews.ts` or an admin-only internal route/tool
   - Responsibilities:
     - iterate selected presets
     - call the new render-html route/helper
     - collect preview URLs
     - emit a generated preview manifest for source control

5. **Preset metadata source**
   - Either a generated TS file or a generated JSON manifest imported by the preset modules
   - This should let imports and preview regeneration stay separate from the raw template payload files

6. **Seed migration follow-up**
   - Add forward migrations that sync preview URLs into `html_design_presets` once first-party previews exist
   - Do not rewrite earlier seed migrations in place

**Done when:**
- We can render preset pages through a dedicated raw-pages route without creating a project row
- The route returns Mirr-like storage-backed image URLs in `{ pageNumber, url }` form
- At least the first page of each `4:5` preset has a first-party preview image in storage
- `thumbnailUrl` / `exampleImages` can be regenerated when imported preset packs change
- Gallery cards show our rendered template previews instead of only borrowed or placeholder images

---

### Phase 17F: Entry Surface + Template Detail (Mirr-style)

**Goal:** Complete the **browse → inspect** path: users open the template browser, pick a preset, and see the same **two-pane mental model** Mirr uses — **what the carousel looks like as finished screenshots** vs **what the underlying editable HTML pages are** — without yet committing **Edit design** or **Use this template**.

**Evidence (HAR):** Mirr serves the full catalog in one JSON payload. Each preset includes `templates[].html`, `pageType`, `styleGuide`, and `exampleImages` (`en` / `ko` URL arrays). The **Design structure** tab does not depend on a second network asset family; it is driven from that payload. Our `HtmlDesignPreset` type already matches this shape; gaps are **UI** and **populated `exampleImages`** for presets that still ship empty arrays (see 17E / seed data).

**Ordering caveat:** 17F is **mostly UI**, but **Design structure** previews exercise the same path as 17B (`wrapHtmlDocument`, full-document HTML, fonts). Imported Mirr-tech presets may surface **wrapper or sandbox edge cases** in the detail tab before the main editor does. Treat broken previews as **canaries**; fix `htmlDocumentWrapper` or sandbox flags only when a real preset fails — not a reason to defer 17F.

#### UI flow (target)

1. User opens **Browse templates** (`HtmlTemplatesBrowseModal`).
2. **Grid** — `HtmlPresetGallery` (filters, cards, thumbnails). Selecting a card highlights it **or** a **Details** control opens the next step (product choice: click card = detail vs card select + separate Details button).
3. **Template detail** — second view inside the same modal (stacked navigation with **Back** to grid):
   - **Header:** display name (`localizedName.en` || `name`), short description, **pills**: `aspectRatio`, slide count (`templates.length`), optional `category`.
   - **Tabs (segmented control, no Radix dependency):** implement with **two toggle buttons** + `role="tablist"` / `role="tab"` / `role="tabpanel"`, `aria-selected`, and keyboard support as needed — **do not** add `@radix-ui/react-tabs` unless the team explicitly chooses a new dependency.
     - **Example results** — carousel of images from `exampleImages[activeLocale]` (default `en`). Letterbox inside a frame whose **aspect ratio matches `preset.aspectRatio`** via **`HTML_SLIDE_DIMENSIONS[preset.aspectRatio]`** (not 4:5-only — supports mixed catalog including 9:16). Use plain `<img>` like the gallery thumbnails to avoid `next/image` domain config churn. If `exampleImages.en` is empty, show an explicit empty state (“No previews yet”) or optional **fallback**: render slide 1 from `templates[0].html` via the same sandbox preview used in the other tab (defer if time-boxed).
     - **Design structure** — **do not mount N iframes at once** for large `templates` (performance): prefer **one active iframe** with `key={slideIndex}` and prev/next (or lazy-mount only the visible slide). Each slide: sandboxed **iframe `srcDoc`** after `wrapHtmlDocument(...)`, scaled to fit; label with `pageType` and index. Compact **style guide** (`styleGuide` colors, `designPatterns`, font summary).
   - **Footer:** **Edit design** and **Use this template** — native **`<button type="button" disabled>`** plus visible “Coming soon” (or `title`). **Do not** duplicate `aria-disabled` on truly disabled buttons. **No** calls to `setSelectedPresetId`, generate-slides, or navigation until a later phase.
4. **Close** modal — project preset unchanged (same rule as today).
5. **Keyboard / backdrop (spec explicitly):** **Escape** — if `view === 'detail'`, first **return to grid** (`onBack`); if already on grid, **close modal**. **Backdrop click** on scrim — **close entire modal** (including from detail) to match typical modal UX; document in code comment so QA is consistent.

#### Changes (by area)

1. **`HtmlPresetGallery` (incremental on top of 17C):**
   - Support **`onOpenPresetDetails(preset: HtmlDesignPreset)`**. **`PresetCard` is currently a single `<button>`** — avoid **button inside button**: use a **card container** (`<div role="button">` + keyboard handler) **or** split into wrapper + **Details** / preview controls that are separate focusable elements. Document the chosen pattern in a file-level comment.
   - Keep existing filter/search behavior.

2. **New component (recommended):** `HtmlTemplateDetailView.tsx` (or `HtmlTemplateDetailPanel.tsx`) under `src/features/html-editor/components/`:
   - Owns header, pills, **accessible custom tabs** (see above), example carousel, **single-slide or lazy** HTML previews, footer disabled buttons.
   - Accepts `preset: HtmlDesignPreset`, `locale` (default `en`), `onBack`.

3. **`HtmlTemplatesBrowseModal.tsx`:**
   - State: `view: "grid" | "detail"` and `detailPreset: HtmlDesignPreset | null`.
   - Compose gallery + detail; **reset `view` + `detailPreset` when modal closes** and when **`htmlTemplatesBrowseModalOpen` goes false** from the shell (e.g. project change) so hidden-but-mounted trees do not leak detail state.

4. **Shared preview helper (optional but DRY):**
   - Small **`HtmlPresetSlidePreview.tsx`** — isolated iframe + `htmlDocumentWrapper` / dimension scaling from `HTML_SLIDE_DIMENSIONS[preset.aspectRatio]` — reuse anywhere we preview preset HTML.

5. **Section/tab structure (original 17F scaffold):**
   - "All Templates" / "Featured" / "My Templates" / "Favorites" as in the prior 17F spec; placeholders for My Templates / Favorites.

6. **Data model readiness (unchanged):**
   - `workspaceId` / `userId` on type; API ready to merge account-level presets later.

**Done when:**

- User can open browse → open **detail** for any loaded preset → switch **Example results** / **Design structure** → see real data when `exampleImages` and `templates` are populated.
- Footer primary actions are visible and **not** interactive (`disabled` + copy).
- **Back** returns to grid; **Escape** returns to grid from detail then closes from grid; **backdrop** closes modal (see UI flow §5). No accidental project preset mutation.
- **Iframe sandbox** documented after testing at least one Mirr-tech and one system preset (`wrapHtmlDocument` already strips scripts).

## 5. Files Expected to Change (Complete List)

### Core Model

| File | Phase | What changes |
|------|-------|-------------|
| `src/features/html-editor/lib/presets.ts` | 17A | Type refactor, rename role→pageType, widen aspectRatio, fix exampleImages shape. Becomes `presets/index.ts` in 17C. |
| `src/features/html-editor/lib/presets/business.ts` | 17C | New file — business category presets |
| `src/features/html-editor/lib/presets/marketing.ts` | 17C | New file |
| `src/features/html-editor/lib/presets/design.ts` | 17C | New file |
| `src/features/html-editor/lib/presets/tech.ts` | 17C | New file |
| `src/features/html-editor/lib/presets/education.ts` | 17C | New file |
| `src/features/html-editor/lib/presets/lifestyle.ts` | 17C | New file |

### API

| File | Phase | What changes |
|------|-------|-------------|
| `src/app/api/editor/html-projects/presets/route.ts` | 17A | Response shape alignment |
| `src/app/api/editor/html-projects/generate-slides/route.ts` | 17A | `role` → `pageType` in prompt builder and page type derivation |

### Client

| File | Phase | What changes |
|------|-------|-------------|
| `src/features/html-editor/services/htmlProjectsApi.ts` | 17A | Type update for `listHtmlPresets` |
| `src/features/html-editor/components/HtmlPresetGallery.tsx` | 17C | Full rebuild with search, filters, image cards |
| `src/features/html-editor/components/HtmlEditorWorkspace.tsx` | 17C | Layout adjustments if needed |
| `src/features/html-editor/components/HtmlEditorShell.tsx` | 17A | Any type-level updates from the refactor |
| `src/features/html-editor/components/HtmlTemplatesBrowseModal.tsx` | **17F** | Grid vs detail state; compose `HtmlTemplateDetailView` |
| `src/features/html-editor/components/HtmlTemplateDetailView.tsx` | **17F** | **New** — tabs, example carousel, HTML slide previews, disabled footer |
| `src/features/html-editor/components/HtmlPresetSlidePreview.tsx` | **17F** | **New (optional)** — sandboxed iframe preview for one preset slide |
| `src/features/html-editor/lib/htmlDocumentWrapper.ts` | **17F** | Use `wrapHtmlDocument` + `HTML_SLIDE_DIMENSIONS` for detail-tab previews (import-only unless wrap behavior must change) |

### Database

| File | Phase | What changes |
|------|-------|-------------|
| New migration: `is_visible` column | 17A | `ALTER TABLE html_design_presets ADD COLUMN is_visible boolean NOT NULL DEFAULT true` |
| Updated seed migration or new seed | 17C | Seed rows for all new presets |

### Docs

| File | Phase | What changes |
|------|-------|-------------|
| `docs/HTML_MIRR_PARITY_GAP_ANALYSIS.md` | 17A | Update Phase 17 section, move old 17 to 18 |
| `docs/HTML_TEMPLATE_TYPE_IMPLEMENTATION_PLAN.md` | **17F** | Phase 7 **follow-on** subsection cross-links to this doc (§4 Phase 17F, §9 checklist) |
| `docs/TEMPLATE_SYSTEM_PARITY_PLAN.md` | **17F** | §9 working checklist updated as implementation proceeds |

## 6. What We Are NOT Building in Phase 17

These are explicitly out of scope:

- Custom template creation/training UI
- Template import from reference images
- AI-powered template recommendation (`match-template`)
- Full localization (translated names/descriptions)
- History tab
- DB-backed preset serving (we keep code canonical for speed)
- Favorites persistence (UI scaffold only)

**Explicitly in scope for 17F:** the **template detail** UI including **Edit design** / **Use this template** as **visible, disabled** affordances with clear “Coming soon” messaging — **no** backend or store wiring for those actions until a later phase.

## 7. Post-Exhaustive-Audit Additions

The following items were discovered during a complete pass through all three HAR files and were NOT in the original plan. They must be incorporated.

### 7a. Two Missing Slot Types: `icon` and `profile`

Mirr templates use 5 slot types, not 3:

| Slot Type | Template occurrences | Description | Our support |
|-----------|---------------------|-------------|-------------|
| `main` | 693 | Primary content images | Yes |
| `background` | 472 | Full-bleed background images | Yes |
| `icon` | 137 | 3D shapes, decorative icons, abstract elements | **Missing** |
| `logo` | 77 | Brand logos | Yes |
| `profile` | 63 | Headshots, author photos | **Missing** |

**Action:** Widen `data-slot-type` schema to `"background" | "main" | "logo" | "icon" | "profile"`. Update parser, serializer, inspector, and generation prompt.

### 7b. Templates Are Full HTML Documents

All 1,670 of Mirr's templates are complete `<!DOCTYPE html>` documents with `<head>`, `<style>` blocks, `@import` for Google Fonts, and `<body>`. They use 200+ CSS class names (`.speech-bubble`, `.browser-window`, `.wireframe-globe`, `.chart-container`, `.toggle-switch`, etc.).

Our 5 templates are HTML fragments starting with `<link>` and `<div>` — no `<style>` blocks, no class-based styling, only inline styles and the `image-slot` class.

**Action:** New templates created in Phase 17C should adopt the full-document format with `<style>` blocks and class-based styling. Our `htmlDocumentWrapper.ts` already strips document boilerplate during wrapping. The parser and serializer should be verified to work with class-based elements, not just inline-styled ones.

### 7c. Missing `9:16` Aspect Ratio in Dimension Map

`HTML_SLIDE_DIMENSIONS` currently maps `1:1`, `3:4`, `4:5`, `16:9` but is missing `9:16` (1080x1920). Mirr has 218 templates at 9:16 and 43 presets for that ratio.

**Action:** Add `"9:16": { width: 1080, height: 1920 }` to the dimension map. Update the `HtmlAspectRatio` type to include `"9:16"`.

### 7d. Generation Record Metadata

Mirr's save response (PATCH generations) reveals per-generation metadata we don't track:

| Field | Purpose | Priority |
|-------|---------|----------|
| `presetName` | Display name of the used preset | Low — can be looked up from presetId |
| `renderedImageUrls` | Per-page JPEG URLs for thumbnails/sharing | Deferred — needs `format: "storage"` render mode |
| `thumbnailUrl` | Generation thumbnail | Deferred |
| `renderedVideoUrl` | Video version of carousel | Deferred |
| `mode` | Generation mode ("follow") | Low |
| `isPublic` / `viewCount` | Sharing/analytics | Deferred |

**Action:** Note these in the deferred items registry. No immediate action needed.

### 7e. Render API `format: "storage"` Mode

Mirr's render-html API supports `format: "storage"` which renders pages to persistent image URLs (not a downloadable ZIP). This powers thumbnails, social posting, and the carousel example images.

**Action:** Note for future. Our render route currently only supports `format: "zip"`. Adding `format: "storage"` would enable preview image generation for the preset gallery (Phase 17D) and eventually social posting.

### 7f. 1,394 Unique Slot Labels

Mirr's templates use highly descriptive, semantically meaningful slot labels ("3D Abstract Shape", "Cover Background Image", "Gallery Image 1", "Mood Image", etc.). These serve both as UI labels and as AI context during generation and refinement.

**Action:** New templates should use descriptive, specific labels. This is a content quality standard, not a code change.

## 8. Revised Execution Order

1. **Phase 17A** — Data Contract Refactor
2. **Phase 17B** — Class-Based Template Compatibility
3. **Phase 17C** — Gallery Rebuild
4. **Phase 17D** — Catalog Expansion
5. **Phase 17E** — Preview Image Generation
6. **Phase 17F** — Entry Surface + Template Detail (Mirr-style browse → two-tab detail, disabled CTAs)

**Why this is the exact order I would actually implement from:**

- **17A first** because the type / contract mismatch (`role` vs `pageType`, ratio widening, example image shape, metadata widening) affects every later phase.
- **17B second** because the current editor must prove it can safely ingest Mirr-style full-document presets before we scale the catalog or polish the browser UI.
- **17C third** because a better gallery only matters once the underlying preset contract is stable and compatibility risks are addressed.
- **17D fourth** because scaling the catalog is only useful after both the contract and the gallery can handle it.
- **17E fifth** because preview generation depends on having presets worth rendering and requires a dedicated preset-preview rendering path, not just the existing project export route.
- **17F last** because the Mirr-style **detail sheet** is primarily **presentation and navigation** on top of the catalog and preview assets; it should land after the contract (17A), compatibility (17B), gallery filters (17C), catalog volume (17D), and first-party previews (17E) so the two tabs always have meaningful content for most presets.

After Phase 17F, the template system should support the same **data model direction**, **document structure expectations**, and **browsing architecture** as Mirr — including the **two-tab template detail** experience. The remaining gap will still be wiring **Use this template** / **Edit design**, catalog scale (Mirr has 366, first pass will be smaller), and advanced features like custom training, AI recommendation, and deeper history/localization work.

The old Phase 17 (Media & Asset Parity) becomes **Phase 18** and follows unchanged.

---

## 9. Active implementation plan — Template detail (17F)

Use this section as the **working checklist** while implementing. Check items off in PR descriptions or local notes.

### Goal (one sentence)

Ship **Browse templates → template detail → Example results | Design structure** inside `HtmlTemplatesBrowseModal`, with **Edit design** / **Use this template** **disabled**, without changing the project’s selected preset.

### Preconditions

- `HtmlDesignPreset` includes `templates[]`, `exampleImages`, `styleGuide`, `aspectRatio` (already true post–17A-style types).
- `listHtmlPresets()` returns merged catalog (system + imports + DB overlay). Response remains `{ success, presets }` — **no rename to `data` required** for v1 (`listHtmlPresets` reads `data?.presets`).
- **Tabs:** repo has **no** `@radix-ui/*` — implement **custom accessible tabs** (toggle buttons + ARIA). Do not add Radix unless product explicitly approves a new dependency.

### Implementation risks (read before coding)

| Risk | Mitigation |
|------|------------|
| **Nested buttons** | `PresetCard` is one `<button>` today; refactor to non-nested pattern before adding Details (see §4 Phase 17F gallery bullet). |
| **N iframes** | Design tab: **one active iframe** + `key={slideIndex}` or lazy mount — do not render all slides at once. |
| **Sandbox vs fonts** | Start with restrictive `sandbox` (no `allow-scripts`). Test Google Fonts / `@import` on one Mirr-tech + one system preset; document shipped flags. Wrong layout if JS was required is acceptable for v1. |
| **wrapHtmlDocument edge cases** | Full Mirr documents may look off after strip/inject; budget 1–2 preset-specific fixes only if observed. |
| **Focus trap** | Browse modal is **not** a full focus trap today — **do not claim** full trap in v1 unless implemented. **Do** implement correct **tab roles**; keep **Escape** handling per §4 UI flow §5. |

### Implementation sequence

| Step | Task | Notes |
|------|------|--------|
| 1 | **Modal state** — `view: 'grid' \| 'detail'`, `detailPreset` | Reset when modal closes **and** when `open` goes false (shell-driven), not only on unmount |
| 2 | **Gallery → detail** — `onOpenPresetDetails` | Pass full `HtmlDesignPreset`; fix card markup to avoid nested `<button>` |
| 3 | **`HtmlTemplateDetailView`** — layout shell | Header, pills, **custom tabs**, footer |
| 4 | **Example tab** | `exampleImages[locale]`; frame aspect from **`HTML_SLIDE_DIMENSIONS[preset.aspectRatio]`**; plain `<img>` |
| 5 | **Design tab** | **Single** preview iframe (or lazy); `wrapHtmlDocument` + scale; `pageType` badge; prev/next over `templates` |
| 6 | **Style guide strip** | Swatches + `designPatterns` + fonts |
| 7 | **Footer** | `<button disabled>` + visible “Coming soon”; **no** redundant `aria-disabled` |
| 8 | **Escape / backdrop** | Escape: detail → grid → close. Backdrop scrim: always close modal (document in code) |
| 9 | **Empty example images** | Placeholder copy |
| 10 | **QA** | Imported preset + system preset; font/sandbox sanity |

### Files (authoritative list for this slice)

| File | Action |
|------|--------|
| `src/features/html-editor/components/HtmlTemplatesBrowseModal.tsx` | Edit — dual view state, wire gallery callback, Escape/backdrop behavior |
| `src/features/html-editor/components/HtmlPresetGallery.tsx` | Edit — `onOpenPresetDetails`; **refactor card** to avoid nested buttons |
| `src/features/html-editor/components/HtmlTemplateDetailView.tsx` | **Add** |
| `src/features/html-editor/components/HtmlPresetSlidePreview.tsx` | **Add** (optional; can inline in detail view first) |
| `package.json` | **No change** for tabs (no Radix) unless team approves |

**No change required** for parity of *data shape*: `src/app/api/editor/html-projects/presets/route.ts` already serves full `templates` and `exampleImages` from code + DB merge.

### Follow-on (not 17F)

- Enable **Use this template**: set editor `selectedPresetId`, close modal, optional `generate-slides` or “apply template” flow — coordinate with `HtmlEditorShell` / store actions.
- Enable **Edit design**: navigate to HTML editor with preset loaded or open inline editor — product decision.
- Locale switcher for `exampleImages` (`en` / `ko`) when localization is prioritized.
