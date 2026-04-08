alter table if exists public.editor_account_settings
  add column if not exists google_drive_folder_id text null;
