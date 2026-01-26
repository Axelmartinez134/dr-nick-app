# Multi-image per slide (Editor `/editor`) — phased plan (DO-NO-HARM)

## Goal (v1)
Enable **multiple images per slide** in the main `/editor` by making image inserts **additive**.

- Existing behavior must not break.
- Only **one primary image** affects wrapping/mask (`layout.image`).
- Additional images are **stickers** (`layout.extraImages[]`) and do **not** affect wrapping.
- Stickers default **below text**.
- Delete is **remove-from-slide only** (never delete storage; assets remain in Recents).
- User can “Set as primary (affects wrapping)” on any sticker.
- When primary is deleted, leave slide with **no primary** until user sets one.
- Export must match canvas exactly (exports are Fabric canvas capture).

---

## Current codebase reality (important)
- The slide snapshot layout is architected around **one** image slot: `layout.image`.
- Upload/Recents/Logos/AI image generation currently **set/replace** `layout.image`.
- Existing delete path calls `/api/editor/projects/slides/image/delete` which removes from Supabase Storage. v1 multi-image requires **not calling this** for normal “delete from slide”.
- Export is a **canvas screenshot** (`fabricCanvas.toDataURL({ multiplier: 3 })`) via `src/features/editor/hooks/useCanvasExport.ts`.  
  **Implication**: If extra images render onto Fabric, they automatically appear in exports (no special export code needed).

---

## Data model (backwards compatible)
We keep the existing primary behavior unchanged by leaving `layout.image` as-is.

- Keep: `layout.image` (primary; existing semantics unchanged)
- Add: `layout.extraImages?: ImageObject[]` (stickers)

### `ImageObject` (v1 shape)
- `id: string` (required for stable persistence/selection/deletion)
- `url: string`
- `storage?: { bucket: string; path: string } | null` (optional but recommended)
- `x: number`, `y: number`, `width: number`, `height: number`
- `angle?: number`
- `bgRemovalEnabled?: boolean`
- `bgRemovalStatus?: string`
- `original?`, `processed?`, `mask?` allowed (stickers do not affect wrapping even if mask exists)

---

## Phase 1 — Persistence-only inserts (no rendering yet)
### Goal
Allow multiple images to be stored in slide snapshots with minimal risk.

### Behavior
- If a slide has **no primary** (`layout.image` missing), the first insert becomes primary (`layout.image`).
- If a slide **already has a primary**, new inserts append to `layout.extraImages[]` (do not touch `layout.image`).
- Primary replacement (AI image / explicit set-primary): **replace `layout.image` and keep `extraImages[]` unchanged**.

### Code edits (surgical)
- `src/features/editor/hooks/useImageOps.ts`
  - `uploadImageForActiveSlide`: change from always setting `layout.image` → append to `extraImages[]` when primary exists.
  - `insertRecentImageForActiveSlide`: same logic. This covers Recents + Logos, because Logos insert routes through this function.

### Risks / gotchas (2nd/3rd order)
- Must append using the latest in-memory layout snapshot (avoid overwriting recent image moves).
- Must preserve `extraImages[]` when any other path replaces primary.
- Snapshot payload can grow; watch for performance issues if users add many stickers.

### QA checklist
- Insert first image → behaves identical to today.
- Insert second image → does not remove/replace primary (verify `layout_snapshot.extraImages` persists).
- Reload project → extras remain in persisted snapshot (even if not rendered yet).

---

## Phase 2 — Render extra images on canvas (below text; export “just works”)
### Goal
Show stickers visually and ensure exports include them automatically.

### Code edits
- `src/app/components/health/marketing/ai-carousel/CarouselPreviewVision.tsx`
  - Render `layout.extraImages[]` as Fabric images.
  - Tag each image object with Fabric metadata:
    - primary: `{ role: 'user-image', imageId, imageKind: 'primary' }`
    - sticker: `{ role: 'user-image', imageId, imageKind: 'sticker' }`
  - Ensure stickers are moved **below user text** even with async image loading (enforce `moveTo` / z-order after load).

### Export implication
- No export code changes needed (export is canvas screenshot).

### Risks / gotchas
- Async loads can reorder stacking; must enforce deterministic ordering after each image loads.
- Many images can slow Fabric; v1 is unlimited by spec.

### QA checklist
- Insert multiple images → all visible on canvas.
- Export (Download All / Share) → stickers appear exactly as on canvas.

---

## Phase 3 — Selection + multi-select + delete remove-from-slide only
### Goal
Delete a specific sticker (or multiple selected) without storage deletion; keep Recents intact.

### Code edits
- `src/features/editor/hooks/useActiveImageSelection.ts`
  - Treat Fabric `activeSelection` as “image selected” if any selected object has `data.role === 'user-image'`.

- Delete behavior (remove-from-slide only)
  - Add a remove-from-slide deletion path that mutates only the slide snapshot:
    - selected primary → remove `layout.image`
    - selected stickers → filter from `layout.extraImages[]`
  - Ensure this path does **not** call `/api/editor/projects/slides/image/delete`.
  - (Storage deletion remains a future explicit “Delete from library/storage” action.)

### Risks / gotchas
- Current delete flow calls storage delete; must be bypassed in v1.
- Undo/redo must capture changes (or deletion feels “irreversible”).

### QA checklist
- Single delete removes only that image from slide.
- Cmd multi-select delete removes multiple stickers.
- Assets remain available in Recents (no storage deletion).

---

## Phase 4 — “Set as primary (affects wrapping)”
### Goal
Promote a sticker to primary (wrapping image) safely.

### Behavior
- Promote clicked sticker → becomes `layout.image`
- Demote old primary → appended into `layout.extraImages[]`
- Remove promoted sticker from `layout.extraImages[]`
- Trigger reflow/realign so wrapping uses the new primary.

### Risks / gotchas
- Must preserve metadata (storage/original/processed/mask/bgRemoval) during swaps.
- Must preserve current transform (x/y/width/height/angle) when promoting.

### QA checklist
- Promote sticker → wrapping changes; nothing disappears.
- Old primary becomes sticker and remains visible and deletable.

---

## Phase 5 — Follow-ups / guardrails
- Ensure AI image generation replaces primary while preserving `extraImages[]`.
- Consider soft warnings for very high sticker counts (perf).
- Later: apply the same model to Template Editor (explicitly out of scope for v1).

---

## Critical “do-no-harm” invariants
- `layout.image` behavior unchanged:
  - wrapping/mask
  - BG removal toggle/reprocess
  - drag/resize persistence
  - export
- No storage deletions on slide delete (remove-from-slide only).

---

## “Primary setters” audit checklist (exact grep targets)
These are the places that currently set/replace `layout.image` and must be audited so they **preserve `extraImages[]`**.

### Client-side primary setters
- `src/features/editor/hooks/useImageOps.ts`
  - `uploadImageForActiveSlide`
  - `insertRecentImageForActiveSlide`
  - `setActiveSlideImageBgRemoval` (should not wipe extras; must preserve snapshot)
- `src/features/editor/hooks/useGenerateAiImage.ts` (builds `nextLayout = { ...baseLayout, image: {...} }`)

### Server-side primary setters / persistence
- `src/app/api/editor/projects/jobs/generate-ai-image/route.ts` (builds `nextLayoutSnapshot = { ...baseLayout, image: {...} }`)
- `src/app/api/editor/projects/slides/update/route.ts` (stores `layoutSnapshot` as-is; callers must not drop extras)

### Renderer (Phase 2)
- `src/app/components/health/marketing/ai-carousel/CarouselPreviewVision.tsx`

### Storage deletion route (must NOT be used by normal delete-from-slide)
- `src/app/api/editor/projects/slides/image/delete/route.ts`

---

## Grep commands (run before each phase)
From repo root:

```bash
rg -n "layout\\.image\\b|\\(layout as any\\)\\.image|image:\\s*\\{" src
rg -n "insertRecentImageForActiveSlide|uploadImageForActiveSlide|setActiveSlideImageBgRemoval" src/features/editor/hooks/useImageOps.ts
rg -n "nextLayout\\s*=\\s*\\{|layoutSnapshot" src/features/editor/hooks/useGenerateAiImage.ts src/features/editor/hooks/useImageOps.ts
rg -n "nextLayoutSnapshot\\s*=\\s*\\{|layout_snapshot" src/app/api/editor/projects/jobs/generate-ai-image/route.ts src/app/api/editor/projects/slides/update/route.ts
rg -n "role:\\s*'user-image'|data\\.role|activeSelection|selection:created" src
rg -n "slides/image/delete" src
```

