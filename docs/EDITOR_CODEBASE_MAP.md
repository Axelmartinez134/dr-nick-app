# /editor Codebase Map

This is a practical map of the `/editor` code so changes can be made without searching the entire repo.

## Commit + push checklist (so it works the first time)
From the repo root:

- **Confirm branch + changes**

```bash
git status
git branch --show-current
```

- **Stage + commit**

```bash
git add -A
git commit -m "YOUR MESSAGE HERE"
```

- **Push to `main`**

```bash
git push origin main
```

If push fails with an HTTPS certificate error, switch the remote to SSH (more reliable in locked-down environments):

```bash
git remote -v
git remote set-url origin git@github.com:Axelmartinez134/dr-nick-app.git
git push origin main
```

## Quick orientation
- **Route**: `/editor`
- **Entry UI**: `src/app/editor/page.tsx` → renders `src/app/editor/EditorShell.tsx`
- **Route error boundary**: `src/app/editor/error.tsx` (prevents “blank screen” on crashes)
- **Core canvas**: `src/app/components/health/marketing/ai-carousel/CarouselPreviewVision.tsx` (Fabric.js)
- **Editor “engine” state**: `src/app/components/health/marketing/ai-carousel/useCarouselEditorEngine.ts`
- **Server APIs (editor)**: `src/app/api/editor/**/route.ts`

## How we edit `/editor` moving forward (preferred)
This guidance is **ONLY for `/editor`**. It’s intentionally high-level so it stays durable.

- **Prefer small, focused edits** that extend existing `src/features/editor/*` modules.
- **Prefer UI changes** in `src/features/editor/components/*`.
- **Prefer behavior/orchestration** in `src/features/editor/hooks/*`.
- **Prefer API calls** in `src/features/editor/services/*` (components/hooks call these).
- **Prefer types + pure state helpers** in `src/features/editor/store/*` and `src/features/editor/state/*`.
- **Prefer pure utilities** in `src/features/editor/utils/*`.
- **`src/app/editor/EditorShell.tsx`**: prefer keeping it as **composition/wiring** (calling hooks, publishing store slices), not a dumping ground.

### Soft guardrails (strongly prefer not to)
- **Do not reintroduce** giant mirrored blobs (legacy `workspace` / `bottomPanel` style).
- **Do not add** new “bridge sync” hooks unless unavoidable.
- **Do not add** new UI handler surfaces outside `state.actions` (prefer extending `state.actions`).

### Per-change checklist (copy/paste)
- [ ] Make the smallest change that fits the current `src/features/editor/*` structure
- [ ] Update `docs/EDITOR_CODEBASE_MAP.md` (map + any new files/ownership)
- [ ] Add a **Manual QA** section (6–10 bullets) specific to this change
- [ ] Run `npm run build` and confirm it passes
- [ ] Call out any new/changed editor state fields or actions
- [ ] If architecture changed, add/update an entry in **Architecture Decisions**

### Architecture Decisions (ADRs)

#### ADR-001: Single actions surface + no bottom-panel bridge hook
- **Title**: Single `state.actions` surface; bottom panel uses `bottomPanelUi` + `state.actions`
- **Context**: Needed a consistent handler surface and to avoid maintaining behavior in multiple “bridge” layers.
- **Decision**: Keep a stable `state.actions` contract (ref-dispatched) and publish bottom panel render-state as `bottomPanelUi`; remove the legacy `useEditorStoreWorkspaceSync` bridge.
- **Consequences**: One place to add handlers; bottom panel doesn’t need its own action slice; less mirroring surface area.
- **Date + commit hash**: 2026-01-19 — `9922a31`

## Auth + gating
- **Auth state + editor allowlist**: `src/app/components/auth/AuthContext.tsx`
  - Checks `public.editor_users` to set `isEditorUser`
- **/editor gate**: `src/app/editor/page.tsx`
  - Redirects to `/` if not authed
  - Shows “Access denied” if not in `editor_users`

## Refactor end-state (feature folder)
`src/app/editor/EditorShell.tsx` remains the route entry, but most editor logic now lives in `src/features/editor/`.

### Feature root
- `src/features/editor/`
  - `components/` (UI subcomponents)
  - `hooks/` (stateful orchestration)
  - `services/` (client-safe API callers)
  - `state/` (types + pure state helpers)
  - `store/` (selector-based editor store; Stage 2)
  - `utils/` (pure helpers)

## Current UI composition (after Stage 2 wiring)
At this point, **UI components read from the editor store**. `EditorShell.tsx` still owns the engine/orchestration, but store publishing is now split into:
- **Stable top-level actions** via `state.actions` (ref-dispatched)
- **Workspace slices** via `useEditorStoreWorkspaceRegistry` (refs + nav + UI + handlers for the slide strip/canvas)
- **Bottom panel UI slice** via `state.bottomPanelUi` (render-only state), with bottom panel handlers living in `state.actions`

- **Top bar**: `src/features/editor/components/EditorTopBar.tsx` (reads `state.*` + `state.actions`)
- **Left sidebar + saved projects**:
  - `src/features/editor/components/EditorSidebar.tsx` (reads store)
  - `src/features/editor/components/SavedProjectsCard.tsx` (reads store)
- **Modals**:
  - `src/features/editor/components/TemplateSettingsModal.tsx` (reads store)
  - `src/features/editor/components/PromptsModal.tsx` (reads store; `EditorShell.tsx` still owns textarea refs for focus)
- **Slides/workspace strip**: `src/features/editor/components/EditorSlidesRow.tsx` (reads `state.workspaceNav`, `state.workspaceRefs`, `state.workspaceUi`, `state.workspaceActions`)
  - **Empty-state placeholder centering**: keep placeholders `w-full h-full` (don’t hard-code 540×720) so “No template selected” stays centered at all display sizes
- **Bottom panel**: `src/features/editor/components/EditorBottomPanel.tsx` (reads `state.bottomPanelUi` + `state.actions`)

### Still route-adjacent
- `src/app/editor/EditorShell.tsx`: composition + wiring (calls hooks, renders layout)
- `src/app/editor/RichTextInput.tsx`: RichText editor widget

## Canvas + interactions (Fabric)
- **Canvas renderer & event wiring**: `src/app/components/health/marketing/ai-carousel/CarouselPreviewVision.tsx`
  - `contextTop` overlay drawing for debug overlays + Smart Guides
  - Drag/scale handlers for `user-text` and `user-image`
  - Post-render invariant enforcement (disabled in lock mode; can be suppressed during image drag when auto-realign is enabled)
- **Smart Guides helper (lock mode)**: `src/app/components/health/marketing/ai-carousel/smartGuides.ts`
  - Visual-only horizontal alignment guides (left/center/right)

## Rich text editor (bottom panel)
- **RichText component**: `src/app/editor/RichTextInput.tsx`
  - Emits `{ text, ranges }` (inline style ranges)
- **Bottom panel UI container**: `src/features/editor/components/EditorBottomPanel.tsx`
  - Render-only container for the Headline/Body RichText areas + other cards
- **On-canvas text styling persistence**: `src/features/editor/hooks/useCanvasTextStyling.ts`
  - Tracks Fabric `user-text` selection + applies bold/italic/underline/clear without dropping selection
  - Persists marks into `input_snapshot.*StyleRanges` via the existing `applyInlineStyleFromCanvas` path

## Editor feature modules (what was extracted)
### Bootstrap + hydration (Stage 3A)
- **Hook**: `src/features/editor/hooks/useEditorBootstrap.ts`
  - Calls `POST /api/editor/initial-state` and hydrates templates/projects/template-type effective settings
  - Handles auto-load most recent project or auto-create Enhanced project

### Projects
- **UI**: `src/features/editor/components/SavedProjectsCard.tsx`
- **Hook**: `src/features/editor/hooks/useProjects.ts`
- **API**: `src/features/editor/services/projectsApi.ts`

### Project lifecycle (Stage 3B)
- **Hook**: `src/features/editor/hooks/useProjectLifecycle.ts`
  - Owns `loadProject` and `createNewProject` + slide hydration from `carousel_project_slides`

### Project meta persistence (Stage 3C)
- **Hook**: `src/features/editor/hooks/useEditorPersistence.ts`
  - Debounced `title` + `caption` saves to `POST /api/editor/projects/update`

### Slide persistence
- **Hook**: `src/features/editor/hooks/useSlidePersistence.ts`
- **API**: `src/features/editor/services/slidesApi.ts`

### Slide state + editor flags
- **Types/init**: `src/features/editor/state/slideState.ts`
- **Persisted flags helpers**: `src/features/editor/state/editorFlags.ts`
  - `layoutLocked` and `autoRealignOnImageRelease` live under `input_snapshot.editor.*`

### Image ops + auto realign on release
- **Auto realign scheduler**: `src/features/editor/hooks/useAutoRealignOnImageRelease.ts`
- **Image ops**: `src/features/editor/hooks/useImageOps.ts`
  - Upload pipeline: `uploadImageForActiveSlide(...)`
  - Phase 2: Recents insert pipeline: `insertRecentImageForActiveSlide(...)`

### Generation jobs
- **Generate Copy**: `src/features/editor/hooks/useGenerateCopy.ts`
- **Generate Image Prompts**: `src/features/editor/hooks/useGenerateImagePrompts.ts`
- **Generate AI Image**: `src/features/editor/hooks/useGenerateAiImage.ts`
- **Wiring wrapper (Stage 3D)**: `src/features/editor/hooks/useEditorJobs.ts` (centralizes how the three job hooks are wired together)
  - Phase 2: AI image success also “touches” Recents so generated PNGs show up in the Image Library modal

### Image Library modal (Phase 1/2: Upload + Recents)
- **Modal UI**: `src/features/editor/components/ImageLibraryModal.tsx`
  - Sections:
    - Upload (file picker)
    - Recents (grid of tiles, user-scoped)
    - Logos (VectorLogoZone; Phase 3C/3D/3E)
  - Close behaviors: outside click, Escape key, close button
  - Modal BG toggle:
    - default OFF (resets on open/close)
    - controls **BG removal at insert-time** for both Upload and Recents insert
  - UX nuance:
    - if modal BG toggle is ON when clicking a recent: modal stays open and shows a spinner until BG removal finishes

#### Logos (Phase 3: VectorLogoZone)
- **Catalog ingestion (manual)**:
  - Script: `scripts/logo_catalog/ingest_vectorlogozone.mjs`
  - Ingests VLZ `www/logos/<slug>/index.md` into `public.editor_logo_catalog`
  - Fallback: if a logo’s `index.md` omits `images:`, the script scans the folder for `.svg` files and treats them as variants
- **Read-only browse APIs**
  - `GET /api/editor/assets/logos/tags` → tag stats for chips + “More tags…”
  - `GET /api/editor/assets/logos/search` → variant tiles (requires a search term or selected tag)
- **Import/cache API (SVG → PNG)**
  - `POST /api/editor/assets/logos/import`
  - Downloads the selected SVG, converts to PNG server-side, stores it into the shared bucket `editor-shared-assets`,
    and upserts `public.editor_logo_assets` so all editor users reuse the cached PNG.

#### Recents: stored table + API
- **DB migration**: `supabase/migrations/20260125_000001_add_editor_recent_assets.sql`
  - Table: `public.editor_recent_assets`
  - Dedupe: by `(owner_user_id, storage_bucket, storage_path)` when storage is present; otherwise by `(owner_user_id, url)`
- **Server route**: `GET/POST /api/editor/assets/recents`
  - Implementation: `src/app/api/editor/assets/recents/route.ts`
  - Canonicalizes URLs by stripping `?v=` so storage cache-busters don’t break dedupe

#### Auth nuance (important)
- `src/app/api/editor/_utils.ts` uses `getAuthedSupabase()` which **requires** `Authorization: Bearer <token>`.
- Therefore the Image Library modal must load Recents via the editor’s authed `fetchJson` (wired through `state.actions.fetchRecentAssets`), not via unauthenticated `fetch()`.

#### Generate Copy → Poppy routing (per editor user)
- **Server route**: `POST /api/editor/projects/jobs/generate-copy`
  - Implementation: `src/app/api/editor/projects/jobs/generate-copy/route.ts`
  - Looks up **per-user** `public.editor_users.poppy_conversation_url` and uses it to call Poppy
  - **Hard fails** if missing: `Missing poppy_conversation_url for this user`
  - Uses `model` from the stored URL’s query params (does **not** use env `POPPY_MODEL` for Generate Copy)
- **Client UX**:
  - `src/features/editor/hooks/useGenerateCopy.ts` logs the Poppy routing used (`board_id/chat_id/model`) into the Debug panel after the API responds
  - `src/features/editor/components/EditorBottomPanel.tsx` shows a spinner + status text while copy is running (and a hint if no project is selected)

#### Generate AI Image (model dropdown + per-project BG Removal)
- **Client UX**: `src/features/editor/components/EditorBottomPanel.tsx`
  - **Model dropdown** (per-user default): `GPT Image (gpt-image-1.5)` and `Gemini 3 Pro (gemini-3-pro-image-preview)`
  - **Gemini settings popover** (session-only): Aspect ratio + Size
    - Has explicit close button and dismisses on outside click
  - **BG Removal? toggle** (per-project): controls whether AI-generated images auto-run background removal
  - **AI Image Prompt textarea**: uses immediate store sync to avoid caret-jump while typing (same pattern as Caption)
- **Client orchestration**:
  - `src/features/editor/hooks/useGenerateAiImage.ts` sends prompt + imageConfig; server enforces per-user model from DB
  - `src/app/editor/EditorShell.tsx` owns the UI state + actions, and persists the per-project BG Removal toggle via `POST /api/editor/projects/update`
- **Server route**: `POST /api/editor/projects/jobs/generate-ai-image`
  - Implementation: `src/app/api/editor/projects/jobs/generate-ai-image/route.ts`
  - Enforces **per-user** `editor_users.ai_image_gen_model` (client cannot override)
  - Reads **per-project** `carousel_projects.ai_image_autoremovebg_enabled` (default ON)
  - Always stores a **PNG** in Supabase Storage (converts upstream JPEG → PNG via `sharp`)
  - Always computes/stores an alpha mask for wrapping (when BG Removal is OFF the mask is naturally “solid rectangle”)

### Live layout queue + realign orchestration (Stage 4B)
- **Hook**: `src/features/editor/hooks/useLiveLayoutQueue.ts`

## Text layout (Enhanced /editor)
Enhanced `/editor` uses deterministic layout snapshots that are rendered by Fabric on the canvas.

- **Deterministic layout computation (Enhanced)**: `src/app/editor/EditorShell.tsx` (`computeDeterministicLayout`)
  - Calls `wrapFlowLayout(...)` in `src/lib/wrap-flow-layout.ts`
  - HEADLINE: packing is relaxed (avg-char-width em scaled) to reduce overly-early wraps while staying inside the allowed rect (pixel overflow validator + retry loop)
- **RichText widget**: `src/app/editor/RichTextInput.tsx`
  - DOM encoding:
    - **Enter** typically becomes `\n\n`
    - **Shift+Enter** becomes `\n`
- **Newline behavior (Enhanced)**: `src/app/editor/EditorShell.tsx`
  - Headline + Body: when newline structure changes while typing, bypass the “fast path” wrapper and enqueue live layout immediately to avoid pre-blur spacing glitches (empty lines / multiline Textbox artifacts).
- **Wrap-flow core**: `src/lib/wrap-flow-layout.ts`
  - Headline + Body newlines:
    - **Enter (`\n\n`)** and **Shift+Enter (`\n`)** behave as a single normal line break
    - **Double Enter** creates an intentional blank line (multiple break tokens)

### Workspace/canvas wiring helpers (Stage 4C/4D)
- **Active image selection tracking**: `src/features/editor/hooks/useActiveImageSelection.ts`
  - Keeps active-slide image UI in sync with Fabric selection listeners
- **Export/share helpers**: `src/features/editor/hooks/useCanvasExport.ts`
  - Download All ZIP + Share All + per-slide share
- **Viewport + slide strip translateX**: `src/features/editor/hooks/useSlidesViewport.ts`
- **Fabric canvas binding (active slide)**: `src/features/editor/hooks/useFabricCanvasBinding.ts`
  - Assigns active slide canvas refs + updates `activeCanvasNonce` when Fabric canvas instance changes
- **Multi-canvas refs ownership**: `src/features/editor/hooks/useMultiCanvasRefs.ts`
  - Owns `slideCanvasRefs`, `slideRefs`, `lastActiveFabricCanvasRef`, and `activeCanvasNonce`

## Template system (editor)
- **Template editor modal**: `src/app/components/health/marketing/ai-carousel/TemplateEditorModal.tsx`
- **Template editor canvas (Fabric.js) + assets**: `src/app/components/health/marketing/ai-carousel/TemplateEditorCanvas.tsx`
  - Supports template assets of type `text`, `image`, and `shape` (rectangle w/ optional rounded corners)
- **Template type settings (effective merged)**:
  - `src/app/api/editor/template-types/effective/route.ts`
  - `src/app/api/editor/template-types/overrides/upsert/route.ts`

### Manual QA (Template Editor shapes)
- Open `/editor` and open **Template Editor**
- Create or open an existing template
- Click **+ Shape** to add a rectangle layer
- Drag + resize the rectangle (stretch into a non-square) and confirm it renders correctly
- Right-click the shape and set **Corner radius** > 0 (verify rounded corners)
- Change **Fill**, **Stroke**, and **Stroke width** (verify on-canvas updates)
- Right-click a **text** layer and change **Color** (verify on-canvas updates)
- Click **Save Template**, close modal, reopen the same template → shape persists with same styling
- Open a project using that template → confirm the shape renders behind user content on the main canvas

### Manual QA (Headline paragraph breaks + Realign)
- In `/editor`, type a Headline with **Enter** (two headline lines, no blank gap) and confirm Realign keeps both lines
- Type a Headline with **Enter twice** (blank line between) and confirm the blank line gap is preserved on canvas after Realign

### Manual QA (Body Enter behavior in Enhanced)
- In `/editor` (Enhanced), type body text and press **Enter** once mid-sentence
  - Expected: immediate new line while still typing (no “empty line objects” / no weird spacing until blur)
- Press **Shift+Enter** once
  - Expected: identical behavior to Enter (single normal new line)
- Press **Enter twice**
  - Expected: an intentional blank line (visible empty line between paragraphs)
- Click away (blur) after Enter/Shift+Enter edits
  - Expected: no “snap” to a different spacing/layout after blur; what you saw while typing matches the final layout

### Manual QA (AI image model + BG Removal)
- In `/editor` (Enhanced), open **AI Image Prompt**
- Ensure the **Model dropdown** is visible next to **Generate Image**
- Select **Gemini 3 Pro** and click **⚙️**
  - Change Aspect ratio and Size
  - Click **outside** the popover → it should dismiss
  - Click **✕** → it should dismiss
- Toggle **BG Removal?** OFF
  - Click **Generate Image**
  - Expected: generated image still works, still wraps deterministically (mask exists), and `bgRemovalEnabled` is false for the AI image
- Toggle **BG Removal?** ON
  - Generate again
  - Expected: background removal runs (if RemoveBG is configured) and the image + mask reflect the cutout

### Manual QA (Image Library modal + Recents)
- In `/editor`, click the **Photo/Image** icon on the active slide
  - Expected: center Image Library modal opens
  - Expected: BG toggle defaults to OFF each open
- Upload a PNG/JPG/WebP
  - Expected: upload inserts image and modal closes after file selection
  - Expected: newly used image appears in Recents on next modal open
- In Enhanced, generate an AI image
  - Expected: generated image appears in Recents on next modal open
- Click a recent tile with BG toggle OFF
  - Expected: modal closes immediately and image inserts
  - Expected: image `bgRemovalEnabled` is false (no cutout mask; rectangle behavior)
- Click a recent tile with BG toggle ON
  - Expected: modal stays open and shows spinner while BG removal runs
  - Expected: after BG removal finishes, modal closes and the inserted image is the processed PNG + mask

## Projects + slides (server APIs)
All editor project data is owner-scoped and accessed via `/api/editor/...`.

### Project list/load/create/update
- `GET  /api/editor/projects/list` → list active projects (filters archived)
- `GET  /api/editor/projects/load?id=...` → load one project + its slides (filters archived)
- `POST /api/editor/projects/create`
- `POST /api/editor/projects/update`
- `POST /api/editor/projects/update-mappings`
- `POST /api/editor/projects/archive` → soft archive (sets `archived_at`)

## Theme / Style Presets (project-wide) — n8n Dots (Dark) (2026-01-21)
This rollout introduced a **project-wide Theme system** that bundles:
- Canvas base background
- Text color
- Background effect (e.g. Dots)
- Effect settings

### Why this exists (high-level)
- **Scales cleanly**: a theme change is **one project update**, not 6 per-slide updates.
- **Prevents drift**: slide switching must not “pull back” stale colors from per-slide snapshots.
- **Deterministic reset**: “Reset” uses a persisted `theme_defaults_snapshot`, so later theme catalog changes don’t break older projects.

### Canonical ownership rules (critical)
- **Project-wide theme/colors/effects live on** `public.carousel_projects`.
- **Per-slide snapshots** (`public.carousel_project_slides.input_snapshot`) are still used for:
  - text content
  - style ranges (bold/italic/underline)
  - editor flags under `input_snapshot.editor.*`
- Under the Theme model, **we strip `fill` overrides** from rich-text style ranges on theme apply/reset so the Theme truly controls text color.

### Database fields (project-wide)
All fields below live on `public.carousel_projects`:
- **Render settings**
  - `project_background_color` (Canvas base)
  - `project_text_color`
  - `background_effect_enabled`
  - `background_effect_type` (`none` | `dots_n8n`)
  - `background_effect_settings` (JSON)
- **Theme provenance**
  - `theme_id_last_applied` (kept even if effect is turned off)
  - `theme_is_customized` (true when user tweaks after applying a theme)
  - `theme_defaults_snapshot` (JSON; used for Reset)
  - `last_manual_background_color`, `last_manual_text_color` (used to restore when turning effect off)

### Current Theme behavior (user-facing)
- **Theme dropdown**: `Custom` or `n8n Dots (Dark)`
- **Selecting `n8n Dots (Dark)`**:
  - sets `Canvas base = #171717`
  - sets `Text = #FFFFFF`
  - sets `Effect = Dots (n8n)`
  - persists `theme_defaults_snapshot` + `theme_id_last_applied`
  - saves `last_manual_*` so we can restore later
  - **wipes all rich-text fill overrides** across all slides (Theme controls color)
- **Custom edits after selecting a Theme**:
  - any manual Base/Text tweak marks the project as `theme_is_customized=true`
  - UI flips the dropdown to `Custom`
  - effect remains enabled unless the user changes it
- **Reset**:
  - restores all theme-controlled fields to the persisted `theme_defaults_snapshot`
  - wipes rich-text fill overrides again
- **Turning Effect → None** (while a Theme is remembered):
  - restores `last_manual_background_color` + `last_manual_text_color`
  - keeps `theme_id_last_applied` for history

### Key code ownership (where changes live)
- **UI (Theme dropdown, Reset, Canvas base/Text pickers, Effect dropdown)**:
  - `src/features/editor/components/EditorSidebar.tsx`
- **Project hydration (loads project theme fields into EditorShell state + store)**:
  - `src/features/editor/hooks/useProjectLifecycle.ts`
- **APIs (read/write theme fields)**
  - `GET /api/editor/projects/load` → `src/app/api/editor/projects/load/route.ts`
  - `POST /api/editor/projects/update` → `src/app/api/editor/projects/update/route.ts`
  - `POST /api/editor/projects/create` → `src/app/api/editor/projects/create/route.ts`
- **Theme apply/reset + “wipe rich-text fill overrides”**:
  - `src/app/editor/EditorShell.tsx`
- **Stable actions surface (`state.actions`)**
  - `src/features/editor/hooks/useEditorStoreActionsSync.ts`
- **Canvas background effect renderer**
  - `src/app/components/health/marketing/ai-carousel/CarouselPreviewVision.tsx`

### Manual QA (Theme)
- Apply `n8n Dots (Dark)` → all 6 slides show dots + white text
- Change Canvas base or Text → dropdown flips to `Custom`, effect remains
- Reset → returns to theme defaults (base/text/effect) and rich-text fill overrides are removed
- Effect → None → restores last manual base/text (if a theme had been applied)
- Hard refresh + switch projects → each project restores its own saved settings
- Download All → exported PNGs match editor view

### Slide persistence
- `POST /api/editor/projects/slides/update`
  - Updates `headline`, `body`, `layout_snapshot`, `input_snapshot`, `ai_image_prompt`
  - Merges `input_snapshot.editor` to prevent flag loss (e.g. `layoutLocked`, `autoRealignOnImageRelease`)

### Image routes
- `POST /api/editor/projects/slides/image/upload`
- `POST /api/editor/projects/slides/image/delete`
- `POST /api/editor/projects/slides/image/removebg`
- `POST /api/editor/projects/slides/image/reprocess`
- `GET/POST /api/editor/assets/recents` (Phase 2: Image Library → Recents)

### Jobs
- `POST /api/editor/projects/jobs/start`
- `GET  /api/editor/projects/jobs/status`
- `POST /api/editor/projects/jobs/generate-copy`
- `POST /api/editor/projects/jobs/generate-image-prompts`
- `POST /api/editor/projects/jobs/generate-ai-image`

## Initial load path
- Client calls `POST /api/editor/initial-state`
  - Loads templates + projects (owner-only)
  - Bootstraps starter template for first-time editor users (if needed)
  - Returns effective template type settings + template snapshots
 - **Client orchestration**: `src/features/editor/hooks/useEditorBootstrap.ts`

## Shared helpers
- **Template content region + default image placement**: `src/lib/templatePlacement.ts`
  - Used by both the editor (client) and AI-image persistence (server)

## Database (high level)
Key tables used by `/editor`:
- `public.editor_users` (allowlist gate for `/editor`)
  - `poppy_conversation_url` (per-user Poppy board/chat/model for Generate Copy)
  - `ai_image_gen_model` (per-user default image model used by Generate Image; server enforced)
- `public.editor_recent_assets` (Phase 2: Image Library Recents)
  - user-scoped and deduped by storage path when available, else by URL
- `public.editor_logo_catalog` (Phase 3: Logos catalog; shared)
  - provider-agnostic logo metadata and variants used for fast search + tag filtering
- `public.editor_logo_assets` (Phase 3: Logos raster cache; shared)
  - provider-agnostic cached PNGs for logo variants, stored in `editor-shared-assets`
- `public.carousel_projects`
  - `owner_user_id`
  - `template_type_id`
  - `slide*_template_id_snapshot` fields
  - `archived_at` (soft archive)
  - `ai_image_autoremovebg_enabled` (per-project default for AI-generated BG removal toggle)
  - **Theme / style preset (project-wide)**:
    - `project_background_color` (Canvas base)
    - `project_text_color`
    - `background_effect_enabled`, `background_effect_type`
    - `background_effect_settings` (JSON)
    - `theme_id_last_applied` (kept even if effect is turned off)
    - `theme_is_customized` (when user tweaks after applying a theme)
    - `theme_defaults_snapshot` (JSON; used for Reset)
    - `last_manual_background_color`, `last_manual_text_color` (used to restore when turning effect off)
- `public.carousel_project_slides`
  - `headline`, `body`
  - `layout_snapshot` (what the canvas renders)
  - `input_snapshot` (text content + style ranges + editor flags under `input_snapshot.editor`)
- `public.carousel_templates` (owner-only templates)
- `public.carousel_template_type_overrides` (per-user template-type settings)
- `public.carousel_generation_jobs` (job tracking for AI)

## “Where do I change X?” (common tasks)
- **Saved Projects dropdown UI**: `src/features/editor/components/SavedProjectsCard.tsx`
- **Projects list/load/archive orchestration**: `src/features/editor/hooks/useProjects.ts`
- **Archive endpoint**: `src/app/api/editor/projects/archive/route.ts`
- **Slide autosave debouncing**: `src/features/editor/hooks/useSlidePersistence.ts`
- **Lock layout flag helpers**: `src/features/editor/state/editorFlags.ts`
- **Auto realign on image release**: `src/features/editor/hooks/useImageOps.ts` + `src/features/editor/hooks/useAutoRealignOnImageRelease.ts`
- **Image Library modal (open/close / BG toggle / Recents insert)**:
  - UI: `src/features/editor/components/ImageLibraryModal.tsx`
  - Actions surface: `src/features/editor/hooks/useEditorStoreActionsSync.ts` (notably `fetchRecentAssets` + `onInsertRecentImage`)
  - Wiring/orchestration: `src/app/editor/EditorShell.tsx`
  - Recents API: `src/app/api/editor/assets/recents/route.ts`
- **Generate Copy**: `src/features/editor/hooks/useGenerateCopy.ts`
  - Per-user Poppy routing URL: `public.editor_users.poppy_conversation_url`
  - Migration: `supabase/migrations/20260121_000002_add_poppy_conversation_url_to_editor_users.sql`
- **Generate Image Prompts**: `src/features/editor/hooks/useGenerateImagePrompts.ts`
- **Generate AI Image**: `src/features/editor/hooks/useGenerateAiImage.ts`
  - Per-user image model: `public.editor_users.ai_image_gen_model` (migration: `supabase/migrations/20260122_000001_add_ai_image_gen_model_to_editor_users.sql`)
  - Per-project BG Removal default: `public.carousel_projects.ai_image_autoremovebg_enabled` (migration: `supabase/migrations/20260123_000001_add_ai_image_autoremovebg_enabled_to_carousel_projects.sql`)
  - Server route: `src/app/api/editor/projects/jobs/generate-ai-image/route.ts` (always stores PNG; mask always present)
- **Realign button behavior**: `src/app/editor/EditorShell.tsx` (calls the existing live-layout pipeline)
- **Canvas selection/overlay issues**: `CarouselPreviewVision.tsx` (especially `contextTop` drawing and transforms)
- **Smart Guides behavior**: `smartGuides.ts` + wiring in `CarouselPreviewVision.tsx`
- **Template Settings mappings**: `EditorShell.tsx` + `POST /api/editor/projects/update-mappings`
- **Theme / Colors / Effects**:
  - UI: `src/features/editor/components/EditorSidebar.tsx` (🖌️ Colors card)
  - Project hydration: `src/features/editor/hooks/useProjectLifecycle.ts`
  - Project persistence: `POST /api/editor/projects/update`
  - Theme apply/reset logic + “wipe rich-text fill overrides”: `src/app/editor/EditorShell.tsx`

## Refactor note
This refactor followed the phased plan at `~/.cursor/plans/editorshell_phased_refactor_4b6598db.plan.md`.

### Stage 3 (ownership migration) summary
Stage 3 keeps the **store-driven UI** from Stage 2, but starts moving real behavior out of `EditorShell.tsx` into cohesive feature hooks.

- **Phase 3A (bootstrap/hydration)**: moved `/api/editor/initial-state` boot + hydration into `src/features/editor/hooks/useEditorBootstrap.ts`
- **Phase 3B (project lifecycle)**: moved `loadProject` / `createNewProject` + slide hydration into `src/features/editor/hooks/useProjectLifecycle.ts`
- **Phase 3C (project meta persistence)**: moved debounced project title/caption saves into `src/features/editor/hooks/useEditorPersistence.ts`
- **Phase 3D (job wiring)**: centralized `Generate Copy` / `Generate Image Prompts` / `Generate AI Image` wiring into `src/features/editor/hooks/useEditorJobs.ts`
- **Phase 3E (thin shell + docs)**: removed dead code paths/imports in `EditorShell.tsx` and updated this repo map to reflect new ownership

### Stage 4 (canvas + store ownership) summary
Stage 4 continues shrinking `EditorShell.tsx` by extracting remaining “behavior islands” into editor-owned hooks.

- **4A (store mirroring → stable actions)**: `useEditorStoreActionsSync`
- **4B (live layout queue)**: `useLiveLayoutQueue`
- **4C/4D (canvas wiring)**: `useCanvasTextStyling`, `useActiveImageSelection`, `useCanvasExport`, `useSlidesViewport`, `useFabricCanvasBinding`, `useMultiCanvasRefs`

### Stage 5 (mirroring elimination) summary
Stage 5 removed the “giant mirrored blobs” and replaced them with smaller, store-owned slices and stable actions.

- **Store-owned identity/navigation/modals/projects**: `EditorShell.tsx` sets store fields directly (no legacy “mirror everything” hook)
- **Stable actions surface**: `src/features/editor/hooks/useEditorStoreActionsSync.ts`
  - UI calls `state.actions.*` (ref-dispatched to avoid stale closures)
- **Workspace slices (replace `state.workspace`)**: `src/features/editor/hooks/useEditorStoreWorkspaceRegistry.tsx`
  - Publishes `workspaceNav`, `workspaceRefs`, `workspaceUi`, `workspaceActions`
- **Bottom panel bridge removed**:
  - `EditorBottomPanel` uses `state.bottomPanelUi` (render state) + `state.actions` (handlers)
  - Legacy `useEditorStoreWorkspaceSync.tsx` was deleted

### Why `EditorShell.tsx` is still large (expected)
Even after Stage 2, `EditorShell.tsx` still owns the **actual behavior** (effects, handlers, Fabric wiring, debounced saves, job orchestration). Stage 2’s goal so far is to remove **prop drilling** and make UI subscribe to state slices cleanly.

## Store + selectors (Stage 2)
Stage 2 introduces a lightweight store (no new dependencies) so UI can subscribe to just the slices it needs.

- **Provider wrap (current)**: `src/app/editor/page.tsx` wraps `<EditorShell />` in `EditorStoreProvider`
- **Store implementation**: `src/features/editor/store/`
  - `EditorStoreProvider.tsx` (creates the store instance)
  - `useEditorSelector.ts` (selector hook)
  - `editorStore.ts` (subscribe/getState/setState)
  - `types.ts` (store state + actions types)

### Current ownership (after Phase 2D)
- **Provider wrap**: `src/app/editor/page.tsx` wraps the editor in `EditorStoreProvider`.
- **UI reads from store**:
  - Top/left/modals: `EditorTopBar`, `EditorSidebar`, `SavedProjectsCard`, `TemplateSettingsModal`, `PromptsModal`
  - Workspace: `EditorSlidesRow` (reads `state.workspaceNav`, `state.workspaceRefs`, `state.workspaceUi`, `state.workspaceActions`)
  - Bottom panel: `EditorBottomPanel` (reads `state.bottomPanelUi` + `state.actions`)
- **EditorShell owns orchestration + publishes slices**:
  - **Actions**: `useEditorStoreActionsSync` installs a stable `state.actions` object (ref-dispatched)
  - **Workspace**: `useEditorStoreWorkspaceRegistry` publishes the workspace slices (including refs that cannot be “store-owned” purely)
  - **Bottom panel**: `EditorShell.tsx` sets `state.bottomPanelUi` directly (render-only state); bottom-panel handlers are in `state.actions`

