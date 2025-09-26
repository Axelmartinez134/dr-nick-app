-- Marketing drafts table for Admin Editor (Step 11)

create table if not exists public.marketing_drafts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  alias text not null,
  draft_json jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_marketing_drafts_patient_id on public.marketing_drafts(patient_id);

-- Trigger to keep updated_at current
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_marketing_drafts_updated_at on public.marketing_drafts;
create trigger trg_marketing_drafts_updated_at
before update on public.marketing_drafts
for each row execute function public.set_updated_at();


