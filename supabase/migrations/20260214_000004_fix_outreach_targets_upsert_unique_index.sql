-- Fix: allow PostgREST/Supabase upsert ON CONFLICT to work for following prospects.
-- The API route `POST /api/editor/outreach/persist-prospects` uses `onConflict` columns.
-- Postgres requires a UNIQUE constraint/index matching those columns exactly.

-- 1) Best-effort de-dupe any historical duplicates for following rows.
with ranked as (
  select
    id,
    row_number() over (
      partition by account_id, source_type, source_seed_username, prospect_username
      order by created_at desc, id desc
    ) as rn
  from public.editor_outreach_targets
  where
    account_id is not null
    and source_type is not null
    and source_seed_username is not null
    and prospect_username is not null
)
delete from public.editor_outreach_targets t
using ranked r
where t.id = r.id and r.rn > 1;

-- 2) Create a UNIQUE index that matches the upsert conflict target.
-- Note: we intentionally do NOT make this a partial index so PostgREST can use it for `on_conflict`.
create unique index if not exists editor_outreach_targets_following_upsert_unique_idx
  on public.editor_outreach_targets (account_id, source_type, source_seed_username, prospect_username);

