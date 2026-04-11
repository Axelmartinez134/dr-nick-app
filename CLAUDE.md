# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Next.js, port 3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (run all tests)
npm run clean        # Kill dev server, clear .next and node_modules cache
```

To run a single test file: `npx vitest run path/to/test.ts`

### Instagram DM Pipeline (Node.js/ESM scripts)
```bash
npm run dm:start-local-bridge           # Start local bridge server
npm run dm:run-thread-network-pipeline  # Full single-thread pipeline
npm run dm:run-batch-thread-network-pipeline  # Batch pipeline
npm run dm:run-unified-followup-workflow      # Unified followup
npm run dm:inspect-threads              # Inspect thread states
```

## Environment Setup

Create `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_ADMIN_EMAIL=
GROK_API_KEY=
GROK_API_BASE_URL=https://api.x.ai/v1
GROK_MODEL=grok-3-latest
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
```

Additional optional keys: `CLIPDROP_API_KEY`, `POPPY_API_KEY`, `REMOVEBG_API_KEY`, `APIFY_API_TOKEN`, `SWIPE_CAPTURE_KEY`, Google OAuth credentials for Drive.

## Architecture

This is a **dual-purpose app**: a health tracking system for "The Fittest You" program (Dr. Nick's patients) and a carousel/content marketing editor.

### Routing

| Route | Purpose |
|-------|---------|
| `/` | Login/home — redirects to `/editor` (editor users) or `/home` (patients) |
| `/home` | ViralCarousels marketing landing |
| `/[alias]` | Patient health dashboard (dynamic by alias) |
| `/admin/*` | Dr. Nick admin portal (patient management, review queue) |
| `/editor/*` | Carousel/content editor |
| `/onboarding/*` | Patient onboarding |
| `/api/*` | Backend API routes |

### Health Tracking System

**Admin detection**: No roles table. Admin is detected by comparing `user.email` to `NEXT_PUBLIC_ADMIN_EMAIL`. The same pattern is used in Supabase RLS policies (hardcoded email in SQL policies).

**Smart week calculation**: No `start_date`/`end_date` columns exist. The current week is computed in `src/app/components/health/` by analyzing the patient's submission history (`week_number`, `date`, `created_at`):
- First submission → Week 1
- ≤3 days since last submission → same week (resubmit window)
- 4–10 days → next week
- >10 days → calculates weeks passed

**Developer Mode**: A toggle button in the patient form bypasses smart week calculation and allows manual week selection. Intended only for testing.

**Review queue**: `health_data.needs_review` boolean. Patient submissions set it to `true`; Dr. Nick's entries set it to `false`. Admin queue shows all `needs_review = true` rows.

**Key service files** in `src/app/components/health/`:
- `healthService.ts` — CRUD for health data
- `adminService.ts` — admin operations (patient creation, queue)
- `imageService.ts` — Supabase Storage upload/signed URL retrieval
- `grokService.ts` — Grok AI analysis integration
- `metricsService.ts` / `complianceMetricsService.ts` — metric calculations

### Carousel / Content Editor

Located under `src/app/editor/` and `src/features/editor/` and `src/features/html-editor/`.

**Multi-AI layout engine**: `src/lib/layout-*.ts` files wrap Claude, Gemini, Grok, and GPT with vision APIs for text placement and carousel generation. Each AI provider has its own module; a dispatcher selects the provider per request.

**Daily Digest pipeline**: API routes under `src/app/api/daily-digest/` fetch YouTube RSS feeds, extract content, and generate carousels via the AI layout engines.

### Instagram DM Pipeline

Node.js/ESM scripts in `scripts/instagram_dm/`. They run standalone (not part of Next.js) and communicate with a local bridge server (`start_local_bridge.mjs`) that interfaces with the Instagram web client via Playwright. The pipeline stages are: discover → capture network → classify state → execute safe followups.

### Database

Supabase (PostgreSQL) with Row-Level Security. Key tables:
- `profiles` — user management; stores `patient_password` in plain text (intentional design for operational convenience; protected by RLS)
- `health_data` — weekly health metrics per patient; fields include body measurements, training days, recovery scores, Lumen device image URLs (7 days), food log image URLs (7 days), Whoop PDF URLs

Images are stored in Supabase Storage (`health-images` bucket) and accessed via temporary signed URLs.

**SQL migration files** are ad-hoc `.sql` files in the project root (not a formal migration tool). Apply them manually via the Supabase dashboard SQL editor.

### Tech Stack

- **Next.js 15** (App Router), **React 19**, **TypeScript 5** (strict)
- **Supabase** (auth + database + storage)
- **Tailwind CSS 4**
- **Recharts** + **ECharts** for charts
- **Fabric.js**, **html2canvas**, **pdf-lib**, **pdfjs-dist** for image/PDF manipulation
- **Playwright** for browser automation (Instagram pipeline + carousel screenshots)
- **Vitest** for tests
