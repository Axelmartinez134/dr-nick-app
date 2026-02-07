# Outreach modal (Instagram → Template → Project) — phased implementation plan

Goal: superadmin-only “Outreach” workflow in `/editor` to scrape an Instagram profile (via Apify), create a customized template, create a new **Regular** project titled by the scraped profile name, apply slide 1 + 2–5 template mappings (not slide 6), and persist a record for later CRM.

## Inputs / decisions locked in
- **Actor**: `apify/instagram-profile-scraper` ([Apify store page](https://apify.com/apify/instagram-profile-scraper))
- **Env var**: `APIFY_API_TOKEN=...` (server-side only)
- **Priority scrape fields**
  - `profilePicUrlHD`
  - `fullName`
  - `username` (rendered as `@username`)
- **Template selection**: dropdown shows **all templates** in the active account (uses existing templates list API).
- **Template customization**: match layers by **`kind`** (must exist on selected base template):
  - image: `kind: "avatar"`
  - text: `kind: "display_name"`
  - text: `kind: "handle"`
- **Template/project naming**: `fullName || "@username"`, and if needed append ` (@username)` to avoid collisions.
- **Project behavior**: always create a new **Regular** project named `fullName`, then apply mappings and load it.
- **DB tracking**: create `editor_outreach_targets` with `account_id` as **nullable metadata** (hybrid; not used for access control).

## Phased rollout strategy
We’ll build this in small slices so each phase is testable and reversible.
After each phase is merged, you’ll manually verify the behavior before we continue.

### Phase 0 — Plumbing / safety rails (no UI yet)
- Add `APIFY_API_TOKEN` usage server-side with a clear error when missing.
- Add a small Apify client wrapper (server-only).
- Decide where the Apify token lives (env only).

Deliverables:
- A server-only utility for running the Apify actor and returning the first dataset item.
- Guardrails: timeouts, “dataset empty” error, and redacted error messages (no token leaks).

Manual QA:
- With token missing: endpoint returns a clear 500 error (“Server missing APIFY_API_TOKEN”).
- With token present: endpoint can be hit with a known profile URL and returns JSON.

Checkpoint: you confirm Phase 0 is OK.

### Phase 1 — Top bar button + modal skeleton (superadmin-only)
- Add `Outreach` button in `EditorTopBar` (same className as `Sign Out`).
- Add store state `outreachModalOpen` + actions `onOpenOutreachModal/onCloseOutreachModal` in `state.actions`.
- Add `OutreachModal` component with:
  - Instagram URL input
  - `Scrape` button (disabled until URL is non-empty)
  - placeholder “Scraped data” section

Manual QA:
- As superadmin: button appears left of Account dropdown; opens/closes modal; Esc/backdrop closes.
- As non-superadmin: button is not visible.

Checkpoint: you confirm Phase 1 is OK.

### Phase 2 — Template list dropdown (active account)
- In the modal, load template list from existing `/api/marketing/carousel/templates/list` (account-scoped via `x-account-id`).
- Render as a dropdown with template names (and maybe updatedAt).

Manual QA:
- Dropdown lists templates for the active account.
- Switching accounts changes the dropdown list after reload.

Checkpoint: you confirm Phase 2 is OK.

### Phase 3 — Scrape flow (Apify → UI)
- Add editor API route: `POST /api/editor/outreach/scrape-instagram-profile`
  - Input: `{ url }`
  - Output: `{ fullName, username, profilePicUrlHD, raw }`
- Wire the modal `Scrape` button to call it and render results:
  - Top summary fields (photo URL, name, @handle)
  - Raw payload below (collapsed or preformatted JSON)

Manual QA:
- Valid IG URL → shows summary fields + raw JSON.
- Invalid URL → shows error state, doesn’t crash the modal.
- Re-scrape overwrites prior results cleanly.

Checkpoint: you confirm Phase 3 is OK.

### Phase 4 — Create Template (duplicate + apply kinds)
- Add editor API route: `POST /api/editor/outreach/create-template`
  - Inputs: `{ baseTemplateId, scraped: { fullName, username, profilePicUrlHD, raw } }`
  - Server steps:
    - duplicate base template (existing duplicate endpoint logic)
    - load cloned definition
    - verify required `kind`s exist (avatar/display_name/handle) else fail with a clear error
    - download `profilePicUrlHD` and overwrite the avatar asset file in storage (preserving rect/crop/mask)
    - update `display_name` and `handle` text values
    - rename template to `fullName || "@username"` (+ collision suffix if needed)
    - save template definition
- Return `{ templateId, templateName }`

Manual QA:
- Selecting a base template missing kinds returns a clear error.
- A good base template results in a cloned template where avatar/name/handle are updated.

Checkpoint: you confirm Phase 4 is OK.

### Phase 5 — Create project + update mappings + load project
- Add editor API route: `POST /api/editor/outreach/create-project-from-template`
  - Inputs: `{ templateId, templateName }` + scraped identity
  - Server steps:
    - create Regular project with title `fullName`
    - call existing update-mappings to set:
      - slide 1 template = new template
      - slide 2–5 template = new template
      - leave slide 6 unchanged
  - Return `{ projectId }`
- Modal client:
  - after creating template, show `Create Templates` → triggers template+project pipeline (or two steps behind one button)
  - on success, call existing `actions.onLoadProject(projectId)` to load it

Manual QA:
- After button, editor switches to the new project titled by scraped name.
- Slide 1 and slides 2–5 render using the new template.
- Slide 6 is unchanged.

Checkpoint: you confirm Phase 5 is OK.

### Phase 6 — Persist outreach record (mini CRM table)
- Add a migration for `editor_outreach_targets`:
  - `id` uuid pk
  - `created_at` timestamptz default now()
  - `created_by_user_id` uuid
  - `account_id` uuid null (metadata)
  - `instagram_url` text not null
  - `full_name` text
  - `username` text
  - `profile_pic_url_hd` text
  - `raw_json` jsonb
  - `base_template_id` uuid
  - `created_template_id` uuid
  - `created_project_id` uuid
- Insert a row after success of Phase 5.

Manual QA:
- Successful run inserts exactly one record.
- Records include created ids for later lookup.

Checkpoint: you confirm Phase 6 is OK.

### Phase 7 — Polish / UX hardening
- Add “busy” states:
  - disable buttons while scraping/creating
  - show progress labels (Scraping…, Creating template…, Creating project…)
- Add safe name collision handling on template/project name.
- Add a “Reset” button to clear modal state quickly.

Manual QA:
- No double-submits.
- Clear errors; success state is obvious.

Checkpoint: you confirm Phase 7 is OK.

## Per-change checklist (from EDITOR_CODEBASE_MAP)
- Update `docs/EDITOR_CODEBASE_MAP.md` with new button/modal + API routes + DB table.
- Add a manual QA section per phase (above).
- Keep UI in `src/features/editor/components/*`, orchestration in `src/features/editor/hooks/*`, APIs in `src/app/api/editor/*`.

