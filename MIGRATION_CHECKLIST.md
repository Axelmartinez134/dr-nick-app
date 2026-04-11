# MIGRATION_CHECKLIST.md

Post-restore checklist for the new Supabase project. Work through every section after the "Restore to new project" completes. Items marked **CRITICAL** will break the app if skipped.

---

## 1. Hardcoded Project References — Update in New Repo **CRITICAL**

These are not env vars — they are string literals baked into source files. Must be updated in the new repo before deploying.

- [ ] **`src/app/layout.tsx` lines 39–40** — DNS prefetch and preconnect links point to old project URL `pobkamvdnbxhmyfwbnsj.supabase.co`. Replace both with new project URL.
- [ ] **`src/app/components/auth/AuthContext.tsx` line 325** — localStorage key `sb-pobkamvdnbxhmyfwbnsj-auth-token` is hardcoded. Replace `pobkamvdnbxhmyfwbnsj` with new project ref (or make it dynamic from `NEXT_PUBLIC_SUPABASE_URL`).
- [ ] **`src/features/html-editor/lib/importedMirrTechPresets.ts`** — Multiple lines contain old project URL in preset data (image URLs). Audit and update all occurrences to point at new Storage bucket URLs, or make them relative.

---

## 2. Environment Variables — Set on New Deployment **CRITICAL**

Set all of these in Vercel (or wherever you deploy) for the new project.

### Supabase (new values from new project dashboard → Settings → API)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — new project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — new anon/public key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — new service role key
  - Note: code also falls back to `NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_SERVICE`, `SUPABASE_SERVICE_KEY` — set whichever name you standardize on

### App Config
- [ ] `NEXT_PUBLIC_ADMIN_EMAIL` — admin email for Dr. Nick role detection (also hardcoded in RLS policies — see Section 4)
- [ ] `NEXT_PUBLIC_BASE_URL` — production origin (used in links/canonical URLs)

### AI APIs
- [ ] `ANTHROPIC_API_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `GOOGLE_AI_API_KEY`
- [ ] `GROK_API_KEY`
- [ ] `GROK_API_BASE_URL` (default: `https://api.x.ai/v1`)
- [ ] `GROK_MODEL` (default: `grok-4`)
- [ ] `DEEPSEEK_API_KEY`

### Image / Asset APIs
- [ ] `CLIPDROP_API_KEY`
- [ ] `REMOVEBG_API_KEY`
- [ ] `POPPY_API_KEY`

### Integrations
- [ ] `APIFY_API_TOKEN`
- [ ] `SWIPE_CAPTURE_KEY`
- [ ] `SWIPE_CAPTURE_OWNER_USER_ID` — user ID value must match a real user in the new project (see Section 8)
- [ ] `GOOGLE_DRIVE_OAUTH_CLIENT_ID`
- [ ] `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`
- [ ] `GOOGLE_DRIVE_OAUTH_REDIRECT_URI`
- [ ] `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`

---

## 3. Supabase Auth Settings **CRITICAL**

The restore copies auth user records but not the project's Auth configuration. Redo all of this in the new project dashboard → Authentication.

### URL Configuration
- [ ] **Site URL** — set to new production domain
- [ ] **Redirect URLs** — add all allowed redirect origins:
  - Production domain
  - `http://localhost:3000` (local dev)
  - Any staging URLs

### Email Auth
- [ ] Email provider enabled (app uses `signInWithPassword` and `signUp`)
- [ ] Confirm email template customization (if any was done on old project)
- [ ] Password reset email template (app has a `/reset-password` flow)

### OAuth Providers
- [ ] No Supabase OAuth providers are used in this app (Google Drive OAuth is handled server-side via googleapis, not via Supabase Auth). Confirm this remains the case — no `signInWithOAuth` calls exist in the codebase.

---

## 4. RLS Policies — Verify All Applied **CRITICAL**

The restore should carry all policies over. Verify each table has policies active by running `SELECT tablename, policyname, cmd FROM pg_policies ORDER BY tablename;` in the new project's SQL editor.

### Tables that must have RLS enabled and policies active:

**`profiles`** (Dr. Nick health tracking)
- [ ] Patient self-read/write policy
- [ ] Admin full-access policy (uses hardcoded `NEXT_PUBLIC_ADMIN_EMAIL` — verify email matches)

**`health_data`** (Dr. Nick health tracking)
- [ ] Patient self-read/write policy
- [ ] Admin full-access policy

**`carousel_projects`**
- [ ] `carousel_projects_select_account_member`
- [ ] `carousel_projects_insert_account_admin_owner`
- [ ] `carousel_projects_update_account_admin_owner`
- [ ] `carousel_projects_delete_account_admin_owner`

**`carousel_project_slides`**
- [ ] `carousel_project_slides_select_account_member`
- [ ] `carousel_project_slides_insert_account_admin_owner`
- [ ] `carousel_project_slides_update_account_admin_owner`
- [ ] `carousel_project_slides_delete_account_admin_owner`

**`editor_accounts`**
- [ ] `editor_accounts_select_member`

**`editor_account_memberships`**
- [ ] `editor_account_memberships_select_self`

**`editor_account_settings`**
- [ ] `editor_account_settings_select_member`
- [ ] `editor_account_settings_insert_admin_owner`

**`editor_idea_sources`**
- [ ] `editor_idea_sources_select_own`
- [ ] `editor_idea_sources_insert_own`
- [ ] `editor_idea_sources_update_own`

**`editor_ideas`**
- [ ] `editor_ideas_delete_own`

**`carousel_templates`**
- [ ] `Carousel templates: read own` (account member OR legacy owner)

**`carousel_template_type_overrides`**
- [ ] `Template type overrides: select self only`
- [ ] `Template type overrides: insert self only`
- [ ] `Template type overrides: update self only`
- [ ] `Template type overrides: delete self only`

**`editor_outreach_targets`**
- [ ] `editor_outreach_targets_update_policy`

**`storage.objects`**
- [ ] `Public read carousel templates bucket` (SELECT TO anon, bucket_id = 'carousel-templates')
- [ ] `Public role read carousel templates bucket` (SELECT TO public, bucket_id = 'carousel-templates')

---

## 5. Database Functions and Triggers — Verify Present

Run `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';` and `SELECT trigger_name, event_object_table FROM information_schema.triggers;` to confirm.

- [ ] Function `trigger_update_ai_carousels_updated_at()` exists
- [ ] Trigger `update_ai_carousels_updated_at` on `ai_carousels` (BEFORE UPDATE)
- [ ] Function `update_carousel_template_type_overrides_updated_at()` exists
- [ ] Trigger `trigger_update_carousel_template_type_overrides_updated_at` on `carousel_template_type_overrides` (BEFORE UPDATE)
- [ ] Function `update_editor_account_settings_updated_at()` exists
- [ ] Trigger `trigger_update_editor_account_settings_updated_at` on `editor_account_settings` (BEFORE UPDATE)
- [ ] Trigger `trigger_update_carousel_projects_updated_at` on `carousel_project_slides` (touches parent `carousel_projects.updated_at` on INSERT/UPDATE)

---

## 6. Storage Buckets — Recreate Manually **CRITICAL**

Storage buckets and their objects are **not** copied by Supabase restore. Recreate each bucket in the new project dashboard → Storage, then migrate files.

### Buckets to recreate:

- [ ] **`carousel-templates`** — PUBLIC bucket
  - [ ] Re-enable public read policy (Storage → Policies → add public SELECT for anon and public roles)
  - [ ] Copy all template files from old project Storage → `carousel-templates` to new bucket
  - [ ] Verify `allow_editor_users_edit_carousel_templates` RLS policy applied (from migration `20260107_000005`)

- [ ] **`carousel-project-images`** — PUBLIC bucket
  - [ ] Create bucket with public access
  - [ ] Copy existing project slide images (or accept that old project images stay on old project — new content will populate naturally)

- [ ] **`marketing-assets`** — PUBLIC bucket
  - [ ] Create bucket with public access
  - [ ] Copy branding uploads and draft assets if needed

- [ ] **`editor-shared-assets`** — PUBLIC bucket
  - [ ] Create bucket (migration `20260125_000004` defines this)
  - [ ] Storage policy for authenticated insert, public read
  - [ ] Copy logo cache files if needed

- [ ] **`reels`** — PRIVATE bucket
  - [ ] Create private bucket
  - [ ] Set appropriate RLS policies for authenticated users
  - [ ] Copy reel media files if needed

- [ ] **`health-images`** — PRIVATE bucket (Dr. Nick patient images)
  - [ ] Create private bucket with signed URL access
  - [ ] Copy patient Lumen device images and food log images if this data is being carried over

---

## 7. GRANT Statements — Verify Table Permissions

- [ ] `GRANT ALL ON public.ai_carousels TO authenticated` — run if missing
- [ ] `GRANT ALL ON public.editor_users TO authenticated` — run if missing
- [ ] `GRANT ALL ON public.carousel_template_type_overrides TO authenticated` — run if missing
- [ ] `GRANT ALL ON public.carousel_template_type_overrides TO anon` — run if missing

---

## 8. Seeded Data — Verify Present After Restore

These rows are inserted by migrations and must exist in the new project.

- [ ] **`editor_superadmins`** — row for `axel@measurezpro.com` must exist (seeded in migration `20260130_000002`)
- [ ] **`carousel_template_types`** — `html` type seeded in migration `20260405_000002_seed_html_template_type.sql`
- [ ] **System HTML presets** — seeded in `20260409_000001_seed_system_html_presets.sql` and `20260409_000002_align_html_preset_metadata.sql`
- [ ] **Imported Mirr tech presets** — seeded in `20260410_000001_seed_imported_mirr_tech_presets.sql` and `20260410_000002_seed_remaining_mirr_tech_presets.sql`
- [ ] **`SWIPE_CAPTURE_OWNER_USER_ID`** env var — this must be updated to the actual `auth.uid()` of the account owner in the new project (the user ID changes on restore if users are migrated)

---

## 9. Edge Functions

- [ ] No edge functions exist in this codebase (no `supabase/functions/` directory). Nothing to redeploy. Confirm this is still true at migration time.

---

## 10. Realtime

- [ ] No Realtime subscriptions are used in this codebase. No tables need Realtime enabled. Confirm at migration time.

---

## 11. Database Webhooks

- [ ] No database webhooks are configured in this codebase. Nothing to recreate.

---

## 12. pg_cron / Scheduled Jobs

- [ ] No pg_cron jobs found in migrations or code. The daily digest is triggered via an API route (not a DB cron). Nothing to recreate in DB scheduler.
- [ ] If you set up a Vercel cron for the daily digest, re-add it in `vercel.json` and set the `CRON_SECRET` env var on the new deployment.

---

## 13. PostgreSQL Extensions

- [ ] No explicit `CREATE EXTENSION` statements found in migrations. Verify in new project → Database → Extensions that any extensions relied on by Supabase internals (e.g. `uuid-ossp`, `pg_graphql`, `pgcrypto`) are enabled — they usually are by default on new projects.

---

## 14. Migration Files — Apply Any Missing

The restore copies data state, not the migration history table state. Verify all 91 migration files from `supabase/migrations/` are reflected in the new DB schema. If any are missing, apply them in chronological order via SQL editor.

- [ ] Run the query: `SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;` to see which are recorded.
- [ ] If migrations table is absent or incomplete, compare against the file list in `supabase/migrations/` and apply missing ones manually.

---

## 15. Post-Migration Smoke Tests

Run through these after all above items are checked.

- [ ] Login as admin email → redirected to `/admin` or `/editor`
- [ ] Login as a patient user → redirected to `/[alias]`
- [ ] Editor access check works: user with `editor_account_memberships` row → `/editor` loads
- [ ] Carousel template browser loads templates from `carousel-templates` bucket
- [ ] Upload an image to a carousel project slide → confirms `carousel-project-images` bucket write works
- [ ] Signed URL generation works for private `health-images` bucket
- [ ] `/home` (ViralCarousels marketing landing) loads without Supabase errors
- [ ] Password reset email flow works with new project's auth URL config
- [ ] Daily digest API route responds (confirms AI keys + new Supabase connection)

---

## Summary

| Category | Auto-transferred by restore? | Manual action required? |
|---|---|---|
| DB schema + tables | Yes | Verify |
| All data rows | Yes | Verify seeded rows |
| RLS policies | Yes | Verify + check admin email |
| Functions + triggers | Yes | Verify present |
| Auth user accounts | Yes | Verify |
| Storage buckets | **No** | Recreate all 5–6 buckets |
| Storage files/objects | **No** | Copy all files manually |
| Auth URL config | **No** | Set Site URL + redirects |
| API keys (anon, service) | **No** — new keys generated | Update all env vars |
| Hardcoded project ref | **No** — in source code | Edit 3 source files |
| Seeded data rows | Yes (part of data) | Verify exist |
| Edge functions | N/A — none exist | — |
| Realtime | N/A — not used | — |
| pg_cron | N/A — not used | — |
