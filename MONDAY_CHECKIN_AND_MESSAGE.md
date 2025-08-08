## Monday Check-in and Message System

### Purpose
- Ensure patients submit weekly check-ins in a consistent Monday–Wednesday window using the “Anywhere on Earth” (AoE, UTC+14) rule.
- Keep weekly timelines continuous even when a week is missed, without confusing week numbering.
- Provide Dr. Nick with clear visibility for missed weeks and an automated weekly message framework.

---

## Check-in Window and Week Logic

### Submission Window (AoE)
- Allowed days: Monday, Tuesday, Wednesday (based on when Monday begins anywhere on Earth).
- Enforcement lives in the patient check-in form and is applied both to the UI message and form submission guard.

### Program Start
- Program start is the AoE Monday of the calendar week containing the patient’s first Week 1 submission.

### Current Week Calculation
- Current week = number of AoE Mondays elapsed since the Week 1 AoE Monday, plus 1.
- This is calendar-based, not “last submission + 1”. Missed weeks do not block the next week from appearing.

---

## Missed Weeks Handling (Login Gap-Fill)

### When It Runs
- Automatically runs in the background on every login for “Current” clients who have at least one Week 1 submission.

### What It Does
- Detects any fully closed past weeks (strictly before the current AoE week) that have no row.
- Auto-creates rows with null metrics for each missing week so the timeline remains continuous.

### Row Flags (no schema changes)
- `data_entered_by = 'system'`
- `needs_review = true`
- `notes = "AUTO-CREATED: Missed check-in for week X"`
- `date = {AoE Monday ISO for that week}`

### Duplicate Prevention (race-safe)
- Single-run guard per login session.
- Per-week pre-insert existence check right before insert.

---

## Patient Experience (UI)

### Check-in Form
- Shows the correct current week based on the AoE calendar.
- Enforces the Monday–Wednesday AoE window for submissions.

### Data Table Note (footnote style)
- Placement: directly under the “This table shows the raw data used…” sentence in the “📋 Your Check-in Data” section.
- Copy used when there are missed weeks:
  - "Note: Your dashboard includes {missedCount} week(s) marked 'no data' to reflect missed check-ins. This keeps your charts aligned week-to-week."
- Neutral styling; no icons or warning colors.

---

## Dr. Nick Experience (UI)

### Review Queue (list)
- System-created missed weeks show a high-contrast badge next to the “Week X • date” line:
  - "MISSED CHECK-IN (SYSTEM) — Week X"
  - Indigo styling; adds a subtle indigo left border on the card.

### Review Screen (detail)
- Slim indigo banner at the top for system-created rows:
  - "MISSED CHECK-IN (SYSTEM) — Week X. This week was auto-created to keep the timeline continuous. Review like a normal check-in and click 'Complete Review & Remove from Queue' when done."
- Review workflow remains unchanged.

---

## Calculations and Charts

- Charts and metrics safely ignore nulls; no change needed to logic that already filters by valid values.
- KPIs hasEnoughData tightened: requires Week 0 and at least one week with a weight value (prevents null-only weeks from counting as “enough data”).
- `total_checkins` in Dr. Nick’s patient dashboard counts only patient-submitted rows (`data_entered_by = 'patient'`).

---

## File Map (key logic and UI)

- Week & window logic
  - `src/app/components/health/HealthForm.tsx`
    - AoE window: Monday–Wednesday guard and UI copy.
    - Current week calculation (AoE weeks since Week 1 Monday).

- Missed-week gap-fill (background on login)
  - `src/app/components/auth/AuthContext.tsx`
    - Single-run guard per session.
    - Per-week pre-insert existence check.
    - Creates rows with flags described above.

- Dr. Nick indicators
  - `src/app/components/health/DrNickQueue.tsx`
    - Indigo badge in queue list: "MISSED CHECK-IN (SYSTEM) — Week X".
  - `src/app/components/health/DrNickSubmissionReview.tsx`
    - Slim indigo banner at top when reviewing system-created rows.

- Patient data table footnote
  - `src/app/components/health/ChartsDashboard.tsx` (DataTable)
    - Neutral footnote note under the table intro copy.

- Metrics
  - `src/app/components/health/metricsService.ts`
    - `hasEnoughData` requires: Week 0 + at least one week with weight.
  - `src/app/components/health/complianceMetricsService.ts`
    - Metrics already filter out nulls; no change needed.

---

## Troubleshooting & Ops

### Typical Scenarios
- Missed 1–2 weeks: created on next login; patient sees current week; Dr. Nick reviews auto-created rows.
- Multi-week gaps: multiple rows auto-created (one per week) in sequence.

### Removing Accidental Duplicates (if ever needed)
- Keep the earliest `created_at` row per `{user_id, week_number}` where `data_entered_by='system'`; delete later duplicates.
- Run as a one-off maintenance step if a race condition occurred before the guard was added.

---

## Developer Notes

- AoE utility logic is duplicated in `AuthContext.tsx` and `HealthForm.tsx` to keep both paths consistent.
- No database schema changes were required.
- All changes are backward-compatible with existing data.

---

## Changelog (high-level)

- 2025-08-07
  - Switched to AoE calendar-based current week calculation (Week 1 AoE Monday baseline).
  - Added login-time gap-fill for missed weeks with null rows and review flags.
  - Tightened KPIs `hasEnoughData` threshold; made `total_checkins` patient-only.
  - Added patient footnote and Dr. Nick cues for system-created weeks.

