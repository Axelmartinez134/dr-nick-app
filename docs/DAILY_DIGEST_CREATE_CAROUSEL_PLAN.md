# Daily Digest → Create Carousel: Implementation Plan

## Background

The Daily Digest produces structured topic cards (`title`, `what_it_is`, `why_it_matters`, `carousel_angle`) from YouTube video transcripts. Today the `Create carousel` button on each topic is grayed out. This plan wires it up so pressing the button creates a carousel project, populates it with AI-generated slide copy, and opens it on the canvas.

This plan also introduces a built-in Auto mode for the Daily Digest flow only. In v1, this does **not** change Carousel Map or Generate Ideas. Those flows continue to require a saved prompt as they do today.

---

## Decisions (already aligned with user)

| Decision | Answer |
|----------|--------|
| Primary UX | One-click direct project creation from a topic |
| Secondary UX | Option D menu (Explore angles / Build carousel map) deferred to v2 |
| Template type | Always `regular` for Daily Digest |
| Prompt selection | v1 always uses built-in Auto; no prompt picker UI |
| Brand voice | Always injected for digest-generated carousels |
| Built-in expansion instruction | Injected by `generate-copy` when a digest topic snapshot is present |
| `prompt_snapshot` for Auto | Store `NULL` |
| Prompt composition ownership | `generate-copy` is the single source of truth |
| Swipe item link | Create or reuse a `swipe_file_items` row so transcript is available to `generate-copy` |
| Swipe item dedupe | `canonicalizeYoutubeWatchUrl(url) + account_id` |
| Existing swipe item updates | Fill gaps only; never clobber non-empty fields |
| Multiple carousels, same video | 1 swipe item per video, N projects linked to it |
| `created_project_id` on swipe item | Never touched by Daily Digest flow |
| Project title | Topic title, truncated to 120 chars |
| Canvas handoff | Close Swipe File modal, load project, auto-fire `generate-copy` |

---

## Architecture overview

```text
User clicks "Create carousel" on a Daily Digest topic
  │
  ├─ 1. POST /api/daily-digest/topics/[id]/create-carousel
  │     ├─ Canonicalize YouTube URL
  │     ├─ Verify transcript is available
  │     ├─ Find or create swipe_file_items row for the source YouTube video
  │     ├─ Create carousel_projects row with:
  │     │   ├─ title = topic title
  │     │   ├─ source_swipe_item_id = linked swipe item
  │     │   ├─ prompt_snapshot = saved prompt text or NULL for Auto
  │     │   ├─ source_digest_topic_snapshot = formatted topic-context string
  │     │   ├─ template_type_id = 'regular'
  │     │   └─ slide template snapshots from effective settings
  │     ├─ Create 6 empty carousel_project_slides rows
  │     └─ Return { projectId }
  │
  ├─ 2. UI: close Swipe File modal, load project on canvas
  │
  └─ 3. Auto-fire generate-copy (existing pipeline)
        ├─ Detects source_swipe_item_id → loads transcript from swipe item
        ├─ Detects source_digest_topic_snapshot → injects topic context
        ├─ Injects brand voice
        ├─ Injects optional style prompt only when one was explicitly chosen
        ├─ Injects built-in expansion instruction
        └─ Claude generates 6 slides + caption → persists → canvas renders
```

---

## Files to create

### 1. `src/app/api/daily-digest/topics/[id]/create-carousel/route.ts` (NEW)

**Purpose**: API endpoint that takes a Daily Digest topic ID and creates a carousel project.

**Body shape**:

```ts
{ savedPromptId?: string }
```

`savedPromptId` is optional. If absent or empty, the flow uses Auto.

**Steps**:
1. Authenticate user via `getAuthedDailyDigestContext`.
2. Load the topic row from `daily_digest_topics` scoped to the authed user + account.
3. Load the parent `daily_digest_videos` row for transcript, canonical source metadata, and summary context.
4. Canonicalize `daily_digest_videos.youtube_video_url` using `canonicalizeYoutubeWatchUrl(...)`.
5. Check transcript availability **before** creating anything:
   - If an existing matching swipe item already has a non-empty transcript, proceed.
   - Else if the digest video has a non-empty `raw_transcript`, proceed and use it to seed or backfill the swipe item.
   - Else return `400` with a clear error like `No transcript available for this video. Cannot create carousel.` and create nothing.
6. Find or create the linked swipe item by querying `swipe_file_items` with:
   - `account_id = account_id`
   - `url = canonicalized_youtube_watch_url`
7. If no matching swipe item exists, insert one with:
   - `account_id`, `created_by_user_id`
   - `url` = canonicalized YouTube watch URL
   - `platform` = `'youtube'`
   - `status` = `'new'`
   - `category_id` = first category for the account ordered by `created_at ASC`, or `null` if no categories exist
   - `title` = video title
   - `transcript` = digest video `raw_transcript`
   - `caption` = digest video summary
   - `enrich_status` = `'ok'`
   - `thumb_url` = digest video thumbnail
   - `author_handle` = digest video creator name
8. If a matching swipe item already exists, fill gaps only:
   - update `transcript` only if existing value is blank/null
   - update `caption` only if existing value is blank/null
   - update `thumb_url` only if existing value is blank/null
   - update `title` only if existing value is blank/null
   - update `author_handle` only if existing value is blank/null
   - never overwrite a non-empty field
   - never change `enrich_status`
   - never change `created_project_id`
9. Load effective template type settings for `'regular'`.
10. Load saved prompt text only if `savedPromptId` is present. If absent/empty, store `prompt_snapshot = NULL`.
11. Build `source_digest_topic_snapshot` using the canonical formatted string described below.
12. Insert `carousel_projects` row with:
   - `title` = topic title truncated to 120 chars
   - `template_type_id = 'regular'`
   - `prompt_snapshot` = saved prompt text or `NULL`
   - `source_swipe_item_id`
   - `source_digest_topic_snapshot`
   - effective slide template snapshots
13. Insert 6 empty `carousel_project_slides` rows.
14. Return `{ success: true, projectId }`.

**Key detail**: The create route is intentionally thin. It stores source context and any explicitly chosen saved prompt text, but it does **not** pre-compose the final generation prompt. `generate-copy` is the single source of truth for prompt composition.

---

## Files to modify

### 2. `supabase/migrations/20260403_000002_add_digest_carousel_columns.sql` (NEW migration)

Add one nullable column to `carousel_projects`:

```sql
ALTER TABLE public.carousel_projects
  ADD COLUMN IF NOT EXISTS source_digest_topic_snapshot text;
```

This stores the Daily Digest topic context snapshot as a formatted string, following the same pattern as `source_swipe_idea_snapshot` and `source_carousel_map_expansion_snapshot`.

No other schema changes are needed.

---

### 3. `src/app/api/editor/projects/jobs/generate-copy/route.ts`

**What changes**:

A. **Read the new column**: Add `source_digest_topic_snapshot` to the project SELECT query.

B. **Detect Daily Digest origin**: After reading the existing swipe/map snapshots, also read:

```ts
const digestTopicSnapshot = String((project as any)?.source_digest_topic_snapshot || '').trim();
```

C. **Digest branch trigger**: Add a new highest-priority swipe-origin branch that only fires when:
- `source_swipe_item_id` is non-empty, and
- `source_digest_topic_snapshot` is non-empty

D. **Compose prompt for digest origin**:

When `prompt_snapshot` is non-empty, compose:

```ts
[
  `BRAND_VOICE:\n${brandVoiceRaw}`,
  ``,
  `STYLE_PROMPT:\n${stylePromptRaw}`,
  ``,
  `DIGEST_TOPIC_CONTEXT:\n${digestTopicSnapshot}`,
  ``,
  `SOURCE_EXPANSION_INSTRUCTION:\n${DIGEST_CAROUSEL_EXPANSION_INSTRUCTION}`,
]
  .filter(Boolean)
  .join('\n')
```

When `prompt_snapshot` is `NULL` or empty, omit the `STYLE_PROMPT:` section entirely and compose:

```ts
[
  `BRAND_VOICE:\n${brandVoiceRaw}`,
  ``,
  `DIGEST_TOPIC_CONTEXT:\n${digestTopicSnapshot}`,
  ``,
  `SOURCE_EXPANSION_INSTRUCTION:\n${DIGEST_CAROUSEL_EXPANSION_INSTRUCTION}`,
]
  .filter(Boolean)
  .join('\n')
```

This branch intentionally differs from the existing swipe/map/idea branches because Daily Digest carousels are for the user's own audience and should always include brand voice.

E. **"Auto" handling**: `prompt_snapshot = NULL` is the canonical Auto signal for this flow. The create route does not compose anything. `generate-copy` composes the final prompt at runtime.

**Risk assessment**: Low. This is a new branch in an existing if/else chain. Existing swipe/map/idea behavior is untouched. The new branch only fires when both the digest snapshot and swipe item id are present.

---

### 4. `src/features/editor/components/DailyDigestPanel.tsx`

**What changes**:

A. **Accept a single editor handoff callback**: The panel receives one prop:

```ts
onCreateCarousel(projectId: string): void
```

`DailyDigestPanel` does not need to know about modal close, project load, or generate-copy internals.

B. **Wire up `Create carousel` button**: Replace the disabled button with an active one. On click:
1. Call `POST /api/daily-digest/topics/[topicId]/create-carousel`.
2. On success, call `onCreateCarousel(projectId)`.

C. **V1 UX is fixed**:
- no confirmation dialog
- no prompt picker dropdown
- always `regular`
- always Auto
- request body omits `savedPromptId`

---

### 5. `src/features/editor/components/SwipeFileModal.tsx`

**What changes**:

A. **Pass callback to `DailyDigestPanel`**:

```tsx
<DailyDigestPanel
  onCreateCarousel={(projectId: string) => {
    pendingAutoGenerateProjectIdRef.current = projectId;
    actions.onCloseSwipeFileModal?.();
    actions.onLoadProject?.(String(projectId));
  }}
/>
```

B. **No other changes**. The existing `pendingAutoGenerateProjectIdRef` + `onClickGenerateCopy` auto-fire pattern handles the rest once the project is loaded.

---

## Built-in expansion instruction (canonical text)

This is the instruction injected by `generate-copy` when it detects a Daily Digest topic snapshot:

```text
You have been given structured guidance for what each slide should cover. This guidance is creative direction, not final copy. Your job is to write polished, concise carousel text that captures the essence of each point.

Rules:
- Each slide body should be a complete, standalone thought.
- Aim for roughly 100-240 characters per slide body. Shorter is better if the point lands.
- Do not copy the guidance verbatim. Rewrite it in natural, conversational language.
- The topic title should inform slide 1's text (hook/opening).
- The carousel angle (if provided) should inform the overall narrative arc.
- Frame content for someone scrolling on their phone - every word must earn its place.
```

This text should live in exactly one place as `DIGEST_CAROUSEL_EXPANSION_INSTRUCTION` exported from `src/app/api/daily-digest/_utils.ts`. Both the create-carousel route and `generate-copy` import from there.

---

## Digest topic snapshot format

Stored on `carousel_projects.source_digest_topic_snapshot` as a formatted string:

```text
TOPIC_TITLE:
{title}

WHAT_IT_IS:
{what_it_is}

WHY_IT_MATTERS:
{why_it_matters}

CAROUSEL_ANGLE:
{carousel_angle}

SOURCE_VIDEO_SUMMARY:
{summary from parent video}

SOURCE_CREATOR:
{creator_name}

SOURCE_VIDEO_TITLE:
{video_title}
```

Rules:
- each section header is on its own line
- the value is on the next line
- include a blank line between sections
- if a value is empty/null, still include the header with an empty value line

This gives `generate-copy` rich context about what the carousel should cover, who the source creator is, and what the video was about without requiring any parsing logic.

---

## Implementation order

### Phase 1: Schema + API
1. Add migration for `source_digest_topic_snapshot`.
2. Create `POST /api/daily-digest/topics/[id]/create-carousel`.
3. Update `generate-copy` to read the new column and inject the digest branch.
4. Test manually:
   - create route fails cleanly if no transcript is available
   - create route reuses swipe item by canonicalized URL
   - existing swipe item metadata is only gap-filled
   - project title = topic title
   - `prompt_snapshot = NULL` for Auto
   - `created_project_id` on swipe item remains untouched
5. Call `generate-copy` and verify slide output.

### Phase 2: UI wiring
6. Update `DailyDigestPanel` to accept `onCreateCarousel`.
7. Update `SwipeFileModal` to pass the callback with the standard auto-generate pattern.
8. Wire the `Create carousel` button to call the API and trigger the handoff.
9. Test end-to-end:
   - click button
   - modal closes
   - project loads
   - generate-copy auto-fires
   - slides appear

### Phase 3: Polish + docs
10. Run `npm run build` and `ReadLints`.
11. Fix any issues.
12. Update `docs/EDITOR_CODEBASE_MAP.md` with the new route and flow.

---

## What is NOT in scope (v2)

- Option D menu: Explore angles / Build carousel map secondary actions
- Prompt picker dropdown on the `Create carousel` button
- Auto option in `SwipeIdeasPickerModal`
- Expansion instruction injection for Carousel Map and Ideas paths
- Any broader change to how non-Daily-Digest structured-source flows choose prompts

---

## Risk assessment

| Risk | Mitigation |
|------|-----------|
| New `generate-copy` branch breaks existing flows | Branch only fires when both `source_digest_topic_snapshot` and `source_swipe_item_id` are non-empty. Existing projects have `NULL`. |
| Swipe item duplication | Lookup by canonicalized YouTube watch URL + `account_id` before insert. |
| Swipe item missing category | Query first category for account. If none exists, insert with `category_id = null`. |
| Existing swipe item has partial metadata | Fill gaps only; never overwrite existing non-empty fields. |
| Missing transcript creates orphaned project | Guard in create route: fail early and create nothing if neither swipe item nor digest video has a usable transcript. |
| Long transcript in swipe item | Transcript is already stored on `daily_digest_videos.raw_transcript`. Same size constraints as existing YouTube enrichment. |
| `generate-copy` prompt too long | Topic snapshot is small relative to the transcript, and the reel/Claude path already handles transcript-sized inputs. |

---

## Questions resolved during dry run

1. **How does `DailyDigestPanel` hand off to the editor?** -> Single `onCreateCarousel(projectId)` prop from `SwipeFileModal`.
2. **Does `generate-copy` remain the prompt composer?** -> Yes. The create route stores source context; `generate-copy` composes the final prompt at runtime.
3. **What does `prompt_snapshot` store for this path?** -> Saved prompt text when explicitly provided; otherwise `NULL` for Auto.
4. **What column stores topic context on the project?** -> New `source_digest_topic_snapshot` string column.
5. **How does the auto-fire work after modal close?** -> Existing `pendingAutoGenerateProjectIdRef` pattern in `SwipeFileModal`.
6. **What if the swipe item already exists but has no transcript?** -> Backfill transcript from `daily_digest_videos.raw_transcript`, but only if the existing transcript is blank.
7. **What if no transcript exists anywhere?** -> Fail immediately and create nothing.
8. **Should Daily Digest touch `created_project_id` on the swipe item?** -> No.

---

# Phase 2: Carousel Map & Explore Ideas from Daily Digest Topics

## Background

Phase 1 shipped the one-click "Quick Create" carousel button on Daily Digest topics. Phase 2 adds two additional carousel construction paths accessible from the same button: **Carousel Map** and **Explore Ideas**. These give the user more creative control when they want to develop a topic more thoroughly before generating slide copy.

### Core architectural risk

The existing Carousel Map and Swipe Ideas systems are keyed to the **swipe item**, not to any specific topic. If one YouTube video yields 4 Daily Digest topics, naive swipe-item-scoped reuse would create collisions: all 4 topics would share the same map and the same ideas thread. Phase 2 solves this with **topic-scoped isolation** via new linkage columns.

---

## Decisions (all resolved)

| Decision | Answer |
|----------|--------|
| Available paths | Quick Create (primary, one-click), Carousel Map (secondary), Explore Ideas (secondary) |
| UI shape | Split button: main area = Quick Create, chevron = dropdown with Carousel Map and Explore Ideas |
| Inline compact label | `[ Create \| ▾ ]` in topic card rows; `[ Create carousel \| ▾ ]` in the right detail panel |
| Prompt handling for Map/Ideas | Interpretation C: no code changes to prompt pickers. User creates a saved prompt themselves and selects it manually. |
| Swipe item creation | Same create-or-reuse logic as Quick Create, via shared server helper. Handled inside bootstrap routes, not a standalone endpoint. |
| Modal layering | Keep Swipe File modal open. Map/Ideas modals open on top (consistent with existing behavior). |
| Modal ownership | `SwipeFileModal` owns bootstrap API calls, modal open/close, and project handoff. `DailyDigestPanel` is a trigger surface only. |
| Canvas handoff | Same for all three paths: close everything, load project on canvas, auto-fire generate-copy. |
| Topic isolation | New `source_digest_topic_id` columns on `carousel_maps`, `swipe_file_idea_threads`, and `swipe_file_ideas`. One session and one saved-ideas pool per digest topic, not per swipe item. |
| Carousel Map pre-fill | Server-side bootstrap: create the topic-scoped map if missing, create the single locked topic row if missing, and set `selected_topic_id` only for first-time bootstrap or repair. Reopen preserves progress. Modal loads the already-bootstrapped graph and starts from opening pairs. Topics lane is shown with one locked topic, no generation action. |
| Ideas Chat pre-fill | `initialDraft` applied only when thread is empty. No auto-send. Server-side digest topic context injected alongside swipe context in every prompt build. |
| Carousel angle handling | Not crammed into map topic rows. Kept as separate digest context injected into map prompt builders (opening-pairs, expansions) when the map is digest-origin. |
| Saved ideas scoping | Digest-origin saved ideas are topic-scoped, not swipe-item-scoped. Picker only shows ideas for the current `source_digest_topic_id`. |
| Ideas-to-picker transition | Digest-origin Ideas Chat includes an in-modal button that hands off to `SwipeFileModal`, which opens `SwipeIdeasPickerModal` for the same digest topic. |
| Ideas modal topic visibility | Show a locked digest-topic context banner near the top of `SwipeIdeasChatModal` on every open. |
| Angle / Notes in digest Ideas | Do not show the shared swipe-item Angle / Notes editor for digest-origin Ideas Chat. The digest topic banner is the grounding context. |
| `created_project_id` on swipe item | Never update it for digest-origin Quick Create, Carousel Map, or Explore Ideas project creation. |
| Reopening existing sessions | Preserve progress. No stale-clearing. Repair-style clearing only if stored state is malformed. |
| Standalone ensure-swipe-item endpoint | Not needed. Bootstrap routes handle swipe item creation internally. |
| Superadmin-only | Yes, same as the rest of Daily Digest. |

---

## Data model changes

### New columns

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `carousel_maps` | `source_digest_topic_id` | `uuid null` | Links a map session to a specific Daily Digest topic |
| `swipe_file_idea_threads` | `source_digest_topic_id` | `uuid null` | Links an ideas thread to a specific Daily Digest topic |
| `swipe_file_ideas` | `source_digest_topic_id` | `uuid null` | Durable saved-idea linkage to a specific Daily Digest topic so topic scoping survives thread reset/delete |

All three digest-origin linkage columns reference `public.daily_digest_topics(id)` with `ON DELETE CASCADE`. If the digest topic is deleted, its topic-scoped map, thread, and saved ideas should be deleted with it.

### Uniqueness index changes

**`carousel_maps`**: Drop the current unique index on `(account_id, swipe_item_id)`. Replace with two partial unique indexes:

```sql
-- Normal Swipe File flows (no digest topic)
CREATE UNIQUE INDEX carousel_maps_account_item_normal_uidx
  ON public.carousel_maps (account_id, swipe_item_id)
  WHERE source_digest_topic_id IS NULL;

-- Digest-origin flows (one map per digest topic)
CREATE UNIQUE INDEX carousel_maps_account_digest_topic_uidx
  ON public.carousel_maps (account_id, source_digest_topic_id)
  WHERE source_digest_topic_id IS NOT NULL;
```

**`swipe_file_idea_threads`**: Drop the current unique index on `(account_id, swipe_item_id, chat_mode)`. Replace with two partial unique indexes:

```sql
-- Normal Swipe File flows (no digest topic)
CREATE UNIQUE INDEX swipe_file_idea_threads_account_item_mode_normal_uidx
  ON public.swipe_file_idea_threads (account_id, swipe_item_id, chat_mode)
  WHERE source_digest_topic_id IS NULL;

-- Digest-origin flows (one thread per digest topic + mode)
CREATE UNIQUE INDEX swipe_file_idea_threads_account_digest_topic_mode_uidx
  ON public.swipe_file_idea_threads (account_id, source_digest_topic_id, chat_mode)
  WHERE source_digest_topic_id IS NOT NULL;
```

Normal Swipe File flows keep `source_digest_topic_id = NULL` and are unaffected.

---

## Carousel Map topic row mapping

When the bootstrap route creates a topic row for a digest-origin map, the column mapping is:

| `carousel_map_topics` column | Source |
|------------------------------|--------|
| `title` | `daily_digest_topics.title` |
| `summary` | `daily_digest_topics.what_it_is` |
| `why_it_matters` | `daily_digest_topics.why_it_matters` |
| `sort_order` | `0` |
| `source_generation_key` | A fresh UUID for the bootstrap insertion |

`carousel_angle` does **not** map to any map topic column. It is kept as a separate source of truth. When the map is digest-origin, the prompt builders for opening-pairs and expansions load the digest topic row by `source_digest_topic_id` and inject `carousel_angle` as a separate `DIGEST_TOPIC_CONTEXT` block in the AI prompts.

---

## Architecture overview

```text
User clicks dropdown chevron on "Create carousel" button
  │
  ├─ Option: "Carousel Map"
  │   ├─ 1. DailyDigestPanel emits onOpenDigestCarouselMap(topicPayload)
  │   ├─ 2. SwipeFileModal calls POST /api/daily-digest/topics/[id]/carousel-map/bootstrap
  │   │     ├─ Shared helper: ensure/reuse swipe item
  │   │     ├─ Ensure/reuse topic-scoped carousel_maps row
  │   │     ├─ Create the single locked topic row only if missing
  │   │     ├─ Set `selected_topic_id` only for first-time bootstrap or repair
  │   │     └─ Return { mapId }
  │   ├─ 3. SwipeFileModal opens CarouselMapModal with mapId
  │   │     ├─ Modal loads already-bootstrapped graph
  │   │     ├─ Topics lane shows one locked topic, no generation action
  │   │     └─ User starts from opening pair generation
  │   └─ 4. User completes flow → create project → close everything → load canvas → auto-fire generate-copy
  │
  └─ Option: "Explore Ideas"
      ├─ 1. DailyDigestPanel emits onOpenDigestIdeas(topicPayload)
      ├─ 2. SwipeFileModal calls POST /api/daily-digest/topics/[id]/ideas/bootstrap
      │     ├─ Shared helper: ensure/reuse swipe item
      │     ├─ Ensure/reuse topic-scoped idea thread
      │     └─ Return { swipeItemId, sourceDigestTopicId, initialDraft }
      ├─ 3. SwipeFileModal opens SwipeIdeasChatModal with those values
      │     ├─ Locked digest-topic banner shows the chosen topic context
      │     ├─ Composer pre-filled with initialDraft only if thread is empty
      │     ├─ No auto-send; user clicks Send
      │     ├─ Angle / Notes editor is hidden for digest-origin flow
      │     └─ Server-side digest topic context injected in every prompt build
      └─ 4. User chats → saves idea → clicks "Pick idea & create carousel" → topic-scoped picker opens → create project → close everything → load canvas → auto-fire generate-copy
```

---

## Exact flow: Carousel Map from Daily Digest

1. User clicks split-button chevron and chooses "Carousel Map."
2. `DailyDigestPanel` emits `onOpenDigestCarouselMap(topicPayload)`.
3. `SwipeFileModal` receives the payload, calls `POST /api/daily-digest/topics/[topicId]/carousel-map/bootstrap`.
4. Server ensures swipe item (shared helper), ensures/reuses a topic-scoped `carousel_maps` row, creates the single locked topic row only if missing, sets `selected_topic_id` only for first-time bootstrap or repair, returns `{ mapId }`.
5. `SwipeFileModal` opens `CarouselMapModal` with `mapId`.
6. Modal loads the already-bootstrapped graph. Topics lane shows one locked topic with no generation action. User starts from opening pair generation.
7. User walks through: openings → expansions → create project (selecting their saved prompt via the existing prompt picker).
8. `SwipeFileModal` closes everything, loads project on canvas, auto-fires generate-copy.

### Reopening behavior

If the user reopens the same digest topic's Carousel Map, the bootstrap route finds the existing map by `source_digest_topic_id` and returns the same `mapId`. The modal loads existing progress (any previously generated openings, expansions, or selections are preserved).

---

## Exact flow: Explore Ideas from Daily Digest

1. User clicks split-button chevron and chooses "Explore Ideas."
2. `DailyDigestPanel` emits `onOpenDigestIdeas(topicPayload)`.
3. `SwipeFileModal` receives the payload, calls `POST /api/daily-digest/topics/[topicId]/ideas/bootstrap`.
4. Server ensures swipe item (shared helper), ensures/reuses a topic-scoped `swipe_file_idea_threads` row, returns `{ swipeItemId, sourceDigestTopicId, initialDraft }`.
5. `SwipeFileModal` opens `SwipeIdeasChatModal` with `swipeItemId`, `sourceDigestTopicId`, and `initialDraft`.
6. The chat modal shows a locked digest-topic context banner near the top (topic title + one-line context). The shared swipe-item Angle / Notes editor is not shown for digest-origin flow.
7. If the thread is empty, the composer is pre-filled with `initialDraft` (topic title + carousel angle + a short "explore carousel directions for this topic" phrasing). User edits or sends as-is by clicking Send. No auto-send.
8. If the thread already has messages (reopen), `initialDraft` is not applied. Existing history and draft state are preserved.
9. Server-side: all prompt/context construction for this thread includes a `DIGEST_TOPIC_CONTEXT` block (title, what_it_is, why_it_matters, carousel_angle) alongside the existing swipe item context, so the thread stays grounded to the chosen topic across resets and follow-up turns.
10. When the user has at least one saved idea, the chat modal exposes a button like "Pick idea & create carousel." That triggers a callback to `SwipeFileModal`, which closes the chat modal and opens `SwipeIdeasPickerModal` for the same `sourceDigestTopicId`.
11. The picker shows only saved ideas for the current digest topic. Saved ideas are filtered by `swipe_file_ideas.source_digest_topic_id = [current topic id]`.
12. User selects their saved prompt, creates project.
13. `SwipeFileModal` closes everything, loads project on canvas, auto-fires generate-copy.

### Reopening behavior

If the user reopens the same digest topic's Ideas thread, the bootstrap route finds the existing thread by `source_digest_topic_id` and returns the same IDs. Existing conversation history is preserved.

---

## Digest topic context injection in Swipe Ideas

When a thread has `source_digest_topic_id` set, the server-side context builder (`buildSwipeIdeasContextText` in `_shared.ts`) appends a new block:

```text
DIGEST_TOPIC_CONTEXT:
- Title: {title}
- What it is: {what_it_is}
- Why it matters: {why_it_matters}
- Carousel angle: {carousel_angle}
```

This block is:
- **Appended** alongside existing swipe item context (BRAND_VOICE, SOURCE_CONTEXT, CAPTION, TRANSCRIPT)
- **Not replacing** any existing context
- Used by `messages`, `chat-prompt-preview`, and any other server-generated prompt for the ideas thread

When a digest-origin idea is saved, `swipe_file_ideas.source_digest_topic_id` is written directly from the thread/topic context. This is a durable link that survives thread reset/delete, so the picker can remain topic-scoped even after `thread_id` is cleared by `ON DELETE SET NULL`.

---

## Digest topic context injection in Carousel Map prompts

When a map has `source_digest_topic_id` set, the prompt builders for opening-pairs and expansions generation load the digest topic and inject `carousel_angle` as a separate context block:

```text
DIGEST_TOPIC_CONTEXT:
- Carousel angle: {carousel_angle}
```

This is appended to the existing map prompt composition. The `title`, `summary`, and `why_it_matters` are already present on the map topic row and do not need separate injection.

---

## UI: DailyDigestPanel callback contract

`DailyDigestPanel` exposes three callbacks:

```ts
type DigestTopicLaunchPayload = {
  topicId: string;
  digestVideoId: string;
  title: string;
  whatItIs: string;
  whyItMatters: string;
  carouselAngle: string | null;
  videoTitle: string;
  creatorName: string;
  youtubeVideoUrl: string;
};

type Props = {
  onQuickCreate?: (topic: DigestTopicLaunchPayload) => void;
  onOpenDigestCarouselMap?: (topic: DigestTopicLaunchPayload) => void;
  onOpenDigestIdeas?: (topic: DigestTopicLaunchPayload) => void;
};
```

- Bootstrap routes only need `topicId`; the server loads canonical data itself.
- `SwipeFileModal` may use display fields (title, creatorName) for loading states.
- No transcript or summary in the payload; server loads those from the database.

---

## UI: SwipeFileModal orchestration

`SwipeFileModal` receives the three callbacks and handles:

1. Calling the appropriate bootstrap API route
2. Opening the nested modal (`CarouselMapModal` or `SwipeIdeasChatModal`)
3. Project load + pending auto-generate handoff on final project creation

This matches the existing ownership model where `SwipeFileModal` orchestrates all nested modals.

---

## UI: Split button

### Right detail panel (larger)

```
[ Create carousel | ▾ ]
```

Left click = Quick Create. Chevron opens dropdown with "Carousel Map" and "Explore Ideas."

### Inline topic card row (compact)

```
[ Create | ▾ ]
```

Same behavior, compact label. Both locations support all three actions.

---

## UI: CarouselMapModal contract changes

New optional prop:

```ts
mapId?: string | null
```

Behavior:
- If `mapId` is provided, load graph by `mapId` directly (digest-origin path).
- If `mapId` is absent, fall back to existing `swipeItemId` behavior (normal Swipe File flows).
- When digest-origin: Topics lane shows one locked topic with no "Generate topics" action. User starts from opening pairs.

---

## UI: SwipeIdeasChatModal contract changes

New optional props:

```ts
sourceDigestTopicId?: string | null
initialDraft?: string | null
```

Behavior:
- Thread load/send/reset routes receive `sourceDigestTopicId` when present.
- Show a locked digest-topic context banner near the top of the modal when `sourceDigestTopicId` is present.
- Composer starts with `initialDraft` **only when the thread is empty** (no existing messages).
- No auto-send. User explicitly clicks Send.
- Never overwrite an existing active draft or history state on reopen.
- Do not show the shared swipe-item Angle / Notes editor for digest-origin flows.
- Expose an in-modal handoff action that lets the user move directly into the topic-scoped ideas picker.

---

## UI: SwipeIdeasPickerModal contract changes

New optional prop:

```ts
sourceDigestTopicId?: string | null
```

Behavior:
- If `sourceDigestTopicId` is present, show only saved ideas whose `swipe_file_ideas.source_digest_topic_id` matches it.
- If `sourceDigestTopicId` is absent, retain existing Swipe File behavior.
- This keeps digest-origin idea selection isolated even if the underlying thread was reset or deleted earlier.

---

## Shared server helper

Extract from Phase 1 create-carousel route into `src/app/api/daily-digest/_utils.ts`:

```ts
export async function ensureDigestSwipeItemForTopic(args: {
  supabase: any;
  accountId: string;
  userId: string;
  digestVideo: { youtubeVideoUrl: string; videoTitle: string; creatorName: string; thumbnailUrl: string | null; summary: string | null; rawTranscript: string | null };
}): Promise<{ swipeItemId: string }>
```

This helper:
- Canonicalizes the YouTube URL
- Checks transcript availability (fails if neither swipe item nor digest video has a transcript)
- Creates or reuses the swipe item with fill-gaps-only policy
- Returns the swipe item ID

Used by:
- `create-carousel` (Phase 1, refactored to call helper)
- `carousel-map/bootstrap` (Phase 2)
- `ideas/bootstrap` (Phase 2)

---

## API surface

### Existing (refactored)

| Route | Change |
|-------|--------|
| `POST /api/daily-digest/topics/[id]/create-carousel` | Refactor swipe-item logic into shared helper |

### New routes

| Route | Purpose |
|-------|---------|
| `POST /api/daily-digest/topics/[id]/carousel-map/bootstrap` | Ensure swipe item + topic-scoped map session. Returns `{ mapId }`. |
| `POST /api/daily-digest/topics/[id]/ideas/bootstrap` | Ensure swipe item + topic-scoped idea thread. Returns `{ swipeItemId, sourceDigestTopicId, initialDraft }`. |

### Modified existing routes

| Route | Change |
|-------|--------|
| `GET /api/carousel-map/[mapId]` | Existing graph-load route becomes the digest-origin load path when `CarouselMapModal` is opened with `mapId`. |
| Swipe Ideas `messages`, `thread`, `reset`, `chat-prompt-preview`, `drafts` | Accept optional `sourceDigestTopicId`. Scope thread by it when present. Include digest topic context in prompt builds. |
| Swipe Ideas saved-ideas `GET/POST` + picker queries | Persist and filter `swipe_file_ideas.source_digest_topic_id` for digest-origin flows so saved ideas remain topic-scoped across resets. |
| Swipe-origin and Carousel Map project-creation routes | When the originating thread/map has `source_digest_topic_id`, skip updating `swipe_file_items.created_project_id`. |
| Carousel Map opening-pairs and expansions `generate` routes | When map is digest-origin, load digest topic and inject `carousel_angle` into prompts. |

---

## Implementation order

1. Extract shared `ensureDigestSwipeItemForTopic` helper. Refactor Phase 1 `create-carousel` to use it.
2. Add migration: new columns (`carousel_maps`, `swipe_file_idea_threads`, `swipe_file_ideas`) + partial unique index replacements.
3. Build `POST /api/daily-digest/topics/[id]/carousel-map/bootstrap`.
4. Update `CarouselMapModal` to accept and load by `mapId`. Show locked topic for digest-origin maps.
5. Build `POST /api/daily-digest/topics/[id]/ideas/bootstrap`.
6. Extend Swipe Ideas server routes to accept `sourceDigestTopicId`, inject digest topic context, and persist/filter `swipe_file_ideas.source_digest_topic_id`.
7. Update `SwipeIdeasChatModal` for topic-scoped thread, locked digest-topic banner, hidden Angle / Notes, `initialDraft` behavior, and in-modal picker handoff.
8. Update `SwipeIdeasPickerModal` to accept `sourceDigestTopicId` and filter saved ideas topic-scoped when present.
9. Update `DailyDigestPanel` with split-button UI and three callbacks.
10. Update `SwipeFileModal` with orchestration for secondary flows, including chat-to-picker handoff.
11. Update project-creation routes to skip `created_project_id` writes for digest-origin map/ideas flows.
12. Update Carousel Map prompt builders to inject `carousel_angle` for digest-origin maps.
13. Run `npm run build` and `ReadLints`.
14. Update `docs/EDITOR_CODEBASE_MAP.md`.

---

## Manual QA checklist

- [ ] Multiple digest topics from the same video do not collide (separate maps, separate threads)
- [ ] Reopening the same digest topic resumes the correct map/thread with progress preserved
- [ ] Switching to a different digest topic from the same video opens a different map/thread
- [ ] Thread reset preserves topic grounding (digest context still injected after reset)
- [ ] Saved ideas for digest topic A never appear in the picker for digest topic B from the same video
- [ ] Digest-origin saved ideas remain topic-scoped even after thread reset/delete
- [ ] Normal Swipe File Carousel Map and Ideas flows are unaffected
- [ ] Project handoff auto-generates copy correctly for all three paths
- [ ] Digest-origin Map and Ideas project creation do not update `swipe_file_items.created_project_id`
- [ ] Split button Quick Create still works as Phase 1 (no regression)
- [ ] Compact inline split button and full detail panel split button both work
- [ ] Ideas Chat shows locked digest-topic banner on first open and reopen
- [ ] Digest-origin Ideas Chat does not expose the shared swipe-item Angle / Notes editor
- [ ] Transcript gate still fails cleanly when no transcript exists

---

## Risk assessment

| Risk | Mitigation |
|------|-----------|
| Partial unique index replacement breaks existing rows | Migration uses `DROP INDEX IF EXISTS` + `CREATE UNIQUE INDEX`. Existing rows have `source_digest_topic_id = NULL` and match the normal-flow partial index. |
| Topic-scoped map collides with swipe-item-scoped map for the same video | Partial indexes are mutually exclusive (`IS NULL` vs `IS NOT NULL`). No collision possible. |
| Saved ideas lose topic linkage after thread reset/delete | `swipe_file_ideas.source_digest_topic_id` stores the digest topic directly, so picker scoping does not depend on `thread_id`. |
| Digest context injection bloats ideas chat prompt | Digest context block is ~200 chars. Negligible compared to transcript. |
| CarouselMapModal `mapId` prop changes break existing callers | `mapId` is optional. Existing callers do not pass it and fall back to `swipeItemId` behavior. |
| `initialDraft` re-applied on reopen | Only applied when thread is empty (no messages). Explicitly not applied on reopen. |
| Digest-origin Map/Ideas overwrite swipe-item convenience pointer | Project creation routes branch on `source_digest_topic_id` and skip updating `created_project_id` for digest-origin flows. |
| `ensureDigestSwipeItemForTopic` helper diverges from Phase 1 logic | Phase 1 route is refactored to call the same helper. Single source of truth. |
