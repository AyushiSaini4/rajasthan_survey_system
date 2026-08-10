-- ═══════════════════════════════════════════════════════════════════════════
-- DESTRUCTIVE MIGRATION — replaces the synthetic locations table with the
-- real 1,236 schools from the RCSE sanction list (already sitting correctly
-- in cwsn_schools). Wipes all test/demo data tied to the old fake locations
-- (surveys, production jobs, QC inspections, installation reports, payment
-- contracts/tranches) as explicitly requested.
--
-- Does NOT touch: manufacturing_units, qc_inspectors, or any user accounts —
-- those represent real entities (Riddhi Suppliers, jaipur.unit@gmail.com,
-- etc.) that should keep working once real locations exist to assign them to.
--
-- WHY THIS IS NEEDED: scripts/seed-locations.ts generated 1,250 procedural
-- placeholder schools (real district/block names, but school names built by
-- combining random syllables — "Ram" + "pura" = "Rampura"). Independently
-- confirmed live: RJ-0002's name "Rajkiya Uchch Prathamik Vidyalaya
-- Shivpura" is exactly INSTITUTION_TYPES[1] + "Shiv" + "pura" from that
-- script's word lists — not a coincidence, the generator's actual output.
-- The real 1,236 schools from the government sanction PDF were imported
-- correctly, but into cwsn_schools as a disconnected reference table, never
-- as the actual `locations` rows the app is built around. This migration
-- corrects that.
--
-- Pre-migration row counts (verified live, 2026-08-10, for the record —
-- this is what gets deleted):
--   locations: 1250, surveys: 4, production_jobs: 4, qc_inspections: 1,
--   installation_reports: 1, payment_contracts: 2, payment_tranches: 8,
--   cwsn_schools: 1236 (untouched in content, only location_id relinked)
--
-- SAFETY NOTES:
--   - Wrapped in a single transaction — if anything fails, nothing commits.
--   - Deletes in dependency-safe order (children before parents).
--   - New locations are linked back to cwsn_schools via a deterministically
--     computed location_code, not fuzzy name matching, so there's no
--     ambiguity even if two schools happen to share a name.
--   - Verified against the live schema before being added to this repo —
--     every table and column referenced below (cwsn_schools.sno/school_name/
--     district/block/location_id, locations.location_code/name/district/
--     block/address/status) was independently confirmed live via the
--     PostgREST OpenAPI schema and direct queries.
--
-- Run once. Not safe to re-run (will wipe again).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Wipe test/demo data, in FK-safe order ────────────────────────────────
DELETE FROM public.payment_tranches;
DELETE FROM public.payment_contracts;
DELETE FROM public.installation_reports;
DELETE FROM public.qc_inspections;
DELETE FROM public.production_jobs;
DELETE FROM public.surveys;

-- Break the old (fake) links before deleting locations.
UPDATE public.cwsn_schools SET location_id = NULL WHERE location_id IS NOT NULL;

DELETE FROM public.locations;

-- ── 2. Insert the real 1,236 schools as locations ───────────────────────────
-- location_code is computed deterministically (RJ-0001, RJ-0002, ... ordered
-- by the original sanction PDF row number) so step 3 can link back precisely.

WITH numbered_schools AS (
  SELECT
    id AS cwsn_id,
    school_name,
    district,
    block,
    'RJ-' || LPAD(ROW_NUMBER() OVER (ORDER BY sno)::text, 4, '0') AS new_code
  FROM public.cwsn_schools
),
inserted AS (
  INSERT INTO public.locations (location_code, name, district, block, address, status)
  SELECT
    new_code,
    school_name,
    district,
    block,
    district || ' District, Rajasthan',
    'pending'
  FROM numbered_schools
  RETURNING id, location_code
)

-- ── 3. Link cwsn_schools back to their new location rows ───────────────────
UPDATE public.cwsn_schools cs
SET location_id = inserted.id
FROM inserted, numbered_schools ns
WHERE inserted.location_code = ns.new_code
  AND cs.id = ns.cwsn_id;

COMMIT;

-- ── Verify after running ─────────────────────────────────────────────────────
-- select count(*) from locations;                              -- expect 1236
-- select count(*) from cwsn_schools where location_id is null;  -- expect 0
-- select location_code, name, district, block from locations order by location_code limit 5;
