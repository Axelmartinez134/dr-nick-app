# Agency / Client Accounts Plan (Editor-Only Multi-Tenancy)

This document is the **single source of truth** for adding an **agency-style multi-tenant model** to the `/editor` route **without impacting the rest of the app**.

## Alignment with `docs/EDITOR_CODEBASE_MAP.md` (how we will implement)

This plan is written to match the current `/editor` architecture and working conventions:

- **Keep changes small + feature-scoped**:
  - UI changes in `src/features/editor/components/*`
  - orchestration in `src/features/editor/hooks/*`
  - API callers in `src/features/editor/services/*` (or a shared authed fetch helper used by those services)
- **Keep `src/app/editor/EditorShell.tsx` as composition/wiring**, not a dumping ground.
- **Use the stable actions surface** (`state.actions`) for UI handlers; avoid creating new handler surfaces.
- **Honor the auth nuance**: all `/api/editor/**` routes require `Authorization: Bearer <token>` (via `getAuthedSupabase()`), so the new `x-account-id` header must be attached in the **same authed request path** used by existing editor API calls (not via unauthenticated `fetch()` or ad-hoc Supabase client queries).

## Goals

- **Editor-only multi-tenancy**: isolate all `/editor` data by **Account** (workspace), not by user.
- **Clients log in** and use the exact same `/editor` UI.
- **Ax (superadmin)** can switch between Accounts via a **top header dropdown**.
- **Per-account prompts/settings**: when Ax switches into a client account and edits prompts, the client sees those changes too.
- **Recents shared per account**: Ax + client see the same Recents in that account.
- **Templates owned by the account**: edits apply to the client workspace.

## Non-goals (hard constraints)

- Do **not** modify or re-scope the existing non-editor app (profiles/health/doctor/patient logic).
- Do **not** change any current `profiles`, `health_data`, or related business logic tables.
- Do **not** add “agency teammate accounts” yet (v1 can rely on memberships; teammates are a later feature).

## Glossary

- **Account**: a client workspace (tenant). One client company = one Account. Ax’s own work is also an Account.
- **Membership**: a user’s association to an Account with a role.
- **Role**:
  - **owner**: client (billing / ultimate control)
  - **admin**: Ax (operates the account; can edit everything)
  - **member**: reserved for later
- **Active Account**: the Account context currently selected in the editor.

## Current state (single-tenant by user)

Today, editor scoping is primarily by `auth.uid()` via:

- `carousel_projects.owner_user_id`
- `carousel_templates.owner_user_id`
- `carousel_template_type_overrides.user_id`
- `editor_recent_assets.owner_user_id`
- `editor_idea_*` tables use `owner_user_id`
- `editor_users` provides `/editor` gating and stores prompts/settings

Many `/api/editor/**` routes do `.eq('owner_user_id', user.id)` (or read settings from `editor_users`).

## Target state (multi-tenant by account)

### Tenant boundary

Everything in `/editor` must be scoped by **`account_id`**.

### Core principle

We do **not** “impersonate” users. Ax stays logged in as Ax, but operates within an Account context.

### Active Account context transport

All `/api/editor/**` requests include an `active_account_id` in a single consistent way:

- **Header**: `x-account-id: <uuid>` (recommended for v1)

Client fetch helper attaches this header to every editor API call.

**Implementation note (per `EDITOR_CODEBASE_MAP`)**:
Prefer implementing this in the editor’s existing authed request helper / services layer so:
- all modals/features automatically inherit the account context
- we don’t introduce “one-off” `fetch()` calls that forget to include headers
- we preserve the pattern that editor APIs require `Authorization: Bearer <token>`

### Editor access gate

Replace the `/editor` allowlist gate (`editor_users`) with:

- user can access `/editor` **iff** they have at least one `account_membership`.

This supports SaaS (new customers can be onboarded by creating an Account + membership, without editing `editor_users`).

## Database design (v1)

### New tables

#### `public.accounts`

- `id uuid primary key default gen_random_uuid()`
- `name text not null` (ex: `Acme (Client)`)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

#### `public.account_memberships`

- `account_id uuid not null references public.accounts(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `role text not null check (role in ('owner','admin','member'))`
- `created_at timestamptz not null default now()`
- **primary key** `(account_id, user_id)`

#### `public.superadmins`

- `user_id uuid primary key references auth.users(id) on delete cascade`

Seed only Ax initially.

### New “account settings” table (per-account prompts/routing/models)

We want prompt/settings edits to affect the whole Account (client + Ax).

#### `public.editor_account_settings`

- `account_id uuid primary key references public.accounts(id) on delete cascade`
- `poppy_conversation_url text null`
- `ai_image_gen_model text not null default 'gpt-image-1.5'`
- `ideas_prompt_override text null`
- `caption_regen_prompt_override text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

This replaces editor-specific settings currently stored on `editor_users`.

## Table changes (editor-only)

### Must become account-scoped

Add `account_id uuid references public.accounts(id)` (NOT NULL after backfill) to:

- `public.carousel_projects`
- `public.carousel_templates`
- `public.carousel_template_type_overrides`
  - **New key** should include `account_id` (see below).
- `public.editor_recent_assets` (recents shared per account)
- `public.editor_idea_sources`
- `public.editor_idea_runs`
- `public.editor_ideas`
- `public.editor_idea_carousel_runs`
- `public.carousel_caption_regen_runs`

### Key schema decisions

#### Template type overrides

Today: `PRIMARY KEY (user_id, template_type_id)` which will leak across accounts for Ax.

Target:

- **Account-owned** overrides: `PRIMARY KEY (account_id, template_type_id)`
  - Simplest and matches “workspace settings”.
  - Any member (owner/admin) edits the same prompts.

If later we ever need per-user personalization inside an account, we can add `account_member_overrides` as an overlay. Not now.

#### Templates

Templates are shared within the account; store `account_id` on `carousel_templates`.

#### Recents

Recents should be shared within an account, so store `account_id` on `editor_recent_assets`.
Update unique constraints to dedupe within account.

## RLS approach (account membership-based)

### Helper functions (recommended)

Create Postgres helper functions to keep policies readable:

- `is_superadmin()` → checks row exists in `public.superadmins` for `auth.uid()`.
- `is_account_member(account_id uuid)` → checks membership exists for `auth.uid()` on that account.

Then RLS policies become:

- `USING (is_account_member(account_id))`
- `WITH CHECK (is_account_member(account_id))`

### RLS pattern per table

- Account-owned tables (`accounts`, `account_memberships`, `editor_account_settings`, `carousel_projects`, etc.)
  - **select**: allow if member
  - **insert/update/delete**: allow based on role (owner/admin for write; members later)

Role enforcement can be done either:

- in RLS (`exists membership where role in ('owner','admin')`), or
- in API routes (simpler v1), while RLS enforces membership only.

Preferred: enforce role in RLS for sensitive tables as soon as practical.

## API & codebase impact map (pretend implementation checklist)

### Auth & gating

- `src/app/components/auth/AuthContext.tsx`
  - Replace `checkEditorMembership()`:
    - from `editor_users` membership
    - to `account_memberships` membership
  - Add superadmin detection (seeded by `superadmins` table; email only for initial seeding if needed).
  - Add `activeAccountId` state (loaded from localStorage/cookie) and `setActiveAccountId`.

- `src/app/editor/page.tsx`
  - Gate by “has at least one membership” (from `AuthContext`) instead of `editor_users`.

### Active account propagation

- Editor client fetch helper / services layer (`src/features/editor/services/*`):
  - Attach `x-account-id` header to every `/api/editor/**` request.
  - Enforce that requests fail clearly if missing.
  - Keep behavior consistent with the current editor auth model (`Authorization: Bearer <token>`).

- `src/app/api/editor/_utils.ts`
  - Add helper: `getActiveAccountId(request)` reads `x-account-id`.
  - Add helper: `assertAccountMembership(supabase, user.id, accountId)` (or rely on RLS + extra checks for clearer errors).

### Editor boot / initial state (highest impact)

- `src/app/api/editor/initial-state/route.ts`
  - Replace `.eq('owner_user_id', user.id)` for templates/projects with `.eq('account_id', activeAccountId)`.
  - Starter template bootstrapping:
    - create starter template under account
    - create account-scoped template type overrides
  - Replace reading `editor_users.ai_image_gen_model` with `editor_account_settings.ai_image_gen_model`.

### Projects (core CRUD)

Update these to scope by account and set `account_id` on inserts:

- `src/app/api/editor/projects/list/route.ts`
- `src/app/api/editor/projects/load/route.ts`
- `src/app/api/editor/projects/create/route.ts`
- `src/app/api/editor/projects/update/route.ts`
- `src/app/api/editor/projects/archive/route.ts`
- `src/app/api/editor/projects/update-mappings/route.ts`
- `src/app/api/editor/projects/set-template-type/route.ts`

### Slides and jobs

Verify membership via project/account:

- `src/app/api/editor/projects/slides/update/route.ts`
- `src/app/api/editor/projects/slides/image/*`
- `src/app/api/editor/projects/jobs/*`

### Prompts/settings routes

These must become **account settings** routes:

- Replace:
  - `/api/editor/user-settings/image-gen-model`
  - `/api/editor/user-settings/ideas-prompt`
  - `/api/editor/user-settings/caption-regen-prompt`

with account-context behavior:
- read/write `editor_account_settings` for `activeAccountId`.

### Ideas feature

All `editor_idea_*` routes must become account-scoped:

- `src/app/api/editor/ideas/*`

### Recents

- `src/app/api/editor/assets/recents/route.ts`
  - Replace `.eq('owner_user_id', user.id)` with `.eq('account_id', activeAccountId)`
  - Update upsert conflict keys for account-level dedupe.

### UI changes

#### Account switcher (superadmin only)

- `src/features/editor/components/EditorTopBar.tsx`
  - Add a dropdown labeled `Account: <name>`.
  - Visible only if `AuthContext.isSuperadmin`.
  - On switch:
    - set active account id
    - trigger editor re-bootstrap (reload initial state / refresh projects list)

#### Remove reliance on `editor_users.first_name`

`EditorTopBar` currently reads first name from `editor_users`. With membership-only gating and account settings, we should:

- Show `Welcome, <auth metadata name>` (optional), and/or
- Prefer showing the Account name prominently (required for agency UX).

**Implementation note (per `EDITOR_CODEBASE_MAP`)**:
Avoid direct Supabase table queries from UI components when possible; prefer routing reads through existing editor state/actions or authed editor API routes so we don’t create parallel data-fetch patterns.

## Storage paths (optional)

Not required for correctness if RLS + DB scoping is correct.

If desired for clarity:
- New uploads can be stored under `accounts/<account_id>/projects/<project_id>/...`
- Existing assets can remain in-place; no forced migration is required in v1.

## Migration / rollout phases (production-safe order)

### Phase A — DB foundations (no behavior change)

- Add `accounts`, `account_memberships`, `superadmins`, `editor_account_settings`
- Seed Ax as superadmin and create Ax’s personal account

### Phase B — Add account_id columns (still no behavior change)

- Add nullable `account_id` to all editor-owned tables listed above
- Backfill existing rows to Ax’s account (and for future: backfill each existing editor user’s data to their own account)

### Phase C — Switch /editor gating to memberships (minimal app change)

- Update `AuthContext` and `/editor` gate to membership-only

### Phase D — Switch project scoping to account_id (core tenant boundary)

- Update projects APIs + initial-state to read/write account-scoped
- Update RLS policies for these tables to membership-based
- Make `carousel_projects.account_id` NOT NULL (after backfill)

### Phase E — Move prompts/settings to per-account settings

- Create account settings rows for existing accounts
- Move values from `editor_users.*` into `editor_account_settings.*`
- Update settings routes and generation routes to read account settings

### Phase F — Migrate templates/overrides to account ownership

- Convert templates and template type overrides to account-scoped
- Ensure starter template bootstrap uses account-based keys

### Phase G — Migrate recents, ideas, caption regen history to account scope

- Convert remaining “editor feature” tables to account_id

### Deferred investigation — /editor “white screen” performance regression

Observed:
- `/editor` sometimes shows a ~multi-second white/blank area before slide previews appear, even though JS chunks and `fabric` download quickly (network 200s, low ms).

Most likely cause:
- CPU/main-thread work during first render: multiple `CarouselPreviewVision` canvases initializing Fabric + fonts + text layout at once.

Attempted mitigation (did not fully resolve):
- Added `deferInit` support to `CarouselPreviewVision` to delay Fabric initialization until idle time for non-active slide previews.
- Wired `/editor` to initialize only the active slide immediately and defer other slides.

Why it may still appear white:
- The active slide still does heavy initialization work up-front.
- The UI currently switches from “Loading template…” to the canvas area as soon as `templateSnapshot` is present, even if Fabric/fonts are not ready yet.

Next steps (when revisiting):
- Keep showing “Loading template…” (or a skeleton) until the **active** slide reports `fabricLoaded` (and ideally fonts ready), so the user never sees blank space.
- Consider virtualizing or limiting the number of preview canvases mounted at once on desktop (mount only active + neighbors).
- Measure in DevTools Performance: time spent in script eval vs font loading vs layout/text measurement.

### Phase H — Optional: storage path prefixing

If desired, update upload routes to include account in paths.

## Manual onboarding (v1: Supabase dashboard)

To onboard a new client:

1) Create `auth.users` (client signs up normally)
2) Create an `accounts` row:
   - name: `ClientName (Client)`
3) Add memberships:
   - client user: role `owner`
   - Ax user: role `admin`
4) Create `editor_account_settings` row for the account:
   - set `poppy_conversation_url`
   - optionally set default prompts/models

## Post-v1: internal admin screen (later)

After all migration phases are complete:

- Add a simple admin-only page to:
  - create accounts
  - add memberships
  - set account settings

This should be implemented only once the data model is stable.

## Acceptance criteria (v1 agency)

- Ax can switch accounts in `/editor` header dropdown.
- Switching accounts changes:
  - Saved Projects list
  - Templates visible
  - Prompts/settings used by generation
  - Recents library
  - Ideas + caption regen history
- Client sees identical `/editor` UI and only their workspace data.
- No changes to the rest of the app’s current user/profile/health flows.

## Manual QA (Agency accounts)

- As Ax (superadmin), open `/editor`
  - Expected: “Account: …” dropdown is visible in the top header
- Switch Account in dropdown
  - Expected: Saved Projects list changes immediately to that account’s projects
  - Expected: Templates visible are only that account’s templates
  - Expected: Prompts/settings (Generate Copy routing, image model, ideas/caption prompts) match the selected account
  - Expected: Recents list is shared within the account (Ax + client see same assets)
- As a client user, open `/editor`
  - Expected: no account dropdown (single-account UX)
  - Expected: only client’s account data is visible
- Verify non-editor app behavior unchanged
  - Expected: `/` dashboard / profiles / health flows behave exactly as before

