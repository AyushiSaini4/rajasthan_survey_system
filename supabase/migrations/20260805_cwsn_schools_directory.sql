-- =============================================================================
-- Migration: cwsn_schools directory — RLS + indexes
--
-- public.cwsn_schools already exists in production (created by migrations
-- 0008 and 0009, run directly in the Supabase SQL Editor, not committed to
-- this repo). Real columns, confirmed live via the PostgREST OpenAPI schema
-- (2026-08-05):
--   id, sno, district, block, school_name, udise_code, cwsn_toilet_no,
--   ramp_no, tactile_tile_sqft, grab_bar_no, braille_signage_no,
--   braille_layout_plan_no, sanction_amount_lacs, location_id, created_at
-- (1,236 rows already seeded.) No `village` or `school_type` columns exist —
-- an earlier draft of this migration assumed a different, made-up schema
-- and has been corrected to match reality.
--
-- This migration does NOT create or alter the table shape. It only adds
-- what SchoolSearchCombobox and RolloutTracker need to read it safely:
--   - RLS enabled + an authenticated-read policy (idempotent — safe to
--     rerun even if 0008/0009 already set up equivalent policies)
--   - search-supporting indexes
--
-- Note: querying the live table with the anon key currently returns 200 —
-- confirm with the team whether that's intentional (sanction_amount_lacs is
-- budget data) before assuming it should stay that way. This migration
-- does not touch anon access either way.
-- =============================================================================

ALTER TABLE public.cwsn_schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_cwsn_schools" ON public.cwsn_schools;
CREATE POLICY "authenticated_select_cwsn_schools"
  ON public.cwsn_schools
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_write_cwsn_schools" ON public.cwsn_schools;
CREATE POLICY "admin_write_cwsn_schools"
  ON public.cwsn_schools
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

CREATE INDEX IF NOT EXISTS idx_cwsn_schools_udise    ON public.cwsn_schools (udise_code);
CREATE INDEX IF NOT EXISTS idx_cwsn_schools_district ON public.cwsn_schools (district);
CREATE INDEX IF NOT EXISTS idx_cwsn_schools_name     ON public.cwsn_schools (lower(school_name));
