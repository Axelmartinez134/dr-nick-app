# HTML Template Type — Architecture Plan

> **Reference material location:** `mirr-extracted/` contains 61 JS chunks + 29 API response files extracted from Mirr's production carousel editor (captured via HAR on 2026-04-04). The iframe interaction script is in `Mirr (formerly Mirra)...(Lazy Load)_files/saved_resource(8).html`. The PageEditor component is in `mirr-extracted/91738-214cfdb0a42f25ed.js`.

## 1. What This Is

A new project type (`html`) alongside `regular` and `enhanced` that uses a fundamentally different visual rendering pipeline. Instead of Fabric.js canvas rendering with deterministic layout, the AI generates **complete HTML documents per slide** that are rendered in iframes, edited via an element-level property editor, and exported via server-side screenshot.

### Why This Approach

This architecture is used by Mirr (mirra.my), Claude Artifacts, and Claude's Inline Visuals. The pattern is: AI writes complete HTML → render in sandboxed iframe → user edits the result directly → export via screenshot. Future prompt-based refinement can be layered on later. It produces dramatically more diverse visual designs than our current template-zone + Fabric.js system because the AI has full creative freedom to write any HTML/CSS layout.

### How This Differs From Regular/Enhanced

| Aspect | Regular/Enhanced (current) | HTML (new) |
|--------|---------------------------|------------|
| Slide representation | JSON layout tree (`VisionLayoutDecision`) | Complete HTML document string |
| Rendering engine | Fabric.js on `<canvas>` | `<iframe>` with `document.write()` |
| Layout computation | Deterministic `wrapFlowLayout` + font metrics | AI writes layout directly as CSS |
| Template system | Template IDs → content insets/zones | Full HTML documents as style references |
| Text editing | Fabric.js IText/Textbox objects | `contentEditable` directly in iframe DOM |
| Element manipulation | Fabric object transforms (drag/scale/rotate) | CSS `transform: translate()` + inline style mutations |
| Export | Client-side `fabricCanvas.toDataURL()` | Server-side Puppeteer screenshot |
| Copy generation | Poppy/Anthropic → headline + body text | Shared copy-generation infrastructure (Path B hybrid), but html branches explicitly |
| Visual generation | Deterministic layout from text + template | AI generates HTML from text + preset style guide |

### Design Principles

- **Editor identity stays, runtime splits.** `html` projects should still feel like the same product surface: same route, same left sidebar, same dotted workspace feel, same centered slide area, same top chrome, same bottom-first workflow. But the runtime that powers the editor is different enough that HTML gets a dedicated shell.
- **Dedicated HTML runtime.** All HTML rendering, parsing, iframe interaction, serialization, generation, and export behavior lives in new files under `src/features/html-editor/` and `src/app/api/editor/html-projects/`.
- **Legacy Fabric runtime preserved for now.** The current `src/app/editor/EditorShell.tsx` remains the Regular/Enhanced runtime in v1 to avoid disrupting existing users. A thin router decides whether to mount the legacy Fabric shell or the new HTML shell before any Fabric-specific hooks run.
- **Shared paths still require targeted edits.** Type definitions, creation routes, project bootstrap/load paths, shell selection, top-bar export wiring, and template-type guards require changes in existing files as listed in §3. Entry-point pickers are one shared touchpoint, but not the only one.
- **Hybrid workspace layout.** For `html` projects, the center workspace uses iframe-based slide rendering, a dedicated HTML bottom panel for project-level tools, and a right-side inspector for selected-element editing. This is an addition to the existing editor product, not a new app inside the app.

---

## 2. The Pipeline (End to End)

```
EXISTING (unchanged)                      NEW (html type only)
─────────────────────                     ────────────────────
Swipe File / Ideas / Map
    │
    ├── template_type_id = "regular"  → existing pipeline
    ├── template_type_id = "enhanced" → existing pipeline
    └── template_type_id = "html"     → NEW pipeline below

Daily Digest remains Regular-only in v1.

Step 1: Create Project
    POST /api/editor/projects/create
    { templateTypeId: "html" }
    → inserts carousel_projects row
    → inserts 6 carousel_project_slides
    → additionally inserts html_project_slides
      placeholders (new table, see §4)

Step 2: Generate Copy (shared infrastructure, html-specific branch)
    POST /api/editor/projects/jobs/
    generate-copy
    → Shared creation modals still show a
      prompt picker for html
    → In v1, html resolves prompt content
      from the Regular saved-prompt pool
      behind the scenes
    → Produces an explicit html copy draft
      shape (not regular/enhanced payload)
    → Does NOT generate caption in v1;
      caption remains a separate project-
      level field/editor surface
    → Reuses shared Anthropic/Poppy
      infrastructure where helpful
    → MUST branch explicitly for html;
      must NOT silently coerce html to
      regular/enhanced semantics
    → Writes to carousel_project_slides
    → Caption/debug workflow stays in the
      bottom project tools area
    → NOTE: This is a deliberate divergence
      from Mirr. Mirr generates from the raw
      structured content in one generation
      flow. Our V1 keeps copy generation and
      HTML visual generation as two steps so
      we can reuse the existing copy pipeline.

Step 3: Pick Preset
    User chooses from built-in HTML presets
    seeded by us ahead of time
    → preset contains reference HTML +
      style guide
    → stored on project row as
      html_preset_id / html_style_guide
    → NOTE: Mirr also has a server-side
      preset-matching step before generation;
      V1 intentionally skips that and uses
      explicit manual preset selection

Step 4: Generate HTML Slides (NEW)
    POST /api/editor/html-projects/
    generate-slides
    → Takes html copy draft converted into
      `PROJECT_TITLE` / `CAROUSEL_TEXTLINES`
      + preset style guide + reference templates
    → AI generates complete HTML per slide
    → Writes html to html_project_slides
    → Streams progress via SSE

Step 5: Preview & Edit
    Client renders each slide in a
    scaled <iframe> inside the existing
    dotted workspace
    → Right-side inspector edits the
      currently selected element
    → Bottom panel remains for project-
      level tools (caption, logs, copy)
    → AI Designer tab is visible but
      disabled in V1

Step 6: Save & Export
    PATCH /api/editor/html-projects/
    save-slides
    → persist edited HTML

    POST /api/editor/html-projects/render
    → Server-side Puppeteer renders
      HTML → PNG/JPEG
    → Returns ZIP or single image
```

### Verified Pipeline Facts (from `Prompt.har` + Mirr captures)

The following parts of the HTML pipeline are **verified from captured Mirr traffic and shipped assets**, not guessed:

- **Generation request contract:** Mirr sends `presetId`, `content`, `mode`, `outputLanguage`, `enableImageSearch`, and `slideCount` to `generate-content-stream`
- **Content format:** the `content` field is a structured string starting with `PROJECT_TITLE:` followed by `CAROUSEL_TEXTLINES:` and per-slide `SLIDE N (textLines):` sections
- **Generation response contract:** Mirr streams SSE events in the order `status` → `status` → `page` (repeated) → `complete`
- **Per-page payload:** each `page` event contains `pageIndex`, `totalPages`, and `page: { pageNumber, title, html, needsImage, ... }`
- **Refinement request contract:** Mirr sends `html`, `prompt`, `aspectRatio`, optional `imageUrl`, and optional `manualEdits` to `refine-page`
- **Save contract:** Mirr saves full generated pages back to a generation record via `generatedPages: [{ pageNumber, title, html }]`
- **Render contract:** Mirr renders HTML to images via `render-html`, primarily using a `pages[] + aspectRatio + format` request shape
- **Editor/runtime contract:** Mirr renders slides in an iframe, parses HTML on the parent side, injects `data-editable-id`, uses `.image-slot` / `data-slot-*` metadata, and communicates via `postMessage`

### What Is Still Unknown

The following parts are **not recoverable from shipped client assets or the current HAR captures**:

- the literal hidden backend system prompt sent from Mirr's server to Anthropic or another provider
- the exact backend prompt-assembly code that merges preset HTML, style guide, and copy into provider-facing messages
- the exact backend validation logic used before or after model output

This means our plan can copy Mirr's **browser ↔ app-server contract** nearly verbatim, but the final provider-facing prompt still has to be reconstructed unless we capture new evidence.

---

## 3. Isolation Strategy — What Changes vs. What's New

> **IMPORTANT:** The file list below is NOT exhaustive. Every shared path that narrows `TemplateTypeId`, hydrates project data, boots the editor, queues Fabric layout, or exports canvases must either be updated for `"html"` or explicitly bypassed. A codebase grep for `TemplateTypeId`, `templateTypeId`, `template_type_id`, and hardcoded `"regular" | "enhanced"` unions found **66 files** that reference these. The tables below categorize all files that need changes.

### Runtime Ownership Boundaries (v1)

- **Shared product shell stays shared.** Route entry, auth/account resolution, project list/sidebar, and overall editor identity remain part of the same `/editor` product surface.
- **A thin runtime router decides shell ownership before mount.** Add a small router component that reads the bootstrap-resolved `templateTypeId` and decides whether to mount the legacy Fabric runtime or the new HTML runtime. This decision must happen before any Fabric-specific hooks are invoked.
- **No flash of the wrong shell.** Because the store currently defaults `templateTypeId` to `"regular"`, the router must show a neutral loading state (blank workspace, spinner, or skeleton) until bootstrap/load has resolved the actual project type. It must NOT mount either shell based only on the store default.
- **`EditorShell.tsx` remains the legacy Fabric runtime for now.** In v1 it continues to own `regular` and `enhanced` only. We are intentionally not extracting/refactoring that runtime yet because it would create unnecessary risk for existing users.
- **`HtmlEditorShell.tsx` owns the HTML runtime.** It owns html-specific workspace rendering, html bottom panel, iframe preview lifecycle, selected-element inspector wiring, html save/export actions, and html-specific state orchestration.
- **Future breadcrumb / rename plan.** When the router file and `HtmlEditorShell.tsx` are implemented, add an explicit code comment/TODO noting that the current `EditorShell.tsx` is a temporary legacy Fabric runtime and should later be renamed/extracted to `FabricEditorShell.tsx`. That rename is intentionally out of scope for v1.

### A. Type Definition Changes

| File | Change |
|------|--------|
| `src/features/editor/store/types.ts` | **Canonical client type.** `export type TemplateTypeId = "regular" \| "enhanced" \| "html"` |
| `src/app/api/editor/_utils.ts` | Server-side — add `"html"` to any local type aliases |

### B. Creation / Entry Point Routes (add `"html"` to validation allowlist)

| File | Change |
|------|--------|
| `src/app/api/editor/projects/create/route.ts` | Allow `"html"` in validation. Skip `loadEffectiveTemplateTypeSettings` for html. Branch to also insert `html_project_slides` rows. |
| `src/app/api/swipe-file/items/[id]/create-project/route.ts` | Allow `"html"` in validation |
| `src/app/api/editor/ideas/create-carousel/route.ts` | Allow `"html"` in validation |
| `src/app/api/carousel-map/[mapId]/create-project/route.ts` | Allow `"html"` in validation |
| `src/app/api/daily-digest/topics/[id]/create-carousel/route.ts` | **Decision for v1:** leave Digest → html out of scope. This route remains Regular-only unless a later scoped change explicitly adds digest → html support. |

### C. Template Type Picker UI (add `"html"` as selectable option)

| File | Change |
|------|--------|
| `src/features/editor/components/EditorSidebar.tsx` | Add `"html"` option to template type `<select>` |
| `src/features/editor/components/SwipeIdeasPickerModal.tsx` | Add `"html"` option. Keep the saved-prompt selector visible for html; in v1 it should resolve against the Regular prompt pool behind the scenes instead of requiring html-specific prompt rows. |
| `src/features/editor/components/CarouselMapProjectPickerModal.tsx` | Add `"html"` option. Keep the saved-prompt selector visible for html; in v1 it should resolve against the Regular prompt pool behind the scenes instead of requiring html-specific prompt rows. |
| `src/features/editor/components/CarouselMapModal.tsx` | **CRITICAL:** Has its own `useState<"regular" \| "enhanced">`, localStorage restore, and create-project coercion logic. Must widen local type to include `"html"` and remove any binary ternary that collapses html to enhanced. |
| `src/features/editor/components/IdeasModal.tsx` | Add `"html"` option to `carouselTemplateType`. If this modal shows prompt-selection UI for html flows, keep that UI visible and back it with the same v1 html → Regular prompt-pool rule. |
| `src/features/editor/components/SwipeFileModal.tsx` | **CRITICAL:** `useState<"enhanced" \| "regular">` and localStorage fallback force unknown values to `"enhanced"`. Widen type to include `"html"`. |

### D. Editor Shell / Workspace Branching

| File | Change |
|------|--------|
| `src/app/editor/EditorRuntimeRouter.tsx` | **NEW shared router.** Waits for bootstrap/load to resolve the actual `templateTypeId` before mounting an editor runtime. Shows a neutral loading state until then. Renders legacy `EditorShell.tsx` for `regular`/`enhanced`; renders `HtmlEditorShell.tsx` for `html`. Add TODO comment that this router should later point to `FabricEditorShell.tsx` once Regular/Enhanced are extracted from `EditorShell.tsx`. |
| `src/app/editor/EditorShell.tsx` | **Temporary legacy Fabric runtime in v1.** Keep current behavior for `regular`/`enhanced`. Do NOT mount it for html. Add a breadcrumb comment/TODO that this file is expected to be renamed/extracted to `FabricEditorShell.tsx` in a later refactor. |
| `src/features/html-editor/HtmlEditorShell.tsx` | **NEW dedicated html runtime shell.** Owns html workspace composition: active slide stage, html slides strip, html bottom panel, right-side inspector, html-specific actions wiring, and html-only hook graph. |

### E. Boot / Load / Hydration (prevent silent coercion to "regular")

| File | Change |
|------|--------|
| `src/app/api/editor/initial-state/route.ts` | **CRITICAL:** Line 68 silently drops unknown `templateTypeId` to `"regular"`. Must accept `"html"` and skip template-type-settings loading for it. |
| `src/app/api/editor/projects/load/route.ts` | Must additionally return `html_project_slides`, `html_preset_id`, `html_style_guide`, and generation status when project is `html` type. |
| `src/app/api/editor/projects/set-template-type/route.ts` | **CRITICAL:** Line 33 rejects anything not `"regular"` or `"enhanced"`. Must either add `"html"` to the allowlist or (recommended for v1) **block switching to/from "html"** with a clear 400 error, since the storage models are incompatible. |
| `src/features/editor/store/EditorStoreProvider.tsx` | Defaults `templateTypeId: "regular"` and `newProjectTemplateTypeId: "enhanced"`. Must not coerce loaded html projects. |
| `src/features/editor/hooks/useEditorBootstrap.ts` | Auto-creates an `"enhanced"` project when no projects exist. Must not auto-create html. Must accept html projects from load without coercion. |
| `src/features/editor/hooks/useProjectLifecycle.ts` | Coerces loaded/created project types to `regular\|enhanced`. Must pass `"html"` through unmodified. |
| `src/features/editor/services/projectsApi.ts` | Types project creation as `regular\|enhanced` only. Widen. |

### F. Fabric-Specific Hooks (must be SKIPPED for html, not modified)

These hooks are Fabric.js-only. They must NOT run when `templateTypeId === "html"`. The runtime router must ensure the legacy `EditorShell.tsx` never mounts for html projects, which means these hooks stay inside the legacy Fabric runtime and do not need html-specific behavior added to them in v1.

| File | Why it must be skipped |
|------|----------------------|
| `src/features/editor/hooks/useFabricCanvasBinding.ts` | Mounts Fabric canvas objects |
| `src/features/editor/hooks/useLiveLayoutQueue.ts` | Deterministic Fabric layout queue |
| `src/features/editor/hooks/useCanvasExport.ts` | `fabricCanvas.toDataURL()` export |
| `src/features/editor/hooks/useImageOps.ts` | Fabric image placement/transforms |
| `src/features/editor/hooks/useAutoRealignOnImageRelease.ts` | Fabric layout reflow |
| `src/features/editor/hooks/useGenerateAiImage.ts` | AI image → Fabric placement |
| `src/features/editor/hooks/useGenerateImagePrompts.ts` | Image prompt → Fabric |
| `src/features/editor/components/EditorSlidesRow.tsx` | Fabric slide rendering |
| `src/features/editor/components/EditorBottomPanel.tsx` | Fabric controls + caption |

### G. Job / Copy Generation (must branch for html)

| File | Change |
|------|--------|
| `src/features/editor/hooks/useGenerateCopy.ts` | Normalizes output to `regular\|enhanced` and enqueues Fabric live layout. For html: skip live layout, emit copy-ready signal for HTML slide generation, and treat html as a first-class branch rather than aliasing it to regular/enhanced. |
| `src/features/editor/hooks/useEditorJobs.ts` | Wires copy/image jobs assuming Fabric. Must branch for html. |
| `src/features/editor/hooks/useEditorStoreActionsSync.ts` | Types `createNewProject`, `newProjectTemplateTypeId`, and prompt-library actions as `regular\|enhanced`. Widen. |
| `src/app/api/carousel-map/_lib.ts` | **Decision for v1:** do NOT add an html-specific expansion-prompt branch. Carousel Map expansion remains an upstream content/ideation step. Html project creation from a chosen expansion uses the expansion/copy that already exists, then hands off to the html-specific downstream flow (`generate-copy` branch + `generate-slides`). |
| `src/app/api/editor/projects/jobs/generate-copy/route.ts` | Line coerces `template_type_id` with ternary: `=== 'enhanced' ? 'enhanced' : 'regular'`. Must accept `"html"` as an explicit branch. Reuse shared copy-generation infrastructure where helpful, but do NOT silently coerce html to regular/enhanced semantics. |
| `src/app/api/editor/projects/jobs/start/route.ts` | **Decision for v1:** html does NOT use this route. It remains part of the Fabric job orchestration path only. Document and preserve that separation instead of widening this route unnecessarily. |
| `src/app/api/editor/projects/_effective.ts` | Template type settings resolution. Must return safe defaults for html (no template snapshots exist). |

### H. Top Bar / Export / Mobile

| File | Change |
|------|--------|
| `src/features/editor/components/EditorTopBar.tsx` | "Download All" / "Download PDF" dispatch Fabric export actions. For html: dispatch HTML render/export actions instead. |
| `src/features/editor/components/MobileSaveSlidesPanel.tsx` | Phone editing is out of scope for v1. For html: show a "Desktop only" message rather than trying to wire a partial mobile editing/export flow. |
| `src/features/editor/components/SavedProjectsCard.tsx` | References templateTypeId for project listing display. Must accept html. |

### I. Template Type Settings System (explicit decision required)

| File | Decision |
|------|----------|
| `carousel_template_types` table | **Decision for v1:** HTML does NOT participate in the prompt-override system. No row needed in `carousel_template_types`. All code paths that call `loadEffectiveTemplateTypeSettings` must early-return safe defaults when `templateTypeId === "html"`. |
| `carousel_template_type_overrides` table | No overrides for html. |
| `editor_poppy_saved_prompts` table | HTML does NOT semantically inherit `regular` or `enhanced`. However, in v1, shared picker/create flows should keep the saved-prompt UI visible for html and resolve prompt content from the **Regular** saved-prompt pool behind the scenes. No html-specific prompt rows are required in v1 unless later evidence or product needs justify them. All routes must still branch explicitly on `html` rather than ternary-coercing the project type. |

### Completely NEW files (isolated feature)

```
src/features/html-editor/              ← entire new feature directory
├── components/
│   ├── HtmlEditorShell.tsx             ← dedicated html runtime shell
│   ├── HtmlEditorWorkspace.tsx         ← replaces workspace body for html type
│   ├── HtmlSlidePreview.tsx            ← iframe-based slide preview
│   ├── HtmlSlidesStrip.tsx             ← horizontal slide navigation strip
│   ├── HtmlElementEditor.tsx           ← right sidebar: element property editor
│   ├── HtmlElementList.tsx             ← collapsible element list
│   ├── HtmlAiDesigner.tsx              ← visible-but-disabled future AI Designer shell
│   ├── HtmlPresetGallery.tsx           ← design preset selection modal
│   ├── HtmlFontSelector.tsx            ← font picker with Google Fonts search
│   ├── HtmlAddElementBar.tsx           ← "Add element: Text | Image | Logo"
│   └── HtmlBottomPanel.tsx             ← html-specific project tools surface
├── hooks/
│   ├── useHtmlSlideRenderer.ts         ← iframe rendering pipeline (font inject, document wrap, cache)
│   ├── useHtmlElementParser.ts         ← parse HTML → editable element list
│   ├── useHtmlElementSerializer.ts     ← serialize element changes back to HTML
│   ├── useHtmlSlideGeneration.ts       ← SSE client for generate-slides
│   ├── useHtmlSlideExport.ts           ← server-side render + download
│   └── useHtmlDragResize.ts            ← overlay-based element drag/resize
├── store/
│   ├── htmlEditorStore.ts              ← Zustand store for html editor state
│   └── types.ts                        ← HtmlSlide, HtmlElement, HtmlPreset, etc.
├── lib/
│   ├── fontOptimizer.ts                ← font injection, system font blocking, Google Fonts
│   ├── htmlDocumentWrapper.ts          ← wraps HTML in full document with overflow/font CSS
│   └── elementParser.ts                ← DOM parsing: HTML string → element tree
└── services/
    └── htmlProjectsApi.ts              ← API client for all html-project endpoints

src/app/api/editor/html-projects/      ← new V1 API routes
├── generate-slides/
│   └── route.ts                        ← AI generates HTML slides from copy + preset
├── render/
│   └── route.ts                        ← Puppeteer: HTML → PNG → ZIP
├── save-slides/
│   └── route.ts                        ← persist edited HTML to DB
└── presets/
    ├── route.ts                        ← list built-in presets
    └── [id]/
        └── route.ts                    ← get preset detail

supabase/migrations/
└── YYYYMMDD_add_html_template_type.sql ← new tables + enum update

src/app/editor/
└── EditorRuntimeRouter.tsx             ← shared runtime selector (legacy Fabric shell vs HtmlEditorShell)
```

---

## 4. Database Schema

### Migration (runs top-to-bottom in a single file)

```sql
-- Allow 'html' as a template_type_id value.
-- carousel_projects.template_type_id is TEXT (not an enum), so no ALTER TYPE needed.
-- Validation is enforced in app code only.

-- ============================================================
-- 1. html_design_presets MUST be created FIRST because
--    carousel_projects.html_preset_id references it.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.html_design_presets (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id            UUID REFERENCES public.editor_accounts(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  localized_name        JSONB,                          -- e.g. { "en": "...", "ko": "..." }
  description           TEXT,
  localized_description JSONB,                          -- e.g. { "en": "...", "ko": "..." }
  aspect_ratio          TEXT NOT NULL DEFAULT '4:5',
  templates             JSONB NOT NULL,                  -- array of { html: string }, 1-10 per preset
  style_guide           JSONB NOT NULL DEFAULT '{}'::jsonb, -- { fontFamily, primaryColor, secondaryColor, accentColor, backgroundColor, designPatterns[] }
  is_system             BOOLEAN NOT NULL DEFAULT false,
  is_featured           BOOLEAN NOT NULL DEFAULT false,
  featured_order        INTEGER,
  category              TEXT,                            -- "business" | "design" | "education" | "lifestyle" | "marketing" | "tech" | null
  example_images        JSONB,                           -- per-language screenshot URLs, e.g. { "en": ["url"], "ko": ["url"] }
  thumbnail_url         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS html_design_presets_system_idx
  ON public.html_design_presets (is_system, category) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS html_design_presets_account_idx
  ON public.html_design_presets (account_id) WHERE account_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.html_design_presets_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER html_design_presets_updated_at
  BEFORE UPDATE ON public.html_design_presets
  FOR EACH ROW EXECUTE FUNCTION public.html_design_presets_set_updated_at();

-- ============================================================
-- 2. Add html-specific columns to carousel_projects
--    (now safe because html_design_presets exists)
-- ============================================================
ALTER TABLE public.carousel_projects
  ADD COLUMN IF NOT EXISTS html_preset_id UUID REFERENCES public.html_design_presets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS html_style_guide JSONB,
  ADD COLUMN IF NOT EXISTS html_generation_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (html_generation_status IN ('idle', 'generating', 'partial', 'complete', 'failed')),
  ADD COLUMN IF NOT EXISTS html_generation_id UUID;

-- ============================================================
-- 3. html_project_slides: HTML-specific slide data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.html_project_slides (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    UUID NOT NULL REFERENCES public.carousel_projects(id) ON DELETE CASCADE,
  slide_index   SMALLINT NOT NULL CHECK (slide_index >= 0 AND slide_index <= 5),
  html          TEXT,
  page_title    TEXT,
  page_type     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, slide_index)
);

CREATE INDEX IF NOT EXISTS html_project_slides_project_idx
  ON public.html_project_slides (project_id, slide_index);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.html_project_slides_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER html_project_slides_updated_at
  BEFORE UPDATE ON public.html_project_slides
  FOR EACH ROW EXECUTE FUNCTION public.html_project_slides_set_updated_at();

-- Touch parent project's updated_at when slides change
CREATE OR REPLACE FUNCTION public.html_project_slides_touch_project()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.carousel_projects SET updated_at = now()
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER html_project_slides_touch_project
  AFTER INSERT OR UPDATE OR DELETE ON public.html_project_slides
  FOR EACH ROW EXECUTE FUNCTION public.html_project_slides_touch_project();

-- (html_design_presets was already created in step 1 above)

-- ============================================================
-- 4. RLS policies — mirrors carousel_project_slides pattern exactly
-- Uses editor_account_memberships (NOT account_members)
-- ============================================================

-- html_project_slides
ALTER TABLE public.html_project_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "html_project_slides_select_account_member"
  ON public.html_project_slides FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.carousel_projects p
    WHERE p.id = html_project_slides.project_id
      AND (
        (p.account_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.editor_account_memberships m
          WHERE m.account_id = p.account_id AND m.user_id = auth.uid()
        ))
        OR (p.account_id IS NULL AND p.owner_user_id = auth.uid())
      )
  ));

CREATE POLICY "html_project_slides_insert_account_admin_owner"
  ON public.html_project_slides FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.carousel_projects p
    WHERE p.id = html_project_slides.project_id
      AND (
        (p.account_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.editor_account_memberships m
          WHERE m.account_id = p.account_id AND m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin')
        ))
        OR (p.account_id IS NULL AND p.owner_user_id = auth.uid())
      )
  ));

CREATE POLICY "html_project_slides_update_account_admin_owner"
  ON public.html_project_slides FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.carousel_projects p
    WHERE p.id = html_project_slides.project_id
      AND (
        (p.account_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.editor_account_memberships m
          WHERE m.account_id = p.account_id AND m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin')
        ))
        OR (p.account_id IS NULL AND p.owner_user_id = auth.uid())
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.carousel_projects p
    WHERE p.id = html_project_slides.project_id
      AND (
        (p.account_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.editor_account_memberships m
          WHERE m.account_id = p.account_id AND m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin')
        ))
        OR (p.account_id IS NULL AND p.owner_user_id = auth.uid())
      )
  ));

CREATE POLICY "html_project_slides_delete_account_admin_owner"
  ON public.html_project_slides FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.carousel_projects p
    WHERE p.id = html_project_slides.project_id
      AND (
        (p.account_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.editor_account_memberships m
          WHERE m.account_id = p.account_id AND m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin')
        ))
        OR (p.account_id IS NULL AND p.owner_user_id = auth.uid())
      )
  ));

-- html_design_presets
ALTER TABLE public.html_design_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "html_design_presets_select_system_or_member"
  ON public.html_design_presets FOR SELECT
  USING (
    is_system = true
    OR (account_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.editor_account_memberships m
      WHERE m.account_id = html_design_presets.account_id AND m.user_id = auth.uid()
    ))
  );

CREATE POLICY "html_design_presets_insert_account_admin_owner"
  ON public.html_design_presets FOR INSERT
  WITH CHECK (
    account_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.editor_account_memberships m
      WHERE m.account_id = html_design_presets.account_id AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "html_design_presets_update_account_admin_owner"
  ON public.html_design_presets FOR UPDATE
  USING (
    account_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.editor_account_memberships m
      WHERE m.account_id = html_design_presets.account_id AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "html_design_presets_delete_account_admin_owner"
  ON public.html_design_presets FOR DELETE
  USING (
    account_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.editor_account_memberships m
      WHERE m.account_id = html_design_presets.account_id AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Grants
GRANT ALL ON public.html_project_slides TO authenticated;
GRANT ALL ON public.html_design_presets TO authenticated;
```

### Template Type Settings Decision

HTML does NOT participate in the `carousel_template_types` / `carousel_template_type_overrides` / `editor_poppy_saved_prompts` prompt-override system. No new row is needed in `carousel_template_types` for `"html"`. All code paths that call `loadEffectiveTemplateTypeSettings` must early-return safe defaults when `templateTypeId === "html"`.

For v1 shared picker/create flows, the saved-prompt UI remains visible for html even though no html-specific prompt rows exist. The implementation rule is:

- the UI still lets the user select a prompt when creating an html project from shared flows
- behind the scenes, html resolves prompt content from the **Regular** saved-prompt pool for v1
- the route logic must still branch explicitly on `html` rather than inheriting regular/enhanced semantics by coercion
- later iterations may introduce true html-specific saved prompts, but v1 does not require them

### V1 Constraint: slide_index 0–5 (6 slides fixed)

The current app hardwires 6 slides everywhere (create routes, generate-copy, UI). HTML v1 matches this: `CHECK (slide_index >= 0 AND slide_index <= 5)`. Variable slide count is a Phase 5 feature.

---

## 5. The Workspace Layout (What the User Sees)

When `templateTypeId === "html"`, the editor keeps the same overall shell and dotted workspace feel, but the runtime beneath that shell is different. `EditorRuntimeRouter.tsx` waits for bootstrap/load to resolve the real project type, then routes html projects into `HtmlEditorShell.tsx`, which owns the iframe-based HTML workspace. The left sidebar remains. The top bar remains. The workspace becomes a hybrid layout: center preview, bottom project tools, right-side selected-element inspector.

```
┌──────────────────────────────────────────────────────────────────────┐
│  EditorTopBar (shared chrome; html-specific actions §17e)           │
├──────────┬───────────────────────────────────────────────┬───────────┤
│          │                                               │           │
│ Editor   │   Active Slide Preview                        │ Edit /    │
│ Sidebar  │   (scaled iframe, centered, dotted workspace) │ AI Design │
│          │   [interaction happens inside iframe]         │ inspector │
│ - Proj   │                                               │           │
│   list   │   Slide thumbnails below preview              │ Selected  │
│ - New    │   [1][2][3][4][5][6]                          │ element   │
│   proj   │                                               │ content + │
│ - Preset │                                               │ styling   │
│   select │                                               │ controls  │
├──────────┴───────────────────────────────────────────────┴───────────┤
│  HTML bottom panel: caption, debug logs, generate copy, project-level │
│  workflow/status surfaces                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Layout Decisions

1. **The editor identity stays familiar.** Keep the same dotted workspace feel, centered slide focus, left project sidebar, top action bar, and bottom project-tools surface.

2. **The center surface changes under the hood.** The active slide is a scaled iframe rendering HTML, not a Fabric canvas. The user should still experience it as “the slide in the middle.”

3. **The bottom panel stays.** For `html` projects, it becomes a dedicated HTML project-tools surface for caption, logs, generate-copy flow, and project-level messaging. The existing Fabric-specific `EditorBottomPanel` is not mounted as-is, but its role in the workspace remains.

4. **The right side is secondary, not dominant.** A right-side inspector appears for selected-element editing. It should feel contextual and clean, not like a separate right-heavy app layout.

5. **Selected-element editing lives on the right.** This includes text content, text styling, image/block properties, and position-related controls.

6. **The AI Designer tab is visible but disabled in V1.** It is included so we can validate the future workspace shape now, but it does not trigger backend refinement yet.

7. **Slide thumbnails stay below the main preview.** Users navigate slides the same way they do today: by clicking a thumbnail strip below the main stage.

8. **Top bar actions branch for html.** Export/save behavior uses the HTML render/save endpoints when `templateTypeId === "html"` — see §17e.

9. **Unsaved changes guard remains required.** `beforeunload` handling and project-switch confirmation still apply — see §17f.

---

## 6. Element-Level Editing Architecture (Reverse-Engineered from Mirr)

This is the key engineering challenge. We've fully reverse-engineered how Mirr solves it.

### The Core Insight: Everything Happens INSIDE the iframe

There is **no overlay div on top of the iframe**. The interaction script is **injected into the iframe's HTML document itself**. The iframe has `sandbox="allow-same-origin allow-scripts"` and handles all interaction (click, drag, resize, text editing) internally, communicating with the parent React app via `postMessage`.

This is elegant because:
- No coordinate mapping between overlay and iframe (same coordinate space)
- The iframe's own DOM is directly manipulated
- The parent only needs to listen for messages and update its sidebar UI
- Serialization is trivial: `iframe.contentDocument.documentElement.outerHTML`

### The `data-editable-id` System

> **CORRECTION (post-audit):** AI-generated HTML does NOT already include `data-editable-id` on every editable element. The captured Mirr `generate-content-stream` responses confirm this. The **parent-side parser** (§6b) discovers editable elements and injects `data-editable-id` attributes after generation. Image/logo slots DO include `data-slot-id`, `data-slot-type`, `data-slot-label`, and `data-search-query` from the AI — those are generation-time attributes. But `data-editable-id` on text spans, divs, and backgrounds is added by the parser.

After parsing and ID injection, the HTML looks like:

```html
<div data-editable-id="div-10" style="width:1080px; height:1350px; ...">
  <div data-editable-id="bg-3" style="position:absolute; inset:0; opacity:0.1; ..."></div>
  <span data-editable-id="text-5" style="...">Real Talk</span>
  <span data-editable-id="text-6" style="...">Agent Frameworks</span>
  <span data-editable-id="text-7" style="...">Are Setup</span>
  <span data-editable-id="text-4"><span style="color:rgb(236,72,153);">Porn</span></span>
  <div data-editable-id="div-11" style="background-color:#E67A19; ...">
    <span data-editable-id="text-8" style="font-family:'Permanent Marker'; ...">Not Generators</span>
  </div>
  <div data-editable-id="div-12"><!-- SVG arrow decoration --></div>
  <span data-editable-id="text-9">Business Strategy</span>
</div>
```

ID naming convention:
- **`text-N`** — text spans (always `<span>`, editable via contentEditable)
- **`div-N`** — container/layout divs (draggable/resizable, not text-editable)
- **`bg-N`** — background overlays (pointer-events: none)
- **`slot-N`** — image/logo placeholder slots

### Image/Logo Slots

A special overlay root div holds image and logo placeholders:

```html
<div data-editor-overlay-root="true"
     style="position:absolute; inset:0; pointer-events:none; z-index:2147483000;">
  <div class="image-slot"
       data-slot-id="slot-new-1775337965723"
       data-slot-type="main"
       data-slot-label="Image"
       data-search-query="abstract texture background"
       data-editable-id="slot-0"
       style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
              width:300px; height:200px; pointer-events:auto;">
  </div>
  <div class="image-slot"
       data-slot-id="slot-logo-1775337967899"
       data-slot-type="logo"
       data-slot-label="Logo"
       data-editable-id="slot-1"
       style="position:absolute; left:20px; top:20px; width:120px; height:60px;
              pointer-events:auto;">
  </div>
</div>
```

### CSS States for Editable Elements

Injected into the iframe's `<head>`:

```css
/* Default: grab cursor, smooth transitions */
[data-editable-id] {
  cursor: grab !important;
  transition: outline 0.15s ease, opacity 0.15s ease;
}
/* Hover: gray dashed outline */
[data-editable-id]:hover {
  outline: 2px dashed #94a3b8 !important;
  outline-offset: 2px !important;
}
/* Active: grabbing cursor */
[data-editable-id]:active {
  cursor: grabbing !important;
}
/* Text editing mode: purple solid outline */
[data-editable-id][contenteditable="true"] {
  cursor: text !important;
  outline: 2px solid #8b5cf6 !important;
  outline-offset: 2px !important;
  min-width: 20px;
  min-height: 1em;
}
```

### postMessage Protocol (iframe ↔ parent)

**Iframe → Parent (events):**

| Message type | Payload | When |
|---|---|---|
| `fonts-ready` | `{}` | All fonts loaded |
| `element-click` | `{ id: "text-5" }` or `{ id: null }` | Element clicked / empty space clicked |
| `element-drag-start` | `{ id: "text-5" }` | Drag begins |
| `element-move` | `{ id, translateX: "42px", translateY: "-15px" }` | Drag ends |
| `element-text-update` | `{ id, value: "New Text" }` | Text editing finished (plain) |
| `element-richtext-update` | `{ id, value: "<span style='color:#ef4444'>Bold</span> text" }` | Text editing finished (rich) |
| `element-resize` | `{ id, width: "350px", height: "250px" }` | Resize ends |
| `element-rotate` | `{ id, rotate: "15deg" }` | Rotation ends |

**Parent → Iframe (commands):**

| Message type | Payload | Effect |
|---|---|---|
| `highlight` | `{ id: "text-5" }` or `{ id: null }` | Show selection UI (blue border + handles) on element |
| `update-element` | `{ id, elType, fontFamily, fontSize, color, ... }` | Apply property changes to element |
| `update-elements` | `{ elements: [...] }` | Batch property updates |
| `update-font-css` | `{ css: "@font-face { ... }" }` | Inject new font CSS into iframe head |

**Element update shape (all optional except id and elType):**
```typescript
{
  id: string;
  elType: 'text' | 'image' | 'image-slot';
  deleted?: boolean;
  // Text properties:
  currentValue?: string;
  richHtml?: boolean;       // true → innerHTML, false → textContent
  fontFamily?: string;      // "'Inter', sans-serif"
  fontSize?: string;        // "110px"
  color?: string;           // "#FFFFFF"
  textAlign?: string;       // "center"
  fontWeight?: string;      // "800"
  lineHeight?: string;      // "1.05"
  letterSpacing?: string;   // "-0.03em"
  // Image properties:
  currentValue?: string;    // URL → sets src or background-image
  backgroundSize?: string;
  backgroundPosition?: string;
  // Position/size (all types):
  width?: string;
  height?: string;
  translateX?: string;
  translateY?: string;
  rotate?: string;
  borderRadius?: string;
  opacity?: string;
  margin{Top,Bottom,Left,Right}?: string;
}
```

### Selection UI (Created Inside iframe)

When the parent sends `{ type: 'highlight', id: 'text-6' }`, the iframe script:
1. Sets `outline: 3px solid #3b82f6; outline-offset: 2px` on the target element
2. Creates a `#sel-overlay` div (position: fixed) with:
   - 4 corner resize handles (10px white squares with blue border, `data-resize-handle="nw|ne|se|sw"`)
   - A rotation handle (12px blue circle above the element, `data-rotate-handle="true"`)
   - A vertical line connecting the rotation handle

### Drag Mechanics (Inside iframe)

1. Mousedown on `[data-editable-id]` element starts drag (5px threshold)
2. During drag: element gets `transform: translate(Xpx, Ypx)` applied
3. **Snap guides** appear — alignment lines to page center, page edges, and other elements (6px threshold)
4. On mouseup: `postMessage({ type: 'element-move', id, translateX, translateY })`

### Resize Mechanics (Inside iframe)

1. Mousedown on `[data-resize-handle]` starts resize
2. During resize: element's `width` and `height` are updated live
3. On mouseup: `postMessage({ type: 'element-resize', id, width, height })`

### Rotation Mechanics (Inside iframe)

1. Mousedown on `[data-rotate-handle]` starts rotation
2. Angle calculated from element center to mouse position
3. On mouseup: `postMessage({ type: 'element-rotate', id, rotate: "15deg" })`

### Inline Text Editing (Double-Click)

1. Double-click on a `<span>` with `data-editable-id` triggers `startInlineEdit()`
2. The span gets `contenteditable="true"` — cursor changes to text, outline becomes purple
3. All text is auto-selected via `window.getSelection()`
4. A **floating rich-text toolbar** appears above the selection with: Bold, Italic, A- (decrease), A+ (increase), color picker + 9 preset color dots
5. On blur: `contenteditable` is set back to `false`, `postMessage({ type: 'element-text-update' | 'element-richtext-update', id, value })` is sent
6. Only `<span>` tags can be text-edited — `<div>` elements can only be dragged/resized

### Floating Rich-Text Toolbar

Built entirely inside the iframe DOM:
- Dark background (`#1e1e2e`), rounded, with shadow
- Buttons: **B** (bold), **I** (italic), **A-** (decrease font size), **A+** (increase font size)
- Color: **A** with color bar + hidden `<input type="color">` + 9 preset color dots
- Font size steps: +/- 2px for sizes ≤40, +/- 4px for sizes >40
- Minimum font size: 8px

### How the Parent Sidebar Works

The parent React app (the `PageEditor` component from chunk 91738):
1. Listens for `element-click` messages from the iframe
2. Builds an element list by parsing the HTML string with `DOMParser` (see §6b below)
3. When an element is selected, reads its current properties from the element data model
4. Shows the property editor (font, size, weight, color, spacing, etc.)
5. When the user changes a property, updates the local element state, then diffs against previous state (function `H()` compares 25+ properties) and only sends changed elements via `postMessage({ type: 'update-elements', elements: [...] })` to the iframe
6. The iframe applies the change directly to its DOM via `applyElementUpdate()`
7. To save: function `R(baseHtml, elements)` applies all element changes to a DOM copy, then `A()` strips editor attributes, then serializes to HTML string

---

## 6b. HTML Parser — How Elements Are Discovered From Raw HTML

This is a critical piece. The parser runs on the parent side (NOT in the iframe) using `DOMParser`. It takes a raw HTML string and returns a structured element list + annotated HTML.

### Parser Algorithm (in order of processing)

1. **SVG extraction** — Replace all `<svg>` blocks with `<div data-svg-placeholder="N">` placeholders to avoid DOMParser issues. SVGs are tracked separately for later restoration.

2. **Parse to DOM** — `new DOMParser().parseFromString("<body>" + html + "</body>", "text/html")`

3. **Image slots** — Query `querySelectorAll(".image-slot")`. For each: read `data-editable-id`, `data-slot-type` (`background` / `main` / `logo`), `data-slot-label`, `data-search-query`. Parse inline styles for `background-image`, `background-position`, `background-size`. Extract `translate(x,y)` and `rotate()` from transform. Filter out placeholder URLs (picsum, placehold.co, dummyimage). Create element with `type: "image-slot"`.

4. **Standalone `<img>` elements** — Query `img[src]`, skipping those inside `.image-slot`. Create `type: "image"`.

5. **Background-image divs** — Scan ALL elements for `background-image: url(...)` in inline styles not already captured. Create `type: "image"`.

6. **Rich text spans** — Query `span[data-richtext="true"], span[data-editable-id]`. If the span contains inner HTML tags (`<b>`, `<i>`, `<strong>`, nested `<span>`), treat as rich text: `type: "text", richHtml: true`.

7. **Plain text nodes** — Use `TreeWalker(NodeFilter.SHOW_TEXT)` to walk ALL text nodes. Skip script/style content, CSS-like strings, JS-like strings, placeholder text, HTML entities. Wrap naked text nodes in `<span data-editable-id="...">`. Create `type: "text"`.

8. **Decorative/structural divs** — Query all `<div>` elements with `position: absolute` that have `background-color` or `border`. Create `type: "div"`.

9. **SVG elements** — Re-process extracted SVGs, assigning `data-editable-id`. Create `type: "div"`.

### ID Generation Convention

Function `m()` either reuses existing `data-editable-id` or generates:
- `"slot-0"`, `"slot-1"` — image/logo slots (sequential)
- `"img-1"`, `"img-2"` — standalone images
- `"text-2"`, `"text-3"` — text spans
- `"bg-3"` — background divs
- `"div-4"` — structural divs
- `"svg-5"` — SVG elements

### Parser Returns

```typescript
{ elements: HtmlSlideElement[], html: string }
// html has data-editable-id attributes injected on any elements that didn't already have them
```

---

## 6c. Element Data Model (Full TypeScript)

Every element tracks both current and original values for diffing:

```typescript
interface BaseElement {
  id: string;                    // "slot-0", "text-1", "img-2", etc.
  type: "text" | "image" | "image-slot" | "div";
  originalValue: string;         // snapshot at parse time
  currentValue: string;          // current user-edited value
  selector: string;              // CSS selector hint / outerHTML snippet
  deleted?: boolean;             // soft-delete flag (element hidden via display:none)
  userUploaded?: boolean;        // image was uploaded by user (not from preset)

  // Position/transform
  translateX?: string;           // "10px"
  translateY?: string;           // "20px"
  originalTranslateX?: string;
  originalTranslateY?: string;
  rotate?: string;               // "45deg"
  originalRotate?: string;
  width?: string;                // "300px"
  height?: string;               // "200px"
  originalWidth?: string;
  originalHeight?: string;
}

interface TextElement extends BaseElement {
  type: "text";
  richHtml?: boolean;            // true if contains inner HTML tags
  context?: string;              // parent outerHTML (truncated to 300 chars)
  fontFamily?: string;
  originalFontFamily?: string;
  fontSize?: string;             // "24px"
  originalFontSize?: string;
  color?: string;                // "#1a1a1a"
  originalColor?: string;
  textAlign?: string;
  originalTextAlign?: string;
  fontWeight?: string;           // "400", "700", "inherit"
  originalFontWeight?: string;
  lineHeight?: string;           // "1.4"
  originalLineHeight?: string;
  letterSpacing?: string;        // "0.5px"
  originalLetterSpacing?: string;
  marginTop?: string;
  originalMarginTop?: string;
  marginBottom?: string;
  originalMarginBottom?: string;
  marginLeft?: string;
  originalMarginLeft?: string;
  marginRight?: string;
  originalMarginRight?: string;
}

interface ImageSlotElement extends BaseElement {
  type: "image-slot";
  slotType: "background" | "main" | "logo";
  slotLabel: string;             // "Background", "Image area", "Logo"
  searchQuery?: string;          // AI-suggested search query for auto-fill
  backgroundPosition: string;
  originalBackgroundPosition: string;
  backgroundSize: string;
  originalBackgroundSize: string;
  borderRadius?: string;
  originalBorderRadius?: string;
  opacity?: string;
  originalOpacity?: string;
}

interface ImageElement extends BaseElement {
  type: "image";
  borderRadius?: string;
  originalBorderRadius?: string;
  opacity?: string;
  originalOpacity?: string;
  objectFit?: string;
  originalObjectFit?: string;
}

interface DivElement extends BaseElement {
  type: "div";
  backgroundColor?: string;
}
```

The `original*` twins enable diffing: only changed properties are sent via postMessage. The value `"inherit"` is used as a sentinel for "not set / use default".

---

## 6d. Property Editor Controls (Exact Specifications)

### Font Family Selector
- Uses a `FontPicker` component backed by a 147-font catalog (Google Fonts + custom CDN fonts from `storage.mirra.my`)
- Font entries have: `{ id, name, family, category, language, weights[], googleFontModule?, customFontUrl? }`
- Languages: Korean (78), Japanese (26), Latin (15), Arabic (15), Chinese (13)
- When font changes, generates `<link>` tags or `@font-face` rules and sends `update-font-css` message to iframe

### Font Size Control
- **Minus button** — Decrements by 1 (under 20px), 2 (20-40px), or 4 (over 40px)
- **Number input** — Direct px entry (1–999), empty = `"inherit"`
- **Plus button** — Same adaptive step logic as minus
- **Preset buttons row** — `12, 16, 20, 24, 32, 40, 48, 64, 80, 96`

### Font Weight Buttons
Six inline buttons:

| Label | CSS Value | Meaning |
|-------|-----------|---------|
| `-` | `"inherit"` | Reset to default |
| `L` | `"300"` | Light |
| `N` | `"400"` | Normal |
| `M` | `"500"` | Medium |
| `SB` | `"600"` | Semi-Bold |
| `B` | `"700"` | Bold |

### Color Palette
- **Quick palette (always visible):** Native `<input type="color">` + 10 preset dots: `#000000, #FFFFFF, #374151, #6B7280, #9CA3AF, #EF4444, #F97316, #F59E0B, #EAB308, #84CC16`
- **Advanced palette (inside "More options"):** Hex input + full 22-color grid

### Letter Spacing
- Plus/minus buttons in **0.5px** increments. Number input with step=0.5. Empty = `"inherit"`.

### Line Height
- Plus/minus buttons in **0.1** increments. Range: 0.5–5.0. Default starting value: 1.4. Empty = `"inherit"`.

### "More Options" Section (Collapsible)
Contains:
- Full color hex input + expanded color grid
- **"Apply font to all pages"** button (when font differs from inherit, and totalPages > 1)
- For images: **borderRadius** presets (`inherit, 0px, 4px, 8px, 12px, 16px, 24px, 50%`), **opacity** presets (`inherit, 100%, 90%, 80%, ..., 30%`), **objectFit** options (`inherit, Cover, Contain, Fill, None`), **"Edit Image Advanced"** button

### Add Element (Text / Image / Logo)

**Add Text** — injects into the `data-editor-overlay-root` div:
```html
<span style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  font-size:32px; font-weight:600; color:#1a1a1a; text-align:center;
  white-space:nowrap; z-index:10; pointer-events:auto;">New Text</span>
```

**Add Image** — injects:
```html
<div class="image-slot" data-slot-id="slot-new-{timestamp}" data-slot-type="main"
  data-slot-label="Image" data-search-query="abstract texture background"
  style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:300px; height:200px; background-image:url('https://placehold.co/300x200/e2e8f0/94a3b8?text=Image');
  background-size:cover; background-position:center; border-radius:8px;
  z-index:10; pointer-events:auto;"></div>
```

**Add Background Image Slot** — injects:
```html
<div class="image-slot" data-slot-id="slot-bg-{timestamp}" data-slot-type="background"
  data-slot-label="Background" data-search-query="modern gradient mesh background"
  style="position:absolute; inset:0;
  background-image:url('https://placehold.co/1080x1350/e2e8f0/94a3b8?text=Background');
  background-size:cover; background-position:center;
  z-index:0; pointer-events:auto;"></div>
```

**Add Logo** — injects:
```html
<div class="image-slot" data-slot-id="slot-logo-{timestamp}" data-slot-type="logo"
  data-slot-label="Logo"
  style="position:absolute; left:20px; top:20px; width:120px; height:60px;
  background-size:contain; background-repeat:no-repeat; background-position:center;
  background-image:url('https://placehold.co/120x60/e2e8f0/94a3b8?text=Logo');
  z-index:10; pointer-events:auto;"></div>
```

After injection, full HTML is re-parsed through the parser → re-rendered in iframe.

### Duplicate and Delete

- **Delete:** Soft-delete — sets `element.deleted = true`. Iframe hides via `display: none`. On save, `R()` removes deleted elements from DOM entirely.
- **Duplicate:** Clones DOM node with `cloneNode(true)`, assigns new ID `"{originalId}-dup-{timestamp}"`, recursively renames all nested `data-editable-id` and `data-slot-id` attributes, inserts after original, re-parses entire HTML.

---

## 6e. Save/Close Flow

### Save (detailed steps)

1. **Flush pending edits** — If user is currently editing text inline (contentEditable active), extract the text via `flushRef`
2. **For each page** in the page states map:
   a. Call `R(baseHtml, elements)` — iterates all elements, finds each by `[data-editable-id]` in a DOM copy, applies all property changes (text content, styles, transforms, images)
   b. Call `A(html)` — cleanup function that:
      - Strips all `data-editable-id` attributes
      - Strips `data-richtext`, `data-user-uploaded`
      - Unwraps wrapper `<span>` elements that have no styles (replaces with child nodes)
      - Restores SVGs from placeholders
   c. Minify the HTML
3. Call `onSaveAll(pages)` — parent's callback that writes to the store/DB
4. Show toast "Saved"

### What Gets Persisted

Only the **raw HTML string** per slide. There is no intermediate element JSON stored — elements are re-parsed from HTML on every editor open. This means the HTML is the single source of truth.

---

## 6f. Undo/Redo System

### Architecture
- History stack: `{ past: Entry[], future: Entry[] }`, max 50 entries in past
- Two entry types:
  - `kind: "single"` — `{ pageIndex, state: PageState }`
  - `kind: "bulk"` — `{ states: Map<pageIndex, PageState> }` (for cross-page operations like "Apply logo to all pages")
- `PageState` = `{ baseHtml: string, elements: Element[], previewHtml: string }`

### Debounced Capture
Changes captured with 500ms debounce. On first change in a burst, snapshot is taken. On flush (500ms idle), pushed to `past[]`, `future[]` is cleared.

### Auto-save Interaction
- Auto-save does NOT create or clear undo checkpoints
- Undo/redo operates on in-memory page states relative to the last persisted baseline
- Undoing past the last auto-save point makes `isDirty = true` again
- Save status indicator reflects divergence from persisted HTML, not "last change timestamp"

### Session Persistence
Persisted to `sessionStorage` (limited to 15 past + 15 future entries). Includes `htmlGenerationId` + `projectId` + `timestamp` — expires after 1 hour. Only applied on load if `projectId` and `htmlGenerationId` match. Uses `requestIdleCallback` for non-blocking saves.

### Keyboard Shortcuts
- **Ctrl+Z / Cmd+Z** — Undo
- **Ctrl+Shift+Z / Cmd+Y** — Redo
- **Ctrl+S** — Save
- **Escape** — Deselect element
- **Arrow Left/Right** — Navigate pages
- **Delete/Backspace** — Delete selected element

---

## 6g. Font Optimization Pipeline

Before HTML is rendered in the iframe, it goes through a font processing pipeline:

1. **Scan** all `font-family` declarations in the HTML
2. **Replace system fonts** with web-safe equivalents (Arial → Noto Sans KR, Times → Noto Serif KR, etc.)
3. **Inject Google Fonts** `<link>` tags for any referenced Google Fonts
4. **Inject `@font-face`** for custom CDN fonts (from `storage.mirra.my/media/fonts/`)
5. **Block system fonts** (optional, for export): generate `@font-face` rules that map ~30 system fonts to `local('☺')` (nonexistent), forcing browser to use web fonts
6. **Convert `@import`** statements to `<link>` tags for faster loading
7. **Font load signaling**: inject script that calls `window.parent.postMessage({ type: 'fonts-ready' }, '*')` when `document.fonts.ready` resolves

### Document Wrapper

The HTML is also wrapped in a full document if it isn't already:
```html
<!DOCTYPE html>
<html>
<head>
  <style>html,body{height:100%;margin:0;box-sizing:border-box;overflow:hidden;}</style>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Noto Sans KR',sans-serif;}</style>
  <!-- font <link> tags -->
</head>
<body>
  <!-- slide HTML -->
</body>
</html>
```

### LRU Cache

Processed HTML is cached in an LRU Map (60 entries max) keyed by `"aspectRatio:hash(html)"` to avoid re-processing on every render.

---

## 6h. Iframe Rendering (Scaling)

The iframe is rendered at full slide dimensions (e.g., 1080×1350) inside a container that CSS-scales it down:

```html
<div ref={containerRef} class="relative w-full overflow-hidden" style="padding-bottom: 125%;">
  <div data-scale-container="true"
       class="absolute top-0 left-0 origin-top-left"
       style="width: 1080px; height: 1350px; transform: scale(0.37); will-change: transform;">
    <iframe sandbox="allow-same-origin allow-scripts"
            class="w-full h-full border-0"
            style="width: 1080px; height: 1350px;" />
  </div>
</div>
```

- Scale factor = `containerWidth / slideWidth` (e.g., `400px / 1080px = 0.37`)
- Updated via `ResizeObserver` on the container
- Aspect ratio maintained via `padding-bottom` percentage (`height/width * 100`)

### Aspect Ratio Dimensions

```typescript
const DIMENSIONS = {
  "1:1":  { width: 1080, height: 1080 },
  "4:5":  { width: 1080, height: 1350 },
  "3:4":  { width: 1080, height: 1440 },
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
};
```

---

## 7. HTML Project API Contracts (V1)

### 7-pre. Load / Bootstrap Contract for HTML Projects

**This is the missing load contract that the audit identified as CRITICAL.**

When the client loads an HTML project, `src/app/api/editor/projects/load/route.ts` must return additional fields:

```typescript
// Added to the existing load response when template_type_id === "html"
{
  // ...existing fields (project, slides, etc.)...
  htmlSlides: Array<{
    id: string;
    slideIndex: number;
    html: string | null;           // null if not yet generated
    pageTitle: string | null;
    pageType: string | null;
  }>;
  htmlPresetId: string | null;
  htmlStyleGuide: object | null;
  htmlGenerationStatus: "idle" | "generating" | "partial" | "complete" | "failed";
  htmlGenerationId: string | null;    // matches DB column html_generation_id
}
```

**Partial generation recovery (v1):** When `htmlGenerationStatus === "partial"`, the client:
1. Renders completed slides normally
2. Shows skeleton placeholders for slides where `html === null`
3. Displays a "Retry Generation" button that restarts the full generate-slides request
4. V1 does NOT support `resumeFrom` or partial stream resumption

### 7a. Generate HTML Slides (after Generate Copy)

**Trigger:** User clicks "Generate Slides" after copy exists on the project.

**Endpoint:** `POST /api/editor/html-projects/generate-slides`

> **Source of truth:** The request/response shape below is based on verified Mirr captures (`Prompt.har` and `mirr-extracted/api-responses/POST_carousel-lab_generate-content-stream.json`) plus our own V1 product decisions. The hidden backend system prompt itself is still unknown.

#### 7a1. Exact Mirr-Shaped Generation Request Schema

This is the schema we should implement on our side because it matches the browser → app-server contract that Mirr has proven to work.

```typescript
type HtmlGenerateSlidesRequest = {
  projectId: string;
  presetId: string;
  content: string;
  mode: "follow";
  outputLanguage: "auto" | "en" | "ko" | "ja" | "zh-TW" | "es" | "pt-BR" | "ar" | "fr" | "de";
  enableImageSearch: false; // hard-disabled in v1
  slideCount: 6;
  aspectRatio: "1:1" | "4:5" | "3:4" | "16:9" | "9:16";
};
```

Implementation notes:

- `presetId`, `content`, `mode`, `outputLanguage`, `enableImageSearch`, and `slideCount` are copied directly from Mirr's proven request shape
- `projectId` is our addition because our app persists directly into `html_project_slides`
- `enableImageSearch` must remain `false` in V1 even if the payload field exists
- `slideCount` is fixed to `6` in our V1 even though Mirr sometimes sends `"auto"`

#### 7a2. Content Builder Format (exact server input string)

The `content` field sent to `generate-slides` must be built deterministically from existing project/copy data. This should not be improvised per route.

The immediate upstream source for this in v1 is a dedicated html copy draft shape, not the Regular/Enhanced parser output shape:

```typescript
type HtmlCopyDraft = {
  projectTitle: string;
  slides: Array<{
    slideNumber: number;      // 1..6
    textLines: string[];      // ordered lines that will be flattened into the content string
  }>;
};
```

Implementation notes:

- `generate-copy/route.ts` must branch explicitly for `html` and return/build this html-oriented copy draft shape
- shared modals may still select a saved prompt for html, but in v1 that prompt content resolves from the Regular prompt pool behind the scenes
- routes like Swipe Ideas and Carousel Map should normalize their upstream source material into this same `HtmlCopyDraft` contract before `generate-slides`
- prompt-preview routes for html should preview the `HtmlCopyDraft` structure directly in v1
- caption is NOT generated as part of the html copy branch in v1
- only after the html copy draft exists do we ask the user to choose the visual preset in v1
- the server then converts `HtmlCopyDraft` into the final `PROJECT_TITLE` / `CAROUSEL_TEXTLINES` string

```typescript
type HtmlGenerateContentInput = {
  projectTitle: string;
  slides: Array<{
    slideNumber: 1 | 2 | 3 | 4 | 5 | 6;
    textLines: string[]; // already ordered for display emphasis
  }>;
};
```

The exact serialized format should be:

```text
PROJECT_TITLE:
{projectTitle}

CAROUSEL_TEXTLINES:
SLIDE 1 (textLines):
{slide1 line 1}
{slide1 line 2}
...

SLIDE 2 (textLines):
{slide2 line 1}
{slide2 line 2}
...

SLIDE 3 (textLines):
...
```

Rules for the content builder:

- Do not send raw JSON to the model-facing generation route; send the formatted text block above
- Preserve slide ordering exactly
- Remove empty trailing lines, but preserve intentional paragraph breaks
- Use existing copy-generation output as the source of truth for `textLines`
- If a route like Carousel Map or Daily Digest creates the project, it must still normalize into this same `PROJECT_TITLE` / `CAROUSEL_TEXTLINES` format before HTML generation

#### 7a3. Reconstructed Backend System Prompt Structure

We do not have Mirr's literal hidden backend prompt, but we now know enough to define the reconstructed structure that our server should assemble.

```typescript
type HtmlGenerationPromptParts = {
  roleInstruction: string;
  outputContract: string;
  dimensionRules: string;
  editabilityRules: string;
  slotRules: string;
  styleRules: string;
  presetReferenceBlock: string;
  styleGuideBlock: string;
  contentBlock: string;
};
```

The provider-facing system prompt should be assembled in this order:

1. **Role instruction**
   - Tell the model it is generating complete carousel slide HTML, not prose or design commentary
2. **Output contract**
   - Return slide HTML only
   - No explanations
   - One full HTML page/fragment per slide in the server's expected stream format
3. **Dimension rules**
   - Root must be exact size for the requested aspect ratio
   - Root must use `overflow: hidden`
4. **Editability rules**
   - Use stable semantic text elements
   - Keep text in `<span>`, heading, paragraph, or clearly parseable blocks
   - Do not rely on `data-editable-id`; the parser injects that later
5. **Slot rules**
   - If the design needs imagery, emit `.image-slot` with `data-slot-id`, `data-slot-type`, `data-slot-label`, optional `data-search-query`
   - In V1, slot metadata is allowed even though user-facing lookup is disabled
   - `data-search-query` should still be emitted when possible because the silent prefill step and future Mirr-shaped image workflows both depend on it
6. **Style rules**
   - Inline styles only
   - No JavaScript
   - No animations for V1
   - Google Fonts `<link>` tags allowed
7. **Preset reference block**
   - Include the selected preset's reference HTML templates
   - Include page-role hints if preset templates are role-specific (`cover`, `content`, `cta/closing`)
8. **Style guide block**
   - Include colors, font preferences, design patterns, and any preset metadata needed to preserve style consistency
9. **Content block**
   - Append the fully built `PROJECT_TITLE` / `CAROUSEL_TEXTLINES` content string

Working principle:

- We should copy Mirr's **prompt shape and constraints**, not pretend we have their literal text
- Our prompt assembly must be deterministic and centralized in one backend helper
- The same helper must be reused across all HTML generation entry points

#### 7a4. Minimum Validation Contract

The backend must validate model output before:

- streaming it into client state
- persisting it to `html_project_slides`
- passing it to the render/export pipeline

Minimum validation contract for each generated slide:

```typescript
type HtmlGeneratedSlideValidationResult = {
  valid: boolean;
  normalizedHtml?: string;
  errors?: string[];
};
```

Validation rules:

1. **Root dimensions**
   - Required: one visible root container with exact pixel dimensions matching the requested aspect ratio
   - Reject if width/height are missing or incorrect
2. **Overflow**
   - Required: root container must have `overflow: hidden`
3. **No script execution**
   - Strip or reject `<script>` tags, inline `on*` handlers, `javascript:` URLs, `srcdoc`, and unsafe SVG constructs per §16
4. **Inline-style compatibility**
   - Require inline layout/styles for slide structure
   - Reject slides that depend on unsupported external CSS for core positioning
5. **Text parseability**
   - Require meaningful text to be represented in parseable elements, not as unstructured raw text blobs in unpredictable DOM positions
6. **Slot shape**
   - If `.image-slot` exists, require `data-slot-id`, `data-slot-type`, and `data-slot-label`
   - `data-search-query` may be omitted in V1, but is preferred for forward compatibility
7. **No editor-only attributes**
   - Generated HTML must not include our runtime editor attributes/nodes beyond allowed slot metadata
8. **Repair pass**
   - Allowed repairs: inject missing wrapper/head boilerplate, normalize font links, sanitize unsafe attributes, collapse obviously malformed whitespace
   - Not allowed: silently accept fundamentally broken layout HTML

Failure behavior:

- If validation fails before any page is emitted, return an SSE `error` event and mark generation as `failed`
- If some pages already streamed successfully and a later page fails validation, mark project status as `partial` and allow retry-whole-generation
- Log validation failure reasons server-side for prompt iteration

**Request body (what our client sends):**
```typescript
{
  projectId: string;           // UUID — REQUIRED for persisting to html_project_slides
  presetId: string;            // UUID of chosen design preset
  content: string;             // Structured text block with all slides' copy
  // Format: "PROJECT_TITLE:\n...\n\nCAROUSEL_TEXTLINES:\nSLIDE 1 (textLines):\n...\nSLIDE 2:\n..."
  mode: "follow";             // use preset's visual style
  outputLanguage: "auto";     // or "en", "ko", "ja", etc.
  enableImageSearch: false;    // hard-disabled in v1; reserved for future scope
  slideCount: 6;              // fixed at 6 for v1
  aspectRatio: "4:5";         // from project settings
}
```

**Server-side behavior:**
0. Generate a new UUID `htmlGenerationId` and persist it as `carousel_projects.html_generation_id` with `html_generation_status = 'generating'`
1. Stream slides via SSE, writing each to `html_project_slides` as it arrives
2. Include the same `htmlGenerationId` in all client-visible generation metadata for this run
3. If all slides complete: keep the same `html_generation_id`, set status to `'complete'`
4. If stream drops: keep the same `html_generation_id`, set status to `'partial'`
5. On error: set status to `'failed'`
6. If a new full generation is started later: issue a fresh `html_generation_id`, overwriting the old one

**Response format: Server-Sent Events (SSE)**

The response is `Content-Type: text/event-stream`. Events arrive in this order:

```
event: status
data: {"phase":"resolving_preset"}

event: status
data: {"phase":"generating"}

event: page                              ← one per slide, streamed as each completes
data: {
  "pageIndex": 0,                        ← 0-based
  "totalPages": -1,                      ← -1 until final event
  "page": {
    "pageNumber": 1,                     ← 1-based display number
    "title": "Cover: Setup Porn",        ← AI-generated page title for sidebar
    "html": "<link ...>...<div style=\"width:1080px; height:1350px; ...\">...</div>",
    "needsImage": true                   ← whether this slide has image slots
  }
}

... more page events ...

event: complete
data: {
  "htmlGenerationId": "uuid",           ← matches DB column html_generation_id
  "totalPages": 6,
  "preset": {
    "id": "uuid",
    "name": "Simple Business",
    "aspectRatio": "4:5"
  }
}
```

**What we are copying directly from Mirr:**

- the structured `content` field format (`PROJECT_TITLE` + `CAROUSEL_TEXTLINES`)
- `mode: "follow"` as the default generation mode
- `outputLanguage`
- `slideCount`
- SSE event ordering and page-by-page streaming
- `page.title`, `page.html`, and `needsImage` on streamed page events

**What is a deliberate divergence from Mirr:**

- Mirr can run a one-shot generation flow from raw structured content; our V1 keeps copy generation and HTML generation as two separate steps
- Mirr has a `match-template` recommendation flow before generation; our V1 uses manual preset selection from a seeded gallery
- Mirr can pre-fill image slots with searched images during generation; our V1 keeps slot metadata but disables image lookup by default

**Critical HTML conventions the AI MUST follow:**

1. Root div MUST have exact `width` and `height` matching aspect ratio (e.g., `width:1080px; height:1350px`)
2. Generated HTML does NOT need `data-editable-id` attributes — the parent-side parser (§6b) injects those after generation
3. If a slide includes editable image/logo/background slots, the AI may generate a `data-editor-overlay-root` container and `.image-slot` children directly in the HTML output; the parser does NOT inject the overlay root
4. Image slots MUST use `.image-slot` class with `data-slot-id`, `data-slot-type`, `data-slot-label`, `data-search-query`
5. `data-slot-type` must allow `"background" | "main" | "logo"` because Mirr uses full-bleed background slots in generated HTML
6. All styles MUST be inline (no `<style>` blocks except font imports)
7. Fonts MUST be Google Fonts loaded via `<link>` tags
8. No JavaScript allowed in generated HTML
9. All text content MUST be in `<span>` or heading elements (not raw text nodes) — this gives the parser stable elements to discover
10. Overflow MUST be `hidden` on the root div

### 7a-note. Backend Prompt Status

We do **not** currently have Mirr's literal hidden backend prompt text.

What we can verify:

- the browser sends structured copy, preset identity, and generation mode to Mirr's app server
- the app server returns streamed HTML pages that follow the conventions above
- the returned HTML is compatible with a parser-driven editor and iframe runtime

What we still need to finalize on our side:

- the exact provider-facing system prompt text
- any internal validation rules we want to enforce before accepting or saving model output

**Working implementation rule:** Until more evidence is found, our backend prompt assembly should be treated as a **reconstruction built from verified Mirr inputs/outputs**, not as a verbatim recovered Mirr prompt.

### 7b. Deferred V1 Hooks (Visible UI, No Active Backend Yet)

The V1 UI intentionally leaves room for future capabilities, but these backend flows are **not implemented in V1** and move to `docs/HTML_TEMPLATE_TYPE_FUTURE_SCOPE.md`:

- AI design refinement (`refine-slide`, `refine-slides`)
- image lookup / image search APIs
- advanced asset sourcing and per-slot media workflows

The main plan only keeps enough structure to make those future additions non-breaking:

- image slots may still carry `data-slot-id`, `data-slot-type`, `data-slot-label`, and optional `data-search-query`
- the right-side inspector still includes an `AI Designer` tab in a disabled/coming-soon state
- the HTML data model should not assume that image lookup exists in V1

### 7c. Save Edited Slides to DB

**Endpoint:** `PATCH /api/editor/html-projects/save-slides`

**Request body:**
```typescript
{
  projectId: string;                  // UUID — REQUIRED
  htmlGenerationId?: string | null;    // from generate-slides response, matches DB column
  generatedPages: Array<{
    pageIndex: number;                // 0-based (0–5)
    html: string;                     // clean display HTML (editor attrs stripped)
    pageTitle?: string;               // page title for sidebar display
  }>
}
```

**Persistence contract:** Persisted `html_project_slides.html` stores **clean display HTML** — `data-editable-id`, `data-editor-overlay-root`, selection UI, and other editor-only nodes are stripped by the client's `A()` cleanup function BEFORE the save request. On reload, the parser re-injects `data-editable-id` from scratch.

**Response:** `200 OK` with `{ saved: true, updatedAt: string }`

**Server-side:** Upserts to `html_project_slides` by `(project_id, slide_index)`. Also updates `carousel_projects.updated_at`.

This is called when:
1. User clicks "Save" explicitly
2. User navigates away from the editor (via `beforeunload` handler)
3. Auto-save timer fires (30 seconds of inactivity after a change)
4. Before export if the current working state has unsaved edits

### 7d. Render HTML to Image (Export)

**Single unified endpoint for both thumbnails and bulk export.**

**Endpoint:** `POST /api/editor/html-projects/render`

**Request body:**
```typescript
{
  projectId?: string;                       // optional, for logging/storage path
  pages: Array<{
    pageIndex: number;
    html: string;                           // clean display HTML
  }>;
  aspectRatio: "1:1" | "4:5" | "3:4" | "16:9" | "9:16";
  format: "zip" | "storage" | "blob";
  imageType?: "jpeg" | "png";              // default: "jpeg"
  quality?: number;                         // 1-100, default: 90 (jpeg only)
}
```

**Response (format="zip"):**
`Content-Type: application/zip` — contains `slide-01.jpg`, `slide-02.jpg`, etc.

**Response (format="storage"):**
```typescript
{
  images: Array<{ pageIndex: number; url: string }>;
  pageCount: number;
  aspectRatio: string;
}
```

**Response (format="blob"):**
Only valid when `pages.length === 1`. Returns raw image bytes with `Content-Type: image/jpeg` or `image/png`.

### 7e. Copy Changes → Re-generate Visuals

When the user edits copy (headline/body text) through the element editor, the visual HTML is updated locally (text changes apply immediately in the iframe). But if they want to **regenerate copy** (run Generate Copy again), the flow is:

1. Generate Copy runs as usual → new headline/body per slide (existing pipeline, unchanged)
2. A new "Regenerate Slides" step takes the updated copy + existing HTML (or preset) and asks the AI to regenerate visuals with the new content
3. The user must explicitly trigger step 2 — it does NOT auto-run after copy changes

This is a two-step process: copy first, then visuals. The user controls when each happens.

---

## 8. Export Pipeline

### Server-Side Rendering (Detailed Steps)

Uses the unified endpoint defined in §7d.

```
Server steps:
1. Parse request: pages[], aspectRatio, format, imageType
2. Sanitize each page's HTML via linkedom (§16):
   - Strip <script>, on* handlers, javascript: URLs, unsafe SVG
   - Strip data-editable-id, data-editor-overlay-root
   - Replace placehold.co URLs with transparent 1px fallback
3. Launch Puppeteer via @sparticuz/chromium
4. For each slide (in parallel, up to 3 concurrent pages):
   a. Create new browser page
   b. Set viewport to {width}x{height} from DIMENSIONS map
   c. page.setContent(sanitizedHtml, { waitUntil: 'networkidle0', timeout: 15000 })
   d. await page.waitForFunction('document.fonts.ready')
   e. Wait additional 500ms for background images
   f. const buffer = await page.screenshot({ type: imageType, quality })
   g. Close page
5. Based on format:
   - "zip": ZIP all buffers as slide-01.jpg, slide-02.jpg, ... → return as blob
   - "storage": upload each to Supabase storage → return { images: [{pageIndex, url}] }
   - "blob": return single buffer (must be 1 page)
```

### Before Rendering: HTML Cleanup

Before passing HTML to Puppeteer, the server must:
1. Strip `data-editable-id` attributes (prevent stray outlines)
2. Strip `data-editor-overlay-root` elements (remove "Add Element" overlays)
3. Strip `data-svg-placeholder` wrapper divs (restore SVGs)
4. Replace any unresolved `placehold.co` URLs with a polished fallback asset or transparent 1px if no fallback is available
5. Apply font blocking (system font → web font override) for consistency
6. Ensure all external image URLs are still valid (404 → transparent fallback)

### Dependencies and Deployment

**Dependencies:** `puppeteer` or `playwright` (server-side only).

**For Vercel:** Use `@sparticuz/chromium` (serverless Chromium binary, ~50MB), configured with:
```typescript
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});
```

**Function timeout:** Set to 60s minimum (rendering 6 slides takes ~10-20s).

**Alternative for MVP:** Use an external service like `html-to-image` API, or the Vercel OG image approach (satori + resvg). However, Puppeteer gives the highest fidelity since it renders exactly what the iframe shows.

### Thumbnail Generation

For the slide strip thumbnails, we render each slide at 1/3 scale (360×450 for 4:5) via the same endpoint but with `format: "storage"`. Thumbnails are generated:
1. After initial generation (auto)
2. After a full regeneration triggered by updated copy or preset change
3. NOT after every manual edit (too expensive). Manual edits use the iframe preview as the thumbnail.

---

## 9. Design Preset System

### Verified Preset Contract (from Mirr capture)

> **Evidence source:** `style.har` → `GET /api/v1/carousel-lab/presets` (HAR entry index 151). Response is 5.8MB, base64-encoded JSON containing 366 system presets. Decoded and analyzed on 2026-04-04.

The following preset architecture is **verified from Mirr's production API**, not guessed:

- **366 presets** exist, all `isSystem: true` in the captured account
- a preset contains **1 to 10 reference HTML templates** (not one). Distribution: 73 presets have 1 template, 129 have 5, 29 have 10
- each template is a **complete HTML document** (`<!DOCTYPE html>` with embedded CSS, Google Fonts `@import`, inline styles, fixed pixel dimensions like `1080x1350` for 4:5)
- the `styleGuide` is a **structured JSON object** with exactly 6 fields, not free-form text
- `designPatterns` is a **string array of human-readable design rules** (e.g. "Thick black borders (3-4px)", "Zig-zag process timelines", "Arched image frames") — these are injected into the generation prompt
- `exampleImages` are **pre-rendered screenshot URLs** on `storage.mirra.my`, keyed by language (`en`, `ko`). These are the gallery thumbnails
- `category` is a nullable string, one of: `null`, `"business"`, `"design"`, `"education"`, `"lifestyle"`, `"marketing"`, `"tech"`
- 17 presets are `isFeatured: true`
- the **entire gallery is loaded in one GET request** with no pagination. At 366 presets / 5.8MB this is acceptable for our V1 with far fewer presets
- "Train New Style" did not trigger an API call in the capture, but the data shape implies user-created presets would be the same record with `isSystem: false` and a `workspaceId`

### Seeding Presets

V1 presets are **seeded by us ahead of time**. They are system presets, not user-authored presets. Each preset is a pack of reference HTML templates representing a consistent visual style.

The preset library should start small and curated:

- 5-10 built-in presets for launch
- clear category labels
- pre-rendered example image(s) per preset for the gallery
- one stable style guide per preset
- core launch presets should not rely on photo search to look complete
- most launch presets should still look intentional if an image slot falls back to a gradient, texture, blur, or branded placeholder

For internal prototyping only, we may temporarily use Mirr-derived placeholder HTML as seed material so the UI and generation pipeline have realistic examples. Those placeholders should be treated as temporary scaffolding, not the permanent shipped preset library.

### Preset Data Model (verified from Mirr, adapted for our DB)

```typescript
interface HtmlDesignPreset {
  id: string;                          // UUID
  accountId: string | null;            // null for system presets, workspace UUID for user-created
  name: string;
  localizedName?: Record<string, string>;  // e.g. { en: "...", ko: "..." }
  description: string;
  localizedDescription?: Record<string, string>;
  aspectRatio: '1:1' | '4:5' | '3:4' | '16:9' | '9:16';
  templates: Array<{
    html: string;                      // complete HTML document (1-10 per preset)
  }>;
  styleGuide: {
    fontFamily: string;                // e.g. "Noto Sans KR", "Jua"
    primaryColor: string;              // hex, e.g. "#1D2B64"
    secondaryColor: string;            // hex
    accentColor: string;               // hex
    backgroundColor: string;           // hex
    designPatterns: string[];           // human-readable design rules array
  };
  exampleImages?: Record<string, string[]>; // per-language screenshot URLs, e.g. { en: ["url"], ko: ["url"] }
  thumbnailUrl?: string;               // convenience shortcut (first exampleImage or dedicated thumb)
  isSystem: boolean;
  isFeatured: boolean;
  featuredOrder?: number | null;
  category?: string | null;            // "business" | "design" | "education" | "lifestyle" | "marketing" | "tech" | null
  createdAt: string;
  updatedAt: string;
}
```

**Key differences from our earlier draft:**

| Field | Old plan | Verified from Mirr |
|-------|----------|--------------------|
| `templates` | assumed singular or typed by `pageType` | array of `{ html }`, 1-10 per preset, no `pageType` |
| `styleGuide` | correct shape but undocumented | exactly 6 fields: `fontFamily`, `primaryColor`, `secondaryColor`, `accentColor`, `backgroundColor`, `designPatterns[]` |
| `localizedName` / `localizedDescription` | missing | present, keyed by language |
| `exampleImages` | missing | per-language array of screenshot URLs |
| `isFeatured` / `featuredOrder` | missing | controls gallery ordering |
| `category` | present but values unverified | verified: 6 string values + null |

### "Train New Style" (future scope, not V1)

Based on the data shape, "Train New Style" / "Create your own design from reference images" creates a new preset record with the same structure but `isSystem: false` and a `workspaceId` / `userId`. This is **not** ML fine-tuning. It is preset authoring — the user provides reference images/HTML, and the system extracts a `styleGuide` + `templates` bundle.

This is explicitly out of scope for V1. All V1 presets are system-seeded.

### Preset Selection Flow

1. After project creation with `html` type, the user first generates html copy
2. Shared entry modals may still show saved-prompt selection for html; in v1 that resolves against the Regular prompt pool behind the scenes
3. Once html copy exists, the user is prompted to pick a preset
4. Gallery modal loads all system presets in one request (no pagination for V1)
5. Gallery supports category filtering and aspect-ratio filtering (client-side for V1)
6. Each preset card shows an example image, name, and category badge
7. User selects → `html_preset_id` and `html_style_guide` are stored on the project
8. Generate Slides uses the html copy draft plus the preset's reference HTML templates and style guide as the visual direction

---

## 10. Implementation Phases

### Phase 1: Foundation (DB + Type System + Routing)

**Goal:** Establish `html` as a first-class project type that can be created, loaded, and routed into a dedicated HTML runtime without destabilizing the existing Regular/Enhanced editor.

**Tasks:**
1. **Migration file** — `YYYYMMDD_add_html_template_type.sql`:
   - Create `html_design_presets` table (must come first — FK dependency)
   - ALTER `carousel_projects` to add `html_preset_id`, `html_style_guide`, `html_generation_status`, `html_generation_id`
   - Create `html_project_slides` table with triggers
   - RLS policies for both new tables
   - Seed initial built-in presets
2. **TypeScript type updates** — Add `'html'` to the canonical client type in `src/features/editor/store/types.ts` and to any server-side aliases such as `src/app/api/editor/_utils.ts`
3. **Shared validation/bootstrap updates** — Update the shared routes, services, and store/bootstrap paths listed in §3B–§3E so html projects are accepted, loaded, and not coerced back to regular/enhanced
4. **Runtime router + html shell** —
   - Add `src/app/editor/EditorRuntimeRouter.tsx`
   - Show a neutral loading state until bootstrap/load resolves the actual `templateTypeId`
   - Route `regular`/`enhanced` to the current `EditorShell.tsx`
   - Route `html` to `src/features/html-editor/components/HtmlEditorShell.tsx`
   - Add TODO/breadcrumb comments in both files that the current `EditorShell.tsx` is a temporary legacy Fabric runtime and should later be renamed/extracted to `FabricEditorShell.tsx`
5. **Template type picker** — Add "HTML" option to `EditorSidebar`, `SwipeIdeasPickerModal`, `CarouselMapProjectPickerModal`, `IdeasModal`, and `SwipeFileModal`
6. **Create `src/features/html-editor/`** directory structure for shell, preview, bottom panel surface, right-side inspector, presets, store, parser, serializer, and export

**Verification:** User can create an `html` project from any supported v1 entry point. The router mounts `HtmlEditorShell.tsx` instead of the legacy Fabric `EditorShell.tsx`, and no Fabric-only hooks are invoked for the html path.

### Phase 2: Presets + Generation + Preview

**Goal:** Let the user generate html copy first, then pick a built-in preset, then generate HTML slides and view them in iframe previews inside the familiar dotted workspace.

**Tasks:**
1. **HTML copy branch:**
   - Update `generate-copy/route.ts` so html is an explicit branch, not a coercion
   - Define/build the `HtmlCopyDraft` shape from project source material
   - In shared html entry flows, keep prompt-selection UI visible but resolve prompt content from the Regular prompt pool in v1
   - Persist enough structured copy on the project/slides so the later `generate-slides` call can deterministically build `PROJECT_TITLE` / `CAROUSEL_TEXTLINES`
2. **Preset system:**
   - `GET /api/editor/html-projects/presets` — list built-in system presets for V1
   - `GET /api/editor/html-projects/presets/[id]` — get preset detail
   - `HtmlPresetGallery.tsx` — modal showing preset thumbnails in a grid
   - Seed 5-10 curated presets with reference HTML + style guides
3. **Generate Slides API:**
   - `POST /api/editor/html-projects/generate-slides`
   - Convert `HtmlCopyDraft` into the `PROJECT_TITLE` / `CAROUSEL_TEXTLINES` format from §7a2
   - Assemble the backend provider-facing prompt using the reconstructed structure from §7a3
   - System prompt construction from preset + copy + style guide
   - Validate and normalize model output per §7a4 before streaming/persisting
   - Anthropic streaming → SSE relay to client
   - Write generated HTML to `html_project_slides`
4. **Client-side SSE consumer:**
   - `useHtmlSlideGeneration.ts`
   - Parse SSE events, update Zustand store per page
   - Show loading skeletons while generating
5. **Iframe preview rendering:**
   - `fontOptimizer.ts`
   - `htmlDocumentWrapper.ts`
   - `HtmlSlidePreview.tsx`
   - LRU cache for processed HTML
6. **Slide strip navigation:**
   - `HtmlSlidesStrip.tsx`
   - Thumbnail-based active slide switching
7. **Zustand store:**
   - `htmlEditorStore.ts` with pages, active page, selected element, `htmlGenerationId`, generation state, preset, and UI state
   - SSE consumer must tolerate `totalPages: -1` during streaming and only treat the total as final after the `complete` event

**Verification:** User generates html copy → picks a preset → clicks "Generate Slides" → sees 6 HTML slides appear one by one in iframe previews → can switch slides from the thumbnail strip.

### Phase 3: Integrated Editing Workspace

**Goal:** Deliver the V1 HTML editing workspace with the same product identity as the current editor: bottom project tools retained, right-side inspector added, selected-element editing functional.

**Tasks:**
1. **Workspace composition:**
   - Keep the same dotted center workspace feel
   - Keep a dedicated HTML bottom panel for caption, logs, generate-copy workflow, and project-level status
   - Add a right-side inspector for selected-element editing
2. **Interaction script:**
   - Write `interactionScript.ts` and inject it into every iframe
   - Implement click selection, drag, resize, rotate, text editing, and parent communication
3. **Parser + serializer:**
   - `elementParser.ts` for element discovery and `data-editable-id` injection
   - `useHtmlElementSerializer.ts` / save pipeline for clean persisted HTML
4. **Right-side inspector:**
   - `HtmlElementEditor.tsx` for selected text/image/block editing
   - `HtmlElementList.tsx` for optional element navigation
   - Text content and text styling both live in this inspector
5. **Bottom project tools surface:**
   - `HtmlCaptionEditor.tsx`
   - project-level logs/status
   - generate-copy workflow entry points
6. **AI Designer UI shell:**
   - `HtmlAiDesigner.tsx` tab is visible but disabled in V1
   - Include placeholder quick actions and disabled prompt field
   - Clearly mark as coming soon
7. **Save behavior:**
   - `PATCH /api/editor/html-projects/save-slides`
   - explicit save + auto-save

**Verification:** User can click an element in the iframe → see it selected → edit text/style/properties on the right → use the bottom panel for caption/logs/copy workflow → save and reload successfully.

### Phase 4: Export + V1 Polish

**Goal:** Make the V1 loop complete: generate, edit, save, and export.

**Tasks:**
1. **Render/export route:**
   - `POST /api/editor/html-projects/render`
   - Puppeteer + `@sparticuz/chromium`
   - sanitize and screenshot HTML
2. **Top-bar export actions:**
   - "Download All" → zip export
   - optional single-slide blob render for previews/downloads
   - hide unsupported PDF export for html
3. **Workspace guardrails:**
   - unsaved changes confirmation
   - partial-generation retry flow
   - keyboard shortcuts, undo/redo, session persistence
4. **UI polish:**
   - maintain visual continuity with current editor shell
   - keep right-side inspector secondary and uncluttered
   - keep AI Designer visibly present but disabled

**Verification:** User can complete the full V1 flow: create HTML project → pick preset → generate copy → generate slides → edit → save → export images.

---

## 11. Interaction Script — Complete Specification

This is the JavaScript that gets injected into every slide iframe. It is NOT generated by AI — we write it once and inject it into every iframe's `<head>`. It handles all user interaction.

### Injection Method

```typescript
const iframeDoc = iframe.contentDocument;
const script = iframeDoc.createElement('script');
script.textContent = INTERACTION_SCRIPT_SOURCE;  // compiled from interactionScript.ts
iframeDoc.head.appendChild(script);
```

### Script Responsibilities

1. **CSS injection** — Inject the editable-element CSS from §6 (`[data-editable-id]` hover/active/editing styles)
2. **Click handler** — `document.addEventListener('click')` → find closest `[data-editable-id]` → `postMessage({ type: 'element-click', id })`. Click on empty space → `{ id: null }`.
3. **Drag handler** — Mousedown on `[data-editable-id]` (except during text edit) → 5px movement threshold → apply `transform: translate(Xpx, Ypx)` during mousemove → snap guides (see below) → on mouseup → `postMessage({ type: 'element-move', id, translateX, translateY })`
4. **Snap guide system** — During drag, check alignment against:
   - Page center (horizontal and vertical)
   - Page edges (6px inset)
   - Other element edges and centers
   - Threshold: 6px. When within threshold, snap to guide and show a 1px blue line.
5. **Selection UI** — When parent sends `{ type: 'highlight', id }`:
   - Set `outline: 3px solid #3b82f6; outline-offset: 2px` on target
   - Create `#sel-overlay` (position: fixed) with 4 corner resize handles (10px white squares, blue border) + rotation handle (12px blue circle above element)
   - Remove previous selection UI
6. **Resize handler** — Mousedown on `[data-resize-handle]` → compute new width/height maintaining aspect ratio (if shift held) → on mouseup → `postMessage({ type: 'element-resize', id, width, height })`
7. **Rotation handler** — Mousedown on `[data-rotate-handle]` → compute angle from element center to mouse → on mouseup → `postMessage({ type: 'element-rotate', id, rotate })`
8. **Double-click handler** — On `<span>[data-editable-id]`: set `contentEditable=true`, select all text, show floating toolbar. On `<div>`: do nothing (divs can't be text-edited).
9. **Floating rich-text toolbar** — Created as a div above the active element. Buttons: Bold, Italic, A- (decrease font), A+ (increase font), Color picker + 9 dots. Uses `document.execCommand()` for formatting.
10. **Text blur handler** — On blur of contentEditable element: set `contentEditable=false`, send `element-text-update` or `element-richtext-update`, hide toolbar.
11. **Parent message listener** — `window.addEventListener('message')` for: `highlight`, `update-element`, `update-elements`, `update-font-css`
12. **Element update applicator** — `applyElementUpdate(el, update)` function: maps update properties to DOM style mutations. For text: `textContent` or `innerHTML`. For images: `background-image` or `src`. For position: `transform`. For styles: direct `el.style[prop]` assignment.
13. **Font CSS injector** — `update-font-css` message → create `<style>` tag in `<head>` with the received CSS (new `@font-face` rules or Google Fonts `<link>` tags)

### Versioning and Cache-Busting

- The interaction script is compiled at build time and embedded as a string constant with a content hash
- Every iframe document write re-injects the latest version of the script
- The parent includes `data-script-version="${SCRIPT_HASH}"` on the `<html>` element
- There is no hot-update for already-rendered iframes — the user must switch slides or reload

### Origin Validation

- The parent message listener validates `event.source === iframeRef.current?.contentWindow` before processing
- The iframe message listener validates `event.origin === expectedParentOrigin` (passed via `data-parent-origin` attribute on `<html>`)
- Messages from unexpected origins are silently dropped

### What the Script Does NOT Do

- Does NOT contain any React code
- Does NOT make any network requests
- Does NOT access localStorage or cookies
- Does NOT modify the document structure (only styles and attributes)
- Does NOT execute any AI-generated code

---

## 12. State Management (Zustand Store)

```typescript
interface HtmlEditorState {
  // Project
  projectId: string | null;
  htmlGenerationId: string | null;
  presetId: string | null;
  styleGuide: StyleGuide | null;
  aspectRatio: AspectRatio;

  // Pages
  pages: Map<number, PageState>;       // pageIndex → { baseHtml, elements, previewHtml, title }
  activePageIndex: number;
  totalPages: number;

  // Selection
  selectedElementId: string | null;
  hoveredElementId: string | null;

  // UI State
  rightTab: 'edit' | 'ai-designer';
  isGenerating: boolean;
  isRefining: boolean;
  isSaving: boolean;
  isDirty: boolean;                    // unsaved changes exist

  // History
  history: { past: HistoryEntry[], future: HistoryEntry[] };

  // Actions
  setActivePage: (index: number) => void;
  selectElement: (id: string | null) => void;
  updateElement: (pageIndex: number, elementId: string, updates: Partial<HtmlSlideElement>) => void;
  setPageHtml: (pageIndex: number, html: string, elements: HtmlSlideElement[]) => void;
  addElement: (pageIndex: number, type: 'text' | 'image' | 'logo') => void;
  deleteElement: (pageIndex: number, elementId: string) => void;
  duplicateElement: (pageIndex: number, elementId: string) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
}

interface PageState {
  baseHtml: string;                    // original HTML before element parsing
  elements: HtmlSlideElement[];        // parsed element list
  previewHtml: string;                 // processed HTML (font-optimized, document-wrapped)
  title: string;                       // page title from AI
  thumbnailUrl?: string;               // rendered thumbnail
}
```

---

## 13. Risk Assessment

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| 1 | Breaking existing Regular/Enhanced flows | Critical | Low | Html rendering/editing behavior is isolated in new files, but shared-path changes listed in §3 are still required. Use a thin runtime router so html never mounts the legacy Fabric `EditorShell.tsx`, and run the full regression test suite on Regular/Enhanced after each phase. |
| 2 | Puppeteer in production (Vercel) | High | Medium | Use `@sparticuz/chromium` (tested on Vercel serverless). Fallback: external rendering service (html.to.design API, Browserless.io). Can be deferred to Phase 4 entirely — manual screenshots suffice for testing. |
| 3 | AI HTML quality inconsistency | High | High | Strong system prompts with explicit dimensional constraints + reference HTML templates from presets. Refinement loop lets users fix issues. Add validation: reject HTML where root div dimensions don't match aspect ratio. |
| 4 | Font rendering differences (iframe vs Puppeteer export) | Medium | Medium | Font blocking pipeline (§6g) forces web fonts in both environments. Font-ready signaling before screenshot. Test with 10+ diverse presets during Phase 2. |
| 5 | Element parser fragility with diverse AI output | Medium | High | Conservative parsing — only identify elements with `data-editable-id` or clear visual roles. Unknown elements are simply not editable in V1 (user falls back to manual edits or regeneration). Parser has a `try/catch` per element — one bad element doesn't crash the whole slide. |
| 6 | Large HTML strings in DB (each slide ~5-20KB) | Low | Medium | 6 slides × 20KB = 120KB per project — manageable. If it grows: compress with `pako` before storage, or move HTML to Supabase Storage (S3) with reference URLs. |
| 7 | SSE connection drops mid-generation | Medium | Medium | Persist streamed pages as they arrive, mark the project as `'partial'` on stream drop, and show a full "Retry Generation" action. V1 does NOT resume from an intermediate page. |
| 8 | iframe sandbox security | Medium | Low | `sandbox="allow-same-origin allow-scripts"` only. No `allow-forms`, `allow-popups`, `allow-top-navigation`. The interaction script is injected by US, not by the AI. AI-generated and user-edited HTML is sanitized per §16 at persistence, iframe write, and export render: strip `<script>`, `on*` handlers, `javascript:` URLs, unsafe SVG constructs, `srcdoc`, `foreignObject`, and editor-only nodes. |
| 9 | Cross-origin image loading in iframes | Medium | Medium | Images must be served from our domain or CORS-enabled CDNs. For user uploads, proxy through our API or serve from Supabase Storage. For AI-searched images, upload to our storage first. |
| 10 | Vercel function timeout for rendering | Medium | Medium | Rendering 6 slides can take 15-20s. Set function `maxDuration: 60`. Render in parallel (6 browser pages, not sequential). If still too slow, move to a dedicated rendering worker. |
| 11 | Mobile responsiveness of the editor | Low | High | The editor is desktop-only (same as current editor). Show "Please use desktop" message on mobile. The exported images are what end up on mobile social feeds. |
| 12 | Conflict between interaction script and AI-generated CSS | Medium | Medium | Interaction script styles use `!important` and very high z-index (`2147483000`). Selection overlay uses fixed positioning. These override any AI CSS. |
| 13 | Anthropic model costs for HTML generation | Low | Low | Each generation = ~4K input tokens (system prompt + copy + preset) + ~8K output tokens (6 slides). At $15/M output tokens ≈ $0.12 per generation. Refinement is cheaper (~2K output per slide). This is comparable to existing Generate Copy costs. |

---

## 14. What We're NOT Doing

- NOT modifying Fabric.js code, `CarouselPreviewVision`, `wrapFlowLayout`, or any existing rendering
- NOT changing the `EditorBottomPanel` or `EditorSlidesRow` for existing types
- NOT touching the existing template system (template snapshots, template IDs, content insets)
- NOT migrating existing projects to the new type
- NOT removing or deprecating Regular/Enhanced
- NOT sharing any React components between the html editor and the existing editor (except the sidebar and top bar)
- NOT building a custom design tool (Figma, Canva) — the AI generates designs; the editor is for tweaks
- NOT supporting animations or video in HTML slides
- NOT building a mobile editor
- NOT allowing users to write raw HTML/CSS (they interact through the property editor and generation workflow)

---

## 15. Glossary

| Term | Definition |
|------|-----------|
| **Preset** | A collection of 3-6 reference HTML templates + a style guide that defines a visual style. The AI uses these as examples when generating new slides. |
| **Style Guide** | JSON object with `primaryColor`, `secondaryColor`, `accentColor`, `backgroundColor`, `fontFamily`, `designPatterns[]`. Extracted from a preset's templates. |
| **Interaction Script** | Our JavaScript (NOT AI-generated) injected into each iframe to enable drag/resize/text editing. Communicates with parent via `postMessage`. |
| **Element** | A parsed visual component from the HTML — text span, image slot, background div, or structural div. Identified by `data-editable-id`. |
| **Image Slot** | A div with `class="image-slot"` that serves as a placeholder for background images. May include `data-search-query` for future image workflows. |
| **Base HTML** | The raw HTML string as received from AI generation, before any user edits. |
| **Preview HTML** | The processed HTML (font-optimized, document-wrapped) ready for iframe rendering. |
| **Manual Edits** | A human-readable diff summary of user changes (moves, text edits, style changes) sent to AI during refinement so it preserves user intent. |
| **Page** | A single slide in the carousel. Equivalent to `carousel_project_slides` + `html_project_slides`. |

---

## 16. HTML Sanitization Spec

Sanitization is **mandatory** in three places: (1) server-side after AI generation before persistence, (2) client-side before writing HTML into iframe, (3) server-side before Puppeteer render/export.

### What to strip

| Threat | Example | Stripping rule |
|--------|---------|---------------|
| Script tags | `<script>alert(1)</script>` | Remove all `<script>` elements and their content |
| Inline event handlers | `onclick="..."`, `onerror="..."` | Remove all `on*` attributes from every element |
| JavaScript URLs | `href="javascript:..."`, `src="javascript:..."` | Remove any `href`, `src`, `action`, `formaction`, `xlink:href` attribute whose value starts with `javascript:` (case-insensitive, after trimming) |
| SVG scriptability | `<svg><script>`, `<svg onload="...">` | Apply same script/on* stripping inside SVG content |
| `srcdoc` | `<iframe srcdoc="...">` | Remove `srcdoc` attributes entirely |
| `<foreignObject>` | SVG with embedded HTML | Remove `<foreignObject>` elements |
| Data URLs | `src="data:text/html,..."` | Remove `src` attributes containing `data:text/html` |
| Rich-text innerHTML | User types `<img onerror=alert(1)>` in contentEditable | Sanitize inline editing output before persistence (strip on* attrs, scripts) |
| Editor-only attributes | `data-editable-id`, `data-editor-overlay-root` | Strip before export render (NOT before preview — preview needs them) |

### Server-side parser library

The render route (`/api/editor/html-projects/render`) runs in Node.js and needs DOM manipulation (strip attributes, remove elements, restore SVGs). Use **`linkedom`** (lightweight, fast, ESM-compatible, no native deps). NOT jsdom (too heavy for serverless). NOT cheerio (jQuery-style API doesn't support full DOM).

```typescript
import { parseHTML } from "linkedom";
const { document } = parseHTML(html);
// strip scripts, on* handlers, etc.
const clean = document.documentElement.outerHTML;
```

### postMessage origin validation

Both parent and iframe message listeners MUST validate `event.origin`:

```typescript
// Parent listener
window.addEventListener('message', (e) => {
  if (e.source !== iframeRef.current?.contentWindow) return;
  // process message...
});

// Iframe listener (injected script)
window.addEventListener('message', (e) => {
  if (e.origin !== expectedParentOrigin) return;
  // process message...
});
```

The parent origin is passed to the iframe via a `data-parent-origin` attribute on the `<html>` element when the document is written.

---

## 17. UI Specifications (Reconciled V1)

### 17a. HTML Bottom Panel (project-level tools)

The current Fabric-specific `EditorBottomPanel.tsx` is **not mounted as-is** for HTML projects, but its workspace role is preserved through a dedicated HTML bottom panel.

This bottom panel is the project-level tools surface for V1. It contains:

- a collapsible **Caption** section
- debug logs / generation status
- Generate Copy workflow controls
- project-level messaging and state

Caption remains project-level:

- it writes to `carousel_projects.caption`
- `HtmlCaptionEditor.tsx` reads/writes project metadata via the existing project update API
- it is not tied to `html_project_slides`

### 17b. Right-Side Inspector (selected-element editing)

The right side is a **secondary inspector**, not the dominant layout.

Its purpose is to edit the currently selected element from the iframe preview.

When a text element is selected, the inspector shows:

- text content
- font family
- font size
- font weight
- color
- line height
- letter spacing
- alignment

When an image/block element is selected, the inspector shows:

- size
- position
- rotation
- opacity
- border radius
- object-fit / image behavior where applicable

### 17c. Preset Gallery Modal

| Property | Value |
|----------|-------|
| Layout | Responsive grid: 3 columns on wide screens, 2 on narrow |
| Card content | Preset thumbnail, name, category badge, aspect ratio label |
| Filtering | Category tabs at top: "All", "Professional", "Creative", "Minimal", etc. |
| Search | Text search by name/description (client-side filter for v1) |
| Selection | Click card → highlight → "Use This Preset" button at bottom |
| V1 data source | Built-in system presets seeded by us |
| Empty state | "No presets match your search" with "Reset filters" link |

### 17d. AI Designer Tab (visible, disabled in V1)

The AI Designer tab remains visible in the right-side inspector because we want the UI to feel ready for future refinement workflows, but it is **non-functional in V1**.

V1 behavior:

- tab is visible alongside `Edit`
- quick-action chips may be shown visually but disabled
- freeform prompt input may be shown visually but disabled
- body copy should clearly say "Coming soon" or "AI design refinements are not available in v1"
- no backend requests fire from this tab

### 17e. Top Bar Behavior for HTML Projects

When `templateTypeId === "html"`:

- "Download All" dispatches to `POST /api/editor/html-projects/render` with `format: "zip"`
- "Download PDF" is hidden for v1
- progress UI shows during rendering
- mobile can show an "Open on desktop to edit" message while still allowing limited export viewing if desired

### 17f. Image Workflows (deferred from V1)

Image slots may still exist in generated HTML and may still carry future-facing metadata such as `data-slot-id`, `data-slot-type`, `data-slot-label`, and optional `data-search-query`.

V1 includes a **silent best-effort server-side prefill step** for image slots, but does **not** include user-facing image search or replacement UX.

V1 behavior:

- after HTML generation and validation, the server may inspect `.image-slot` nodes before the HTML is persisted and streamed back to the client
- for `background` and `main` slots with `data-search-query`, the server may request one stock image from a single provider and write that URL into the slot's inline `background-image`
- `logo` slots are not auto-filled from stock search in V1
- if no image is found quickly, generation continues with a polished fallback (gradient, texture, blur, or branded placeholder) instead of an empty gray box
- the user does not see search results, pagination, provider choice, or a "search again" control in V1

However, V1 does **not** include:

- image search modal
- image search API
- multi-source asset search
- logo-library integration beyond future scaffolding
- manual "replace image" search flow

These flows move to `docs/HTML_TEMPLATE_TYPE_FUTURE_SCOPE.md`.

**V1 implementation rule:** The launch experience should combine:

- a curated preset library that does not depend heavily on photography to look good
- a lightweight server-side prefill step for `background` and `main` slots when possible

We should not ship a preset library where the default experience is a screen full of unresolved gray placeholder boxes.

### 17f1. Engineering Rules For V1 Silent Slot Prefill

This is the minimum implementation rule set for engineering. It should stay **compatible with Mirr's proven slot/search model** so we can add the full feature later without changing the HTML contract.

**Input contract (same slot shape we already use in generated HTML):**

- discover slots via `.image-slot`
- read `data-slot-id`, `data-slot-type`, `data-slot-label`, optional `data-search-query`
- preserve the AI-generated slot wrapper exactly; do not replace slots with a second schema

**Eligibility rules:**

- eligible slot types in V1: `background`, `main`
- ineligible slot type in V1: `logo`
- if `data-search-query` is missing or empty, skip prefill and keep the fallback visual
- if the slot already has a non-placeholder image URL, do not overwrite it

**Lookup rules:**

- use exactly one provider adapter in V1
- request one primary candidate image per eligible slot
- keep the timeout budget short so image lookup cannot stall slide generation
- if lookup fails, times out, or returns unusable data, continue generation without surfacing an error to the user

**HTML mutation rules:**

- write the chosen URL back into the slot's inline `background-image`
- preserve existing inline `background-size`, `background-position`, `border-radius`, dimensions, and transform values
- do not inject new editor-only attributes
- do not remove `data-search-query`; future search/replacement still needs it

**Fallback rules:**

- fallback must look intentional: gradient, texture, blur, or branded placeholder
- avoid shipping unresolved plain gray boxes as the normal default experience
- export/render uses the same final HTML the editor sees; do not apply one fallback in the editor and a different one at export time

**Mirr-compatibility rule:**

- even though V1 has no user-facing search UI, the pipeline should conceptually mirror Mirr's `searchedImagesBySlot` behavior: the server resolves imagery from slot metadata and returns finished HTML with slot images already filled when possible
- if we keep any internal debug metadata for prefills, prefer a Mirr-shaped per-slot mapping keyed by slot identity/query so later migration to full image search is straightforward

**Tiny internal adapter contract (V1):**

```typescript
type HtmlSlotType = "background" | "main" | "logo";

type ResolveSlotImageInput = {
  projectId: string;
  pageIndex: number;
  slotId: string;
  slotType: HtmlSlotType;
  slotLabel: string;
  searchQuery?: string | null;
  currentImageUrl?: string | null;
  aspectRatio: "1:1" | "4:5" | "3:4" | "16:9" | "9:16";
};

type ResolveSlotImageResult =
  | {
      status: "filled";
      imageUrl: string;
      source: string; // provider identifier, e.g. "pexels"
      sourcePageUrl?: string | null;
      attributionText?: string | null;
      width?: number | null;
      height?: number | null;
      matchedQuery: string;
    }
  | {
      status: "fallback";
      imageUrl: string; // gradient/texture/branded placeholder asset
      reason: "missing-query" | "ineligible-slot" | "timeout" | "not-found" | "provider-error";
      matchedQuery?: string | null;
    }
  | {
      status: "skipped";
      reason: "already-filled" | "logo-slot" | "no-slot-node";
    };

interface SlotImageResolver {
  resolveSlotImage(input: ResolveSlotImageInput): Promise<ResolveSlotImageResult>;
}
```

**Adapter usage rule:**

- generation-time prefill should call `resolveSlotImage()` once per eligible slot
- only `status: "filled"` should overwrite the slot's current placeholder URL
- `status: "fallback"` should write the returned fallback asset if the slot still has no usable image
- `status: "skipped"` should leave the slot unchanged
- if we later add slot-specific search APIs, their response shape should remain easy to derive from this adapter result plus Mirr-shaped `searchedImagesBySlot` metadata

**Non-goals for V1:**

- no search modal
- no pagination or cursors
- no source picker
- no upload flow
- no "search again"
- no user-visible attribution surface unless product requirements force it later

### 17g. Unsaved Changes Guard

When the editor has unsaved changes (`isDirty === true`):

- `window.addEventListener('beforeunload')` shows browser's native "Leave site?" dialog
- project-switching in the sidebar shows a custom "You have unsaved changes. Save before switching?" modal with Save / Discard / Cancel buttons
- export should auto-save first if required

---

## 18. State Management Edge Cases

### 18a. Auto-save vs Undo/Redo

- Auto-save persists current HTML without clearing the undo/redo history stack
- Undo/redo operates on in-memory page states, NOT on DB state
- If user undoes past the last auto-save point, `isDirty` becomes `true` again
- Save status indicator reflects divergence from persisted HTML, not "last change timestamp"
- Session-restored history is only applied if `projectId` and `htmlGenerationId` match the currently persisted project state

### 18b. Stale iframe postMessage Events

- When switching slides: unmount previous iframe, clear `selectedElementId`, ignore any late messages from the old iframe (check `event.source === currentIframeRef`)
- When switching projects: full state reset — clear all pages, elements, selection, history
- If future AI refinement is added later, it must flush any pending inline text edit before applying a new AI response

### 18c. Concurrent Operations

- **Export while dirty:** Auto-save first, then export. Show "Saving changes..." → "Rendering slides..."
- **Preset switch during generation:** Block preset changes while generating. Show "Generation in progress."

### 18d. Page Navigation During Editing

- Switching pages deselects the current element and closes any open inline text editing
- Right sidebar shows "No element selected" until user clicks an element on the new page
- Hovered element state is page-local (cleared on page switch)
- Any future slot-specific asset picker should close on page switch

### 18e. Future Image/Logo Workflows

Image lookup and richer asset replacement are deferred from V1. If those flows are added later:

- late asset responses must be discarded if the user has switched pages or deleted the target slot
- slot-targeting must remain page-specific
- the current V1 editor must not depend on search/upload completing
- the future search/replacement flow should extend or override the V1 silent prefill behavior, not create a second incompatible slot pipeline

---

## 19. Deployment & Performance

### 19a. Bundle Size

- The 147-font catalog and editor-side parsing should be **lazy-loaded** via `next/dynamic` — they are only needed when an HTML project is opened, not on editor load
- `HtmlEditorWorkspace` and all `src/features/html-editor/` components should be in a separate webpack chunk
- `interactionScript.ts` compiles to a string constant (~15KB) — acceptable inline

### 19b. Puppeteer / Chromium on Vercel

- `@sparticuz/chromium` adds ~50MB to the function bundle. The render route MUST be a separate Vercel function (its own `route.ts`) to not inflate other endpoints
- Set `maxDuration: 60` on the render route
- Set `memory: 1024` (MB) minimum for the render function
- Cold start: ~5-8 seconds for Chromium launch. Warm container reuses the browser instance.

### 19c. Font Loading in Puppeteer

- On every cold start, Puppeteer downloads Google Fonts from the `<link>` tags in the HTML
- There is NO persistent font cache across Vercel cold starts
- Mitigation: inline font CSS as `@font-face` with `woff2` URLs (faster than `<link>` with `display=swap`)
- Fallback: if a font fails to load within 5 seconds, Puppeteer proceeds with the system fallback. The exported image may differ slightly from the iframe preview.

### 19d. Concurrency / Backpressure

- V1: no explicit backpressure. Each render request launches its own Chromium instance.
- If concurrent render requests spike: Vercel's concurrency limits apply (default ~10 concurrent executions per function)
- Mitigation: client-side render queue — only one export at a time per user session. Show "Export in progress..." and disable the button.
- Monitor: track render duration and error rate. If p95 exceeds 30s, consider a dedicated rendering worker (Railway, Fly.io, or a Vercel cron-triggered queue).

### 19e. Server-Side DOM Library

The render route and save-validation need server-side HTML parsing. Use `linkedom`:
- Fast (~10x faster than jsdom)
- No native dependencies (works on Vercel serverless)
- ESM-compatible
- ~150KB bundle overhead

---

## 20. V1 Scope Decisions

These decisions resolve the audit's open questions:

| # | Question | V1 Decision |
|---|----------|-------------|
| 1 | Is html a first-class project type? | Yes. `html` appears in the same project-creation entry points as `regular` and `enhanced`. |
| 2 | Does html keep the same editor identity? | Yes. Keep the same shell, dotted workspace feel, centered slide area, and bottom project-tools surface. |
| 3 | Bottom panel or full right-heavy layout? | Keep a bottom-first layout. Add a right-side inspector as a secondary surface for selected-element editing. |
| 4 | Where does text editing live? | In the right-side inspector with the rest of selected-element editing. |
| 5 | How are presets sourced in v1? | Seeded by us ahead of time as built-in system presets. |
| 6 | Can Mirr HTML be used for placeholders? | Yes, as temporary internal placeholder material for prototyping only; replace with our own authored presets later. |
| 7 | Is AI Designer functional in v1? | No. The tab is visible in the UI but disabled / coming soon. |
| 8 | Is image lookup in v1? | User-facing image search is not in v1. Keep future-facing slot metadata, but defer search/replacement UX and APIs to future scope. |
| 8a | What if generated slides still contain image slots? | V1 uses a silent best-effort server-side prefill for `background` and `main` slots, plus a preset library that does not rely heavily on photography to look complete. |
| 9 | Block type switching to/from html? | Yes. `set-template-type/route.ts` returns 400 for html. Storage models are incompatible. |
| 10 | Clean or working HTML in DB? | Clean display HTML. Editor attrs stripped before save, re-injected on load. |
| 11 | Fixed 6 slides or variable? | Fixed 6 for v1. `CHECK (slide_index <= 5)`. Variable count is future scope. |
| 12 | Unified render endpoint? | Yes. One render endpoint handles zip/storage/blob via `format`. |
| 13 | Partial generation recovery? | V1: Retry the whole generation. No resumable partial generation. |
| 14 | Did we recover Mirr's exact hidden model prompt? | No. We recovered the browser ↔ app-server contract exactly, but not the server ↔ provider prompt text. |
| 15 | What is the current implementation rule for prompt assembly? | Reconstruct the provider-facing prompt from verified Mirr request/response behavior, preset references, and output constraints until further evidence is captured. |
| 16 | What is the runtime architecture for v1? | Add a thin `EditorRuntimeRouter.tsx`. It waits for bootstrap/load to resolve the actual `templateTypeId`, shows a neutral loading state until then, then decides shell ownership before mount: `regular`/`enhanced` use the current legacy `EditorShell.tsx`; `html` uses a dedicated `HtmlEditorShell.tsx`. |
| 17 | Do we refactor Regular/Enhanced into `FabricEditorShell` now? | No. Leave the current `EditorShell.tsx` in place for v1 to avoid destabilizing existing users. Add breadcrumb comments that it should later be renamed/extracted to `FabricEditorShell.tsx`. |
| 18 | Does html semantically inherit `regular` or `enhanced` copy behavior? | No. HTML is a first-class type. V1 uses the hybrid Path B flow, but `generate-copy/route.ts` must branch explicitly for `html` rather than silently coercing it to regular/enhanced. The html copy branch produces an explicit `HtmlCopyDraft` shape that is later converted into `PROJECT_TITLE` / `CAROUSEL_TEXTLINES`. |
| 19 | Does html use `jobs/start`? | No. `jobs/start/route.ts` stays Fabric-only in v1. Html generation flows through `generate-copy` and then `/api/editor/html-projects/generate-slides`. |
| 20 | Is Daily Digest → html in v1 scope? | No. Daily Digest continues to create Regular projects in v1 unless a later scoped change explicitly adds digest → html support. |
| 21 | What happens on mobile for html? | Phone editing is out of scope in v1. Show a desktop-only message rather than building a mobile html editor flow. |
| 22 | What do we show in the top bar for html? | Keep "Download All" wired to html ZIP export and hide "Download PDF" in v1. |
| 23 | Is html available from shared picker/create flows in v1? | Yes. `IdeasModal`, `SwipeIdeasPickerModal`, `CarouselMapModal`, `CarouselMapProjectPickerModal`, and related create-project flows may all create html projects in v1. |
| 24 | How does prompt selection work for html in shared flows? | Keep the saved-prompt UI visible. In v1, html resolves prompt content from the Regular saved-prompt pool behind the scenes rather than requiring html-specific prompt rows. |
| 25 | Does the user pick a preset before or after html copy exists? | After. V1 flow is copy first, preset second, then `generate-slides`. |

---

## 21. File-by-File Specification Summary

For quick reference, here's what each new file or critical shared file must implement:

| File | Input | Output | Key Logic |
|------|-------|--------|-----------|
| `EditorRuntimeRouter.tsx` | Bootstrap-resolved `templateTypeId` + shared editor context | Shell component | Shows a neutral loading state until bootstrap/load resolves the actual project type, then mounts legacy `EditorShell.tsx` for `regular`/`enhanced` or `HtmlEditorShell.tsx` for `html`, and contains TODO breadcrumb for future `FabricEditorShell` rename (§3, §20) |
| `HtmlEditorShell.tsx` | Shared editor/project context + html state | Full html editor runtime | Owns html workspace composition, html bottom panel, selected-element inspector wiring, html action handlers, and html-only hook graph (§3, §5, §10) |
| `EditorShell.tsx` | Existing regular/enhanced inputs | Legacy Fabric runtime | Temporary v1 owner of Regular/Enhanced only. Must include TODO breadcrumb that it should later be renamed/extracted to `FabricEditorShell.tsx` once the refactor is scheduled (§3, §20) |
| `elementParser.ts` | Raw HTML string | `{ elements[], html }` | DOMParser + TreeWalker, SVG extraction, ID injection (§6b) |
| `fontOptimizer.ts` | HTML string | Processed HTML string | Font scanning, Google Fonts injection, system font blocking (§6g) |
| `htmlDocumentWrapper.ts` | HTML fragment | Full `<!DOCTYPE html>` document | Wrap in html/head/body, add reset CSS, add font links |
| `htmlSanitizer.ts` | HTML string | Sanitized HTML string | Strip scripts, on* handlers, javascript: URLs, unsafe SVG (§16) |
| `interactionScript.ts` | (compiled to string) | Injected into iframe | Click/drag/resize/rotate/text-edit handlers, postMessage, origin validation (§11) |
| `htmlEditorStore.ts` | — | Zustand store | State management for pages, elements, selection, history (§12) |
| `HtmlSlidePreview.tsx` | `html: string` | Rendered iframe | Scale computation, ResizeObserver, script injection (§6h) |
| `HtmlElementEditor.tsx` | `element: HtmlSlideElement` | Property change callbacks | All controls from §6d |
| `HtmlElementList.tsx` | `elements: HtmlSlideElement[]` | Selectable list UI | Grouped by type, click-to-select |
| `HtmlAiDesigner.tsx` | — | Disabled UI shell | Visible-but-disabled tab, future refinement placeholder (§7b, §17d) |
| `HtmlPresetGallery.tsx` | Preset list | Selected preset ID | Grid with category tabs, search, selection (§17b) |
| `HtmlCaptionEditor.tsx` | Project caption | Updated caption | Extract from EditorBottomPanel, wire to existing save (§17a) |
| `HtmlBottomPanel.tsx` | Project caption + logs + copy status | Html project-tools surface | Html-specific bottom-first workflow area for caption, debug logs, generate-copy flow, and project-level messaging (§5, §17a) |
| `generate-slides/route.ts` | Copy + preset | SSE stream of HTML pages | Anthropic call, system prompt, generation status tracking (§7a) |
| `render/route.ts` | Pages[] + aspect ratio + format | JPEG/PNG/ZIP | Puppeteer + linkedom sanitization (§7d, §8, §16) |
| `save-slides/route.ts` | projectId + generatedPages[] | 200 OK | Upsert to `html_project_slides` (§7c) |
