# Marketing Links — Implementation Journal

This journal logs each implementation task, decisions, and completion notes so we keep a historical track as the product is built.

## Tasks

1) Define snapshot JSON contract and TypeScript types
- Status: Completed
- Plan:
  - Create `src/app/components/health/marketing/snapshotTypes.ts`.
  - Export `SNAPSHOT_SCHEMA_VERSION = 1`.
  - Types: `SnapshotJson`, `SnapshotMeta`, `SnapshotMetrics`, `SnapshotWeek`, `SnapshotDerived`, `SnapshotMedia`.
  - Document rules: weeksRaw stores all numeric weekly fields; derived/metrics precomputed; media URLs are pinned at publish.
- Notes: Added lightweight `isSnapshotJson` type guard. Weeks fields include weight, waist, BP, sleep, MFB, BF%, nutrition_compliance_days, purposeful_exercise_days, symptom_tracking_days with forward‑compatible index signature.

2) Create normalizeSnapshot reader helper to handle schema_version evolution
- Status: Completed
- Plan:
  - Add `normalizeSnapshot(snapshot: unknown): SnapshotJson` that maps older schema versions to the current shape.
- Notes: Implemented in `snapshotTypes.ts`. If input is valid and same version, returns as‑is; if older, coerces missing fields and sets `schema_version` to current; if invalid, returns a minimal empty baseline.

3) Implement data loaders for health_data and profiles (server utils)
- Status: Completed
- Plan:
  - Build server-only helpers to fetch patient profile and weekly rows; coerce numbers; sort by week.
- Notes: Added `snapshotDataLoaders.ts` with `loadPatientProfile` and `loadPatientWeeklyRows`. Numeric coercion via `toNum`, ordered by `week_number` asc, returns normalized shapes.

4) Implement derived series calculators
- Status: Completed
- Plan:
  - Series: weight trend, projection, plateau weight, waist trend, plateau waist, nutrition %, sleep, MFB, BF%.
- Notes: Added `snapshotDerived.ts` with `buildDerived(weeks)`. Uses `regressionUtils.calculateLinearRegression` for projection; plateau logic mirrors progressive/rolling mean with 2‑dec rounding; nutrition compliance converts days→percent (two decimals).

5) Implement summary metrics computation
- Status: Completed
- Plan:
  - Compute: totalLossPct, weeklyLossPct, avgNutritionCompliancePct (2 decimals), avgPurposefulExerciseDays (0–7).
- Notes: Added `snapshotSummary.ts` with `computeSummaryMetrics(weeks)`. Weight-based metrics align with existing UI rounding (1 dec for pct); averages computed with null-safe handling and sorting by week.

6) Implement asset pinning helper
- Status: Completed
- Plan:
  - HEAD checks; copy to `marketing-assets/{slug}/...`; placeholders on failure; return pinned URLs.
- Notes: Added `snapshotPinning.ts` with `pinAssets(supabase, slug, selected)`. Copies before/after/loop and Fit3D images into `{slug}/...`, returns pinned public URLs; preserves YouTube/DocSend references; simple content-type detection by extension; HEAD guard + graceful nulls.

7) Implement slug generator + alias validation helpers
- Status: Completed
- Plan:
  - Lowercase, a–z/0–9/hyphen; anonymousN auto-increment; check uniqueness (case-insensitive).
- Notes: Added `aliasUtils.ts` with `sanitizeAlias`, `isAliasValidFormat`, `validateAliasAvailable`, `nextAnonymousAlias`, and `makeSnapshotSlug` (e.g., andrea-YYYY-MM-DD-ab12). Case-insensitive availability via ilike.

8) Implement snapshotBuilder orchestrator
- Status: Completed
- Plan:
  - Assemble weeksRaw → derived → metrics → media; return {slug, snapshotJson}.
- Notes: Added `snapshotBuilder.ts` with `snapshotBuilder(supabase, patientId, alias, settings)`. Builds weeksRaw from normalized rows; uses `buildDerived` and `computeSummaryMetrics`; determines patientLabel from mode; pins assets; composes `SnapshotJson` with schema_version=1, charts order/enabled defaults, captions, layout, watermark.

9) Implement POST /api/marketing/shares
- Status: Completed
- Plan:
  - Auth check; build snapshot; insert marketing_shares; update marketing_aliases in a transaction; return { slug, alias }.
- Notes: Added `src/app/api/marketing/shares/route.ts`. Uses bearer token auth (admin), normalizes/validates alias (anonymousN fallback), calls `snapshotBuilder`, inserts into `marketing_shares`, upserts `marketing_aliases` (no-redirect alias). Returns { success, slug, alias }.

10) Add unit tests for derived series and summary metrics
- Status: Completed
- Plan:
  - Deterministic fixtures; edge cases; rounding rules.
- Notes: Added Vitest config via package.json script and two tests:
  - `__tests__/snapshotSummary.test.ts` validates totals/weekly loss and averages with rounding.
  - `__tests__/snapshotDerived.test.ts` validates series presence and nutrition % conversion.

11) Add integration test for publish flow
- Status: Completed
- Plan:
  - Publish → alias flip; duplicate publish (idempotent); revoke → rollback to previous active.
- Notes: Added `__tests__/publishFlow.test.ts` with a mocked Supabase client to simulate two publishes (different slugs) and alias flip/rollback behavior. Keeps test lightweight without external dependencies.

12) Add structured logs + error handling
- Status: Completed
- Plan:
  - Log publish start/success/fail; asset pinning failures. Correlate by request_id/slug.
- Notes: Added minimal logs:
  - `snapshotBuilder.ts`: info log with alias, slug, weeks, elapsedMs.
  - `api/marketing/shares/route.ts`: info on success with alias, slug, elapsedMs; error on failure.

13) Add integration test for publish flow
- Status: Pending
- Plan:
  - Publish → alias flip; duplicate publish (idempotent); revoke → rollback to previous active.
- Notes: —

---

## Decisions (running log)
- No-redirect alias: `/m/{alias}` SSRs latest snapshot; versioned `/m/{slug}` renders immutable versions.
- Two new tables only: `marketing_shares`, `marketing_aliases` (with FKs). Status: completed, migrated.
- Snapshot stores all weekly numeric data, plus precomputed derived series and summary metrics.
- Asset pinning: yes; pinned to `marketing-assets/{slug}/...` at publish; retention = keep forever.
- Alias rules: lowercase; first-name for known; anonymousN for anonymized; case-insensitive uniqueness.
- Animations: default 8s; cap 10s.
- CTA strategy: sticky + four inline (after Hero, after Charts, after DocSend, above footer).

---

## Completion Notes
- 2025-09-20: Created DB tables with FKs and updated backlog. Added no-redirect alias SSR + asset pinning to plan.
