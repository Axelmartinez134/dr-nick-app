-- Editor: Brand Alignment (Phase 0)
-- Store a per-account "brand alignment" prompt in editor_account_settings.

alter table public.editor_account_settings
  add column if not exists brand_alignment_prompt_override text null;

