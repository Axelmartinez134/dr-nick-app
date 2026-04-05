# Audit Prompt for ChatGPT 5.4

> Copy everything below the line and paste it into ChatGPT 5.4. Then upload the files listed in the "FILES TO UPLOAD" section.

---

## SCOPING ANSWERS (from the project lead — read these before proceeding)

These answers were written by the project lead in response to your scoping questions. They override any conflicting assumptions.

### Q1: Should I follow referenced dependencies outside the listed files?

**Yes, absolutely.** The file list is a starting point, not a boundary. You are explicitly authorized to follow any import, reference, or dependency chain that materially affects correctness. The files you already found — `src/app/api/editor/initial-state/route.ts`, `src/features/editor/components/SwipeFileModal.tsx`, and `src/features/editor/store/EditorStoreProvider.tsx` — are all relevant and should be included.

Here is the **complete list of files that reference `TemplateTypeId` or hardcode `"regular" | "enhanced"` coercion** (66 files total, discovered via codebase grep). Read any of these that seem relevant to your audit:

**Client-side type definition (canonical):**
- `src/features/editor/store/types.ts` — line 1: `export type TemplateTypeId = "regular" | "enhanced";`

**Server-side files that import or redeclare the type:**
- `src/app/api/editor/_utils.ts`
- `src/app/api/editor/projects/_effective.ts`
- `src/app/api/editor/projects/create/route.ts`
- `src/app/api/editor/projects/set-template-type/route.ts` — **CRITICAL: line 33 has `if (body.templateTypeId !== 'regular' && body.templateTypeId !== 'enhanced')` hardcoded guard**
- `src/app/api/editor/initial-state/route.ts` — **CRITICAL: line 68 has `if (raw === 'enhanced' || raw === 'regular') templateTypeId = raw;` which silently drops unknown types to `'regular'`**
- `src/app/api/editor/template-types/effective/route.ts`
- `src/app/api/editor/template-types/overrides/upsert/route.ts`

**Client-side files with hardcoded `"regular" | "enhanced"` coercion:**
- `src/features/editor/store/EditorStoreProvider.tsx` — line 176: `templateTypeId: "regular"` default, line 177: `newProjectTemplateTypeId: "enhanced"` default
- `src/features/editor/components/SwipeFileModal.tsx` — **CRITICAL: lines 106-118 have `useState<"enhanced" | "regular">` with localStorage fallback that forces unknown values to `"enhanced"`**
- `src/features/editor/components/SwipeIdeasPickerModal.tsx`
- `src/features/editor/components/CarouselMapProjectPickerModal.tsx`
- `src/features/editor/components/IdeasModal.tsx`
- `src/features/editor/components/EditorSidebar.tsx`
- `src/features/editor/components/EditorBottomPanel.tsx`
- `src/features/editor/components/EditorSlidesRow.tsx`

**API routes that reference template type for job logic:**
- `src/app/api/editor/projects/jobs/generate-copy/route.ts`
- `src/app/api/editor/projects/jobs/start/route.ts`
- `src/app/api/editor/projects/jobs/status/route.ts`
- `src/app/api/editor/projects/jobs/generate-ai-image/route.ts`
- `src/app/api/editor/projects/jobs/regenerate-body/route.ts`
- `src/app/api/editor/projects/jobs/regenerate-body-emphasis-styles/route.ts`
- `src/app/api/editor/projects/jobs/regenerate-body-emphasis-styles-all/route.ts`
- `src/app/api/swipe-file/items/[id]/create-project/route.ts`
- `src/app/api/carousel-map/[mapId]/create-project/route.ts`
- `src/app/api/editor/ideas/create-carousel/route.ts`
- `src/app/api/daily-digest/topics/[id]/create-carousel/route.ts` — **NOTE: This file is NOT in the plan's modification list but hardcodes `template_type_id: 'regular'` on lines 82 and 147**

**Files that use templateTypeId for rendering/layout decisions:**
- `src/app/editor/EditorShell.tsx`
- `src/features/editor/hooks/useEditorBootstrap.ts`
- `src/features/editor/hooks/useProjectLifecycle.ts`
- `src/features/editor/hooks/useEditorPersistence.ts`
- `src/features/editor/hooks/useLiveLayoutQueue.ts`
- `src/features/editor/hooks/useFabricCanvasBinding.ts`
- `src/features/editor/hooks/useImageOps.ts`
- `src/features/editor/hooks/useEditorStoreActionsSync.ts`
- `src/features/editor/hooks/useEditorStoreWorkspaceRegistry.tsx`
- `src/features/editor/hooks/useGenerateCopy.ts`
- `src/features/editor/hooks/useAutoRealignOnImageRelease.ts`
- `src/features/editor/hooks/useGenerateAiImage.ts`
- `src/features/editor/hooks/useGenerateImagePrompts.ts`
- `src/features/editor/hooks/useEditorJobs.ts`
- `src/features/editor/services/projectsApi.ts`

**The plan's §3 table only lists 11 files. The actual count of files needing review is 40+.** Flag every file above that the plan misses.

### Q2: Mirr reference file inventory — full or materially relevant?

**Materially relevant only, with terse categorization for the rest.** For the 81 files in `mirr-extracted/`, give me:
- **Full description** for any file that contains carousel editor logic, API integration, preset/template system, font optimization, or iframe interaction code
- **One-line terse categorization** for generic webpack/Next.js infrastructure chunks (e.g., "Next.js layout shell", "React vendor chunk", "webpack runtime")
- **Explicit callout** for any file containing relevant code that the plan does NOT reference

### Q3: Should you inspect the raw HAR file?

**No.** Treat the extracted files in `mirr-extracted/` and `mirr-extracted/api-responses/` as the canonical source. The HAR file is 50MB+ and the extraction was thorough. Only go to the HAR if you find a specific discrepancy between the extracted API responses and what the JS chunks reference.

### Q4: Should you propose exact plan amendments or just flag gaps?

**Propose exact amendments.** In §4 of your output, for each gap you find, write the **exact text that should be added or changed** in `HTML_TEMPLATE_TYPE_PLAN.md`, including:
- Exact section number where it belongs
- Missing API fields with TypeScript types
- Missing migration statements (full SQL)
- Missing UI specifications
- Missing file paths for the §3 modification table

Don't just say "this is missing" — write the fix.

### Q5: Database migration review scope?

**Focused review.** Only scan migrations that touch these tables:
- `carousel_projects`
- `carousel_project_slides`
- `account_members`
- `accounts`
- Any table with RLS policies the new tables need to reference

The goal is to verify that the plan's proposed `html_project_slides` and `html_design_presets` tables, their foreign keys, and their RLS policies are consistent with the existing schema patterns.

### Q6: Mirr parity vs. product intent — which is the benchmark?

**Product intent is the benchmark.** If the plan intentionally omits a Mirr feature, that is NOT a gap — unless the omission creates a technical inconsistency or broken user flow. For example:
- Mirr has workspace/team features → we don't need those → NOT a gap
- Mirr has a specific SSE field that our API contract omits → gap IF it's needed for the client to render correctly
- Mirr tracks generation history per-project → we don't mention this → gap ONLY if the undo/save system breaks without it

When in doubt, flag it as "QUESTION: Intentional omission?" rather than "GAP."

### Q7: Should you pause for another round of questions?

**No — proceed straight to the final audit after these answers.** If you find materially conflicting assumptions during validation, include them in §5 ("Questions for the Team") of your output rather than pausing. We want a single comprehensive deliverable, not a multi-round conversation.

---

## CONTEXT

I'm building a new feature for my Next.js/Supabase web app — a new "HTML" project type for my carousel editor that generates AI-designed HTML slides rendered in iframes, replacing the current Fabric.js canvas pipeline. This is the biggest architectural addition to the codebase to date.

An AI assistant (Claude) reverse-engineered a competitor product (Mirr / mirra.my) by capturing their production JS bundles and API traffic via a HAR file, then wrote a comprehensive architecture plan for how to replicate their approach in my app. I need you to **audit that plan for completeness, accuracy, and implementability** before I hand it to my engineering team.

## YOUR ROLE

You are a senior staff engineer performing a design review. Your job is to:

1. **Read the architecture plan** (`docs/HTML_TEMPLATE_TYPE_PLAN.md`) top to bottom
2. **Read my existing codebase files** (listed below) to understand the current system
3. **Read the Mirr reference material** (extracted JS chunks + API responses) to verify the plan's claims against the actual source
4. **Produce a gap analysis** covering:
   - Any **feature or UI flow** described in the Mirr reference that's missing from the plan
   - Any **technical detail** that's too vague for an engineer to implement without asking questions
   - Any **API contract** that's incomplete (missing fields, wrong types, ambiguous response shapes)
   - Any **state management edge case** not covered (race conditions, error states, partial failures)
   - Any **existing codebase integration point** that the plan fails to account for
   - Any **UI/UX flow** from start to finish that isn't explicitly documented (what does the user see at every step? what happens on error? what loading states exist?)
   - Any **database migration** issue (missing indexes, missing ON DELETE behavior, missing default values)
   - Any **security concern** (XSS via iframe, image proxying, HTML injection)
   - Any **deployment/infrastructure** concern (Vercel function limits, cold starts, bundle size)

## SPECIFIC QUESTIONS TO ANSWER

After your gap analysis, explicitly answer these questions:

### A. Process Flow Completeness
1. Walk through the **complete user journey** from "I want to create an HTML carousel" to "I have a downloaded ZIP of images." List every screen, modal, button click, loading state, and error state the user encounters. Flag anything the plan doesn't cover.
2. What happens when a user **switches** an existing regular/enhanced project to HTML type (or vice versa)? Is this even possible? Should it be blocked?
3. What happens when a user opens an HTML project that was **partially generated** (e.g., 3 of 6 slides completed before SSE dropped)?
4. How does the **auto-save** interact with the undo/redo system? If the user undoes past the last auto-save point, what's the expected behavior?

### B. UI Completeness
5. The plan describes a right sidebar with "Edit" and "AI Designer" tabs. What is the **exact content** of the AI Designer tab beyond quick-action chips and a text input? Does it show generation history? Per-slide vs all-slides toggle? Before/after comparison?
6. What does the **preset gallery** look like? Grid of cards? How many per row? What info is shown per preset (name, thumbnail, category, aspect ratio)? Is there filtering/search?
7. What does the **image search modal** look like when a user clicks an image slot? How many results? Pagination? Upload from device option? URL paste?
8. Where does the **caption editor** go in the HTML workspace layout? The plan says "reuse existing" but the existing caption is in `EditorBottomPanel` which is explicitly NOT shown for HTML type.

### C. Technical Completeness
9. The interaction script (§11) runs inside the iframe. How is it **versioned and cache-busted**? If we update the script, how do we ensure existing open tabs get the new version?
10. The plan says "AI-generated HTML has no JavaScript — we strip `<script>` tags before rendering." **Where exactly** does this stripping happen? In the SSE consumer? In the parser? In the document wrapper? What about `on*` event handlers in HTML attributes (e.g., `onclick`, `onerror`)?
11. The plan mentions `@sparticuz/chromium` for Puppeteer on Vercel. What is the **maximum HTML complexity** (DOM node count, external font count, image count) before this hits Vercel's 50MB function size limit or 60s timeout?
12. How are **Google Fonts loaded** in the Puppeteer rendering environment? The server has no browser cache. Does it download fonts on every render? Is there a warm font cache?
13. The element parser (§6b) uses `DOMParser` which runs in the **browser**. But the `render/route.ts` (server-side) also needs to strip editor attributes from HTML. Does the server also need a DOM parser? If so, which library (jsdom, linkedom, cheerio)?

### D. Mirr Reference Verification
14. List every file in `mirr-extracted/` and `mirr-extracted/api-responses/` and tell me what each one contains and whether it was referenced in the plan. Flag any file that contains relevant information NOT captured in the plan.
15. The plan references chunk `91738-214cfdb0a42f25ed.js` as the PageEditor. Verify this by reading it. Are there any features in that component that the plan doesn't cover?
16. Look at `saved_resource(8).html` in the Lazy Load files — this contains the actual iframe interaction script. Compare it against §11 and §6 in the plan. Is anything missing?

### E. Existing Codebase Conflicts
17. We've confirmed that `TemplateTypeId` is defined in `src/features/editor/store/types.ts` (client) AND referenced in `src/app/api/editor/_utils.ts` (server). The plan only mentions updating `_utils.ts`. **Enumerate every file that hardcodes `"regular" | "enhanced"` as a union type, a validation guard, a coercion fallback, or a localStorage default.** For each, state what change is needed. The scoping answers above list 40+ files — verify that list is complete and flag any the scoping answers missed.
18. Read `src/app/editor/EditorShell.tsx` — this is an 8,400-line file. How exactly should the branching work? Where in the file should the `if (templateTypeId === "html")` check go? What variables/hooks does it need access to at that point?
19. Read `src/app/api/editor/projects/create/route.ts` — what validation currently exists for `templateTypeId`? What exactly needs to change?
20. Are there any **shared hooks** (e.g., `useEditorBootstrap`, `useProjectLifecycle`, `useEditorPersistence`) that assume the project is Fabric.js-based and would break or behave unexpectedly for an HTML project?

## FILES TO UPLOAD

### The Plan (MUST READ FIRST)
- `docs/HTML_TEMPLATE_TYPE_PLAN.md`

### Existing Codebase — Files That Will Be Modified (plan lists 11, actual is 40+)
- `src/app/api/editor/_utils.ts`
- `src/app/editor/EditorShell.tsx`
- `src/features/editor/store/types.ts`
- `src/features/editor/store/editorStore.ts`
- `src/app/api/editor/projects/create/route.ts`
- `src/app/api/swipe-file/items/[id]/create-project/route.ts`
- `src/app/api/editor/ideas/create-carousel/route.ts`
- `src/app/api/carousel-map/[mapId]/create-project/route.ts`
- `src/features/editor/components/EditorSidebar.tsx`
- `src/features/editor/components/SwipeIdeasPickerModal.tsx`
- `src/features/editor/components/CarouselMapProjectPickerModal.tsx`
- `src/features/editor/components/IdeasModal.tsx`

### Existing Codebase — Files MISSING From Plan's Modification List (found via grep)
These files hardcode `"regular" | "enhanced"` coercion or reference `TemplateTypeId` in ways that will silently break for `"html"` projects. Upload these and flag them in your audit:
- `src/app/api/editor/initial-state/route.ts` — silently drops unknown templateTypeId to "regular"
- `src/app/api/editor/projects/set-template-type/route.ts` — rejects anything not "regular"/"enhanced"
- `src/features/editor/components/SwipeFileModal.tsx` — useState forces to "enhanced"/"regular"
- `src/features/editor/store/EditorStoreProvider.tsx` — defaults to "regular", "enhanced"
- `src/app/api/editor/projects/_effective.ts` — template type settings resolution
- `src/app/api/daily-digest/topics/[id]/create-carousel/route.ts` — hardcodes "regular"
- `src/features/editor/hooks/useEditorStoreActionsSync.ts`
- `src/features/editor/hooks/useLiveLayoutQueue.ts`
- `src/features/editor/hooks/useEditorJobs.ts`
- `src/app/api/editor/projects/jobs/start/route.ts`

### Existing Codebase — Files For Understanding Current Architecture
- `src/features/editor/hooks/useEditorBootstrap.ts`
- `src/features/editor/hooks/useProjectLifecycle.ts`
- `src/features/editor/hooks/useEditorPersistence.ts`
- `src/features/editor/hooks/useGenerateCopy.ts`
- `src/features/editor/hooks/useFabricCanvasBinding.ts`
- `src/features/editor/hooks/useCanvasExport.ts`
- `src/features/editor/hooks/useImageOps.ts`
- `src/features/editor/hooks/useAutoRealignOnImageRelease.ts`
- `src/features/editor/hooks/useEditorStoreWorkspaceRegistry.tsx`
- `src/features/editor/hooks/useGenerateAiImage.ts`
- `src/features/editor/hooks/useGenerateImagePrompts.ts`
- `src/features/editor/components/EditorBottomPanel.tsx`
- `src/features/editor/components/EditorSlidesRow.tsx`
- `src/features/editor/components/EditorTopBar.tsx`
- `src/features/editor/components/SwipeFileModal.tsx`
- `src/features/editor/components/SlideStyleModal.tsx`
- `src/features/editor/components/SavedProjectsCard.tsx`
- `src/features/editor/services/projectsApi.ts`
- `src/features/editor/services/slidesApi.ts`
- `src/app/api/editor/projects/jobs/generate-copy/route.ts`
- `src/app/api/editor/projects/load/route.ts`
- `src/app/api/editor/projects/list/route.ts`
- `src/app/api/editor/bootstrap/route.ts`
- `src/app/editor/page.tsx`

### Mirr Reference — Key Files (for verifying plan accuracy)
- `mirr-extracted/91738-214cfdb0a42f25ed.js` (PageEditor component — 165KB)
- `mirr-extracted/25317-27f2ac649f9b66ef.js` (Main app bundle)
- `mirr-extracted/27323-aaf2af6296e07104.js` (Preset creator, iframe preview renderer)
- `mirr-extracted/71812-b15114c407729339.js` (Font optimizer)
- `mirr-extracted/api-responses/POST_carousel-lab_generate-content-stream.json`
- `mirr-extracted/api-responses/POST_carousel-lab_match-template.json`
- `mirr-extracted/api-responses/POST_carousel-lab_refine-page.json`
- `mirr-extracted/api-responses/POST_carousel-lab_render-html.json`
- `mirr-extracted/api-responses/POST_carousel-lab_search-images.json`
- `mirr-extracted/api-responses/PATCH_carousel-lab_generations_16f69ef1-6b01-40ca-99e6-0c23e977a391.json`

### Mirr Reference — Iframe Interaction Script (the most critical reference)
- Look in the folder `Mirr (formerly Mirra) - Your AI Marketing Partner _ Plan, Create, Distribute, Manage (Lazy Load)_files/` for a file called `saved_resource(8).html` — this contains the complete injected iframe interaction script

### Database Context
- `supabase/migrations/` — scan all .sql files to understand existing schema (the plan adds new tables that must integrate with existing ones, particularly `carousel_projects` and `carousel_project_slides`)

## OUTPUT FORMAT

Structure your response as:

```
## 1. GAP ANALYSIS

### 1a. Missing Features / UI Flows
[List each gap with severity: CRITICAL / HIGH / MEDIUM / LOW]

### 1b. Technical Ambiguities
[List each with the section number in the plan it relates to]

### 1c. API Contract Issues
[List each with the endpoint]

### 1d. State Management Edge Cases
[List each]

### 1e. Existing Codebase Conflicts
[List each with file path]

### 1f. Database / Migration Issues
[List each]

### 1g. Security Concerns
[List each]

### 1h. Deployment Concerns
[List each]

## 2. ANSWERS TO SPECIFIC QUESTIONS
[Answer each of A1-E20 individually]

## 3. MIRR REFERENCE FILE INVENTORY
[For each file in mirr-extracted/ and mirr-extracted/api-responses/:
  - Filename
  - What it contains (1 sentence)
  - Whether the plan references it (Y/N)
  - Any information in the file NOT captured in the plan]

## 4. RECOMMENDED PLAN AMENDMENTS
[Numbered list of specific changes to make to HTML_TEMPLATE_TYPE_PLAN.md,
 with exact section numbers and proposed text where applicable]

## 5. QUESTIONS FOR THE TEAM
[Any remaining ambiguities that require human decision-making,
 not just technical investigation]
```

## IMPORTANT INSTRUCTIONS

- Do NOT skim the plan. Read every section, every code block, every table row.
- Do NOT assume the plan is correct. Verify claims against the actual Mirr source code.
- Do NOT be polite about gaps. If something is missing, say so directly with severity.
- Do NOT suggest alternatives or improvements to the architecture. Just flag what's missing or wrong in the current plan. We'll iterate after.
- When you reference a file, use its exact path.
- When you reference a section of the plan, use its section number (e.g., §6b, §7a).
- If a file is too large to read fully, say so and note what you were able to verify.
