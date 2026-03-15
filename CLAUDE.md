# Special Needs Infrastructure Survey System — Master Context File
# Read this FULLY at the start of every Claude Code session before writing any code.
# This file contains everything. Do not skip any section.

---

## Project Overview

A web-based PWA (Progressive Web App) for managing a government/institutional
infrastructure project across 1,250 locations in Rajasthan, India.

The project involves supplying and installing toilets, ramps, and construction
hardware for children with special needs at schools, anganwadi centres, and
special education facilities across Rajasthan.

Location codes run from RJ-0001 to RJ-1250.

### Who the client is
A goods vendor in Rajasthan contracted by a government/institutional body.
They own and operate 4–5 in-house manufacturing units. They are not a third-party
marketplace — all manufacturing is internal. The payment platform tracks payments
to an external raw materials / goods supplier only.

### Why this system exists
1,250 locations cannot be managed through WhatsApp, Excel, or paper forms.
Every location needs a verifiable audit trail from first survey to final
installation — with photos, GPS proof, signatures, and PDF reports — for
government accountability.

---

## The 6 Phases — End to End

### Phase 1 — Survey / Audit
Field agents visit each of the 1,250 locations physically.
They open the PWA on their Android phone.
They fill a survey form covering:
- Is there an existing toilet? What condition is it in?
- Is there a ramp / accessible entry? What condition?
- Hardware / fittings condition?
- Quantities of materials needed (tiles in sqft, toilet units, ramp units, fitting sets)
- Photos of the site (auto-compressed, GPS-tagged)
- Videos if needed
- Free-text notes

GPS is auto-captured when the form opens — agent cannot edit it.
Photo coordinates are embedded at capture time — proof they were physically present.
Form works offline. Saves to IndexedDB on device. Syncs when signal returns.
After submission: location status changes from `pending` → `surveyed`.

### Phase 2 — Admin Reviews and Assigns
Admin logs into the web dashboard (desktop or tablet).
They see all 1,250 locations colour-coded by status.
They filter to "Surveyed — awaiting assignment".
They click a location to open it and see:
- Full survey data and photos from Phase 1
- Material quantities required
- List of in-house manufacturing units with current job load / capacity
Admin selects a unit and confirms assignment.
Location status changes: `surveyed` → `assigned`.
The selected unit sees the job appear in their production queue immediately.

### Phase 3 — In-House Production
The manufacturing unit logs into their unit dashboard.
They see all jobs assigned to them as a queue of cards.
Each job card shows:
- Location code and name
- Exact quantities to produce (copied from survey)
- Current progress percentage
- Status (pending / in_production / complete / qc_passed / dispatched)
Unit updates progress in 10% increments as work progresses.
When production is 100% done, they tap "Mark production complete".
Location status changes: `assigned` → `in_production` → unit marks complete (triggers QC).
QC inspector is notified automatically.

### Phase 4 — Quality Control (QC)
QC Inspector is an independent role — not part of the manufacturing unit.
They visit the unit physically after production is marked complete.
They open the QC inspection form on their phone.
They fill a checklist:
- Quantities correct? (Pass / Fail + notes)
- Dimensions correct? (Pass / Fail + notes)
- Finish quality acceptable? (Pass / Fail + notes)
- No visible defects? (Pass / Fail + notes)
- Overall notes
They attach photos of the goods as evidence.
They mark overall result: PASS or FAIL.
They sign on screen using finger — drawn signature saved as PNG image.
They tap Submit.

On submission:
- Server receives everything
- @react-pdf/renderer auto-generates a QC Inspection PDF (see PDF spec below)
- PDF saved to Supabase Storage bucket `reports`
- PDF URL written to qc_inspections table

If PASS:
- production_job status → `qc_passed`
- location status → `qc_passed`
- Payment tranche "On QC Pass" → `unlocked` (admin can now release it)
- Unit is notified: goods cleared for dispatch

If FAIL:
- production_job status → `qc_failed`
- location status → `qc_failed`
- rework_required = true, rework_deadline set
- Unit is notified: rework required
- inspection_number increments on next attempt
- Inspector returns for re-inspection — full new record created
- Nothing dispatched until a PASS is achieved

Every inspection attempt is permanently stored. Full history per job.

### Phase 5 — Payment Platform
Admin creates a payment contract for a supplier.
Each contract covers one or multiple locations.
Each contract has 4 payment tranches:

| Tranche | Trigger | Typical % |
|---|---|---|
| Advance | Manual — admin releases at contract start | 20–30% |
| On QC Pass | Auto-unlocked when QC result = passed | 30–40% |
| On Delivery | Auto-unlocked when field agent confirms goods received on site | 20% |
| On Verification | Auto-unlocked when verifier approves installation report | 10–20% |

Tranche states:
- `locked` → milestone not yet hit, cannot be released
- `unlocked` → milestone complete, system auto-unlocks, admin sees Release button
- `released` → admin entered payment reference and confirmed

IMPORTANT: System only UNLOCKS tranches automatically. A human admin ALWAYS
manually confirms the final release and enters a payment reference (e.g. NEFT/2025/00412).
System never releases money on its own.

Every payment action is permanently audit-logged:
who released it, when, payment reference, amount.

Admin dashboard summary shows per contract:
- Total contract value
- Amount released so far
- Amount unlocked and ready to release
- Amount still locked

### Phase 6 — Delivery + Installation Report + Verification
Three sub-steps in sequence:

**Step 6a — Delivery confirmation**
Field agent visits the location when goods arrive.
They open the delivery confirmation form.
They confirm: goods received, quantities match, GPS captured, timestamp.
location status → `delivered`
Payment tranche "On Delivery" → `unlocked`

**Step 6b — Installation report**
After goods are installed, field agent fills installation report:
- Toilet installed? (Yes / No)
- Ramp installed? (Yes / No)
- Hardware / fittings installed? (Yes / No)
- Installation photos (GPS-tagged)
- Notes
- Supervisor signs on screen with finger (same signature pad as QC)
Report submitted → PDF auto-generated → sent to verifier queue
location status → `installed`

**Step 6c — Verification**
Verifier (independent role) logs in and sees pending installation reports.
They review the full report: checklist, photos, GPS, signature.
They add verification notes.
They tap Approve or Reject.

If Approved:
- location status → `verified` → `closed`
- Payment tranche "On Verification" → `unlocked`
- Final payment can now be released by admin

If Rejected:
- Verifier adds rejection reason
- Field agent notified to rectify and resubmit

---

## Tech Stack — Do Not Deviate

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (role-based) |
| File Storage | Supabase Storage (photos, videos, PDFs) |
| Offline Sync | IndexedDB via `idb` library |
| PDF Generation | `@react-pdf/renderer` |
| Digital Signature | `react-signature-canvas` |
| Image Compression | `browser-image-compression` |
| Deployment | Vercel |
| PWA | `next-pwa` |

Do NOT use pages/ router. App Router only.
Do NOT build a native Android app. PWA only — works via browser, add to home screen.
Do NOT add unnecessary dependencies. Bundle must stay lean for low-end Android phones.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Set in `.env.local` locally.
Set in Vercel dashboard → Project Settings → Environment Variables for production.

---

## User Roles — 5 Total

| Role | What they access |
|---|---|
| `field_agent` | Survey form, delivery confirmation, installation report — own assigned locations only |
| `manufacturing_unit` | Production queue, job details, progress updates, mark complete, mark dispatched |
| `qc_inspector` | QC checklist form, photo upload, pass/fail, signature, QC PDF — jobs where status = complete |
| `admin` | Full access — all locations, all statuses, assign units, manage payments, view all reports |
| `verifier` | View installation reports, approve/reject — triggers final payment unlock |

Server-side RLS enforcement always. Never trust client role claims.

---

## Location Status Flow (Auto-Updates)

```
pending
  → surveyed          (Phase 1 complete — field agent submits survey)
  → assigned          (Phase 2 complete — admin assigns to unit)
  → in_production     (Phase 3 — unit starts work)
  → qc_failed         (Phase 4 — QC inspection failed, rework needed)
  → qc_passed         (Phase 4 — QC inspection passed, cleared for dispatch)
  → dispatched        (Unit marks goods dispatched)
  → delivered         (Phase 6a — field agent confirms receipt on site)
  → installed         (Phase 6b — installation report submitted)
  → verified          (Phase 6c — verifier approves)
  → closed            (Final state — all done, all payments released)
```

---

## Database Schema — 7 Tables

### Table: `locations`
```sql
id uuid primary key default gen_random_uuid()
location_code text unique not null        -- RJ-0001 to RJ-1250
name text
district text
block text
village text
address text
latitude float
longitude float
assigned_agent uuid references auth.users(id)
assigned_unit_id uuid references manufacturing_units(id)
status text default 'pending'
created_at timestamptz default now()
```

### Table: `surveys`
```sql
id uuid primary key default gen_random_uuid()
location_id uuid references locations(id)
agent_id uuid references auth.users(id)
submitted_at timestamptz default now()
synced_at timestamptz                     -- null if still offline
gps_lat float
gps_lng float
gps_accuracy float                        -- accuracy in metres

-- Infrastructure checklist
toilet_present boolean
toilet_condition text                     -- good | damaged | missing
ramp_present boolean
ramp_condition text                       -- good | damaged | missing
hardware_condition text                   -- good | damaged | missing
notes text

-- Material quantities required
qty_tiles integer                         -- in square feet
qty_toilet_units integer
qty_ramp_units integer
qty_fittings integer
qty_other jsonb                           -- for any other material types

-- Media (Supabase Storage paths, not URLs)
photos text[]
videos text[]

is_offline_submission boolean default false
```

### Table: `manufacturing_units`
```sql
id uuid primary key default gen_random_uuid()
name text                                 -- e.g. "Unit A — Jaipur"
district text
contact_name text
contact_phone text
user_id uuid references auth.users(id)
is_active boolean default true
```

### Table: `production_jobs`
```sql
id uuid primary key default gen_random_uuid()
location_id uuid references locations(id)
survey_id uuid references surveys(id)
unit_id uuid references manufacturing_units(id)
assigned_by uuid references auth.users(id)
assigned_at timestamptz default now()

-- Quantities to produce (copied from survey at time of assignment)
qty_tiles integer
qty_toilet_units integer
qty_ramp_units integer
qty_fittings integer
qty_other jsonb

-- Progress
progress_pct integer default 0            -- 0 to 100
status text default 'pending'
  -- pending | in_production | complete | qc_passed | qc_failed | dispatched
production_notes text
completed_at timestamptz
dispatched_at timestamptz
```

### Table: `qc_inspections`
```sql
id uuid primary key default gen_random_uuid()
production_job_id uuid references production_jobs(id)
location_id uuid references locations(id)
inspector_id uuid references auth.users(id)
inspected_at timestamptz default now()
inspection_number integer default 1       -- increments on each re-inspection

-- Checklist
qty_correct boolean
qty_notes text
dimensions_correct boolean
dimensions_notes text
finish_quality_pass boolean
finish_notes text
defects_present boolean
defects_description text
overall_notes text

-- Result
result text                               -- passed | failed
photos text[]                             -- Supabase Storage paths

-- Signature (drawn on screen with finger)
inspector_signature_url text              -- URL to PNG image in Supabase Storage
inspector_name text

-- PDF (auto-generated on submission)
pdf_url text                              -- URL to PDF in Supabase Storage bucket `reports`

-- Rework (only if failed)
rework_required boolean default false
rework_deadline date
```

### Table: `payment_contracts`
```sql
id uuid primary key default gen_random_uuid()
supplier_name text
location_id uuid references locations(id)  -- null if contract spans multiple locations
total_contract_value numeric(12,2)
currency text default 'INR'
created_by uuid references auth.users(id)
created_at timestamptz default now()
notes text
```

### Table: `payment_tranches`
```sql
id uuid primary key default gen_random_uuid()
contract_id uuid references payment_contracts(id)
tranche_name text
  -- "Advance" | "On QC Pass" | "On Delivery" | "On Verification"
trigger_milestone text
  -- manual | qc_passed | delivered | verified
percentage numeric(5,2)                   -- e.g. 30.00
amount numeric(12,2)                      -- calculated from contract total value
status text default 'locked'
  -- locked | unlocked | released
unlocked_at timestamptz
released_at timestamptz
released_by uuid references auth.users(id)
payment_reference text                    -- NEFT/cheque/transfer reference number
notes text
```

### Table: `installation_reports`
```sql
id uuid primary key default gen_random_uuid()
location_id uuid references locations(id)
agent_id uuid references auth.users(id)
submitted_at timestamptz default now()
gps_lat float
gps_lng float

-- Delivery confirmation (Phase 6a)
goods_received_at timestamptz
goods_received_by uuid references auth.users(id)
delivery_confirmed boolean default false

-- Installation checklist (Phase 6b)
toilet_installed boolean
ramp_installed boolean
hardware_installed boolean
installation_notes text
photos text[]                             -- Supabase Storage paths

-- Signature (supervisor signs on screen)
signature_data_url text                   -- base64 PNG or Supabase Storage URL
signed_by_name text
signed_by_designation text

-- PDF (auto-generated on submission)
pdf_url text

-- Verification (Phase 6c)
status text default 'pending'             -- pending | approved | rejected
verified_by uuid references auth.users(id)
verified_at timestamptz
verifier_notes text
rejection_reason text
```

---

## Payment Tranche Logic

Tranche auto-unlock rules (triggered by system, not admin):
- `manual` → Admin manually initiates, no automatic trigger
- `qc_passed` → Auto-unlocked when qc_inspections.result = 'passed' for this location
- `delivered` → Auto-unlocked when installation_reports.delivery_confirmed = true
- `verified` → Auto-unlocked when installation_reports.status = 'approved'

State transitions:
- `locked` → `unlocked` : AUTOMATIC when system detects milestone hit
- `unlocked` → `released` : MANUAL — admin clicks Release, enters payment_reference, confirms

System NEVER auto-releases. Human always confirms the final release.
Full audit: released_by, released_at, payment_reference stored permanently.

---

## QC Inspection Flow (Detailed)

1. Unit marks production_job.status = `complete`
2. location.status → triggered to `qc_passed` area — QC inspector sees job in queue
3. Inspector visits unit physically, opens app, fills QC checklist form
4. Inspector attaches photos of goods as evidence
5. Inspector marks overall result: Pass or Fail
6. Signature pad appears — inspector draws signature with finger on phone screen
7. Inspector taps Submit

Server-side on submission:
- Signature PNG saved to Supabase Storage
- @react-pdf/renderer assembles QC PDF (see PDF spec)
- PDF saved to bucket `reports`, path: /{location_code}/qc/{timestamp}_inspection_{number}.pdf
- pdf_url written to qc_inspections record
- If PASS: production_job → qc_passed, location → qc_passed, tranche unlocked
- If FAIL: production_job → qc_failed, location → qc_failed, rework_required = true

Every re-inspection = new qc_inspections record with inspection_number + 1
Full history of all attempts stored forever.

---

## Offline Sync Logic

Library: `idb`
Local store name: `pending_submissions`

Store types:
- `survey`
- `qc_inspection`
- `installation_report`
- `delivery_confirmation`

Flow:
1. User fills form and taps Submit
2. Data written to IndexedDB FIRST (always, regardless of connectivity)
3. App immediately attempts Supabase sync
4. If online → sync succeeds → remove from IndexedDB → show green badge
5. If offline → show "Saved offline — will sync when connected"
6. On app load: check IndexedDB for pending items → attempt sync
7. On `window.online` event: check IndexedDB for pending items → attempt sync

Header badge states:
- Green dot + "Synced" → all clear
- Amber dot + "Pending (N)" → N items waiting to sync
- Red dot + "Sync error" → sync attempted but failed

NEVER lose a submission. Offline-first is non-negotiable.
Data must survive the phone being turned off and back on.

---

## File Upload Handling

Photos:
- Compress to max 1MB using `browser-image-compression` before upload
- GPS coordinates embedded at capture time (cannot be changed)
- Multiple photos per form

Videos:
- Max 50MB direct upload, no compression
- Only on survey forms

Supabase Storage buckets:
- `survey-media` — survey photos and videos
- `qc-inspections` — QC inspection photos
- `installation-media` — installation report photos
- `reports` — all generated PDFs

File path pattern: `/{location_code}/{type}/{timestamp}_{filename}`
Example: `/RJ-0231/survey/1706000000_front_entrance.jpg`

Never store photo/video binary in the database. Always Supabase Storage.

---

## PDF Report Specifications

### QC Inspection Report (auto-generated on QC submission)
1. Header: Project name, "QC Inspection Report", Inspection #N
2. Reference block: Location code, production job ID, unit name, inspection date
3. Full checklist — each item as a row: item name | Pass/Fail | notes
4. Photos — 2 per row, max 8 photos, each with a caption
5. Overall result — large prominent PASSED (green) or FAILED (red)
6. Rework section — only appears if FAILED — what needs to be fixed, deadline
7. Inspector signature — drawn signature as image, inspector name below
8. Footer: "Generated by system", timestamp, inspection number

### Installation Report (auto-generated on installation report submission)
1. Header: Project name, logo placeholder, "Installation Report"
2. Location block: code, name, district, block, village, full address
3. GPS coordinates + submission timestamp
4. Delivery confirmation: goods received date, confirmed by, items received
5. Installation checklist — tick/cross per item with notes
6. Installation notes (free text)
7. Photos — 2 per row, max 6 photos
8. Digital signature image, signed by name and designation, date
9. Verification status (added when verifier approves — verifier name, date, notes)
10. Footer: generated by system, date

---

## Route Structure

```
/                              → Role-based redirect after login check
/login                         → All roles — Supabase Auth

/agent/
  dashboard                    → Assigned locations list + status badges
  survey/[locationId]          → Survey form (offline-capable, GPS + photos)
  delivery/[locationId]        → Confirm goods received on site
  install/[locationId]         → Installation report + signature + photos

/admin/
  dashboard                    → All 1,250 locations — filters, search, status colour
  location/[id]                → Full location timeline: survey → production → QC → payment → install
  units                        → In-house units overview + load + assignment
  qc                           → All QC inspections (pending / passed / failed)
  payments                     → All contracts + tranche status summary
  payments/[contractId]        → Contract detail — release individual tranches
  reports                      → All installation reports + verification status

/unit/
  dashboard                    → This unit's production job queue
  job/[jobId]                  → Job detail — quantities, progress slider, mark complete

/qc/
  dashboard                    → Jobs pending QC (production_job.status = complete)
  inspect/[jobId]              → QC checklist + photos + signature + submit

/verifier/
  dashboard                    → Pending installation reports
  report/[reportId]            → Full report detail + approve/reject
```

---

## Key Components to Build

```
<OfflineBadge />               — Header sync status: green / amber / red
<LocationStatusBadge />        — Colour-coded pill for any status value
<SurveyForm />                 — Offline-capable survey with GPS + photos + videos
<PhotoUploader />              — Multi-photo with browser-image-compression
<VideoUploader />              — Video upload, max 50MB
<GPSCapture />                 — Auto-capture with accuracy display, non-editable
<SignaturePad />               — react-signature-canvas, finger-drawable
<QCInspectionForm />           — Full QC checklist + photos + pass/fail + signature
<InstallationReportForm />     — Delivery confirmation + checklist + signature
<ProductionJobCard />          — Unit job card with progress bar + update controls
<PaymentTrancheRow />          — Tranche status, trigger label, release button + form
<PaymentDashboard />           — Contract summary: total / released / unlocked / locked
<AdminLocationTimeline />      — Full location history from survey to closed
<PDFQCReport />                — @react-pdf/renderer QC inspection report
<PDFInstallReport />           — @react-pdf/renderer installation report
```

---

## Supabase RLS Policies

```
field_agent:
  surveys              → INSERT/SELECT own records, own assigned locations only
  installation_reports → INSERT/SELECT own records, own assigned locations only
  locations            → SELECT own assigned locations only

manufacturing_unit:
  production_jobs      → SELECT/UPDATE own unit only
  locations            → SELECT assigned to own unit only
  NO access to payments, other units, or QC tables

qc_inspector:
  production_jobs      → SELECT where status = 'complete'
  qc_inspections       → INSERT/SELECT all (they inspect any unit)
  locations            → SELECT all (read only)

admin:
  ALL tables           → Full access

verifier:
  installation_reports → SELECT all, UPDATE status/verified_by/verifier_notes/rejection_reason only
  locations            → SELECT all (read only)
  payment_tranches     → No access (admin only)
```

Server-side enforcement always. Never trust client-side role claims.

---

## Coding Standards

- Components in `/components/`, grouped by feature (e.g. `/components/survey/`, `/components/payments/`)
- Supabase calls ONLY in `/lib/supabase/` — never inline in components or pages
- All TypeScript types in `/types/index.ts`
- Server components by default — use `'use client'` only when interactivity required
- Loading state on every data-fetching component
- Error state on every data-fetching component
- No `any` types — type everything properly
- Only `NEXT_PUBLIC_` prefixed env vars exposed to client
- `npm run build` must pass at all times — never commit broken builds

---

## Folder Structure

```
/app
  /login
  /agent
    /dashboard
    /survey/[locationId]
    /delivery/[locationId]
    /install/[locationId]
  /admin
    /dashboard
    /location/[id]
    /units
    /qc
    /payments
    /payments/[contractId]
    /reports
  /unit
    /dashboard
    /job/[jobId]
  /qc
    /dashboard
    /inspect/[jobId]
  /verifier
    /dashboard
    /report/[reportId]
/components
  /survey
  /admin
  /payments
  /qc
  /installation
  /shared
/lib
  /supabase
    client.ts
    server.ts
    admin.ts
/types
  index.ts
/public
  manifest.json
  icons/
```

---

## Deployment

- Platform: Vercel
- Auto-deploy on push to `main` branch via GitHub
- Preview deployments auto-created on pull requests
- Environment variables: set in Vercel dashboard → Project Settings → Environment Variables
- PWA manifest and service worker via `next-pwa`

---

## What NOT to Build

- DO NOT build manufacturer selection, bidding, vendor evaluation — units are internal
- DO NOT add any payment flows to manufacturing units — they are staff, not vendors
- DO NOT use pages/ router — App Router only
- DO NOT store photos or videos in the database — always Supabase Storage
- DO NOT skip offline sync — non-negotiable core requirement for field agents
- DO NOT use client-side only auth checks — always server-side RLS
- DO NOT build a native Android app — PWA only
- DO NOT add unnecessary npm dependencies — bundle stays lean for low-end phones
- DO NOT expose SUPABASE_SERVICE_ROLE_KEY to the client — server-side only

---

## Build Order (Recommended Sequence)

Build in this order — each step depends on the previous:

1. Next.js 14 + Tailwind + Supabase + next-pwa scaffold
2. All 7 Supabase tables created with correct schema and RLS
3. Auth flow + role detection + route protection + role-based redirect from /
4. Field agent: survey form (online first, no offline yet)
5. Field agent: GPS capture component
6. Field agent: photo upload with compression
7. Field agent: offline sync (IndexedDB + sync logic + header badge)
8. Admin: locations dashboard (list all 1,250, status badges, filters)
9. Admin: location detail page (full timeline view)
10. Admin: assign to unit flow
11. Manufacturing unit: production queue dashboard
12. Manufacturing unit: job detail + progress update + mark complete
13. QC inspector: pending jobs queue
14. QC inspector: QC checklist form + photo upload + signature pad
15. QC inspector: PDF generation on submission
16. Admin: payment contract creation
17. Admin: payment tranche setup
18. Admin: payment dashboard + tranche release flow
19. Auto-unlock logic: system detects milestones, unlocks tranches
20. Field agent: delivery confirmation form
21. Field agent: installation report form + signature
22. PDF generation: installation report
23. Verifier: pending reports queue + approve/reject
24. Deploy to Vercel
25. PWA manifest + service worker + add to home screen

---

## Session Instructions for Claude Code

1. Read this ENTIRE file before touching any code
2. Check existing codebase — run `ls`, `cat package.json`, check `/app` and `/components` structure
3. Never re-build what already exists
4. After completing each feature, update the status tracker below
5. Ensure `npm run build` passes before ending any session
6. Ask before building if anything is ambiguous
7. Always handle loading states and error states — never leave a blank screen
8. Test offline behaviour manually when building offline sync

---

## Project Status Tracker
Update these as features are completed. Check [x] when done.

### Foundation
- [x] Next.js 14 + Supabase + Tailwind + next-pwa scaffolded
- [x] All dependencies installed (idb, browser-image-compression, react-signature-canvas, @react-pdf/renderer)
- [ ] Supabase schema — all 7 tables created with correct columns
- [ ] RLS policies set on all tables
- [ ] Auth flow working (login page, session, redirect)
- [ ] Role detection from Supabase user metadata
- [ ] Role-based redirect from / (each role goes to correct dashboard)
- [x] Folder and route structure in place

### Field Agent
- [x] Agent dashboard — assigned locations list with status badges
- [x] Survey form — all fields (checklist, quantities, notes)
- [x] GPS auto-capture component with accuracy display
- [x] Photo upload with browser-image-compression
- [ ] Video upload (max 50MB)
- [ ] Offline sync — IndexedDB write on submit
- [ ] Offline sync — sync on reconnect
- [ ] Offline badge in header (green / amber / red)
- [ ] Delivery confirmation form
- [ ] Installation report form
- [ ] Signature pad on installation report
- [ ] Installation report PDF generation

### Manufacturing Unit
- [ ] Unit dashboard — production job queue
- [ ] Job detail page — quantities display
- [ ] Progress % update (10% increments)
- [ ] Mark production complete button
- [ ] Mark dispatched button
- [ ] Status updates reflected in location table

### QC Inspector
- [ ] QC jobs queue (jobs where production_job.status = complete)
- [ ] QC checklist form (4 items + notes)
- [ ] Photo upload on QC form
- [ ] Pass / Fail overall result selection
- [ ] Signature pad
- [ ] QC PDF generation on submission (@react-pdf/renderer)
- [ ] PDF saved to Supabase Storage, URL written to DB
- [ ] Re-inspection flow (inspection_number increments)
- [ ] Tranche auto-unlock on QC pass

### Admin
- [ ] All 1,250 locations dashboard
- [ ] Status filter (pending / surveyed / assigned / in_production / etc.)
- [ ] District filter
- [ ] Search by location code or name
- [ ] Location detail — full timeline view
- [ ] Assign to in-house unit flow
- [ ] Units management page (list units, active jobs, capacity)
- [ ] Payment contract creation form
- [ ] Payment tranche setup (4 tranches per contract)
- [ ] Payment dashboard (total / released / unlocked / locked)
- [ ] Payment tranche release (enter reference + confirm)
- [ ] Auto-unlock tranches on milestone detection
- [ ] QC overview page (all inspections)
- [ ] Installation reports overview

### Verifier
- [ ] Pending reports queue
- [ ] Report detail view (full checklist, photos, GPS, signature, PDF link)
- [ ] Approve button → location closed, tranche unlocked
- [ ] Reject button → rejection reason, agent notified

### PDFs
- [ ] QC inspection PDF (all 8 sections per spec)
- [ ] Installation report PDF (all 10 sections per spec)

### System
- [ ] Location status auto-updates on every milestone
- [ ] Payment tranche auto-unlock on milestone
- [ ] Vercel deployment live
- [ ] PWA manifest + icons + add to home screen working
- [ ] Tested on low-end Android device (offline sync, GPS, photos)
