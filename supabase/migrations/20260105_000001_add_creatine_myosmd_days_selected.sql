-- Add per-day creatine / MyosMD selection details (stored as JSON array of full day strings)
-- Example: ["monday","tuesday","wednesday"]

alter table public.health_data
add column if not exists creatine_myosmd_days_selected jsonb;

comment on column public.health_data.creatine_myosmd_days_selected is
  'Selected days (Mon–Sun) creatine/MyosMD taken; JSON array of full lowercase strings like ["monday","tuesday"].';


