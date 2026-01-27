# Editor “Generate Ideas” Feature — Phased Implementation Plan

This document is the **single source of truth** for the `/editor` **Generate Ideas** feature: requirements, architecture, phased rollout, and test plans.

## Goal

Add a **Generate Ideas** workflow to `/editor` that:

- Generates **8 topic ideas** from whatever content is currently available in **Poppy’s knowledge base**
- Lets the user **approve/dismiss** ideas and maintain an **approved queue**
- Lets the user create **new carousel projects from approved topics** in the background
- Keeps the **Ideas modal open** while background work runs
- Preserves **auditability** by tagging ideas with a manually entered **Source Title + Source URL**

## Non-goals

- Do **not** modify the existing **Generate Copy** feature behavior (`POST /api/editor/projects/jobs/generate-copy`)
- Do **not** require managing Poppy’s KB links inside this app (user continues swapping source links inside Poppy)

## UX Placement

- Add a new entry point **in the left sidebar**, under the **Colors** section: **“Generate Ideas”**
- Clicking opens a modal with the same shell UX as `ImageLibraryModal`:
  - Backdrop click closes (only when clicking true backdrop)
  - `Esc` closes
  - Close “✕” button

## Core User Flow

### Generate Ideas

1. User opens Ideas modal.
2. User enters:
   - **Source Title** (human readable)
   - **Source URL** (the link associated with what’s currently in Poppy)
3. User clicks **Generate Ideas**.
4. App calls Poppy using the user’s existing `editor_users.poppy_conversation_url` with an **Ideas Prompt** (editable per user).
5. App enforces **strict JSON** by using the same approach as Generate Copy:
   - Poppy returns raw text
   - Anthropic is used to restructure into a strict JSON schema
   - Server validates the JSON payload
6. Ideas are persisted and displayed in the modal, grouped under that Source.

### Review + Queue

- Each idea can be:
  - **Approve** → enters “Approved Queue”
  - **Dismiss** → persists as dismissed (hidden by default; can show via “Show dismissed” toggle)
- The Approved Queue supports:
  - **Remove from queue** (persisted)
- Dedupe rule: **keep duplicates** (even same title under same source)

### Create Carousel from Topic

From an approved topic:

1. User selects **template type** (Enhanced/Regular) (no need to pick a specific template).
2. User clicks **Create carousel**.
3. Server:
   - Creates a new project:
     - `title` = topic title
     - `template_type_id` = selected
     - uses template-type defaults for templates (same behavior as project create)
   - **Overwrites the project’s `prompt_snapshot`** to the **fully injected prompt** used for generation
   - Starts a new job (`job_type` e.g. `topic-copy`)
   - Generates copy + caption and saves to slides
   - If Enhanced: auto-runs **Generate Image Prompts** (same behavior as existing Generate Copy)
4. Client:
   - **Keeps Ideas modal open**
   - Shows per-topic progress with the same “step label” style as Generate Copy
   - **Switches the editor to the latest created project** (even if multiple are kicked off)

## Prompts

### Ideas Prompt (editable, per-user)

- Stored on `editor_users.ideas_prompt_override` (global per user).
- Editable at top of Ideas modal (auto-save).
- Supports placeholder variables:
  - `{{sourceTitle}}`
  - `{{sourceUrl}}`
  - `{{topicCount}}`
  - `{{audience}}` (v1 hardcoded to `"business owners"`)

Suggested starting default (editable):

> Review the social media post(s) in your knowledge base and extract {{topicCount}} topic ideas that would be interesting to an audience of {{audience}}. Return structured output that can be converted to JSON.

### Prompt persistence per run (audit)

Store `prompt_rendered` (after placeholder substitution) for:

- Each **Ideas run**
- Each **Create Carousel run**

## Data model (Supabase)

We will add new tables (owner-scoped via RLS):

### `editor_idea_sources`

- `id` (uuid, pk)
- `owner_user_id` (uuid)
- `source_title` (text)
- `source_url` (text)
- `last_generated_at` (timestamp)
- `created_at`, `updated_at`

Identity rule: **reuse** the existing source group when `source_title + source_url` matches.

### `editor_idea_runs`

Tracks “Generate Ideas” runs.

- `id` (uuid, pk)
- `owner_user_id` (uuid)
- `source_id` (uuid, fk)
- `status` (text: `running|completed|failed`)
- `error` (text, nullable)
- `prompt_rendered` (text)
- `poppy_routing_meta` (jsonb: board/chat/model)
- `created_at`, `finished_at`

### `editor_ideas`

- `id` (uuid, pk)
- `owner_user_id` (uuid)
- `source_id` (uuid, fk)
- `run_id` (uuid, fk)
- `title` (text)
- `bullets` (jsonb)
  - shape: `[{ "heading": string, "points": string[] }]`
- `status` (text: `pending|approved|dismissed`)
- `approved_sort_index` (int, nullable)
- `created_at`, `updated_at`

### Job tracking for carousel creation

Reuse `carousel_generation_jobs` with a new `job_type` (e.g. `topic-copy`) for status polling, and store:

- progress via the existing “error field reuse” convention: `error="progress:poppy"`, `progress:parse`, `progress:save`, etc.

### `editor_idea_carousel_runs` (audit)

Stores an audit trail of “Create carousel from idea”:

- idea/source/project linkage
- `prompt_rendered` (the injected prompt written into `carousel_projects.prompt_snapshot`)
- `poppy_routing_meta`

## API Routes (planned)

All routes use editor auth (`getAuthedSupabase`) and require `Authorization: Bearer <token>` (same as other editor APIs).

### Ideas: read

- `GET /api/editor/ideas/sources`
  - Returns sources grouped by Source Title, newest first
  - Includes topics under each source
  - Supports `includeDismissed=true|false`

### Ideas: generate

- `POST /api/editor/ideas/generate`
  - Body: `{ sourceTitle, sourceUrl, topicCount: 8 }`
  - Uses `editor_users.poppy_conversation_url`
  - Uses `editor_users.ideas_prompt_override` (or default)
  - Stores `prompt_rendered`, `poppy_routing_meta`
  - Persists `editor_idea_runs` + `editor_ideas`

### Ideas: update

- `POST /api/editor/ideas/update`
  - Approve / dismiss / reorder queue (persisted)

### Create carousel from idea

- `POST /api/editor/ideas/create-carousel`
  - Body: `{ ideaId, templateTypeId }`
  - Creates a new project, sets title, overwrites prompt_snapshot with injected prompt
  - Starts a new job (`job_type="topic-copy"`)
  - Saves slides/caption
  - If Enhanced: triggers image prompt generation

### Delete source

- `POST /api/editor/ideas/sources/delete`
  - Deletes a single source row (and cascades runs/ideas via FK)

### Created marker lookup (Approved Queue indicator)

- `GET /api/editor/ideas/carousel-runs?ideaIds=...`
  - Returns `{ createdByIdeaId: { [ideaId]: { projectId, createdAt } } }`

## UI components/state (planned)

### Sidebar entry

- `src/features/editor/components/EditorSidebar.tsx`
  - Add “Generate Ideas” button under Colors

### Modal

- New component: `src/features/editor/components/IdeasModal.tsx`
  - Reads `ideasModalOpen` from store
  - Calls `state.actions.*` for:
    - opening/closing
    - fetching sources/ideas
    - generate ideas
    - approve/dismiss/reorder
    - create carousel
  - Includes:
    - Ideas Prompt editor in header
    - Source Title + Source URL inputs (+ “Use last source”)
    - Grouped sources list
    - Topic cards + approve/dismiss
    - Approved queue + remove
    - “Created?” indicator (✅/⬜) for approved ideas
    - Per-run status lines + Retry buttons
    - “Show dismissed” toggle

### UX: “fresh modal” behavior

On each modal open, reset transient UI state:
- clear Source Title/URL fields (no implicit auto-prefill)
- clear transient status/error banners
- keep Ideas Prompt persisted (per-user)

### Store + actions

- Extend editor store:
  - `ideasModalOpen`
  - `ideasLastSourceTitle`, `ideasLastSourceUrl`
  - optional: `ideasPromptDraft` / `ideasPromptSaveStatus` (or fetch on open + autosave)
- Extend stable actions (`useEditorStoreActionsSync`) to expose modal actions safely without closure staleness.

### Debug panel

- Log:
  - idea runs start/finish/fail
  - poppy routing meta
  - create-carousel run ids + project ids

## Concurrency

- Users can create multiple carousels concurrently from different topics.
- The editor should always switch to the **latest created project**.
- The modal shows per-topic progress independently.

## Phased rollout plan (conservative)

Each phase ends with a hard stop for approval before moving on.

### Phase 0 — DB + server plumbing (no UI)

**Deliverables**
- Supabase migrations:
  - `editor_users.ideas_prompt_override`
  - new tables: `editor_idea_sources`, `editor_idea_runs`, `editor_ideas` (+ RLS)
- Server routes:
  - `GET /api/editor/ideas/sources`
  - `POST /api/editor/ideas/generate`
  - `POST /api/editor/ideas/update`

**Test plan**
- Use API calls to:
  - create/reuse source group by same title+url
  - generate exactly 8 ideas
  - verify strict JSON validation and failure handling (run marked failed)
  - verify `prompt_rendered` and `poppy_routing_meta` persisted
  - verify RLS isolation

**Approval gate**: user approves Phase 1.

### Phase 1 — Modal shell + read-only browsing

**Deliverables**
- Sidebar button opens modal
- Modal loads and displays grouped sources/ideas (read-only)
- Show dismissed toggle (read-only)

**Test plan**
- Open/close UX (backdrop/esc/✕)
- Rendering and grouping are correct
- No regressions to existing editor modals/features

**Approval gate**: user approves Phase 2.

### Phase 2 — Generate Ideas from UI + Ideas Prompt editor

**Deliverables**
- Add Ideas Prompt editor (autosave per user)
- Placeholder substitution support
- Source validation + “Use last source”
- Status line: “Generating → Parsing → Saved”
- Retry per failed run

**Test plan**
- Generate ideas from UI; verify persistence + grouping + duplicates
- Verify prompt override persists per user
- Verify step/status + retry works
- Verify debug logs show routing + run ids

**Approval gate**: user approves Phase 3.

### Phase 3 — Approve/dismiss + approved queue

**Deliverables**
- Persisted approve/dismiss
- Approved queue reorder + remove
- “Show dismissed” reveals hidden ideas

**Test plan**
- Approve/reorder persists across refresh
- Dismiss persists and is hidden by default
- Remove from queue behaves as designed (confirm status transition)

**Approval gate**: user approves Phase 4.

### Phase 4 — Create carousel from topic (background jobs; modal stays open)

**Deliverables**
- Create carousel per topic:
  - new project created
  - project title = topic title
  - project prompt_snapshot overwritten with injected prompt
  - job progress tracked
  - Enhanced triggers image prompts
- Modal stays open, shows per-topic progress + retry
- Editor switches to newest created project

**Test plan**
- Kick off multiple carousels concurrently
- Confirm editor switches to latest project
- Confirm slides/caption saved + visible
- Enhanced: image prompts generated automatically
- Prompt editor shows injected prompt_snapshot
- Debug logs show routing/meta/job ids

**Approval gate**: user approves Phase 5.

### Phase 5 — Hardening + docs

**Deliverables**
- Update `docs/EDITOR_CODEBASE_MAP.md` with new ownership/files/APIs
- Manual QA checklist for this feature
- Build + smoke checks

## Open questions (none at time of writing)

All major decisions were agreed:

- concurrency: allowed
- auto-switch: newest created project
- enhanced: auto-generate image prompts
- prompt: global per user; placeholder variables enabled
- dismissal: persisted; hidden by default; show dismissed toggle
- duplicates: allowed

