-- Keep "Saved Projects" sorted by true recent edits.
-- Any edit to a slide should bump the parent project's updated_at.

create or replace function public.touch_carousel_project_updated_at_from_slide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if (tg_op = 'DELETE') then
    pid := old.project_id;
  else
    pid := new.project_id;
  end if;

  if pid is not null then
    update public.carousel_projects
      set updated_at = now()
      where id = pid;
  end if;

  return null;
end;
$$;

-- Trigger function is only meaningful in trigger context; still grant execute for DML callers.
grant execute on function public.touch_carousel_project_updated_at_from_slide() to authenticated;

drop trigger if exists trigger_touch_carousel_project_updated_at_from_slide on public.carousel_project_slides;
create trigger trigger_touch_carousel_project_updated_at_from_slide
  after insert or update or delete on public.carousel_project_slides
  for each row
  execute function public.touch_carousel_project_updated_at_from_slide();

