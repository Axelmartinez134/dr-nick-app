# Swipe File (Linkwarden-based) — Feature Spec

## What this is
**Swipe File** is a **superadmin-only** area inside this web app for capturing, organizing, and later mining (with AI) social content discovered while scrolling (Instagram, TikTok, YouTube, X, blogs, etc.).

Primary intent:
- **Capture quickly from iPhone** (Share Sheet → Shortcut → web form)
- **Organize into categories** for outreach / repurposing / send-later
- **Build a searchable repertoire** you can refer back to
- **Enable downstream automation** (e.g., outreach queue, AI analysis of “why this worked”)

## Non-goals (for MVP)
- Not a feature for regular users (no multi-tenant end-user rollout yet)
- Not “Generate Copy” related; this is a separate content library system
- Not trying to perfectly archive every platform on day 1 (basic link capture is enough)

---

## Naming / UI placement
- Feature name in-product: **Swipe File**
- Entry point: **a superadmin-only nav/button** (similar to how existing superadmin-only features are gated)
- Route namespace (proposed): `/swipe-file`

---

## Primary user flows

### Flow A — iPhone capture (core)
1. On iPhone, you’re viewing a piece of content (IG Reel, TikTok, YouTube video, post, etc.).
2. Tap **Share** → choose a saved Shortcut: **“Save to Swipe File”**.
3. Shortcut opens a URL in the app like:
   - `/swipe-file/capture?url=<sharedUrlEncoded>`
4. Capture form appears with:
   - **URL** (pre-filled, editable)
   - **Category** (required)
   - **Tags** (optional)
   - **Notes** (optional, short)
   - **Brand/Context** (optional; e.g., “Automated Bots”, “Dr Nick”, “Personal”)
5. Submit → shows success + optional “Save another”.

### Flow B — browse / filter / act (library)
1. Open `/swipe-file`.
2. Default view shows newest first.
3. Filter by:
   - Category
   - Tag
   - Source (IG/TikTok/YouTube/etc.)
   - Status (new, reviewed, contacted, repurposed, sent, archived)
4. Click an item to see details:
   - Link preview metadata (title/description/thumb if available)
   - Notes + tags + category
   - Quick actions (copy link, open original, mark status)

### Flow C — outreach pipeline (future)
- From a Swipe item, create an **Outreach target/prospect** or attach it to an existing one.
- Track “messaged / followed / replied / booked” etc.

### Flow D — AI analysis (future)
- Run AI jobs that summarize why content works:
  - Hook style, structure, pacing, claim types, CTA patterns, visual style cues
  - Detect recurring patterns across saved items
- Enable Q&A over saved corpus:
  - “Show me 10 examples of reels using ‘myth vs truth’ hooks”
  - “What’s the common structure in my top saved outreach inspiration?”

---

## Categories (taxonomy)
Initial categories mentioned:
- **Carousel outreach** (people to reach out to)
- **Repurpose inspiration** (formats to adapt for your own brand)
- **Send later** (to girlfriend / friend / yourself later)

Also useful:
- **Competitor research**
- **Testimonials/social proof examples**
- **Hook ideas**
- **Offer/positioning inspiration**

Implementation detail:
- Categories should be **selectable at capture-time** (prompted flow).
- Categories should be **configurable** later (rename, add, reorder).

---

## Permissions / access control
Hard requirement:
- **Superadmin-only**. Regular app users should not see this UI or be able to hit its APIs.

Where the “superadmin” flag comes from:
- Reuse existing superadmin mechanism already present in the app (the same way current superadmin-only editor/outreach endpoints are gated).

---

## Data model (conceptual)
Entities:
- **SwipeItem**
  - id
  - owner_user_id (superadmin user)
  - account_id (if you want it account-scoped; optional for MVP)
  - url (canonical)
  - source_platform (derived: instagram/tiktok/youtube/x/web/unknown)
  - title (optional)
  - description (optional)
  - image_url / thumb_url (optional)
  - author_handle / channel_name (optional)
  - category_id
  - tags (many-to-many) or string array
  - notes (text)
  - status (new/reviewed/contacted/repurposed/sent/archived)
  - created_at, updated_at
  - captured_via (iphone-shortcut/web/manual)
  - raw_share_payload (optional; future)

- **SwipeCategory**
  - id
  - name
  - sort_order
  - created_at

- **SwipeTag** (optional for MVP; can be an array first)
  - id
  - name
  - created_at

AI outputs (future):
- **SwipeAnalysis**
  - swipe_item_id
  - model/version
  - summary
  - extracted_patterns (json)
  - created_at

---

## Pages / UI surfaces (MVP)
- `/swipe-file`
  - List view, filters, search, status badges
- `/swipe-file/capture`
  - Mobile-first capture form
  - Accepts `url` query param
- `/swipe-file/item/[id]`
  - Detail view, edit metadata, quick actions
- `/swipe-file/settings` (optional)
  - Manage categories (create/rename/reorder)

UX notes:
- Must be **fast on mobile**.
- Capture form should be **1-hand friendly**: big controls, minimal typing.

---

## API endpoints (MVP)
All endpoints are **superadmin-only**.

- `POST /api/swipe-file/items`
  - Create item from URL + category + tags + notes
- `GET /api/swipe-file/items`
  - List items with filters (category, tag, status, platform, search)
- `GET /api/swipe-file/items/:id`
  - Fetch one item
- `PATCH /api/swipe-file/items/:id`
  - Update category/tags/notes/status
- `GET /api/swipe-file/categories`
- `POST /api/swipe-file/categories`
- `PATCH /api/swipe-file/categories/:id`

Metadata enrichment (optional for MVP):
- `POST /api/swipe-file/enrich`
  - Given item id, fetch link preview metadata

---

## “We want to use Linkwarden” — how Linkwarden fits
You said you want to use **Linkwarden** as the underlying product/behavior reference.

### What we want from Linkwarden (capabilities to mirror)
- Link library with **collections/tags**
- Fast **capture** + organization
- Search/filter
- Optional metadata extraction / preview
- Optional archiving (later)

### Integration approaches
This spec keeps all 3 options explicit so we can choose deliberately:

#### Option 1 — **Fork Linkwarden (AGPL) and embed as “Swipe File”**
- Bring Linkwarden code into this repo (or as a sub-app).
- Rebrand UI/UX to “Swipe File”.
- Wire access to superadmin-only (either by:
  - using Linkwarden’s own auth with a single admin user initially, or
  - replacing auth with this app’s auth over time).

**Important license note**:
- Linkwarden is **AGPL-3.0**.
- If you copy/modify Linkwarden and run it as part of a network service, you must comply with AGPL requirements (notably: offering corresponding source code to users of that service).

#### Option 2 — **Run Linkwarden separately and integrate**
- Deploy Linkwarden as its own service (its own DB/auth).
- Add a “Swipe File” button here that links out (SSO later).
- Optionally push saved items into Linkwarden via its API.

#### Option 3 — **Build Swipe File natively in this app (Linkwarden-like behavior)**
- Implement the Swipe File features directly with this app’s stack (Next + Supabase).
- Use Linkwarden as UX/product inspiration, **without copying its code**.

---

## MVP checklist (concrete deliverables)
- **Superadmin gating**
  - Hide entry point for non-superadmins
  - Protect all Swipe File APIs server-side
- **Capture form**
  - Mobile-first `/swipe-file/capture`
  - Category required, tags optional, notes optional
  - Accept prefilled `url` query param
- **Library**
  - `/swipe-file` list view
  - Filter by category + status
  - Basic search (URL/title/notes)
- **Categories management**
  - Seed default categories
  - Minimal UI to add/rename categories (or admin-only quick seed in DB for MVP)
- **Persistence**
  - Saved items must persist in DB immediately

---

## Future expansions (explicitly desired)
- **Scheduled send-later**: cron job that sends you a digest or reminders
- **Outreach integration**: create/attach outreach targets from Swipe items
- **AI analysis**: summarize and extract patterns, corpus Q&A
- **Archiving**: store snapshots/video metadata where allowed (platform limitations apply)

