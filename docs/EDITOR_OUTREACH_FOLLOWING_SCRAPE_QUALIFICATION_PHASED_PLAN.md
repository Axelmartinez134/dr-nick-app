# Outreach (Following scrape → qualify → save → per-row create project) — phased implementation plan
Goal: extend the existing superadmin-only Outreach workflow in `/editor` so we can:
- Scrape **accounts a seed profile is following** using Apify actor `datavoyantlab/instagram-following-scraper`
- **Score/qualify** prospects cheaply with DeepSeek (batch UX, clear cost/time guardrails)
- Persist prospects into the existing `public.editor_outreach_targets` “spreadsheet”
- Provide a **per-row action button** to enrich + create template/project (reusing the current single-profile outreach pipeline)

This plan is intentionally phased so each step is testable and reversible.

---

## Inputs / decisions locked in
- **Outreach stays in one place**: `src/features/editor/components/OutreachModal.tsx`
- **Two tabs in modal**
  - **Single Profile**: existing flow (keep working)
  - **Scrape Following**: new flow
- **Discovery actor**: `datavoyantlab/instagram-following-scraper`
  - Input schema: `{ "usernames": ["seed_username"] }`
  - Output contains `following_user` with fields like `username`, `full_name`, `profile_pic_url`, `is_verified`, `is_private`, plus ids/flags.
- **Enrichment actor (existing)**: `apify/instagram-profile-scraper` (already wired via `/api/editor/outreach/apify-probe`)
  - Used only when needed (create project/template and optional rescore).
- **DeepSeek**:
  - Env var: `DEEPSEEK_API_KEY`
  - Response format: strict JSON only
  - We start with **Lite scoring (no enrichment)** and only enrich/rescore top prospects later.
- **Cost guardrails**:
  - UI includes **Max results** control for the following scrape (safe test runs like 1 / 25 / 100).
  - UI includes a **Max spend cap** for Apify runs (real protection). Default: **$5** per scrape-following run.
  - “Max results” is **best-effort** (“up to N”), not guaranteed exact, and is enforced by limiting what we read/persist + by a spend cap.
  - Batch actions must be clearly labeled as batch operations (no accidental per-row burn).
  - Default enrichment strategy: **enrich only score ≥ 80** (user can override by selecting rows).
- **Persistence**:
  - Reuse `public.editor_outreach_targets` as the single Outreach “spreadsheet”
  - Extend it with source + AI + enrichment columns (migration).
  - Store **full raw JSON** for prospect rows (source actor) and enrichment rows (profile actor).

---

## Prompt (DeepSeek) — Lite scoring (following actor only)
Note: following actor output often does **not** reliably include bio/follower counts. The Lite prompt is therefore based on the fields we *do* have.

```text
You are a lead qualification agent for an Instagram carousel content service. Your job is to score how likely this Instagram profile is a qualified prospect.

IDEAL CLIENT PROFILE:
- Health, wellness, fitness, nutrition, or functional medicine professional
- Has a coaching program, course, or transformation offer they sell
- Active on Instagram as a business channel (not just personal use)
- Follower range: 10K-150K (sweet spot is 20K-100K)
- Likely posts educational or motivational content
- Bonus: medical doctor, naturopath, chiropractor, dietitian, or licensed practitioner with credentials

DISQUALIFY:
- Brand accounts or companies (supplement brands, gym chains, software companies)
- Meme pages, aggregator accounts, or media outlets
- Business coaches who teach marketing (they are the competition, not the client)
- Personal accounts with no business indicators
- Accounts with 500K+ followers (too large, different needs)
- Accounts with under 5K followers (too small, unlikely to pay)

SCORING CRITERIA (0-100):
- 0-20: Not a match (wrong niche, brand account, too small/large, no business signals)
- 21-40: Weak match (tangentially related to health/wellness but missing key signals)
- 41-60: Moderate match (right niche but unclear if they sell programs or unclear follower range)
- 61-80: Strong match (right niche, likely sells programs, reasonable follower count)
- 81-100: Ideal match (health/wellness professional, clear coaching offer, 20K-100K followers, credentials visible)

INPUT DATA:
Username: {username}
Full Name: {full_name}
Is Verified: {is_verified}
Is Private: {is_private}
Profile Photo URL: {profile_pic_url}
Profile URL: {profile_url}
Metadata JSON: {metadata_json}

Respond ONLY in this exact JSON format, nothing else:
{"score": <number>, "niche": "<2-4 word niche label>", "reason": "<one sentence>", "has_offer": <true/false>, "credential": "<credential if visible, otherwise null>"}
```

---

## File ownership (follow `docs/EDITOR_CODEBASE_MAP.md`)
- **UI**: `src/features/editor/components/OutreachModal.tsx`
- **Client API callers** (new): `src/features/editor/services/outreachApi.ts`
- **Orchestration hooks** (optional; keep modal lean if it grows): `src/features/editor/hooks/useOutreachFollowing.ts`
- **Server APIs** (new + extend existing):
  - `src/app/api/editor/outreach/scrape-following/route.ts`
  - `src/app/api/editor/outreach/qualify-lite/route.ts`
  - `src/app/api/editor/outreach/persist-prospects/route.ts`
  - `src/app/api/editor/outreach/enrich-prospects/route.ts`
  - (optional) `src/app/api/editor/outreach/qualify-enriched/route.ts`
- **Server-only Apify helpers** (extend): `src/app/api/editor/outreach/_apify.ts`
- **DB migrations**: `supabase/migrations/*`
- **Docs updates**: update `docs/EDITOR_CODEBASE_MAP.md` when new files/routes land

---

## Phase 0 — Guardrails + server-only plumbing (no UI)
Deliverables:
- Add server-only Apify wrapper for following actor in `src/app/api/editor/outreach/_apify.ts`
  - `scrapeInstagramFollowingViaApify({ seedInstagramUrlOrUsername, maxResults, maxSpendUsd })`
  - Enforce hard bounds:
    - `maxResults` must be \(1 \rightarrow 5000\) (default: 100)
    - `maxSpendUsd` must be \(0.50 \rightarrow 5.00\) (default: **5.00**)
  - Implement spend cap via Apify run option `maxTotalChargeUsd` (platform-level; actor input does not expose a `limit`)
- Add DeepSeek key require helper (server-only) without leaking secrets in errors.

Manual QA:
- With missing `APIFY_API_TOKEN`, following wrapper fails with clear error.
- With maxResults invalid (0, -1, 999999), wrapper fails with clear error.
- With a known seed username and `maxResults=1`, wrapper returns 1 normalized item.
- With `maxSpendUsd=0.5`, wrapper either returns a partial dataset or errors clearly due to spend cap.

Checkpoint: Phase 0 is OK.

---

## Phase 1 — DB extensions (editor_outreach_targets becomes the spreadsheet)
Deliverables:
- Migration to extend `public.editor_outreach_targets` with:
  - **Source**: `source_type`, `source_seed_username`, `source_seed_instagram_url`
  - **Prospect snapshot (following actor)**: `prospect_username`, `prospect_full_name`, `prospect_profile_pic_url`, `prospect_is_verified`, `prospect_is_private`, `source_raw_json`
  - **AI (lite)**: `ai_score`, `ai_reason`, `ai_niche`, `ai_has_offer`, `ai_credential`, `ai_scored_at`, `ai_model`, `ai_mode`
  - **Enrichment snapshot** (profile scraper): `enriched_profile_pic_url_hd`, `enriched_raw_json`
  - **Action status** (optional): `enriched_at`, `project_created_at`

Manual QA:
- Migration applies cleanly.
- Existing single-profile outreach flow still inserts successfully.
- A “prospect-only” row can be inserted with created_project/template ids null.

Checkpoint: Phase 1 is OK.

---

## Phase 2 — Following scrape API route (best-effort maxResults + spend cap)
Deliverables:
- `POST /api/editor/outreach/scrape-following`
  - Auth: superadmin-only (same pattern as `apify-probe`)
  - Input: `{ seedInstagramUrl, maxResults, maxSpendUsd }`
  - Output: `{ seedUsername, items: NormalizedProspect[] }`

Manual QA:
- Valid seed IG URL + `maxResults=25` returns up to 25 items.
- `maxResults=1` returns 1 item.
- Invalid IG URL returns 400 with clear message.

Checkpoint: Phase 2 is OK.

---

## Phase 3 — UI: add 2 tabs + scrape following (read-only table)
Deliverables:
- Update `OutreachModal` to have a tabbed UI:
  - Tab 1: Single Profile (unchanged)
  - Tab 2: Scrape Following
- Scrape Following tab includes:
  - Seed IG URL input
  - **Max results** selector (presets: `1, 25, 100, 500, 1000, 5000`)
  - **Max spend** selector (default: `$5`) with a small warning tooltip (“real Apify protection”)
  - Scrape button
  - Table rendering returned items

Manual QA:
- Switching tabs does not break Single Profile flow.
- Scrape with `maxResults=1` shows 1 row.
- Scrape with `maxResults=100` shows 100 (or fewer if account has fewer).

Checkpoint: Phase 3 is OK.

---

## Phase 4 — Table UX + batch safety (selection, search, pagination)
Deliverables:
- Spreadsheet-style UX:
  - selection checkboxes + select-all on page
  - search box (client-side)
  - pagination / “Load more” (initially can paginate client-side if we load maxResults; later can evolve to server paging)
- Batch UX guardrails:
  - “X selected” indicator
  - Buttons label “batch” explicitly and show estimates:
    - Lite qualify selected (DeepSeek only)
    - Save selected
  - Enforce per-click batch limits:
    - Lite qualify: presets `10 / 25 / 50` (user chooses)
    - Enrich: presets `5 / 10 / 25` (user chooses)

Manual QA:
- Selection works across filters and load-more.
- Buttons remain disabled until at least 1 row selected.
- UI clearly indicates batch size before running.

Checkpoint: Phase 4 is OK.

---

## Phase 5 — Lite qualification (DeepSeek only; no extra Apify calls)
Deliverables:
- `POST /api/editor/outreach/qualify-lite`
  - Input: selected normalized prospects
  - Server: calls DeepSeek with Lite prompt; validates strict JSON output
  - Output: per-username AI fields
- UI:
  - “Lite qualify selected” runs as a batch with per-row status + errors
  - Store scores in local UI state (and optionally in DB only after Save in Phase 6)

Manual QA:
- Run lite qualify on 10 rows; scores appear.
- Invalid/malformed DeepSeek response is handled per-row with a clear error.
- “Min score filter” works once scores exist.

Checkpoint: Phase 5 is OK.

---

## Phase 6 — Persist prospects (dedupe) into editor_outreach_targets
Deliverables:
- `POST /api/editor/outreach/persist-prospects`
  - Input: seed info + selected prospects (+ AI fields if present)
  - Dedupe strategy: upsert by `(account_id, source_seed_username, prospect_username)` (or equivalent)
- `GET /api/editor/outreach/list-prospects` (optional for Phase 8)

Manual QA:
- Save 10 selected rows → 10 rows appear in DB.
- Re-saving same rows does not duplicate.
- Saved rows can be reloaded and still show AI fields.

Checkpoint: Phase 6 is OK.

---

## Phase 7 — Enrichment (Apify profile scraper) + optional rescore (only top prospects)
Deliverables:
- `POST /api/editor/outreach/enrich-prospects`
  - Input: list of `editor_outreach_targets.id` (or usernames) to enrich
  - Runs existing profile scraper to fetch `profilePicUrlHD` + richer raw JSON
  - Saves enrichment snapshot to the row
- UI:
  - Button: “Enrich 80+” (default selects rows with `ai_score >= 80`)
  - Button: “Enrich selected” (manual override)
- Optional: `POST /api/editor/outreach/qualify-enriched` to rescore using enriched metadata (if we decide it improves quality materially)

Manual QA:
- Enrich 5 rows → rows now have `enriched_profile_pic_url_hd`.
- Enrich only runs for chosen rows (no hidden per-row triggers).
- Failures are per-row; others proceed.

Checkpoint: Phase 7 is OK.

---

## Phase 8 — Per-row action: “Create project/template” (reuse existing pipeline)
Deliverables:
- Add “Action” column button per row:
  - Ensures enrichment exists (runs enrichment on-demand if missing)
  - Then reuses existing template/project creation routes:
    - `/api/editor/outreach/create-template`
    - existing project create + mappings + caption injection
    - persist created ids back onto this row

Manual QA:
- Click action for 1 prospect → new template + project created and loaded.
- Row shows created IDs and doesn’t allow double-creation accidentally.

Checkpoint: Phase 8 is OK.

---

## Phase 9 — Polish / observability (optional)
Deliverables:
- Better progress UI (Scraping…, Qualifying 3/10…, Enriching 2/5…)
- CSV export of saved prospects
- Simple status fields: contacted / not contacted (optional)

Manual QA:
- No double submits.
- Clear errors and clear success states.

---

## Per-change checklist (per `docs/EDITOR_CODEBASE_MAP.md`)
- [ ] Make the smallest change that fits the current `src/features/editor/*` structure
- [ ] Update `docs/EDITOR_CODEBASE_MAP.md` (map + any new files/ownership)
- [ ] Add a Manual QA section (6–10 bullets) specific to this change
- [ ] Run `npm run build` and confirm it passes
- [ ] Call out any new/changed editor state fields or actions
- [ ] If architecture changed, add/update an entry in Architecture Decisions

