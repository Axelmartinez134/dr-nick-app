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

## Refactor end-state (feature folder)
`src/app/editor/EditorShell.tsx` remains the route entry, but most editor logic now lives in `src/features/editor/`.

### Feature root
- `src/features/editor/`
  - `components/` (UI subcomponents)
  - `hooks/` (stateful orchestration)
  - `services/` (client-safe API callers)
  - `state/` (types + pure state helpers)
  - `utils/` (pure helpers)

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
- **On-canvas text styling toolbar logic**: implemented in `src/app/editor/EditorShell.tsx`
  - Persists bold/italic/underline into `input_snapshot.*StyleRanges`

## Editor feature modules (what was extracted)
### Projects
- **UI**: `src/features/editor/components/SavedProjectsCard.tsx`
- **Hook**: `src/features/editor/hooks/useProjects.ts`
- **API**: `src/features/editor/services/projectsApi.ts`

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

### Generation jobs
- **Generate Copy**: `src/features/editor/hooks/useGenerateCopy.ts`
- **Generate Image Prompts**: `src/features/editor/hooks/useGenerateImagePrompts.ts`
- **Generate AI Image**: `src/features/editor/hooks/useGenerateAiImage.ts`

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
- **Saved Projects dropdown UI**: `src/features/editor/components/SavedProjectsCard.tsx`
- **Projects list/load/archive orchestration**: `src/features/editor/hooks/useProjects.ts`
- **Archive endpoint**: `src/app/api/editor/projects/archive/route.ts`
- **Slide autosave debouncing**: `src/features/editor/hooks/useSlidePersistence.ts`
- **Lock layout flag helpers**: `src/features/editor/state/editorFlags.ts`
- **Auto realign on image release**: `src/features/editor/hooks/useImageOps.ts` + `src/features/editor/hooks/useAutoRealignOnImageRelease.ts`
- **Generate Copy**: `src/features/editor/hooks/useGenerateCopy.ts`
- **Generate Image Prompts**: `src/features/editor/hooks/useGenerateImagePrompts.ts`
- **Generate AI Image**: `src/features/editor/hooks/useGenerateAiImage.ts`
- **Realign button behavior**: `src/app/editor/EditorShell.tsx` (calls the existing live-layout pipeline)
- **Canvas selection/overlay issues**: `CarouselPreviewVision.tsx` (especially `contextTop` drawing and transforms)
- **Smart Guides behavior**: `smartGuides.ts` + wiring in `CarouselPreviewVision.tsx`
- **Template Settings mappings**: `EditorShell.tsx` + `POST /api/editor/projects/update-mappings`

## Refactor note
This refactor followed the phased plan at `~/.cursor/plans/editorshell_phased_refactor_4b6598db.plan.md`.

