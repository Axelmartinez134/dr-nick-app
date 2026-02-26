-- Swipe File: per-account capture key (no-login links)
-- Stores a plaintext key on public.editor_accounts so capture links route to the correct account.

alter table if exists public.editor_accounts
  add column if not exists swipe_capture_key text null,
  add column if not exists swipe_capture_key_created_at timestamptz null,
  add column if not exists swipe_capture_key_enabled boolean not null default true;

-- Enforce minimum key length (V1 uses 16 chars)
alter table if exists public.editor_accounts
  drop constraint if exists editor_accounts_swipe_capture_key_len_chk;
alter table if exists public.editor_accounts
  add constraint editor_accounts_swipe_capture_key_len_chk
  check (swipe_capture_key is null or char_length(swipe_capture_key) >= 16);

-- Ensure uniqueness for non-null keys
create unique index if not exists editor_accounts_swipe_capture_key_uidx
  on public.editor_accounts (swipe_capture_key)
  where swipe_capture_key is not null;

