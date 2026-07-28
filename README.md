# SNIS Rajasthan — Special Needs Infrastructure Survey System

A production-grade Progressive Web App built to manage infrastructure surveys, manufacturing, QC, delivery, installation, and payment workflows across **1,250 schools and care facilities in Rajasthan, India**.

## Live Demo
> **[https://rajasthan-survey-system-7fsm.vercel.app](https://rajasthan-survey-system-7fsm.vercel.app)**

## What It Does

- **Field Agents** conduct on-site surveys with photo capture and GPS tagging — works fully **offline** with background sync via IndexedDB
- **Manufacturing Units** receive and manage production jobs assigned by admins
- **QC Inspectors** verify completed jobs and generate **PDF quality reports** with digital signatures
- **Admin** manages locations, units, payment contracts, and tranche releases
- **Verifiers** do final sign-off before payment is released

## Standout Features

- **Offline-first PWA** — field agents in low-connectivity areas can complete surveys offline; data syncs automatically when back online (IndexedDB + next-pwa)
- **PDF report generation** — QC reports with digital signature capture exported via @react-pdf/renderer
- **Role-based access control** — 5 distinct roles with Supabase RLS policies enforcing data boundaries
- **Payment tranche logic** — multi-stage contract payment system with locked/unlocked/released states
- **1,250 seeded locations** — real Rajasthan location data (RJ-0001 to RJ-1250)

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
| `admin` | Full system access, manage units, payments, reports |
| `field_agent` | Survey submission, delivery & installation confirmation |
| `manufacturing_unit` | View and update assigned production jobs |
| `qc_inspector` | QC verification, PDF report generation |
| `verifier` | Final verification sign-off |

## Local Setup

```bash
git clone https://github.com/AyushiSaini4/Rajasthan_survey_system
cd Rajasthan_survey_system
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
