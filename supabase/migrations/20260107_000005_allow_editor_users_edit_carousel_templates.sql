-- Allow editor users (public.editor_users) to create/update/delete carousel templates
-- by expanding is_admin_user() to include editor users.

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
    )
    or
    exists (
      select 1
      from public.editor_users eu
      where eu.user_id = auth.uid()
    );
$$;


