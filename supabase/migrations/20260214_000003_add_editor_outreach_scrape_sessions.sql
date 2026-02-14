-- Editor: Outreach scrape sessions (Following tab persistence)
-- Persist latest scrape results so reopening Outreach modal restores the table.

create table if not exists public.editor_outreach_scrape_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  -- Metadata (nullable; not used for access control)
  account_id uuid null references public.editor_accounts(id) on delete set null,

  kind text not null, -- e.g. 'following'
  seed_instagram_url text null,
  seed_username text null,
  max_results integer null,
  max_spend_usd numeric null,
  actor_id text null,
  items jsonb not null default '[]'::jsonb
);

create index if not exists editor_outreach_scrape_sessions_account_kind_created_at_idx
  on public.editor_outreach_scrape_sessions (account_id, kind, created_at desc);

alter table public.editor_outreach_scrape_sessions enable row level security;

-- Superadmins-only (Outreach is superadmin-only).
drop policy if exists "editor_outreach_scrape_sessions_select_superadmin" on public.editor_outreach_scrape_sessions;
create policy "editor_outreach_scrape_sessions_select_superadmin"
  on public.editor_outreach_scrape_sessions
  for select
  using (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "editor_outreach_scrape_sessions_insert_superadmin" on public.editor_outreach_scrape_sessions;
create policy "editor_outreach_scrape_sessions_insert_superadmin"
  on public.editor_outreach_scrape_sessions
  for insert
  with check (
    exists (
      select 1
      from public.editor_superadmins s
      where s.user_id = auth.uid()
    )
  );

grant all on public.editor_outreach_scrape_sessions to authenticated;

