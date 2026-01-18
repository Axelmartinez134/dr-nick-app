# /editor Codebase Map

This is a practical map of the `/editor` code so changes can be made without searching the entire repo.

## Quick orientation
- **Route**: `/editor`
- **Entry UI**: `src/app/editor/page.tsx` → renders `src/app/editor/EditorShell.tsx`
- **Core canvas**: `src/app/components/health/marketing/ai-carousel/CarouselPreviewVision.tsx` (Fabric.js)
- **Editor “engine” state**: `src/app/components/health/marketing/ai-carousel/useCarouselEditorEngine.ts`
- **Server APIs (editor)**: `src/app/api/editor/**/route.ts`

## Auth + gating
- **Auth state + editor allowlist**: `src/app/components/auth/AuthContext.tsx`
  - Checks `public.editor_users` to set `isEditorUser`
- **/editor gate**: `src/app/editor/page.tsx`
  - Redirects to `/` if not authed
  - Shows “Access denied” if not in `editor_users`

## The big client file (current)
- **Main editor UI + orchestration**: `src/app/editor/EditorShell.tsx`
  - Sidebar UI (Projects, Templates, Prompts, Typography)
  - Project list/load/create, slide switching
  - Debounced saves and stale-closure guards
  - Job orchestration (Generate Copy, Image prompts, AI image)
  - Image ops (upload/delete/reprocess/bg removal)
  - Lock layout, on-canvas styling persistence, auto realign-on-release

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
- **On-canvas text styling toolbar logic**: implemented in `src/app/editor/EditorShell.tsx`
  - Persists bold/italic/underline into `input_snapshot.*StyleRanges`

## Template system (editor)
- **Template editor modal**: `src/app/components/health/marketing/ai-carousel/TemplateEditorModal.tsx`
- **Template type settings (effective merged)**:
  - `src/app/api/editor/template-types/effective/route.ts`
  - `src/app/api/editor/template-types/overrides/upsert/route.ts`

## Projects + slides (server APIs)
All editor project data is owner-scoped and accessed via `/api/editor/...`.

### Project list/load/create/update
- `GET  /api/editor/projects/list` → list active projects (filters archived)
- `GET  /api/editor/projects/load?id=...` → load one project + its slides (filters archived)
- `POST /api/editor/projects/create`
- `POST /api/editor/projects/update`
- `POST /api/editor/projects/update-mappings`
- `POST /api/editor/projects/archive` → soft archive (sets `archived_at`)

### Slide persistence
- `POST /api/editor/projects/slides/update`
  - Updates `headline`, `body`, `layout_snapshot`, `input_snapshot`, `ai_image_prompt`
  - Merges `input_snapshot.editor` to prevent flag loss (e.g. `layoutLocked`, `autoRealignOnImageRelease`)

### Image routes
- `POST /api/editor/projects/slides/image/upload`
- `POST /api/editor/projects/slides/image/delete`
- `POST /api/editor/projects/slides/image/removebg`
- `POST /api/editor/projects/slides/image/reprocess`

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

## Database (high level)
Key tables used by `/editor`:
- `public.editor_users` (allowlist gate for `/editor`)
- `public.carousel_projects`
  - `owner_user_id`
  - `template_type_id`
  - `slide*_template_id_snapshot` fields
  - `archived_at` (soft archive)
- `public.carousel_project_slides`
  - `headline`, `body`
  - `layout_snapshot` (what the canvas renders)
  - `input_snapshot` (text content + style ranges + editor flags under `input_snapshot.editor`)
- `public.carousel_templates` (owner-only templates)
- `public.carousel_template_type_overrides` (per-user template-type settings)
- `public.carousel_generation_jobs` (job tracking for AI)

## “Where do I change X?” (common tasks)
- **Saved Projects dropdown UI**: `src/app/editor/EditorShell.tsx` (Saved Projects card)
- **Archive project behavior**: `src/app/editor/EditorShell.tsx` + `src/app/api/editor/projects/archive/route.ts`
- **Project list ordering**: `src/app/api/editor/projects/list/route.ts` + `EditorShell.refreshProjectsList`
- **Lock layout**: `src/app/editor/EditorShell.tsx` (flag stored in `input_snapshot.editor.layoutLocked`) + `CarouselPreviewVision.tsx` `lockTextLayout` prop
- **Auto realign on image release**: `src/app/editor/EditorShell.tsx` + suppression hook in `CarouselPreviewVision.tsx`
- **Realign button behavior**: `src/app/editor/EditorShell.tsx` (calls engine `handleRealign` / live-layout path)
- **Canvas selection/overlay issues**: `CarouselPreviewVision.tsx` (especially `contextTop` drawing and transforms)
- **Smart Guides behavior**: `smartGuides.ts` + wiring in `CarouselPreviewVision.tsx`
- **Template Settings mappings**: `EditorShell.tsx` + `POST /api/editor/projects/update-mappings`

## Refactor note
`src/app/editor/EditorShell.tsx` is intentionally targeted for phased refactor into `src/features/editor/`.\nSee: `~/.cursor/plans/editorshell_phased_refactor_4b6598db.plan.md`

