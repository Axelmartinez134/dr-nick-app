-- Phase 3A (Logos): storage bucket for globally cached logo PNGs (shared across editor users)
-- NOTE: This uses the Supabase Storage schema. If your project has storage disabled, this will fail.

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'editor-shared-assets') then
    insert into storage.buckets (id, name, public)
    values ('editor-shared-assets', 'editor-shared-assets', true);
  end if;
end $$;

