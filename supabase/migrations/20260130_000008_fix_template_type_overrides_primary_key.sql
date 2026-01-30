-- Hotfix: Template type overrides primary key
-- The legacy schema uses PRIMARY KEY (user_id, template_type_id), which breaks multi-account admin usage:
-- Ax cannot update client account overrides because it would require a second row with the same (user_id, template_type_id).
--
-- New schema: PRIMARY KEY (account_id, template_type_id)
-- Keep user_id as "last_updated_by_user_id" (best-effort audit) but NOT part of uniqueness.

-- 1) Backfill any remaining NULL account_id (should be rare)
update public.carousel_template_type_overrides o
set account_id = a.id
from public.editor_accounts a
where o.account_id is null
  and a.created_by_user_id = o.user_id;

-- 2) Ensure account_id is NOT NULL going forward (required for PK)
alter table public.carousel_template_type_overrides
  alter column account_id set not null;

-- 3) Drop legacy primary key and replace with account-scoped PK
alter table public.carousel_template_type_overrides
  drop constraint if exists carousel_template_type_overrides_pkey;

alter table public.carousel_template_type_overrides
  add constraint carousel_template_type_overrides_pkey primary key (account_id, template_type_id);

