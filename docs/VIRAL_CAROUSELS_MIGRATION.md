# ViralCarousels migration plan

This document is the **implementation plan** for splitting ViralCarousels (and the editor product in this codebase) into a **new GitHub repository** and a **new Supabase project**, wired together for production. It covers **this migration only**—not feature work inside the app.

---

## Goals

1. **Code:** A **new canonical repo** that contains this application (or the subset you decide to keep), deployable on its own.
2. **Data:** A **new Supabase project** that backs that deployment, with schema + data (+ auth users if you use restore) aligned to your cutover plan.
3. **Independence:** Old repo + old Supabase can remain for Dr. Nick / legacy until you decommission them.

---

## Phase A — New GitHub repository

### A1. Create the empty target

- On GitHub, create a **new repository** (e.g. `viral-carousels-app` or your chosen name).
- Do **not** initialize with a README if you plan to push existing history (avoids merge conflicts).

### A2. Copy this codebase into the new repo

**Option 1 — Keep full git history (recommended if you want blame and continuity)**

- From a local clone of **this** repo:
  - Add the new repo as a remote, e.g. `git remote add viral git@github.com:ORG/NEW-REPO.git`
  - Push: `git push viral main` (and any other branches/tags you need).

**Option 2 — Fresh tree, no history**

- Clone this repo, remove `.git`, `git init`, commit, add `origin` to the new repo, push.

### A3. First-pass hygiene in the new repo (before or right after first push)

- Remove or **`.gitignore`** local artifacts you do not want in the canonical repo (saved HTML bundles, `.har` files, duplicate `viral-carousels/` folder if you no longer need it, etc.).
- Confirm **`npm ci`** / **`npm run build`** passes on a clean machine/CI.
- Document **required env vars** for deploy (see Phase D).

### A4. Connect hosting

- Point **Vercel** (or your host) at the **new** repo and **production branch** (`main`).
- Set **environment variables** only on the new project (do not reuse production secrets across old/new unless intentional).

---

## Phase B — New Supabase project (database + auth)

Supabase does **not** offer a single “duplicate entire project including Storage and Edge Functions” control. The **official, closest match** for a **full database + auth user copy** is documented here:

- **Restore to a new project:** [https://supabase.com/docs/guides/platform/clone-project](https://supabase.com/docs/guides/platform/clone-project)

### B1. What “Restore to a new project” transfers (per Supabase docs)

- Database **schema** (tables, views, procedures).
- **All data** and indexes.
- Database **roles, permissions, and users**.
- **`auth` user data** (accounts, **hashed passwords**, auth records in the auth schema).

### B2. What does **not** transfer automatically (manual follow-up)

Per the same docs, you must reconfigure or redo:

| Area | Action |
|------|--------|
| **Storage** | Bucket **configuration** and **object files** are **not** copied. Recreate buckets/policies; copy objects (scripts, CLI, or storage client). |
| **Edge Functions** | Redeploy from your repo or dashboard. |
| **Auth settings & API keys** | New project has **new** URL, **anon** key, **service role** key. Update app env vars; set **Site URL** and **redirect URLs** for the new app domain. |
| **Realtime** | Review and re-enable/configure as needed. |
| **Extensions / DB settings** | Review; disable or reconfigure extensions that trigger **external** work (e.g. cron, webhooks) on the clone if you do not want duplicate side effects. |
| **Read replicas** | Not carried over as part of this story; re-add if you use them. |

### B3. Requirements and restrictions (per Supabase docs)

- Available on **paid plans** with **physical backups** enabled on the **source** project (and PITR is a separate add-on for time-based restore).
- **Projects created via restore** currently **cannot** be used as the source for **another** restore (clone-of-clone limitation—check current docs if this changes).
- New project incurs **new** billing; restore keeps data in the **same region** as the source (data residency).

### B4. Alternative if you do not use “Restore to a new project”

- **Fresh project + migrations:** Apply `supabase/migrations/` in order to an empty database (schema only), then **selective data export/import** or `pg_dump`/`pg_restore` for the tables you need.
- Use this path if you are **not** on a plan with backups, or you want a **smaller** database (e.g. editor-only rows).

---

## Phase C — Wire the new app to the new Supabase

1. In the **new** Supabase project → **Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → server-only secret (e.g. `SUPABASE_SERVICE_ROLE_KEY`—match whatever names your app already reads).
2. In **Authentication → URL configuration**, set:
   - **Site URL** to your new production origin.
   - **Redirect URLs** for local dev and production callbacks.
3. Search the **new repo** for **hard-coded** references to the **old** project (examples from this codebase have included Supabase host in `layout` preconnect and auth storage key patterns). Replace with **env-driven** values or the **new** project ref so sessions and CDN hints stay correct.
4. After **Storage** is recreated and files copied, smoke-test **uploads**, **signed URLs**, and **public** buckets used by editor/marketing flows.

---

## Phase D — Environment and secrets checklist (new deploy)

Copy from the old deployment only where appropriate; **rotate** if the new product should not share third-party quotas with the old one.

**Supabase (required for app auth + data)**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Service role key (server)
- `NEXT_PUBLIC_BASE_URL` (if used for links/canonical URLs)
- `NEXT_PUBLIC_ADMIN_EMAIL` (if you still use admin-email checks)

**AI / integrations** (as used by routes you keep)

- Anthropic, Google AI, OpenAI, Poppy, DeepSeek, Apify, Remove.bg, Google Drive OAuth set, Grok, `CRON_SECRET` for digest cron, etc.

**Scripts** (only if you run them against the new project)

- e.g. `EDITOR_ACCOUNT_ID`, DM bridge vars, `GITHUB_TOKEN` for tooling.

Maintain a single **`.env.example`** (non-secret) in the new repo listing variable **names** and short descriptions.

---

## Phase E — Cutover and verification

1. **Build:** `npm run build` on CI for the new repo.
2. **Staging:** Point a **staging** Vercel project at the new Supabase project first; run through login, `/editor`, `/home`, critical APIs.
3. **DNS / domain:** When ready, move the **marketing** or **app** domain to the new Vercel project; update Supabase auth URLs again if the origin changes.
4. **Decommission (later):** Archive old repo or mark read-only; pause or delete old Supabase project only after backups and DNS are stable.

---

## Optional — Data pruning after clone

If the restored database still contains **Dr. Nick / patient** rows you do not want in the ViralCarousels product, plan a **separate** SQL or application-level cleanup **after** restore, with FK order and backups. This is **not** automatic with restore; treat it as a **post-migration** task with its own checklist.

---

## Summary

| Step | Outcome |
|------|---------|
| **A** | New GitHub repo contains the app; CI/build green. |
| **B** | New Supabase project holds DB (+ auth users if using **Restore to a new project**). |
| **Manual** | Storage, functions, auth URL config, new API keys, extension review. |
| **C–D** | New deploy env matches new Supabase + third-party secrets. |
| **E** | Staging → production cutover → verify → retire old stack when safe.

**Official reference:** [Restore to a new project (Supabase Docs)](https://supabase.com/docs/guides/platform/clone-project)
