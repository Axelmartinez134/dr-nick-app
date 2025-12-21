### SOP: Add a New Patient Status (Client Category)

Use this concise checklist to add a new patient status (e.g., “Nutraceutical”) end‑to‑end: UI, backend, and Supabase. Keep default status “Current” when creating new clients.


### 1) Decide the behavior
- Maintenance‑like: New status mirrors Maintenance UI and workflow.
  - Patient UI: show Maintenance‑only sections; hide non‑Maintenance sections.
  - Queue: submissions bypass review (`needs_review = false`).
- Current‑like: New status behaves like Current.
  - Patient UI: do not include Maintenance‑only logic.
  - Queue: follow default review behavior.


### 2) Update server whitelist
- File: `src/app/api/admin/update-patient-status/route.ts`
- Action: Add the new status string to the `validStatuses` list so the API accepts it.


### 3) Update admin create form (Client Status dropdown)
- File: `src/app/components/health/CreateUserForm.tsx`
- Action: Add an `<option>` for the new status to the “Client Status” select.
- Note: Keep default as “Current” unless explicitly changing defaults.


### 4) Update per‑client status controls and grouping in Admin Tools
- File: `src/app/components/health/DrNickAdmin.tsx`
- Actions:
  - Add the new status to the inline “Status” select for each client.
  - Grouping: Filter clients with the new status and render a new section labeled “<NewStatus> Clients” above “Past Clients”.
  - Styling: Reuse the purple header/row hover styles used for Maintenance.


### 5) Update Client List tab grouping
- File: `src/app/components/health/DrNickPatientDashboard.tsx`
- Actions:
  - Filter patients by the new status and render a “<NewStatus> Clients” section above “Past Clients”.
  - Styling: Reuse the same purple styles used for Maintenance.


### 6) Update charts page status management
- File: `src/app/components/health/ChartsDashboard.tsx`
- Action: Add the new status to the “Current Status” select in the “Client Status Management” section.


### 7) Patient UI gating (only if Maintenance‑like)
- File: `src/app/components/health/HealthForm.tsx`
- Action: Wherever `isMaintenance` is computed, include the new status so it mirrors Maintenance UI (Maintenance‑only inputs visible; non‑Maintenance sections hidden).


### 8) Queue semantics (only if Maintenance‑like)
- File: `src/app/components/health/healthService.ts`
- Action: When saving weekly check‑ins, include the new status in the logic that sets `needs_review = false` (bypasses the review queue).
- Note: No special Review Queue visuals are required because submissions won’t appear there.


### 9) Supabase: extend `client_status` CHECK (if present)
- Table: `public.profiles`, column: `client_status` (TEXT)
- If a CHECK constraint exists (typical): extend it to include the new value.
- Example (replace NewStatus with your exact label/casing):

```sql
BEGIN;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_client_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_client_status_check
  CHECK (
    client_status = ANY (
      ARRAY[
        'Current'::text,
        'Onboarding'::text,
        'Past'::text,
        'Test'::text,
        'Maintenance'::text,
        'NewStatus'::text
      ]
    )
  );

COMMIT;
```

- Run this in both development and production Supabase projects.


### 10) Verify
- Admin Tools → Create New Client: New status appears and can be saved (default remains “Current”).
- Admin Tools → Client Passwords: New status selectable; a “<NewStatus> Clients” section appears above Past Clients.
- Client List: “<NewStatus> Clients” section appears above Past Clients, with purple styling.
- Charts → Client Status Management: New status selectable and updates persist.
- Patient experience:
  - Maintenance‑like: New status sees Maintenance UI; weekly check‑ins bypass queue.
  - Current‑like: Default UI; queue behavior unchanged.


### Appendix A: Diagnostics (read‑only, safe to run)
- Tip: If the SQL editor auto‑adds a “LIMIT 100” that breaks joins, set “No limit” and re‑run.

1) Show `public.profiles` columns and types
```sql
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  collation_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name  = 'profiles'
ORDER BY ordinal_position;
```

2) Show all constraints (find CHECK on `client_status`)
```sql
SELECT
  c.conname AS constraint_name,
  CASE c.contype
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    ELSE c.contype::text
  END AS constraint_type,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t      ON t.oid = c.conrelid
JOIN pg_namespace n  ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'profiles'
ORDER BY c.conname;
```

3) Distinct status values
```sql
SELECT DISTINCT client_status
FROM public.profiles
ORDER BY 1;
```

4) RLS policies on `public.profiles`
```sql
SELECT
  policyname AS policy_name,
  permissive,
  roles,
  cmd AS command,
  qual AS using_expression,
  with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'profiles';
```


### Notes
- Keep label/casing consistent (e.g., “Nutraceutical” exact casing).
- Default status for new clients remains “Current” unless changed intentionally.
- When unsure whether to treat a new status as Maintenance‑like or Current‑like, pick one explicitly and apply steps 7–8 accordingly.


