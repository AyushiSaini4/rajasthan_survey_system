# SNIS Rajasthan — Special Needs Infrastructure Survey System

A production-grade Progressive Web App managing the full lifecycle of accessibility infrastructure — surveys, manufacturing, quality control, delivery, installation, and payment — across **1,236 real schools in Rajasthan, India**, sourced directly from an official RCSE government sanction order.

## Live Demo
> **[https://rajasthan-survey-system-7fsm.vercel.app](https://rajasthan-survey-system-7fsm.vercel.app)**

## What It Does

- **Field Agents** conduct on-site surveys with photo capture, GPS tagging, and inline document uploads — works fully **offline** with background sync via IndexedDB. Role ends once delivery of manufactured goods is confirmed on-site.
- **Manufacturing Units** receive production jobs with quantities pre-filled from the real government sanction record, and manage progress through to dispatch.
- **QC Inspectors** hold two independent duties: a factory-floor quality check on manufactured goods before dispatch, and a separate on-site visit after installation to certify the completed work — kept deliberately independent from the Field Agent who reported the before-condition.
- **Admin (Agency)** manages locations, units, inspector and agent accounts, payment contracts and tranche releases, and gives final project approval — no separate verifier login is required.
- **Public / Government view** — a live, no-login dashboard with full drill-down: click any status or district to see individual schools, click a school to see its complete stage-by-stage timeline.

## Standout Features

- **Offline-first PWA** — field agents in low-connectivity areas can complete surveys offline; data syncs automatically when back online (IndexedDB + next-pwa)
- **Real government data** — 1,236 schools imported directly from the RCSE sanction PDF, with sanctioned material quantities auto-populated at assignment time
- **PDF report generation** — both the factory QC report and the on-site installation certificate (matching the official GeM "Project Completion & Quality Certification" form) export via @react-pdf/renderer with captured digital signatures
- **Role-based access control** — Supabase RLS policies enforcing data boundaries per role, plus narrow public-safe database views for the anonymous government dashboard
- **Payment tranche logic** — multi-stage contracts with tranches that auto-unlock on specific milestones (QC pass, delivery, final approval), but never auto-release — a human always confirms the actual payment
- **Admin correction controls** — Unassign (agent or manufacturing unit), Unsurvey, and account suspension/deletion, each guarded against silently orphaning real work already in progress
- **Live public drill-down** — government dashboard with clickable status/district cards leading to individual location timelines, refreshing automatically every 60 seconds

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Supabase (Postgres, Auth, Row-Level Security) |
| Offline | IndexedDB (idb), next-pwa |
| Forms | react-hook-form + zod |
| PDF | @react-pdf/renderer |
| Signatures | react-signature-canvas |
| Deployment | Vercel |

## Roles

| Role | Access |
|------|--------|
| `admin` | Full system access — locations, units, inspector/agent accounts, payments, reports, and final project approval |
| `field_agent` | Survey submission and delivery confirmation. Does not handle on-site installation — see `qc_inspector`. |
| `manufacturing_unit` | View and update assigned production jobs through to dispatch |
| `qc_inspector` | Two duties: factory QC before dispatch, and the independent on-site installation certificate after delivery |
| `verifier` | Exists as a role for final sign-off, but is not currently used as a separate account — admin performs this step directly via the "Verify" link in their own dashboard |

## Data Note

The `locations` table is seeded directly from `cwsn_schools` (the imported RCSE sanction data), not procedurally generated — every school name, district, block, and UDISE code in the system is real. `scripts/seed-locations.ts` is a deprecated, disabled legacy script from early development that generated synthetic placeholder schools; it is kept in the repo for historical reference only and refuses to run.

## Local Setup

```bash
git clone https://github.com/AyushiSaini4/rajasthan_survey_system
cd rajasthan_survey_system
npm install
```

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### A note on database migrations

Schema changes are applied directly via the Supabase SQL Editor rather than an automated migration runner — files under `supabase/migrations/` are the record of what's been applied, but running them is a manual step. When querying any table that could exceed 1,000 rows, use explicit pagination (`lib/supabase/paginate.ts`) — Supabase/PostgREST silently caps unbounded queries at 1,000 rows with no error, which has caused real display bugs in this project (see git history for `c5e7eb1`).
