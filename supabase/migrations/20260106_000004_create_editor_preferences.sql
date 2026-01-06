-- Per-user editor preferences/settings (for /editor UI)
create table if not exists public.editor_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  carousel_remix_instructions text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.editor_preferences enable row level security;

-- Users can read their own preferences
drop policy if exists "Editor preferences: select self only" on public.editor_preferences;
create policy "Editor preferences: select self only"
  on public.editor_preferences
  for select
  using (auth.uid() = user_id);

-- Users can create their own preferences row
drop policy if exists "Editor preferences: insert self only" on public.editor_preferences;
create policy "Editor preferences: insert self only"
  on public.editor_preferences
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own preferences row
drop policy if exists "Editor preferences: update self only" on public.editor_preferences;
create policy "Editor preferences: update self only"
  on public.editor_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.update_editor_preferences_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_editor_preferences_updated_at on public.editor_preferences;
create trigger trigger_update_editor_preferences_updated_at
  before update on public.editor_preferences
  for each row
  execute function public.update_editor_preferences_updated_at();

grant all on public.editor_preferences to authenticated;


