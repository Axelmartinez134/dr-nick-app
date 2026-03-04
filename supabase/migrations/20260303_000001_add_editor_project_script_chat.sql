-- /editor: Project Script Chat (MVP)
-- Adds persisted per-project chat threads/messages for "Create Script".
-- Superadmin-only (mirrors Swipe File access model).

-- =========================
-- 1) Threads (1 per project)
-- =========================
create table if not exists public.editor_project_script_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  project_id uuid not null references public.carousel_projects(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  -- Frozen snapshot captured on first message; reused for the whole thread.
  context_snapshot jsonb not null
);

create unique index if not exists editor_project_script_threads_account_project_uidx
  on public.editor_project_script_threads (account_id, project_id);

create index if not exists editor_project_script_threads_account_created_at_idx
  on public.editor_project_script_threads (account_id, created_at desc);

alter table public.editor_project_script_threads enable row level security;

drop policy if exists "editor_project_script_threads_select_superadmin" on public.editor_project_script_threads;
create policy "editor_project_script_threads_select_superadmin"
  on public.editor_project_script_threads
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "editor_project_script_threads_insert_superadmin" on public.editor_project_script_threads;
create policy "editor_project_script_threads_insert_superadmin"
  on public.editor_project_script_threads
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "editor_project_script_threads_update_superadmin" on public.editor_project_script_threads;
create policy "editor_project_script_threads_update_superadmin"
  on public.editor_project_script_threads
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "editor_project_script_threads_delete_superadmin" on public.editor_project_script_threads;
create policy "editor_project_script_threads_delete_superadmin"
  on public.editor_project_script_threads
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.editor_project_script_threads to authenticated;

-- =========================
-- 2) Messages (persisted chat history)
-- =========================
create table if not exists public.editor_project_script_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  thread_id uuid not null references public.editor_project_script_threads(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null
);

create index if not exists editor_project_script_messages_thread_created_at_idx
  on public.editor_project_script_messages (thread_id, created_at asc);

create index if not exists editor_project_script_messages_account_created_at_idx
  on public.editor_project_script_messages (account_id, created_at desc);

alter table public.editor_project_script_messages enable row level security;

drop policy if exists "editor_project_script_messages_select_superadmin" on public.editor_project_script_messages;
create policy "editor_project_script_messages_select_superadmin"
  on public.editor_project_script_messages
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "editor_project_script_messages_insert_superadmin" on public.editor_project_script_messages;
create policy "editor_project_script_messages_insert_superadmin"
  on public.editor_project_script_messages
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "editor_project_script_messages_update_superadmin" on public.editor_project_script_messages;
create policy "editor_project_script_messages_update_superadmin"
  on public.editor_project_script_messages
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "editor_project_script_messages_delete_superadmin" on public.editor_project_script_messages;
create policy "editor_project_script_messages_delete_superadmin"
  on public.editor_project_script_messages
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.editor_project_script_messages to authenticated;

