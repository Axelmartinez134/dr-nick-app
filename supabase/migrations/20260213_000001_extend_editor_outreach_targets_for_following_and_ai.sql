-- Editor: Outreach targets (Following scrape + AI qualification + enrichment)
-- Extends public.editor_outreach_targets so it can act as the unified Outreach “spreadsheet”.

alter table if exists public.editor_outreach_targets
  add column if not exists source_type text null, -- e.g. 'single_profile' | 'following'
  add column if not exists source_seed_username text null,
  add column if not exists source_seed_instagram_url text null,
  add column if not exists source_raw_json jsonb null,

  -- Prospect snapshot (from following scrape actor)
  add column if not exists prospect_username text null,
  add column if not exists prospect_full_name text null,
  add column if not exists prospect_profile_pic_url text null,
  add column if not exists prospect_is_verified boolean null,
  add column if not exists prospect_is_private boolean null,

  -- AI qualification (Lite by default; may later be 'enriched')
  add column if not exists ai_score integer null,
  add column if not exists ai_niche text null,
  add column if not exists ai_reason text null,
  add column if not exists ai_has_offer boolean null,
  add column if not exists ai_credential text null,
  add column if not exists ai_scored_at timestamptz null,
  add column if not exists ai_model text null,
  add column if not exists ai_mode text null, -- 'lite' | 'enriched'

  -- Enrichment snapshot (from existing profile scraper)
  add column if not exists enriched_profile_pic_url_hd text null,
  add column if not exists enriched_raw_json jsonb null,
  add column if not exists enriched_at timestamptz null,

  -- Action status (per-row project/template creation)
  add column if not exists project_created_at timestamptz null;

-- Dedupe: following prospects are uniquely identified by (account, seed, username).
-- NOTE: account_id is nullable; coalesce to a sentinel UUID so uniqueness holds for null account rows too.
create unique index if not exists editor_outreach_targets_following_dedupe_idx
  on public.editor_outreach_targets (
    coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source_seed_username,
    prospect_username
  )
  where
    source_type = 'following'
    and source_seed_username is not null
    and prospect_username is not null;

-- Helpful query indexes for the “spreadsheet” UI.
create index if not exists editor_outreach_targets_account_ai_score_created_at_idx
  on public.editor_outreach_targets (account_id, ai_score desc nulls last, created_at desc);

create index if not exists editor_outreach_targets_account_seed_created_at_idx
  on public.editor_outreach_targets (account_id, source_seed_username, created_at desc);

