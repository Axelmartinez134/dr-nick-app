## Patient Data Migration: Apple Numbers CSV → Supabase (health_data)

Purpose
- Streamline migration from Apple Numbers sheets to our web app via Supabase
- Define a consistent, safe, and repeatable process for creating Week 0 baseline and importing Week 1+ data
- Capture ALL assumptions, mappings, conversions, and verification steps

Scope
- Target table: `health_data`
- Patients must exist in `profiles` and have a Week 0 baseline prior to importing Week 1+
- Requires a valid `user_id` per patient

Key Concepts
- Week 0 Baseline: Created once for a patient at account setup; not touched by CSV import
- Weeks 1+: Imported from CSV via generated SQL INSERTs (or UPSERTs if desired)
- System Fields: Inserted rows are attributed to `data_entered_by='dr_nick'` and `needs_review=FALSE`

---

### 1) Pre-requisites

- Patient account exists in `profiles` (with email, full_name, and a known `user_id`)
- A Week 0 baseline row exists in `health_data` for this patient (week_number = 0)
- You have exported the Apple Numbers sheet to CSV with a single header row and normalized data rows
- You know the `user_id` for the target patient

Retrieve `user_id` examples
```sql
-- Option A: Lookup by email
SELECT id AS user_id, email, full_name, created_at
FROM profiles
WHERE email = 'patient@example.com';

-- Option B: Confirm any existing health_data rows for the user
SELECT week_number, date, weight, waist
FROM health_data
WHERE user_id = '00000000-0000-0000-0000-000000000000'
ORDER BY week_number;
```

Create Week 0 baseline (if not already created)
```sql
INSERT INTO health_data (
  user_id, week_number, date, weight, waist, data_entered_by, needs_review
) VALUES (
  'USER_ID_HERE', 0, 'YYYY-MM-DD', 187.6, 35.7, 'dr_nick', FALSE
);
```

Notes
- Optionally set `initial_weight` on Week 0 or separately for charts if needed
- Never re-import or overwrite Week 0 via CSV

---

### 2) CSV Requirements and Location

- File location in repo: `dr-nick-app/data/`
- File format: CSV with one header row (no extra preface rows)
- Dates: Prefer `YYYY-MM-DD`. If source is `M/D/YY`, normalize to ISO during SQL generation
- Decimal format: Period (.)
- Empty/missing values: leave blank in CSV; they’ll become NULL in SQL

Typical Headers (single patient CSV)
- `WEEK`
- `Date` (M/D/YY or YYYY-MM-DD)
- `Waist (inches)`
- `Days Nutrition Goal Met (1=100%)`
- `Minutes of HRT cardio out of 80 (1=100%)` (variant: `Minutes of focal (XXXbpm) cardio out of 420 (1=100%)`)
- `Days resistance training met (1=100%)` (ignored; kept NULL)
- `weight`
- `Red Recovery days` (decimal fraction or “X/7” in some sheets)
- `Notes` (may contain `Hunger: X/7` or `X/7 Days Hunger`)
- Optional: `Morning fat burn % (14th)`, `BF%`

Multi-patient CSV
- Add `user_id` as the first column to drive per-row target

---

### 3) CSV → Database Field Mapping

Required (per row)
- `WEEK` → `week_number` (INTEGER)
  - Skip Week 0 in CSV import (only import 1+). Week 0 should be created separately as baseline
- `Date` → `date` (DATE)
  - Convert to ISO `YYYY-MM-DD` if CSV provides `M/D/YY`

Core metrics
- `weight` → `weight` (NUMERIC)
- `Waist (inches)` → `waist` (NUMERIC)

Compliance and activity
- `Days Nutrition Goal Met (1=100%)` → `nutrition_compliance_days` (INTEGER)
  - Conversion: `ROUND(nutrition_fraction * 7)`; clamp to [0, 7]
  - Example: 0.57 → 4 days
- `Minutes of HRT cardio out of 80 (1=100%)` → `purposeful_exercise_days` (INTEGER)
  - Conversion: `minutes = ROUND(hrt_fraction * 80)`; `days = ROUND(minutes / 60)`; clamp to [0, 7]
  - If column uses a different denominator (e.g., 420): detect from header text and substitute denominator accordingly
  - If blank: NULL
- `Days resistance training met (1=100%)` → `resistance_training_days`
  - Current policy: keep NULL (ignored). If policy changes, define a weekly goal denominator (3 or 7) and set `ROUND(value * GOAL)`

Recovery and hunger
- `Red Recovery days` → `poor_recovery_days` (INTEGER)
  - If a decimal fraction (e.g., 0.43): `ROUND(fraction * 7)`
  - If a token like `X/7`: parse X
  - Clamp to [0, 7]
- `Notes` → parse for hunger days → `hunger_days` (INTEGER)
  - Parse patterns: `Hunger: X/7`, `X/7 Days Hunger`, `Days of hunger: X/7`
  - If matched, set `hunger_days = X` (0–7). Otherwise, leave `hunger_days = NULL`
  - `notes` (DB) remains NULL under current policy

Optional metrics (if present)
- `Morning fat burn % (14th)` → `morning_fat_burn_percent` (NUMERIC)
- `BF%` → `body_fat_percentage` (NUMERIC)

System fields per INSERT
- `data_entered_by = 'dr_nick'`
- `needs_review = FALSE`

Always set to NULL (current policy)
- `symptom_tracking_days`, `detailed_symptom_notes`, `energetic_constraints_reduction_ok`, `currently_not_in_use` (legacy resistance), `systolic_bp`, `diastolic_bp`, `notes`

---

### 4) Conversions and Assumptions (FULL DETAIL)

- Rounding: use standard rounding to nearest integer (e.g., Postgres `ROUND()` semantics)
- Clamping: enforce 0 ≤ days ≤ 7 after conversion
- Denominator detection for HRT/Focal cardio column:
  - If header contains `out of N`, use N (e.g., 80, 420). Else default to 420
  - Formula: `minutes = ROUND(fraction * N)`, `days = ROUND(minutes / 60)`, then clamp
- Date normalization:
  - Accepts `M/D/YY`, `M/D/YYYY`, or `YYYY-MM-DD`
  - Convert to `YYYY-MM-DD` in final SQL
- Missing/blank CSV values:
  - Becomes `NULL` in SQL (e.g., empty weight, empty waist)
- Dashes or placeholders (e.g., `-`): treat as NULL
- Units:
  - Weight: CSV assumed already in target units (lbs). If kg appear, convert prior to import or note conversion externally
  - Waist: CSV column specifies inches; if cm are used in any sheet, convert before import
- Duplicate protection:
  - Import only weeks that are not present for `(user_id, week_number)` to avoid duplicates (or use UPSERT with unique constraint if enforced). Currently, we manually check before inserts
- Week 0 policy:
  - Created at account setup; never overwritten by CSV import
  - Optional `initial_weight` can be set to Week 0’s weight for chart baselines

---

### 5) Example: From CSV Row to SQL INSERT

Sample CSV row
```csv
WEEK,Date,Waist (inches),Days Nutrition Goal Met (1=100%),Minutes of HRT cardio out of 80 (1=100%),weight,Red Recovery days,Notes
2,5/29/23,35.600,0.43,,182,,"Slept 7+ hours 6/7 nights"
```

Transform
- week_number = 2
- date = 2023-05-29
- waist = 35.600
- nutrition_compliance_days = ROUND(0.43 * 7) = 3
- purposeful_exercise_days = NULL (blank HRT value)
- poor_recovery_days = NULL (blank)
- hunger_days = NULL (no hunger pattern in notes)

Resulting SQL (for user_id `USER_ID_HERE`):
```sql
INSERT INTO health_data (
  user_id, week_number, date, weight, waist,
  nutrition_compliance_days, purposeful_exercise_days,
  poor_recovery_days, hunger_days,
  data_entered_by, needs_review
) VALUES (
  'USER_ID_HERE', 2, '2023-05-29', 182, 35.600,
  3, NULL,
  NULL, NULL,
  'dr_nick', FALSE
);
```

Hunger parsing example
```csv
WEEK,Date,Waist (inches),weight,Red Recovery days,Notes
16,9/4/23,33.180,169,0,"Hunger: 2/7"
```
- poor_recovery_days = ROUND(0 * 7) = 0
- hunger_days = 2 (parsed)

---

### 6) Batch Generation and Execution

Process
1. Export Apple Numbers → CSV with required headers
2. Place CSV in `dr-nick-app/data/YourFile.csv`
3. Identify the `user_id` for the patient (see queries above)
4. Generate SQL INSERTs (Weeks 1+) applying mappings and conversions
5. Review and run the SQL in the Supabase SQL Editor
6. Verify the rows using a scoped SELECT

Verification query (example)
```sql
SELECT week_number, date, weight, waist,
       nutrition_compliance_days, purposeful_exercise_days,
       poor_recovery_days, hunger_days, created_at
FROM health_data
WHERE user_id = 'USER_ID_HERE'
ORDER BY week_number;
```

Rollback (undo) pattern
```sql
-- Preview rows you plan to delete
SELECT week_number, date, weight, created_at
FROM health_data
WHERE user_id = 'USER_ID_HERE'
  AND week_number BETWEEN 1 AND 30
  AND data_entered_by = 'dr_nick'
ORDER BY week_number;

-- Delete the imported rows (scoped)
DELETE FROM health_data
WHERE user_id = 'USER_ID_HERE'
  AND week_number BETWEEN 1 AND 30
  AND data_entered_by = 'dr_nick';
```

Notes
- Adjust the week range to match your import
- The `data_entered_by='dr_nick'` guard prevents deleting patient-entered rows

---

### 7) Known Variants and How to Handle Them

- HRT/Focal cardio column denominators vary (e.g., 80, 420) and labels may include heart rate thresholds (e.g., `130bpm`). Always detect the `out of N` portion and use it in the conversion
- Hunger notes vary in phrasing: handle `Hunger: X/7`, `X/7 Days Hunger`, `Days of hunger: X/7`
- Recovery days may be fractional or `X/7`; apply the appropriate branch
- Missing weeks: It’s fine to skip weeks if there’s no data. Do not fabricate weeks
- Units: If sheets use cm/kg instead of inches/lbs, convert externally or extend the generator to convert prior to SQL emission

---

### 8) End-to-End Checklist

- You have the patient’s `user_id`
- Patient exists in `profiles` and has Week 0 baseline in `health_data`
- CSV headers and data values conform to expectations
- Mappings and conversions are correctly applied (see section 3 & 4)
- Generated SQL INSERTs only target Week 1+
- Include verification query at the end of the SQL
- Optionally prepare an undo script with a strict WHERE clause

---

### 9) Appendices

A) Columns we often leave NULL
- `symptom_tracking_days`, `detailed_symptom_notes`, `energetic_constraints_reduction_ok`, `currently_not_in_use`, `systolic_bp`, `diastolic_bp`, `notes`

B) System fields
- `data_entered_by='dr_nick'`, `needs_review=FALSE`

C) Safety Tips
- Always verify existing rows for `(user_id, week_number)` before INSERTs
- Prefer small batch inserts first, then scale up
- Keep a copy of CSV and the generated SQL in version control (e.g., `dr-nick-app/data/` and repo root)

D) Example File Naming
- SQL: `insert_<patient>_from_csv.sql`
- CSV: `data/<patient>.csv`

---

If you need an automated generator (CSV → SQL) with the above rules embedded, we can add a small node/ts script to the repo to parse CSV and emit SQL with verification and optional rollback sections.
