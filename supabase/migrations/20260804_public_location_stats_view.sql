-- =============================================================================
-- Migration: public read access for the /public transparency dashboard
--
-- The dashboard queries as an anonymous (unauthenticated) visitor — there is
-- intentionally no RLS policy granting `anon` SELECT on public.locations,
-- since that table also holds GPS coordinates, assigned_agent, and
-- assigned_unit_id, none of which should be readable via the public anon
-- key. Instead of loosening RLS on the base table, expose a narrow view
-- with only the columns the public dashboard actually needs.
-- =============================================================================

CREATE OR REPLACE VIEW public.public_location_stats AS
SELECT status, district
FROM public.locations;

-- Views run with the querying role's privileges by default, so RLS on the
-- underlying table would still block anon here — security_invoker off
-- (the default) makes the view run as its owner instead, which is what
-- lets this narrow view work without touching locations' RLS at all.
ALTER VIEW public.public_location_stats SET (security_invoker = off);

GRANT SELECT ON public.public_location_stats TO anon;
