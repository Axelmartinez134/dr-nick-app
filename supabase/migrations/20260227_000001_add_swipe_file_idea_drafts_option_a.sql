-- Swipe File: Ideas Chat (Option A)
-- Auto-save all model-suggested idea cards as "draft ideas" per assistant message.
-- Superadmin-only (mirrors Swipe File access model).

create table if not exists public.swipe_file_idea_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid not null references public.editor_accounts(id) on delete cascade,
  swipe_item_id uuid not null references public.swipe_file_items(id) on delete cascade,
  thread_id uuid not null references public.swipe_file_idea_threads(id) on delete cascade,
  source_message_id uuid not null references public.swipe_file_idea_messages(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slide_outline jsonb not null,
  angle_text text not null
);

create index if not exists swipe_file_idea_drafts_account_item_created_at_idx
  on public.swipe_file_idea_drafts (account_id, swipe_item_id, created_at desc);

create index if not exists swipe_file_idea_drafts_account_source_message_idx
  on public.swipe_file_idea_drafts (account_id, source_message_id);

alter table public.swipe_file_idea_drafts enable row level security;

drop policy if exists "swipe_file_idea_drafts_select_superadmin" on public.swipe_file_idea_drafts;
create policy "swipe_file_idea_drafts_select_superadmin"
  on public.swipe_file_idea_drafts
  for select
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_idea_drafts_insert_superadmin" on public.swipe_file_idea_drafts;
create policy "swipe_file_idea_drafts_insert_superadmin"
  on public.swipe_file_idea_drafts
  for insert
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_idea_drafts_update_superadmin" on public.swipe_file_idea_drafts;
create policy "swipe_file_idea_drafts_update_superadmin"
  on public.swipe_file_idea_drafts
  for update
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

drop policy if exists "swipe_file_idea_drafts_delete_superadmin" on public.swipe_file_idea_drafts;
create policy "swipe_file_idea_drafts_delete_superadmin"
  on public.swipe_file_idea_drafts
  for delete
  using (
    exists (select 1 from public.editor_superadmins s where s.user_id = auth.uid())
  );

grant all on public.swipe_file_idea_drafts to authenticated;

