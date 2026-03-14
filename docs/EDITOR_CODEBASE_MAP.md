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
  - **Agency model**: checks `public.editor_account_memberships` to gate editor access
  - Note: `public.editor_users` still exists for editor profile fields, but **not** for tenant access control
- **/editor gate**: `src/app/editor/page.tsx`
  - Redirects to `/` if not authed
  - Shows “Access denied” if user has **no account membership**

## Multi-tenant (Agency accounts) — core rules
This is **editor-only** multi-tenancy. It does **not** affect the Health/Profile side of the app.

- **Active account context**
  - Stored client-side as `localStorage["editor.activeAccountId"]`
  - Attached to editor API requests as `x-account-id` (via `fetchJson` in `src/app/editor/EditorShell.tsx`)
  - Server routes derive the effective account via `resolveActiveAccountId(...)` in `src/app/api/editor/_utils.ts`
  - **Security boundary is enforced by RLS** on account-scoped tables (`account_id` + membership policies)
- **Superadmin switching UI**
  - `src/features/editor/components/EditorTopBar.tsx` renders an **Account dropdown** only for superadmins
  - Source of truth: `GET /api/editor/accounts/me` (returns `isSuperadmin`, `activeAccountId`, memberships list)
- **Create new client accounts (superadmin)**
  - **UI**: `src/features/editor/components/CreateAccountModal.tsx`
    - Entry point: `+ New Account` button in `src/features/editor/components/EditorTopBar.tsx`
    - Includes “Existing user found — will attach as Owner” flow (password ignored)
    - Includes “Clone defaults” (only Regular/Enhanced mappings + referenced templates)
    - Success UX includes **Switch to Account** (sets `localStorage["editor.activeAccountId"]` then reloads)
  - **API (superadmin-only)**
    - `POST /api/editor/accounts/lookup-user` → checks if an auth user exists for an email
    - `POST /api/editor/accounts/create` → creates:
      - `editor_accounts`
      - `editor_account_memberships` (client `owner`, Axel `admin`)
      - `editor_account_settings` (poppy url + model + prompts)
      - `editor_users` row for the owner (legacy editor endpoints still check it)
    - **Safety**: create route includes cleanup on partial failure to avoid orphaned accounts/templates/users
- **Delete accounts (superadmin)**
  - **UI**: `src/features/editor/components/EditorTopBar.tsx`
    - Superadmin-only **⚙️** menu next to the Account dropdown
    - Menu items:
      - `+ New Account` (opens `CreateAccountModal`)
      - `Delete current account…` (opens `DeleteAccountModal`)
  - **UI**: `src/features/editor/components/DeleteAccountModal.tsx`
    - Requires typing `DELETE` to enable deletion
    - After success, switches you to a fallback account (prefers an owner `(Personal)` account) and reloads
  - **API (superadmin-only)**
    - `POST /api/editor/accounts/delete`
      - Requires `confirmText === "DELETE"`
      - Requires caller is a member of the account (prevents deleting arbitrary IDs)
      - Uses service role to delete all account-scoped editor rows in a safe order
      - **Guardrail**: refuses to delete any account whose display name contains `(Personal)`
      - **Storage cleanup (best effort)**:
        - Template assets: `carousel-templates/<templateId>/assets/*`
        - Project images (Phase H): `carousel-project-images/accounts/<accountId>/*`

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
  - `src/features/editor/components/BodyRegenModal.tsx` (Regular-only: regenerate Body for one slide; attempts + restore)
  - `src/features/editor/components/IdeasModal.tsx` (reads store; Generate Ideas + queue + create carousel)
  - `src/features/editor/components/CreateAccountModal.tsx` (reads store; superadmin-only onboarding flow)
  - `src/features/editor/components/DeleteAccountModal.tsx` (reads store; superadmin-only dangerous action)
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

### Slide 1 Card (Instagram-like framing) — bug fix reference (2026-03-01)
The Slide 1 Card is an optional rounded rectangle rendered on Slide 1 Regular only, giving an "Instagram card" look (card covers most of the canvas with a thin solid-color frame visible on all four edges).

**Where**: `CarouselPreviewVision.tsx` → `applySlide1Style()` → `if (cardEnabled)` block.

**Props**: `slide1Card: { enabled, backgroundHex, patternId, borderEnabled, borderThicknessPx, borderRadiusPx }` (passed from EditorShell).

**Two bugs were fixed (both in the card Rect creation)**:

1. **Missing `originX: 'left', originY: 'top'`**.
   Fabric v7 (`fabric ^7.0.0`) defaults to `originX: 'center', originY: 'center'`. Every other object in the file sets origin explicitly, but the card Rect did not. This caused `left`/`top` to position the *center* of the rect instead of the top-left corner, making the card extend far beyond the visible canvas on all sides — appearing full-bleed with no gap.

2. **Wrong world-coordinate span for card dimensions**.
   The code used `cw = INTERNAL_W / zoom` (the full Fabric *buffer* world span ≈ 2777 at zoom 0.39) as the card's bounding box. But the *visible* world area (clipped by the parent `overflow: hidden` div) is always `(0,0)-(INTERNAL_W, INTERNAL_H)` = `(0,0)-(1080, 1440)`, regardless of zoom. The card must fit within this range. Using `cw` made the card ~2.6× wider than the visible area.

**Correct coordinate model** (for future reference):
- Fabric canvas CSS = `INTERNAL_W × INTERNAL_H` (1080×1440, set by Fabric on init)
- Parent div clips visible area to `displayW × displayH` (e.g. 420×560)
- Fabric zoom = `displayW / INTERNAL_W` (e.g. 0.389)
- World → Fabric CSS: multiply by `zoom`
- Visible world area: `(0, 0)` to `(displayW / zoom, displayH / zoom)` = `(0, 0)` to `(INTERNAL_W, INTERNAL_H)`
- To convert N screen-CSS pixels to world units: `N / zoom`

**Correct card formula**:
```
insetWorld = 40 / zoom
card: left = insetWorld, top = insetWorld
       width = INTERNAL_W - 2 * insetWorld
       height = INTERNAL_H - 2 * insetWorld
       originX = 'left', originY = 'top'
```

**Scope**: only affects Slide 1, Regular template, when `slide1Card.enabled` is true. No impact on Enhanced templates or any other canvas objects.

### Debug: wrap/realign instrumentation (kept for future sessions)
To avoid spamming production Debug output, wrap/realign logs are **gated** behind a localStorage flag:

- **Enable**: in DevTools console run `localStorage.setItem('dn_debug_wrap', '1')`, then refresh `/editor`.
- **Disable**: run `localStorage.removeItem('dn_debug_wrap')`, then refresh.

When enabled, you’ll see Debug panel entries prefixed with:
- `🖼️` image move bounds snapshots (primary image only)
- `🧲` drag-guard / auto-realign guard state
- `🧱` invariant enforcement decisions + wrap anomaly detector

## Rich text editor (bottom panel)
- **RichText component**: `src/app/editor/RichTextInput.tsx`
  - Emits `{ text, ranges }` (inline style ranges)
- **Bottom panel UI container**: `src/features/editor/components/EditorBottomPanel.tsx`
  - Render-only container for the Headline/Body RichText areas + other cards
- **On-canvas text styling persistence**: `src/features/editor/hooks/useCanvasTextStyling.ts`
  - Tracks Fabric `user-text` selection + applies bold/italic/underline/clear without dropping selection
  - Persists marks into `input_snapshot.*StyleRanges` via the existing `applyInlineStyleFromCanvas` path

### 2026-03 session notes: canvas emphasis, emoji edits, undo, and inline color
- **Canvas emphasis blur persistence fixed**
  - Files: `src/app/editor/EditorShell.tsx`, `src/features/editor/hooks/useCanvasTextStyling.ts`
  - Problem: applying bold on-canvas could look correct while editing, then disappear or revert after blur.
  - Fixes:
    - rebuild fallback `__sourceParts` when a line's source mapping is stale or incomplete before translating Fabric selections back into source ranges
    - keep a synchronous `pendingCanvasInlineRangesRef` so blur commits/remaps read the newest inline ranges instead of stale React state
    - object-level toolbar state now ignores whitespace-only chars when deciding whether bold/italic/underline are active
- **Emoji/non-BMP inline style drift fixed**
  - Files: `src/lib/text-placement/styleRangeRemap.ts`, `src/app/components/health/marketing/ai-carousel/CarouselPreviewVision.tsx`, `src/app/editor/EditorShell.tsx`
  - Problem: inserting emoji on the canvas could shift inline emphasis away from the intended words, including on other lines in the same BODY block.
  - Fixes:
    - `remapRangesByDiff(...)` now treats insertions at styled boundaries conservatively so newly inserted emoji do not get absorbed into adjacent styled spans
    - Fabric render/apply path converts code-unit offsets to grapheme offsets for lines containing non-BMP characters before calling `setSelectionStyles(...)`
    - after a BODY text edit, the editor rebuilds `__sourceParts` and per-line styles for all lines in the edited block, not just the edited line
- **Canvas undo draft-sync patch kept, but emoji undo history is still a known caveat**
  - Files: `src/app/editor/EditorShell.tsx`, `src/app/components/health/marketing/ai-carousel/useCarouselEditorEngine.ts`
  - Improvement kept: undo now synchronizes the active slide draft fields (`draftHeadline`, `draftBody`, style ranges, `layoutData`, `inputData`) with the restored engine snapshot so the canvas and bottom panel do not trivially desync.
  - Known deferred caveat: emoji add/delete undo can still walk through polluted intermediate history snapshots for Enhanced BODY text. If revisited, inspect post-edit `object:modified` churn and snapshot creation before changing style logic again.
- **Inline color (`fill`) is not architecturally the same as emphasis**
  - Files: `src/features/editor/hooks/useCanvasTextStyling.ts`, `src/app/editor/EditorShell.tsx`
  - Current reality:
    - `fill` shares the same inline-range persistence pipeline as `bold`/`italic`/`underline`
    - but `fill` also doubles as a default/theme/body text color carrier in several paths, so it is not a pure “inline emphasis” mark
  - Consequence: color selection/persistence can behave differently from boolean emphasis marks.
  - If this is revisited later, the safer design is:
    - keep default/project/theme text color outside inline ranges
    - use `fill` in `InlineStyleRange[]` only for explicit inline color overrides
    - add a true “clear inline color override” path, separate from theme/default text color changes

## Editor feature modules (what was extracted)
### Bootstrap + hydration (Stage 3A)
- **Hook**: `src/features/editor/hooks/useEditorBootstrap.ts`
  - Calls `POST /api/editor/initial-state` and hydrates templates/projects/template-type effective settings
  - Handles auto-load most recent project or auto-create Enhanced project

### Poppy Prompt (Saved Prompt Library — per user, per account, per template type)
- **DB table (RLS, per-user private)**: `public.editor_poppy_saved_prompts`
  - **Migration**: `supabase/migrations/20260219_000001_add_editor_poppy_saved_prompts.sql`
  - Scope: `account_id + user_id + template_type_id`
  - Enforces: **at most one active prompt** per scope (unique partial index)
- **API routes** (Next.js):
  - `POST /api/editor/user-settings/poppy-prompts/list` (includes first-use seeding + “ensure active” self-heal)
  - `POST /api/editor/user-settings/poppy-prompts/create`
  - `POST /api/editor/user-settings/poppy-prompts/update`
  - `POST /api/editor/user-settings/poppy-prompts/duplicate`
  - `POST /api/editor/user-settings/poppy-prompts/set-active`
- **UI entry point**: `src/features/editor/components/EditorSidebar.tsx` (“Select” button next to Poppy Prompt)
- **Library modal**: `src/features/editor/components/PoppyPromptsLibraryModal.tsx`
  - Inline expand/collapse rows with debounced autosave + Duplicate + Make Active Prompt
  - Active row pinned with “Active” badge
  - **Phase BV**: includes a sticky **Brand Voice (Alignment)** editor at the top (per-account), separate from the prompts list
- **Main prompt editor**: `src/features/editor/components/PromptsModal.tsx`
  - Shows “Saving… / Saved ✓ / Save failed” for debounced autosave of the active prompt
- **State + actions**:
  - Types: `src/features/editor/store/types.ts`
  - Wiring: `src/features/editor/hooks/useEditorStoreActionsSync.ts`
  - Orchestration: `src/app/editor/EditorShell.tsx`
    - Loads/hydrates the user’s active saved prompt on boot + template type changes
    - Debounced autosave updates the active saved prompt row
- **Server prompt source of truth (Phase 6 / Phase BV)**
  - `POST /api/editor/projects/jobs/generate-copy` uses **brand voice + active saved prompt** (Option B labels), with safe fallback for the style prompt
  - `POST /api/editor/ideas/create-carousel` injects **brand voice + active saved prompt** as the base prompt, with safe fallback

#### Manual QA (Brand Voice injection)
- [ ] Open `/editor`
- [ ] Click 🎨 **Template** → **Select**
- [ ] Confirm **Brand Voice (Alignment)** editor is sticky/pinned at top and styled blue
- [ ] Type into Brand Voice textarea → confirm it shows “Saving…” then “Saved ✓”
- [ ] Scroll the prompts list → confirm Brand Voice stays pinned while prompts scroll underneath
- [ ] Select a different prompt and click **Make Active** → confirm modal closes and Poppy Prompt editor opens
- [ ] Click **Generate Copy** → confirm Debug logs show the composed prompt with `BRAND_VOICE:` then `STYLE_PROMPT:`
- [ ] Create carousel from an idea → confirm copy generation still works and uses the new composed base prompt

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
- **Generate Ideas (topics + queue + create carousel)**: `src/features/editor/components/IdeasModal.tsx`
- **Wiring wrapper (Stage 3D)**: `src/features/editor/hooks/useEditorJobs.ts` (centralizes how the three job hooks are wired together)
  - Phase 2: AI image success also “touches” Recents so generated PNGs show up in the Image Library modal

### Image Library modal (Phase 1/2: Upload + Recents)
- **Modal UI**: `src/features/editor/components/ImageLibraryModal.tsx`
  - Sections:
    - Upload (file picker)
    - Recents (grid of tiles, user-scoped)
    - Logos (VectorLogoZone + Lobe Icons + Developer Icons + SVG Logos (svgporn) + SVG Logos (gilbarbara) + Simple Icons)
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

#### Logos (Phase L: Lobe Icons)
- **Catalog ingestion (manual)**:
  - Script: `scripts/logo_catalog/ingest_lobe_icons.mjs`
  - Sources:
    - Per-icon metadata: `src/<Name>/index.md` frontmatter (`title`, `group`, `description`)
    - Variants: static pack at `packages/static-svg/icons/*.svg`
  - Tags (Option 1): only `provider` / `model` / `application` derived from `group` (best-effort)
- **Browse APIs**
  - `GET /api/editor/assets/logos/tags?source=lobe-icons`
  - `GET /api/editor/assets/logos/search?source=lobe-icons&q=...&tag=...`
- **Import/cache + insert**
  - Uses the same `POST /api/editor/assets/logos/import` pipeline (SVG→PNG via `sharp` → `editor-shared-assets`)
  - Insert path is the existing “insert cached logo into slide” pipeline (records Recents; respects modal BG toggle)

#### Logos (Phase D: Developer Icons)
- **Catalog ingestion (manual)**:
  - Script: `scripts/logo_catalog/ingest_developer_icons.mjs`
  - Sources:
    - Metadata: `lib/iconsData.ts` (`name`, `id`, `categories`, `keywords`, `url`)
    - Variants: optimized `icons/*.svg` (ignore `icons/raw/`)
  - Tags: categories only (Title Case, same as their site)
- **Browse APIs**
  - `GET /api/editor/assets/logos/tags?source=developer-icons`
  - `GET /api/editor/assets/logos/search?source=developer-icons&q=...&tag=...`
- **Import/cache + insert**
  - Uses `POST /api/editor/assets/logos/import` (SVG→PNG via `sharp` → `editor-shared-assets`)
  - Insert path records Recents; respects modal BG toggle

#### Logos (Phase S: SVG Logos / svgporn)
- **Catalog ingestion (manual)**:
  - Script: `scripts/logo_catalog/ingest_svgporn.mjs`
  - Dataset: `https://storage.googleapis.com/logos-c87b5.appspot.com/logos.json`
  - Tags: `categories[]` only (ignore dataset `tags[]`)
  - Variants: `files[]` → `https://cdn.svglogos.dev/logos/<filename>`
  - Note: dataset can contain duplicate `shortname`; ingestion script dedupes `source_key` and merges variants/categories.
- **Browse APIs**
  - `GET /api/editor/assets/logos/tags?source=svgporn`
  - `GET /api/editor/assets/logos/search?source=svgporn&q=...&tag=...`
- **Import/cache + insert**
  - Uses `POST /api/editor/assets/logos/import` (SVG→PNG via `sharp` → `editor-shared-assets`)
  - Insert path records Recents; respects modal BG toggle

#### Logos (Phase G: SVG Logos / gilbarbara)
- **Catalog ingestion (manual)**:
  - Script: `scripts/logo_catalog/ingest_gilbarbara_logos.mjs`
  - Sources:
    - Logos list: gilbarbara repo `logos.json`
    - Tags enrichment: svgporn dataset categories matched by `shortname` (best-effort)
  - Variants: `logos/<shortname>/<variant>.svg`
- **Browse APIs**
  - `GET /api/editor/assets/logos/tags?source=gilbarbara`
  - `GET /api/editor/assets/logos/search?source=gilbarbara&q=...&tag=...`
- **Import/cache + insert**
  - Uses `POST /api/editor/assets/logos/import` (SVG→PNG via `sharp` → `editor-shared-assets`)
  - Insert path records Recents; respects modal BG toggle

#### Logos (Phase SI: Simple Icons)
- **Catalog ingestion (manual)**:
  - Script: `scripts/logo_catalog/ingest_simple_icons.mjs`
  - Repo: `simple-icons/simple-icons` (`develop` branch)
  - Tags: none upstream (search-only)
  - Variants: one-per-icon `icons/<slug>.svg`
  - Note: slugs derived via `slugs.md` mapping (needed because most JSON rows don’t include `slug`)
- **Browse APIs**
  - `GET /api/editor/assets/logos/tags?source=simple-icons`
  - `GET /api/editor/assets/logos/search?source=simple-icons&q=...&tag=...`
- **Import/cache + insert**
  - Uses `POST /api/editor/assets/logos/import` (SVG→PNG via `sharp` → `editor-shared-assets`)
  - Insert path records Recents; respects modal BG toggle

#### Recents: stored table + API
- **DB migration**: `supabase/migrations/20260125_000001_add_editor_recent_assets.sql`
  - Table: `public.editor_recent_assets`
  - Phase G dedupe (account-scoped):
    - `editor_recent_assets (account_id, storage_bucket, storage_path)` when storage is present
    - otherwise `editor_recent_assets (account_id, url)`
- **Server route**: `GET/POST /api/editor/assets/recents`
  - Implementation: `src/app/api/editor/assets/recents/route.ts`
  - Canonicalizes URLs by stripping `?v=` so storage cache-busters don’t break dedupe

#### Auth nuance (important)
- `src/app/api/editor/_utils.ts` uses `getAuthedSupabase()` which **requires** `Authorization: Bearer <token>`.
- Therefore the Image Library modal must load Recents via the editor’s authed `fetchJson` (wired through `state.actions.fetchRecentAssets`), not via unauthenticated `fetch()`.
- **Agency nuance**: editor API calls must also include `x-account-id` (handled automatically by `fetchJson` in `EditorShell.tsx`).

#### Generate Copy → Poppy routing (per account)
- **Server route**: `POST /api/editor/projects/jobs/generate-copy`
  - Implementation: `src/app/api/editor/projects/jobs/generate-copy/route.ts`
  - Looks up **per-account** `public.editor_account_settings.poppy_conversation_url` and uses it to call Poppy
  - **Hard fails** if missing for the active account: `Missing poppy_conversation_url for this account`
  - Uses `model` from the stored URL’s query params (does **not** use env `POPPY_MODEL` for Generate Copy)
- **Client UX**:
  - `src/features/editor/hooks/useGenerateCopy.ts` logs the Poppy routing used (`board_id/chat_id/model`) into the Debug panel after the API responds
  - `src/features/editor/components/EditorBottomPanel.tsx` shows a spinner + status text while copy is running (and a hint if no project is selected)

#### Generate AI Image (model dropdown + per-project BG Removal)
#### Generate Ideas (topics) + Create Carousel (Ideas modal)
- **UI**: `src/features/editor/components/IdeasModal.tsx`
  - Entry point: **Left sidebar → Colors → “💡 Generate Ideas”**
  - Idea statuses: `pending` | `approved` | `dismissed`
  - Supports:
    - manual Source Title + URL tagging
    - approve/dismiss + approved queue
    - delete source (cascades ideas/runs)
    - create carousel from approved idea (creates a new project and kicks off Generate Copy)
- **APIs**
  - `GET  /api/editor/ideas/sources` (grouped sources + ideas; `includeDismissed`)
  - `POST /api/editor/ideas/generate`
  - `POST /api/editor/ideas/update` (approve/dismiss/unapprove/reorderApproved)
  - `POST /api/editor/ideas/sources/delete`
  - `POST /api/editor/ideas/create-carousel`
  - `GET  /api/editor/ideas/carousel-runs` (audit lookup: idea → created project)
  - `GET/POST /api/editor/user-settings/ideas-prompt` (**per-account** ideas prompt override)
- **DB migrations**
  - `supabase/migrations/20260126_000001_add_editor_ideas.sql` (sources/runs/ideas + ideas_prompt_override column)
  - `supabase/migrations/20260126_000002_editor_ideas_delete_policies.sql` (delete policies)
  - `supabase/migrations/20260126_000003_add_editor_idea_carousel_runs.sql` (audit: idea→project)

- **Client UX**: `src/features/editor/components/EditorBottomPanel.tsx`
  - **Model dropdown** (per-account default): `GPT Image (gpt-image-1.5)` and `Gemini 3 Pro (gemini-3-pro-image-preview)`
  - **Gemini settings popover** (session-only): Aspect ratio + Size
    - Has explicit close button and dismisses on outside click
  - **BG Removal? toggle** (per-project): controls whether AI-generated images auto-run background removal
  - **AI Image Prompt textarea**: uses immediate store sync to avoid caret-jump while typing (same pattern as Caption)
- **Client orchestration**:
  - `src/features/editor/hooks/useGenerateAiImage.ts` sends prompt + imageConfig; server enforces per-account model from DB
  - `src/app/editor/EditorShell.tsx` owns the UI state + actions, and persists the per-project BG Removal toggle via `POST /api/editor/projects/update`
- **Server route**: `POST /api/editor/projects/jobs/generate-ai-image`
  - Implementation: `src/app/api/editor/projects/jobs/generate-ai-image/route.ts`
  - Enforces **per-account** `editor_account_settings.ai_image_gen_model` (client cannot override)
  - Reads **per-project** `carousel_projects.ai_image_autoremovebg_enabled` (default ON)
  - Always stores a **PNG** in Supabase Storage (converts upstream JPEG → PNG via `sharp`)
  - Always computes/stores an alpha mask for wrapping (when BG Removal is OFF the mask is naturally “solid rectangle”)
  - Phase H: storage path prefixing uses `accounts/<accountId>/...` within `carousel-project-images`

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
  - **UX guardrails (2026-01-31)**:
    - Template dropdown is sorted **A→Z** (case-insensitive), tie-break by `updatedAt` newest-first
    - “Create new template” is **collapsed by default** (click-to-open) and auto-collapses after Create
    - When no template is selected, **the canvas + all edit controls are locked**, with a prompt:
      “Select a Template or Create one to begin editing.”
  - **Avatar crop (circle mask) (2026-01-31)**:
    - Per-image layer setting via right-click → **Mask: None / Circle (avatar)**
    - Crop mode: right-click → **Edit crop…** then **drag to pan** and **scroll to zoom** (press **Esc** or **Done** to exit)
  - **Arrow shapes (solid/line) (2026-02-02)**:
    - Add via the **+ Shape dropdown**: Rectangle / Arrow (solid) / Arrow (line)
    - Right-click an arrow → **Arrowhead size** (absolute **px**), Fill, Stroke, Stroke width
    - Arrowhead size is **absolute** (template pixels): resizing the arrow does **not** change head size (except clamp if the arrow becomes too narrow)
- **Template editor canvas (Fabric.js) + assets**: `src/app/components/health/marketing/ai-carousel/TemplateEditorCanvas.tsx`
  - Supports template assets of type `text`, `image`, and `shape`:
    - Rectangles (`shape: 'rect'`) w/ optional rounded corners
    - Arrows (`shape: 'arrow_solid' | 'arrow_line'`) (right-pointing only; rotation disabled)
  - **Image mask/crop fields (persisted on template definition)**: `src/lib/carousel-template-types.ts`
    - `TemplateImageAsset.maskShape?: 'none' | 'circle'`
    - `TemplateImageAsset.crop?: { scale: number; offsetX: number; offsetY: number }`
      - `scale` is clamped to \(1.0 \rightarrow 4.0\)
      - offsets are clamped so the circle never shows empty pixels
  - **Arrow fields (persisted on template definition)**: `src/lib/carousel-template-types.ts`
    - `TemplateShapeAsset.shape: 'rect' | 'arrow_solid' | 'arrow_line'`
    - `TemplateShapeAsset.arrowHeadSizePx?: number` (preferred; absolute head length in template pixels)
    - `TemplateShapeAsset.arrowHeadSizePct?: number` (legacy fallback for older templates)
  - **/editor rendering opt-in**: `src/app/components/health/marketing/ai-carousel/CarouselPreviewVision.tsx`
    - Use `enableTemplateImageMasks={true}` (passed from `/editor` via `src/features/editor/components/EditorSlidesRow.tsx`)
    - When enabled and `maskShape === 'circle'`, the same crop math is applied so `/editor` matches Template Editor 1:1
    - Use `enableTemplateArrowShapes={true}` (passed from `/editor` via `src/features/editor/components/EditorSlidesRow.tsx`)
    - When enabled and `shape === 'arrow_*'`, arrows render in the real `/editor` project canvas (Enhanced slides)
- **Account scoping (IMPORTANT)**
  - Template editor API routes live under `src/app/api/marketing/carousel/templates/*`
  - When operating in `/editor`, these requests MUST include `x-account-id` so templates resolve within the active account.
  - When `x-account-id` is present:
    - **Read** (e.g. `templates/load`, `templates/list`, `templates/signed-url`): allowed for account members
    - **Write** (e.g. `templates/create`, `templates/update`, `templates/duplicate`, `templates/upload-asset`): allowed for account `owner`/`admin`
- **Template type settings (effective merged)**:
  - `src/app/api/editor/template-types/effective/route.ts`
  - `src/app/api/editor/template-types/overrides/upsert/route.ts`

### Manual QA (Template Editor shapes)
- Open `/editor` and open **Template Editor**
- Confirm the editor starts in a **locked** state until a template is selected
  - Expected: canvas blocked + edit controls disabled
  - Expected: prompt shown in left panel and over the canvas
- Confirm **Template dropdown** is sorted alphabetically (A→Z, case-insensitive)
- Expand/collapse **Create new template** (should be collapsed by default)
- Create or open an existing template
- From the locked state, expand Create and create a new template
  - Expected: template loads, editor unlocks, Create section auto-collapses
- Right-click an **image** layer → Mask → **Circle (avatar)** → **Edit crop…**
  - Expected: a visible “Crop mode” banner appears with instructions + Done/Reset
  - Expected: a “Crop mode” pill appears on the canvas
  - Expected: drag pans, scroll zooms, and Esc exits crop mode
- Save Template, close modal, reopen `/editor` project using that template
  - Expected: the avatar crop (mask + pan/zoom) matches Template Editor 1:1
- Use the **+ Shape dropdown** to add:
  - Rectangle
  - Arrow (solid)
  - Arrow (line)
- Drag + resize the rectangle (stretch into a non-square) and confirm it renders correctly
- Right-click the shape and set **Corner radius** > 0 (verify rounded corners)
- Change **Fill**, **Stroke**, and **Stroke width** (verify on-canvas updates)
- For **Arrow (solid)** / **Arrow (line)**:
  - Right-click → adjust **Arrowhead size (px)** and confirm only the arrow updates
  - Resize the arrow wider/narrower:
    - Expected: the **arrowhead size does not change** (absolute), unless the arrow becomes too narrow and clamps
  - Scrub Arrowhead size back and forth:
    - Expected: the **contentRegion** box does not “grow” and the arrow does not “drift” in size
- Right-click a **text** layer and change **Color** (verify on-canvas updates)
- Click **Save Template**, close modal, reopen the same template → shape persists with same styling
- Open a project using that template → confirm the shape renders behind user content on the main canvas
  - Expected: arrows render in `/editor` Enhanced slides (opt-in prop enabled)

### Manual QA (Delete Account)
- In `/editor` as Axel (superadmin), open the **Account ⚙️** menu
- Click **Delete current account…**
- Confirm the modal shows the active account name + id
- Type `DELETE` → button enables
- Delete a **throwaway client account**
  - Expected: page reloads and you’re switched to your `(Personal)` account (or another fallback account)
  - Expected: deleted account no longer appears in the account dropdown
- Try deleting any `(Personal)` account
  - Expected: API rejects with “Refusing to delete a Personal account.”

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

### Manual QA (Generate Ideas modal)
- Open `/editor`
- In the left sidebar under **Colors**, click **💡 Generate Ideas**
  - Expected: modal opens; scrolling works within the modal
- In **Ideas Prompt**, type a change
  - Expected: shows “Saving…” then “Saved ✓”
- Enter **Source Title** and **Source URL**, click **Generate Ideas**
  - Expected: progress line updates; 8 ideas appear under that source
- Approve 2–3 ideas
  - Expected: they appear in **Approved Queue**
- Dismiss an idea
  - Expected: it disappears; toggle **Show dismissed** to see it
- Click **Create carousel** on an approved idea
  - Expected: a new project is created with project title = idea title
  - Expected: editor switches to the newest created project
  - Expected: Generate Copy runs automatically; queue item flips to ✅ Created
- Delete a source from the left column (🗑️) and confirm
  - Expected: the source disappears and its ideas are gone (cascaded delete)

### Manual QA (Caption Regenerate)
- Open `/editor` and load any project with slide text
- In the ✍️ **Caption** card, click **⚙️** and paste your Caption Regenerate prompt
  - Expected: prompt auto-saves (reopen the modal and it persists) **per-account**
- Click **Regenerate**
  - Expected: button shows “Generating…” and is disabled while running
  - Expected: caption textarea is replaced with the new caption when finished
- Click **Regenerate** again (2–3 times)
  - Expected: each run uses prior attempts as “rejected captions” context (so the next result should be meaningfully different)
- Refresh the page and click **Regenerate** again
  - Expected: still uses the full project history (DB-backed), not just the current session
- If it fails (missing env / Claude error)
  - Expected: shows a red error line under the caption textarea

## Projects + slides (server APIs)
All editor project data is **account-scoped** (`account_id`) and accessed via `/api/editor/...`.

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

#### Poof RemoveBG upstream (2026-02-05)
- **Endpoint**: `https://api.poof.bg/v1/remove`
- **Multipart compatibility**: send the image under **both** `image_file` and `file` (Poof variants differ; this avoids 400 Bad Request).
- **Touched server routes**:
  - `src/app/api/editor/projects/slides/image/upload/route.ts`
  - `src/app/api/editor/projects/slides/image/removebg/route.ts`
  - `src/app/api/editor/projects/slides/image/reprocess/route.ts`
  - `src/app/api/editor/projects/jobs/generate-ai-image/route.ts` (optional BG removal step for AI images)

### Jobs
- `POST /api/editor/projects/jobs/start`
- `GET  /api/editor/projects/jobs/status`
- `POST /api/editor/projects/jobs/generate-copy`
- `POST /api/editor/projects/jobs/generate-image-prompts`
- `POST /api/editor/projects/jobs/generate-ai-image`

## Initial load path
- Client calls `POST /api/editor/initial-state`
  - Loads templates + projects (account-scoped)
  - Bootstraps starter templates for the active account (if needed)
  - Returns effective template type settings + template snapshots
 - **Client orchestration**: `src/features/editor/hooks/useEditorBootstrap.ts`

## Shared helpers
- **Template content region + default image placement**: `src/lib/templatePlacement.ts`
  - Used by both the editor (client) and AI-image persistence (server)

## Review / Approval flow (Ready → Share → Public review link)

This feature is **editor-owned** (no dependencies on Health/Marketing UI), but it adds:
- Superadmin-only controls inside `/editor`
- A **public, no-auth** review feed page under `/editor/review/<token>`

### Data model
- `public.carousel_projects` (project-level review flags)
  - `review_ready` (superadmin toggle)
  - `review_posted` (superadmin toggle; removes from queue)
  - `review_approved` (public review toggle)
  - `review_scheduled` (public review toggle; “VA step”)
  - `review_comment` (public review text; single overwritable note)
- `public.editor_account_settings`
  - `review_share_token` (per-account permanent unguessable token)

### Superadmin-only UI (inside `/editor`)
- **Top bar button**: `src/features/editor/components/EditorTopBar.tsx`
  - “Share carousels” button (superadmin-only)
- **Share modal**: `src/features/editor/components/ShareCarouselsModal.tsx`
  - Lists **Ready=true AND Posted=false** projects
  - Copy link (token URL) + toggles
  - Closes on backdrop click
- **Canvas/workspace overlay**: `src/features/editor/components/ReviewStatusOverlay.tsx`
  - Anchored to the dotted workspace container in `src/app/editor/EditorShell.tsx`

### Superadmin-only APIs (authed)
- `GET /api/editor/review/share-link` → `src/app/api/editor/review/share-link/route.ts`
- `GET /api/editor/review/queue-preview` → `src/app/api/editor/review/queue-preview/route.ts`
- `GET /api/editor/review/projects/list` → `src/app/api/editor/review/projects/list/route.ts`
- `POST /api/editor/review/projects/update` → `src/app/api/editor/review/projects/update/route.ts`

### Public review page + APIs (no auth; token-scoped)
- **Route**: `src/app/editor/review/[token]/page.tsx`
  - Client UI: `src/app/editor/review/[token]/review-page-client.tsx`
- **Public feed API**
  - `GET /api/editor/review-public/[token]` → `src/app/api/editor/review-public/[token]/route.ts`
  - Includes `templateSnapshotsById` + project + slide snapshots for rendering
- **Public mutation APIs**
  - `POST /api/editor/review-public/[token]/projects/[projectId]/approve`
  - `POST /api/editor/review-public/[token]/projects/[projectId]/schedule`
  - `POST /api/editor/review-public/[token]/projects/[projectId]/comment`

### Renderer note (important)
- The public review page uses `CarouselPreviewVision` in a “deterministic” mode (no drifting image preservation):
  - `onUserImageChange` is passed as a no-op
  - `clampUserImageToContentRect={false}` is enforced to match `/editor`

### Manual QA (Review / Approval)
- Superadmin in `/editor`
  - Overlay shows review toggles (Ready/Posted/Approved/Scheduled) at top-left of dotted workspace
  - “Share carousels” opens modal; clicking outside closes it
  - Modal list includes only `review_ready=true AND review_posted=false`
  - Toggling Ready/Posted persists and changes modal inclusion immediately
  - Copy link shows “Copied ✓” and copies `/editor/review/<token>`
- Public review page (`/editor/review/<token>`, no auth)
  - Shows only `review_ready=true AND review_posted=false` projects (max ~40)
  - Slide navigation: swipe + dots + left/right buttons
  - Approved toggle persists and gates the Download All (ZIP) button
  - Scheduled toggle persists (“VA step: Scheduled”)
  - Comment box autosaves (Saving… → Saved ✓) and persists on refresh
  - Download All (ZIP) shows Preparing… and downloads 6 PNGs for that project

## Outreach (Instagram → Template → Project)
Superadmin-only workflow to speed up outreach setup for creators. Input an Instagram URL, scrape profile data via Apify, then one-click create a customized template + a new project.

### Superadmin-only UI (inside `/editor`)
- **Top bar button**: `src/features/editor/components/EditorTopBar.tsx`
  - “Outreach” (superadmin-only)
- **Modal**: `src/features/editor/components/OutreachModal.tsx`
  - Base template dropdown (defaults to template named **“Outreach Template”** when present)
  - Scrape (Apify) → shows prioritized fields:
    - `profilePicUrlHD` (clamped to 2 lines so it can’t expand the modal)
    - `fullName`
    - `@username`
    - plus full raw JSON
  - “Run outreach” (one-click): **Scrape → Create template → Create project → Save record → Load project**
  - “Create Templates”: duplicates the selected base template and replaces layers by **`kind` OR `name`**:
    - image: `avatar`
    - text: `display_name`
    - text: `handle`
  - “Create Project”: creates a **Regular** project titled by scraped identity and applies template mappings for **all slides (1, 2–5, and 6)** to the newly created template
  - “Save record”: persists a row into `editor_outreach_targets` (mini CRM)
  - Reset/Close in the header; buttons are disabled while busy; errors are shown in a single banner

### Superadmin-only APIs (authed)
- `POST /api/editor/outreach/apify-probe` → `src/app/api/editor/outreach/apify-probe/route.ts`
  - Returns `{ fullName, username, profilePicUrlHD, raw }`
- `POST /api/editor/outreach/scrape-reel` → `src/app/api/editor/outreach/scrape-reel/route.ts`
  - Runs `apify/instagram-reel-scraper` for a single Reel/Post URL
  - Returns `{ reelUrl, shortcode, ownerUsername, ownerFullName, caption, transcript, raw }`
- `POST /api/editor/outreach/reel-video` → `src/app/api/editor/outreach/reel-video/route.ts`
  - Runs `apify/instagram-reel-scraper` with `includeDownloadedVideo`
  - Downloads the MP4 server-side and uploads to Supabase Storage bucket `reels`
  - Returns `{ bucket: "reels", path }`
- `POST /api/editor/outreach/transcribe` → `src/app/api/editor/outreach/transcribe/route.ts`
  - Downloads the reel MP4 from Supabase Storage bucket `reels`
  - Transcribes via OpenAI Whisper using `OPENAI_API_KEY`
  - Returns `{ transcript }`
- `POST /api/editor/outreach/topic-line` → `src/app/api/editor/outreach/topic-line/route.ts`
  - Generates a short topic label from reel caption/transcript via DeepSeek (`DEEPSEEK_API_KEY`)
  - Returns `{ topicLine }`
- `POST /api/editor/outreach/scrape-following` → `src/app/api/editor/outreach/scrape-following/route.ts`
  - Runs Apify following actor with maxResults (best-effort) + maxSpendUsd cap
  - Returns `{ seedUsername, items[] }` (normalized following prospects + raw)
- `POST /api/editor/outreach/qualify-lite` → `src/app/api/editor/outreach/qualify-lite/route.ts`
  - Batch-qualifies prospects via DeepSeek (lite scoring; strict JSON)
- `POST /api/editor/outreach/persist-prospects` → `src/app/api/editor/outreach/persist-prospects/route.ts`
  - Upserts “following” prospects into `editor_outreach_targets` (dedupe via unique index)
- `POST /api/editor/outreach/enrich-prospects` → `src/app/api/editor/outreach/enrich-prospects/route.ts`
  - Enriches saved prospects via Apify profile scraper and persists `enriched_*` fields + `profile_pic_url_hd`
- `POST /api/editor/outreach/mark-created` → `src/app/api/editor/outreach/mark-created/route.ts`
  - Updates the saved prospect row with `created_template_id` + `created_project_id` (and `project_created_at`)
- `POST /api/editor/outreach/create-template` → `src/app/api/editor/outreach/create-template/route.ts`
  - Duplicates base template, downloads `profilePicUrlHD` server-side (avoids CORS), overwrites avatar asset, updates text assets, and renames template
  - Includes robust name collision handling (adds `(@handle)` and/or numeric suffixes)
- `POST /api/editor/outreach/persist-target` → `src/app/api/editor/outreach/persist-target/route.ts`
  - Inserts a row into `editor_outreach_targets` (superadmin-only)
- `POST /api/editor/outreach/update-target` → `src/app/api/editor/outreach/update-target/route.ts`
  - Updates an existing `editor_outreach_targets` row (superadmin-only)
  - Used to attach Whisper transcript + reel video storage path after the initial record is persisted

## Swipe File (Linkwarden-inspired library)
Superadmin-only content library for saving links, enriching Instagram/YouTube content, and repurposing into carousels.

### Superadmin-only UI (inside `/editor`)
- **Top bar button**: `src/features/editor/components/EditorTopBar.tsx`
  - “Swipe File” (superadmin-only)
- **Modal**: `src/features/editor/components/SwipeFileModal.tsx`
  - Categories + saved items (account-scoped)
  - Enrich (Instagram + YouTube) + Repurpose into a new project
  - **Ideas Chat (Phase 1)**: “Generate ideas” button opens `SwipeIdeasChatModal`
- **Ideas Chat modal**: `src/features/editor/components/SwipeIdeasChatModal.tsx`
  - Persisted per-item chat thread and saved Idea cards
  - Master prompt override editor (account-wide) under Settings

### Superadmin-only APIs (authed)
- Swipe items:
  - `GET/POST /api/swipe-file/items` → `src/app/api/swipe-file/items/route.ts`
  - `PATCH/DELETE /api/swipe-file/items/[id]` → `src/app/api/swipe-file/items/[id]/route.ts`
  - `POST /api/swipe-file/items/[id]/enrich` → `src/app/api/swipe-file/items/[id]/enrich/route.ts`
  - `POST /api/swipe-file/items/[id]/create-project` → `src/app/api/swipe-file/items/[id]/create-project/route.ts`
- Ideas Chat (Phase 1):
  - `GET /api/swipe-file/items/[id]/ideas/thread` → `src/app/api/swipe-file/items/[id]/ideas/thread/route.ts`
  - `POST /api/swipe-file/items/[id]/ideas/messages` → `src/app/api/swipe-file/items/[id]/ideas/messages/route.ts`
  - `GET/POST /api/swipe-file/items/[id]/ideas` → `src/app/api/swipe-file/items/[id]/ideas/route.ts`
- Master prompt override (account-wide):
  - `GET/POST /api/editor/user-settings/swipe-ideas-master-prompt` → `src/app/api/editor/user-settings/swipe-ideas-master-prompt/route.ts`

### Phase 2 (Idea picker → project creation → Generate Copy)
- `src/features/editor/components/SwipeIdeasPickerModal.tsx`
  - Opened from Swipe File Repurpose section before creating a project
  - Allows selecting a saved idea **or** continuing without an idea (Angle/Notes fallback)
- `POST /api/swipe-file/items/[id]/create-project`
  - Accepts optional `ideaId` to snapshot the selected idea onto the new project
- `POST /api/editor/projects/jobs/generate-copy`
  - If `source_swipe_idea_snapshot` exists, it is used as the Swipe “angle” input (preferred over Angle/Notes)

## Script Chat (Create Script) — per project (MVP)
Superadmin-only chat modal for collaboratively drafting a Reel script from the current project.

### Superadmin-only UI (inside `/editor`)
- **Canvas/workspace overlay button**: `src/features/editor/components/ScriptChatOverlayButton.tsx`
  - Rendered in `src/app/editor/EditorShell.tsx` as an absolute overlay (**top-right**, desktop only)
  - Mobile: overlay is hidden; “Copy Script Prompt” is available in the bottom **⚙️ Controls** card
- **Modal**: `src/features/editor/components/ScriptChatModal.tsx`
  - Plain-text chat (no markdown)
  - One-click **Start new chat** (wipes thread/messages)
  - “View prompt” shows the exact cached context block and supports Copy
  - Uses a **frozen context snapshot** captured on thread creation:
    - slide `layout_snapshot.textLines` (all 6 slides)
    - project caption
    - account Brand Voice (`editor_account_settings.brand_alignment_prompt_override`)
  - Blocks if any slide is missing `layout_snapshot.textLines` → shows “Generate/Realign first.”

### Superadmin-only APIs (authed)
- `GET  /api/editor/projects/script-chat/thread?projectId=...` → `src/app/api/editor/projects/script-chat/thread/route.ts`
- `POST /api/editor/projects/script-chat/messages` → `src/app/api/editor/projects/script-chat/messages/route.ts`
- `POST /api/editor/projects/script-chat/reset` → `src/app/api/editor/projects/script-chat/reset/route.ts`
- `GET  /api/editor/projects/script-chat/prompt-preview?projectId=...` → `src/app/api/editor/projects/script-chat/prompt-preview/route.ts`

### Data model
- **Migration**: `supabase/migrations/20260303_000001_add_editor_project_script_chat.sql`
- **Tables**:
  - `public.editor_project_script_threads` (1 per `account_id + project_id`; includes frozen `context_snapshot`)
  - `public.editor_project_script_messages` (persisted chat history; `role in ('user','assistant')`)

### Manual QA (Script Chat)
- Open `/editor` as superadmin and load a project with deterministic layouts
  - Desktop expected: **Create Script** button appears top-right on the dotted workspace
- Click **Create Script**
  - Expected: modal opens and shows existing messages (if any)
- Send “Start with a hook about ___”
  - Expected: assistant responds in **plain text** (no markdown formatting)
- Close modal and reopen
  - Expected: prior messages persist
- Click **Start new chat**
  - Expected: messages clear immediately; a new thread starts (no confirmation typing)
- Click **View prompt** then **Copy**
  - Expected: copied text includes frozen context and ends with `CAPTION:` block
- Mobile: open `/editor` and scroll to the bottom **⚙️ Controls** card
  - Expected: **Copy Script Prompt** button appears at the very bottom and successfully copies the same prompt preview text
- Load a project where any slide is missing `layout_snapshot.textLines` (e.g. new/un-generated)
  - Expected: modal shows error “Generate/Realign first.” and Send is blocked until layouts exist

## Caption Regenerate (History + Exclude)
Caption regeneration persists run history and now supports superadmin-only exclusion of prior runs from future prompt context.

### UI (inside `/editor`)
- **Caption card**: `src/features/editor/components/EditorBottomPanel.tsx`
  - Superadmin-only “History” button opens `CaptionRegenHistoryModal`
- **Modal**: `src/features/editor/components/CaptionRegenHistoryModal.tsx`
  - View past caption regen runs (output caption)
  - Expand details to see `input_context` JSON and exact `prompt_rendered`
  - Toggle **Exclude / Include again** to control what is sent in future regen attempts

### APIs (authed; superadmin-only)
- `GET /api/editor/projects/caption-regen-runs?projectId=...` → `src/app/api/editor/projects/caption-regen-runs/route.ts`
- `GET/PATCH /api/editor/projects/caption-regen-runs/[id]?projectId=...` → `src/app/api/editor/projects/caption-regen-runs/[id]/route.ts`

### Data model
- **Migration**: `supabase/migrations/20260208_000001_add_editor_outreach_targets.sql`
- **Table**: `public.editor_outreach_targets`
  - `account_id` is **nullable metadata** (hybrid; not used for access control)
  - Stores scrape fields + `base_template_id` + `created_template_id` + `created_project_id`

### Manual QA (Outreach)
- As superadmin, “Outreach” button appears; non-superadmin doesn’t see it
- Modal defaults base template to “Outreach Template” (if present)
- Scrape valid IG URL shows prioritized fields + raw JSON; invalid URL shows a clear error
- “Run outreach” creates:
  - new template with updated avatar/name/handle
  - new Regular project titled by scraped identity
  - slide 1, 2–5, and 6 mappings updated to the new template
  - outreach record persisted
  - editor loads the new project
- Reset clears all modal state and allows a fresh run

## Database (high level)
Key tables used by `/editor`:
- `public.editor_accounts` (tenant/workspace)
- `public.editor_account_memberships` (who can access which account + role: `owner`/`admin`)
- `public.editor_superadmins` (who sees the account switcher)
- `public.editor_account_settings` (per-account settings)
  - `poppy_conversation_url` (Poppy board/chat/model for Generate Copy & Ideas)
  - `ai_image_gen_model` (default image model used by Generate AI Image; server enforced)
  - `ideas_prompt_override` (Generate Ideas prompt)
  - `caption_regen_prompt_override` (Caption Regenerate prompt)
- `public.editor_users` (editor profile fields; **not** the tenant boundary)
- `public.editor_recent_assets` (Phase 2: Image Library Recents)
  - account-scoped and deduped by storage path when available, else by URL
- `public.editor_logo_catalog` (Phase 3: Logos catalog; shared)
  - provider-agnostic logo metadata and variants used for fast search + tag filtering
- `public.editor_logo_assets` (Phase 3: Logos raster cache; shared)
  - provider-agnostic cached PNGs for logo variants, stored in `editor-shared-assets`
- `public.editor_project_script_threads` (Script Chat MVP; superadmin-only)
  - One thread per `account_id + project_id`; stores frozen `context_snapshot`
- `public.editor_project_script_messages` (Script Chat MVP; superadmin-only)
  - Persisted chat history for a project’s script chat thread
- `public.carousel_projects`
  - `account_id` (tenant boundary)
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
- `public.carousel_templates` (account-owned templates)
- `public.carousel_template_type_overrides` (account-owned template-type settings)
  - `prompt_override`: overrides the “Poppy Prompt” per account + template type
  - `best_practices_override`: superadmin-only Best Practices per account + template type (used only for Reel/Post outreach copy generation)
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
  - Per-account Poppy routing URL: `public.editor_account_settings.poppy_conversation_url`
- **Regenerate Emphasis Styles (All slides; Regular-only; styles-only)**:
  - UI: `src/features/editor/components/EditorBottomPanel.tsx` (button under Generate Copy in Controls card)
  - Modal: `src/features/editor/components/EmphasisAllModal.tsx` (guidance only; no attempts/restore)
  - Actions/orchestration: `src/app/editor/EditorShell.tsx` (apply + persist via live layout; never rewrites body)
  - API:
    - `POST /api/editor/projects/jobs/regenerate-body-emphasis-styles-all` → `src/app/api/editor/projects/jobs/regenerate-body-emphasis-styles-all/route.ts`
- **Outreach message (DM copy)**:
  - Stored on project: `public.carousel_projects.outreach_message`
  - Editor UI: shown superadmin-only above “¶ Body” in `src/features/editor/components/EditorBottomPanel.tsx`
- **Generate Image Prompts**: `src/features/editor/hooks/useGenerateImagePrompts.ts`
- **Generate AI Image**: `src/features/editor/hooks/useGenerateAiImage.ts`
  - Per-account image model: `public.editor_account_settings.ai_image_gen_model`
  - Per-project BG Removal default: `public.carousel_projects.ai_image_autoremovebg_enabled` (migration: `supabase/migrations/20260123_000001_add_ai_image_autoremovebg_enabled_to_carousel_projects.sql`)
  - Server route: `src/app/api/editor/projects/jobs/generate-ai-image/route.ts` (always stores PNG; mask always present)
- **Realign button behavior**: `src/app/editor/EditorShell.tsx` (calls the existing live-layout pipeline)
- **Body Regenerate (Regular-only)**:
  - UI: `src/features/editor/components/EditorBottomPanel.tsx` (Regenerate button in ¶ Body card)
  - Modal: `src/features/editor/components/BodyRegenModal.tsx` (guidance + previous attempts + restore)
  - Actions/orchestration: `src/app/editor/EditorShell.tsx` (open/close, apply + persist)
  - APIs:
    - `POST /api/editor/projects/jobs/regenerate-body` → `src/app/api/editor/projects/jobs/regenerate-body/route.ts`
    - `GET  /api/editor/projects/body-regen-attempts` → `src/app/api/editor/projects/body-regen-attempts/route.ts`
- **Regenerate Emphasis Styles (Regular-only; styles-only)**:
  - UI: `src/features/editor/components/EditorBottomPanel.tsx` (button in ¶ Body card)
  - Modal: `src/features/editor/components/BodyEmphasisStylesModal.tsx` (guidance + previous attempts + restore w/ remap)
  - Actions/orchestration: `src/app/editor/EditorShell.tsx` (open/close, apply + persist; never rewrites body)
  - APIs:
    - `POST /api/editor/projects/jobs/regenerate-body-emphasis-styles` → `src/app/api/editor/projects/jobs/regenerate-body-emphasis-styles/route.ts`
    - `GET  /api/editor/projects/body-emphasis-attempts` → `src/app/api/editor/projects/body-emphasis-attempts/route.ts`
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

