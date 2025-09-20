### Marketing Links — Roadmap, Backlog, Skills, and Risks

This document captures the full plan we agreed to for the Marketing Links project: what we’re building, how it works, the implementation backlog (small, chronological tickets for a solo dev), skills and definitions, and known risks/mitigations.

---

## 1) What we’re building (non-technical overview)

- A branded, mobile‑first client story page (one link per client) designed for Instagram in‑app viewing.
- A simple Admin flow to create, edit (as a Draft), preview, and publish each link as an immutable snapshot.
- A stable alias (e.g., `/m/andrea`) that always serves the latest published version server‑side (no redirect); older versions keep their own versioned slugs.
- A consistent, clean template across all clients with collapsible sections ("choose‑your‑own‑adventure").
- Light analytics (Views, CTA Clicks) and basic share management.

Public page (what viewers see)
- Logo + tagline: "Become the Fittest Version of Yourself."
- Identity: First name or "Client {SHORTID}" (anonymous).
- Unit toggle: Imperial default; Metric available.
- Compliance summary cards (top of page):
  - Total Weight Loss %
  - Weekly Weight Loss %
  - Avg Nutrition Compliance % (two decimals)
  - Avg Purposeful Exercise Days (0–7)
- Optional Hero media: Before/After photos, short MP4 loop, or GIF.
- Smart caption pill: Total Loss %, Last Week %, Goal %/week (ON by default).
- Charts (animated, mobile‑friendly):
  - Default ON: Weight Trend; Weight Projection; Plateau Prevention — Weight (with key number at right end)
  - Optional (collapsed): Waist Trend; Plateau Prevention — Waist; Nutrition/Macronutrient Compliance; Sleep Consistency; Morning Fat Burn; Body Fat %
- Fit3D (images or YouTube) — collapsible
- Metabolic/Cardio testing (DocSend embed) — collapsible
- Testimonials/Video (YouTube) — collapsible
- CTAs: Sticky CTA (always visible) + four inline CTA blocks (after Hero, after Charts, after DocSend, above footer)

Admin (what you see)
- Create Link (wizard): Client & display → Defaults → Branding & CTA → Snapshot summary → Publish
- Editor (Draft): Upload media, add URLs, toggle sections/charts; auto‑save; Publish creates new immutable version
- Preview: True‑to‑public rendering of the current Draft
- Shares Manager: Copy, View, Duplicate (seed Draft), Revoke; shows Views and CTA Clicks

Behavioral guarantees
- Snapshot (not live): published pages are stable and fast.
- Alias redirects to latest version; versioned slugs persist for history.
- Performance: small initial JS; lazy‑load optional sections; precomputed series; MP4 loops preferred over GIFs.
- Animations: default 8s; hard cap 10s.

---

## 2) Ticket backlog (chronological, solo‑dev friendly)

Format: Title; Description; Acceptance; Dependencies

1. Create DB tables: marketing_shares and marketing_aliases
- Description: Add immutable snapshots table and alias mapping table for no‑redirect alias SSR.
- Acceptance:
  - `marketing_shares` exists with columns: id (uuid pk), slug (text unique), patient_id (uuid), snapshot_json (jsonb), schema_version (int, default 1), created_by (uuid), created_at (timestamptz default now), revoked_at (timestamptz), view_count (int default 0), cta_click_count (int default 0); FK patient_id → profiles(id)
  - Index on slug; index on patient_id
  - `marketing_aliases` exists with columns: alias (text pk unique, lowercase), current_slug (text), patient_id (uuid), created_by (uuid), created_at (timestamptz default now), updated_at (timestamptz default now); FKs: current_slug → marketing_shares(slug), patient_id → profiles(id); unique index on lower(alias)
  - On revoke of current slug, app logic falls back alias to previous active snapshot
- Dependencies: none
 - Status: completed (migrated to Supabase). Notes: created pgcrypto extension; added updated_at trigger; FKs set (patient_id CASCADE, current_slug RESTRICT); alias is case‑insensitive unique via unique index on lower(alias).

2. Snapshot builder (server)
- Description: Build a server utility that fetches weekly data, computes metrics, precomputes ALL chart series, and produces compact `snapshot_json` (schema_version=1).
- Acceptance:
  - Returns JSON with meta, metrics, weeks, derived series for all supported charts, and media placeholders
  - Uses nutrition_compliance_days (two‑decimal %), purposeful_exercise_days (1–7)
  - Computes Plateau Prevention — Weight/—Waist; Weight Trend; Projections; others
  - Pins selected media at publish into `marketing-assets/{slug}/...` and points `snapshot_json.media` to the pinned URLs (asset pinning)
- Dependencies: 1
 - Status: completed (implemented snapshot types, normalize helper, data loaders, derived series, summary metrics, asset pinning, and `snapshotBuilder`; unit tests passing)

3. API: POST /api/marketing/shares (create)
- Description: Auth route to create a share (from Editor/Wizard). Validates alias uniqueness; builds snapshot; inserts row; returns versioned slug + alias.
- Acceptance:
  - 400 if alias taken
  - 200 with { slug, alias } on success; row saved with snapshot_json
- Dependencies: 1, 2

4. API: GET /api/marketing/shares/[slug] (public fetch)
- Description: Public route returns snapshot payload for a versioned slug if not revoked; increments view_count; cache headers set.
- Acceptance:
  - 200 with snapshot JSON; view_count incremented
  - 410 if revoked
  - Cache-Control added (public, s-maxage, stale-while-revalidate)
- Dependencies: 1, 2

5. Public alias page: app/m/[alias]/page.tsx (no redirect)
- Description: Server-render the latest active snapshot for an alias; anchors preserved.
- Acceptance:
  - SSR returns latest snapshot content for alias
  - If no active snapshots: show friendly "This page is not available" + CTA to home (no 3xx)
- Dependencies: 1, 3

6. API: POST /api/marketing/shares/[slug]/revoke
- Description: Auth route sets revoked_at; future GET returns 410; alias should skip revoked version.
- Acceptance:
  - 200 on success; subsequent fetch is 410; alias target updates to next latest if exists
- Dependencies: 1, 3

7. API: POST /api/marketing/shares/[slug]/click (CTA)
- Description: Public route increments cta_click_count when CTA pressed.
- Acceptance:
  - 200 increment
- Dependencies: 1

8. Storage: create public bucket `marketing-assets`
- Description: Create Supabase Storage bucket; set CORS; define upload conventions for library assets and snapshot‑pinned assets (`marketing-assets/lib/...` and `marketing-assets/{slug}/...`).
- Acceptance:
  - Bucket exists; tested upload/read
  - Publish step copies chosen media into `marketing-assets/{slug}/...` (asset pinning) and uses those URLs in snapshots
- Dependencies: none

9. Public versioned page: app/m/[slug]/page.tsx
- Description: Build viewer page that renders from snapshot; supports anchors; unit toggle; collapsible sections; CTA logic.
- Acceptance:
  - Renders Logo+tagline, Identity, Unit toggle, Compliance cards
  - Renders Hero (if provided), Smart caption pill (default on)
  - Charts: default three expanded; optionals collapsed; animations default 8s (cap 10s)
  - Plateau Prevention — Weight shows black number to the right (grid padding + end label)
  - Fit3D (images or YouTube), Testing (DocSend), Testimonials (YouTube), all collapsible
  - Sticky CTA + inline CTAs (after Hero, after Charts, after DocSend, above footer); sticky hides when an inline CTA is in view
- Dependencies: 4, 7

10. Admin: Create Link (Wizard)
- Description: Wizard UI with 4 steps: Client & display; Defaults; Branding & CTA; Snapshot summary → Publish (creates versioned slug + alias).
- Acceptance:
  - Validates alias uniqueness; shows friendly error if taken
  - Uses defaults (charts, layout, captions on, Imperial)
  - On Publish, calls create API; shows success with Copy Link + Open
- Dependencies: 3, 8

11. Admin: Editor (Draft) with auto‑save
- Description: Structured form sections: Charts; Media (Before/After, loop MP4, Fit3D images/YouTube, DocSend, Testimonial YouTube); Branding; CTA; Identity; Settings. Auto‑save Draft JSON.
- Acceptance:
  - File uploads to `marketing-assets/{slug}/...`; validates size/type; previews
  - Toggles for optional sections; chart checkboxes (core three locked on)
  - “Publish snapshot” creates new versioned slug and updates alias target
- Dependencies: 8, 3

12. Admin: Preview (true‑to‑public)
- Description: Preview the Draft using the same components as public page (without publishing).
- Acceptance:
  - Mirrors public view; supports anchors; animations; CTA behavior
- Dependencies: 9, 11

13. Admin: Shares Manager
- Description: Table of shares with columns: Client label; Created; Charts; Layout; Captions; CTA; Views; CTA Clicks; Status. Row actions: Copy, View, Duplicate, Revoke.
- Acceptance:
  - Duplicate seeds a new Draft from the selected snapshot
  - Revoke sets revoked_at; alias target auto‑updates to latest
- Dependencies: 3, 6, 7

14. Compliance charts and summary cards
- Description: Add Nutrition Compliance % (two decimals) and Purposeful Exercise Days (1–7) charts with regression lines; compute top‑page averages for both.
- Acceptance:
  - Charts render in optional section; cards show correct averages
- Dependencies: 2, 9

15. Chart polish and fixes
- Description: Apply polish: smooth animations; stable axes; minimal tooltips; tap‑to‑view values; recompute Weight Trend vs Projections on unit/initial‑weight changes; fix BP Y‑axes.
- Acceptance:
  - Visual QA across devices; regressions resolved
- Dependencies: 9

16. Unit toggle consistency
- Description: Ensure all numbers/axes/caption pill respect unit toggle; add optional text callouts for Fit3D/Testing that convert units dynamically (not inside PDFs/videos).
- Acceptance:
  - Toggle converts all relevant on‑page numeric callouts
- Dependencies: 9, 12

17. Performance hardening
- Description: Code‑split heavy components; lazy‑load optional sections on expand; preconnect assets; confirm initial JS budget.
- Acceptance:
  - Lighthouse/Perf checks; smooth in IG in‑app; no jank on animation
- Dependencies: 9

18. Documentation & handoff
- Description: Create one‑pagers: “Create a link in 60s,” “Update media & publish,” “Understand Views & CTA Clicks.”
- Acceptance:
  - Markdown docs added to repo; linked from Admin
- Dependencies: 10–17

---

## 3) Skills you’ll learn (and quick definitions)

- Next.js App Router APIs
  - Dynamic routes (`app/m/[alias]/page.tsx`, `app/m/[slug]/page.tsx`), Route Handlers (`/api/...`), cache headers
  - Migration file: `add_marketing_links_tables.sql`
- Supabase SQL & Storage
  - Designing tables, indexing slugs & alias, atomic counters, storage buckets & public URLs
- Snapshot architecture
  - Precomputing chart series so public pages are fast and consistent
- Slug vs Alias (definition)
  - Slug: the immutable, versioned URL (e.g., `/m/andrea-2025-09-15-1`)
  - Alias: a vanity path (e.g., `/m/andrea`) that server‑renders the latest snapshot (no redirect)
- ECharts animation & labeling
  - Smooth reveal; stable axes; placing labels outside plot via grid padding + offsets
- IntersectionObserver & sticky CSS
  - Toggling the global sticky CTA off when an inline CTA enters viewport
- Web performance in IG’s in‑app browser
  - Keep initial JS small; lazy‑load; MP4 over GIF; precompute data
- Media optimization
  - Use WebP/JPG for photos; MP4 for loops; size targets for quick loads

---

## 4) Risks and mitigations

- DocSend availability
  - Risk: External docs may be slow or unavailable. Mitigation: lazy‑load on expand; show fallback message.
- Heavy media sizes
  - Risk: Large GIFs/images hurt load. Mitigation: prefer MP4 loops; enforce size/type checks; inline guidance.
- Alias collisions
  - Risk: Duplicate names (e.g., /m/andrea). Mitigation: validate uniqueness; prompt to choose a different alias.
- IG in‑app browser quirks
  - Risk: Autoplay/touch issues. Mitigation: muted, playsInline MP4; minimize tooltips; test on iOS/Android.
- Caching/version drift
  - Risk: Stale content served. Mitigation: alias→latest immutable slug; cache headers with SWR; revalidation on publish.

---

## 5) Defaults recap (for reference)

- Charts (default ON): Weight Trend; Weight Projection; Plateau Prevention — Weight (number at right)
- Optional charts: Waist Trend; Plateau Prevention — Waist; Nutrition Compliance; Sleep Consistency; Morning Fat Burn; Body Fat %
- Compliance cards: Total Loss %; Weekly Loss %; Avg Nutrition %; Avg Purposeful Exercise Days
- Animations: default 8s; hard cap 10s
- Anchors: #charts, #photos, #fit3d, #testing, #testimonial, #cta
- Watermark (optional): "The Fittest You"
- Assets bucket: `marketing-assets`
- Tagline: "Become the Fittest Version of Yourself."

