-- Expand installation_reports to match the GeM "Project Completion & Quality
-- Certification" form: granular per-item checklist, categorized photo record,
-- and three-party joint sign-off (Principal / Dept Rep / Contractor).
--
-- Purely additive — no columns dropped or renamed, so existing rows and any
-- code still reading toilet_installed / hardware_installed / signature_data_url
-- keep working unchanged. Safe to run standalone via the SQL Editor.

ALTER TABLE public.installation_reports
  -- Date the physical installation happened (distinct from submitted_at,
  -- which is when the report was filed — these can differ by days).
  ADD COLUMN IF NOT EXISTS installation_date date,

  -- Granular checklist — supersedes toilet_installed / hardware_installed.
  ADD COLUMN IF NOT EXISTS cwsn_unit_installed        boolean,
  ADD COLUMN IF NOT EXISTS grab_bars_installed        boolean,
  ADD COLUMN IF NOT EXISTS braille_signage_installed  boolean,
  ADD COLUMN IF NOT EXISTS braille_layout_installed   boolean,
  ADD COLUMN IF NOT EXISTS tactile_tiles_installed    boolean,
  ADD COLUMN IF NOT EXISTS plumbing_connected         boolean,
  ADD COLUMN IF NOT EXISTS electrical_connected       boolean,
  ADD COLUMN IF NOT EXISTS functional_testing_passed  boolean,

  -- Categorized photo record — keyed by slot id → storage path, same
  -- pattern as surveys.named_photos.
  ADD COLUMN IF NOT EXISTS named_photos jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Department Representative sign-off (marked "if applicable" on the form).
  ADD COLUMN IF NOT EXISTS dept_rep_applicable    boolean,
  ADD COLUMN IF NOT EXISTS dept_rep_name          text,
  ADD COLUMN IF NOT EXISTS dept_rep_designation   text,
  ADD COLUMN IF NOT EXISTS dept_rep_signature_url text,

  -- Contractor's authorized representative sign-off.
  ADD COLUMN IF NOT EXISTS contractor_name          text,
  ADD COLUMN IF NOT EXISTS contractor_signature_url text,

  ADD COLUMN IF NOT EXISTS school_seal_affixed boolean;

COMMENT ON COLUMN public.installation_reports.toilet_installed IS
  'Deprecated — superseded by cwsn_unit_installed. Retained for historical reports filed before 2026-08-05.';
COMMENT ON COLUMN public.installation_reports.hardware_installed IS
  'Deprecated — superseded by grab_bars_installed / plumbing_connected / electrical_connected. Retained for historical reports.';
COMMENT ON COLUMN public.installation_reports.signature_data_url IS
  'Principal / Head of Institution signature (column name kept for compatibility).';
COMMENT ON COLUMN public.installation_reports.signed_by_name IS
  'Principal / Head of Institution name (column name kept for compatibility).';
COMMENT ON COLUMN public.installation_reports.signed_by_designation IS
  'Principal / Head of Institution designation (column name kept for compatibility).';
COMMENT ON COLUMN public.installation_reports.named_photos IS
  'Categorized completion photos keyed by slot id: cwsn_unit, ramp, braille_signage, braille_layout, tactile_tiles, overall → storage path.';
