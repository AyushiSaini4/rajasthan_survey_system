-- ═══════════════════════════════════════════════════════════════════════════
-- Government dashboard drill-down — two new public-safe views, following the
-- exact pattern already established by 20260804_public_location_stats_view.sql:
-- narrow views with security_invoker OFF (so they run as owner and bypass
-- RLS on the base tables) rather than loosening RLS on locations/surveys/
-- production_jobs/etc. themselves. Nothing granted to anon here that wasn't
-- already agreed as safe: location codes, names, districts, blocks, statuses,
-- organization names, and timestamps. No GPS, no photos, no individual
-- people's names or phone numbers, no signatures.
--
-- Two views:
--   1. public_location_stats — EXTENDED (not replaced) with location_code,
--      name, block, so clicking a status/district card on the dashboard can
--      show which actual locations are in that state.
--   2. public_location_timeline — NEW. One row per location, with a
--      timestamp + safe detail for every stage it's passed through. Uses
--      LATERAL joins with LIMIT 1 (ordered by the relevant timestamp) rather
--      than plain LEFT JOINs, so a location with multiple historical survey
--      attempts, production jobs, or QC inspections still produces exactly
--      one row — a plain join could silently duplicate rows and throw off
--      any count-based UI built on top of this view.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Extend public_location_stats with the columns needed to list
--       individual locations within a status/district drill-down ──────────

CREATE OR REPLACE VIEW public.public_location_stats AS
SELECT location_code, name, district, block, status
FROM public.locations;

ALTER VIEW public.public_location_stats SET (security_invoker = off);
GRANT SELECT ON public.public_location_stats TO anon;

-- ── 2. New: per-location stage timeline ─────────────────────────────────────

CREATE OR REPLACE VIEW public.public_location_timeline AS
SELECT
  l.id,
  l.location_code,
  l.name,
  l.district,
  l.block,
  l.status,
  l.created_at            AS pending_since,

  s.submitted_at           AS surveyed_at,

  pj.assigned_at,
  mu.name                  AS assigned_unit_name,
  pj.status                AS production_status,
  pj.completed_at          AS production_completed_at,
  pj.dispatched_at,

  qc.result                AS qc_result,
  qc.inspected_at          AS qc_at,

  ir.goods_received_at     AS delivered_at,
  ir.submitted_at          AS installed_at,
  ir.status                AS installation_status,
  ir.verified_at

FROM public.locations l

LEFT JOIN LATERAL (
  SELECT submitted_at
  FROM public.surveys
  WHERE location_id = l.id
  ORDER BY submitted_at DESC
  LIMIT 1
) s ON true

LEFT JOIN LATERAL (
  SELECT id, assigned_at, unit_id, status, completed_at, dispatched_at
  FROM public.production_jobs
  WHERE location_id = l.id
  ORDER BY assigned_at DESC
  LIMIT 1
) pj ON true

LEFT JOIN public.manufacturing_units mu ON mu.id = pj.unit_id

LEFT JOIN LATERAL (
  SELECT result, inspected_at
  FROM public.qc_inspections
  WHERE production_job_id = pj.id
  ORDER BY inspected_at DESC
  LIMIT 1
) qc ON true

LEFT JOIN LATERAL (
  SELECT goods_received_at, submitted_at, status, verified_at
  FROM public.installation_reports
  WHERE location_id = l.id
  ORDER BY submitted_at DESC
  LIMIT 1
) ir ON true;

ALTER VIEW public.public_location_timeline SET (security_invoker = off);
GRANT SELECT ON public.public_location_timeline TO anon;

-- ── Verify after running ─────────────────────────────────────────────────────
-- select count(*) from public_location_stats;      -- expect 1236
-- select count(*) from public_location_timeline;    -- expect 1236
-- select * from public_location_timeline where surveyed_at is not null limit 3;
