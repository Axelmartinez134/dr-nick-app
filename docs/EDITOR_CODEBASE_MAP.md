# /editor Codebase Map

This is a practical map of the `/editor` code so changes can be made without searching the entire repo.

## Quick orientation
- **Route**: `/editor`
- **Entry UI**: `src/app/editor/page.tsx` → renders `src/app/editor/EditorShell.tsx`
- **Route error boundary**: `src/app/editor/error.tsx` (prevents “blank screen” on crashes)
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
  - `store/` (selector-based editor store; Stage 2)
  - `utils/` (pure helpers)

## Current UI composition (after Stage 2 wiring)
At this point, **UI components read from the editor store**, and `EditorShell.tsx` still owns the behavior and mirrors state/handlers into the store.

- **Top bar**: `src/features/editor/components/EditorTopBar.tsx` (reads `state.*` + `state.actions`)
- **Left sidebar + saved projects**:
  - `src/features/editor/components/EditorSidebar.tsx` (reads store)
  - `src/features/editor/components/SavedProjectsCard.tsx` (reads store)
- **Modals**:
  - `src/features/editor/components/TemplateSettingsModal.tsx` (reads store)
  - `src/features/editor/components/PromptsModal.tsx` (reads store; `EditorShell.tsx` still owns textarea refs for focus)
- **Slides/workspace strip**: `src/features/editor/components/EditorSlidesRow.tsx` (reads `state.workspace`)
- **Bottom panel**: `src/features/editor/components/EditorBottomPanel.tsx` (reads `state.bottomPanel`)

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

### Generation jobs
- **Generate Copy**: `src/features/editor/hooks/useGenerateCopy.ts`
- **Generate Image Prompts**: `src/features/editor/hooks/useGenerateImagePrompts.ts`
- **Generate AI Image**: `src/features/editor/hooks/useGenerateAiImage.ts`
- **Wiring wrapper (Stage 3D)**: `src/features/editor/hooks/useEditorJobs.ts` (centralizes how the three job hooks are wired together)

### Live layout queue + realign orchestration (Stage 4B)
- **Hook**: `src/features/editor/hooks/useLiveLayoutQueue.ts`

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
 - **Client orchestration**: `src/features/editor/hooks/useEditorBootstrap.ts`

## Shared helpers
- **Template content region + default image placement**: `src/lib/templatePlacement.ts`
  - Used by both the editor (client) and AI-image persistence (server)

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

### Stage 3 (ownership migration) summary
Stage 3 keeps the **store-driven UI** from Stage 2, but starts moving real behavior out of `EditorShell.tsx` into cohesive feature hooks.

- **Phase 3A (bootstrap/hydration)**: moved `/api/editor/initial-state` boot + hydration into `src/features/editor/hooks/useEditorBootstrap.ts`
- **Phase 3B (project lifecycle)**: moved `loadProject` / `createNewProject` + slide hydration into `src/features/editor/hooks/useProjectLifecycle.ts`
- **Phase 3C (project meta persistence)**: moved debounced project title/caption saves into `src/features/editor/hooks/useEditorPersistence.ts`
- **Phase 3D (job wiring)**: centralized `Generate Copy` / `Generate Image Prompts` / `Generate AI Image` wiring into `src/features/editor/hooks/useEditorJobs.ts`
- **Phase 3E (thin shell + docs)**: removed dead code paths/imports in `EditorShell.tsx` and updated this repo map to reflect new ownership

### Stage 4 (canvas + store ownership) summary
Stage 4 continues shrinking `EditorShell.tsx` by extracting remaining “behavior islands” into editor-owned hooks.

- **4A (store mirroring)**: `useEditorStoreActionsSync`, `useEditorStoreWorkspaceSync`
- **4B (live layout queue)**: `useLiveLayoutQueue`
- **4C/4D (canvas wiring)**: `useCanvasTextStyling`, `useActiveImageSelection`, `useCanvasExport`, `useSlidesViewport`, `useFabricCanvasBinding`, `useMultiCanvasRefs`

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
  - Workspace: `EditorSlidesRow` (reads `state.workspace`)
  - Bottom panel: `EditorBottomPanel` (reads `state.bottomPanel`)
- **EditorShell still owns behavior**:
  - It mirrors state into the store via `useLayoutEffect(...)` and provides callbacks via:
    - `state.actions` (top/left/modals)
    - `state.workspace` (slides strip + canvas wiring)
    - `state.bottomPanel` (RichText + jobs + controls + caption)

