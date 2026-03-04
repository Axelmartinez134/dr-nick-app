-- /editor: Review / Approval (Phase 2)
-- Adds a per-project Google Drive folder link for the public review page.
-- Editable via superadmin-only "Share carousels" modal.

alter table public.carousel_projects
  add column if not exists review_drive_folder_url text;

