-- Repairs the orphaned production job for RJ-0002 (Rajkiya Uchch Prathamik
-- Vidyalaya Shivpura) — its unit_id was never set, which is why it was
-- invisible to the Manufacturing Unit dashboard (filters on unit_id).
--
-- Quantities are deliberately NOT backfilled here: RJ-0002 has no matching
-- row in cwsn_schools (confirmed live — zero sanctioned schools in Jaipur/
-- Bagru block at all, and Bagru doesn't appear under any other spelling
-- among Jaipur district's 18 sanctioned blocks either, so this isn't an
-- import/naming gap — the block simply wasn't part of this sanction batch).
-- Enter real quantities by hand via the admin location page once this job
-- is visible on the unit's dashboard — that's the manual-entry fallback the
-- updated AssignUnitSection UI is built for.
--
-- Safe to run once. Re-running is a no-op if the job already has a unit_id.

WITH target_location AS (
  SELECT id FROM public.locations WHERE location_code = 'RJ-0002'
),
target_unit AS (
  SELECT id FROM public.manufacturing_units WHERE name = 'Riddhi Suppliers' LIMIT 1
)
UPDATE public.production_jobs pj
SET unit_id = (SELECT id FROM target_unit)
FROM target_location tl
WHERE pj.location_id = tl.id
  AND pj.unit_id IS NULL;

WITH target_location AS (
  SELECT id FROM public.locations WHERE location_code = 'RJ-0002'
),
target_unit AS (
  SELECT id FROM public.manufacturing_units WHERE name = 'Riddhi Suppliers' LIMIT 1
)
UPDATE public.locations l
SET assigned_unit_id = (SELECT id FROM target_unit)
FROM target_location tl
WHERE l.id = tl.id
  AND l.assigned_unit_id IS NULL;

-- Verify:
-- SELECT pj.id, pj.unit_id, l.assigned_unit_id
-- FROM production_jobs pj JOIN locations l ON l.id = pj.location_id
-- WHERE l.location_code = 'RJ-0002';
