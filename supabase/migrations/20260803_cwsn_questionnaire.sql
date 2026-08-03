-- =============================================================================
-- Migration: CWSN Survey Questionnaire expansion
-- Adds full 17-section CWSN questionnaire support to public.surveys.
--
-- Design decision: the questionnaire has ~90 mostly free-form / yes-no fields
-- across 17 sections. Rather than 90 individual columns, section answers are
-- stored as structured JSONB (`answers`), keyed by the field ids defined in
-- lib/survey/questionnaire.ts (single source of truth shared by the form,
-- the PDF/report renderer, and any future analytics view). GPS, named
-- mandatory photos, and signatures get first-class columns since they're
-- queried/validated directly.
-- =============================================================================

ALTER TABLE public.surveys
  -- Section 3: a second GPS pair (ramp start/end) in addition to the existing
  -- gps_lat/gps_lng/gps_accuracy, which now represent the toilet location.
  ADD COLUMN IF NOT EXISTS ramp_gps_lat        float,
  ADD COLUMN IF NOT EXISTS ramp_gps_lng        float,
  ADD COLUMN IF NOT EXISTS ramp_gps_accuracy   float,
  ADD COLUMN IF NOT EXISTS gps_accuracy_screenshot text,   -- storage path

  -- Sections 1–2, 4–14, 16: structured questionnaire answers.
  -- Shape: { [fieldId]: string | boolean | number | null }
  ADD COLUMN IF NOT EXISTS answers             jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Section 15: the 10 mandatory named photo angles.
  -- Shape: { [slotId]: storagePath }
  ADD COLUMN IF NOT EXISTS named_photos        jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Section 11: hand-drawn / printed / digital Braille layout map uploads.
  ADD COLUMN IF NOT EXISTS layout_map_photos   text[] DEFAULT '{}',

  -- Section 17: declaration signatures (storage paths, PNG data URIs
  -- rendered to file at submit time — same pattern as installation_reports).
  ADD COLUMN IF NOT EXISTS team_name           text,
  ADD COLUMN IF NOT EXISTS team_signature      text,
  ADD COLUMN IF NOT EXISTS authority_name      text,
  ADD COLUMN IF NOT EXISTS authority_designation text,
  ADD COLUMN IF NOT EXISTS authority_signature text,
  ADD COLUMN IF NOT EXISTS declaration_date    date;

COMMENT ON COLUMN public.surveys.answers IS
  'Structured CWSN questionnaire answers keyed by field id — see lib/survey/questionnaire.ts';
COMMENT ON COLUMN public.surveys.named_photos IS
  'The 10 mandatory Section 15 photo angles, keyed by slot id → storage path';
