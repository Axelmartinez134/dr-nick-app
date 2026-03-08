-- Editor: Body Regenerate Chat — add per-thread Poppy conversation id
--
-- Needed so "Send with Poppy" can keep persistent context per project+slide
-- without bleeding across other slides/threads.

alter table if exists public.carousel_body_regen_chat_threads
  add column if not exists poppy_conversation_id text null;

create index if not exists carousel_body_regen_chat_threads_account_poppy_conversation_idx
  on public.carousel_body_regen_chat_threads (account_id, poppy_conversation_id);

