### Marketing Links — Roadmap, Backlog, Skills, and Risks

This document captures the full plan we agreed to for the Marketing Links project: what we’re building, how it works, the implementation backlog (small, chronological tickets for a solo dev), skills and definitions, and known risks/mitigations.

---

## 1) What we’re building (non-technical overview)

- A branded, mobile‑first client story page (one link per client) designed for Instagram in‑app viewing.
- A simple Admin flow to create, edit (as a Draft), preview, and publish each link as an immutable snapshot.
- A stable alias (e.g., `/andrea`) that always serves the latest published version server‑side (no redirect); older versions keep their own versioned slugs at `/version/{slug}`.
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
- Alias SSRs the latest version (no redirects); versioned slugs persist for history.
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
 - Status: completed (implemented in `src/app/api/marketing/shares/route.ts`)

4. API: GET /api/marketing/shares/[slug] (public fetch)
- Description: Public route returns snapshot payload for a versioned slug if not revoked; increments view_count; cache headers set.
- Acceptance:
  - 200 with snapshot JSON; view_count incremented
  - 410 if revoked
  - Cache-Control added (public, s-maxage, stale-while-revalidate)
- Dependencies: 1, 2
 - Status: completed (implemented in `src/app/api/marketing/shares/[slug]/route.ts`)

5. Public alias page: app/[alias]/page.tsx (no redirect)
- Description: Server-render the latest active snapshot for an alias; anchors preserved.
- Acceptance:
  - SSR returns latest snapshot content for `/${alias}` with no redirects.
  - If no active snapshots: show friendly "This page is not available" + CTA to home (no 3xx).
  - Identity header: first name or anonymized label per snapshot settings.
  - Unit toggle: Imperial default; Metric available; all numeric callouts honor toggle.
  - Compliance summary cards: Total Loss %, Weekly Loss %, Avg Nutrition %, Avg Purposeful Exercise Days.
  - Charts: default ON expanded — Weight Trend, Weight Projection, Plateau Prevention — Weight (with end label number). Optionals collapsed — Waist Trend; Plateau Prevention — Waist; Nutrition Compliance; Sleep Consistency; Morning Fat Burn; Body Fat %.
  - CTA behavior: sticky CTA always visible; four inline CTA blocks; sticky hides when an inline CTA is in view.
  - Layout: mobile‑first 9:16 aspect; clean vertical story layout; stable axes; smooth animations (default 8s, cap 10s).
  - Anchors supported: #charts, #photos, #fit3d, #testing, #testimonial, #cta.
  - Cache headers appropriate for public viewing (short SWR + revalidate on publish).
 - Dependencies: 1, 3
 - Status: completed
   - Notes:
     - Implemented server-rendered alias page (`/areg` example) with client-parity copy for all charts.
     - Swapped in client `PlateauPreventionChart` to match visuals/average label; resolved overflow by removing outer fixed-height wrapper.
     - Weight Trend/Projections ECharts adjusted to mirror client behavior: hidden internal titles, cleaned axis ticks, red actual line, black trend line; added below-chart legend with color indicators.
     - Optional charts (Waist, Sleep, Morning Fat Burn, Body Fat) use client-facing titles/descriptions/bullets; captions placed outside embedded components.
     - CTAs are in-flow per-section during editing (no fixed CTA); version page CTA also converted to in-flow.
     - Cache headers preserved; anchors exist; unit toggle supported.

6. API: POST /api/marketing/shares/[slug]/revoke
- Description: Auth route sets revoked_at; future GET returns 410; alias should skip revoked version.
- Acceptance:
  - 200 on success; subsequent fetch is 410; alias target updates to next latest if exists
- Dependencies: 1, 3
 - Status: completed
   - Notes:
     - Implemented POST `/api/marketing/shares/[slug]/revoke`.
       - Sets `revoked_at` (idempotent: second call returns status without error).
       - Finds aliases pointing at the slug and updates `current_slug` to the latest non‑revoked snapshot for the same `patient_id`.
       - Returns JSON summary: `{ status, slug, alreadyRevoked, aliasUpdated, newAliasSlug }`.
     - `GET /api/marketing/shares/[slug]` returns 410 (Gone) for revoked slugs (existing behavior confirmed).
     - Alias resolver remains case‑insensitive and now reliably returns the latest non‑revoked slug.
     - Manual smoke tests passed: revoke newest → alias falls back to previous; revoke again → no‑op; revoke with no fallback → alias shows "not available" until a new snapshot is published.

7. API: POST /api/marketing/shares/[slug]/click (CTA)
- Description: Public route increments cta_click_count when CTA pressed.
- Acceptance:
  - 200 increment
- Dependencies: 1
 - Status: completed
   - Notes:
     - Minimal implementation shipped: aggregate-only counter, no dedup, no bot filter.
     - Endpoint: `POST /api/marketing/shares/[slug]/click` validates slug (not revoked) and increments `marketing_shares.cta_click_count`.
     - Supabase SQL function added in prod: `public.increment_cta_click(_slug text)`; API calls `supabase.rpc('increment_cta_click', { _slug })`.
     - Wired ALL CTAs on the alias page to post clicks with labels: `after_charts`, `after_photos`, `after_testing`, `after_testimonials`.
     - Future upgrade path: add events table for timestamps/dedup without changing the endpoint contract; optional bot filtering.

8. Storage: create public bucket `marketing-assets`
- Description: Create Supabase Storage bucket; set CORS; define upload conventions for library assets and snapshot‑pinned assets (`marketing-assets/lib/...` and `marketing-assets/{slug}/...`).
- Acceptance:
  - Bucket exists; tested upload/read
  - Publish step copies chosen media into `marketing-assets/{slug}/...` (asset pinning) and uses those URLs in snapshots
- Dependencies: none
 - Status: completed
   - Notes (implementation record):
     - Bucket created as public via SQL (idempotent):
       ```sql
       insert into storage.buckets (id, name, public)
       values ('marketing-assets', 'marketing-assets', true)
       on conflict (id) do update set name = excluded.name, public = excluded.public;
       ```
     - Public read policy for this bucket (idempotent):
       ```sql
       do $$
       begin
         if not exists (
           select 1 from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and policyname = 'Public read for marketing-assets'
         ) then
           create policy "Public read for marketing-assets"
             on storage.objects
             for select
             to anon, authenticated
             using (bucket_id = 'marketing-assets');
         end if;
       end $$;
       ```
     - CORS: Supabase Storage serves permissive CORS by default; no per‑bucket CORS UI. If restriction is needed later, place a proxy in front (e.g., Vercel Edge/Cloudflare) and set headers there.
     - Pin‑on‑publish integrated:
       - `snapshotBuilder` calls `pinAssets` to copy provided media to stable, versioned paths before DB insert.
       - Destination paths (spec‑aligned):
         - Photos: `marketing-assets/{slug}/photos/before.*`, `.../photos/after.*`
         - Videos: `marketing-assets/{slug}/videos/loop.*`
         - Fit3D images/videos: `marketing-assets/{slug}/fit3d/NN.*`
       - External references (YouTube `youtubeId`, DocSend URLs) are not copied; they remain external.
       - Supported types for pinning: photos `jpg/jpeg/png/webp`; loop videos `mp4`.
       - Draft sources may live under `marketing-assets/drafts/{any}/...`; drafts are left in place after publish (cleanup deferred).
     - Atomic publish guard:
       - In `POST /api/marketing/shares`, if any provided media fails to pin, the API returns 500 and does not insert a row or advance the alias (prevents partial/broken snapshots).
     - Library area created for future shared assets: `marketing-assets/lib/branding/` (e.g., `logo.svg`, `watermark.png`).
   - How to manually publish & verify (for future):
     1) Upload draft media to any public URL (e.g., `marketing-assets/drafts/{id}/...`) and copy the public URLs.
     2) Call `POST /api/marketing/shares` with those URLs in `settings.selectedMedia`.
     3) On success, verify pinned files under `marketing-assets/{slug}/...` and confirm `marketing_shares.snapshot_json.media.*` now contains only pinned URLs.
     4) Open `/{alias}` and ensure assets resolve.
   - Troubleshooting:
     - 500 on publish: at least one provided URL was unreachable; ensure the source URLs are public and valid, then retry.
     - Missing pinned file: check Storage under the expected path and confirm content type by extension; rerun publish.
     - Bucket/Policy checks:
       ```sql
       select id, name, public from storage.buckets where id = 'marketing-assets';
       select policyname, roles, cmd from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname = 'Public read for marketing-assets';
       ```

9. Public versioned page: app/version/[slug]/page.tsx
- Description: Build viewer page that renders from snapshot; supports anchors; unit toggle; collapsible sections; CTA logic.
- Acceptance:
  - Renders Logo+tagline, Identity, Unit toggle, Compliance cards
  - Renders Hero (if provided), Smart caption pill (default on)
  - Charts: default three expanded; optionals collapsed; animations default 8s (cap 10s)
  - Plateau Prevention — Weight shows black number to the right (grid padding + end label)
  - Fit3D (images or YouTube), Testing (DocSend), Testimonials (YouTube), all collapsible
  - Sticky CTA + inline CTAs (after Hero, after Charts, after DocSend, above footer); sticky hides when an inline CTA is in view
- Dependencies: 4, 7
 - Status: completed
   - Notes (implementation record):
     - Added SSR page at `app/version/[slug]/page.tsx`; `dynamic = 'force-dynamic'`, `noindex` set.
     - Fetches snapshot via internal API `GET /api/marketing/shares/[slug]` (increments view_count, cache headers respected).
     - Friendly revoked UI: if API returns 410, page renders a “This version was revoked” screen (HTTP 200 for simplicity).
     - Rendering uses the same `AliasStoryClient` as alias pages for full parity; passes `shareSlug=slug` and `pageType='version'` so CTA clicks are recorded with page context.
     - Old route `app/m/version/[slug]/page.tsx` removed.
     - Anchors supported: `#charts`, `#photos`, `#fit3d`, `#testing`, `#testimonial`, `#cta`.
   - How to verify:
     - Open `/version/{activeSlug}` → snapshot renders; CTAs post; view_count increments.
     - Revoke a slug, open `/version/{revokedSlug}` → friendly revoked screen appears.

10. Admin: Create Link (Wizard)
- Description: Wizard UI with 4 steps: Client & display; Defaults; Branding & CTA; Snapshot summary → Publish (creates versioned slug + alias).
- Acceptance:
  - Validates alias uniqueness; shows friendly error if taken
  - Uses defaults (charts, layout, captions on, Imperial)
  - On Publish, calls create API; shows success with Copy Link + Open
- Dependencies: 3, 8
 - Status: completed
   - Notes (implementation record):
     - Placement: A compact "Create Link" card added at the TOP of `MarketingTab` (no new route).
     - Data: Patient selector reuses the existing profiles source from the Marketing tab (no active filter).
     - Alias: Live sanitize (via `aliasUtils.sanitizeAlias`) with case-insensitive availability check using `GET /api/marketing/aliases/{alias}`.
       - Validation gates: patient required; alias valid/allowed; alias not taken by another patient. Publish disabled until valid.
       - If alias belongs to the same patient, server allows and advances alias; UI messaging indicates advance behavior.
     - Defaults (kept simple; read-only in wizard):
       - layout: `stack`; captions: ON; unit: Imperial (locked)
       - chartsEnabled: weightTrend/projection/plateauWeight = ON; waistTrend/plateauWaist/nutritionCompliancePct/sleepTrend/morningFatBurnTrend/bodyFatTrend = OFF
     - Publish: Calls `POST /api/marketing/shares` with the selected `patientId`, validated `alias`, defaults, and empty `selectedMedia` (uploads come in Step 11).
     - Success UI: Shows { slug, alias } with buttons + copy for `/{alias}` and `/version/{slug}`.
     - Errors: Inline alias errors; simple toast/alert for network/server issues; button disabled while submitting.
     - Security: Lives on admin-only Marketing tab; server-only publish endpoint; no service keys in the client.
   - How to verify:
     - Select patient, enter available alias → Publish → open Alias and Version links.
     - Enter taken alias (other patient) → inline error; publish disabled.
     - Use an alias already owned by the same patient → Publish allowed; alias advances.

11. Admin: Editor (Draft) with auto‑save
- Description: Structured form sections: Charts; Media (Before/After, loop MP4, Fit3D images/YouTube, DocSend, Testimonial YouTube); Branding; CTA; Identity; Settings. Auto‑save Draft JSON.
- Acceptance:
  - File uploads to `marketing-assets/{slug}/...`; validates size/type; previews
  - Toggles for optional sections; chart checkboxes (core three locked on)
  - “Publish snapshot” creates new versioned slug and updates alias target
- Dependencies: 8, 3
 - Status: completed
   - Notes (succinct record):
     - Placement: `app/admin/marketing/editor/[draftId]` SSR page with admin guard; Wizard success offers "Continue editing" deep‑link.
     - Autosave: ~700ms debounce to `marketing_drafts`; preview uses `GET /api/marketing/drafts/[id]/preview` and `snapshotPreviewBuilder` (no pinning).
     - Uploads: proxied via server route to `marketing-assets/drafts/{draftId}/...`; leaves files on remove (cleanup later).
     - Preview: Renders `AliasStoryClient` for true client‑parity; honors `chartsEnabled` flags.
     - Publish: Button calls `POST /api/marketing/shares` with settings + draft media; atomic pin/publish enforced in API; alias advances on success.
     - Charts: All implemented charts default ON in Editor (weight trend, projections, plateau weight, waist trend, sleep, morning fat burn, body fat). `plateauWaist` and `nutritionCompliancePct` deferred (flags present, default OFF) → tracked in Step 15.
     - Labels/Order: Editor toggle labels match public chart titles; order mirrors alias page.
     - Branding/CTA: Watermark removed; `TAGLINE`, `CTA_LABEL`, `CALENDLY_URL` centralized in `marketingConfig.ts`; CTA not editable in Editor.
     - Testing: DocSend embedded via centralized `DOCSEND_URL`, overridable per draft (`media.testing.docsendUrl`).
     - Media: Hero Before/After supports MP4; After renders on right; Fit3D (max 2) supports images/MP4 + optional YouTube ID; hero ignores Fit3D.
     - UI: High‑contrast text/buttons per design guidance.

12. Admin: Preview (true‑to‑public)
- Description: Preview the Draft using the same components as public page (without publishing).
- Acceptance:
  - Mirrors public view; supports anchors; animations; CTA behavior
- Dependencies: 9, 11
 - Status: completed
   - Notes (succinct record):
     - Preview component renders `AliasStoryClient` with snapshot from `GET /api/marketing/drafts/[id]/preview` (built via `snapshotPreviewBuilder`, no pinning).
     - Anchors and animations match public; CTAs use same layout but preview path avoids recording analytics events.
     - Editor layout: two‑column (left panels, right live preview), updates after each autosave.

13. Admin: Shares Manager
- Description: Table of shares with columns: Client label; Created; Charts; Layout; Captions; CTA; Views; CTA Clicks; Status. Row actions: Copy, View, Duplicate, Revoke.
- Acceptance:
  - Duplicate seeds a new Draft from the selected snapshot
  - Revoke sets revoked_at; alias target auto‑updates to latest
- Dependencies: 3, 6, 7
 - Status: completed
   - Notes (succinct record):
     - UI: `LinkManager` added at top of `MarketingTab` (above Content Creation Studio). Collapsible header is fully clickable with hover glow; high‑contrast text; no blue focus ring.
     - Data: `GET /api/marketing/links` joins aliases/shares/profiles; supports search, sort (updated/views/cta), and pagination.
     - Columns: Client, Alias, Current version, Published date, Views, CTA.
     - Actions: Open Alias, Open Version, Copy URLs, Continue editing (seeds draft from latest), Change Display Label (seeds draft), Revoke current version.
     - Behavior: Only active (non‑revoked) versions listed; list refreshes after revoke.

14. Compliance charts and summary cards
- Description: Add Nutrition Compliance % (two decimals) and Purposeful Exercise Days (1–7) charts with regression lines; compute top‑page averages for both.
- Acceptance:
  - Charts render in optional section; cards show correct averages
- Dependencies: 2, 9
 - Status: planned
   - Notes: Keep both charts optional behind toggles by default on marketing pages.

15. Chart polish and fixes
- Description: Apply polish: smooth animations; stable axes; minimal tooltips; tap‑to‑view values; recompute Weight Trend vs Projections on unit/initial‑weight changes; fix BP Y‑axes.
- Acceptance:
  - Visual QA across devices; regressions resolved
- Dependencies: 9
 - Status: planned
   - Notes: Client‑parity is the baseline; reuse the exact client chart components where possible; normalize any wrapper behavior so marketing looks identical.
    - Implement missing optional marketing charts not yet rendered:
      - Plateau Prevention — Waist (uses existing derived series `plateauWaist`)
      - Nutrition Compliance % (uses existing derived series `nutritionCompliancePct`)
    - Render both as optional, collapsed sections on alias and preview pages; honor `chartsEnabled.plateauWaist` and `chartsEnabled.nutritionCompliancePct`.
    - Ensure Editor chart toggles match public labels exactly and map 1:1 to flags.
    - After implementing these charts, update Editor defaults so these toggles are available and consistent with public behavior.

16. Unit toggle consistency
- Description: Ensure all numbers/axes/caption pill respect unit toggle; add optional text callouts for Fit3D/Testing that convert units dynamically (not inside PDFs/videos).
- Acceptance:
  - Toggle converts all relevant on‑page numeric callouts
- Dependencies: 9, 12
 - Status: planned
   - Notes: Verify axes labels, derived numbers, caption text reflect unit changes uniformly across all charts/sections.

17. Performance hardening
- Description: Code‑split heavy components; lazy‑load optional sections on expand; preconnect assets; confirm initial JS budget.
- Acceptance:
  - Lighthouse/Perf checks; smooth in IG in‑app; no jank on animation
- Dependencies: 9
 - Status: planned
   - Notes: Lazy‑load optional sections; code‑split heavy chart bundles; preconnect to asset/CDN origins; maintain small initial JS.

18. Documentation & handoff
- Description: Create one‑pagers: “Create a link in 60s,” “Update media & publish,” “Understand Views & CTA Clicks.”
- Acceptance:
  - Markdown docs added to repo; linked from Admin
- Dependencies: 10–17
 - Status: planned
   - Notes: Prioritize “Wizard quick start” first; add asset management and analytics docs later.

---

## 3) Skills you’ll learn (and quick definitions)

- Next.js App Router APIs
  - Dynamic routes (`app/[alias]/page.tsx`, `app/version/[slug]/page.tsx`), Route Handlers (`/api/...`), cache headers
  - Migration file: `add_marketing_links_tables.sql`
- Supabase SQL & Storage
  - Designing tables, indexing slugs & alias, atomic counters, storage buckets & public URLs
- Snapshot architecture
  - Precomputing chart series so public pages are fast and consistent
- Slug vs Alias (definition)
  - Slug: the immutable, versioned URL (e.g., `/version/andrea-2025-09-15-1`)
  - Alias: a vanity path (e.g., `/andrea`) that server‑renders the latest snapshot (no redirect)
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

