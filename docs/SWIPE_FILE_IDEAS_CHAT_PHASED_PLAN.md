# Swipe File — Ideas Chat (Phased Plan)

Goal: add a **superadmin-only**, **account-scoped**, **persisted** “Generate ideas” chat for a Swipe File item that produces selectable **Idea cards**. Selected ideas are saved as reusable **Idea entities** and can be used later to drive carousel copy generation.

This plan follows the `/editor` edit guidance in `docs/EDITOR_CODEBASE_MAP.md`:
- Prefer small, focused changes under `src/features/editor/*`
- Keep `src/app/editor/EditorShell.tsx` as composition/wiring (not a dumping ground)
- Add a Manual QA checklist per phase
- Run `npm run build` after each phase
- Update `docs/EDITOR_CODEBASE_MAP.md` to map new files/ownership

---

## Product spec (locked)

- **Entry point**: In `SwipeFileModal` right-side detail panel **under** “Create project + rewrite”, add **Generate ideas**.
- **Context sent to AI (verbatim)**: Swipe item `transcript`, `caption`, `title`, `author_handle`, `category`, `note` (Angle/Notes). No thumbnail.
- **Chat persistence**: **One chat thread per Swipe item** (per account). Close/reopen retains history; works cross-device.
- **Output UX**: assistant produces **Idea cards** (each: title + 6-slide outline + “Select”).
- **Multi-carousel**: Selecting a card saves a new **Idea entity** (many per Swipe item).
- **Idea picker**: When creating a project from Swipe File, open an **Ideas picker** first.
  - Must support **“Continue without idea”** (uses existing Angle/Notes behavior).
- **Generation behavior**: When a project is created using a selected idea, copy generation uses:
  - **Angle = selected idea text only** (title + outline canonical text), ignoring Angle/Notes for that run.
  - Still pass Swipe transcript/caption as grounding context (recommended).
- **Master prompt**: global per account, editable by user inside chat modal (collapsible Settings panel).
  - Storage: `editor_account_settings.swipe_ideas_master_prompt_override`
- **Transcript limit**: hard error if transcript text length exceeds **25,000 chars**.
- **Model/provider**: same provider/model used for existing Claude-based generation (Anthropic).
- **Access control**: superadmin-only (UI + APIs), account-scoped.

---

## Phase 1 — Chat + persistence + saved Ideas (NO impact on project creation / generate-copy)

### Why Phase 1 exists (stability)
This phase delivers an end-to-end “Generate ideas” chat that:
- is persisted and reliable the first time
- is isolated from the high-risk surfaces (project creation + copy generation)

### Deliverables
- **DB migration** (new tables + columns; account-scoped + RLS):
  - `swipe_file_idea_threads` (1 per `(account_id, swipe_item_id)`; unique constraint)
  - `swipe_file_idea_messages` (persist chat history; indexed by `(thread_id, created_at)`)
  - `swipe_file_ideas` (saved idea entities; indexed by `(account_id, swipe_item_id, created_at)`)
  - `editor_account_settings.swipe_ideas_master_prompt_override text null`
- **API routes** (all use `getAuthedSwipeContext` and enforce superadmin + account scoping):
  - `GET /api/swipe-file/items/[id]/ideas/thread` → get-or-create thread + latest N messages
  - `POST /api/swipe-file/items/[id]/ideas/messages` → append user message, call Claude, append assistant message, return:
    - assistant message text (for chat)
    - parsed `ideaCards[]` (strict JSON schema)
    - transcript-too-long error when \(len(transcript) > 25_000\)
  - `GET /api/swipe-file/items/[id]/ideas` → list saved ideas for picker/preview
  - `POST /api/swipe-file/items/[id]/ideas` → save selected idea card as an Idea entity
  - `GET/POST /api/swipe-file/ideas/master-prompt` (or extend an existing settings route) → load/save account-global master prompt
- **UI**:
  - In `src/features/editor/components/SwipeFileModal.tsx`, add **Generate ideas** button.
  - New modal: `SwipeIdeasChatModal`:
    - chat messages (ChatGPT-like)
    - collapsible “Settings” panel with master prompt editor + autosave status
    - Idea cards panel (from latest assistant response), each with **Select** → saves Idea entity
    - error states: auth, 403, transcript-too-long, parse errors
  - Optional: “Ideas (N)” count row in the right panel (read from `GET /ideas`).

### Manual QA (Phase 1)
- Open `/editor`, open **Swipe File**, select an Instagram-enriched item with a transcript.
- Click **Generate ideas** → chat modal opens.
- Send a message:
  - Expected: user message persists, assistant responds, and Idea cards render.
- Click **Select** on an Idea card:
  - Expected: “Saved” feedback; Idea count increases; idea appears in the ideas list.
- Close the chat modal and reopen it:
  - Expected: chat history is still present; saved ideas remain.
- Reload the page, reopen Swipe File:
  - Expected: chat + ideas persist (cross-device persistence implication).
- Switch active account (superadmin) and repeat:
  - Expected: different account sees its own threads/ideas and uses its own Brand Voice + master prompt.
- Transcript limit:
  - Force a swipe item with transcript length > 25k (or temporarily simulate) and send a message.
  - Expected: clear hard error “Transcript too long, can’t chat”.
- Permissions:
  - Non-superadmin should not see the button and should get 403 if attempting routes directly.

### Automated validation (Phase 1)
- Run `npm run build` (must pass).
- (Optional but recommended) Add a minimal route-level test harness if this repo has an existing test runner; otherwise keep Phase 1 to build + manual QA.

### Update docs (Phase 1)
- Update `docs/EDITOR_CODEBASE_MAP.md` with:
  - new Swipe Ideas API routes
  - new components
  - new DB tables/columns ownership notes

---

## Phase 2 — Idea picker → project creation → copy generation uses selected Idea

### Why Phase 2 exists (stability)
This phase touches the highest-impact surfaces:
- project creation flow
- generate-copy behavior for Swipe-origin projects

It builds only on Phase 1’s already-validated persistence + ideas.

### Deliverables
- **DB migration**:
  - Add to `carousel_projects`:
    - `source_swipe_idea_id uuid null`
    - `source_swipe_idea_snapshot text null` (freeze the chosen idea text for deterministic regeneration)
- **API updates**:
  - Extend `POST /api/swipe-file/items/[id]/create-project` to accept optional `ideaId`:
    - If provided, validate idea belongs to `(account_id, swipe_item_id)`
    - Set `source_swipe_idea_id` + `source_swipe_idea_snapshot`
    - Keep existing behavior when missing (Angle/Notes snapshot)
- **UI updates**:
  - Add an **Ideas picker modal** opened when clicking “Create project + rewrite”:
    - list saved ideas for the current item
    - select one idea OR choose **Continue without idea**
    - proceed to create-project call with/without `ideaId`
  - Optional: after project creation, show which idea was used (small label).
- **Generate Copy update**:
  - In `src/app/api/editor/projects/jobs/generate-copy/route.ts`:
    - If Swipe-origin and `source_swipe_idea_snapshot` is present, use that as the “angle” input instead of `source_swipe_angle_snapshot`.
    - Still include transcript/caption grounding for Swipe-origin generation.
    - Keep all non-swipe behavior unchanged.

### Manual QA (Phase 2)
- With a Swipe item that has saved ideas:
  - Click **Create project + rewrite** → Ideas picker opens.
  - Select an idea → create project succeeds.
  - Generate copy → output reflects the selected idea’s angle (not Angle/Notes).
- Click **Create project + rewrite** and choose **Continue without idea**:
  - Expected: project is created using the existing Angle/Notes snapshot behavior (current baseline).
- Regression checks:
  - Outreach modal + Run Outreach still works as before.
  - Non-swipe projects still generate via their existing flow (Poppy/Claude logic unchanged).

### Automated validation (Phase 2)
- Run `npm run build` (must pass).
- (Optional) Add a small server-side unit test for “prompt composition chooses idea snapshot when present” if a test runner exists; otherwise rely on manual QA + build for MVP.

### Update docs (Phase 2)
- Update `docs/EDITOR_CODEBASE_MAP.md`:
  - carousel project new columns
  - updated Swipe File create-project flow and generate-copy decision points

---

## Notes / guardrails for “works first time”

- **Strict JSON schema** for Idea cards returned by Claude; validate server-side and retry once on parse failure.
- **Pagination**: load only the most recent N chat messages by default (add “Load older”).
- **Concurrency**: disable Send while a request is in flight; server rejects overlapping sends per thread (best-effort).
- **RLS**: mirror Swipe File’s “superadmin-only + account_id boundary” for every new table.

