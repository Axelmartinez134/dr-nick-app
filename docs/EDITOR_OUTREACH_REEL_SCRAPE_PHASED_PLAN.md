# Outreach (Reel/Post → Template → Project) — phased implementation plan

Goal: Extend the **superadmin-only** “Outreach” workflow in `/editor` so the **Single profile** section can run outreach from either:
- **Profile** URL (existing behavior), or
- **Reel/Post** URL (new, default mode), e.g. `https://www.instagram.com/p/<shortcode>/...`

When using a Reel/Post URL, we scrape the post to get:
- owner identity (`ownerUsername`, `ownerFullName`)
- post metadata (`caption`, `hashtags`, `mentions`, etc.)
- transcript (preferred) and **fallback transcription** (Whisper) when transcript is missing/empty

Then we create the customized template + create a new **Regular** project, apply template mappings, write an outreach caption (personalized topic line via DeepSeek), and finally:
- set **Review → Ready** ON (`carousel_projects.review_ready = true`)
- set **Source material…** to the reel URL (`carousel_projects.review_source = <reel url>`)

This plan is intentionally phased so each step is testable and stable before continuing.

---

## Inputs / decisions locked in

- **UI toggle**: “Reel/Post” vs “Profile”
  - Default: **Reel/Post**
- **Reel actor**: `apify/instagram-reel-scraper` (actor id `xMc5Ga1oCONPmWJIa`)
  - Input schema: [`apify/instagram-reel-scraper` input](https://apify.com/apify/instagram-reel-scraper/input-schema)
  - README / output: [`apify/instagram-reel-scraper` README](https://apify.com/apify/instagram-reel-scraper)
- **Env vars**
  - `APIFY_API_TOKEN` (server-side only)
  - `DEEPSEEK_API_KEY` (server-side only; topic line generation)
  - `OPENAI_API_KEY` (server-side only; Whisper fallback)
- **Video download policy**: **B)** request transcript; **only download MP4 if transcript is missing/empty**
- **Storage**: Create a new Supabase Storage bucket: **`reels`**
- **Caption personalization**: DeepSeek generates a short “topic line” inserted into the existing outreach caption template (cheap + good enough)
- **Review wiring**
  - “Source material…” is `carousel_projects.review_source` via `POST /api/editor/review/projects/update`
  - “Ready” toggle is `carousel_projects.review_ready` via the same API

---

## Codebase conventions (from `docs/EDITOR_CODEBASE_MAP.md`)

- **UI**: `src/features/editor/components/*` (extend `OutreachModal.tsx`)
- **Behavior/orchestration**: prefer `src/features/editor/hooks/*` when logic grows (keep `EditorShell.tsx` as wiring)
- **Client API callers**: prefer `src/features/editor/services/*` (components/hooks call these, not raw `fetch`)
- **Server APIs**: `src/app/api/editor/**/route.ts`
- **Server-only integrations**: keep Apify/DeepSeek/OpenAI helpers in server-only modules (e.g. `src/app/api/editor/outreach/_apify.ts`, `src/app/api/editor/outreach/_deepseek.ts`)
- **Multi-tenant account context**:
  - client attaches `x-account-id` header
  - server derives active account via `resolveActiveAccountId(...)`

---

## Proposed data model (minimal now, future-proof later)

We keep today’s “Outreach record” table (`public.editor_outreach_targets`) as the place where outreach runs are logged.

We add post/reel-specific fields to that same table (preferred) rather than creating a new table right now:
- `source_post_url` (text)
- `source_post_shortcode` (text)
- `source_post_caption` (text)
- `source_post_transcript` (text)
- `source_post_video_storage_bucket` (text) — always `reels` when present
- `source_post_video_storage_path` (text)
- `source_post_raw_json` (jsonb)
- `source_post_scraped_at` (timestamptz)

Rationale: we can later “promote” this into a first-class Project input system without losing any captured data.

---

## Proposed new endpoints + client services (shape only; implemented per phase)

### Server routes (superadmin-only, authed)

- `POST /api/editor/outreach/scrape-reel` → `src/app/api/editor/outreach/scrape-reel/route.ts`
  - Input: `{ reelUrl }`
  - Output: `{ ownerUsername, ownerFullName, caption, transcript, shortcode, reelUrl, raw }`
- `POST /api/editor/outreach/reel-video` → `src/app/api/editor/outreach/reel-video/route.ts`
  - Input: `{ reelUrl, shortcode, projectId }`
  - Output: `{ bucket: "reels", path }`
- `POST /api/editor/outreach/transcribe` → `src/app/api/editor/outreach/transcribe/route.ts`
  - Input: `{ bucket, path }`
  - Output: `{ transcript }`
- `POST /api/editor/outreach/topic-line` → `src/app/api/editor/outreach/topic-line/route.ts`
  - Input: `{ caption?: string, transcript?: string }`
  - Output: `{ topicLine }`

### Client services

Add functions to `src/features/editor/services/outreachApi.ts` so `OutreachModal.tsx` can call:
- `scrapeReel(...)`
- `downloadReelVideo(...)`
- `transcribeFromStoredVideo(...)`
- `generateTopicLine(...)`

All calls must pass `x-account-id` via `headers` (same pattern as the existing following-scrape services).

---

## Phased rollout strategy

### Phase 0 — Research + guardrails (no UI changes)

Deliverables:
- Confirm expected output fields from `apify/instagram-reel-scraper` we will rely on:
  - `ownerUsername`, `ownerFullName`, `caption`, `transcript` (optional), `downloadedVideo` (optional), `videoUrl`, `url`
- Decide a storage path format that scales:
  - recommended: `reels/accounts/{accountId}/projects/{projectId}/{shortcode}.mp4`
  - Note: we only know `projectId` after the project is created, so video download (when needed) happens **after** project creation.

Manual QA:
- Review actor docs + 1 example output in Apify console.
- Confirm transcript can be empty/missing (so fallback path is required).

Checkpoint: you confirm Phase 0 is OK.

---

### Phase 1 — Single profile UI toggle (no new backend yet)

Deliverables:
- Add a toggle in `OutreachModal.tsx` “Single profile” section:
  - `Mode: Reel/Post (default) | Profile`
- Input placeholder changes based on mode (profile vs post URL).
- No behavior change yet; buttons are disabled until inputs valid.

Manual QA:
- Toggle defaults to Reel/Post on open/reset.
- Switching mode updates helper text + placeholder.
- Existing Profile mode flow still works end-to-end.

Checkpoint: you confirm Phase 1 is OK.

---

### Phase 2 — Reel scrape API (Apify → normalized payload)

Deliverables:
- New server-only Apify helper in `src/app/api/editor/outreach/_apify.ts`:
  - `scrapeInstagramReelViaApify({ reelUrl, includeTranscript: true })`
  - Reads dataset items, returns the **first reel item** (one URL → one reel).
- New API route:
  - `POST /api/editor/outreach/scrape-reel`
  - Superadmin-only, returns normalized:
    - `ownerUsername`, `ownerFullName`, `caption`, `transcript`, `shortcode`, `reelUrl`, `raw`

Manual QA:
- Valid reel URL returns owner + caption.
- If transcript is missing, response still succeeds (transcript null/empty).
- Invalid URL returns clear 400/500 error.
- Ensure the actor call is bounded (timeouts) and cannot leak env secrets.

Checkpoint: you confirm Phase 2 is OK.

---

### Phase 3 — Client wiring: Reel scrape renders in modal

Deliverables:
- Add `outreachApi.scrapeReel(...)` (client service) and use it from `OutreachModal.tsx` in Reel/Post mode.
- Display in “Scraped data”:
  - owner full name
  - @owner username
  - post caption (clamped / scroll box)
  - transcript (clamped / scroll box)
  - raw JSON (collapsed) for debug

Manual QA:
- Scraping a reel shows fields immediately after completion.
- Re-scrape overwrites prior results cleanly.
- Profile mode remains unchanged and still works.

Checkpoint: you confirm Phase 3 is OK.

---

### Phase 4 — Storage: create `reels` bucket + store MP4 only when needed

Deliverables:
- Create Supabase Storage bucket: `reels`
  - Private bucket (recommended).
  - Note: bucket creation is **not** a SQL migration; do this in Supabase Storage UI (or via Supabase Storage management API if we standardize that later).
- New API route:
  - `POST /api/editor/outreach/reel-video`
  - Input: `reelUrl`, `shortcode`, `projectId`
  - Behavior:
    - If transcript missing/empty → run actor with `includeDownloadedVideo: true` OR reuse a second scrape call that includes it
    - Download the video server-side and upload to Supabase Storage `reels/accounts/{accountId}/projects/{projectId}/{shortcode}.mp4`
    - Return `{ bucket, path }`

Manual QA:
- When transcript is present: no MP4 call is made (confirm via logs/UI path).
- When transcript is empty: MP4 is stored in `reels` bucket and path is returned.
- Ensure errors are clear (download failed, upload failed).

Checkpoint: you confirm Phase 4 is OK.

---

### Phase 5 — Whisper fallback transcription

Deliverables:
- New API route:
  - `POST /api/editor/outreach/transcribe`
  - Input: `{ bucket, path }`
  - Downloads MP4 from storage, sends to Whisper using `OPENAI_API_KEY`, returns transcript text.
  - Audio extraction:
    - Prefer sending the MP4 directly if the provider accepts it.
    - If audio-only is required, add a small dependency (e.g. `ffmpeg-static`) and extract to mp3 server-side.
  - Saves transcript back into the in-memory modal state (client) and later to DB (Phase 7).

Manual QA:
- Force a reel without transcript → MP4 downloaded → Whisper returns transcript.
- Timeout/error handling: clear message and does not break the modal.

Checkpoint: you confirm Phase 5 is OK.

---

### Phase 6 — Topic line generation (DeepSeek)

Deliverables:
- New API route:
  - `POST /api/editor/outreach/topic-line`
  - Input: `{ caption?: string, transcript?: string }`
  - Output: `{ topicLine: string }` (short, clean, no quotes)
- Client inserts topicLine into the outreach caption template:
  - Example: “...from one of your recent posts about **{topicLine}**.”

Manual QA:
- With transcript present: topic line is relevant.
- With only caption present: topic line still works.
- Safe length bounds (avoid runaway responses).

Checkpoint: you confirm Phase 6 is OK.

---

### Phase 7 — Run outreach from Reel/Post (template + project + persist)

Deliverables:
- In Reel/Post mode, “Run outreach” does:
  1) Scrape reel metadata
  2) Ensure owner avatar URL exists (use existing profile scrape if needed)
  3) Create template
  4) Create Regular project + mappings
  5) Set outreach caption with topic line
  6) Persist outreach record to `editor_outreach_targets` including post fields + raw JSON
     - Requires DB columns: see migration `supabase/migrations/20260213_000002_extend_editor_outreach_targets_for_reel_sources.sql`
  7) If transcript missing/empty:
     - download MP4 → upload to `reels` bucket → Whisper transcript → persist transcript + storage path
     - Uses `POST /api/editor/outreach/update-target` to patch the already-persisted outreach record
  8) Set Review overlay fields (prefer existing store actions to keep behavior consistent):
     - `actions.onChangeProjectReviewSource({ projectId, next: <reel url> })`
     - `actions.onToggleProjectReviewReady({ projectId, next: true })`
  8) Load project in editor

Manual QA:
- End-to-end run from reel URL produces a project that loads automatically.
- “Source material…” shows the reel URL.
- “Ready” toggle is ON immediately.
- The caption contains the topic line and reads naturally.
- Profile mode still works end-to-end.

Checkpoint: you confirm Phase 7 is OK.

---

### Phase 8 — Polish + safety rails

Deliverables:
- Better progress labels in modal (“Scraping post…”, “Generating topic line…”, “Creating template…”, etc.)
- Batch-proofing (no accidental multiple submissions)
- Robust input validation:
  - Reel URL detection supports `/p/`, `/reel/`, `/tv/` if needed
- Observability: store `source_post_scraped_at`, transcript length, and whether Whisper fallback was used.
- Reel transcript fallback UX:
  - If transcript is missing and Whisper is running, show clear UI copy: “Transcribing… Copy will generate when ready.”
  - Project can load immediately; copy generation is deferred until transcript is ready (Phase 9/10).

Manual QA:
- No double-click dupes; reset is predictable; errors are recoverable.

Checkpoint: you confirm Phase 8 is OK.

---

### Phase 9 — “Best Practices” prompt (superadmin-only, per template type)

Goal:
- Add a new editable prompt block called **Best Practices** that is used **only** for Reel/Post outreach copy generation (Claude-only path).
- Keep all existing (non-outreach) Generate Copy behavior untouched.

Deliverables:
- DB:
  - Extend `public.carousel_template_type_overrides` with:
    - `best_practices_override text null`
  - Stored per `(account_id, template_type_id)` so Regular and Enhanced can differ.
- Server:
  - Update:
    - `GET /api/editor/template-types/effective` to return `bestPractices` in `effective`
    - `POST /api/editor/template-types/overrides/upsert` to accept `bestPracticesOverride`
  - Update merge helper (`mergeTemplateTypeDefaults`) to include `bestPractices`.
- UI (left-side prompts UI):
  - In `PromptsModal` (Poppy Prompt tab), add a new textarea **under** “Poppy Prompt”:
    - Label: “Best Practices”
    - Visible only to superadmins
    - Auto-saves like other prompt fields
  - Separate value per template type (`regular` vs `enhanced`).

Manual QA:
- As superadmin:
  - You can edit and save Best Practices for Regular and Enhanced independently.
  - Refresh page → values persist and load correctly.
- As non-superadmin:
  - Best Practices textarea is not shown.
  - Existing prompt UI is unchanged.

Checkpoint: you confirm Phase 9 is OK.

---

### Phase 10 — Auto “Generate Copy” for Reel/Post outreach (Claude-only, wait for Whisper)

Goal:
- When Reel/Post **Run outreach** finishes creating + loading the project, automatically run **Generate Copy** using **Claude Sonnet** + scraped reel caption/transcript.
- **Do not call Poppy** for Reel/Post outreach generation. Leave all other routes unchanged.

Key rules:
- Reel/Post only (Profile mode and all other Generate Copy paths remain Poppy-backed).
- If Apify transcript is missing:
  - Start Whisper transcription (MP4 → storage → Whisper)
  - Load the project immediately
  - Show UI message: “Transcribing… Copy will generate when ready.”
  - Only after Whisper transcript is ready, trigger Generate Copy.
- Reels are under 3 minutes (token blowups not a concern; no special clipping needed beyond basic safety).

Deliverables:
- Server: `POST /api/editor/projects/jobs/generate-copy`
  - Detect reel-origin projects by looking up `editor_outreach_targets.created_project_id = projectId`
  - If a reel-origin record exists:
    - Build a Claude prompt from:
      - Effective template-type “Poppy Prompt”
      - Effective template-type “Best Practices” (Phase 9)
      - Labeled reel source:
        - `REEL_CAPTION: ...`
        - `REEL_TRANSCRIPT: ...` (required; error if missing)
    - Ask Claude Sonnet to return the same 6-slide JSON shape the editor already consumes:
      - Regular: `{ slides: [{ body } x6], caption }`
      - Enhanced: `{ slides: [{ headline, body } x6], caption }`
    - Reuse existing emphasis-range generation + slide persistence unchanged.
  - For non-reel projects:
    - Keep existing Poppy → Claude-parse → emphasis → save behavior unchanged.
- Client: Reel/Post outreach orchestration (`OutreachModal`)
  - After project load + Source/Ready set:
    - If transcript exists: auto-trigger editor `Generate Copy` (same behavior as clicking the button)
    - If transcript missing: show “Transcribing…” state; once transcript arrives and outreach record is updated, then auto-trigger Generate Copy
  - Ensure correct timing so Generate Copy runs for the newly loaded project (avoid racing the editor’s current project id).
- Progress labels:
  - Add a new progress code/state for Claude-only generation (e.g. `progress:claude`) so the existing “Generating Copy…” UI shows a clear step label.

Manual QA:
- Reel with transcript present:
  - Run outreach → project loads → Generate Copy runs automatically (no manual click)
  - Slides 1–6 and caption populate with expected styling/emphasis
  - Confirm no Poppy routing metadata is required for this path
- Reel with transcript missing:
  - Run outreach → project loads immediately
  - UI shows “Transcribing… Copy will generate when ready.”
  - After Whisper completes, Generate Copy auto-runs and fills slides/caption
- Non-reel project:
  - Generate Copy behaves exactly as before (Poppy-backed)

Checkpoint: you confirm Phase 10 is OK.

---

## Per-change checklist (from EDITOR_CODEBASE_MAP)

- Keep UI in `src/features/editor/components/*`
- Keep server routes in `src/app/api/editor/outreach/*`
- Keep external integrations in server-only helpers (e.g. `_apify.ts`, `_deepseek.ts`)
- After each phase:
  - Update `docs/EDITOR_CODEBASE_MAP.md` (new files/routes/ownership)
  - Call out any new/changed editor state fields or actions
  - `npm run build` passes
  - Manual QA checklist above is executed

