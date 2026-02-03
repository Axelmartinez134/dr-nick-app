-- Editor: Review / Approval Flow (Phase 0)
--
-- Adds project-level review flags (Ready/Posted/Approved/Scheduled) and a single comment field,
-- plus a permanent per-account review share token used for /editor/review/<token>.
--
-- MVP queue rule:
-- - show projects where review_ready = true AND review_posted = false
-- - scheduled does NOT remove from queue (not MVP)

-- =========================
-- 1) Project-level review fields
-- =========================
alter table public.carousel_projects
  add column if not exists review_ready boolean not null default false,
  add column if not exists review_posted boolean not null default false,
  add column if not exists review_approved boolean not null default false,
  add column if not exists review_scheduled boolean not null default false,
  add column if not exists review_comment text null;

-- Index for the live review queue (per account, newest first)
create index if not exists carousel_projects_review_queue_idx
  on public.carousel_projects (account_id, updated_at desc)
  where review_ready = true
    and review_posted = false
    and archived_at is null;

-- =========================
-- 2) Account-level permanent review token
-- =========================
alter table public.editor_account_settings
  add column if not exists review_share_token text null;

-- Unique token when present (allow multiple NULLs)
create unique index if not exists editor_account_settings_review_share_token_unique
  on public.editor_account_settings (review_share_token)
  where review_share_token is not null;

