# Instagram Local Automation Runbook

This document is the current operational source of truth for the Instagram DM follow-up system in this repo.

It is written as a handoff doc for future operators and future LLMs.

## What is implemented

The current system is a local-machine Instagram automation workflow with a web-app control surface.

Implemented pieces:

- unified local runner for Instagram follow-ups
- localhost bridge used by the app UI
- Outreach modal controls for preview, start, monitor, and cancel
- readiness checklist tab in the UI
- missing-thread resolution during the same run
- live network-based recheck before any follow-up send
- execution visibility + audit persistence
- initial-message guard requiring the known outreach anchor phrase before send

Key implementation files:

- `scripts/instagram_dm/outreach_followup_workflow_lib.mjs`
- `scripts/instagram_dm/run_outreach_followup_workflow.mjs`
- `scripts/instagram_dm/start_local_bridge.mjs`
- `scripts/instagram_dm/thread_network_pipeline_lib.mjs`
- `src/features/editor/components/OutreachModal.tsx`
- `src/features/editor/services/outreachApi.ts`

## Current architecture

The system is intentionally local-first.

- the web app is the control plane
- the localhost bridge is the local API the UI talks to
- the bridge runs the unified workflow runner
- the runner attaches to a dedicated local Chrome session on port `9222`
- that Chrome profile must already be logged into Instagram
- all Instagram automation happens on the local machine, not on a remote server

## Current setup requirements

For actual automation from the UI to work, the operator must still do this first:

1. Start the dedicated automation Chrome:

```bash
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.automation-chrome"
```

2. Make sure that automation Chrome profile is already logged into Instagram.

3. Start the localhost bridge:

```bash
npm run dm:start-local-bridge
```

After those are already running, the UI can control the workflow.

The current implementation does **not** auto-start Chrome or auto-start the bridge.

## Current UI flow

The Outreach modal now has four tabs:

- `Single profile`
- `Scrape following`
- `Pipeline`
- `Automation checklist`

### Automation checklist tab

This tab is operational guidance + live readiness status.

It shows:

- `Ready to run: Yes / No`
- bridge status
- Chrome debugger status
- setup commands
- operator instructions
- reminder that Instagram login is still a manual prerequisite
- reminder that the user can keep using other apps while automation runs, as long as the dedicated automation Chrome profile is left alone

`Ready to run` is currently based on:

- localhost bridge reachable
- Chrome debugger reachable on `9222`

It does **not** currently verify the Instagram login state directly.

### Pipeline tab

This is where local automation is actually launched.

Current controls:

- workflow bucket filter
- mode:
  - `Dry run`
  - `Send live`
- batch size
- pacing preset:
  - `Moderate`
  - `Conservative`
  - `Ultra-cautious`
- `Prepare local workflow run`
- confirmation modal with:
  - final selected count
  - mode
  - pacing
- active job status card
- `Cancel run`

## Selection model

The unified workflow reads directly from `editor_outreach_targets`.

Current global eligibility rules:

- selected `account_id`
- normalized username exists
- `pipeline_stage = 'dm_sent'`
- follow-up cap not exceeded
- duplicate-send guard window not violated
- 4-day wait window satisfied

Wait-window logic:

- prefer `last_contact_date`
- for first follow-up only, fall back to `created_at` when `last_contact_date` is missing

## Current workflow buckets

The UI and preview model work with these buckets:

- `actionable`
- `missing_thread`
- `ready_followup`
- `manual_review`
- `wait_window_not_met`
- `all`

Operational meaning:

- `missing_thread`
  - no stored `instagram_dm_thread_url`
  - this lead must go through thread resolution first
- `ready_followup`
  - stored thread exists and latest persisted state is safe
- `actionable`
  - union of `missing_thread` + `ready_followup`

Important current reality:

- if a large account state has hundreds of `dm_sent` rows and most of them do not yet have stored thread IDs / thread URLs, then a large `actionable` run will mostly be a **missing-thread resolution run first**
- once more threads are discovered and persisted, future runs can skip that resolution phase for those same leads

## Route behavior by lead type

There are two main lead routes.

### Route A: known thread

This means the lead already has `instagram_dm_thread_url`.

Per-lead flow:

1. open the stored thread URL directly
2. verify the thread belongs to the intended username
3. run live network capture -> analyze -> classify
4. require safe state:
   - `safe_unseen_no_reply`
   - `safe_seen_no_reply`
5. require initial outreach anchor match in loaded outbound messages
6. if live mode:
   - run a short in-thread idle phase before composing
   - occasionally take an extra long pause after classification
   - type the message in slowed chunked bursts with one total typing budget
   - wait pre-send delay
   - send the follow-up
   - wait post-send delay
   - persist execution result
7. if dry run:
   - mark as `dry_run_ready`

Important point:

- known-thread rows do **not** perform username inbox search first
- they skip the thread-resolution phase and go straight to thread open + live recheck

### Route B: missing thread

This means the lead does **not** have `instagram_dm_thread_url`.

Per-lead flow:

1. open Instagram inbox
2. search exact normalized username
   - in unified-runner `send-live`, the search box now uses a separate humanized typing profile plus a post-type settle wait
3. open the matching conversation
4. verify the thread belongs to the intended username
5. if successful:
   - persist `instagram_dm_thread_url`
   - derive and persist `instagram_dm_thread_id`
   - persist `instagram_dm_thread_discovered_at`
6. continue immediately into live network capture -> analyze -> classify
   - unified-runner `send-live` now reuses one missing-thread tab across leads instead of opening a brand new tab for each missing-thread row
   - unified-runner `send-live` now attempts capture from the first search-open thread view before falling back to the older reopen path
   - unified-runner `send-live` now prefers clearing and reusing the existing DM search surface between successful searches instead of reloading inbox each time
7. require safe state
8. require initial outreach anchor match in loaded outbound messages
9. if live mode:
   - run a short in-thread idle phase before composing
   - occasionally take an extra long pause after classification
   - type the message in slowed chunked bursts with one total typing budget
   - wait pre-send delay
   - send the follow-up
   - wait post-send delay
   - persist execution result
10. if dry run:
   - mark as `dry_run_ready`

Important point:

- once a missing-thread row is successfully resolved, later runs can usually behave like Route A and skip the inbox-search step
- in unified-runner `send-live`, failed missing-thread resolutions now re-home to inbox on the shared resolver tab before the next username
- in unified-runner `send-live`, successful missing-thread sequences should usually stay on the current DM surface and reset search in place, with inbox navigation kept as fallback when the surface is not reusable

### Route C: thread not found / verification failed

This is the fail-closed branch for missing-thread rows.

If search fails or the opened conversation cannot be verified:

- do not send
- do not continue into follow-up send
- write a failure execution state
- move on to the next lead after the inter-lead cooldown

Current states for this branch:

- `thread_resolution_failed_search`
- `thread_resolution_failed_verification`

## Initial outreach guard

Before any follow-up send is allowed, the live loaded outbound messages must contain the known initial outreach anchor phrase.

Current anchor rule:

- fuzzy / exact match around `full version?`

This guard exists to reduce false positives when:

- the original outreach may not have actually sent
- Instagram resolves to an older unrelated thread
- the thread looks superficially safe but does not contain the intended initial outreach

If the anchor is not found:

- the run does **not** send
- it is blocked with `blocked_initial_template_guard`

## Live recheck safety

Every send attempt is gated by a fresh live thread classification.

Current safe states:

- `safe_unseen_no_reply`
- `safe_seen_no_reply`

If the live thread recheck is not safe:

- the system does **not** send
- it records `blocked_live_recheck`

## Timing and pacing

There are three operator-configured timing ranges in the current system:

1. inter-lead cooldown
2. pre-send delay
3. post-send delay

There is also one internal live-only humanization layer in the unified runner:

1. a short in-thread idle pause before composing
2. optional tiny vertical scroll behavior inside the thread area
3. occasional long pause after classification, before compose/send
4. slowed chunked typing with one max total typing budget for the DM composer
5. slowed chunked typing with a separate faster profile for missing-thread inbox search
6. extra tail jitter added on top of the configured pre-send, post-send, and inter-lead ranges

The UI uses these pacing presets:

### Moderate

- inter-lead delay: `8000ms` to `15000ms`
- pre-send delay: `1500ms` to `3500ms`
- post-send delay: `2000ms` to `4000ms`

### Conservative

- inter-lead delay: `12000ms` to `22000ms`
- pre-send delay: `2500ms` to `5000ms`
- post-send delay: `2500ms` to `5000ms`

### Ultra-cautious

- inter-lead delay: `20000ms` to `35000ms`
- pre-send delay: `3500ms` to `6500ms`
- post-send delay: `3500ms` to `6500ms`

Important timing behavior:

- the inter-lead delay happens after a lead finishes and before the next lead starts
- the pre-send delay only happens if the lead has already passed all safety checks and is about to send
- the post-send delay only happens after an actual send
- the unified runner now adds extra live-only tail jitter on top of the configured pre-send, post-send, and inter-lead ranges
- the unified runner now adds a small pre-compose idle step before typing, plus a rarer longer pause after classification
- the unified runner now types the message in chunked bursts instead of one instant insert when running send-live
- when a live run must resolve a missing thread, the inbox search field also uses humanized typing plus a post-type settle window before result selection
- dry-runs stay on the fast path and do not turn on this humanization layer by default
- the older `scripts/instagram_dm/execute_safe_followups.mjs` script remains on the deterministic shared-helper path unless it is explicitly opted into humanization later
- there is **no separate configured multi-second delay** between:
  - thread found -> live classify
  - thread open -> anchor check
  - anchor check -> send decision
  because those happen inside the same per-lead action chain

Observability:

- per-lead artifacts now record humanization details such as idle pause timing, whether a long pause fired, `tail_extra_ms`, and typing metrics like `typing_elapsed_ms`
- missing-thread live runs now also record search humanization details such as pre-focus pause, post-type settle, and search typing metrics
- send-live logs now include the sampled numeric values used for those timing layers

For missing-thread rows specifically:

- the "thread resolution phase" is not separated into its own delayed batch
- resolution and live recheck happen in the same lead iteration
- if a thread is found and verified, the workflow continues immediately into classification

## Large-pool operational meaning

If there are roughly `700` leads in the eligible pool, the practical behavior depends on how many are missing threads vs already-known threads.

### If most are missing-thread rows

The run is mostly doing:

- inbox search
- thread open
- participant verification
- thread persistence
- live recheck

Only after that can a follow-up send be considered.

This is the more operationally sensitive route because it touches inbox search for many leads.

### If most are known-thread rows

The run is mostly doing:

- direct thread open from stored URL
- live recheck
- anchor check
- optional send

This skips the search/discovery phase and is operationally simpler.

### Why this matters

For a large pool:

- the first major operational pass may mostly be about discovering/storing thread IDs and URLs
- later passes can increasingly skip discovery and behave like direct open + recheck + send

## Current execution states

The current workflow uses these execution states:

- `thread_resolution_succeeded`
- `thread_resolution_failed_search`
- `thread_resolution_failed_verification`
- `blocked_live_recheck`
- `blocked_initial_template_guard`
- `dry_run_ready`
- `dry_run_failed`
- `sent_followup`
- `sent_followup_persist_failed`
- `send_failed`
- `cancelled_by_user`
- `max_sends_reached`
- `failure_threshold_reached`

## Cancellation behavior

Cancellation is implemented and is graceful.

Current behavior:

- the UI sends cancel to the localhost bridge
- the bridge marks the job `cancelling`
- the runner checks for cancellation:
  - before browser connect
  - before each lead
  - before send
  - during inter-lead cooldown
  - during pre-send delay
- once a safe checkpoint is reached, the job becomes `cancelled`

This is not a force-kill of the browser mid-step.

## What the user can do while automation runs

The user can still use the computer while the automation runs.

Recommended operator behavior:

- leave the dedicated automation Chrome profile alone
- use a different browser window/profile for normal browsing
- use other apps normally on other screens
- keep the machine awake
- do not quit the localhost bridge during the run

In other words:

- using other apps: yes
- using a normal separate Chrome session: yes
- interacting with the automation Chrome profile during a run: avoid

## What is still manual

These things are still manual today:

- launching the automation Chrome profile
- keeping Instagram logged in there
- starting the localhost bridge
- confirming the batch launch in the UI

## Why the system is structured this way

The design choices are deliberate:

- local-only execution preserves the real logged-in browser session
- localhost bridge lets the app UI control local automation without running Instagram remotely
- live network recheck reduces bad sends based on stale DB state
- separate execution truth vs classification truth keeps auditability clearer
- initial outreach anchor matching reduces false positives on older / wrong conversations
- graceful cancellation gives operator control without blindly killing the browser mid-action

## Short operational summary

Current end-to-end behavior:

1. operator makes sure bridge + automation Chrome are up
2. operator opens Outreach modal
3. operator checks `Automation checklist`
4. operator goes to `Pipeline`
5. operator chooses bucket, mode, batch size, pacing
6. operator clicks `Prepare local workflow run`
7. UI asks bridge for preview
8. operator confirms the run
9. bridge launches the unified runner
10. each lead goes through one of:
    - known-thread path
    - missing-thread path
    - fail-closed path
11. follow-up is only sent if:
    - live state is safe
    - initial outreach anchor phrase is present
12. operator can monitor or cancel from the UI

This is the current implemented behavior, not just a plan.
