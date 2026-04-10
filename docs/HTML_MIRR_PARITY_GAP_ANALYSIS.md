# HTML Editor — Mirr Parity Gap Analysis & Updated Phase Plan

> Generated: 2026-04-09
>
> This document replaces the Phase 9–15 section of `docs/HTML_TEMPLATE_TYPE_IMPLEMENTATION_PLAN.md` with a revised execution plan based on a direct comparison of the shipped MVP against Mirr's actual API contracts and behavior as captured in `style.har`, `www.mirra.my.har`, and `Prompt.har`.
>
> The original Phases 1–8 remain valid as-is. This plan picks up where the MVP left off.

## Deferred Bug Note — Structural Wrapper Misclassified As Editable Block

This note is intentionally placed at the top of the document because the issue can look like a drag/resize bug, a duplicate-ID bug, or a parent-state persistence bug when it is reproduced in the editor. Current evidence points to a narrower root cause:

- A structural or layout-bearing `div` can be admitted by `src/features/html-editor/hooks/useHtmlElementParser.ts` as an editable `block-*` element.
- Once that happens, the iframe runtime behaves correctly on the wrong node: selection, resize handles, drag/resize events, and parent commits all operate on that structural wrapper as if it were a real design leaf.
- The downstream symptom is that a card wrapper or larger layout region can collapse into a small square or emit incorrect width/height geometry, even though the runtime and parent commit path are faithfully applying the parsed editable element model.

### Evidence collected

- Debug logs ruled out duplicate editable IDs: `editable-id-match-scan` repeatedly reported `count: 1` for the failing `block-0`.
- The bad geometry already existed in the iframe before parent reconciliation:
  - `block-begin-drag` showed a small visual box (for example `92px x 92px`)
  - `block-emit-transform` later reported much larger inline geometry on that same node (for example `804px x 526px`, `892px x 1429px`)
  - the parent then committed that payload without inventing new geometry
- The failing node's style signature strongly suggested a layout/content wrapper rather than a pure decorative leaf:
  - `overflow: hidden`
  - `flex-direction: column`
  - `gap: 28px`
  - `border-radius: 30px`
- Mirr's runtime does not appear to solve this at the resize layer either. In Mirr, once a node is admitted as editable, it is treated as resizable/movable. The practical protection therefore has to happen in parser/content classification, not after selection.

### Current best diagnosis

The parser's `div` block admission rules are still too permissive for some AI-generated HTML structures. In particular, a visually styled text/card wrapper can pass the current block filters when it has:

- `position: absolute` or a visible background/border
- explicit `width`/`height`
- no media descendants
- only text-like direct children

That means a wrapper can become `block-0` even when semantically it is acting as a layout container. The runtime and parent state model then behave correctly on the wrong element.

### Why this is deferred for now

We intentionally did **not** patch this immediately because the safest likely fix is parser-side rejection of layout-bearing wrappers, and that has meaningful regression risk:

- legitimate decorative cards/blocks could stop being editable
- existing saved projects could reload with fewer editable elements
- `block-*` IDs and element-list ordering could shift after reparse
- some styling controls could become unreachable if the rejected wrapper currently owns the visible background/border styles

Until there is time for a focused regression pass, this issue should be treated as a **known deferred parser-classification bug**, not as a drag-runtime bug.

### Recommended future fix path

When revisiting this issue, start in `src/features/html-editor/hooks/useHtmlElementParser.ts`, not in the iframe runtime. The next investigation/fix should:

1. Add targeted parser-side detection for layout-bearing wrappers before `ensureId(node, "block")`
2. Use multiple structural signals together rather than blunt single-style rules
3. Re-test legitimate decorative blocks, independent text, background locking, overlay-added elements, and saved-project reload behavior before shipping

If this bug appears again, use this note as the starting point: the most likely fault is **editable block classification**, not transform math, not duplicate IDs, and not slide-switch persistence.

## 1. Evidence Sources

| Source | What it reveals |
|--------|----------------|
| `style.har` entry 151 | Full preset catalog: 366 system presets, 5 aspect ratios, `styleGuide` shape, template HTML with `pageType`, `exampleImages` with localization |
| `style.har` entry 557 | `generate-content-stream`: streamed SSE generation with `presetId`, `content`, `mode`, `outputLanguage`, `enableImageSearch`, `slideCount` |
| `www.mirra.my.har` entry 165 | `match-template`: AI-recommended presets given content + aspect ratio |
| `www.mirra.my.har` entry 185 | `generate-content-stream`: streamed SSE with `resolving_preset` → `generating` → page events → complete |
| `www.mirra.my.har` entry 208/292/297 | `search-images`: Google image search with `query`, `num`, `source`, `page` |
| `www.mirra.my.har` entry 281/318 | `media/upload-url`: presigned R2 upload URL generation |
| `www.mirra.my.har` entry 296/323 | `media/confirm-upload`: confirms uploaded media |
| `www.mirra.my.har` entry 672/720 | `PATCH generations/:id`: save/update all pages with `generatedPages` + `aspectRatio` |
| `www.mirra.my.har` entry 700 | `refine-page`: single-page AI refinement with `html`, `prompt`, `aspectRatio`, `imageUrl`, `manualEdits` |
| `Prompt.har` entry 6 | `render-html`: server-side HTML→JPEG rendering, returns per-page image URLs |
| `Prompt.har` entry 10 | `refine-content-stream`: whole-carousel restyle via SSE, sends all pages + prompt |
| `Prompt.har` entry 15 | `PATCH generations/:id`: full save contract with `generatedPages[].{pageNumber, title, html}` + `aspectRatio` |

## 2. Mirr Feature Inventory vs Current State

### Core Generation & Persistence

| Mirr capability | Mirr API | Our state | Gap |
|----------------|----------|-----------|-----|
| Content generation (streamed SSE) | `POST generate-content-stream` | Working. Anthropic-based, SSE, deterministic fallback. | Functional parity. Minor: Mirr sends `enableImageSearch` and `slideCount: "auto"` — we hardcode 6 slides. |
| Preset selection | Client-side from catalog | Working. 5 code-defined presets, gallery UI. | Scale gap: Mirr has 366. Structure gap: we use `role` not `pageType`, richer `styleGuide` (8 vs 6 fields), 2 templates per preset vs Mirr's 1–10. |
| Save/update generations | `PATCH generations/:id` with `generatedPages[]` + `aspectRatio` | Working. `POST save-slides` with `slides[]`. | Contract shape differs but functionally equivalent. |
| Copy generation (HTML branch) | Part of `generate-content-stream` | Working. Separate `generate-copy` route with HTML branch. | Functional parity. |

### Editing & Interaction

| Mirr capability | Mirr behavior | Our state | Gap |
|----------------|--------------|-----------|-----|
| In-iframe selection with visual overlays | Click-to-select with hover/selection affordances inside iframe | Click-to-select via postMessage, no visual overlays in iframe | **Major gap** — switching to in-iframe editing is a priority |
| Inline text editing (contentEditable) | Edit text directly on the slide canvas | Not implemented — text edited via parent inspector textarea | **Major gap** |
| Drag to reposition | Move elements by dragging inside iframe | Not implemented | **Major gap** |
| Resize handles | Corner/edge handles for element resizing | Not implemented | **Major gap** |
| Rotate | Rotation handle on selected elements | Not implemented | Deferred — lower priority than drag/resize |
| Parent inspector (secondary) | Synchronized property panel, reflects iframe state | Working for limited properties (text, color, fontSize, fontWeight, bg, borderRadius) | Partial — needs fontFamily, position/size, and bidirectional sync with iframe |
| Element list / layer panel | Lists editable elements, click to select | Working via `HtmlElementList` | Functional parity for current scope |

### AI-Powered Editing

| Mirr capability | Mirr API | Our state | Gap |
|----------------|----------|-----------|-----|
| Per-page AI refinement | `POST refine-page` — sends `html`, `prompt`, `aspectRatio`, `imageUrl`, `manualEdits`; returns streamed SSE with regenerated page HTML | Stub only (`HtmlAiDesigner` placeholder) | **Not built** — primary target |
| Whole-carousel restyle | `POST refine-content-stream` — sends all pages + prompt; streams restyled pages via SSE | Not built | **Not built** — builds on refine-page infrastructure |
| AI preset recommendation | `POST match-template` — sends content + aspect ratio, returns ranked preset recommendations | Not built | Deferred |

### Image & Slot System

| Mirr capability | Mirr behavior | Our state | Gap |
|----------------|--------------|-----------|-----|
| `data-slot-*` attributes | `data-slot-id`, `data-slot-type` (background/main/logo), `data-slot-label`, `data-search-query` on all image slots | Generation prompt instructs model to emit these; preset template HTML includes them; parser reads `data-slot-label` and `data-slot-type` | **Partially implemented** — attributes exist in generated HTML but no UI leverages `data-search-query` yet |
| Image search | `POST search-images` — Google image search | Not built | Deferred |
| Media upload | `POST media/upload-url` + `POST media/confirm-upload` — presigned R2 upload | Existing image pipeline in app (separate from HTML editor) | Needs wiring to HTML editor image slot replacement |
| Silent image prefill | AI generates `data-search-query`, images auto-fetched and inserted | `ensureImageSlotPrefill` applies gradient fallback | Gap: no actual image fetching from search query |

### Editor Overlay & Add Element

| Mirr capability | Mirr behavior | Our state | Gap |
|----------------|--------------|-----------|-----|
| `data-editor-overlay-root` | Dedicated overlay div for user-added elements, sits above slide content at z-index 2147483000 | Not implemented | **Not built** |
| Add text element | User adds absolutely positioned text span to overlay | Not implemented | **Not built** — primary target |
| Add image slot | User adds image slot div with `data-slot-*` attributes to overlay | Not implemented | **Not built** — primary target |
| Add logo slot | User adds logo slot div to overlay | Not implemented | **Not built** — primary target |
| Added elements survive AI refinement | Overlay elements preserved during `refine-page` / `refine-content-stream` | N/A (neither feature exists) | Will need design consideration when both features land |

### Export & Rendering

| Mirr capability | Mirr API | Our state | Gap |
|----------------|----------|-----------|-----|
| Server-side HTML→JPEG | `POST render-html` — headless Chrome, returns per-page JPEG URLs stored in R2 | **Server-side Playwright rendering already exists** (`render/route.ts` uses `chromium.launch()` → `page.screenshot()` → ZIP). The client-side `useHtmlSlideExport` hook calls this route. This is NOT `html2canvas` — it's real headless Chromium. | Functional parity for rendering fidelity. Gap: Mirr returns individual per-page JPEG URLs; we return a ZIP blob. |
| Individual page image URLs | Each page gets a stored URL for social posting | ZIP of all pages | Deferred — only needed for social posting pipeline |

### Aspect Ratio & Presets at Scale

| Mirr capability | Mirr state | Our state | Gap |
|----------------|-----------|-----------|-----|
| 5 aspect ratios | `1:1`, `4:5`, `9:16`, `16:9`, `3:4` | `3:4` only (type literal) | Deferred — `HTML_SLIDE_DIMENSIONS` already has the mapping, but presets are locked to `3:4` |
| 366 system presets | DB-served, categorized, localized, with example images | 5 code-defined presets, no localization, empty `exampleImages` | Deferred — scale up later, keep code catalog for now |
| DB-served presets | `GET /api/v1/carousel-lab/presets` from DB | Code constant via `SYSTEM_HTML_PRESETS` | Deferred — schema exists (`html_design_presets`), no seed rows |

## 3. Decisions Locked In This Analysis

> Last updated: 2026-04-09 (post dry-run alignment)

### Product & Scope Decisions

| Decision | Status | Notes |
|----------|--------|-------|
| Switch to in-iframe editing | **Confirmed** | Replaces parent-only patching as the primary editing model. Parent inspector becomes secondary, synchronized via postMessage. |
| Keep bottom panel | **Confirmed** | Used for non-slide controls (workflow, settings, status). Deliberate UX distinction from slide editing area. |
| Keep horizontal slide strip | **Confirmed** | Intentional divergence from Mirr for webapp UX. |
| Adopt `data-slot-*` attributes immediately | **Confirmed** | Generation pipeline already emits them in prompts and fallback templates. Formalize in parser/serializer now. |
| Server-side rendering deferred | **Confirmed** | Medium-priority future item. Client-side export acceptable for now. The render route already uses Playwright server-side (`render/route.ts`), so the infrastructure exists — the deferral is about making it the canonical export path and adding per-page URL storage. Key reason to revisit: `html2canvas` has known fidelity issues with custom fonts, CSS `filter`, gradient overlays, and SVGs that Playwright handles correctly. |
| Code-defined presets acceptable for now | **Confirmed** | Will migrate to DB-served (`html_design_presets`) when scaling to Mirr-level catalog. |
| Build refine-page before refine-content-stream | **Confirmed** | refine-page is the core primitive; whole-carousel restyle orchestrates on top of it. |
| Add-element: add at center, edit via inspector | **Confirmed** | Drag-to-reposition is a follow-on after the add-element and in-iframe editing foundations are in place. The next step after Phase 11 is Phase 12 (drag/resize) to reach full Mirr-style direct manipulation. |
| `3:4` aspect ratio only for now | **Confirmed** | Multi-aspect-ratio support deferred but noted. |
| Manual preset selection for V1 | **Confirmed** | `match-template` (AI recommendation) deferred. |

### Architectural Decisions (from dry-run)

| Decision | Status | Rationale |
|----------|--------|-----------|
| Persistent iframe model (not srcDoc rebuild) | **Confirmed** | The current srcDoc-rebuild model reloads the entire iframe on every edit. This is incompatible with inline text editing (`contentEditable`) because each keystroke would trigger a full iframe reload, losing cursor position and focus. The persistent iframe model loads the iframe once per slide switch, then all subsequent edits — from the parent inspector OR from in-iframe interactions — are applied via `postMessage` → DOM mutation inside the iframe, without reloading srcDoc. This changes how `HtmlSlidePreview`, `useHtmlSlideRenderer`, and `HtmlEditorShell` work. srcDoc is still used for initial load and slide switches, but not for edit-cycle updates. |
| Persist `data-editor-overlay-root` in stored HTML | **Confirmed** | Matching Mirr's approach. The overlay div and its children (user-added text, image slots, logo slots) are persisted directly in the `html_project_slides.html` column. Reasons: (1) AI refinement (`refine-page`) needs to see user-added elements in context — Mirr's HAR shows the overlay div in the request body sent to the AI. (2) Added elements survive save/reload naturally without a separate storage layer. (3) Server-side rendering captures overlay elements in exported images because they're part of the HTML. The alternative (inject at render time, strip on save) would require extracting user elements, storing them separately, and re-injecting — significantly more complex for no benefit. |
| Undo/redo via throttled snapshots (not per-keystroke) | **Noted** | Full HTML strings should not be stored for every edit (memory explosion). The undo stack should use a snapshot-throttled approach — capture state at meaningful boundaries (after text edit commit, after drag end, after property change confirm) rather than on every keystroke. Detail to be finalized in Phase 16. |

### Foundation Guard Rails Now Locked

The following refactors were applied after the Phase 10 architecture correction and are now the required foundation for all future HTML editor work:

- **Runtime contract extracted from `htmlDocumentWrapper.ts`:**
  - `src/features/html-editor/runtime/iframeProtocol.ts` is the canonical home for iframe message names and TypeScript message shapes
  - `src/features/html-editor/runtime/buildIframeRuntime.ts` is the canonical home for the injected iframe runtime script
  - `src/features/html-editor/lib/htmlDocumentWrapper.ts` is now only the initial document builder (sanitization, font links, base styles, runtime injection)
  - A structural sync path is now part of the foundation: parent can send `sync-document` to the iframe runtime, which parses the next wrapped document and replaces the live `[data-scale-root]` contents without a full iframe reload
- **Normalized element model formalized:**
  - `src/features/html-editor/models/htmlElementModel.ts` is the canonical home for `HtmlEditableElement`, slot attributes, transform fields, rich-text flags, and shared patch types
  - New transform-aware fields are first-class on editable elements: `translateX`, `translateY`, `width`, `height`, `rotate`, `deleted`
  - Future phases must add editor capabilities against this model rather than inventing one-off ad hoc patch fields in components
- **Overlay-root mutation utilities established before Phase 11:**
  - `src/features/html-editor/hooks/useHtmlElementSerializer.ts` now owns `ensureOverlayRoot()`, `addElementToHtml()`, `duplicateElementInHtml()`, and `deleteElementInHtml()`
  - Phase 11 add-element flows must build on these helpers rather than re-implementing overlay-root insertion logic in components or iframe scripts

### Guard Rails For Future Phases

These rules are now mandatory for all remaining Mirr-parity work:

- Do not reintroduce edit-cycle `srcDoc` rebuilds
- Do not add new iframe message names outside `runtime/iframeProtocol.ts`
- Do not add new editable-element shape fields outside `models/htmlElementModel.ts`
- Do not create alternative overlay insertion paths outside the serializer/mutation layer
- Use the structural iframe sync path for DOM-shape changes (overlay-root creation, add element, duplicate, delete, future AI full-page replacement) instead of depending on a lucky `documentKey` reload boundary
- Treat Phases 11 + 12 as a continuous block on top of this foundation
- Prefer batched `update-elements` messaging when a future phase starts synchronizing more than one element at a time
- Preserve rich HTML when editing text; do not regress to text-flattening behavior
- Keep transform data explicit (`translateX`, `translateY`, `width`, `height`, `rotate`) instead of hiding it in opaque style-string-only logic

### AI Designer Target Behavior (documented for future phases)

The `HtmlAiDesigner` tab (currently a disabled stub in `HtmlInspectorPanel`) will eventually implement the Mirr `refine-page` contract:

```
Request: {
  html: string,           // current page HTML including overlay elements
  prompt: string,         // natural language instruction (e.g. "make the background darker")
  aspectRatio: string,    // e.g. "3:4"
  imageUrl?: string,      // rendered screenshot of current page state (requires server-side rendering — deferred)
  manualEdits?: string    // serialized description of user's manual changes since last generation
}
Response: SSE stream → status { phase } → page { pageIndex, totalPages, page { html } } → complete
```

The AI must preserve `data-editor-overlay-root` and its children during refinement. The `manualEdits` field tracks user changes (text edits, position transforms, property changes) so the AI respects manual work when applying new design changes. The `imageUrl` field is deferred until server-side rendering is the canonical render path.

## 4. Updated Phase Sequence

The original Phase 9–15 plan is replaced by the following revised sequence. The guiding principle is: **lock foundational architectural decisions first, then build interaction parity, then layer AI capabilities, then scale content and polish.**

---

### Phase 9. Slot Attribute Formalization

**Goal:** Make `data-slot-*` attributes a first-class contract across the entire HTML editor pipeline, not just a generation hint.

**Dry-run finding:** This phase is nearly complete already. The generation prompt (`buildGenerationPrompt` line 178) instructs the AI to emit `data-slot-id`, `data-slot-type`, `data-slot-label`, and `data-search-query`. All 5 preset template HTML strings include these attributes. The deterministic fallback (`buildDeterministicPage`) emits them. The parser (`useHtmlElementParser`) already reads `data-slot-label` (line 90), `data-slot-type` (line 94), and `data-search-query` (line 95). The serializer (`useHtmlElementSerializer`) already patches `data-search-query` (line 44-46) and preserves all `data-*` attributes through DOMParser-based patching.

**Remaining gaps:**

- Parser does not expose `data-slot-id` as a structured field on `HtmlEditableElement` — only `slotType`, `searchQuery`, and `label` are surfaced
- Inspector (`HtmlElementEditor`) does not display slot type, label, or search query as read-only metadata for image-slot elements
- No formal TypeScript type for the slot attribute schema

**Files expected to change:**

- `src/features/html-editor/hooks/useHtmlElementParser.ts` — add `slotId` field to the `image-slot` variant of `HtmlEditableElement`
- `src/features/html-editor/components/HtmlElementEditor.tsx` — add read-only display of slot type, label, search query for image-slot elements

**Includes:**

- Formalize the slot attribute schema: `data-slot-id`, `data-slot-type` (`background` | `main` | `logo`), `data-slot-label`, `data-search-query`
- Add `slotId` to the parser's `image-slot` element type
- Update `HtmlElementEditor` to display slot metadata as read-only info for image-slot elements
- Verify all 5 preset template HTML strings and the deterministic fallback consistently emit all four slot attributes (already confirmed in dry-run)
- **Contract cleanup (carried from original post-MVP backlog):**
  - Persist `html_preset_id` during slide generation: the generation route (`generate-slides/route.ts`) writes `html_style_guide` to the project but never writes `html_preset_id`. The preset choice only survives reload via fragile `JSON.stringify` comparison of the style guide object. Fix: write `html_preset_id` alongside `html_style_guide` in both the generation start update (line 398-405) and the completion update (line 476-483).
  - Bless the current save API contract (`POST save-slides` with `slides[]`) as canonical. The shipped contract is functional — document it as the official contract in this plan rather than leaving it as an open question.
  - Bless the current export API contract (`POST render` with `projectId`, returns ZIP blob via Playwright) as canonical. Per-page image URL storage is deferred to the social posting integration.

**Why this goes first:**

- Very low effort given the current state
- Formalizes what's already partially there
- Every subsequent feature (add-element, image replacement, AI refinement, slot-aware editing) depends on stable slot semantics
- The contract cleanup closes the remaining MVP correctness gaps before deeper parity work begins, preventing the preset-id bug from compounding as more features build on top of it

**Done when:**

- Parser exposes `slotId`, `slotType`, `label`, and `searchQuery` on image-slot elements
- Inspector shows slot metadata for image-slot elements
- All generated HTML paths consistently emit `data-slot-*` attributes (already true — verify only)
- `html_preset_id` is persisted durably during generation and survives reload
- Save and export API contracts are documented as canonical

---

### Phase 10. In-Iframe Editing Foundation

**Goal:** Replace parent-only patching with a live in-iframe interaction model as the primary editing surface.

**Architectural change:** This phase switches from the current srcDoc-rebuild model to a **persistent iframe model**. See Section 3 (Architectural Decisions) for the rationale.

**Files expected to change significantly:**

- `src/features/html-editor/lib/htmlDocumentWrapper.ts` — interaction script rewrite; `wrapHtmlDocument` becomes the initial-load builder only; new `buildIframeInteractionScript()` handles selection overlays, hover, contentEditable, drag stubs, and the full postMessage contract
- `src/features/html-editor/runtime/iframeProtocol.ts` — extracted iframe message contract; all future message additions flow through this file
- `src/features/html-editor/runtime/buildIframeRuntime.ts` — extracted iframe runtime script builder; now also owns structural document syncing for live DOM-shape changes without full iframe reload
- `src/features/html-editor/components/HtmlSlidePreview.tsx` — switches from srcDoc-on-every-render to a persistent iframe with `ref`-based messaging; srcDoc only used for initial load and slide switches
- `src/features/html-editor/hooks/useHtmlSlideRenderer.ts` — role narrows to preparing initial srcDoc; edit-cycle updates flow via postMessage, not srcDoc rebuild
- `src/features/html-editor/components/HtmlEditorShell.tsx` — `onPatchSelectedElement` becomes bidirectional: parent inspector patches send postMessage to iframe, iframe inline edits send postMessage to parent; the `parsedActiveSlide.normalizedHtml` sync effect needs rework to avoid fighting with iframe-driven updates
- `src/features/html-editor/hooks/useHtmlElementSerializer.ts` — continues to work for recording iframe changes into the stored HTML string, but is no longer the only path for updates
- `src/features/html-editor/hooks/useHtmlElementParser.ts` — still used to populate the inspector element list; may need a message-driven refresh instead of memoizing on the full HTML string
- `src/features/html-editor/models/htmlElementModel.ts` — extracted shared element model for slot metadata, transforms, and rich-text state

**Files expected NOT to change:**

- `src/features/html-editor/lib/presets.ts` — no preset changes
- `src/features/html-editor/lib/fontOptimizer.ts` — no font logic changes
- `src/app/api/editor/html-projects/*` — no API route changes
- `src/features/html-editor/components/HtmlBottomPanel.tsx` — no bottom panel changes
- `src/features/html-editor/components/HtmlPresetGallery.tsx` — no preset gallery changes

**Includes:**

- Rewrite the iframe interaction script (`htmlDocumentWrapper.ts` injection) to support:
  - Click-to-select with visual selection overlays (border, handles) rendered inside the iframe
  - Hover affordances (highlight on mouseover)
  - Inline text editing via `contentEditable` on double-click for text elements
  - PostMessage events for: `html-element-select`, `html-element-hover`, `html-element-edit` (text changed), `html-element-deselect`
- Define a stable iframe↔parent `postMessage` contract:
  - Iframe → Parent: `html-element-select`, `html-element-hover`, `html-element-deselect`, `html-element-text-commit` (text edit finished), `html-element-transform` (position/size changed — Phase 12 prep)
  - Parent → Iframe: `html-editor-select` (force-select element), `html-editor-update-property` (inspector change), `html-editor-deselect-all`
- Update `HtmlSlidePreview` to:
  - Use a persistent iframe via `ref` instead of rebuilding srcDoc on every render
  - Only set srcDoc for initial load and slide switches
  - Handle bidirectional postMessage for edit-cycle updates
  - Send parent→iframe messages when inspector properties change
- Update `HtmlEditorShell` to synchronize iframe state with inspector state:
  - Iframe text edits → parent state update → debounced save
  - Inspector property changes → parent→iframe postMessage → iframe DOM update + parent state update → debounced save
- Keep the parent inspector as a secondary editing surface — it reflects the iframe's selection and allows property editing, but inline text editing happens in the iframe
- Ensure save/autosave still works: all edit paths update parent HTML state, which triggers debounced save

**Why this is the highest-priority architectural change:**

- Every subsequent interaction feature (drag, resize, add-element) builds on this iframe interaction model
- Doing it later would mean retrofitting all those features
- This is the single biggest UX gap between the shipped MVP and Mirr
- The persistent iframe model is required because srcDoc rebuild on every edit is incompatible with contentEditable (loses cursor, focus, and selection state)

**Done when:**

- User can click elements inside the iframe and see visual selection feedback
- User can double-click text elements to edit inline
- Inspector reflects the selected element's current properties
- Inspector property changes update the iframe in real-time (no full reload)
- Inline text edits persist to HTML state and trigger autosave
- No flash or full-iframe-reload when editing
- Switching slides loads new srcDoc correctly and clears stale selection

**Note for next phase:** After this phase, drag-to-reposition and resize handles are the natural follow-on. They are scoped to Phase 12 to keep this phase focused on the core interaction contract. The postMessage contract defined here already includes `html-element-transform` as a reserved event type for Phase 12.

---

### Phase 11. Add Element Flows

**Goal:** Allow users to add new text, image slots, and logo slots to slides via an editor overlay system.

**Architectural note:** The `data-editor-overlay-root` div is persisted directly in the stored HTML (in `html_project_slides.html`), matching Mirr's approach. See Section 3 (Architectural Decisions) for the rationale. The overlay div and all user-added elements inside it are part of the HTML that is saved, rendered, exported, and sent to the AI for refinement.

**Files expected to change:**

- New file: `src/features/html-editor/components/HtmlAddElementBar.tsx` — toolbar with Add Text / Add Image / Add Logo actions
- `src/features/html-editor/hooks/useHtmlElementSerializer.ts` — use the pre-built `ensureOverlayRoot()`, `addElementToHtml()`, `duplicateElementInHtml()`, and `deleteElementInHtml()` helpers as the mutation layer for overlay elements
- `src/features/html-editor/hooks/useHtmlElementParser.ts` — must parse elements inside the overlay root the same as other elements (already does this since it scans all `*` elements in the body)
- `src/features/html-editor/components/HtmlEditorShell.tsx` — wire add-element actions into state; use the structural iframe sync path so newly inserted overlay DOM appears in the live iframe without needing a `documentKey` bump
- `src/features/html-editor/components/HtmlEditorWorkspace.tsx` or `src/features/html-editor/components/HtmlInspectorPanel.tsx` — mount the add-element bar
- `src/features/html-editor/lib/htmlDocumentWrapper.ts` — the interaction script must handle newly added overlay elements the same as pre-existing ones (selection, hover, contentEditable)
- `src/features/html-editor/models/htmlElementModel.ts` — add-element defaults and overlay children must conform to the shared normalized element model, including transform fields and slot metadata

**Important:** Neither the AI generation pipeline nor the deterministic fallback currently emits the `data-editor-overlay-root` div. This is correct — the overlay root only appears when the user adds their first element. The `addElementToHtml()` function will create the overlay root if it doesn't already exist in the HTML.

**Includes:**

- Implement `data-editor-overlay-root` div pattern (matching Mirr's approach):
  - Absolutely positioned overlay div at `z-index: 2147483000` inside the slide HTML
  - User-added elements are children of this overlay
  - Overlay persists in the saved HTML — no inject/strip cycle
  - Overlay and its children are visible to the AI during `refine-page` (Phase 13)
  - Overlay and its children are captured by export rendering
- Build `HtmlAddElementBar` UI (toolbar or menu) with three actions:
  - **Add Text**: inserts a `<span>` with default styling, positioned at center of slide, with `pointer-events: auto`
  - **Add Image Slot**: inserts a `<div class="image-slot">` with `data-slot-id`, `data-slot-type="main"`, `data-slot-label`, `data-search-query`, positioned at center, with placeholder background
  - **Add Logo Slot**: inserts a `<div class="image-slot" data-slot-type="logo">` with appropriate defaults
- Each added element gets a unique `data-editable-id` and is selectable/editable via the in-iframe interaction model from Phase 10
- Added elements are editable via the parent inspector (text content, colors, size for text; background-image, border-radius for slots)
- Ensure added elements serialize correctly and survive save/reload cycles

**Why this follows in-iframe editing:**

- Add-element UX depends on the iframe interaction model — the user needs to see and interact with the new element immediately after adding it
- With the persistent iframe model (Phase 10), a parent→iframe postMessage can inject the new element into the live DOM without a full reload

**V1 scope limitation:** Added elements are placed at the center of the slide. Drag-to-reposition is Phase 12. This is acceptable because the user can edit position values via the inspector if needed.

**Future follow-on (document for later):** Make added elements draggable, resizable, and rotatable to reach full Mirr parity for the overlay system. This is the immediate next step after Phase 11 and is explicitly scoped as Phase 12.

**Done when:**

- User can add text, image slot, and logo slot elements to any slide
- Added elements appear in the iframe with visual feedback
- Added elements are selectable and editable
- Added elements persist through save and reload
- `data-editor-overlay-root` pattern is used consistently
- The overlay root is only created when the first element is added (not pre-injected into every slide)
- Newly added/duplicated/deleted overlay DOM appears live in the active iframe via structural sync, without depending on a full iframe reload

---

### Phase 12. Drag, Resize, and Transform Parity

> **Operational note:** Phases 11 and 12 are separate checkpoints but should be treated as a single continuous implementation block. Do not insert unrelated work between them. From the user's perspective, "add element at center, then edit position numbers in the inspector" is not yet Mirr parity — drag-to-reposition immediately after add-element is what completes the direct-manipulation story.

**Goal:** Make in-iframe element interaction feel like a design tool, not a property editor.

**Includes:**

- Drag-to-reposition: mousedown/mousemove on selected elements updates `transform: translate()` or `top`/`left` in real-time inside the iframe
- Resize handles: corner handles on selected elements, drag to change width/height
- Transform reporting: iframe sends position/size changes to parent via postMessage so inspector stays synchronized
- Use the normalized transform fields from `models/htmlElementModel.ts` as the source of truth: `translateX`, `translateY`, `width`, `height`, `rotate`
- Position/size fields in parent inspector: display and allow editing of `top`, `left`, `width`, `height`, `transform` for the selected element
- Selection lifecycle cleanup: switching slides or projects must clear stale iframe selection state
- Stable slide ownership on iframe commits: transform/text messages must carry slide identity so active-slide handoff cannot drop edits
- Semantic background locking: background image slots remain inspector-editable but are not draggable/listable foreground objects
- Mirr-style block/text parsing: eligible styled blocks remain in the element model even when they contain editable text, instead of being discarded as structural wrappers

**Why this is separate from Phase 10:**

- Phase 10 establishes the communication contract and basic selection/editing
- This phase adds the direct-manipulation interactions that make the editor feel Mirr-like
- Separating them reduces risk — if Phase 10 has issues, they're caught before adding more complexity

**Rotate** is included here if achievable; otherwise deferred to polish.

**Done when:**

- User can drag elements to reposition them on the slide
- User can resize elements via corner handles
- Inspector shows and allows editing of position/size values
- Switching slides clears selection state cleanly
- Background layers are not directly draggable on the canvas
- Styled rectangle/block elements that contain text remain separately selectable/editable, matching Mirr's parser ownership model

---

### Phase 13. AI Designer — Per-Page Refinement

**Goal:** Enable prompt-driven single-page editing, matching Mirr's `refine-page` capability.

**Includes:**

- Build `POST /api/editor/html-projects/refine-page` endpoint:
  - Accepts: `html` (current page HTML), `prompt` (natural language instruction), `aspectRatio`
  - Optional: `manualEdits` (string describing user's manual changes — e.g., "moved element to translate(47px, 20px)")
  - Returns: streamed SSE with `status` → `page` → `complete` events (same pattern as `generate-slides`)
- Activate the `HtmlAiDesigner` tab in the inspector panel (currently disabled stub)
- Build the AI Designer UI:
  - Prompt input field
  - "Refine this page" action button
  - SSE progress display
  - Immediate apply of the refined result (Mirr-aligned); undo/history handles recovery later
- Wire `manualEdits` tracking: accumulate user edits (text changes, position changes, property changes) since last generation/refinement and serialize them as a string for the AI context
- Ensure the `data-editor-overlay-root` and user-added elements are preserved through AI refinement (AI should not strip the overlay)
- Sanitize AI output through the same safety pipeline as `generate-slides`, but skip slot-prefill during refinement

**Mirr contract reference (`refine-page` from `www.mirra.my.har` entry 700):**
```
Request: { html, prompt, aspectRatio, imageUrl?, manualEdits? }
Response: SSE stream → status → page → complete
```

**Implementation decisions now locked for first pass:**

- `imageUrl` screenshot context is deferred from the first refinement implementation
- single-page refinement does **not** update project-level `html_generation_status`
- if the AI output drops the overlay root, the server should automatically re-inject the previous overlay subtree before validation/apply
- if the refined HTML still fails validation after overlay reinjection, reject it and keep the current page untouched

**Why this comes after the editing foundation:**

- The AI designer needs a stable editing model to track manual edits
- The prompt needs to reference what the user physically changed
- The refinement result needs to render correctly in the in-iframe editing environment

**Done when:**

- User can type a prompt like "make the background darker" and get a refined page
- Manual edits are tracked and sent as context to the AI
- Overlay elements survive refinement
- Refinement result renders correctly in the iframe

---

### Phase 14. Whole-Carousel Restyle

**Goal:** Enable restyling all pages at once via a single prompt, matching Mirr's `refine-content-stream`.

**Includes:**

- Build `POST /api/editor/html-projects/refine-content-stream` endpoint:
  - Accepts: all page HTML + prompt + aspect ratio
  - Returns: streamed SSE with per-page results (same event pattern)
  - Internally: orchestrates sequential per-page refinement calls for the first pass, reusing the Phase 13 primitive
- UI for triggering whole-carousel restyle (prompt input + "Restyle All" action)
- SSE progress display showing per-page generation status
- Immediate apply of each refined page as it streams back; failed pages remain unchanged
- Per-page `manualEdits` summaries are sent alongside each page's HTML
- Page-level SSE errors include `pageIndex` so the client can map failures to slide badges

**Mirr contract reference (`refine-content-stream` from `Prompt.har` entry 10):**
```
Request: { pages: [{ pageNumber, html }], prompt, aspectRatio }
Response: SSE stream → status → page (per page) → complete
```

**Why this follows refine-page:**

- This is an orchestration layer on top of the per-page primitive
- The streaming infrastructure, sanitization, and rendering from Phase 13 are reused
- Building this without refine-page would mean building the infrastructure twice

**Done when:**

- User can restyle an entire carousel with a single prompt
- Each page streams in as it's generated
- Each page applies immediately as it streams back; failed pages remain unchanged

---

### Phase 15. Inspector & Control Surface Parity

**Goal:** Replace the current list/editor split inspector with a Mirr-aligned unified accordion surface, widen the element model for missing style fields, preserve rich-text safely, and add the text-control parity needed for Mirr-style precision editing.

**Locked decisions (confirmed before implementation):**

1. **Rich-text handling** — Rich text remains editable inline in the iframe. The inspector shows a preview block, helper copy, and `Clear formatting`. That action strips inline rich markup back to plain text but does not reset element-level typography controls. Serializer/runtime still prefer `patch.html` over `patch.text` so structured rich text is never flattened accidentally.

2. **Font loading strategy** — On `fontFamily` patch, the parent sends the existing `updateFontCss` iframe message to inject the Google Fonts CSS. Does not rely on structural sync. Uses the existing `fontOptimizer.ts` font map via a new `getFontCssUrl` export. A new `sendFontCss` method is added to `HtmlSlidePreviewHandle`.

3. **Original style fields scope** — Phase 15 now tracks the broader Mirr-style text originals needed for changed-state and reset behavior: `originalFontFamily`, `originalFontSize`, `originalColor`, `originalBackgroundColor`, `originalFontStyle`, `originalTextDecoration`, `originalLetterSpacing`, `originalLineHeight`, `originalTextAlign`, `originalMarginTop`, `originalMarginRight`, `originalMarginBottom`, `originalMarginLeft`. `originalBackgroundColor` remains tracked on the non-text element types that expose background color.

4. **Accordion inspector architecture** — `HtmlElementList` + `HtmlElementEditor` are replaced by a single `HtmlInspectorAccordion` component under `HtmlInspectorPanel`. Only the selected card is expanded. Selecting a new element updates selection and expands that card. Add-element controls live at the bottom of the accordion stack. An AI hint row ("For finer adjustments, try asking AI") appears only inside the expanded card's edit view, not globally. Text cards receive two additional actions from the shell: `onClearRichText` and `onApplyFontToAllPages`.

5. **`backgroundSize` and `backgroundPosition`** — Added to both `HtmlImageSlotElement` and `HtmlImageElement` (not just slots), because the parser creates `type: "image"` elements from both `img[src]` and CSS `background-image` nodes. Added across the full chain: model, parser, page-state, serializer, runtime.

6. **Text style widening** — `fontStyle`, `textDecoration`, `letterSpacing`, `lineHeight`, `textAlign`, `textTransform`, `marginTop`, `marginRight`, `marginBottom`, and `marginLeft` are added to `HtmlTextElement` across the full chain (model -> parser -> page-state -> serializer -> runtime -> manual-edits).

**Includes:**

- Fix rich-text flattening in both serializer and runtime (locked rule above)
- Unified accordion-style inspector replacing `HtmlElementList` + `HtmlElementEditor` + `HtmlAddElementBar`
- Duplicate and delete element wiring through `HtmlEditorShell` using existing serializer helpers
- Font family editing with live `updateFontCss` iframe loading
- Compact Mirr-style text controls: rich-text preview + clear-formatting, font-family, font-size (stepper), font-weight (chips), italic, underline, case controls, alignment controls, color, background-color, letter-spacing, line-height
- More options section for text: hex color input, full swatch grid, margin controls, apply-font-to-all-pages
- Block controls: background-color, border-radius, opacity, border
- Image/image-slot controls: background-size (fill/cover), background-position, image URL replacement, border-radius
- Original style fields for changed-state detection and per-control reset on the widened text surface
- AI hint row in expanded element card
- Add-element section at bottom of accordion stack

**Explicitly deferred from Phase 15:**

- Saved logos browser / logo search gallery / Use as Video — belongs to Phase 17 media work
- Padding, display, flex properties, and shadow presets — still deferred; these are separate parity slices beyond the current text-control pass

**Why this follows the interaction and AI phases:**

- Richer controls matter more once the canvas supports direct manipulation
- The inspector becomes the precision tool for fine-tuning what the user sketched via drag/resize/AI

**Done when:**

- Inspector is a unified accordion with per-element inline controls
- Font family can be changed for text elements with live iframe font loading
- `Apply font to all pages` updates every text element across the carousel
- Duplicate and delete work from the inspector
- `backgroundSize` and `backgroundPosition` are editable for image slots and image elements
- Text style fields (fontStyle, textDecoration, letterSpacing, lineHeight, textAlign, textTransform, margins) are editable
- Rich-text elements are previewed safely, can be cleared back to plain text, and are not flattened by inspector edits
- Original style fields enable changed-state detection for the widened text controls

---

### Phase 16. Workflow Hardening

**Goal:** Make the editor resilient under real editing sessions.

**Architectural note on undo/redo:** The undo stack must not store full HTML strings for every keystroke — that would cause memory explosion for text-heavy editing sessions. Use a snapshot-throttled approach: capture state at meaningful boundaries (after text edit commit/blur, after drag end, after property change confirm, after AI refinement apply) rather than on every input event. Each snapshot is the full `htmlSlides[]` array for the current project. Keep a reasonable depth limit (e.g., 50 snapshots).

**Locked implementation details:**

1. **Snapshot shape** — Phase 16 stores full-project snapshots, not element-level inverse patches. Each snapshot carries `htmlSlides`, baseline HTML slides for manual-edits comparison, active slide index, and selected element. The restore path rehydrates `pageStates`, baseline state, `loadState.htmlSlides`, active selection, and the active iframe structure together.

2. **Save pipeline** — autosave, manual save (`Cmd+S`), guarded navigation save, and export all flow through one revision-aware save function. A save completion only clears dirty state if it matches the latest local revision, so stale save completions cannot incorrectly mark newer edits as saved.

3. **Undo grouping** — normal edits checkpoint at meaningful boundaries, while inspector patches are grouped briefly to avoid one undo step per keystroke. Whole-carousel AI restyle is intentionally one undo checkpoint, not one per streamed page.

4. **Shortcut routing** — shell shortcuts handle parent-focused UI, while iframe-focused shortcuts are forwarded to the shell via `postMessage` requests. This preserves keyboard behavior even when focus is inside the active slide runtime.

5. **Recovery model** — local session drafts are stored per account + project in localStorage and are restored only after an explicit prompt. They are never auto-applied silently over the server state.

**Includes:**

- Undo/redo (HTML state history with throttled snapshots)
- Unsaved-changes guard for project switching and page unload
- Keyboard shortcuts (Cmd+Z undo, Cmd+Shift+Z redo, Cmd+S save, Delete/Backspace to remove selected element, Escape to deselect)
- Autosave coordination with export through the shared save pipeline
- Better error recovery for partial generation failures
- Session persistence: if the user refreshes, offer to restore the last local editing draft

**Done when:**

- Undo/redo works for all edit operations
- Navigation away from unsaved changes shows a confirmation
- Core keyboard shortcuts work
- Export waits for the same blocking save path used by manual save / autosave
- Refresh can restore a local draft after explicit user confirmation
- The editor can withstand longer sessions without losing work

---

### Phase 17. Media & Asset Parity

**Goal:** Close the gap for image workflows.

**Includes:**

- Wire existing image upload pipeline to HTML editor image slot replacement
- Image slot "Replace Image" flow: click slot → upload or paste URL → image updates in slot
- Logo slot targeting: replace logo across all slides at once (optional V1)
- Decide whether to integrate image search (Mirr uses Google Images) or defer to a later product decision

**Done when:**

- Users can replace images in slots via upload
- Image replacement persists through save/reload
- Logo replacement works

---

## 5. Deferred Items Registry

These items are explicitly deferred with documented intent to revisit.

| Item | Priority | Why deferred | Trigger to revisit |
|------|----------|-------------|-------------------|
| Per-page image URL storage (not ZIP) | Medium | Export already uses server-side Playwright rendering (`render/route.ts`), so rendering fidelity is not a gap. The gap is that Mirr returns individual per-page JPEG URLs stored in R2 (useful for social posting), while we return a ZIP blob. | When building the social posting integration or needing page-level image URLs for previews/thumbnails. |
| AI preset recommendation (`match-template`) | Low | Manual preset selection is sufficient. AI recommendation is a UX optimization. | When preset catalog grows large enough that browsing is painful (50+ presets). |
| Image search integration (`search-images`) | Medium | Requires API integration (Google Images or equivalent). Useful for filling `data-search-query` slots. | When the image slot UI is mature and users want in-editor image discovery. |
| 366-scale preset catalog | Medium | 5 presets are enough to prove the system. Scaling requires content creation effort. | After the editor is stable enough that preset variety is the bottleneck. |
| DB-served presets | Low | Code catalog is fast and simple. DB serving needed for account-level custom presets and admin management. | When adding custom preset creation or admin preset management. |
| Multi-aspect-ratio support | Medium | `3:4` is the shipped standard. `HTML_SLIDE_DIMENSIONS` already maps all 5 ratios. | When users need `4:5` (Instagram standard) or `1:1` (LinkedIn). Preset `aspectRatio` type needs widening from `"3:4"` literal. |
| Rotate element | Low | Drag and resize cover 90%+ of direct manipulation needs. | After Phase 12 ships and users request rotation. |
| Localized preset names/descriptions | Low | English-only is fine for current user base. | When expanding to non-English markets. |
| Preset example images | Low | All presets have `exampleImages: []`. Mirr shows rendered example pages in the gallery. | When the preset gallery UX needs to look more polished. Depends on server-side rendering for generating examples. |
| `refine-page` with screenshot (`imageUrl`) | Low | Mirr sends a rendered screenshot of the current page state alongside the HTML. This helps the AI "see" the design. | When AI refinement quality needs improvement. Depends on server-side rendering. |
| Individual page image URLs for social posting | Low | ZIP export is sufficient. Individual URLs needed for direct-to-Instagram pipeline. | When building the social posting integration. |

## 6. Preset Structure Reconciliation

The current preset structure diverges from Mirr in several ways. These do not block immediate work but should be tracked for eventual alignment.

| Field | Mirr | Ours | Action |
|-------|------|------|--------|
| `templates[].pageType` | `"cover"` / `"content"` / `"cta"` | `templates[].role` (same values) | Rename `role` → `pageType` when migrating to DB-served presets, or keep `role` and map at the API boundary |
| `templates[].id` / `templates[].name` | Not present on Mirr templates | Present on ours | Keep — these are useful for our template reference in generation prompts |
| `styleGuide` fields | 6: `fontFamily`, `accentColor`, `primaryColor`, `designPatterns`, `secondaryColor`, `backgroundColor` | 8: adds `headingFontFamily`, `bodyFontFamily` | Keep our richer schema — it provides better control. If we consume Mirr presets directly in the future, map their single `fontFamily` to both `headingFontFamily` and `bodyFontFamily` |
| `aspectRatio` type | `"1:1"` / `"4:5"` / `"9:16"` / `"16:9"` / `"3:4"` | `"3:4"` literal only | Widen when adding multi-aspect-ratio support |
| `exampleImages` | Per-locale arrays of rendered page URLs | Empty array | Populate when server-side rendering is available |
| `templates` count | 1–10 per preset | 2 per preset | Increase when scaling preset catalog |
| `localizedName` / `localizedDescription` | Present with `en` / `ko` keys | Not present | Add when localizing |

## 7. Recommended Execution Order

If implementation resumes now, execute in this order:

1. **Phase 9** — Slot Attribute Formalization + Contract Cleanup (low effort, foundational, closes MVP correctness gaps)
2. **Phase 10** — In-Iframe Editing Foundation (high effort, highest-priority architectural change)
3. **Phase 11 + 12** — Add Element Flows → Drag, Resize, Transform Parity (continuous block, no unrelated work between them)
4. **Phase 13** — AI Designer — Per-Page Refinement (medium effort, builds on editing infrastructure)
5. **Phase 14** — Whole-Carousel Restyle (lower effort, orchestration on top of Phase 13)
6. **Phase 15** — Inspector & Control Surface Parity (medium effort, precision tool)
7. **Phase 16** — Workflow Hardening (medium effort, resilience)
8. **Phase 17** — Media & Asset Parity (medium effort, image workflows)

Phases 11 and 12 are separate checkpoints for testing but are implemented as a continuous block. The user-facing story is: "add an element and immediately drag it into position." Shipping add-element without drag-to-reposition would feel incomplete.

After Phase 17, the editor will have substantial Mirr parity for the core editing experience. The remaining deferred items (AI preset recommendation, image search, preset scale, multi-aspect-ratio, per-page image URL storage) are optimization and scale concerns rather than core capability gaps.

## 8. Minimum Regression Suite (Updated)

After every phase, re-run these checks:

### Regular / Enhanced (unchanged)

- Create project → generate copy → edit text → save → export

### HTML

Cumulative by phase:

| After Phase | What to test |
|-------------|-------------|
| 9 | Slot attributes present in generated HTML; parser surfaces slot metadata; serializer preserves slots through edits |
| 10 | Click-to-select in iframe with visual feedback; inline text editing; inspector synchronization; autosave works |
| 11 | Add text/image/logo elements; elements appear in iframe; elements persist through save/reload |
| 12 | Drag to reposition; resize via handles; inspector shows position/size; slide switch preserves committed edits; background is not draggable; styled blocks with nested text remain selectable |
| 13 | AI refine single page; manual edits tracked; overlay preserved; result renders correctly |
| 14 | Whole-carousel restyle; per-page streaming; immediate apply; partial success badges |
| 15 | Accordion inspector; font editing with live loading; duplicate/delete; backgroundSize/Position controls; letterSpacing/lineHeight/textAlign/textTransform; rich-text not flattened; original style fields for changed-state |
| 16 | Undo/redo; unsaved-changes guard; keyboard shortcuts; session persistence |
| 17 | Image upload to slot; image replacement persists; logo replacement |
