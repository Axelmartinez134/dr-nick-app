-- Editor: Body Regenerate Chat (per-project+slide persistent conversation)
--
-- Adds persisted chat threads/messages for Body → Regenerate, scoped to account members.
-- Each thread is keyed by (account_id, project_id, slide_index).
--
-- Also stores per-assistant-message suggestions (3 candidate body rewrites).

-- =========================
-- 1) Threads
-- =========================
create table if not exists public.carousel_body_regen_chat_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  project_id uuid not null references public.carousel_projects(id) on delete cascade,
  slide_index int not null check (slide_index >= 0 and slide_index <= 5),
  created_by_user_id uuid not null references auth.users(id) on delete cascade
);

create unique index if not exists carousel_body_regen_chat_threads_account_project_slide_uidx
  on public.carousel_body_regen_chat_threads (account_id, project_id, slide_index);

create index if not exists carousel_body_regen_chat_threads_account_created_at_idx
  on public.carousel_body_regen_chat_threads (account_id, created_at desc);

alter table public.carousel_body_regen_chat_threads enable row level security;

drop policy if exists "body_regen_chat_threads_select_member" on public.carousel_body_regen_chat_threads;
create policy "body_regen_chat_threads_select_member"
  on public.carousel_body_regen_chat_threads
  for select
  using (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_threads.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "body_regen_chat_threads_insert_member" on public.carousel_body_regen_chat_threads;
create policy "body_regen_chat_threads_insert_member"
  on public.carousel_body_regen_chat_threads
  for insert
  with check (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_threads.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "body_regen_chat_threads_update_member" on public.carousel_body_regen_chat_threads;
create policy "body_regen_chat_threads_update_member"
  on public.carousel_body_regen_chat_threads
  for update
  using (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_threads.account_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_threads.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "body_regen_chat_threads_delete_member" on public.carousel_body_regen_chat_threads;
create policy "body_regen_chat_threads_delete_member"
  on public.carousel_body_regen_chat_threads
  for delete
  using (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_threads.account_id
        and m.user_id = auth.uid()
    )
  );

grant all on public.carousel_body_regen_chat_threads to authenticated;

-- =========================
-- 2) Messages
-- =========================
create table if not exists public.carousel_body_regen_chat_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  thread_id uuid not null references public.carousel_body_regen_chat_threads(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null
);

create index if not exists carousel_body_regen_chat_messages_thread_created_at_idx
  on public.carousel_body_regen_chat_messages (thread_id, created_at asc);

create index if not exists carousel_body_regen_chat_messages_account_created_at_idx
  on public.carousel_body_regen_chat_messages (account_id, created_at desc);

alter table public.carousel_body_regen_chat_messages enable row level security;

drop policy if exists "body_regen_chat_messages_select_member" on public.carousel_body_regen_chat_messages;
create policy "body_regen_chat_messages_select_member"
  on public.carousel_body_regen_chat_messages
  for select
  using (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_messages.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "body_regen_chat_messages_insert_member" on public.carousel_body_regen_chat_messages;
create policy "body_regen_chat_messages_insert_member"
  on public.carousel_body_regen_chat_messages
  for insert
  with check (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_messages.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "body_regen_chat_messages_update_member" on public.carousel_body_regen_chat_messages;
create policy "body_regen_chat_messages_update_member"
  on public.carousel_body_regen_chat_messages
  for update
  using (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_messages.account_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_messages.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "body_regen_chat_messages_delete_member" on public.carousel_body_regen_chat_messages;
create policy "body_regen_chat_messages_delete_member"
  on public.carousel_body_regen_chat_messages
  for delete
  using (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_messages.account_id
        and m.user_id = auth.uid()
    )
  );

grant all on public.carousel_body_regen_chat_messages to authenticated;

-- =========================
-- 3) Suggestions (3 candidates per assistant message)
-- =========================
create table if not exists public.carousel_body_regen_chat_suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  thread_id uuid not null references public.carousel_body_regen_chat_threads(id) on delete cascade,
  source_message_id uuid not null references public.carousel_body_regen_chat_messages(id) on delete cascade,
  idx int not null check (idx >= 0 and idx <= 2),
  body text not null
);

create index if not exists carousel_body_regen_chat_suggestions_account_source_idx
  on public.carousel_body_regen_chat_suggestions (account_id, source_message_id);

create index if not exists carousel_body_regen_chat_suggestions_thread_created_at_idx
  on public.carousel_body_regen_chat_suggestions (thread_id, created_at asc);

alter table public.carousel_body_regen_chat_suggestions enable row level security;

drop policy if exists "body_regen_chat_suggestions_select_member" on public.carousel_body_regen_chat_suggestions;
create policy "body_regen_chat_suggestions_select_member"
  on public.carousel_body_regen_chat_suggestions
  for select
  using (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_suggestions.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "body_regen_chat_suggestions_insert_member" on public.carousel_body_regen_chat_suggestions;
create policy "body_regen_chat_suggestions_insert_member"
  on public.carousel_body_regen_chat_suggestions
  for insert
  with check (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_suggestions.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "body_regen_chat_suggestions_update_member" on public.carousel_body_regen_chat_suggestions;
create policy "body_regen_chat_suggestions_update_member"
  on public.carousel_body_regen_chat_suggestions
  for update
  using (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_suggestions.account_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_suggestions.account_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "body_regen_chat_suggestions_delete_member" on public.carousel_body_regen_chat_suggestions;
create policy "body_regen_chat_suggestions_delete_member"
  on public.carousel_body_regen_chat_suggestions
  for delete
  using (
    exists (
      select 1 from public.editor_account_memberships m
      where m.account_id = carousel_body_regen_chat_suggestions.account_id
        and m.user_id = auth.uid()
    )
  );

grant all on public.carousel_body_regen_chat_suggestions to authenticated;

