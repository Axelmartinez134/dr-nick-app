# HTML Template Type — Implementation Plan

> This document is the execution companion to `docs/HTML_TEMPLATE_TYPE_PLAN.md`.
>
> The main plan remains the source of truth for product behavior, architecture, API contracts, database rules, UI rules, and V1 scope decisions.
>
> This implementation plan defines the safest rollout order for building the HTML project type without destabilizing existing `regular` and `enhanced` flows.
>
> Visibility note: the currently deferred "structural wrapper misclassified as editable block" bug is documented at the top of `docs/HTML_MIRR_PARITY_GAP_ANALYSIS.md` and should be reviewed before any future parser-side block eligibility changes.

## 1. Purpose

This rollout exists to reduce implementation risk for the new `html` project type.

The key safety principle is:

- shared code should first become **safe to recognize `html`**
- then safe to **route `html` away from Fabric**
- then safe to **create `html` projects**
- then safe to **generate and preview html slides**
- then safe to **edit, save, and export html slides**

We do **not** implement everything in one pass.

We implement in milestones and phases with explicit checkpoints between them.

At the end of every phase:

1. run the phase-specific verification checklist
2. manually test the affected user flows
3. ask a second AI to review the exact changes from that phase before continuing

## 2. Global Safety Rules

These rules apply to every phase.

- Do not refactor `regular` / `enhanced` behavior unless the phase explicitly requires a shared additive change.
- Do not widen Fabric-specific hooks to support html. Route html away from Fabric instead.
- Do not silently coerce `html` to `regular` or `enhanced` anywhere.
- Prefer additive branches over invasive rewrites in shared files.
- Keep html-only logic in new files wherever possible.
- If a shared route must change, the `regular` and `enhanced` branches should remain behaviorally identical.
- Do not advance to the next phase until the current phase passes manual testing and external review.
- If a phase reveals unexpected drift from `docs/HTML_TEMPLATE_TYPE_PLAN.md`, stop and reconcile the plan before continuing.

## 3. Milestones

The rollout is grouped into three larger milestones.

### Milestone A: Safety Plumbing

Goal:

- make the codebase safe to know about `html`
- make runtime ownership explicit
- add database and load plumbing without exposing the full feature yet

Includes:

- Phase 1. Shared Type Safety Only
- Phase 2. Runtime Isolation Gate
- Phase 3. Additive DB + Load Contracts

### Milestone B: Create and Generate

Goal:

- allow users to create html projects from shared entry flows
- mount the html runtime shell
- generate html copy and html slides safely

Includes:

- Phase 4. Shared Entry Flows, Creation Only
- Phase 5. HTML Shell Skeleton Only
- Phase 6. HTML Copy Branch
- Phase 7. Presets + HTML Generation + Read-Only Preview

### Milestone C: Edit and Export

Goal:

- finish the actual html editor
- support editing, persistence, and export

Includes:

- Phase 8. Editing + Save + Export

## 4. Phase-by-Phase Rollout

---

## Phase 1. Shared Type Safety Only

### Goal

Make the codebase able to recognize `html` in shared types and passive UI surfaces without allowing users to create or run html flows yet.

### Primary Outcomes

- shared `TemplateTypeId` types accept `html`
- shared list/display code tolerates `html`
- no route or component silently collapses `html` back to `regular` / `enhanced` at the type layer

### Files Expected To Change

- `src/features/editor/store/types.ts`
- `src/app/api/editor/_utils.ts`
- `src/features/editor/services/projectsApi.ts`
- `src/features/editor/hooks/useEditorStoreActionsSync.ts`
- `src/features/editor/hooks/useEditorJobs.ts` for type-level widening only
- `src/features/editor/components/SavedProjectsCard.tsx`
- any other purely type-level or display-level references to `TemplateTypeId`

### Files Explicitly Not To Touch In This Phase

- `src/app/editor/EditorShell.tsx`
- `src/features/editor/hooks/useGenerateCopy.ts`
- `src/app/api/editor/projects/jobs/generate-copy/route.ts`
- all html-only files under `src/features/html-editor/`
- any create-project routes

### Implementation Notes

- This phase is intentionally non-functional.
- Users should still be unable to create or use html projects.
- The purpose is to shrink future diff size and eliminate unsafe compile-time assumptions.
- For files like `useEditorJobs.ts`, this phase should only widen local type assumptions so the codebase remains type-safe. Actual html job behavior belongs to a later phase.

### What To Test After Phase 1

- Open the editor and confirm it still loads normally.
- Open an existing `regular` project and confirm it loads exactly as before.
- Open an existing `enhanced` project and confirm it loads exactly as before.
- Confirm saved project listing and sidebar project UI still render correctly.
- Confirm there are no new type errors or obvious runtime errors in shared editor surfaces.

### External AI Review Prompt After Phase 1

Use this prompt with another AI reviewer:

```text
Review the code changes for Phase 1 of the HTML template type rollout.

Context:
- This phase was only supposed to make shared types and passive UI surfaces safe to recognize `html`.
- It must NOT introduce real html runtime behavior yet.
- It must NOT change the behavior of existing `regular` and `enhanced` flows.

Please review for:
1. Any place where `html` was added in a way that could accidentally activate incomplete behavior.
2. Any remaining shared type coercions or narrow unions that still silently collapse `html`.
3. Any regressions to existing `regular` / `enhanced` project list, display, or store typing behavior.
4. Any unnecessary refactors or risky changes outside the intended scope.

Focus your review on:
- shared type definitions
- store action/job typing
- display-only project UI
- API client typing

Do not suggest new architecture. Only flag correctness, regression risk, and scope violations.
```

---

## Phase 2. Runtime Isolation Gate

### Goal

Make runtime ownership explicit so html can never accidentally mount the Fabric runtime.

### Primary Outcomes

- `EditorRuntimeRouter.tsx` exists
- `page.tsx` mounts the router instead of directly mounting `EditorShell`
- router waits for bootstrap/load to resolve the actual `templateTypeId`
- router shows a neutral loading state until project type is known
- `EditorShell.tsx` remains the legacy Fabric runtime for `regular` / `enhanced`

### Files Expected To Change

- `src/app/editor/page.tsx`
- `src/app/editor/EditorRuntimeRouter.tsx`
- `src/app/editor/EditorShell.tsx` for breadcrumb comment only

### Files Explicitly Not To Touch In This Phase

- Fabric hooks such as:
  - `src/features/editor/hooks/useFabricCanvasBinding.ts`
  - `src/features/editor/hooks/useLiveLayoutQueue.ts`
  - `src/features/editor/hooks/useCanvasExport.ts`
  - `src/features/editor/hooks/useImageOps.ts`
- html generation routes
- create-project routes

### Implementation Notes

- `HtmlEditorShell.tsx` can still be a stub in this phase.
- The router should preserve current behavior for all existing projects.
- Preventing the flash-of-wrong-shell is mandatory in this phase.
- The narrowing inside `EditorShell.tsx` that treats the runtime as `regular` / `enhanced` only is acceptable in v1 because the router keeps html out of that runtime. Do not broaden `EditorShell.tsx` into a mixed runtime here.

### What To Test After Phase 2

- Open `/editor` and confirm the page still loads correctly.
- Confirm `regular` and `enhanced` projects still mount the current Fabric editor.
- Confirm there is no visible flicker where the wrong shell briefly appears.
- Confirm page refresh on an existing project still lands in the correct runtime.
- Confirm no Fabric hook errors appear due to early router changes.

### External AI Review Prompt After Phase 2

```text
Review the code changes for Phase 2 of the HTML template type rollout.

Context:
- This phase introduced a runtime router so html can be isolated from the Fabric runtime.
- `EditorShell.tsx` should still own only `regular` / `enhanced`.
- The router must not cause a flash-of-wrong-shell or change existing runtime behavior.

Please review for:
1. Any path where html could still accidentally mount `EditorShell.tsx`.
2. Any path where existing `regular` / `enhanced` projects could fail to mount correctly.
3. Bootstrap timing bugs, race conditions, or wrong-default behavior.
4. Whether `EditorShell.tsx` remains safely Fabric-local rather than being generalized for html.
5. Any accidental logic changes inside the Fabric runtime beyond breadcrumb comments.

Focus on runtime ownership, bootstrap timing, and regression risk.
```

---

## Phase 3. Additive DB + Load Contracts

### Goal

Add the database and read-path plumbing required for html projects, while still keeping the user-facing feature mostly dormant.

### Primary Outcomes

- migrations for html tables/columns are added
- shared load/bootstrap routes tolerate `html`
- `_effective.ts` safely handles `html`
- `projects/load` can return html project data when needed

### Files Expected To Change

- new Supabase migration files
- `src/app/api/editor/initial-state/route.ts`
- `src/app/api/editor/projects/load/route.ts`
- `src/app/api/editor/projects/_effective.ts`
- `src/features/editor/store/EditorStoreProvider.tsx`
- `src/features/editor/hooks/useEditorBootstrap.ts`
- `src/features/editor/hooks/useProjectLifecycle.ts`

### Files Explicitly Not To Touch In This Phase

- `src/app/api/editor/projects/jobs/generate-copy/route.ts`
- `src/features/editor/hooks/useGenerateCopy.ts`
- picker modals
- html editing/export code

### Implementation Notes

- This phase is allowed to add DB schema and load-response fields.
- It should still avoid exposing end-to-end user creation/generation flows.
- Shared bootstrap must not auto-create html projects.
- `_effective.ts` should early-return safe defaults for html instead of trying to load regular/enhanced settings.

### What To Test After Phase 3

- Run migrations in a safe environment and verify they apply cleanly.
- Confirm editor initial load still works.
- Confirm `regular` and `enhanced` projects still load correctly from the database.
- If a test html row is inserted manually, confirm shared load routes do not crash.
- Confirm `initial-state` and `projects/load` return stable responses for old project types.

### External AI Review Prompt After Phase 3

```text
Review the code changes for Phase 3 of the HTML template type rollout.

Context:
- This phase added database schema and read/load-path support for html projects.
- It must remain additive and must not change the behavior of existing `regular` / `enhanced` projects.

Please review for:
1. Migration correctness, foreign keys, indexes, triggers, RLS, and rollback risk.
2. Any shared load/bootstrap path that still rejects or coerces `html`.
3. Any shared load/bootstrap path that now risks breaking `regular` / `enhanced`.
4. Any mismatch between the DB contract and the documented html load contract.

Focus especially on:
- migration safety
- `initial-state`
- `projects/load`
- `_effective.ts`
- bootstrap/lifecycle hooks
```

---

## Phase 4. Shared Entry Flows, Creation Only

### Goal

Allow users to create html projects from shared entry points, but not yet complete the full html generation/editing experience.

### Primary Outcomes

- html becomes selectable in shared picker/create UI
- create routes accept `html`
- route-level saved prompt resolution for html works via the Regular saved-prompt pool
- html project creation persists `prompt_snapshot`
- html placeholder slide rows are created

### Files Expected To Change

- `src/app/api/editor/projects/create/route.ts`
- `src/app/api/editor/projects/set-template-type/route.ts`
- `src/app/api/swipe-file/items/[id]/create-project/route.ts`
- `src/app/api/swipe-file/items/[id]/ideas/prompt-preview/route.ts`
- `src/app/api/editor/ideas/create-carousel/route.ts`
- `src/app/api/carousel-map/[mapId]/create-project/route.ts`
- `src/app/api/carousel-map/[mapId]/prompt-preview/route.ts`
- `src/app/api/editor/user-settings/poppy-prompts/list/route.ts`
- `src/app/api/editor/user-settings/poppy-prompts/create/route.ts`
- `src/features/editor/components/EditorSidebar.tsx`
- `src/features/editor/components/SwipeIdeasPickerModal.tsx`
- `src/features/editor/components/CarouselMapProjectPickerModal.tsx`
- `src/features/editor/components/CarouselMapModal.tsx`
- `src/features/editor/components/IdeasModal.tsx`
- `src/features/editor/components/SwipeFileModal.tsx`

### Files Explicitly Not To Touch In This Phase

- html generation endpoint
- html iframe renderer
- html element editor
- Fabric generation hooks beyond minimal additive template-type widening if required

### Implementation Notes

- `type=html` prompt list requests should be accepted at the route level and resolved to the Regular prompt pool internally.
- `templateTypeId=html` prompt create requests should also be accepted at the route level and stored in the Regular prompt pool internally.
- The UI should not need to fake `type=regular`.
- html create routes should persist the resolved prompt text into `carousel_projects.prompt_snapshot`.
- Shared prompt-preview routes used by html-capable entry flows should be widened in this phase so the preview affordance does not break while creation is already enabled.
- `set-template-type/route.ts` should explicitly block switching to or from `html` in v1 with a clear 400 response/message rather than leaving a generic invalid-type error.
- Digest-origin shared picker flows should hide/block the html option in the UI so Daily Digest remains Regular-only in v1 without silently overriding the user's choice later.
- It is acceptable if html projects still open into a shell with incomplete generation/editing behavior at this stage.

### What To Test After Phase 4

- Confirm html appears as an option anywhere the plan says it should.
- Create an html project from:
  - base project creation
  - swipe flow
  - ideas flow
  - carousel map flow
- Confirm prompt selection remains visible for html in shared flows.
- Confirm html prompt loading works even though no html-specific saved prompt rows exist.
- Confirm prompt preview works for html-capable swipe and carousel-map entry flows.
- Confirm attempting to switch an existing project to or from html returns the explicit v1 unsupported message.
- Confirm `regular` and `enhanced` creation flows still work exactly as before.
- Confirm Daily Digest remains Regular-only in v1.
- Confirm digest-origin picker flows do not offer html as a selectable option.

### External AI Review Prompt After Phase 4

```text
Review the code changes for Phase 4 of the HTML template type rollout.

Context:
- This phase enabled html project creation from shared entry flows.
- Html prompt selection should remain visible in the UI.
- Html prompt content should resolve from the Regular saved-prompt pool at the route layer.
- Existing `regular` / `enhanced` creation flows must remain unchanged.

Please review for:
1. Any entry flow where `html` is still blocked or silently coerced.
2. Any route where html prompt resolution was implemented in the UI instead of the server.
3. Any html-capable prompt-preview route that still rejects `html` or returns the wrong behavior for this phase.
4. Any route where html creation fails to persist the expected prompt snapshot or placeholder data.
5. Any regression risk to existing `regular` / `enhanced` create flows.
6. Any localStorage or modal state logic that still collapses html to enhanced/regular.
7. Whether `set-template-type/route.ts` now blocks html switching explicitly and safely for v1.

Focus on create routes, picker modals, prompt list routing, and project creation safety.
```

---

## Phase 5. HTML Shell Skeleton Only

### Goal

Mount a dedicated html runtime shell with the intended workspace structure, but without full generation/editing behavior yet.

### Primary Outcomes

- `HtmlEditorShell.tsx` exists and mounts for html projects
- shared chrome remains consistent
- html workspace skeleton is visible
- right-side inspector shell and disabled AI Designer tab exist
- html bottom panel shell exists

### Files Expected To Change

- `src/features/html-editor/components/HtmlEditorShell.tsx`
- `src/features/html-editor/components/HtmlBottomPanel.tsx`
- `src/features/html-editor/components/HtmlAiDesigner.tsx`
- `src/features/html-editor/store/*`
- `src/features/html-editor/services/htmlProjectsApi.ts`
- `src/features/editor/components/EditorTopBar.tsx` for shell-safe html branching and incomplete-action guarding
- `src/features/editor/components/EditorSidebar.tsx` for hiding Fabric-only template-settings and prompt-override controls while preserving shared project navigation chrome

### Files Explicitly Not To Touch In This Phase

- html generation endpoint
- html editing serializer/parser logic
- export endpoint
- Fabric hooks

### Implementation Notes

- This phase is about shell composition only.
- The html runtime should be visibly separate from Fabric, but still feel like the same product.
- Keep AI Designer visible but disabled.
- `EditorTopBar.tsx` may need additive html-aware guards in this phase so the shared chrome can render safely before final export behavior is wired in Phase 8.
- When an html project opens before copy exists, the shell should show a clear empty state with a primary **Generate Copy** call to action. Preset selection stays hidden or disabled until copy exists, then **Choose a Preset** becomes the next primary step, followed by **Generate Slides** once a preset is selected.
- Do not attempt to finish behavior that belongs to later phases.

### What To Test After Phase 5

- Open an html project and confirm it mounts `HtmlEditorShell`.
- Open regular and enhanced projects and confirm they still mount `EditorShell`.
- Confirm the html workspace layout matches the agreed V1 structure.
- Confirm the right-side inspector and bottom panel shells appear where expected.
- Confirm no Fabric canvas logic runs for html projects.

### External AI Review Prompt After Phase 5

```text
Review the code changes for Phase 5 of the HTML template type rollout.

Context:
- This phase introduced the dedicated html runtime shell and workspace skeleton.
- It should isolate html from Fabric without implementing the full html editor yet.
- Existing `regular` / `enhanced` projects must still use the legacy Fabric shell.

Please review for:
1. Any runtime leakage between html and Fabric.
2. Any shell composition bugs, missing ownership boundaries, or accidental coupling to Fabric hooks.
3. Any regressions in shared top bar / product chrome behavior.
4. Any html shell logic that is doing too much too early and should belong to a later phase.

Focus on runtime isolation, shell composition, and UI ownership boundaries.
```

---

## Phase 6. HTML Copy Branch

### Goal

Implement html copy generation as a first-class branch without disturbing the existing Fabric-oriented copy flow.

### Primary Outcomes

- `generate-copy/route.ts` explicitly branches for html
- html copy generation produces `HtmlCopyDraft`
- html copy generation does not use the regular/enhanced payload shape or follow-up behaviors
- html copy generation does not run Fabric-specific follow-up logic
- html prompt-preview routes return a sectioned preview derived from `HtmlCopyDraft`

### Files Expected To Change

- `src/app/api/editor/projects/jobs/generate-copy/route.ts`
- `src/features/editor/hooks/useGenerateCopy.ts` or an html-specific wrapper/hook
- `src/features/editor/hooks/useEditorJobs.ts`
- `src/app/api/swipe-file/items/[id]/ideas/prompt-preview/route.ts`
- `src/app/api/carousel-map/[mapId]/prompt-preview/route.ts`
- html-specific copy trigger code under `src/features/html-editor/`

### Files Explicitly Not To Touch In This Phase

- html slide rendering/export endpoints
- Fabric layout internals
- Fabric image workflows

### Implementation Notes

- Prefer an html-specific wrapper or hook if reusing the Fabric-side hook would create regression risk.
- The html branch should not enqueue live layout or generate emphasis ranges.
- The html branch should not generate caption in v1; caption remains a separate project-level field/editor surface per the main architecture plan.
- The html branch should not return the regular/enhanced payload shape.

### What To Test After Phase 6

- Trigger copy generation for an html project and confirm it yields `HtmlCopyDraft`.
- Confirm html copy generation does not generate caption.
- Confirm html prompt preview routes show a sectioned, human-readable preview of html copy.
- Confirm `regular` copy generation still works exactly as before.
- Confirm `enhanced` copy generation still works exactly as before.
- Confirm no Fabric live-layout behavior is triggered for html copy generation.

### External AI Review Prompt After Phase 6

```text
Review the code changes for Phase 6 of the HTML template type rollout.

Context:
- This phase added the html-specific copy-generation branch.
- The html branch should produce `HtmlCopyDraft`, not the regular/enhanced payload shape.
- It must not generate caption, emphasis ranges, or Fabric follow-up behaviors.
- Existing `regular` / `enhanced` copy generation must remain unchanged.

Please review for:
1. Any place where html is still being coerced into regular/enhanced parser logic.
2. Any place where Fabric follow-up logic is still triggered for html.
3. Any regression risk in regular/enhanced copy generation.
4. Any mismatch between the html copy branch and the documented `HtmlCopyDraft` contract.
5. Any prompt-preview route that still returns the wrong preview format for html.

Focus on `generate-copy`, html copy shaping, and regression safety.
```

---

## Phase 7. Presets + HTML Generation + Read-Only Preview

### Goal

Generate actual html slides and preview them in iframes before enabling editing.

### Primary Outcomes

- preset gallery works
- html generation endpoint works
- html slides stream via SSE
- generated html is sanitized and stored correctly
- silent image slot prefill is applied where appropriate
- slides render in read-only iframe preview

### Files Expected To Change

- `src/features/html-editor/components/HtmlPresetGallery.tsx`
- `src/features/html-editor/hooks/useHtmlSlideGeneration.ts`
- `src/features/html-editor/hooks/useHtmlSlideRenderer.ts`
- `src/features/html-editor/lib/htmlDocumentWrapper.ts`
- `src/features/html-editor/lib/fontOptimizer.ts`
- `src/app/api/editor/html-projects/generate-slides/route.ts`
- any html preset seed/config files

### Files Explicitly Not To Touch In This Phase

- html element editing parser/serializer behavior
- html save-slides endpoint
- html render/export endpoint

### Implementation Notes

- Keep this phase read-only from an editor perspective.
- Focus on correctness of generation, sanitization, and preview rendering first.
- This phase should also prove that the image prefill/fallback rules behave acceptably in practice.
- System preset seeding must use the **verified Mirr preset contract** documented in `docs/HTML_TEMPLATE_TYPE_PLAN.md` §9. Each preset is a structured record with `styleGuide` (6 fields), 1-10 reference HTML `templates`, `exampleImages`, `category`, `isFeatured`, and `aspectRatio`. The evidence source is `style.har` entry 151.
- The preset gallery should load all system presets in one request with client-side category and aspect-ratio filtering for V1.

### What To Test After Phase 7

- Generate html slides from an html project after copy exists.
- Confirm preset selection occurs after copy generation.
- Confirm SSE progress is displayed correctly.
- Confirm generated slides render inside the html preview iframe.
- Confirm sanitization removes unsafe content as documented.
- Confirm slot prefill/fallback behavior avoids unresolved gray boxes in the default experience.
- Confirm regular/enhanced flows still generate and render as before.

### External AI Review Prompt After Phase 7

```text
Review the code changes for Phase 7 of the HTML template type rollout.

Context:
- This phase implemented html preset selection, html slide generation, sanitization, slot prefill, and read-only iframe preview.
- Editing, save, and export are not the focus of this phase yet.
- Existing `regular` / `enhanced` generation and rendering behavior must remain unchanged.

Please review for:
1. Generation contract mismatches versus the documented html API contract.
2. Sanitization gaps, unsafe HTML handling, or iframe rendering security issues.
3. SSE parsing/state handling bugs, including partial generation behavior.
4. Slot prefill logic that could degrade generation or overwrite valid imagery incorrectly.
5. Any coupling that risks affecting Fabric generation/rendering paths.

Focus on html generation correctness, security, preview fidelity, and regression risk.
```

### Follow-on: Mirr-style browse + template detail (Phase 17F)

Phase 7 delivered **preset selection inside the project flow** and **generation**. Separately, the HTML editor now has (or will have) a **Browse templates** entry that must converge with Mirr’s **catalog + detail** UX.

**Canonical spec and implementation checklist:** `docs/TEMPLATE_SYSTEM_PARITY_PLAN.md`

- **§4 — Phase 17F** — Entry surface (All / Featured / My Templates / Favorites scaffolding) **plus** **template detail** inside the browse modal: tabs **Example results** (from `exampleImages`) and **Design structure** (from `templates[].html` + `styleGuide` + `pageType`), with **Edit design** / **Use this template** **visible but disabled** until a later milestone.
- **§9 — Active implementation plan** — ordered steps, file list (`HtmlTemplatesBrowseModal.tsx`, `HtmlPresetGallery.tsx`, new `HtmlTemplateDetailView.tsx`, optional `HtmlPresetSlidePreview.tsx`), and explicit **non-goals** for that slice (no mutation of selected preset from browse).

**Relationship to this document:** Milestone B (Phase 7) remains the source of truth for **choose preset → generate**. Phase **17F** is **browse-only inspection** parity with Mirr; wiring **Use this template** from the modal into the same preset + generation path is a **later** change and should be tracked as a small milestone when enabled.

---

## Phase 8. Editing + Save + Export

### Goal

Finish the html editor with real element-level editing, persistence, and export.

### Primary Outcomes

- editable element parsing works
- selected element inspector works
- html mutation/serialization works
- html slide save endpoint works
- html export/render endpoint works
- autosave and unsaved-change handling work for html

### Files Expected To Change

- `src/features/html-editor/hooks/useHtmlElementParser.ts`
- `src/features/html-editor/hooks/useHtmlElementSerializer.ts`
- `src/features/html-editor/components/HtmlElementEditor.tsx`
- `src/features/html-editor/components/HtmlElementList.tsx`
- `src/features/html-editor/hooks/useHtmlSlideExport.ts`
- `src/app/api/editor/html-projects/save-slides/route.ts`
- `src/app/api/editor/html-projects/render/route.ts`
- `src/features/editor/components/EditorTopBar.tsx` for final html export dispatch wiring
- `src/features/editor/components/MobileSaveSlidesPanel.tsx` for the html desktop-only/mobile guard behavior
- any html-specific save/export wiring in the shell

### Files Explicitly Not To Touch In This Phase

- Fabric editor internals unless an additive shared top-bar dispatch change is required
- old Fabric export internals

### Implementation Notes

- This is the final phase because it adds the most user-facing complexity.
- Editing should remain fully isolated inside the html runtime.
- Export should use the same final HTML the editor sees.
- Mobile editing remains out of scope; preserve desktop-only behavior for html.

### What To Test After Phase 8

- Select and edit text elements in html slides.
- Select and edit image/block properties in html slides.
- Confirm changes persist and reload correctly.
- Confirm autosave works for html.
- Confirm `Download All` works for html ZIP export.
- Confirm `Download PDF` remains hidden for html in v1.
- Confirm exported output matches what the editor preview shows.
- Re-test `regular` and `enhanced` create, edit, save, and export flows end to end.

### External AI Review Prompt After Phase 8

```text
Review the code changes for Phase 8 of the HTML template type rollout.

Context:
- This phase completed the html editor: element parsing, inspector editing, save, and export.
- Html editing should remain fully isolated from the Fabric runtime.
- Existing `regular` / `enhanced` editing and export flows must remain unchanged.

Please review for:
1. Editing model bugs, parser/serializer mismatches, and lost-update risks.
2. Save-path correctness and persistence fidelity for edited html.
3. Export/render correctness and mismatch risk between editor preview and export output.
4. Autosave / unsaved-changes issues specific to html.
5. Any accidental regressions to Fabric-based save/export flows.

Focus on correctness, persistence, export fidelity, and regression risk.
```

## 5. Milestone Gates

These are the required stop points before moving into the next milestone.

### Before Advancing Past Milestone A

- shared type widening is stable
- runtime router is in place and safe
- DB/load plumbing is additive and verified
- no user-facing html generation/editing flow is required yet
- regular/enhanced continue to work normally

### Before Advancing Past Milestone B

- html projects can be created from the intended entry flows
- html shell mounts correctly
- html copy generation is stable
- html slides can be generated and previewed read-only
- regular/enhanced still pass end-to-end smoke tests

### Before Declaring Milestone C Complete

- html editing is stable
- html save/reload fidelity is proven
- html export matches preview
- desktop-only constraints behave as intended
- regular/enhanced end-to-end flows still work

## 6. Minimum Regression Suite Between Phases

Even if a phase seems isolated, run these minimum checks before moving on:

### Regular

- create project
- generate copy
- edit text
- save
- export

### Enhanced

- create project
- generate copy
- edit text
- edit image
- save
- export

### HTML

Only run the html checks that are supposed to exist by the current phase.

Examples:

- after Phase 4: creation only
- after Phase 6: copy only
- after Phase 7: generation + read-only preview
- after Phase 8: full edit/save/export

## 7. Working Rule For Implementation

During implementation, use this sequence for every phase:

1. Re-read the relevant sections of `docs/HTML_TEMPLATE_TYPE_PLAN.md`
2. Implement only the current phase scope
3. Run the phase verification checklist
4. Re-run the minimum regression suite for existing project types
5. Use the external AI review prompt for that phase
6. Resolve review findings before starting the next phase

If a phase uncovers a contradiction in the main plan, stop and reconcile the spec before writing more code.

## 8. Final Note

This rollout is intentionally conservative.

The goal is not just to build the html project type.

The goal is to build it in a way that:

- preserves confidence in `regular` and `enhanced`
- makes regressions easier to catch early
- keeps implementation aligned with the main architecture/spec document
- gives both human testing and secondary AI review a clear checkpoint after every phase

## 9. Post-MVP Follow-Up Backlog

This section tracks the work that remains after the 8-phase MVP rollout. It is intentionally split into:

- `must-fix` items where the shipped behavior still falls short of an intended contract
- `doc-update` items where the code is acceptable but the docs had drifted from reality
- `future-scope` items that remain explicitly deferred rather than accidentally forgotten

### Must Fix To Match Intended Contract

| Label | Priority | Item | Current State | Desired End State | Status |
|---|---|---|---|---|---|
| `must-fix` | High | Persist `html_preset_id` during generation | `html_style_guide` and generation state persist, but the selected preset id is not consistently written back during generate-slides | preset choice is stored as durable project state alongside the style guide so load/reload matches the intended preset contract | Open |
| `must-fix` | Medium | Decide final save API contract | shipped `save-slides` is `POST` with `slides[]` | either keep the MVP contract and bless it in the architecture doc permanently, or move to a richer contract only if it materially improves reliability/workflow | Open |
| `must-fix` | Medium | Decide final export API contract | shipped `render` route exports ZIP by `projectId` only | either keep the MVP export contract and treat it as canonical, or add `pages[]` / `format` / blob-storage variants if truly needed | Open |

### Doc Reconciliation Required

| Label | Priority | Item | Current State | Desired End State | Status |
|---|---|---|---|---|---|
| `doc-update` | Medium | Workspace layout description | the architecture doc previously described an active preview with thumbnails below | docs should describe the shipped horizontal old-editor-style row workspace with a persistent right inspector | Done |
| `doc-update` | Medium | Aspect ratio / canvas geometry | parts of the architecture doc still emphasized `4:5` and Mirr-derived sizing | docs should clearly state that the shipped html editor/export path matches `EditorShell` at `3:4` / `1080x1440` | Done |
| `doc-update` | Medium | Preset source of truth | the architecture doc previously implied DB-backed preset serving | docs should state that the MVP currently serves presets from a code-defined catalog while the DB table remains future-facing | Done |
| `doc-update` | Low | `carousel_template_types` contradiction | earlier plan text said no compatibility row was needed for `"html"` | docs should reflect that the real schema required a compatibility row even though html does not use template overrides semantically | Done |

### Deferred Feature Parity / Future Scope

| Label | Priority | Item | Current State | Desired End State | Status |
|---|---|---|---|---|---|
| `future-scope` | High | Mirr-style in-iframe editing parity | shipped MVP uses iframe click-selection and parent-side parsing/patching | in-iframe interaction script, richer `postMessage`, drag/resize/rotate, inline rich-text editing, and parity with the Mirr interaction model | Deferred |
| `future-scope` | Medium | Dedicated html store/file split | some responsibilities are implemented, but the exact planned file split was not completed | decide whether `htmlEditorStore.ts`, store `types.ts`, standalone parser/sanitizer/interaction-script files, and `useHtmlDragResize.ts` should be added for maintainability | Deferred |
| `future-scope` | Medium | Missing planned html UI surfaces | `HtmlFontSelector`, `HtmlAddElementBar`, and `HtmlCaptionEditor` do not exist as standalone shipped components | either intentionally collapse these into existing UI permanently or build them as dedicated surfaces if the workflow requires it | Deferred |
| `future-scope` | Medium | Bottom panel expansion | current html bottom panel covers workflow/status but not a true caption editor or debug log surface | decide how much of the original bottom-panel vision still matters and implement the missing surfaces if still desired | Deferred |
| `future-scope` | Low | Editor polish parity | undo/redo, session persistence/history, keyboard shortcuts, project-switch unsaved-changes modal, add-element flows, and richer partial-generation retry UX are not shipped | selectively implement only the polish items that are still product-relevant after MVP usage feedback | Deferred |
| `future-scope` | Low | Runtime rename breadcrumbs | router/runtime split exists, but the planned `FabricEditorShell` breadcrumb TODO comments are still missing | add the lightweight rename/extraction TODO comments if we still want to preserve that future refactor breadcrumb | Deferred |


## 10. Post-MVP Phase Sequence

The sections above track what remains. This section converts that backlog into the recommended execution order for the next implementation cycle.

Guiding rule:

- lock down persistence/contracts first
- then improve internal structure where it materially helps Mirr parity
- then build interaction parity before secondary polish surfaces
- then finish workflow parity, asset parity, and final polish

If the end goal is to get as close to Mirr as possible, including internal structure where it helps us reproduce Mirr behavior more reliably, continue in this order.

### Phase 9. Contract Stabilization

Goal:

- close the remaining MVP contract gaps before deeper parity work begins

Includes:

- persist `html_preset_id` durably during slide generation and reload flows
- decide whether the shipped `save-slides` contract remains canonical or should be expanded
- decide whether the shipped `render` contract remains canonical or should be expanded
- update `docs/HTML_TEMPLATE_TYPE_PLAN.md` if the MVP contracts are blessed as final

Why this phase goes first:

- Mirr-style editing parity will sit on top of these persistence rules
- changing project-level preset/save/export contracts later would create avoidable rework

Done when:

- preset choice survives generation, save, reload, and runtime handoff
- the save contract is either explicitly frozen or explicitly replaced
- the export contract is either explicitly frozen or explicitly replaced
- docs and code agree on the canonical contract

### Phase 10. Mirr Runtime Foundation

Goal:

- reshape the html runtime internals so later parity work lands on stable boundaries instead of ad hoc shell code

Includes:

- extract or formalize `htmlEditorStore.ts` ownership for pages, selection, dirty state, and history state
- split parser/sanitizer/serializer/interaction responsibilities into dedicated html files where that improves maintainability and parity work
- define a stable iframe `postMessage` contract for selection, hover, inline edit lifecycle, and transform events
- add or restore the lightweight runtime breadcrumbs around future `FabricEditorShell` naming if still desired

Why this phase happens before deeper UI work:

- true Mirr parity depends on a stronger ownership model between parent shell and iframe runtime
- drag/resize/inline editing will be riskier if state is still scattered across shell-local hooks

Done when:

- html state ownership is explicit and no longer spread across unrelated shell concerns
- parser/sanitizer/serializer/interaction boundaries are clear enough to support rapid parity work
- iframe communication is stable enough to support interaction-heavy features

### Phase 11. Mirr Core Interaction Parity

Goal:

- make the slide itself behave like Mirr, not just look similar in layout

Includes:

- in-iframe selection overlays and stronger hovered/selected element affordances
- drag
- resize
- rotate
- inline text editing inside the iframe editing surface
- richer `postMessage` events so parent inspector state stays synchronized with iframe interactions
- page-local selection lifecycle cleanup when switching slides/projects

Why this is the highest-value parity phase:

- this is the biggest current gap between the shipped MVP and the intended Mirr-like editor behavior
- if this phase is not completed, the editor will still feel meaningfully less capable than Mirr even if the surrounding chrome improves

Done when:

- a user can interact with html slide elements directly in the canvas area rather than relying primarily on parent-side patching
- selection, transforms, and inline editing feel first-class rather than bolted on
- switching slides/projects does not leak stale iframe interaction state

### Phase 12. Mirr Editing Surface Parity

Goal:

- bring the inspector and secondary controls closer to Mirr's editing toolkit once core interactions exist

Includes:

- build or formalize `HtmlFontSelector`
- build or formalize `HtmlAddElementBar`
- expand inspector controls for typography, alignment, spacing, sizing, colors, and layout properties
- decide whether `HtmlCaptionEditor` should become a dedicated shipped surface or remain intentionally collapsed into existing UI
- improve `HtmlElementList` / layer management behavior if Mirr parity requires it

Why this phase follows interaction parity:

- richer controls matter more once the canvas itself supports Mirr-style direct manipulation
- otherwise the product risks adding more settings without improving the actual editing feel

Done when:

- the inspector and related controls cover the element-editing tasks needed for Mirr-like workflows
- add-element and font-selection flows feel like deliberate editor features rather than missing placeholders

### Phase 13. Workflow Parity And Resilience

Goal:

- make the editor resilient and production-friendly under real editing sessions

Includes:

- undo/redo
- unsaved-changes guard for project switching and unload
- stronger autosave coordination with export
- keyboard shortcuts where they materially match Mirr behavior
- session persistence/history restoration if still desired after usage review
- better whole-job retry and generation-state recovery flows

Why this phase is separate:

- these features matter, but they are most valuable after the editing model itself is already strong
- this phase should harden the experience instead of being asked to compensate for weak core interactions

Done when:

- normal editing mistakes and navigation flows no longer feel fragile
- save/export/switching behavior behaves predictably under dirty-state conditions
- the editor can withstand longer sessions without feeling brittle

### Phase 14. Asset And Media Parity

Goal:

- close the remaining gap for image and slot-driven workflows that make templates feel complete

Includes:

- decide how far to extend slot-image workflows toward Mirr behavior
- add image replacement/search flows if still product-relevant
- improve logo/media slot targeting and replacement behavior if required
- preserve the existing V1 silent-prefill path while extending it rather than replacing it with a second incompatible model

Why this is after workflow parity:

- media tooling benefits from having stable interaction/state foundations already in place
- asset flows often touch both UX and async state, so they are safer once the editor core is hardened

Done when:

- image/media workflows no longer feel like an MVP compromise relative to the Mirr target behavior
- slot targeting remains page-specific and resilient during async operations

### Phase 15. Final Mirr Parity Polish And Audit

Goal:

- use the now-mature html runtime to close the remaining behavioral and visual parity gaps and explicitly audit what still differs

Includes:

- motion, micro-interactions, spacing, loading states, and inspector polish
- final workspace/selection/export fidelity pass
- review whether any remaining Mirr-specific behavior still differs in meaningful ways
- document any intentional differences that remain for product reasons rather than accidental drift

Why this is last:

- parity polish only makes sense after the deeper interaction/workflow gaps are already addressed
- this phase should be about tightening, not inventing core behavior late

Done when:

- the html runtime feels substantially equivalent to the Mirr target in day-to-day usage
- remaining differences are intentional and documented rather than accidental omissions

## 11. Recommended Next Move

If implementation resumes now, continue with:

1. Phase 9. Contract Stabilization
2. Phase 10. Mirr Runtime Foundation
3. Phase 11. Mirr Core Interaction Parity

This keeps the next cycle focused on the highest-leverage work first instead of diffusing effort across lower-value polish before the editing model is truly Mirr-like.
