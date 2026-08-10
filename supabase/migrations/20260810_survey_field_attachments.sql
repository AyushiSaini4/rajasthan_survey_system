-- Migration: support inline photo fields in the reduced 4-section CWSN
-- questionnaire (2026-08-10).
--
-- The reduced questionnaire (lib/survey/questionnaire.ts) introduces a new
-- 'photo' field type for images captured inline, in the middle of Section 2
-- — e.g. a geo-tagged toilet-site photo right where "is a site approved?"
-- is asked, rather than only in the fixed end-of-form photo grid. These
-- never belong in `answers` (that column holds string/boolean/number
-- values only), so they get their own structured JSONB column, same
-- pattern as `named_photos` and the original `answers` column itself —
-- see the comment on 20260803_cwsn_questionnaire.sql for the rationale.
--
-- Purely additive — no columns dropped or renamed. ramp_gps_*,
-- gps_accuracy_screenshot, photos, and layout_map_photos are no longer
-- written by the new form but are left in place for historical surveys
-- submitted under the old 17-section questionnaire.

ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS field_attachments jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.surveys.field_attachments IS
  'Inline Section 2 photo fields (toilet site, ramp, tactile route, braille layout, obstructions), keyed by questionnaire field id → array of storage paths. See lib/survey/questionnaire.ts.';
