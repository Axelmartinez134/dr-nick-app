# Editor Review / Approval Flow (Superadmin-only) — Phased Plan

This doc captures the **agreed MVP requirements** and a **phased implementation plan** for an editor-only carousel review workflow.

## Codebase / ownership rules (read first)

Follow `docs/EDITOR_CODEBASE_MAP.md`:
- Prefer **small, focused edits** that extend existing `src/features/editor/*` modules.
- Prefer UI changes in `src/features/editor/components/*`.
- Prefer orchestration/behavior in `src/features/editor/hooks/*`.
- Prefer API calls in `src/features/editor/services/*`.
- Keep `src/app/editor/EditorShell.tsx` as **composition/wiring**, not a dumping ground.
- Use the existing stable actions surface: **extend `state.actions`** instead of adding new handler surfaces.

Additional constraint from Axel:
- **Do not add dependencies** on non-editor parts of the app (marketing/health/admin). If patterns exist elsewhere, **copy the pattern into editor-owned code** (new files) and evolve independently.
- The review page route must live under `/editor`: **`/editor/review/<token>`**.

---

## Goals (what we are building)

### Primary outcome
Enable a simple, live “ready → client approval → VA download/scheduled” workflow for carousel projects:
- Superadmin marks a carousel **Ready for approval**
- Superadmin shares a **live link** to a review feed
- Client/VA can:
  - **Approve / unapprove**
  - **Leave a simple comment** (single overwritable note)
  - **Download** ZIP **only if approved**
  - VA can mark **Scheduled** (no auth; “VA step” label)

### Non-goals (explicitly out of scope for MVP)
- Snapshot-based sharing (link is **live**)
- Role-based permissions on the review link (no auth; anyone with token can act)
- Per-slide comments / threaded comment history
- Project dropdown color coding (explicitly “later”)
- PDF download on review page (review page uses ZIP only)
- Auto invariants between toggles (no automatic coupling)

---

## Roles & visibility rules

### Superadmin (inside `/editor`)
- Sees:
  - Canvas overlay review toggles
  - Top header action: **Share carousels**
  - Share modal (preview + toggles + copy link)
- Can toggle:
  - **Ready for approval**
  - **Posted**
  - (Also can see Approved/Scheduled state as read-only indicators unless we decide to allow toggling; MVP expects toggling by review link for Approved/Scheduled.)

### Non-superadmin editor users (inside `/editor`)
- Must **not** see:
  - Any review controls
  - Share carousels button/modal

### Review link visitors (client + VA, no auth)
Route: **`/editor/review/<token>`**
- Can:
  - Toggle **Approved**
  - Toggle **Scheduled** (labeled “VA step: Scheduled”)
  - Edit a single **comment** string (auto-save)
  - Download ZIP **only if Approved = true**

---

## Project-level status model (MVP)

Statuses are **project-level** (apply to the entire carousel project: all 6 slides + caption).

### Fields (conceptual)
- **Ready for approval**: boolean
- **Posted**: boolean (superadmin safeguard; if true, remove from queue)
- **Approved**: boolean (toggled on review link)
- **Scheduled**: boolean (toggled on review link; labeled “VA step”)
- **Comment**: text (single overwritable note; saved on typing/blur)

### Queue inclusion rule (MVP)
The review feed shows projects where:
- `Ready = true` AND `Posted = false`

Notes:
- **Scheduled does NOT remove from queue** in MVP (explicit requirement).
- **No invariants**: toggles do not automatically modify each other.

---

## Review link / token model

### URL shape
- `GET /editor/review/<token>`

### Token properties
- Permanent per account (MVP)
- Random / unguessable
- Stored server-side and used to resolve the active `account_id` for public reads/writes

---

## UI requirements (MVP)

### 1) `/editor` canvas overlay (superadmin only)
Overlay placement:
- Top-left area of the canvas region (near the slide/canvas UI), not baked into exports.

Controls:
- iOS-style toggles for:
  - Ready for approval
  - Posted
  - Approved (indicator; may be toggleable in share modal)
  - Scheduled (indicator; may be toggleable in share modal)

Feedback:
- Show inline status: **Saving… / Saved ✓ / Save Failed** consistent with existing editor pills.

### 2) `/editor` header: “Share carousels” (superadmin only)
- Button in top header.
- Opens a modal preview (see below).

### 3) Share carousels modal (superadmin only)
Purpose:
- “See what will be shared” before copying the link.

List/card content per project:
- Project title
- Status badges
- Slide 1 thumbnail (fast path: use already-rendered canvas when available; lazy-load ok)

Sorting:
- Newest updated → oldest.

Actions:
- All toggles available on each card (iOS switch for consistency).

Copy behavior:
- Copy URL to clipboard and show toast **“Copied ✓”**.

### 4) Review feed page: `/editor/review/<token>` (no auth)
Feed:
- Instagram-like: swipe + dots; no arrows.
- Each project card includes:
  - Carousel viewer
  - Caption (read-only, always expanded)
  - Toggle: Approved (iOS switch)
  - Toggle: “VA step: Scheduled” (iOS switch)
  - Comment textbox (single overwritable string; auto-save with Saving…/Saved)
  - Download ZIP button **only if Approved = true**
  - Copy caption button

Capacity:
- Up to ~40 Ready projects (performance must remain acceptable).

---

## Technical implementation plan (phases)

### Phase 0 — Final schema design + migrations
**End state**
- DB supports project review statuses and an account-level review token.

**Implementation**
- Add new columns to `public.carousel_projects`:
  - `review_ready boolean not null default false`
  - `review_posted boolean not null default false`
  - `review_approved boolean not null default false`
  - `review_scheduled boolean not null default false`
  - `review_comment text null`
- Add new column to `public.editor_account_settings`:
  - `review_share_token text null` (unique)
- Add index to support queue query, e.g.:
  - `(account_id, updated_at desc)` filtered by `review_ready = true AND review_posted = false AND archived_at is null`

**Testing criteria**
- Migration applies cleanly in Supabase.
- New columns exist with correct defaults.
- Query for “review queue” is fast and uses index (basic explain in Supabase SQL editor).

---

### Phase 1 — Superadmin-only editor APIs (authed)
**End state**
- `/editor` can:
  - ensure token exists
  - list queue preview
  - toggle status fields (superadmin-only)

**Implementation**
- Add new editor API routes under `src/app/api/editor/`:
  - `GET /api/editor/review/share-link`
    - verifies caller is superadmin (`editor_superadmins`)
    - resolves active account (`resolveActiveAccountId`)
    - creates `review_share_token` if missing (random token)
    - returns link: `/editor/review/<token>`
  - `GET /api/editor/review/queue-preview`
    - superadmin only
    - returns list of eligible projects (Ready=true, Posted=false)
  - `POST /api/editor/review/projects/update`
    - superadmin only
    - updates one project’s status fields (Ready/Posted; optionally all toggles if allowed)

**Testing criteria**
- As superadmin:
  - `share-link` returns a stable token across calls (per account).
  - `queue-preview` returns only ready & not posted.
  - `projects/update` persists and is reflected in subsequent `queue-preview`.
- As non-superadmin:
  - all endpoints return 403.

---

### Phase 2 — `/editor` UI: canvas overlay + “Share carousels” modal
**End state**
- Superadmin sees:
  - overlay toggles near canvas
  - “Share carousels” header option
  - modal preview list with toggles + copy link + toast
- Non-superadmin sees none of the above.

**Implementation**
- Extend editor store actions via `src/features/editor/hooks/useEditorStoreActionsSync.ts` (single actions surface).
- UI work in `src/features/editor/components/*`:
  - Add header action to `EditorTopBar.tsx` (superadmin-only).
  - Add a new modal component under `src/features/editor/components/` for preview + copy link.
  - Add overlay component near canvas (likely in `EditorSlidesRow.tsx` region, superadmin-gated).
- Ensure save UX uses existing pill patterns (“Saving…/Saved ✓/Error”).
- Slide 1 thumbnail:
  - Fast path: if a slide canvas ref exists for that project/slide, use it.
  - Otherwise show placeholder and lazy-load later (acceptable).

**Testing criteria**
- Superadmin:
  - toggles appear on canvas overlay and persist correctly.
  - Share modal lists correct projects and count.
  - Copy link works and toast shows “Copied ✓”.
- Non-superadmin:
  - no overlay toggles
  - no Share carousels button
  - cannot reach modal (no actions surface).

---

### Phase 3 — Public review APIs (token-based, no auth)
**End state**
- `/editor/review/<token>` can fetch live queue data and mutate Approved/Scheduled/Comment.

**Implementation**
- Add new routes under `src/app/api/editor/review-public/` (or similar editor-owned namespace):
  - `GET /api/editor/review-public/<token>`
    - resolves token → account_id
    - queries eligible projects (Ready=true, Posted=false)
    - fetches required slide data + caption + project title
    - includes enough template snapshots to render slides
  - `POST /api/editor/review-public/<token>/projects/<projectId>/approve`
  - `POST /api/editor/review-public/<token>/projects/<projectId>/schedule`
  - `POST /api/editor/review-public/<token>/projects/<projectId>/comment`
- All writes must:
  - validate project belongs to resolved account_id
  - never expose secrets

**Testing criteria**
- With a valid token:
  - GET returns only Ready & not Posted projects.
  - POST approve toggles value and persists.
  - POST schedule toggles value and persists.
  - POST comment overwrites comment and persists.
- With an invalid token:
  - GET/POST returns 404.

---

### Phase 4 — `/editor/review/<token>` page + feed UI
**End state**
- A live IG-like review feed that matches all UI specs.

**Implementation**
- Add a new route under `src/app/editor/review/[token]/page.tsx` (and any client components).
- Implement:
  - feed list (up to 40)
  - carousel viewer: dots + swipe; no arrows
  - caption always expanded + copy caption
  - iOS-style toggles: Approved and “VA step: Scheduled”
  - comment box with auto-save + status
  - Download ZIP button gated by Approved
- ZIP export:
  - implement an export path that can generate ZIP from the rendered slides (may need offscreen render/mount strategy so “download all” exports all 6 even if only one is visible).

**Testing criteria**
- Open `/editor/review/<token>`:
  - feed renders correct projects (live)
  - swipe works and dots reflect slide index
  - caption is read-only and always expanded
  - toggling Approved enables/disables Download ZIP immediately
  - toggling Scheduled updates state
  - comments auto-save and persist on refresh
  - download ZIP contains 6 slide PNGs for that project

---

### Phase 5 — Manual QA + docs updates
**End state**
- Docs reflect new ownership + QA plan.

**Implementation**
- Update `docs/EDITOR_CODEBASE_MAP.md`:
  - add a short section for “Review / Approval flow” ownership:
    - new API routes
    - new UI components
    - new `/editor/review/<token>` route
  - add Manual QA bullets for:
    - superadmin gating
    - review link flow
    - download gating

**Testing criteria**
- Manual QA checklist passes end-to-end.
- `npm run build` passes.

---

## Open items (explicitly acknowledged)
- Whether non-superadmin editor users should be prevented from seeing review fields in editor API payloads (network visibility). MVP likely hides UI only; optional to omit fields server-side.
- Whether Scheduled should eventually remove items from the queue (not MVP).
- Later: project dropdown color coding by status.

