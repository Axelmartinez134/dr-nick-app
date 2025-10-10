-- Adds lifetime alias metrics to persist view and CTA counts across snapshots
-- Safe to run multiple times (IF NOT EXISTS)

begin;

-- 1) Add columns on aliases for lifetime totals
alter table if exists public.marketing_aliases
  add column if not exists total_view_count bigint not null default 0,
  add column if not exists total_cta_count bigint not null default 0;

-- 2) Backfill from existing per-snapshot counts
--    Sums across all marketing_shares rows for each alias (case-insensitive match)
update public.marketing_aliases a
set total_view_count = coalesce(s.sum_views, 0),
    total_cta_count  = coalesce(s.sum_cta,  0)
from (
  select alias,
         sum(coalesce(view_count, 0))        as sum_views,
         sum(coalesce(cta_click_count, 0))   as sum_cta
  from public.marketing_shares
  group by alias
) s
where lower(a.alias) = lower(s.alias);

commit;

-- Notes:
-- - API is updated to increment these alias totals alongside per-snapshot counts.
-- - If you later add historic data, re-run the backfill UPDATE to recompute totals.


