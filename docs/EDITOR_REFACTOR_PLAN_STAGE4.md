# Stage 4: EditorShell refactor (Canvas + Store ownership)

This document is the **canonical plan** for Stage 4 of the `/editor` refactor. It is versioned in git so it can be shared across a dev team.

## Goal

Make `src/app/editor/EditorShell.tsx` significantly smaller and safer to change by:
- Extracting remaining “behavior islands” (store mirroring, live-layout queue, canvas interactions) into feature-owned hooks under `src/features/editor/`.
- Preserving **UI and behavior** while we refactor (phase gates + explicit smoke tests).

## Constraints

- **No UI changes** (unless explicitly requested).
- **No behavior changes** (unless explicitly requested).
- Proceed phase-by-phase only when Axel says “Proceed to …”.
- Keep `docs/EDITOR_CODEBASE_MAP.md` updates **until the end of Stage 4** (separate from this plan doc).

## Current architecture (why Stage 4 exists)

Current setup:
- `EditorShell.tsx` owns most local state (`useState`, `useRef`).
- A store-mirroring layer pushes state/actions into `editorStore` via `useLayoutEffect`.
- UI components read from the store using selector hooks (`useEditorSelector`).

This “EditorShell owns, store mirrors” pattern is **intentional scaffolding** from Stage 2/3 to migrate UI off prop-drilling safely. Stage 4 continues the migration by extracting the remaining large behavior blocks so we can later move toward **single-source-of-truth ownership**.

## Stage 4A (completed): Extract store mirroring

### Phase 4A1 (completed)

**Extract the actions mirroring** into:
- `src/features/editor/hooks/useEditorStoreActionsSync.ts`

Wire-up:
- `src/app/editor/EditorShell.tsx` calls `useEditorStoreActionsSync(...)`
- Exported from `src/features/editor/hooks/index.ts`

**Passed tests**:
- Saved Projects dropdown: open/close, load, archive modal flow.
- Project title input caret stability.
- Prompts modal caret stability.
- Template mappings update current project immediately.

### Phase 4A2 (completed)

**Extract the big store mirroring** (top-level + `workspace` + `bottomPanel`, includes the under-slide controls row + copy progress icon) into:
- `src/features/editor/hooks/useEditorStoreWorkspaceSync.tsx`

Wire-up:
- `src/app/editor/EditorShell.tsx` calls `useEditorStoreWorkspaceSync(...)`
- Exported from `src/features/editor/hooks/index.ts`

Notes:
- The hook file is `.tsx` because it contains JSX (`CopyProgressIcon`, `renderActiveSlideControlsRow`).
- A stray accidental folder entry was removed during the migration (avoid shadowing module resolution).

**Passed tests**:
- Slides row: switch slides, upload image, lock layout, auto realign toggle, B/I/U/Clear pills.
- Bottom panel: Generate Copy + progress, image prompts, AI image, caption caret stability.
- Overlay toggle stable across slide switches.

### Post-4A bug fix (completed)

Fix: inconsistent “Auto realign on release” visibility when image selected.

Cause:
- Fabric selection listener sometimes attached before the canvas was mounted.

Fix:
- Re-run selection listener attachment effect when `activeCanvasNonce` changes so the listener always attaches once the active Fabric canvas exists.

## Stage 4B (in progress): Extract live-layout queue + Realign orchestration

### Scope

Extract the live-layout pipeline currently in `EditorShell.tsx`:
- `enqueueLiveLayoutForProject(...)`
- `processLiveLayoutQueue(...)`
- `scheduleLiveLayout(...)`
- “Realign Text” orchestration (the computational branch that enqueues live layout)
- Supporting helpers like `wipeLineOverridesForActiveSlide()`

### Current extracted module(s)

- `src/features/editor/hooks/useLiveLayoutQueue.ts` (created)
  - Goal: own the queue orchestration while preserving runId guards and persistence behavior.

Important: Stage 4B must preserve the “no stale bleed” guarantees:
- UI updates only apply if `(currentProjectIdRef.current === projectIdAtStart)`
- Persistence always writes to the original project+slide key.

### Safety gate: smaller sub-phases (recommended)

Instead of a single big cutover, do Stage 4B as:
- **4B1**: Extract queue core (`enqueueLiveLayoutForProject` + `processLiveLayoutQueue`) and wire it, keep `scheduleLiveLayout` and `runRealignTextForActiveSlide` local.
- **4B2**: Extract `scheduleLiveLayout`.
- **4B3**: Extract `wipeLineOverridesForActiveSlide` and update realign to use extracted pieces.

### Stage 4B test checklist

- Generate Copy triggers sequential live layout across slides.
- Typing in RichText triggers debounced/queued layout as before.
- Realign Text button still works and is undoable as before.
- Enhanced Lock layout ON prevents auto-reflow on that slide.
- No cross-project/slide bleed when switching mid-run.

## Stage 4C (planned): Extract Fabric selection + text styling persistence

Goal:
- Move selection tracking + inline styling persistence (bold/italic/underline/clear) out of `EditorShell.tsx`.

Test checklist:
- Select text on canvas → pills appear.
- Clicking pills does not drop selection/highlight.
- Styles persist across slide switches and reload.

## Stage 4D (planned, highest risk): Extract workspace/canvas wiring

Goal:
- Move Fabric lifecycle wiring, mount/unmount, and cross-canvas coordination into a workspace controller module.

Test checklist:
- Slide strip renders canvases; switching slides restores correct snapshot.
- Upload image + move/resize + BG removal + auto realign on release still works.
- No scroll regressions; overlays behave.

## Stage 4E (planned): Final thin-shell pass

Goal:
- `EditorShell.tsx` becomes mostly: composition + a small number of hooks + layout.

Full smoke checklist:
- Entry/boot.
- Load/switch/archive projects.
- Slide switching 1–6.
- Generate Copy + switch project mid-run.
- Image prompts regenerate.
- AI image generate + reload mid-run.
- Upload image + removebg + reprocess.
- Lock layout + edit on canvas.
- Download all.

