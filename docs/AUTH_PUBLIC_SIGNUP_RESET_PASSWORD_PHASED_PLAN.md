# Public Auth: Signup + Reset Password (Phased Plan)

Goal: add **public self-signup** and **password reset** to the existing login page (`/`), with **maximum stability** by shipping in small verified phases.

This plan is intentionally structured so each phase ends with **Manual QA** steps you can run immediately before we proceed.

---

## Product requirements (as confirmed)

### Login page (`/`)
- Add a toggle on the existing login card: **Sign In** vs **Create Account**.
- Add **“Forgot password?”** link.

### Public self-signup (Create Account)
- **Public signup allowed**.
- Collect at signup time:
  - Full name
  - Email
  - Password
- After email confirmation + first sign-in, collect baseline on `/onboarding` (fallback-only gate):
  - Measurement system: Imperial / Metric
  - Starting Weight
  - Starting Waist
  - Height
  - Track Blood Pressure? (required yes/no)
  - If Track BP = yes: show Systolic/Diastolic inputs **optional**, **not stored** during onboarding.
- New accounts default:
  - `profiles.client_status = "Nutraceutical"`
  - Store **plaintext password** in `profiles.patient_password` (explicit requirement).
- **Email confirmation required** (Supabase email confirm flow).
- Public signups **never go to** `/editor` (only admins/superadmins create editor access).
- Dr. Nick should see these signups **immediately**, and also see whether onboarding is complete.

### Onboarding completion gate
Onboarding is considered complete when:
- `health_data` has a Week 0 row (`week_number = 0`) **AND**
- `profiles.unit_system` and `profiles.height` are set

If not complete:
- user is **hard-gated** to an onboarding page (can’t proceed to normal dashboard until complete).

### Password reset
- Login page has “Forgot password?” link that triggers Supabase reset email.
- Email link lands on `/reset-password` where user sets a new password.

---

## Existing code touchpoints (current)

- **Login route**: `src/app/page.tsx` (renders `Login` when unauthenticated; sends editor users to `/editor`)
- **Login form**: `src/app/components/auth/Login.tsx`
- **Supabase auth client**: `src/app/components/auth/AuthContext.tsx` (exports `supabase`)
- **Patient/Doctor dashboard routing**: `src/app/components/Dashboard.tsx`
- **Dr Nick admin UI**: `src/app/components/health/DrNickAdmin.tsx`
- **Admin patient loader**: `src/app/components/health/adminService.ts` (currently reads from `profiles` only)
  - Phase 5 updates this to call `GET /api/admin/patients` for onboarding status.

---

## Key implementation principles (stability rules)

- Prefer **small, focused edits** with clear ownership (UI component, API route, service util).
- Add **server-side routes** for anything requiring privileged DB writes (e.g. `patient_password`).
- Avoid “temporary client storage” (localStorage) for onboarding data; use DB as source of truth.
- Each phase ends with **Manual QA**. No next phase until QA passes.

---

## Phased rollout plan

### Phase 0 — Schema + contract audit (no behavior changes)
**Goal**: confirm we can implement without adding new DB columns, and lock the exact fields we will read/write.

**Work**
- Audit existing DB columns used in code:
  - `profiles`: `full_name`, `email`, `client_status`, `patient_password`, `unit_system`, `height`, `track_blood_pressure`
  - `health_data`: ability to insert Week 0 row with `week_number=0`, `weight`, `waist`, `data_entered_by`, `needs_review`
- Identify which existing `profiles` fields already mirror baseline metrics (if any). If none exist, baseline stays in `health_data` only (still meets the hard-gate definition).
- Define the response shapes for:
  - `POST /api/auth/public-signup`
  - `POST /api/auth/request-password-reset`
  - onboarding “complete” check + onboarding “submit” (fallback-only gate)
- Confirm canonical storage conversions match existing behavior:
  - Convert metric → imperial before storing (matches `POST /api/admin/create-patient`)

#### Phase 0 deliverable: API contracts (locked before Phase 1)

These are the **exact JSON shapes** we will implement later, so Phase 1/2/3 UI work doesn’t drift.

##### `POST /api/auth/public-signup`

- **Request**
  - `fullName: string` (required)
  - `email: string` (required; normalized to lowercase)
  - `password: string` (required)
  - Note: baseline fields are intentionally **not** collected at signup.

- **Writes (server, service role)**
  - `profiles`:
    - `email`, `full_name`, `patient_password` (plaintext), `client_status='Nutraceutical'`
  - `health_data`:
    - No Week 0 row is created at signup time (Week 0 is created during onboarding submit).

- **Response (do not return password)**
  - `200`: `{ success: true, message: 'Check your email to confirm your account.' }`
  - `400`: `{ success: false, error: string }` (validation)
  - `409`: `{ success: false, error: 'Email already exists' }` (email taken)
  - `500`: `{ success: false, error: string }`

##### `POST /api/auth/request-password-reset`

- **Request**: `{ email: string }`
- **Behavior**:
  - Always respond `200` with success (avoid leaking whether an email exists).
  - Internally call `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<app>/reset-password' })`.
- **Response**:
  - `{ success: true, message: 'If an account exists, a reset email has been sent.' }`

##### `GET /api/auth/onboarding/status` (fallback gate helper)

- **Response**:
  - `{ success: true, complete: boolean, missing: { week0: boolean, unitSystem: boolean, height: boolean } }`
- **Definition (locked)**:
  - `complete = week0Exists && profiles.unit_system && profiles.height`

##### `POST /api/auth/onboarding/submit` (fallback-only)

- **Request**
  - `unitSystem: 'imperial' | 'metric'` (required)
  - `startingWeight: string` (required; numeric; unit-aware)
  - `startingWaist: string` (required; numeric; unit-aware)
  - `height: string` (required; numeric; unit-aware)
  - `trackBloodPressure: boolean` (required)
  - `systolicBp?: string` (optional UI-only; **ignored/not stored**)
  - `diastolicBp?: string` (optional UI-only; **ignored/not stored**)

- **Canonical storage rules (matches existing admin create flow)**
  - If `unitSystem === 'metric'`:
    - weight kg → lbs: \(lbs = kg / 0.45359237\)
    - waist cm → inches: \(in = cm / 2.54\)
    - height cm → inches: \(in = cm / 2.54\)
  - Round stored values to **2 decimals** (same pattern as current code).

- **Writes**
  - Updates `profiles.unit_system`, `profiles.height`, `profiles.track_blood_pressure`
  - Upserts `health_data` Week 0 row:
    - `week_number=0`
    - `weight` (lbs), `waist` (inches), `initial_weight` (lbs)
    - `data_entered_by='patient'`
    - `needs_review=false`
- **Response**:
  - `{ success: true, complete: true }`

**Manual QA**
- [ ] Confirm in Supabase table editor that the expected columns exist (especially `profiles.patient_password`, `profiles.unit_system`, `profiles.height`, `profiles.track_blood_pressure`).
- [ ] Confirm `health_data` allows inserting `week_number=0`.
- [ ] Confirm your canonical units expectation is **imperial storage** (lbs / inches) even when users input metric (this matches current `create-patient` code path).

---

### Phase 1 — Login card UX: toggle + forgot password (no signup yet)
**Goal**: ship the UI shell without changing backend behavior.

**Work**
- Update `src/app/components/auth/Login.tsx`:
  - Add a segmented toggle: **Sign In** / **Create Account**
  - Keep Sign In form fully working as-is
  - Add a “Forgot password?” link that opens a minimal email input + sends the reset email (Phase 2 wires the API)
  - Keep styling consistent with existing card

**Manual QA**
- [ ] Open `/` logged-out: Sign In renders and login still works.
- [ ] Toggle to Create Account: shows the new form fields (submit disabled or “coming next phase”).
- [ ] Click “Forgot password?”: UI opens/closes cleanly without breaking Sign In.

---

### Phase 2 — Password reset end-to-end (`/reset-password`)
**Goal**: fully working reset flow, isolated from signup complexity.

**Work**
- Add `/reset-password` route:
  - `src/app/reset-password/page.tsx` (client page)
  - Parses Supabase recovery parameters (handle both hash-token and code-based flows)
  - Provides “New password” + “Confirm password” inputs
  - Calls Supabase to set the new password (client-side with recovery session)
  - Shows clear success + error states
- After password change succeeds, update `profiles.patient_password` to the new plaintext password (explicit requirement).
- Add API helper route (optional but preferred for consistency):
  - `POST /api/auth/request-password-reset` (server) that calls Supabase reset email with `redirectTo` set to `/reset-password`
  - `Login.tsx` calls this endpoint (keeps behavior stable across environments)

**Manual QA**
- [ ] From `/`, request reset email for a test user.
- [ ] Open email link on desktop and set a new password successfully.
- [ ] Sign in with the new password.
- [ ] Repeat on mobile (iOS Safari / Android Chrome) to verify token parsing works.
- [ ] Verify `profiles.patient_password` updates to the new password after reset.

---

### Phase 3 — Server-side public signup (creates Auth user + `profiles` row)
**Goal**: create accounts safely with email confirmation, and make Dr Nick see the signup immediately.

**Work**
- Add `POST /api/auth/public-signup` (server):
  - Creates Supabase Auth user (email confirmation required)
  - Immediately upserts/creates a `profiles` row with (no new columns):
    - `full_name`
    - `email`
    - `client_status = "Nutraceutical"`
    - `patient_password = <plaintext password>` (explicit requirement)
  - Does **not** create Week 0 at signup time (Week 0 is created on `/onboarding` submit after first login).
  - Does **not** create editor memberships (ensures never routed to `/editor`)
- Wire Create Account submit button in `Login.tsx`:
  - Collect all required inputs
  - Validate required fields + numeric inputs
  - On success: show “Check your email to confirm your account”

**Manual QA**
- [ ] Create account with valid inputs → verify UI shows “check email”.
- [ ] In Supabase Auth: user exists and is unconfirmed until click.
- [ ] In `profiles`: row exists immediately with `client_status="Nutraceutical"` and plaintext `patient_password`.
- [ ] Dr Nick dashboard shows the new user in Nutraceutical list after refresh.
- [ ] Confirm this new user does **not** redirect to `/editor` after confirming + signing in.

---

### Phase 4 — Fallback-only onboarding hard gate (`/onboarding`)
**Goal**: only gate users when required onboarding prerequisites are missing (Week 0 row OR `unit_system` OR `height`).

**Work**
- Add `/onboarding` route:
  - Loads current `profiles` values (unit system, height, track BP)
  - Shows required onboarding fields:
    - unit system (required)
    - height (required)
    - starting weight (required)
    - starting waist (required)
    - track blood pressure (required yes/no)
    - if yes: systolic/diastolic inputs optional, **not stored**
  - Submit calls a patient-owned API endpoint that:
    - Updates `profiles.unit_system`, `profiles.height`, `profiles.track_blood_pressure`
    - Creates/upserts `health_data` Week 0 row with:
      - `week_number = 0`
      - `weight`, `waist`
      - `data_entered_by = "patient"`
      - `needs_review = false`
    - (If your current “duplicate baseline into profiles” pattern already exists, replicate it using existing columns only.)
- Add gate in `Dashboard.tsx` (or a small wrapper component):
  - On patient login, check “onboarding complete” condition
  - If incomplete, force route to `/onboarding`
  - Prevent “normal dashboard” render until complete

**Manual QA**
- [ ] Confirm a public-signup user (Phase 3) **is** sent to `/onboarding` after first sign-in (because Week 0/unit/height are expected to be missing until onboarding).
- [ ] Create/identify a user missing Week 0/unit/height → sign in redirects to `/onboarding` (hard-gated).
- [ ] Try navigating directly to `/` or other dashboard pages → still forced back to `/onboarding`.
- [ ] Submit onboarding → Week 0 row exists in `health_data`, `profiles.unit_system` and `profiles.height` set.
- [ ] After submit → user reaches normal dashboard (PatientDashboard).

---

### Phase 5 — Dr Nick: “Onboarding incomplete” indicator (no new DB columns)
**Goal**: make it obvious in Dr Nick’s admin UI which Nutraceutical clients haven’t completed onboarding.

**Work**
- Add a server route for admin to fetch patients with onboarding status in one call (preferred for performance):
  - Example: `GET /api/admin/patients` returns patients + computed `onboarding_complete`
  - Logic: Week 0 row exists AND `profiles.unit_system` + `profiles.height` are non-null
- Update `adminService.getAllPatients()` to call the new endpoint
- Update `DrNickAdmin.tsx` (and/or `DrNickPatientDashboard.tsx` if that’s where you want it most visible):
  - Add a badge per patient: **“Onboarding incomplete”** when false
  - Optional: add a quick filter pill (All / Incomplete)

**Manual QA**
- [ ] Create a user but do not finish onboarding → badge shows “Onboarding incomplete”.
- [ ] Finish onboarding → badge disappears on refresh.
- [ ] Confirm Nutraceutical list still functions and status dropdown still updates.

---

### Phase 6 — Polish + guardrails + docs
**Goal**: reduce edge-case failures and document ownership for future maintenance.

**Work**
- Tighten validation and error messages:
  - duplicate email
  - weak password
  - missing confirmation
  - onboarding submit idempotency (safe retry)
- Ensure no accidental editor routing:
  - keep `/` redirect-to-editor only based on editor memberships (already true)
- Add/update documentation:
  - Add a new section in `README.md` or a dedicated auth doc (optional)
  - Update any internal docs that describe login behavior

**Manual QA**
- [ ] Duplicate email signup shows a clear error.
- [ ] Reset password for unconfirmed email behaves predictably (clear message).
- [ ] Onboarding submit can be retried without creating duplicate Week 0 rows.

---

## Notes on “no new columns”
This plan avoids adding new DB columns. Where we need additional status (like onboarding completeness), we compute it from existing rows:
- Week 0 exists in `health_data`
- and required fields exist in `profiles`

If we discover during Phase 0 that baseline duplication into `profiles` currently relies on specific columns, we’ll mirror the existing pattern exactly (no divergence), otherwise we’ll keep baseline authoritative in `health_data`.

---

## Supabase setup: ensuring email verification + password reset emails work

This app relies on **Supabase Auth** sending two kinds of emails:
- **Confirm signup** (email verification)
- **Reset password** (recovery)

### Required Supabase dashboard settings

1) **Auth → Providers → Email**
- Ensure **Email provider is enabled**
- Ensure **“Confirm email” / “Email confirmations” is enabled**
  - If confirmations are disabled, signups will be immediately active (not what we want).

2) **Auth → URL Configuration**
- Set **Site URL** to your canonical production URL (e.g. your Vercel domain).
- Add **Redirect URLs** for all environments you’ll use:
  - Local dev: `http://localhost:3000/*`
  - Prod reset page: `https://<your-domain>/reset-password`
  - (Optional) Post-confirm landing: `https://<your-domain>/` (or `/` + `/onboarding` gate will handle)

3) **Auth → Email Templates**
- Review templates for:
  - Confirm signup
  - Reset password
- Make sure the template links point to your app domain (Supabase uses the URL configuration above).

4) **Auth → SMTP settings (recommended for production)**
- Supabase’s default email can be rate-limited or deliver poorly at scale.
- For production stability, configure a dedicated SMTP provider (SendGrid/Mailgun/Postmark/etc.).

### What we must do in code (so Supabase sends the emails)

- **Signup**: use `supabase.auth.signUp({ email, password, options })`
  - Supabase will send the confirmation email when confirmations are enabled.
  - We will set `options.emailRedirectTo` to a route in your app (usually `/`), so after confirm they land back in the app and then log in normally.
- **Reset**: use `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<app>/reset-password' })`
  - Supabase sends the reset email and the link will land on `/reset-password`.

### Manual QA (email delivery)
- [ ] Try a signup with a real email → confirmation email arrives within 1–2 minutes.
- [ ] Click confirm link → you land on your app domain (not a Supabase domain).
- [ ] Request password reset → email arrives; link lands on `/reset-password`.
- [ ] Complete reset → you can sign in with the new password and `profiles.patient_password` reflects it.

