alter table if exists public.editor_account_settings
  add column if not exists swipe_opening_slides_master_prompt_override text null;

alter table if exists public.swipe_file_idea_threads
  add column if not exists chat_mode text;

update public.swipe_file_idea_threads
set chat_mode = 'ideas'
where coalesce(trim(chat_mode), '') = '';

alter table if exists public.swipe_file_idea_threads
  alter column chat_mode set default 'ideas';

alter table if exists public.swipe_file_idea_threads
  alter column chat_mode set not null;

alter table if exists public.swipe_file_idea_threads
  drop constraint if exists swipe_file_idea_threads_chat_mode_check;

alter table if exists public.swipe_file_idea_threads
  add constraint swipe_file_idea_threads_chat_mode_check
  check (chat_mode in ('ideas', 'opening_slides'));

drop index if exists public.swipe_file_idea_threads_account_item_uidx;

create unique index if not exists swipe_file_idea_threads_account_item_mode_uidx
  on public.swipe_file_idea_threads (account_id, swipe_item_id, chat_mode);
