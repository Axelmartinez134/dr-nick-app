# Daily Digest — Feature Spec & Implementation Plan

> Canonical reference for the Daily Digest feature.
> Referenced from `docs/EDITOR_CODEBASE_MAP.md`.
> Created: 2026-04-03

## Overview

An automated AI intelligence briefing system that monitors tracked YouTube creators, scrapes transcripts for new videos, and runs a Claude-powered distillation prompt to extract structured insights (summary, topics, unique viewpoints). Results are displayed in a new "Daily Digest" tab inside the Swipe File modal.

### Purpose (dual)

1. **Primary**: An information feed that keeps the user informed about what's happening across their creator network — framed through the lens of "why should a business owner adopting AI care about this?"
2. **Secondary/by-product**: Any insight can later be turned into a carousel project (carousel creation is out of scope for the initial build).

---

## User journey (A → Z)

1. User opens Swipe File modal → clicks **Daily Digest** tab (superadmin-only)
2. First time: sees an empty state prompting them to toggle creators ON for auto-digest
3. After setup: the cron runs automatically at 6am and 12pm (UTC) via Vercel Cron
4. The cron refreshes RSS feeds for opted-in creators, discovers new videos, scrapes transcripts, and runs Claude distillation
5. User opens the Daily Digest tab → sees a status bar ("Last run: 6:00 AM, 4 videos, 11 topics") + the digest feed grouped by video
6. User scans topics, can Star / Dismiss / Add Notes per topic
7. "Create carousel" button exists but is disabled (future scope)

---

## Architecture

### Pipeline (cron execution flow)

```
Vercel Cron (6am + 12pm UTC)
  │
  ├─ Validate CRON_SECRET header
  ├─ Use Supabase service role client (no user session)
  │
  ├─ Step 1: Find all daily_digest_creator_settings where enabled=true
  │   └─ Group by user_id + account_id
  │
  ├─ Step 2: For each user+account scope with at least one enabled creator:
  │   ├─ Create daily_digest_runs row with status='running'
  │   ├─ Load the prompt once (override or default)
  │   └─ Store prompt_source + prompt_used snapshot on the run row
  │
  ├─ Step 3: Load carry-over work
  │   └─ Existing daily_digest_videos rows where:
  │      - status='pending', OR
  │      - status='failed' AND retry_count < 2
  │
  ├─ Step 4: Refresh feeds for enabled creators
  │   ├─ Call fetchYoutubeFeed() + upsertCreatorVideos() (existing yt-rss helpers)
  │   ├─ Update yt_creators.last_refreshed_at / last_refresh_error
  │   └─ Identify newly eligible videos:
  │      - published_at > (creator enabled_at - 10 days)
  │      - not yet present for this user+account in daily_digest_videos
  │
  ├─ Step 5: Upsert all newly eligible videos as status='pending'
  │   ├─ Skip Swipe File mirroring (no auto-pollution of Swipe File)
  │   ├─ Copy immutable source snapshot at discovery time:
  │   │   youtube_video_url, video_title, creator_name, thumbnail_url, published_at
  │   └─ This happens before transcript scraping/distillation begins
  │
  ├─ Step 6: Process queue oldest-first by published_at ASC
  │   ├─ Queue order:
  │   │   1. carry-over pending/retryable videos
  │   │   2. newly discovered videos
  │   ├─ For each queued video:
  │   │   ├─ If raw_transcript already exists, skip Apify
  │   │   ├─ Else call scrapeYoutubeViaApifyKaramelo() directly
  │   │   ├─ Cache transcript in daily_digest_videos.raw_transcript
  │   │   ├─ Call Claude (Anthropic API) with the run's prompt_used snapshot
  │   │   ├─ Parse structured JSON response
  │   │   ├─ Insert summary + unique_viewpoints into daily_digest_videos
  │   │   └─ Insert topic rows into daily_digest_topics
  │
  ├─ Step 7: Finalize daily_digest_runs row
  │   ├─ Update counters and finished_at
  │   ├─ status='completed' if no per-video failures AND no feed-refresh failures occurred
  │   ├─ status='completed_with_errors' if any video failed OR any feed refresh failed
  │   └─ status='failed' only for orchestration-level failure
  │
  └─ Timeout guard: stop processing new videos after 240s elapsed,
     leave remaining queued rows as status='pending' for next run
```

### Key decisions

#### No Swipe File mirroring during cron
The cron does NOT mirror videos into the Swipe File. This keeps the Swipe File clean from auto-generated items. When carousel creation is added later, the "Create carousel" action on a topic will create the Swipe File mirror at that point (on-demand, user-initiated).

#### Direct Apify call, not HTTP enrich endpoint
The cron calls `scrapeYoutubeViaApifyKaramelo()` directly (server function import) rather than going through the HTTP `POST /api/yt-rss/videos/[id]/enrich` endpoint. This avoids auth header complications since the cron has no user session.

#### Shared YouTube cache is intentional
Daily Digest reuses the existing user-scoped `yt_creators` / `yt_videos` cache and refresh helpers. This means a Daily Digest-triggered refresh updates the same underlying cached YouTube data that powers the YouTube Creator Feed tab. That coupling is intentional: the two tabs are independent at the product/workflow level, but they share the same RSS cache plumbing to avoid duplicate refresh systems.

#### Refresh metadata is shared too
If Daily Digest refreshes a creator feed, it updates `yt_creators.last_refreshed_at` and `yt_creators.last_refresh_error` the same way the YouTube Creator Feed refresh route does. The YouTube Creator Feed tab should reflect true cache freshness regardless of which system triggered the refresh.

#### Service role client for DB access
The cron uses `requireServiceClient()` from `src/app/api/_shared/reel_media.ts` which creates a Supabase client with the service role key. This bypasses RLS, which is necessary since the cron has no `auth.uid()`.

#### Timeout mitigation
Vercel Pro allows `maxDuration = 300` (5 min). The cron tracks elapsed time and stops processing queued videos after 240s. Newly eligible videos are inserted up front as `status = 'pending'`, then the processor works the queue oldest-first. When the timeout guard hits, any untouched rows remain `pending` for the next run. The run itself still finishes normally with `status = 'completed'` or `status = 'completed_with_errors'` depending on whether any videos failed during the work it did attempt.

#### Overlapping runs (concurrent safety)
Row-level dedupe via unique constraint on `daily_digest_videos (user_id, account_id, yt_video_id)`. If two runs (e.g. cron + manual "Run now") try to insert the same video, the second insert hits the constraint and skips gracefully. No distributed locks needed.

#### Runs granularity
One `daily_digest_runs` row per invocation per user+account pair, but only when that scope has at least one enabled creator. A scope with enabled creators still gets a run row even if zero new videos were found. For now with one user, that means one row per invocation.

#### Prompt snapshot per run
Each run reads the effective prompt exactly once at run start and stores both `prompt_source` (`default` or `override`) and the full `prompt_used` text on `daily_digest_runs`. Every video attempted during that run uses the same prompt snapshot, even if the user edits their prompt override mid-run.

#### Run row is created before prompt load
After request auth/account resolution succeeds, the run row is created immediately with `status='running'` before prompt loading or feed refresh begins. This ensures prompt-load failures and other orchestration failures are observable as real failed runs. Only pre-run request rejections (invalid cron secret, invalid user auth, missing/forbidden account) produce no run row.

#### Feed refresh failures are run-level errors, not video failures
If one or more creator feed refreshes fail but the overall processing loop continues, the run finishes as `completed_with_errors`. These are recorded as run-level errors and do NOT increment `videos_failed`, which is reserved for actual video-level pipeline failures.

#### Shared transcript normalization helper
The YouTube transcript parsing/cleaning logic used for Apify Karamelo output should live in a shared helper so Daily Digest and the existing Swipe File enrich route produce identical transcript text from the same source payload.

#### Visibility only after completed runs
`GET /api/daily-digest/videos` only returns rows whose `digest_run_id` points to a run with `status IN ('completed', 'completed_with_errors')`. Rows tied to a currently running run are hidden until that run finishes. This keeps the UI from showing partial results mid-run.

---

## Ownership and scoping rules

### Future-ready schema, single-user execution
Tables are modeled with `user_id + account_id` scoping. No hardcoded user IDs in application code. The "single-user" constraint is purely at the current data level: only one user currently has rows in the tables. When multiple users gain access later, the cron naturally processes each user's enabled creator set independently without code changes.

### Per-user within account
The digest is scoped to both the active account and the current user. Switching accounts shows a different set of creator settings, digest results, prompt overrides, and topic triage state. A second user inside the same account can see a completely different digest because prompts, creator enrollment, and topic triage are personal rather than collaborative.

### Creator source of truth
Daily Digest creators are always selected from the existing `yt_creators` universe (FK enforced). A creator cannot be in Daily Digest without first being added in the YouTube Creator Feed tab. Daily Digest has zero influence on the YouTube Creator Feed's refresh behavior -- the two systems are independent.

### Per-user isolation
Each `user_id + account_id` scope gets its own `daily_digest_videos` and `daily_digest_topics` rows, even for the same underlying source video. Different users or accounts may have different prompts and produce different topics. Triage state (star/dismiss/notes) is always personal to that `user_id + account_id` scope.

### What counts as "new" for processing
- Every time a creator is toggled ON or re-enabled, Daily Digest uses a rolling 10-day lookback window from that `enabled_at` timestamp.
- Videos in `yt_videos` from normal YT feed refreshes are eligible if `published_at > (enabled_at - 10 days)` AND not yet in `daily_digest_videos`.
- Re-enabling after disable: `enabled_at` updates to NOW again, which creates a fresh 10-day lookback window. Already-existing `daily_digest_videos` rows are skipped; only missing videos from that 10-day window are picked up.

---

## Retry and failure rules

### `retry_count` meaning
`retry_count` tracks failed pipeline attempts across runs for a video (transcript scraping + Claude distillation combined). It does NOT count the immediate same-run Claude format retry. `retry_count = 0` means no failed pipeline attempts yet, `retry_count = 1` means one failed attempt occurred in a prior run, and `retry_count >= 2` means the normal retry budget is exhausted.

### Single retry budget per video
Max 2 total pipeline attempts across runs (initial attempt + 1 retry). Videos with `status = 'failed'` and `retry_count < 2` are eligible to be retried on the next cron/manual run.

### Transcript caching on partial failure
If transcript scraping succeeds but Claude fails, the transcript is cached in `raw_transcript`. On the next retry, the pipeline checks: if `raw_transcript` is already populated, skip the Apify call and go straight to Claude. Saves Apify credits and time.

### Same-run Claude format retry
If Claude returns malformed JSON on the first attempt, retry once immediately with `temperature: 0` plus an appended format-fix instruction. This is an internal implementation detail of a single pipeline attempt and does not increment `retry_count`.

### No transcript available
If transcript scraping determines the video has no usable transcript/captions, mark the video as `status = 'failed'`, `error_message = 'No transcript available'`, and `retry_count = 99` (terminal sentinel). Do not retry it automatically.

### Token limit handling
If Anthropic rejects due to token limits, the video is marked as `status = 'failed'` with `error_message = 'Transcript too long for AI processing'` and `retry_count = 99` (sentinel). No auto-truncation — truncation risks producing misleading output. The user sees the failure in the UI and can decide what to do.

### Failed items in the UI
Failed videos appear in the digest feed with a red "failed" badge, the error message visible, and a working "View on YouTube" link from the denormalized `youtube_video_url`. They are NOT hidden. Topics section is empty (since none were extracted).

### Reprocessing policy
Once a video reaches `status = 'completed'`, it stays that way forever in v1. Terminal failures (`retry_count = 99`) are also final in v1. Changing the prompt only affects future videos. `digest_run_id` always points to the run that most recently touched the current state of the video (if a pending video from run A is completed in run B, it points to run B). A future "Force reprocess" action may reset a video's status and retry budget, but that is out of scope.

---

## Topic state model

### Status values
`'active'` | `'starred'` | `'dismissed'`

Mutually exclusive. State machine:
```
active ──Star──→ starred ──Unstar──→ active
active ──Dismiss──→ dismissed ──Undismiss──→ active
starred ──Dismiss──→ dismissed
dismissed ──Star──→ starred
```

### "New" filter definition
"New" = topics from the most recent run with `status IN ('completed', 'completed_with_errors')` that actually produced topics. If the latest completed run found zero new videos/topics, "New" falls back to the most recent completed run that did produce topics.

### Notes
Single plain text field per topic. Overwrite only. No history/audit.

---

## Data model

### New tables

#### `daily_digest_creator_settings`
Per-creator toggle for the auto-digest pipeline.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| user_id | uuid FK → auth.users | on delete cascade |
| account_id | uuid FK → editor_accounts | on delete cascade |
| yt_creator_id | uuid FK → yt_creators | on delete cascade |
| enabled | boolean | default false |
| enabled_at | timestamptz | nullable; set to NOW when toggled ON; eligibility uses a rolling 10-day lookback from this timestamp |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Unique: `(user_id, account_id, yt_creator_id)`

RLS: superadmin + owner (`auth.uid() = user_id AND exists(editor_superadmins)`)

**Toggle behavior**: When `enabled` flips to `true`, `enabled_at` is set to `now()`. When `enabled` flips to `false`, `enabled_at` is left as-is (preserves the last-enabled timestamp for logging). When re-enabled, `enabled_at` updates to the new `now()`, which creates a fresh 10-day lookback window. Existing `daily_digest_videos` rows are still skipped via the unique per-video rule.

#### `daily_digest_runs`
Log of each cron execution (one row per invocation per user+account).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| user_id | uuid FK → auth.users | on delete cascade |
| account_id | uuid FK → editor_accounts | on delete cascade |
| started_at | timestamptz | not null |
| finished_at | timestamptz | nullable |
| status | text | 'running' / 'completed' / 'completed_with_errors' / 'failed' |
| videos_discovered | integer | default 0 |
| videos_processed | integer | default 0 |
| videos_failed | integer | default 0 |
| videos_pending | integer | default 0 |
| topics_extracted | integer | default 0 |
| prompt_source | text | nullable at insert; 'default' / 'override' after prompt load |
| prompt_used | text | nullable at insert; full prompt snapshot used for this run after prompt load |
| run_errors | jsonb | structured array of run-level errors (e.g. feed refresh failures) |
| error_message | text | nullable |

RLS: superadmin + owner

**Status semantics**:
- `running`: row created and work is in progress
- `completed`: run finished normally and zero video failures + zero feed-refresh failures occurred during this run
- `completed_with_errors`: run finished normally, but one or more videos reached `failed` during this run and/or one or more creator feed refreshes failed
- `failed`: orchestration-level failure prevented normal completion

**Run creation rule**: only create a run row when that `user_id + account_id` scope has at least one enabled creator. If enabled creators exist but there are zero new videos, still create the run row.

**Prompt fields timing**: because the run row is created before prompt loading, `prompt_source` and `prompt_used` are initially null and are filled in immediately after the prompt is successfully loaded. If prompt loading fails, the run is marked `failed` and those fields remain null.

**Metrics semantics**:
- `videos_discovered`: only videos newly inserted in this run
- `videos_processed`: videos that reached `completed` in this run, whether newly discovered or previously pending
- `videos_failed`: videos that reached `failed` in this run
- `videos_pending`: videos this run discovered/queued but left `pending` due to timeout

#### `daily_digest_videos`
Tracks each video the pipeline has touched.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| user_id | uuid FK → auth.users | on delete cascade |
| account_id | uuid FK → editor_accounts | on delete cascade |
| yt_video_id | uuid FK → yt_videos | nullable, on delete set null |
| digest_run_id | uuid FK → daily_digest_runs | nullable, on delete set null |
| status | text | 'pending' / 'enriching' / 'distilling' / 'completed' / 'failed' |
| retry_count | integer | default 0 |
| error_message | text | nullable |
| youtube_video_url | text | immutable snapshot from source row |
| video_title | text | immutable snapshot from source row |
| creator_name | text | immutable snapshot from source row |
| thumbnail_url | text | nullable immutable snapshot from source row |
| published_at | timestamptz | immutable snapshot from source row |
| summary | text | nullable; AI-generated top-level summary |
| unique_viewpoints | jsonb | nullable; array of strings |
| transcript_char_count | integer | nullable |
| raw_transcript | text | nullable; cached transcript (denormalized for UI + retry) |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Unique: `(user_id, account_id, yt_video_id)` — a video is only processed once per user+account

RLS: superadmin + owner

**Source snapshot rule**: `youtube_video_url`, `video_title`, `creator_name`, `thumbnail_url`, and `published_at` are copied at discovery/upsert time, before any transcript scraping or distillation starts. They are immutable afterward so the digest item remains fully usable if the source `yt_videos` / `yt_creators` rows are later deleted.

**Deleted source behavior**: if `yt_video_id` becomes null because the source row was deleted, the digest item remains visible. The UI uses the denormalized source snapshot plus a subtle "source removed" badge.

#### `daily_digest_topics`
Individual topic cards extracted from a video.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| digest_video_id | uuid FK → daily_digest_videos | on delete cascade |
| user_id | uuid FK → auth.users | on delete cascade |
| account_id | uuid FK → editor_accounts | on delete cascade |
| title | text | short topic label |
| what_it_is | text | plain explanation |
| why_it_matters | text | business owner pain framing |
| carousel_angle | text | nullable; suggested carousel angle |
| status | text | 'active' / 'dismissed' / 'starred'; default 'active' |
| note | text | nullable; user-added freeform notes |
| sort_order | integer | order within the video; default 0 |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: superadmin + owner

#### `daily_digest_prompt_overrides`
Per-user-per-account editable distillation prompt.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| user_id | uuid FK → auth.users | on delete cascade |
| account_id | uuid FK → editor_accounts | on delete cascade |
| distill_prompt | text | not null |
| updated_at | timestamptz | default now() |

RLS: superadmin + owner (NOT account member — superadmin-only end to end)

Unique: `(user_id, account_id)`

**Reset behavior**: "Reset to default" DELETEs the row. Code falls back to hardcoded default prompt.

---

## API routes

All routes live under `src/app/api/daily-digest/`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/daily-digest/cron` | `CRON_SECRET` header | Vercel Cron entry point |
| POST | `/api/daily-digest/manual-run` | Bearer + superadmin + account | Manual "Run now" trigger (same pipeline, user auth) |
| GET | `/api/daily-digest/runs` | Bearer + superadmin + account | List recent cron runs |
| GET | `/api/daily-digest/creators` | Bearer + superadmin + account | List creators with digest toggle state |
| POST | `/api/daily-digest/creators` | Bearer + superadmin + account | Toggle creator digest enrollment |
| GET | `/api/daily-digest/videos` | Bearer + superadmin + account | List processed videos + topics |
| PATCH | `/api/daily-digest/topics/[id]` | Bearer + superadmin + account | Update topic status/note |
| GET | `/api/daily-digest/prompt` | Bearer + superadmin + account | Read distillation prompt override |
| POST | `/api/daily-digest/prompt` | Bearer + superadmin + account | Update distillation prompt override |
| DELETE | `/api/daily-digest/prompt` | Bearer + superadmin + account | Reset prompt to default (deletes override row) |

### Cron auth pattern
```typescript
// Vercel sends: Authorization: Bearer <CRON_SECRET>
const authHeader = request.headers.get('authorization');
const token = authHeader?.replace('Bearer ', '');
if (token !== process.env.CRON_SECRET) return 401;
```

Invalid cron auth returns `401` before any run rows are created.

### User-facing route auth pattern
Reuses `getAuthedYtContext()` from `src/app/api/yt-rss/_utils.ts` which gates on superadmin + resolves account. The authenticated `auth.uid()` becomes the `user_id` scope for all Daily Digest reads/writes.

### Manual run scope
The "Run now" button processes the current user's enabled creators for the current active account only. It includes both newly discovered videos and retryable/pending carry-over videos, using the same pipeline rules as cron. The route runs synchronously and returns only when the pipeline attempt is complete. The UI disables the button while a run is already `status = 'running'` for that `user_id + account_id`.

### Videos API visibility rule
`GET /api/daily-digest/videos` returns only rows whose `digest_run_id` points to a run with `status IN ('completed', 'completed_with_errors')`. Rows tied to an in-progress run are hidden until the run completes. This intentionally prevents partial results from appearing mid-run.

---

## Claude distillation prompt

### Default prompt (stored as fallback; user can override per-user-per-account)

```
SYSTEM:
You are an AI intelligence analyst for a business consultant who helps companies
adopt AI and become more efficient. Your job is to analyze YouTube video transcripts
and extract actionable intelligence.

The audience is business owners who feel:
- Anxious about falling behind competitors who adopt AI faster
- Overwhelmed by the pace of change and unsure what actually matters vs. hype
- Worried about investing in the wrong tools or strategies
- Pressure to "do something with AI" but unclear on what moves the needle
- Fear that ignoring AI will cost them revenue, market position, or relevance

Frame every insight through this lens: "If I'm a business owner with 10 other
priorities, why should I stop and pay attention to THIS?"

USER:
Analyze this transcript and produce a structured JSON response.

TRANSCRIPT:
{full transcript text}

VIDEO METADATA:
- Title: {title}
- Creator: {channel name}
- Published: {date}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "summary": "2-4 sentence core message of this video",
  "topics": [
    {
      "title": "Short topic label (5-10 words)",
      "what_it_is": "Plain explanation of what happened or what this is about (2-3 sentences)",
      "why_it_matters": "Why a business owner should care, tied to their real pain/anxiety (2-3 sentences)",
      "carousel_angle": "If this were a 6-slide carousel teaching this topic, what would the hook/angle be? (1 sentence)"
    }
  ],
  "unique_viewpoints": [
    "Any distinctive opinions, predictions, or contrarian takes the creator expressed (1 sentence each)"
  ]
}

Extract 1-5 topics depending on the video's scope. A focused video might have 1 topic.
A news roundup might have 5. Do not force topics where there aren't any.
```

### Retry behavior
- First malformed-JSON call → retry once immediately with `temperature: 0` and an appended `FORMAT_ERROR` instruction
- If the overall pipeline attempt still fails → mark video as `failed`, increment `retry_count` by 1
- Next cron/manual run: retry failed videos where `retry_count < 2`
- If `raw_transcript` is already cached from a previous attempt, skip Apify and retry only Claude
- Terminal failures (`retry_count = 99`) are excluded from auto-retry

### Token/cost notes
- Model: `process.env.ANTHROPIC_MODEL` (falls back to `claude-sonnet-4-5`)
- API key: `process.env.ANTHROPIC_API_KEY`
- `max_tokens`: 4000 (topics JSON can be large)
- Full transcript sent (no truncation). Token-limit rejections are terminal (`retry_count = 99`).

---

## UI — Daily Digest tab

### Tab placement

Third tab pill in `SwipeFileModal.tsx`, after "Swipe File" and "YouTube Creator Feed".
Superadmin-only (same gating as YouTube Creator Feed tab).

Subtitle: "Auto-processed insights from your tracked creators. Runs daily at 6am and 12pm."

### Layout: 3-column (desktop only)

```
┌──────────────┬─────────────────────────────────┬───────────────────────┐
│  LEFT (240px)│  CENTER (flex)                   │  RIGHT (360px)       │
│  Sources     │  Digest Feed                     │  Topic Detail        │
├──────────────┼─────────────────────────────────┼───────────────────────┤
│ Status bar   │ Filter pills:                    │ Full topic detail    │
│ Creator list │ [All] [New] [Starred]            │ Source video info    │
│ with toggles │ [Show dismissed]                 │ Notes textarea       │
│              │                                  │ Action buttons       │
│ Manage       │ Video cards (grouped by video,   │ Transcript excerpt   │
│ creators     │ ordered by publish date newest   │                      │
│ (collapsible)│ first)                           │                      │
└──────────────┴─────────────────────────────────┴───────────────────────┘
```

### Left sidebar — "Sources"

- **Status banner** (always visible at top):
  - If a run is in progress: "Running now..." + spinner + started-at relative time
  - Also shows last completed run summary: timestamp + videos processed + topics extracted + failures
  - Green / amber / red indicator based on latest completed run status
  - "Run now" button (calls `POST /api/daily-digest/manual-run`) and is disabled while a run is active for this user+account
- **Creator list**:
  - Enabled creator + non-dismissed topics > 0: shown normally
  - Enabled creator + 0 topics: still shown (so the user can see active subscriptions before first results arrive)
  - Disabled creator + non-dismissed topics > 0: shown dimmed with `(paused)`
  - Disabled creator + 0 topics: hidden
  - Topic count badge always shows all non-dismissed topics for that creator within the current `user_id + account_id` scope
- **"All creators"** option at top (shows everything)
- **"Removed creators"** entry at bottom when orphaned topics exist due to deleted source creators
- **"Manage creators"** (collapsible at bottom): shows creators currently OFF and not already visible in the main list so they can be enabled
- Topic count badges do not change with the active center-panel filter (All/New/Starred)

### Center — Digest Feed

- **Filter pills**: All | New | Starred | Show dismissed
  - "New" = topics from the most recent completed/completed_with_errors run that actually produced topics
- **Video cards** (grouped by video, newest first by `published_at`):
  - Card header: thumbnail (small, 80×45px) + creator name + video title + publish time + status badge
  - Card body: summary blockquote + topic mini-cards + unique viewpoints
  - Topic mini-cards: title, what_it_is (truncated), why_it_matters (truncated), action row
  - Action row: Star | Dismiss | Note | Create carousel (disabled)
  - Failed videos: red badge + error message, no topics section
- **Collapsed by default**: videos NOT from the latest completed run are collapsed; latest run videos are expanded
- **No partial results**: rows from a currently running run are hidden until that run completes
- **Responsive**: below 1024px, right panel hides; topic detail shows inline-expanded in the center feed

### Right panel — Topic Detail

- Shown when a topic is clicked in the center feed
- Full topic text (not truncated): title, what_it_is, why_it_matters, carousel_angle
- Source video info (thumbnail + title + creator name + link to YouTube)
- If the source `yt_videos` row was deleted, show a subtle "source removed" badge while still using the denormalized title/creator/link/thumbnail
- Notes textarea (debounced autosave, same pattern as YT Creator Feed "Angle / Notes")
- Star / Dismiss toggle buttons
- Create carousel button (disabled placeholder)
- Collapsible transcript excerpt (first 2000 characters of `raw_transcript`)
- When filters hide the selected topic, selection clears automatically (right panel shows video-level summary)

### Prompt editor

- Accessible via gear icon in the tab header
- Collapses down between header and 3-column layout
- Textarea + debounced autosave + "Saving.../Saved" + "Reset to default"
- Override is scoped to `user_id + account_id`, not shared with other users in the same account
- Reset to default DELETEs the override row (falls back to hardcoded default)

---

## Files — complete inventory

### New files (12)

| File | Purpose |
|---|---|
| `supabase/migrations/20260403_000001_add_daily_digest_tables.sql` | 5 tables + RLS + triggers + grants |
| `vercel.json` | Vercel Cron schedule (`0 6,12 * * *`) |
| `src/app/api/_shared/youtube-transcript.ts` | Shared YouTube Apify transcript normalization helper |
| `src/app/api/daily-digest/cron/route.ts` | Cron pipeline orchestrator |
| `src/app/api/daily-digest/manual-run/route.ts` | Manual "Run now" (same pipeline, user auth) |
| `src/app/api/daily-digest/_utils.ts` | Shared helpers (service client, Claude call, JSON parsing, pipeline logic) |
| `src/app/api/daily-digest/creators/route.ts` | GET/POST creator digest toggles |
| `src/app/api/daily-digest/runs/route.ts` | GET recent cron runs |
| `src/app/api/daily-digest/videos/route.ts` | GET processed videos + topics |
| `src/app/api/daily-digest/topics/[id]/route.ts` | PATCH topic triage |
| `src/app/api/daily-digest/prompt/route.ts` | GET/POST/DELETE prompt override |
| `src/features/editor/components/DailyDigestPanel.tsx` | New tab UI component |

### Modified files (3)

| File | What changes |
|---|---|
| `src/features/editor/components/SwipeFileModal.tsx` | Add third tab pill + import + render branch |
| `src/app/api/swipe-file/items/[id]/enrich/route.ts` | Switch YouTube transcript extraction to the shared normalization helper |
| `docs/EDITOR_CODEBASE_MAP.md` | Add Daily Digest section with file ownership + manual QA |

### NOT modified (confirmed safe)

| File | Why unchanged |
|---|---|
| `src/app/editor/EditorShell.tsx` | Tab lives inside SwipeFileModal; no new store state |
| `src/features/editor/store/types.ts` | No new store fields needed |
| `src/features/editor/hooks/useEditorStoreActionsSync.ts` | No new actions needed |
| `src/features/editor/components/EditorTopBar.tsx` | Swipe File button unchanged |
| `src/features/editor/components/YoutubeCreatorFeedPanel.tsx` | YouTube Creator Feed tab unchanged |

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `CRON_SECRET` | Yes (new) | Must be added to Vercel env. Used to authenticate cron requests |
| `ANTHROPIC_API_KEY` | Already exists | Used for Claude distillation calls |
| `ANTHROPIC_MODEL` | Already exists | Falls back to `claude-sonnet-4-5` |
| `APIFY_API_TOKEN` | Already exists | Used for Karamelo transcript scraper |
| `SUPABASE_SERVICE_ROLE_KEY` | Already exists | Used by cron for DB access without user session |

---

## Scope boundaries

### In scope (initial build)

- Cron job (6am + 12pm UTC via Vercel Cron)
- Manual "Run now" button (separate authenticated endpoint)
- RSS refresh for opted-in creators
- Transcript scraping via Apify Karamelo (direct server call)
- Claude distillation (full transcript, structured JSON output)
- Daily Digest tab UI (3-column, desktop only)
- Creator toggle management
- Topic triage (star/dismiss/note) with mutually exclusive states
- Prompt editor (per-user-per-account override, superadmin-only, reset = delete)
- Cron status log
- Retry logic (single retry budget per video, transcript caching for partial failures)
- Failed items visible in feed with error state
- Timeout guard (240s) with pending video insertion

### Out of scope (future)

- "Create carousel" from a topic (button exists but disabled)
- Specific carousel creation flow (prompt vs. Ideas vs. Carousel Map)
- Generate Copy auto-run
- Mobile UI
- Swipe File mirroring during cron (only mirrors on explicit user action later)
- Access for non-superadmin users
- Topic reprocessing / re-distillation with updated prompt
- Manual "Force reprocess" for terminal failures
- Note history / audit trail
- Transcript truncation for long videos

---

## Implementation order (phases)

1. **Phase 1**: Database migration (all 5 new tables)
2. **Phase 2**: Shared YouTube transcript normalization helper + refactor existing Swipe File YouTube enrich route to use it
3. **Phase 3**: `daily-digest/_utils.ts` shared helpers + prompt override API routes
4. **Phase 4**: Creator toggle API routes
5. **Phase 5**: Cron API route + synchronous manual-run route (shared refresh + enrich + Claude distill pipeline)
6. **Phase 6**: Videos/topics read API + topic triage PATCH
7. **Phase 7**: Runs status API
8. **Phase 8**: `DailyDigestPanel.tsx` UI component
9. **Phase 9**: `SwipeFileModal.tsx` tab integration
10. **Phase 10**: `vercel.json` cron config
11. **Phase 11**: `docs/EDITOR_CODEBASE_MAP.md` update
12. **Phase 12**: Manual testing + prompt tuning

---

## Manual QA checklist

- [ ] Open `/editor` as superadmin, click **Swipe File**, confirm **Daily Digest** tab appears
- [ ] Non-superadmin: confirm Daily Digest tab is hidden
- [ ] First open with no creators enabled: confirm empty state + setup prompt
- [ ] Toggle a creator ON: confirm it appears in the Sources sidebar
- [ ] Toggle a creator OFF before it has any topics: confirm it disappears from Sources
- [ ] Click **Run now**: confirm status banner switches to **Running now...** and the button disables until completion
- [ ] After a run: confirm video cards appear in the center feed, grouped by video
- [ ] During a run: confirm partially processed videos/topics do NOT appear in the feed until the run completes
- [ ] Confirm latest-run videos are expanded, older videos are collapsed
- [ ] Confirm each topic shows title, what_it_is, why_it_matters, carousel_angle
- [ ] Click a topic: confirm right panel shows full detail
- [ ] Star a topic: confirm it shows in the Starred filter
- [ ] Star a dismissed topic: confirm it moves to starred (not both)
- [ ] Dismiss a topic: confirm it hides by default, shows with "Show dismissed"
- [ ] Dismiss a starred topic: confirm it moves to dismissed
- [ ] Unstar a topic: confirm it returns to active
- [ ] Undismiss a topic: confirm it returns to active
- [ ] Add a note to a topic: confirm debounced autosave works (Saving.../Saved)
- [ ] Open gear icon: confirm prompt editor appears inline
- [ ] Edit prompt: confirm debounced autosave works
- [ ] Click "Reset to default": confirm prompt reverts (row deleted, falls back)
- [ ] "Create carousel" button: confirm it exists but is disabled
- [ ] Refresh page with Daily Digest as the last active tab: confirm it restores correctly
- [ ] Switch between all three tabs: confirm no state leaks or errors
- [ ] Check YouTube Creator Feed tab: confirm no behavioral changes
- [ ] Check Swipe File tab: confirm no behavioral changes
- [ ] Confirm failed videos show in feed with red badge + error message
- [ ] Confirm every video detail view has a working **View on YouTube** link
- [ ] Confirm topic count badges on creator cards show non-dismissed topics only
- [ ] Confirm "New" filter shows only topics from the latest completed run
- [ ] Toggle a creator OFF after it has topics: confirm it remains visible in Sources with a dimmed `(paused)` state
- [ ] Dismiss all topics from a paused creator: confirm that creator disappears from Sources
- [ ] Delete a source creator/video upstream, refresh Daily Digest: confirm the digest item still renders with denormalized metadata plus a subtle "source removed" badge
- [ ] If deleted-source topics exist: confirm a **Removed creators** bucket appears at the bottom of Sources
- [ ] Narrow browser to <1024px: confirm right panel hides, topic detail shows inline
- [ ] Select a topic, then switch to a filter that hides it: confirm selection clears
