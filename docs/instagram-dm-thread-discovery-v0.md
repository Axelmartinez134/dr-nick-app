# Instagram DM Thread Discovery v0

This is the lean local spike for proving one thing:

- Can a local script attach to your real Chrome session, search an Instagram username in DMs, open the thread, and capture the `/direct/t/...` URL?

## Files

- `scripts/instagram_dm/discover_threads.mjs`
- `scripts/instagram_dm/reuse_or_discover_threads.mjs`
- `scripts/instagram_dm/run_thread_network_pipeline.mjs`
- `scripts/instagram_dm/run_batch_thread_network_pipeline.mjs`
- `scripts/instagram_dm/import_thread_network_classifications.mjs`
- `scripts/instagram_dm/capture_thread_network.mjs`
- `scripts/instagram_dm/analyze_thread_network_payload.mjs`
- `scripts/instagram_dm/classify_thread_network_state.mjs`
- `scripts/instagram_dm/inspect_thread_states.mjs`
- `scripts/instagram_dm/usernames.json`
- `scripts/instagram_dm/test_leads.json`
- `scripts/instagram_dm/output/results.json`
- `scripts/instagram_dm/output/resolve_results.json`
- `scripts/instagram_dm/output/network_capture_results.json`
- `scripts/instagram_dm/output/network_analysis_results.json`
- `scripts/instagram_dm/output/network_classification_results.json`
- `scripts/instagram_dm/output/network_runs/*`
- `scripts/instagram_dm/output/network_batches/*`
- `scripts/instagram_dm/output/network_pipeline_run_index.jsonl`
- `scripts/instagram_dm/output/inspect_results.json`
- `scripts/instagram_dm/output/network_payloads/*`
- `scripts/instagram_dm/output/screenshots/*`

## One-time setup

From the repo root:

```bash
npm install
```

If Playwright asks for browser binaries later, run:

```bash
npx playwright install chromium
```

## Run flow

### 1. Open the special Chrome window

This is now the standard shared automation browser for future local workflows involving
Instagram and Modash. Reuse this exact command so every local automation script attaches
to the same dedicated Chrome profile and the same debugging port.

```bash
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.automation-chrome"
```

### 2. In that Chrome window

- Log into Instagram manually.
- Make sure you can open your DMs normally.
- Leave the Chrome window open.

### 3. Edit the input usernames

Put the test usernames in:

- `scripts/instagram_dm/usernames.json`

The current file already contains the first 10 test leads.

### 4. Run the script

```bash
npm run dm:discover-threads
```

## Reuse stored threads first

After thread URLs have been imported into `editor_outreach_targets`, you can run the
next milestone script that prefers stored thread URLs and only falls back to inbox search
when the stored thread is missing or fails verification.

### Resolve command

```bash
npm run dm:resolve-threads -- --account-id YOUR_ACCOUNT_ID_HERE
```

### What the resolve script does

For each lead in `scripts/instagram_dm/test_leads.json`, it will:

1. read the current outreach row from Supabase by exact `id` and `account_id`
2. check `instagram_dm_thread_url`
3. open the stored thread directly when available
4. verify that the opened thread appears to belong to that username
5. fall back to inbox search only if the stored thread is missing or fails verification
6. save screenshots
7. write results to `scripts/instagram_dm/output/resolve_results.json`

### Important rule for this milestone

This script does **not** write any newly discovered fallback URLs back into Supabase.

Persistence remains a separate step for now.

## Preferred high-volume workflow

If you want to run the network-based thread-state workflow many times per day, use the
single-run pipeline below instead of manually chaining capture -> analyze -> classify.

### Pipeline command

```bash
npm run dm:run-thread-network-pipeline -- --account-id YOUR_ACCOUNT_ID_HERE --username instagram_handle_here
```

Optional explicit thread URL:

```bash
npm run dm:run-thread-network-pipeline -- --account-id YOUR_ACCOUNT_ID_HERE --username instagram_handle_here --thread-url https://www.instagram.com/direct/t/THREAD_TOKEN/
```

### What the pipeline does

For one thread, it will:

1. resolve the lead from `test_leads.json` or Supabase
2. open the stored thread directly when available
3. fall back to inbox search only when needed
4. capture the thread network payloads
5. analyze the captured payloads
6. classify the thread state
7. write all artifacts into a dedicated per-run folder
8. append one summary line to `scripts/instagram_dm/output/network_pipeline_run_index.jsonl`

### Why this is the preferred path

- no shared overwrite dependency between stages
- each run gets its own artifact folder
- easier to debug one exact run later
- more suitable for high-frequency operational use

### Per-run artifact location

Each run writes to a folder like:

- `scripts/instagram_dm/output/network_runs/2026-04-07T05-12-10-123Z-username-abcdef12/`

Inside that folder you will get:

- `capture_result.json`
- `analysis_result.json`
- `classification_result.json`
- `result.json`
- `thread.png`
- `network_payloads/*`

### Role of the older commands

The individual commands below still exist and remain useful for:

- debugging one stage in isolation
- inspecting raw payloads manually
- validating classifier behavior step by step

They are no longer the recommended operational path for high-volume use.

## Preferred batch workflow

After the one-thread network pipeline is validated, use the batch runner to process many
leads in one attached Chrome session.

### Batch command

```bash
npm run dm:run-batch-thread-network-pipeline -- --account-id YOUR_ACCOUNT_ID_HERE --leads scripts/instagram_dm/test_leads.json --limit 10 --offset 0
```

### What the batch runner does

For a selected slice of leads, it will:

1. load the leads JSON file
2. apply `offset` and `limit`
3. load the matching outreach rows from Supabase once
4. connect to Chrome once
5. run the proven one-thread network pipeline for each lead
6. continue on error by default
7. preserve per-lead run folders
8. write batch-level summaries as it goes

### Batch defaults

- one shared browser connection for the whole batch
- one fresh page per lead
- continue on error
- `delay-ms` defaults to `1500`

### Batch artifacts

Each batch writes to:

- `scripts/instagram_dm/output/network_batches/<timestamp>-<label>/`

Inside that folder you will get:

- `batch_results.ndjson`
- `batch_results.json`
- `batch_summary.json`

Per-lead artifacts still go to:

- `scripts/instagram_dm/output/network_runs/*`

### Why this is the next scale step

- reuses the already-validated one-thread execution path
- avoids shared overwrite files
- supports chunked operation with `limit` and `offset`
- keeps debugging simple because every lead still has its own run folder

## Import batch classification visibility

After a batch run succeeds, you can write the resulting classification state back into
`editor_outreach_targets` so the outreach UI shows the latest network-derived DM state.

### Import command

```bash
npm run dm:import-thread-network-classifications -- --account-id YOUR_ACCOUNT_ID_HERE --input scripts/instagram_dm/output/network_batches/YOUR_BATCH_FOLDER/batch_results.json
```

### What the import writes

For each successful batch result row, it writes:

- `instagram_dm_thread_last_state`
- `instagram_dm_thread_last_recommended_action`
- `instagram_dm_thread_last_classified_at`
- `instagram_dm_thread_last_run_artifact_path`

### Important rules for this milestone

- This is a local service-role import script.
- It does **not** update `pipeline_stage`.
- It does **not** send follow-up messages.
- It exists only to make the latest network classification visible in the app UI.

## Execute safe follow-ups

After classification visibility is in Supabase, you can run the local sender on top of those
persisted safe states.

### Execution command

```bash
npm run dm:execute-safe-followups -- --account-id YOUR_ACCOUNT_ID_HERE --dry-run
```

To actually send messages:

```bash
npm run dm:execute-safe-followups -- --account-id YOUR_ACCOUNT_ID_HERE --send-live
```

### Sender rules

- reads directly from `editor_outreach_targets`
- only considers rows with stored thread URLs
- only considers latest persisted states:
  - `safe_unseen_no_reply`
  - `safe_seen_no_reply`
- requires at least `4` days since `last_contact_date`
- stops after follow-up `3` unless manually reset
- performs a fresh live `capture -> analyze -> classify` recheck before every send
- writes execution fields separately from classification truth
- appends audit rows to `editor_outreach_dm_execution_events`
- writes per-run `execution_result.json` files plus a batch summary under
  `scripts/instagram_dm/output/followup_execution_batches/`

## Unified local workflow

This section supersedes the earlier "single-purpose sender only" framing.

The workflow that now exists is:

`select leads from Supabase -> resolve missing thread if needed -> live classify thread -> require initial outreach anchor match -> send next follow-up only if safe -> write execution result -> surface status in UI`

This remains a **local-machine workflow**.

- browser automation still runs on the user's machine
- the web app acts as a localhost control plane
- the localhost bridge is implemented and used by the Outreach modal

### Implemented runner + bridge

The implemented local orchestrator and control surface are:

- `scripts/instagram_dm/run_outreach_followup_workflow.mjs`
- `scripts/instagram_dm/outreach_followup_workflow_lib.mjs`
- `scripts/instagram_dm/start_local_bridge.mjs`

What the runner now does:

1. query eligible outreach rows from Supabase
2. separate rows with known threads from rows missing threads
3. resolve missing threads by inbox search when needed
4. run the proven live network `capture -> analyze -> classify` recheck
5. require a loaded outbound message to match the initial outreach anchor before any follow-up send
6. send only when the live thread remains safe
7. persist execution status, follow-up progression, and audit events
8. write per-run and per-batch artifacts

### Exact lead selection rules

The unified runner should select rows from `editor_outreach_targets` using these exact rules.

#### Global requirements

- `account_id = <selected account>`
- normalized username exists from `prospect_username` or `username`
- `pipeline_stage = 'dm_sent'`
- follow-up cap not exceeded:
  - `followup_sent_count is null` means next follow-up is `1`
  - `followup_sent_count = 1` means next follow-up is `2`
  - `followup_sent_count = 2` means next follow-up is `3`
  - `followup_sent_count >= 3` is ineligible unless manually reset
- duplicate guard:
  - if `editor_outreach_dm_execution_events` already contains a recent successful `sent_followup`
    event for the same target and same follow-up number inside the configured guard window,
    skip the row

#### Eligibility for rows with known thread

Rows with `instagram_dm_thread_url` present are eligible to attempt the unified workflow when:

- latest persisted thread state is one of:
  - `safe_unseen_no_reply`
  - `safe_seen_no_reply`
- and the 4-day wait window is satisfied:
  - use `last_contact_date` when present
  - for first follow-up only, fall back to `created_at` when `last_contact_date` is missing

#### Eligibility for rows with missing thread

Rows with `instagram_dm_thread_url` missing are eligible to attempt thread resolution when:

- all global requirements above pass
- the next follow-up number is still `1`, `2`, or `3`
- the same 4-day wait rule passes:
  - prefer `last_contact_date`
  - for first follow-up only, fall back to `created_at`

Operational meaning:

- if initial outreach already happened but the thread was never stored, the system may still
  resolve the thread and continue the follow-up workflow in the same run

### Exact missing-thread behavior

For rows missing `instagram_dm_thread_url`, the unified runner should do this exactly:

1. attach to the standard local Chrome session
2. open Instagram inbox
3. search by exact normalized username only
4. open the matching DM thread
5. verify the thread belongs to the intended username
6. if verification passes:
   - store `instagram_dm_thread_url`
   - derive and store `instagram_dm_thread_id`
   - store `instagram_dm_thread_discovered_at`
7. then continue immediately into the live network recheck in the same run
8. if the recheck still classifies as safe:
   - send the next follow-up
9. if the recheck becomes replied / ongoing / ambiguous:
   - do not send
   - write blocked/manual-review execution status

Important constraints:

- exact username search only for automation
- do not guess across fuzzy matches
- if search fails or verification fails, stop that row and mark it for review
- do not silently fall through to sending without successful thread verification
- do not send a follow-up unless a loaded outbound message matches the initial outreach anchor phrase
- the current required anchor is a fuzzy/exact match around `full version?`

### Implemented UI controls

The first web-app control surface is implemented inside the existing outreach modal.

Required row-level columns:

- `Thread`: `Known` / `Missing`
- `DM State`: latest persisted classification label
- `Next action`: one of:
  - `Resolve thread`
  - `Follow-up 1`
  - `Follow-up 2`
  - `Follow-up 3`
  - `Manual review`
  - `Wait`
- `Last execution`
- `Follow-up sent count`
- `Last contact date`
- artifact / run path link

Required filters:

- `All`
- `Missing thread`
- `Ready for follow-up`
- `Manual review`
- `Wait window not met`
- optional exact username search

Required batch controls:

- batch size:
  - `10`
  - `25`
  - `50`
  - custom
- mode:
  - `Dry run`
  - `Send live`
- pacing preset:
  - `Moderate`
  - `Conservative`
  - `Ultra-cautious`
- launch action:
  - `Prepare local workflow run`
  - confirmation modal with final count, mode, and pacing
- active job controls:
  - status display
  - processed / sent counters
  - `Cancel run` button

Important UI architecture rule:

- the UI does not perform browser automation server-side
- the UI talks to the localhost bridge
- the local machine remains the execution environment for Instagram automation
- cancellation is graceful: the bridge marks the job `cancelling` and the runner stops at safe checkpoints

### Exact execution states

The next workflow layer should use explicit execution states so the UI and audit trail are easy
to reason about.

Recommended exact states:

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

Recommended meaning:

- `thread_resolution_succeeded`
  - missing thread was resolved and stored successfully
- `thread_resolution_failed_search`
  - inbox search did not find a valid thread for exact username
- `thread_resolution_failed_verification`
  - a thread opened, but ownership verification failed
- `blocked_live_recheck`
  - thread was re-opened and classified, but no longer safe to auto-send
- `blocked_initial_template_guard`
  - live thread may otherwise look safe, but no loaded outbound message matched the initial outreach anchor phrase
- `dry_run_ready`
  - all checks passed; would send if live mode were enabled
- `dry_run_failed`
  - dry-run execution failed before safe completion
- `sent_followup`
  - message sent and persistence succeeded
- `sent_followup_persist_failed`
  - message sent, but DB writeback/audit persistence failed
- `send_failed`
  - send attempt failed before success was verified
- `cancelled_by_user`
  - operator cancelled the active local run and the runner stopped at a safe checkpoint
- `max_sends_reached`
  - batch stopped intentionally because configured send cap was reached
- `failure_threshold_reached`
  - batch stopped intentionally after too many consecutive failures

### Confirmed build defaults for the unified runner

These decisions are now explicitly confirmed and should be treated as locked unless changed later.

1. Exact signal for "initial outreach already happened"
   - `pipeline_stage = 'dm_sent'` is the source of truth that the initial outreach already happened

2. Missing-thread rows should continue in the same run
   - resolve missing thread
   - persist thread metadata
   - continue immediately into live recheck and send-if-safe

3. UI launch model
   - localhost-only control surface is acceptable
   - the web app may invoke a local runner bridge rather than a remote server action

4. Selection model in UI
   - first version uses filtered batch-size launches
   - arbitrary row-by-row selection can come later if needed

5. Missing-thread search rule
   - exact username-only inbox search is the automation rule

6. Preferred first UI location
   - use the existing outreach modal so the workflow stays visually aligned with the lead list already used operationally

7. Bridge + launch UX
   - use a tiny local HTTP server on localhost as the control bridge
   - the UI should preview first, then show a confirmation modal with final count, mode, and pacing before starting

8. Initial outreach template guard
   - before any follow-up send, the live resolved/opened thread must contain a loaded outbound message that matches the known initial outreach anchor
   - current anchor phrase: `full version?`

9. Cancellation
   - the UI should expose a cancel button for active local jobs
   - cancellation should be graceful rather than force-killing a browser step

With the defaults above confirmed, the unified runner is specified enough to build.

### Current local setup requirement

For actual local sends, the operator still needs these prerequisites running first:

1. the dedicated automation Chrome session must be open on port `9222`
2. that Chrome profile must already be logged into Instagram
3. the localhost bridge must already be running:

```bash
npm run dm:start-local-bridge
```

After those are in place, the web app can be used as the control plane:

- open the Outreach modal
- prepare the run
- confirm the modal
- monitor or cancel from the UI

The UI does **not** currently auto-launch Chrome or auto-start the localhost bridge.

### Full operator runbook

For the most complete current explanation of:

- what the UI now does
- what the bridge does
- what Instagram actions happen in each branch
- what timing windows are used by the current UI pacing presets
- how large `missing_thread` vs `known_thread` pools behave operationally

see:

- `docs/instagram-local-automation-runbook.md`

## Capture thread network payloads

After thread open is proven, you can run a one-thread network capture probe that saves the
raw Instagram responses associated with opening that DM thread.

### Capture command

```bash
npm run dm:capture-thread-network -- --account-id YOUR_ACCOUNT_ID_HERE
```

Optional exact target:

```bash
npm run dm:capture-thread-network -- --account-id YOUR_ACCOUNT_ID_HERE --lead-id LEAD_UUID_HERE
```

Or by username:

```bash
npm run dm:capture-thread-network -- --account-id YOUR_ACCOUNT_ID_HERE --username instagram_handle_here
```

### What the capture probe does

It intentionally targets **one known lead only**.

For that lead, it will:

1. read the outreach row from Supabase by exact `id` and `account_id`
2. prefer the stored `instagram_dm_thread_url`
3. fall back to inbox search only if needed
4. verify that the opened thread appears to belong to that username
5. listen for Instagram network responses while the thread loads
6. save matching raw payloads into `scripts/instagram_dm/output/network_payloads/`
7. write a summary file to `scripts/instagram_dm/output/network_capture_results.json`
8. save one screenshot of the opened thread

### Important rules for this milestone

- This is a capture probe only.
- It does **not** classify the thread yet.
- It does **not** write anything into Supabase.
- It does **not** update `pipeline_stage`.
- The purpose is to inspect the real payloads first before building network-based classification.

## Analyze captured thread payloads

After a one-thread capture succeeds, you can run a local analyzer that picks the most
canonical thread payload and normalizes the important fields into a facts-first summary.

### Analyze command

```bash
npm run dm:analyze-thread-network
```

Optional username selector:

```bash
npm run dm:analyze-thread-network -- --username christian.fleenor
```

Optional explicit input/output:

```bash
npm run dm:analyze-thread-network -- --input scripts/instagram_dm/output/network_capture_results.json --output scripts/instagram_dm/output/network_analysis_results.json
```

### What the analyzer does

For one captured thread, it will:

1. read `scripts/instagram_dm/output/network_capture_results.json`
2. inspect the saved payload files for that capture
3. rank the payloads and choose the most canonical thread payload
4. normalize facts like:
   - viewer id
   - participant usernames
   - thread ids
   - latest loaded message sender
   - latest loaded message type
   - latest loaded message preview
   - read receipt entries
   - `marked_as_unread`
5. write the result to `scripts/instagram_dm/output/network_analysis_results.json`

### Important rule for this milestone

This analyzer is **facts-first**.

It does **not** make final business decisions like:

- `safe_unseen_no_reply`
- `safe_seen_no_reply`
- `review_replied_or_ongoing`

It exists to normalize the payload shape first so classification logic can be built on top
of verified data instead of assumptions.

## Classify analyzed network thread state

After the one-thread analyzer succeeds, you can run a separate network-based classifier that
turns those normalized facts into one final state and recommended action.

### Classify command

```bash
npm run dm:classify-thread-network
```

Optional username selector:

```bash
npm run dm:classify-thread-network -- --username christian.fleenor
```

Optional explicit input/output:

```bash
npm run dm:classify-thread-network -- --input scripts/instagram_dm/output/network_analysis_results.json --output scripts/instagram_dm/output/network_classification_results.json
```

### What the classifier does

For one analyzed thread, it will:

1. read `scripts/instagram_dm/output/network_analysis_results.json`
2. inspect the normalized facts for:
   - latest loaded message direction
   - inbound vs outbound message counts
   - viewer read receipt
   - participant read receipt
3. classify the thread into one of:
   - `safe_unseen_no_reply`
   - `safe_seen_no_reply`
   - `review_replied_or_ongoing`
   - `review_ambiguous`
4. assign one recommended action:
   - `candidate_followup`
   - `hold_waiting`
   - `human_review`
5. write the result to `scripts/instagram_dm/output/network_classification_results.json`

### Important rules for this milestone

- This classifier is based on normalized network facts, not the Instagram DOM.
- Any inbound activity is treated as `review_replied_or_ongoing`.
- Reaction-only replies count as `review_replied_or_ongoing`.
- Reel/post-share-only replies count as `review_replied_or_ongoing`.
- If required receipt or participant fields are missing, the result should be `review_ambiguous`.
- It does **not** write any classification back into Supabase.
- It does **not** auto-update `pipeline_stage`.

## Inspect thread state

After thread access is proven, you can run the next local-only milestone that opens each
thread and classifies the latest visible thread state without writing anything back into
the app database.

### Inspect command

```bash
npm run dm:inspect-threads -- --account-id YOUR_ACCOUNT_ID_HERE
```

### What the inspect script does

For each lead in `scripts/instagram_dm/test_leads.json`, it will:

1. read the current outreach row from Supabase by exact `id` and `account_id`
2. prefer the stored `instagram_dm_thread_url`
3. fall back to inbox search only if the stored thread is missing or fails verification
4. verify that the opened thread appears to belong to that username
5. inspect the latest visible part of the thread
6. classify the result into one of:
   - `safe_unseen_no_reply`
   - `safe_seen_no_reply`
   - `review_replied_or_ongoing`
   - `review_ambiguous`
   - `failed_to_inspect`
7. save one screenshot per lead
8. write results to `scripts/instagram_dm/output/inspect_results.json`

### Important rules for this milestone

- This script is terminal + JSON only.
- It does **not** write thread-state results into Supabase.
- It does **not** auto-update `pipeline_stage`.
- Reaction-only replies count as `review_replied_or_ongoing`.
- Reel/post-share-only replies count as `review_replied_or_ongoing`.
- Ambiguous views should classify as `review_ambiguous`.

## What the script does

For each username, it will:

1. attach to your current Chrome session
2. go to `https://www.instagram.com/direct/inbox/`
3. search the username
4. try to open the matching thread
5. capture the current URL
6. verify the thread appears to belong to that username
7. save a screenshot
8. append the result to `results.json`

## Output

Results are written to:

- `scripts/instagram_dm/output/results.json`

Screenshots are written to:

- `scripts/instagram_dm/output/screenshots/`

Stored-thread reuse results are written to:

- `scripts/instagram_dm/output/resolve_results.json`

Thread network capture results are written to:

- `scripts/instagram_dm/output/network_capture_results.json`
- `scripts/instagram_dm/output/network_payloads/`

Thread network analysis results are written to:

- `scripts/instagram_dm/output/network_analysis_results.json`

Thread network classification results are written to:

- `scripts/instagram_dm/output/network_classification_results.json`

Preferred per-run network pipeline artifacts are written to:

- `scripts/instagram_dm/output/network_runs/`
- `scripts/instagram_dm/output/network_batches/`
- `scripts/instagram_dm/output/network_pipeline_run_index.jsonl`

Thread-state inspection results are written to:

- `scripts/instagram_dm/output/inspect_results.json`

## Import discovered threads into outreach

After discovery succeeds, you can persist the successful thread URLs and IDs back into
`editor_outreach_targets`.

### Required arguments

- `--account-id <uuid>` is required
- `--legacy-user-id <uuid>` is optional

If `--legacy-user-id` is provided, the import will also update legacy outreach rows where:

- `account_id is null`
- `created_by_user_id = <legacy user id>`

### Import command

```bash
npm run dm:import-threads -- --account-id YOUR_ACCOUNT_ID_HERE
```

Optional legacy scope:

```bash
npm run dm:import-threads -- --account-id YOUR_ACCOUNT_ID_HERE --legacy-user-id YOUR_USER_ID_HERE
```

If you want to import fallback discoveries produced by the resolve script instead of the
original discovery script, pass the resolve output explicitly:

```bash
npm run dm:import-threads -- --account-id YOUR_ACCOUNT_ID_HERE --input scripts/instagram_dm/output/resolve_results.json
```

### What the import does

For each successful row in `results.json`, it writes:

- `instagram_dm_thread_url`
- `instagram_dm_thread_id`
- `instagram_dm_thread_discovered_at`

to matching outreach rows using normalized username matching.

## Success criteria

A username counts as a success only if:

- the script opens a `/direct/t/...` URL
- and it can verify that the opened thread appears to belong to that username

## Failure examples

- no search box found
- no matching search result
- wrong thread opened
- URL did not become `/direct/t/...`
- participant verification failed
- Instagram logged you out

## Notes

- The script is intentionally conservative. If a result is ambiguous, it should fail rather than guessing.
- This is a local spike only. It does not write to your app database yet.
