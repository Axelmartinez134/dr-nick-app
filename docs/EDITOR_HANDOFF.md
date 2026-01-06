# Editor Handoff (dr-nick-app) — Jan 2026

This doc summarizes everything implemented and decided in the `/editor` effort so another LLM can take over with minimal context loss.

## High-level goal
Create a new gated `/editor` experience that visually matches the provided “aiCarousels” inspiration (sidebar + dotted workspace + horizontal slide strip + bottom panel) and progressively dock the existing working Dr Nick carousel MVP into it.

Constraints/decisions:
- Keep shell UI layout stable; move existing MVP functionality into it.
- Templates should remain visible and used (Template dropdown + Template Editor).
- For now, persist using existing `ai_carousels` table (no `carousel_projects` DB yet).
- Multi-slide is 6 slides (MVP), switched via left/right arrows (no manual strip scrolling).
- Slide switch should auto-save current slide, then load next (empty if new).
- “Editor users” are gated via a DB allowlist table with RLS (`editor_users`).

## Auth + gating implemented
### `editor_users` allowlist
- Migration added: `supabase/migrations/20260105_000002_create_editor_users.sql`
  - Table: `public.editor_users(user_id uuid primary key references auth.users(id), created_at timestamptz)`
  - RLS: authenticated users can `SELECT` their own row only; no insert/update/delete policies (managed via Dashboard/SQL editor or service role).

### App routing behavior
- Single login page remains `/`.
- After login:
  - If user is in `editor_users` → redirect to `/editor`.
  - Otherwise → dashboard as before.
- `/editor` route:
  - Requires auth; non-auth redirects to `/`.
  - Requires editor allowlist; otherwise shows “Access denied”.

Key files:
- `src/app/components/auth/AuthContext.tsx`
  - Added `isEditorUser` + `editorLoading`
  - Added membership check against `editor_users`
  - Past-client redirect bypasses for `/editor` and for editor users.
- `src/app/components/auth/Login.tsx`
  - After sign-in, checks `editor_users`; if present, redirects to `/editor`.
- `src/app/page.tsx`
  - Prevent dashboard flash: while checking editor membership, shows loading and routes to `/editor`.
- `src/app/editor/page.tsx`
  - Gating wrapper; renders `EditorShell`.

## `/editor` shell UI
Implemented a React shell approximating the inspiration:
- Dotted background via CSS module `src/app/editor/EditorShell.module.css`
- Layout in `src/app/editor/EditorShell.tsx`
- Horizontal slide strip of 6 slides, arrows move active slide; manual scroll disabled.
- Shadow “gutter” inside the strip to avoid clipping by overflow.
- Several UI elements removed by request:
  - Removed top “Remove Watermark”
  - Removed bottom “Slide #” and slide-type buttons (“Text / Text+Image / Image”)
  - Removed bottom “Reorder / Delete / Add Slide +”

## Phase implementation history (important)
We used gated phases; each phase implemented only after user approved.

### Phase 1 (completed)
Extracted editor logic from `AICarouselPageVision` into a reusable hook:
- New: `src/app/components/health/marketing/ai-carousel/useCarouselEditorEngine.ts`
- Updated: `AICarouselPageVision.tsx` to consume hook (behavior intended unchanged).

### Phase 2 (completed)
Docked the existing MVP into `/editor` shell for Slide 1:
- Rendered `CarouselPreviewVision` inside the slide card (scaled to fit).
- Bottom panel wired to real Generate/Realign/Undo/Export/Save behaviors.
- Sidebar template dropdown wired + `TemplateEditorModal` mounted.

### Phase 3 (completed)
Enabled real 6-slide switching:
- `/editor` keeps `slides[0..5]` in-memory state.
- On arrow switch:
  - Force-save current slide (best effort) using existing `ai_carousels` save endpoint.
  - Load next slide by stored `carouselId` if present; else blank.

Implementation details:
- `useCarouselEditorEngine.performAutoSave()` now returns saved id (`string | null`).
- `useCarouselEditorEngine` exposes setters so `/editor` can restore state on slide switch:
  - `setLayoutData`, `setInputData`, `setLayoutHistory`, `setCurrentCarouselId`, etc.
- `/editor` renders Fabric preview only for the active slide; inactive slides show “saved/empty”.

## API authorization change (fix “Forbidden” for editor users)
The original marketing carousel endpoints were admin-email-only. That caused 403 “Forbidden” for editor-only users.

Fix implemented:
- `src/app/api/marketing/carousel/layout/route.ts`
  - Now allows requests if user is:
    - admin email (`NEXT_PUBLIC_ADMIN_EMAIL`) OR
    - has row in `editor_users` (checked via authed Supabase client)
- `src/app/api/marketing/carousel/realign/route.ts`
  - Same allowlist logic.

Note: save/load/list endpoints are already user-scoped by RLS and did not require admin email.

## Known behaviors / gotchas
### Image generation still happens
Even though UI/intent says “no images,” `/api/marketing/carousel/layout` currently **always** generates an image (GPT image generator) and then does layout. It does not respect `settings.includeImage === false` yet.
It auto-generates an image prompt if none is provided:
- `settings.imagePrompt` or `createMedicalImagePrompt(headline, body)`

If you want deterministic/no-image slides, you’ll need to:
- Change layout route to skip image generation when `includeImage === false`, and/or
- Switch to deterministic wrap-flow without images for editor mode.

### Prompt persistence
The DB has `custom_image_prompt` and save API stores it, but the UI currently doesn’t explicitly pass a stored prompt; API may auto-generate it. If reproducibility matters, store the generated prompt and send it back to client.

### Stale build confusion
User reported still seeing old UI text and “Forbidden” after fixes; likely due to stale dev server/browser cache. Restart dev server + hard refresh. Verify `editor_users` exists in the same Supabase project referenced by env vars.

## What’s in place right now (quick checklist)
- `/editor` gated by `editor_users`.
- `/editor` shell UI present and wired.
- Templates visible (dropdown + Template Editor modal).
- 6-slide arrow navigation; each slide can generate/realign/save.
- API endpoints allow editor users (not just admin) for layout/realign.

## Next work (suggested)
1) Decide whether to introduce real `carousel_projects` + `carousel_slides` tables (future-proof) or keep `ai_carousels` rows per slide longer.
2) Remove/disable image generation if the product truly doesn’t use images.
3) Replace Headline/Body fields with per-slide Tagline/Title/Paragraph + swipe indicator fields; map to template-defined text assets.
4) Add saved “projects” list into the left sidebar (currently only templates are wired).
5) More pixel-perfect UI polish (buttons, spacing) and optional keyboard navigation.


