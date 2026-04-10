# Browser Automation Master Handoff

This document is the single operational handoff for the browser automation work in this repo.

It covers:

- what was built for Modash
- what was built for Instagram DM discovery
- what decisions were made and why
- what was intentionally not built yet
- which commands are now standard
- where files and outputs live
- what the next intended future state is

This is written so a future AI or human can resume work without ambiguity.

## Current Status

There are currently **two active browser automation tracks** in this repo:

1. **Modash search-results scraping**
2. **Instagram DM thread discovery**

The current state is:

- Modash has a working standalone scraper in `modash_scraper.py`
- Instagram has a working `v0` Playwright spike that can discover DM thread URLs from usernames
- Both workflows now share the same local Chrome automation standard

## Shared Local Browser Standard

All future local browser-attached workflows in this repo should use the same dedicated Chrome profile and the same debugging port.

### Standard command

```bash
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.automation-chrome"
```

### Why this is the standard

- one dedicated automation browser profile
- one dedicated debugging port
- one persistent login environment
- fewer session mismatches between scripts
- simpler instructions moving forward

### Rule

If a local automation script needs to attach to Chrome, it should assume:

- debugging port: `9222`
- browser profile: `~/.automation-chrome`

Reference file:

- `docs/local-browser-automation-standard.md`

## Part 1: Modash Automation

### Objective

Build a local scraper that attaches to a real logged-in browser session and scrapes the main Modash Instagram search results list, without using the expensive `View` modal.

### Key constraints agreed on

- use the visible browser
- assume the user logs in manually first
- assume the user manually opens the exact results page
- scrape only the **main list view**
- do **not** open `View`, because it burns credits
- create a **new CSV every run**
- allow the user to manually start on a specific page
- do **not** require the script to navigate to the starting page
- continue clicking `Next` from there
- hard cap of 1000 pages

### Implementation choice

For Modash, the implementation used:

- **Python**
- **Selenium**

Why Selenium was used:

- the original request was framed as a Selenium scraper
- it was fast to get a local standalone script running
- it was sufficient for a paginated list/table scraping workflow

### File created

- `modash_scraper.py`

### What the file does

`modash_scraper.py`:

- attaches to an already-open Chrome via remote debugging
- validates or skips page validation
- scrapes visible handles and other visible list data
- exports one timestamped CSV per run
- writes debug HTML and screenshots
- clicks `Next`
- continues until no next page or max page cap

### Important technical note

The first Modash version was intentionally heuristic-heavy because the exact DOM structure was not known upfront.

That means the file:

- isolates selectors
- stores raw row text
- stores extra debug columns
- is designed to be refined by rerunning and inspecting output

### Commands used

Open Chrome for automation:

```bash
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.automation-chrome"
```

Run Modash scraper from repo root:

```bash
python3 modash_scraper.py --start-page 5 --skip-page-validation
```

The `--skip-page-validation` flag was used because the script could not reliably detect Modash's active page marker from the DOM.

### Outputs and locations

Outputs are written under:

- `modash_exports/`
- `modash_exports/debug/`

Observed CSV files currently present:

- `modash_exports/modash_scrape_2026-03-25_13-17-43.csv`
- `modash_exports/modash_scrape_2026-03-26_10-55-33.csv`
- `modash_exports/modash_scrape_2026-03-30_10-29-41.csv`
- `modash_exports/modash_scrape_2026-03-30_10-36-09.csv`
- `modash_exports/modash_scrape_Coach_250,000 - 3,000,000.csv`

### What was learned from the Modash work

Confirmed:

- attaching to an existing Chrome session works
- manual-login + automation-attach is a viable pattern in this repo
- a local standalone script is a good first step before app integration

Problems discovered:

- page-number detection on Modash was flaky
- inferred metrics needed refinement because row parsing was heuristic
- some rows mixed numeric values in names and metrics

### Current Modash status

Modash is in a **working but heuristic** state.

That means:

- it can scrape real pages
- it can export real CSVs
- but metric inference and some selectors may still need refinement depending on the current live Modash DOM

## Part 2: Instagram DM Discovery

### Original goal

The longer-term product goal is to support automation around Instagram outreach follow-ups.

Before building the full system, the first technical question was reduced to:

> Can a local script reliably search a username in Instagram DMs, open the correct thread, and capture the `/direct/t/...` URL?

That became the lean `v0` spike.

### Important architecture decision

The larger browser automation architecture was intentionally reduced.

The original concept was more ambitious:

- web app button
- local worker
- database persistence
- run tracking
- review queue
- later message classification and follow-up handling

This was **deliberately deferred** because it was overbuilt before proving the core browser step.

### Final `v0` scope

The `v0` spike was intentionally narrowed to:

- attach to real Chrome
- open Instagram DMs
- search usernames
- open threads
- capture URLs
- print/store results

Nothing more.

### Why Playwright was chosen

For Instagram, the implementation moved away from Selenium and used:

- **Node**
- **Playwright**

Reasoning:

- better fit with this repo's `Next.js + TypeScript + Node` stack
- better fit for modern dynamic web apps like Instagram
- stronger long-term fit if this work later becomes integrated into the app

### Files created

- `scripts/instagram_dm/discover_threads.mjs`
- `scripts/instagram_dm/reuse_or_discover_threads.mjs`
- `scripts/instagram_dm/import_discovered_threads.mjs`
- `scripts/instagram_dm/usernames.json`
- `scripts/instagram_dm/test_leads.json`
- `scripts/instagram_dm/output/.gitkeep`
- `docs/instagram-dm-thread-discovery-v0.md`

Also updated:

- `package.json`
- `.gitignore`
- `src/app/api/editor/outreach/pipeline/list/route.ts`
- `src/app/api/editor/outreach/pipeline/update/route.ts`
- `src/features/editor/services/outreachApi.ts`
- `src/features/editor/components/OutreachModal.tsx`
- `supabase/migrations/20260407_000001_add_instagram_dm_thread_fields_to_editor_outreach_targets.sql`

### What each file is for

#### `scripts/instagram_dm/discover_threads.mjs`

Standalone local Playwright script that:

- connects to the existing Chrome session on `9222`
- goes to Instagram inbox
- searches each username
- opens the matching thread
- captures the resulting URL
- verifies the thread appears to belong to that username
- writes results to JSON
- writes screenshot paths into the result entries

#### `scripts/instagram_dm/usernames.json`

Lean input file for the spike.

Contains the 10 usernames used for the proof run.

#### `scripts/instagram_dm/import_discovered_threads.mjs`

Local service-role import script that:

- reads `scripts/instagram_dm/output/results.json`
- keeps only successful verified thread discoveries
- derives `instagram_dm_thread_id` from each stored `/direct/t/...` URL
- writes thread URL, thread ID, and discovered timestamp back to outreach rows
- scopes updates to a required `account_id`
- can optionally also update legacy null-account rows for a specified user id

#### `scripts/instagram_dm/reuse_or_discover_threads.mjs`

Stored-thread reuse script that:

- reads the current outreach rows from Supabase by exact lead ids and account id
- prefers `instagram_dm_thread_url` when available
- opens the stored thread directly in the browser first
- verifies the opened thread belongs to the intended username
- falls back to inbox search only when the stored thread is missing or fails verification
- writes run results to `scripts/instagram_dm/output/resolve_results.json`
- does not persist fallback discoveries automatically in this milestone

#### `scripts/instagram_dm/test_leads.json`

Richer input artifact containing:

- internal target id
- username
- full_name
- instagram_url
- pipeline status fields

This was generated from real outreach records in the app database.

#### `docs/instagram-dm-thread-discovery-v0.md`

Operational instructions for running the `v0` discovery spike.

### Command added

In `package.json`, the following script was added:

```bash
npm run dm:discover-threads
npm run dm:resolve-threads
npm run dm:import-threads
```

This runs:

```bash
node scripts/instagram_dm/discover_threads.mjs
```

### The 10-lead test set

The usernames used for the successful spike were:

- `brainmdhealth`
- `slowmyage`
- `draustinperlmutter`
- `neilcannonvitality`
- `jonschoeff`
- `cameronmathison`
- `coachdrefit`
- `mrsrogers.hood`
- `bobbyparrish`
- `cleanlivingkarly`

### Exact result of the `v0` spike

The spike completed successfully.

Observed result:

- **10/10 usernames succeeded**
- all 10 opened a valid `/direct/t/...` URL
- all 10 passed verification

Results file:

- `scripts/instagram_dm/output/results.json`

### Exact discovered thread URLs

From `scripts/instagram_dm/output/results.json`:

- `brainmdhealth` -> `https://www.instagram.com/direct/t/119888459404899/`
- `slowmyage` -> `https://www.instagram.com/direct/t/17842546190593993/`
- `draustinperlmutter` -> `https://www.instagram.com/direct/t/104683870928060/`
- `neilcannonvitality` -> `https://www.instagram.com/direct/t/113253776736661/`
- `jonschoeff` -> `https://www.instagram.com/direct/t/17846391522026945/`
- `cameronmathison` -> `https://www.instagram.com/direct/t/113023140092201/`
- `coachdrefit` -> `https://www.instagram.com/direct/t/100734814661340/`
- `mrsrogers.hood` -> `https://www.instagram.com/direct/t/105518177515476/`
- `bobbyparrish` -> `https://www.instagram.com/direct/t/104442804287989/`
- `cleanlivingkarly` -> `https://www.instagram.com/direct/t/17843231492734949/`

### What the Instagram spike proved

It proved that the browser workflow below is viable:

1. search inbox by username
2. open thread
3. capture thread URL
4. verify it belongs to the intended user

This means the core assumption needed for future Instagram automation is now validated.

## Research and Decision History

### Official API research

There was significant research into whether Meta/Instagram APIs could solve thread lookup directly.

What was investigated:

- `/me/conversations`
- Instagram Conversations API
- Messaging API
- User Profile API
- Graph API conversation IDs
- private/unofficial APIs
- whether a profile URL or username could be converted into a DM thread ID

### What was concluded

Likely true:

- official APIs can list conversations
- official APIs can return conversation IDs
- official APIs can include participants/usernames

Not proven:

- that the API conversation ID is the same as the Instagram web `/direct/t/...` thread token
- that official APIs would be the lightest path for the actual browser-open flow needed here

Operational conclusion:

- do **not** block the work on Meta API integration
- use browser-side thread discovery first
- optionally revisit API augmentation later

### Deprioritized paths

The following were considered and intentionally not chosen for the current phase:

- **Meta API-first implementation**
  - useful later, but too much setup and mapping overhead for the immediate goal
- **Chrome extension first**
  - possible, but heavier and more awkward than the local browser worker/script path
- **AI browser agent first**
  - interesting later, but too much complexity before proving reliability
- **screen-control / pixel-control approach**
  - not chosen because DOM/browser control is better for this use case
- **building the full app-integrated architecture immediately**
  - explicitly postponed until the core browser step was proven

## Technical Vocabulary and Meanings

These terms came up repeatedly and are important for future AI handoff.

### DOM

DOM = Document Object Model.

This is the browser's structured internal representation of a web page:

- buttons
- links
- inputs
- text nodes
- conversation rows

DOM-based automation means code is targeting page elements, not screen pixels.

### Browser automation

Code controlling a browser:

- open pages
- click
- type
- wait
- read content

### Screen control

Automation based on visual pixels or OCR rather than browser DOM structure.

This was **not** chosen as the primary path.

### Selenium

Older, established browser automation library.

Used for Modash because:

- it was fast to get the scraper working
- the task was a standalone Python scraper

### Playwright

Newer browser automation library.

Used for Instagram `v0` because:

- better fit for modern dynamic sites
- better fit with the repo stack
- better long-term path for possible app integration

### CDP

Chrome DevTools Protocol.

This is the connection mechanism used by automation tools to attach to an already-open Chrome with a debugging port.

## Commands To Reuse Later

### Standard Chrome automation browser

```bash
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.automation-chrome"
```

### Modash scraper

Example:

```bash
python3 modash_scraper.py --start-page 5 --skip-page-validation
```

### Instagram DM discovery spike

```bash
npm run dm:discover-threads
```

### Instagram stored-thread reuse with fallback

```bash
npm run dm:resolve-threads -- --account-id YOUR_ACCOUNT_ID_HERE
```

### Optional Playwright install step

```bash
npx playwright install chromium
```

## Where To Look For Things

### Modash

- scraper code: `modash_scraper.py`
- CSV outputs: `modash_exports/`
- Modash debug artifacts: `modash_exports/debug/`

### Instagram

- discovery script: `scripts/instagram_dm/discover_threads.mjs`
- reuse/fallback script: `scripts/instagram_dm/reuse_or_discover_threads.mjs`
- one-thread network pipeline: `scripts/instagram_dm/run_thread_network_pipeline.mjs`
- batch network pipeline: `scripts/instagram_dm/run_batch_thread_network_pipeline.mjs`
- classification import script: `scripts/instagram_dm/import_thread_network_classifications.mjs`
- network capture probe: `scripts/instagram_dm/capture_thread_network.mjs`
- network payload analyzer: `scripts/instagram_dm/analyze_thread_network_payload.mjs`
- network thread classifier: `scripts/instagram_dm/classify_thread_network_state.mjs`
- inspection script: `scripts/instagram_dm/inspect_thread_states.mjs`
- test usernames: `scripts/instagram_dm/usernames.json`
- rich test leads: `scripts/instagram_dm/test_leads.json`
- results: `scripts/instagram_dm/output/results.json`
- resolve results: `scripts/instagram_dm/output/resolve_results.json`
- network capture results: `scripts/instagram_dm/output/network_capture_results.json`
- network payloads: `scripts/instagram_dm/output/network_payloads/`
- network analysis results: `scripts/instagram_dm/output/network_analysis_results.json`
- network classification results: `scripts/instagram_dm/output/network_classification_results.json`
- network per-run artifacts: `scripts/instagram_dm/output/network_runs/`
- network batch artifacts: `scripts/instagram_dm/output/network_batches/`
- network pipeline run index: `scripts/instagram_dm/output/network_pipeline_run_index.jsonl`
- inspect results: `scripts/instagram_dm/output/inspect_results.json`
- screenshots path convention: `scripts/instagram_dm/output/screenshots/...`
- run instructions: `docs/instagram-dm-thread-discovery-v0.md`

### Shared standard

- `docs/local-browser-automation-standard.md`

## Agreed Future State

The intended direction for Instagram is now partially implemented:

### For Modash

- keep the standalone local browser-attached scraping model
- refine selectors/heuristics when needed
- continue using the shared automation Chrome

### For Instagram

What now exists:

- storing discovered thread URLs in app data
- reusing stored thread URLs
- resolving missing threads during real operational runs
- classifying live thread state from network data
- sending safe follow-ups locally with pacing and auditability
- a localhost-triggered local runner bridge from the app
- batching arbitrary slices like `10` / `25` / `50`
- preview + confirmation modal in the Outreach modal
- active-job polling and in-UI cancellation
- a send guard requiring the known initial outreach anchor phrase before any follow-up send

### Important sequencing decision

The work should proceed in layers:

1. thread discovery proved
2. minimal persistence of discovered thread URL
3. minimal visibility of stored thread URL in the outreach table
4. network-based inspection/classification
5. safe local follow-up sending with audit trail
6. unified missing-thread resolution + sending workflow
7. localhost-backed app control surface

Do **not** jump straight to a remote server automation platform without keeping this layered local-first approach.

## Current State

The repo has moved past "classification visibility only."

What now exists:

- DB fields on `editor_outreach_targets` for thread URL, thread ID, discovered timestamp, latest classification visibility, and latest execution visibility
- pipeline API support for reading those fields into the outreach UI
- outreach table visibility via `Thread` and `DM State`
- a local import script that writes discovery results back into Supabase
- a local reuse-first script that can open stored thread URLs and fall back to discovery
- a local network-capture probe that saves raw DM-thread payloads for one known lead
- a local analyzer that normalizes one captured thread payload into facts-first output
- a local classifier that maps analyzed network facts into thread states and actions
- a local one-thread pipeline that runs capture -> analyze -> classify into a per-run artifact folder
- a local batch pipeline that runs the same proven path across many leads with limit/offset controls
- a local import script that writes latest batch classification results back into Supabase for UI visibility
- a local safe follow-up sender with live recheck, pacing, duplicate protection, and audit persistence
- a unified local runner that can resolve missing threads, recheck live state, and send safe follow-ups from one flow
- a localhost bridge used by the Outreach modal for preview, start, polling, and cancel
- a confirmation modal that shows final count, mode, and pacing before the run starts
- an initial-outreach-template guard that requires a loaded outbound message matching the `full version?` anchor
- graceful job cancellation from the UI
- a first-pass live-only humanization layer in the unified runner: short idle dwell, tiny in-thread scroll behavior, humanized inbox-search typing for missing-thread resolution, chunked composer typing, and tailed delay jitter
- unified-runner `send-live` missing-thread rows can now reuse a shared resolver tab and attempt first-open capture before falling back to the older reopen path

Current decision:

- localhost invocation / local runner bridge is acceptable for simplicity
- the web app should act as the control plane, not the browser execution environment
- the existing outreach modal is the preferred first UI surface for operational controls
- use a tiny localhost HTTP server as the bridge layer
- preview the batch in the UI, then require a confirmation modal showing final count, mode, and pacing before the run starts
- the operator can cancel an active job from the UI; the runner stops at safe checkpoints
- before any follow-up send, the live thread must contain the initial outreach anchor phrase around `full version?`
- do not remove the live recheck before sends
- the first humanization rollout belongs to the unified runner send-live path first; dry-runs stay fast by default, and `scripts/instagram_dm/execute_safe_followups.mjs` stays deterministic unless explicitly opted in later
- do not auto-update `pipeline_stage` beyond the current existing workflow unless explicitly designed later

## Current Local Setup

For actual local automation from the UI, the current operator setup is:

1. start the dedicated automation Chrome on port `9222`
2. ensure that Chrome profile is already logged into Instagram
3. start the local bridge:

```bash
npm run dm:start-local-bridge
```

After that, the user can operate from the web app UI.

The current implementation does **not** auto-start Chrome or the localhost bridge.

For the most complete current operational description, including:

- exact UI flow
- missing-thread vs known-thread behavior
- timing windows for the current UI pacing presets
- cancellation checkpoints
- current operator behavior while automation runs

see:

- `docs/instagram-local-automation-runbook.md`

## Summary

The browser automation work is now in a strong state:

- Modash browser attachment and scraping pattern works
- Instagram DM thread discovery is proven `10/10`
- one shared automation Chrome standard is established
- discovered thread persistence and UI visibility are now implemented
- stored-thread reuse with fallback discovery is implemented
- one-thread network capture probing is implemented
- one-thread network payload analysis is implemented
- one-thread network classification is implemented
- one-thread per-run network pipeline is implemented
- batch network pipeline with limit/offset is implemented
- batch classification writeback and UI visibility are implemented
- local safe follow-up execution runner is implemented
- paced send safeguards and duplicate protection are implemented
- unified missing-thread resolution + sending workflow is implemented
- localhost-backed Outreach modal control surface is implemented
- preview + confirmation modal is implemented
- in-UI cancel is implemented
- initial outreach anchor guard is implemented
- unified-runner live humanization is implemented
- first-pass thread-state inspection is implemented as terminal + JSON only
- future work should build on this foundation incrementally

If another AI picks this up, it should treat the current highest-confidence fact as:

> Opening a real Instagram DM thread from a stored URL is proven in this repo, and the preferred operational path is now: keep browser automation local, use network-based live recheck for safety, persist execution truth separately from classification truth, run the unified local workflow through a localhost bridge + Outreach modal control surface, require the initial outreach anchor phrase before any automated follow-up send, and apply the first humanization layer only on the unified runner's send-live path.
