# Editor: Image Library modal + Logos (vision + phased plan)

## Why this doc exists
We are changing the `/editor` “Photo/Image” insert UX from **immediate upload** to a safer, more scalable **Image Library modal**.

This doc is the single source of truth for:
- The **end goal**
- The **phased rollout** (to minimize regressions)
- The exact **Phase 1 requirements** (approved)
- The later **Recents** + **Logos (Logo.dev first)** plan

Important: **Do not implement outside the current phase.** Each phase is validated before moving on.
Also important: edits must follow the `/editor` codebase guardrails documented in `docs/EDITOR_CODEBASE_MAP.md`.

---

## High-level end goal
Inside the `/editor` carousel canvas, clicking the current **Photo/Image icon** should open a **center modal** that lets the user:
- See **Recents** (all images they’ve used: uploads + AI images + logos)
- Upload/add a new image (preserving existing upload behavior)
- Later: browse/import **Logos** (starting with Logo.dev), preview them, store them in Supabase, and insert them as normal images

All “logos” are inserted as **normal images** (resizable/positionable), not a special component.

---

## Constraints / invariants (must not break)
- The existing **Upload image** flow must keep working (no regressions).
- Existing **per-image BG removal** behavior must keep working after insertion.
- Modal UX:
  - Center modal
  - Closes via:
    - outside click
    - Escape key
    - explicit close button

### Editing guardrails (from `EDITOR_CODEBASE_MAP.md`)
- Prefer **small, focused edits**.
- Prefer UI changes in `src/features/editor/components/*`.
- Prefer orchestration/behavior in `src/features/editor/hooks/*`.
- Prefer adding new handlers via the single **`state.actions`** surface (see `src/features/editor/hooks/useEditorStoreActionsSync.ts`).
- Avoid reintroducing “giant mirrored blobs” or new “bridge sync” hooks unless unavoidable.
- After each phase:
  - Update docs if ownership changes.
  - Add/update a **Manual QA** checklist.
  - Run `npm run build` and confirm it passes.

---

## Background removal policy (for this modal)
- **BG Removal toggle default**: always **OFF** (not sticky / not per-user remembered).
- Phase 1 requires **Option B (behavioral)**:
  - The modal’s BG Removal toggle controls whether BG removal is enabled **at the moment an uploaded image is inserted**.
  - This is intended to prevent wasting RemoveBG and to preserve logos/transparent assets when BG removal is unnecessary.

Notes:
- Even when BG removal is OFF, the system still needs whatever mask behavior the editor requires for deterministic wrapping.
- The existing per-image BG removal toggle (once an image is on-canvas) remains available and functional.

---

## Logo system vision (later phases)
Goal: “Readily available access to any logo I want” without breaking the editor and without huge manual effort.

### Storage philosophy
Use **import + cache**:
- When a logo is selected/imported, it is fetched once and cached into **Supabase Storage**.
- Future inserts use the cached asset (fast/reliable, avoids broken upstream links).

We do **not** bulk-ingest thousands of logos up front in Phase 1.

### Search expectations
User wants the ability to search by:
- brand name (if available)
- domain (if available)
- categories/tags (if available)

Reality check:
- Different sources provide different metadata. We must validate what Logo.dev exposes before finalizing schema/UX.

### Logo variants
- Variants (color/black/white) should be presented as **separate selectable tiles** (simple).
- Variants are **only used when the source provides them** (no auto-generation).
- Preview is required so the user can visually pick the most suitable variant.

### License/usage
User explicitly stated usage is “purely educational” and brands want usage in this context. We will not build heavy compliance gates for this.

---

## Phased rollout plan (safest path)

### Phase 1 (approved): Modal shell + Upload works + BG toggle is behavioral
**Goal**: Replace “click image icon → immediate upload” with “click image icon → modal”, while preserving upload behavior.

**Must include**
- Center modal with close behaviors (outside click, Esc, close button)
- Placeholder sections:
  - Recents (placeholder only in Phase 1)
  - Logos (placeholder only in Phase 1)
- “Upload/Add image” action that uses the **same underlying upload flow** as today
- **BG Removal toggle** (default OFF) that **controls BG removal at insert time** for uploaded images

**Code ownership expectations (do not implement yet; for planning only)**
- **UI (modal + placeholders)**: should live in `src/features/editor/components/*` (new component).
- **Action wiring**:
  - Add a new stable action under `state.actions` (via `useEditorStoreActionsSync.ts`) for “open image library modal”.
  - Modal open/close state should be published as a store slice (following existing store patterns in `/editor`).
- **Canvas/image button hook-up**:
  - The “Photo/Image icon” click is likely routed through canvas/interaction code (see Codebase Map “Canvas + interactions (Fabric)”), so the click handler should call `state.actions.openImageLibraryModal()` (not trigger upload directly).
- **Upload behavior**:
  - The upload operation should continue to use the existing image upload pipeline (see Codebase Map “Image routes” + “Image ops” hooks), with the Phase 1 delta being: the modal’s BG toggle controls initial insert behavior.

**Manual QA (Phase 1)**
- Upload image from modal:
  - image inserts correctly
  - no regressions in placement, scaling, masking, or canvas interactivity
- BG Removal toggle OFF at insert:
  - inserted image does NOT auto-run background removal
  - existing per-image BG removal UI can still be used later
- BG Removal toggle ON at insert:
  - inserted image behaves as it does today when BG removal is enabled
- Modal close:
  - click outside closes
  - Esc closes
  - close button closes
- No crashes, no text/layout regressions in editor

### Phase 2: Recents (all images)
**Goal**: Populate “Recents” with all images used by the user (uploads + AI images now; cached logos later).

**Decision**: Option B (Saved recents table) — a dedicated `public.editor_recent_assets` table keyed by `owner_user_id`.

**Current status (implemented)**
- UI: Recents grid renders inside `ImageLibraryModal` (click to insert).
- Insert behavior: “fresh insert” uses the modal BG toggle (default OFF).
- If modal BG toggle is ON: modal stays open and shows a spinner until BG removal finishes.
- Write paths (best-effort):
  - Uploads touch Recents after upload success.
  - AI image generation touches Recents after generation success.

**Important auth nuance**
- `/api/editor/*` routes require `Authorization: Bearer <token>` (they do not read cookies).
- Recents loading must go through the editor’s authed `fetchJson` path (via `state.actions`) to avoid `Unauthorized`.

**Manual QA (Phase 2)**
- Open Image Library modal → Recents loads (no “Unauthorized”)
- Upload a PNG/JPG/WebP → it appears in Recents
- Generate an AI image (Enhanced) → it appears in Recents
- Click a recent with BG toggle OFF:
  - modal closes immediately
  - image is inserted and is movable/resizable
  - image’s `bgRemovalEnabled` is false and wrapping uses the rectangle mask behavior
- Click a recent with BG toggle ON:
  - modal stays open and shows spinner
  - after completion, modal closes and the inserted image uses processed PNG + mask

### Phase 3: Logos — source #1 = VectorLogoZone (conservative rollout)
**Goal**: Turn the “Logos” placeholder into a real browser + importer for a first source, starting with **VectorLogoZone**:
- Search by **name** (title), **source_key** (slug/logohandle), **tags**, and **website/domain**
- Filter by **tags/categories**
- Show **variants as separate tiles** (only what the source provides)
- On selection: **cache globally** into Supabase (shared across all editor users), convert **SVG → PNG on the server**, then insert as a normal image

**Key UI decisions (approved)**
- Logos section includes a **Provider dropdown**:
  - VectorLogoZone
  - Lobe Icons
  - Developer Icons
  - SVG Logos (svgporn)
  - SVG Logos (gilbarbara)
  - Simple Icons
- Tag UI uses **Top tags as chips** (e.g., 12 chips) plus a **“More tags…” dropdown** for the full list.
- Background removal toggle in the modal remains **default OFF** and controls BG removal **at insert-time**.

**Data reality (VectorLogoZone)**
- Per-logo metadata exists at `www/logos/<slug>/index.md` in the VLZ repo, including:
  - `title`, `tags[]`, `website`, `images[]` (variants)

#### Phase 3 conservative rollout (stop after each phase until user says “proceed”)

##### Phase 3A — DB only (no UI changes)
**Goal**: Add new tables for logo catalog + global raster cache (no runtime behavior changes).
- Add `public.editor_logo_catalog` (provider-agnostic)
- Add `public.editor_logo_assets` (provider-agnostic; shared cache of PNGs by `(source, source_key, variant_key)`)
**Manual QA**: apply migrations; confirm tables exist.

##### Phase 3B — Manual ingestion script (populate catalog once)
**Goal**: Add a manual script that ingests VectorLogoZone metadata into `editor_logo_catalog` for fast search.
- Script outputs a small report (logo count, variant count, top tags).
**Manual QA**: run script; validate counts/tags.

##### Phase 3C — Read-only Logos UI (“view mode”)
**Goal**: Implement Logos browser UI with provider dropdown + search + tags + variants grid, but **no import/insert** yet.
**Manual QA**: open modal → Logos shows results; search and tag filtering works; no editor regressions.

##### Phase 3D — Import + global cache (SVG→PNG) (no insertion yet)
**Goal**: Clicking a tile imports + converts + stores PNG in Supabase and records `editor_logo_assets`, but does **not** insert into canvas yet.
**Manual QA**: click tile → cache created; second click reuses cache; no insertion.

##### Phase 3E — Insert + Recents integration
**Goal**: Final wiring: insert cached PNG into canvas as a normal image and touch Recents.
- Respect modal BG toggle:
  - OFF: insert immediately and close modal
  - ON: keep modal open with spinner until BG removal finishes, then close
**Manual QA**: end-to-end: search → import/cached → insert → appears in Recents.

### Phase L (implemented): Logos — source #2 = Lobe Icons
**Status**: Implemented (Phases **L1–L3**).

**Data reality (Lobe Icons)**
- Repo: `lobehub/lobe-icons` (default branch: `master`)
- Metadata per icon: `src/<Name>/index.md` frontmatter:
  - `group: Provider|Model|Application` (used as the only tag; Option 1)
  - `title` (display)
  - `description` (usually a website URL; used as `website`)
- Variants: static SVG pack in `packages/static-svg/icons/*.svg`
  - Naming: `<key>.svg`, plus suffix variants like `-color`, `-text`, `-brand`, `-brand-color`, etc.

**Manual ingestion (L1)**
- Script: `scripts/logo_catalog/ingest_lobe_icons.mjs`
- Writes rows into `public.editor_logo_catalog`:
  - `source='lobe-icons'`
  - `source_key=<baseKeyLower>`
  - `tags=['provider'|'model'|'application']` (best-effort; some rows may have `[]` if no valid group)
  - `variants[]` populated from static SVG filenames

### Phase D (implemented): Logos — source #3 = Developer Icons
**Status**: Implemented (Phases **D1–D3**).

- Catalog ingestion: `scripts/logo_catalog/ingest_developer_icons.mjs`
  - Tags: `categories` only (Title Case)
  - Variants: `icons/*.svg` (ignore `icons/raw/`)

### Phase S (implemented): Logos — source #4 = SVG Logos (svgporn)
**Status**: Implemented (Phases **S1–S3**).

- Catalog ingestion: `scripts/logo_catalog/ingest_svgporn.mjs`
  - Tags: `categories[]` only (ignore dataset `tags[]`)
  - Variants: `files[]` via `cdn.svglogos.dev`

### Phase G (implemented): Logos — source #5 = SVG Logos (gilbarbara)
**Status**: Implemented.

- Catalog ingestion: `scripts/logo_catalog/ingest_gilbarbara_logos.mjs`
  - Tags: enriched from the svgporn dataset categories when possible (matched by `shortname`)
  - Variants: `logos/<shortname>/<variant>.svg` from the gilbarbara repo

### Phase SI (implemented): Logos — source #6 = Simple Icons
**Status**: Implemented.

- Catalog ingestion: `scripts/logo_catalog/ingest_simple_icons.mjs`
  - Tags: none upstream (search-only)
  - Variants: one-per-icon `icons/<slug>.svg` from the Simple Icons repo (`develop` branch)
  - Note: slugs are derived via `slugs.md` mapping (so icons like Airtable ingest correctly)

### Phase 4+: Additional sources (optional)
Only after we validate their metadata formats and categories/tags (or accept “search-only” providers).

---

## Open questions (defer until after Phase 1)
- What exact metadata does Logo.dev provide (domain, name, categories, variants)?
- (Answered) Recents approach: stored table (`public.editor_recent_assets`)
- Confirm Logo.dev integration surface: fetch + cache + variants UI + insert-time BG toggle OFF by default

---

## Security note (action item)
A real `GOOGLE_AI_API_KEY` was pasted into chat. Treat it as compromised:
- Rotate the key in Google AI
- Update `.env.local`
- Avoid sharing secrets in chat

