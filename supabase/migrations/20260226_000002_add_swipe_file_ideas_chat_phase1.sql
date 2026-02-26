-- Swipe File: Ideas Chat (Phase 1)
-- Adds persisted per-item chat threads/messages + saved Idea entities.
-- Superadmin-only (mirrors Swipe File access model).
--
-- Also adds: editor_account_settings.swipe_ideas_master_prompt_override (account-global editable prompt).

-- =========================
-- 0) Account settings: master prompt override
-- =========================
alter table if exists public.editor_account_settings
  add column if not exists swipe_ideas_master_prompt_override text null;

-- =========================
-- 1) Threads (1 per swipe item)
-- =========================
create table if not exists public.swipe_file_idea_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  swipe_item_id uuid not null references public.swipe_file_items(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade
);

create unique index if not exists swipe_file_idea_threads_account_item_uidx
  on public.swipe_file_idea_threads (account_id, swipe_item_id);

create index if not exists swipe_file_idea_threads_account_created_at_idx
  on public.swipe_file_idea_threads (account_id, created_at desc);

alter table public.swipe_file_idea_threads enable row level security;

drop policy if exists "swipe_file_idea_threads_select_superadmin" on public.swipe_file_idea_threads;
create policy "swipe_file_idea_threads_select_superadmin"
  on public.swipe_file_idea_threads
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_idea_threads_insert_superadmin" on public.swipe_file_idea_threads;
create policy "swipe_file_idea_threads_insert_superadmin"
  on public.swipe_file_idea_threads
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_idea_threads_update_superadmin" on public.swipe_file_idea_threads;
create policy "swipe_file_idea_threads_update_superadmin"
  on public.swipe_file_idea_threads
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_idea_threads_delete_superadmin" on public.swipe_file_idea_threads;
create policy "swipe_file_idea_threads_delete_superadmin"
  on public.swipe_file_idea_threads
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.swipe_file_idea_threads to authenticated;

-- =========================
-- 2) Messages (persisted chat history)
-- =========================
create table if not exists public.swipe_file_idea_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  thread_id uuid not null references public.swipe_file_idea_threads(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null
);

create index if not exists swipe_file_idea_messages_thread_created_at_idx
  on public.swipe_file_idea_messages (thread_id, created_at asc);

create index if not exists swipe_file_idea_messages_account_created_at_idx
  on public.swipe_file_idea_messages (account_id, created_at desc);

alter table public.swipe_file_idea_messages enable row level security;

drop policy if exists "swipe_file_idea_messages_select_superadmin" on public.swipe_file_idea_messages;
create policy "swipe_file_idea_messages_select_superadmin"
  on public.swipe_file_idea_messages
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_idea_messages_insert_superadmin" on public.swipe_file_idea_messages;
create policy "swipe_file_idea_messages_insert_superadmin"
  on public.swipe_file_idea_messages
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_idea_messages_update_superadmin" on public.swipe_file_idea_messages;
create policy "swipe_file_idea_messages_update_superadmin"
  on public.swipe_file_idea_messages
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_idea_messages_delete_superadmin" on public.swipe_file_idea_messages;
create policy "swipe_file_idea_messages_delete_superadmin"
  on public.swipe_file_idea_messages
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.swipe_file_idea_messages to authenticated;

-- =========================
-- 3) Saved Ideas (reusable)
-- =========================
create table if not exists public.swipe_file_ideas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  swipe_item_id uuid not null references public.swipe_file_items(id) on delete cascade,
  thread_id uuid null references public.swipe_file_idea_threads(id) on delete set null,
  source_message_id uuid null references public.swipe_file_idea_messages(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slide_outline jsonb not null,
  angle_text text not null
);

create index if not exists swipe_file_ideas_account_item_created_at_idx
  on public.swipe_file_ideas (account_id, swipe_item_id, created_at desc);

alter table public.swipe_file_ideas enable row level security;

drop policy if exists "swipe_file_ideas_select_superadmin" on public.swipe_file_ideas;
create policy "swipe_file_ideas_select_superadmin"
  on public.swipe_file_ideas
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_ideas_insert_superadmin" on public.swipe_file_ideas;
create policy "swipe_file_ideas_insert_superadmin"
  on public.swipe_file_ideas
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_ideas_update_superadmin" on public.swipe_file_ideas;
create policy "swipe_file_ideas_update_superadmin"
  on public.swipe_file_ideas
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_ideas_delete_superadmin" on public.swipe_file_ideas;
create policy "swipe_file_ideas_delete_superadmin"
  on public.swipe_file_ideas
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.swipe_file_ideas to authenticated;

