# HTML Template Type — Future Scope

This document tracks HTML editor capabilities that were discussed, explored, or reverse-engineered from Mirr, but are intentionally **not part of V1**.

The companion file `docs/HTML_TEMPLATE_TYPE_PLAN.md` is the canonical V1 build spec.

## Purpose

This file exists so we can:

- preserve good ideas without muddying the V1 implementation plan
- keep future HTML-editor capabilities visible to the team
- document where we intentionally diverged from the original Mirr-shaped direction
- give future iterations a starting point once V1 is stable

## 1. Future AI Refinement Workflows

These are intentionally deferred from V1.

### 1.0 Contract inheritance from the main plan

Any future refinement work must inherit the same core generation assumptions defined in `docs/HTML_TEMPLATE_TYPE_PLAN.md`:

- structured `PROJECT_TITLE` / `CAROUSEL_TEXTLINES` content formatting where full-project regeneration is involved
- deterministic backend prompt assembly with separate role/output/style/preset/content sections
- HTML validation before persistence and before render/export
- clean saved HTML as the source of truth, with editor-only attributes re-injected on load

Future refinement should extend the V1 pipeline, not create a second incompatible pipeline.

### 1.1 Functional AI Designer tab

In V1, the AI Designer tab is visible but disabled. Future work may add:

- freeform prompt submission
- quick-action prompt chips
- per-slide refinement
- all-slides refinement
- loading, retry, and success UX
- before/after comparison
- refinement history

### 1.2 Refine APIs

Future routes may include:

- `POST /api/editor/html-projects/refine-slide`
- `POST /api/editor/html-projects/refine-slides`

Likely future inputs:

- current HTML
- prompt
- aspect ratio
- rendered screenshot for context
- manual-edits summary generated from element diffs

Likely future request shapes should stay close to Mirr:

```typescript
type HtmlRefineSlideRequest = {
  projectId: string;
  pageIndex: number;
  html: string;
  prompt: string;
  aspectRatio: "1:1" | "4:5" | "3:4" | "16:9" | "9:16";
  imageUrl?: string;
  manualEdits?: string;
  htmlGenerationId?: string | null;
};

type HtmlRefineSlidesRequest = {
  projectId: string;
  pages: Array<{
    pageIndex: number;
    html: string;
  }>;
  refinementPrompt: string;
  aspectRatio: "1:1" | "4:5" | "3:4" | "16:9" | "9:16";
  pageImages?: Array<{ pageIndex: number; imageUrl: string }>;
  manualEdits?: string;
  useLightModel?: boolean;
  htmlGenerationId?: string | null;
};
```

Future SSE responses should stay compatible with the V1 `status` / `page` / `complete` streaming contract.

### 1.3 Manual-edits summary

Future refinement should include a human-readable summary of manual user edits so the AI can preserve intent when redesigning a slide.

Examples:

- moved headline 24px lower
- increased body font size
- changed accent block color
- replaced logo

Mirr's captured behavior suggests this should be a structured newline-delimited string built from the diff between original element properties and current element properties. A likely target format is:

```text
- "REALITY CHECK..." (div): moved to translate(47px, 20px)
- "3 mistakes..." (span): font-size changed from 42px to 48px
- Logo slot (image-slot): replaced image URL
```

This should be generated mechanically from the element model, not handwritten freeform in the UI.

### 1.4 Future refinement prompt assembly

When AI refinement is implemented later, it should reuse the same prompt-assembly discipline as generation:

- role instruction
- output contract
- dimension rules
- editability rules
- slot rules
- style rules
- current HTML block
- refinement prompt block
- optional screenshot context
- optional manual-edits summary

The future refinement prompt must not become a loosely structured “edit this however” call. Mirr's refine flow suggests a constrained multimodal request is part of why it works well.

## 2. Future Image And Asset Workflows

These are intentionally deferred from V1.

V1 already includes a **silent best-effort server-side prefill** for `background` and `main` image slots. Future work in this document adds user-facing control and richer sourcing on top of that baseline; it should not replace the underlying slot model.

### 2.0 Contract inheritance from the main plan

Future image and asset workflows must preserve the V1 slot contract:

- `.image-slot`
- `data-slot-id`
- `data-slot-type`
- `data-slot-label`
- optional `data-search-query`

Do not introduce a second slot format later.

### 2.1 Image search

V1 keeps slot metadata compatible with future search and may silently prefill some slots server-side, but does not implement user-facing lookup.

### 2.1a Contract continuity from V1 silent prefill

When the full image feature is added later, it should extend the V1 prefill pipeline rather than replacing it.

Engineering continuity rules:

- continue to use `.image-slot`, `data-slot-id`, `data-slot-type`, `data-slot-label`, and `data-search-query` as the canonical slot contract
- keep `background` and `main` slot behavior compatible with V1 prefill, while adding explicit user controls on top
- allow future search/replacement flows to override a V1 auto-prefilled image without changing the HTML schema
- prefer Mirr-shaped per-slot metadata such as `searchedImagesBySlot` when storing or returning slot-specific search candidates
- keep the final source of truth as clean HTML with inline image URLs already written into the slot
- keep future slot actions compatible with the V1 `ResolveSlotImageInput` identity fields (`projectId`, `pageIndex`, `slotId`, `slotType`, `slotLabel`, `searchQuery`, `currentImageUrl`, `aspectRatio`) so provider adapters can be reused instead of rewritten

If we expose server responses for slot-specific lookup later, the response should be easy to map to Mirr's proven model:

- top-level search results list for broad search UX
- optional per-slot candidate mapping when search is initiated from a known slot
- enough metadata to write the chosen asset directly back into the slot without inventing a second state model

Future work may include:

- `POST /api/editor/html-projects/search-images`
- search UI triggered from image slots
- paginated search results
- per-slot suggested queries from `data-search-query`
- source attribution UI
- explicit "replace image" and "search again" actions

Likely future request shape should stay close to Mirr:

```typescript
type HtmlSearchImagesRequest = {
  query: string;
  num: number;
  source: "google" | "pexels" | "pinterest";
  page?: number;
  nextCursor?: string | null;
};
```

Future response shape should continue to support:

- `images[]`
- `thumbnailUrl`
- `sourceUrl`
- `width`
- `height`
- `hasMore`
- `nextCursor`
- optional per-slot mapping if search is initiated from a known slot

### 2.2 Asset sourcing

Potential future sources:

- Google image search
- stock providers
- saved logos
- user-uploaded assets
- future AI-generated images

Future sourcing should be able to override any V1 auto-prefilled stock image cleanly without changing the slot schema or the clean-HTML persistence model.

### 2.3 Image replacement UX

Future versions may support:

- slot-specific image picker modals
- upload from device
- logo-library selection
- crop / focal-point tooling
- apply-logo-to-all-pages behavior
- replace/remove image actions from the element inspector
- preserving the current image while showing candidate replacements side-by-side

Future image replacement must still end by updating the same clean slide HTML model that V1 uses. Asset workflows should not bypass the HTML serializer or create a separate image state store.

## 3. Future Preset Workflows

V1 ships with seeded built-in presets only.

### 3.0 Contract inheritance from the main plan

Even when presets become richer later, the core preset responsibilities should remain the same:

- provide reference HTML templates
- provide a style guide
- anchor generation toward a stable visual identity

Future preset features should extend this model, not replace it.

Future work may include:

- server-side preset recommendation (`match-template`) before slide generation
- user-created presets
- preset editing
- saving the current slide set as a preset
- extracting style guides from user-authored slide sets
- richer preset previewing
- larger preset libraries

### 3.1 Future preset recommendation (`match-template`)

Mirr appears to run a preset-recommendation step before generation, taking the user's content and aspect ratio and returning ranked preset candidates with richer preset metadata.

If we add this later, the flow should likely be:

1. user provides raw structured content
2. server evaluates content against preset library
3. API returns ranked presets with enough metadata for a recommendation UI or auto-pick
4. generation still uses the same selected preset/reference-template contract as V1

This should be additive to the V1 manual preset gallery, not a replacement for the preset data model.

### 3.2 Future preset generation/refinement

Mirr appears to support richer preset creation and preset refinement flows. If we add those later, they should follow the same backend prompt-assembly approach as slide generation:

- role instruction
- preset output contract
- aspect-ratio/dimension rules
- design-system/style-guide extraction rules
- example/reference image block
- optional example content block

Any generated preset should still end as:

- `templates[]`
- `styleGuide`
- `aspectRatio`
- metadata for gallery display

## 4. Future Generation And Recovery Enhancements

### 4.1 Resumable generation

V1 uses retry-whole-generation when a stream drops.

Future improvements may include:

- resuming from a missing slide index
- partial-generation continuation
- smarter retry flows
- preserving already-completed slides across retries

Any future resumable-generation design should preserve the V1 `htmlGenerationId` lifecycle and SSE event compatibility rather than inventing a separate background-job contract unless that becomes necessary.

### 4.2 Variable slide counts

V1 is fixed at 6 slides.

Future work may include:

- variable slide counts
- preset-aware page counts
- generation prompts that respond to project length

### 4.3 Aspect-ratio regeneration

Future work may include:

- re-generating the same project for a different aspect ratio
- preset switching after generation
- cross-format export workflows

Aspect-ratio regeneration should still validate output against the same minimum contract as V1:

- exact root dimensions
- overflow hidden
- slot shape
- parseable text structure
- sanitized HTML

## 5. Future UI Capabilities

### 5.1 Expanded right-side inspector

Future improvements may include:

- grouped property panels
- richer element navigation
- multi-select or bulk-apply operations
- page-wide style controls

### 5.2 AI-assisted visual workflows

Potential future capabilities:

- restyle this slide
- restyle all slides
- make layout more minimal
- improve readability
- stronger brand alignment flows

### 5.3 Richer preview tools

Potential future capabilities:

- before/after toggle
- slide compare mode
- design-history timeline
- thumbnail regeneration after refinements

## 6. Mirr-Derived Placeholder Strategy

We may temporarily use Mirr-derived HTML as internal placeholder material to seed presets and validate the V1 generation/rendering pipeline.

Important constraints:

- this is for internal prototyping and scaffolding
- it should not become the permanent shipped preset library
- over time, replace placeholders with authored presets we own

## 7. Open Questions For Later Iterations

- When should AI Designer become functional?
- Do we want image search before or after user-upload workflows?
- Should saved logos arrive before broader image search?
- Should user-created presets be part of Phase 2 or later?
- How much Mirr parity do we actually want once V1 is stable?
- Do we want variable slide counts or fixed opinionated flows long term?
- Do we ever recover the literal Mirr generation prompt, or do we continue with a reconstructed prompt assembly?
- Should future refinement use a lighter model tier distinct from the main generation model?
