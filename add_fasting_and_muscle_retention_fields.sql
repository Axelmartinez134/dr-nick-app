-- Add "Fasting and Muscle Retention" fields to health_data
-- Paste this into the Supabase SQL editor and run.

alter table if exists public.health_data
  add column if not exists creatine_myosmd_days integer,
  add column if not exists avg_daily_fasting_minutes integer,
  add column if not exists weekly_fasting_screenshot_image text;

-- Optional safety constraints (allow NULL for historical rows)
-- Postgres doesn't support "ADD CONSTRAINT IF NOT EXISTS", so we guard via a DO block.
do $$
begin
  if to_regclass('public.health_data') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'health_data_creatine_myosmd_days_range'
        and conrelid = 'public.health_data'::regclass
    ) then
      alter table public.health_data
        add constraint health_data_creatine_myosmd_days_range
          check (creatine_myosmd_days is null or (creatine_myosmd_days >= 0 and creatine_myosmd_days <= 7))
          not valid;
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'health_data_avg_daily_fasting_minutes_range'
        and conrelid = 'public.health_data'::regclass
    ) then
      alter table public.health_data
        add constraint health_data_avg_daily_fasting_minutes_range
          check (avg_daily_fasting_minutes is null or (avg_daily_fasting_minutes >= 0 and avg_daily_fasting_minutes <= 1439))
          not valid;
    end if;
  end if;
end
$$;


