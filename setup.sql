-- =============================================================================
-- Rajasthan Special Needs Infrastructure Survey System
-- Database Setup SQL
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================================


-- =============================================================================
-- SECTION 1: HELPER FUNCTION — Role detection
-- =============================================================================
-- Roles are stored in app_metadata (set server-side via service role key only).
-- app_metadata cannot be modified by the user, unlike user_metadata.
-- Set a user's role via: supabase.auth.admin.updateUserById(userId, { app_metadata: { role: 'field_agent' } })

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'user_metadata' ->> 'role')
  )
$$;


-- =============================================================================
-- SECTION 2: TABLES
-- Created in dependency order (referenced tables first)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Table 1: manufacturing_units
-- Must be created before `locations` (locations.assigned_unit_id references it)
-- -----------------------------------------------------------------------------
CREATE TABLE public.manufacturing_units (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,                    -- e.g. "Unit A — Jaipur"
  district        text,
  contact_name    text,
  contact_phone   text,
  user_id         uuid        REFERENCES auth.users(id),
  is_active       boolean     DEFAULT true
);


-- -----------------------------------------------------------------------------
-- Table 2: locations
-- Core table — referenced by surveys, production_jobs, qc_inspections,
-- payment_contracts, installation_reports
-- -----------------------------------------------------------------------------
CREATE TABLE public.locations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code     text        UNIQUE NOT NULL,            -- RJ-0001 to RJ-1250
  name              text,
  district          text,
  block             text,
  village           text,
  address           text,
  latitude          float,
  longitude         float,
  assigned_agent    uuid        REFERENCES auth.users(id),
  assigned_unit_id  uuid        REFERENCES public.manufacturing_units(id),
  status            text        DEFAULT 'pending'
                                CHECK (status IN (
                                  'pending', 'surveyed', 'assigned', 'in_production',
                                  'qc_failed', 'qc_passed', 'dispatched', 'delivered',
                                  'installed', 'verified', 'closed'
                                )),
  created_at        timestamptz DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- Table 3: surveys
-- Phase 1 data — referenced by production_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE public.surveys (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid        REFERENCES public.locations(id),
  agent_id              uuid        REFERENCES auth.users(id),
  submitted_at          timestamptz DEFAULT now(),
  synced_at             timestamptz,                        -- null if still offline

  -- GPS
  gps_lat               float,
  gps_lng               float,
  gps_accuracy          float,                              -- accuracy in metres

  -- Infrastructure checklist
  toilet_present        boolean,
  toilet_condition      text        CHECK (toilet_condition IN ('good', 'damaged', 'missing')),
  ramp_present          boolean,
  ramp_condition        text        CHECK (ramp_condition IN ('good', 'damaged', 'missing')),
  hardware_condition    text        CHECK (hardware_condition IN ('good', 'damaged', 'missing')),
  notes                 text,

  -- Material quantities required
  qty_tiles             integer,                            -- in square feet
  qty_toilet_units      integer,
  qty_ramp_units        integer,
  qty_fittings          integer,
  qty_other             jsonb,                              -- for any other material types

  -- Media (Supabase Storage paths, not URLs)
  photos                text[]      DEFAULT '{}',
  videos                text[]      DEFAULT '{}',

  is_offline_submission boolean     DEFAULT false
);


-- -----------------------------------------------------------------------------
-- Table 4: production_jobs
-- Phase 3 data — referenced by qc_inspections
-- -----------------------------------------------------------------------------
CREATE TABLE public.production_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid        REFERENCES public.locations(id),
  survey_id        uuid        REFERENCES public.surveys(id),
  unit_id          uuid        REFERENCES public.manufacturing_units(id),
  assigned_by      uuid        REFERENCES auth.users(id),
  assigned_at      timestamptz DEFAULT now(),

  -- Quantities to produce (copied from survey at time of assignment)
  qty_tiles        integer,
  qty_toilet_units integer,
  qty_ramp_units   integer,
  qty_fittings     integer,
  qty_other        jsonb,

  -- Progress
  progress_pct     integer     DEFAULT 0
                               CHECK (progress_pct >= 0 AND progress_pct <= 100),
  status           text        DEFAULT 'pending'
                               CHECK (status IN (
                                 'pending', 'in_production', 'complete',
                                 'qc_passed', 'qc_failed', 'dispatched'
                               )),
  production_notes text,
  completed_at     timestamptz,
  dispatched_at    timestamptz
);


-- -----------------------------------------------------------------------------
-- Table 5: qc_inspections
-- Phase 4 data
-- -----------------------------------------------------------------------------
CREATE TABLE public.qc_inspections (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  production_job_id       uuid        REFERENCES public.production_jobs(id),
  location_id             uuid        REFERENCES public.locations(id),
  inspector_id            uuid        REFERENCES auth.users(id),
  inspected_at            timestamptz DEFAULT now(),
  inspection_number       integer     DEFAULT 1,            -- increments on each re-inspection

  -- Checklist
  qty_correct             boolean,
  qty_notes               text,
  dimensions_correct      boolean,
  dimensions_notes        text,
  finish_quality_pass     boolean,
  finish_notes            text,
  defects_present         boolean,
  defects_description     text,
  overall_notes           text,

  -- Result
  result                  text        CHECK (result IN ('passed', 'failed')),
  photos                  text[]      DEFAULT '{}',         -- Supabase Storage paths

  -- Signature (drawn on screen with finger)
  inspector_signature_url text,                             -- URL to PNG in Supabase Storage
  inspector_name          text,

  -- PDF (auto-generated on submission)
  pdf_url                 text,                             -- URL to PDF in bucket `reports`

  -- Rework (only populated if failed)
  rework_required         boolean     DEFAULT false,
  rework_deadline         date
);


-- -----------------------------------------------------------------------------
-- Table 6: payment_contracts
-- Phase 5 — referenced by payment_tranches
-- -----------------------------------------------------------------------------
CREATE TABLE public.payment_contracts (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name        text          NOT NULL,
  location_id          uuid          REFERENCES public.locations(id), -- null = multi-location contract
  total_contract_value numeric(12,2) NOT NULL,
  currency             text          DEFAULT 'INR',
  created_by           uuid          REFERENCES auth.users(id),
  created_at           timestamptz   DEFAULT now(),
  notes                text
);


-- -----------------------------------------------------------------------------
-- Table 7: payment_tranches
-- Phase 5 — 4 tranches per contract
-- -----------------------------------------------------------------------------
CREATE TABLE public.payment_tranches (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       uuid          REFERENCES public.payment_contracts(id),
  tranche_name      text          NOT NULL
                                  CHECK (tranche_name IN (
                                    'Advance', 'On QC Pass', 'On Delivery', 'On Verification'
                                  )),
  trigger_milestone text          NOT NULL
                                  CHECK (trigger_milestone IN (
                                    'manual', 'qc_passed', 'delivered', 'verified'
                                  )),
  percentage        numeric(5,2)  NOT NULL,                -- e.g. 30.00
  amount            numeric(12,2) NOT NULL,                -- calculated from contract total
  status            text          DEFAULT 'locked'
                                  CHECK (status IN ('locked', 'unlocked', 'released')),
  unlocked_at       timestamptz,
  released_at       timestamptz,
  released_by       uuid          REFERENCES auth.users(id),
  payment_reference text,                                  -- NEFT/cheque/transfer ref
  notes             text
);


-- -----------------------------------------------------------------------------
-- Table 8: installation_reports
-- Phase 6 — delivery confirmation + installation + verification
-- -----------------------------------------------------------------------------
CREATE TABLE public.installation_reports (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          uuid        REFERENCES public.locations(id),
  agent_id             uuid        REFERENCES auth.users(id),
  submitted_at         timestamptz DEFAULT now(),
  gps_lat              float,
  gps_lng              float,

  -- Phase 6a: Delivery confirmation
  goods_received_at    timestamptz,
  goods_received_by    uuid        REFERENCES auth.users(id),
  delivery_confirmed   boolean     DEFAULT false,

  -- Phase 6b: Installation checklist
  toilet_installed     boolean,
  ramp_installed       boolean,
  hardware_installed   boolean,
  installation_notes   text,
  photos               text[]      DEFAULT '{}',           -- Supabase Storage paths

  -- Signature (supervisor signs on screen)
  signature_data_url   text,                               -- base64 PNG or Storage URL
  signed_by_name       text,
  signed_by_designation text,

  -- PDF (auto-generated on submission)
  pdf_url              text,

  -- Phase 6c: Verification
  status               text        DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_by          uuid        REFERENCES auth.users(id),
  verified_at          timestamptz,
  verifier_notes       text,
  rejection_reason     text
);


-- =============================================================================
-- SECTION 3: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =============================================================================

ALTER TABLE public.manufacturing_units  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_inspections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_contracts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_tranches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_reports ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 4: RLS POLICIES
-- One policy block per table, one policy per role per operation.
-- Multiple SELECT policies on the same table are OR'd by Postgres.
-- All status/complex updates are done server-side via service role (bypasses RLS).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- manufacturing_units policies
-- manufacturing_unit: SELECT own unit only
-- admin: full access
-- (All other roles: no access — they get unit names via server-side joins)
-- -----------------------------------------------------------------------------

CREATE POLICY "mu_select_own_unit"
  ON public.manufacturing_units
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'manufacturing_unit'
    AND user_id = auth.uid()
  );

CREATE POLICY "admin_all_manufacturing_units"
  ON public.manufacturing_units
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- -----------------------------------------------------------------------------
-- locations policies
-- field_agent:         SELECT own assigned locations only
-- manufacturing_unit:  SELECT assigned to own unit only
-- qc_inspector:        SELECT all (read only)
-- verifier:            SELECT all (read only)
-- admin:               full access
-- -----------------------------------------------------------------------------

CREATE POLICY "fa_select_own_locations"
  ON public.locations
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'field_agent'
    AND assigned_agent = auth.uid()
  );

CREATE POLICY "mu_select_assigned_locations"
  ON public.locations
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'manufacturing_unit'
    AND assigned_unit_id = (
      SELECT id FROM public.manufacturing_units
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "qc_select_all_locations"
  ON public.locations
  FOR SELECT TO authenticated
  USING (current_user_role() = 'qc_inspector');

CREATE POLICY "verifier_select_all_locations"
  ON public.locations
  FOR SELECT TO authenticated
  USING (current_user_role() = 'verifier');

CREATE POLICY "admin_all_locations"
  ON public.locations
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- -----------------------------------------------------------------------------
-- surveys policies
-- field_agent: INSERT own records on own assigned locations only
--              SELECT own records only
-- admin:       full access
-- (All other roles: no direct access)
-- -----------------------------------------------------------------------------

CREATE POLICY "fa_insert_surveys"
  ON public.surveys
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() = 'field_agent'
    AND agent_id = auth.uid()
    AND location_id IN (
      SELECT id FROM public.locations
      WHERE assigned_agent = auth.uid()
    )
  );

CREATE POLICY "fa_select_own_surveys"
  ON public.surveys
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'field_agent'
    AND agent_id = auth.uid()
  );

CREATE POLICY "admin_all_surveys"
  ON public.surveys
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- -----------------------------------------------------------------------------
-- production_jobs policies
-- manufacturing_unit: SELECT/UPDATE own unit's jobs only
-- qc_inspector:       SELECT where status = 'complete' only
-- admin:              full access
-- (All other roles: no access)
-- Note: status transitions (qc_passed, qc_failed, dispatched, etc.) are done
--       server-side via the service role admin client — not directly by users.
-- -----------------------------------------------------------------------------

CREATE POLICY "mu_select_own_jobs"
  ON public.production_jobs
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'manufacturing_unit'
    AND unit_id = (
      SELECT id FROM public.manufacturing_units
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "mu_update_own_jobs"
  ON public.production_jobs
  FOR UPDATE TO authenticated
  USING (
    current_user_role() = 'manufacturing_unit'
    AND unit_id = (
      SELECT id FROM public.manufacturing_units
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  )
  WITH CHECK (
    current_user_role() = 'manufacturing_unit'
    AND unit_id = (
      SELECT id FROM public.manufacturing_units
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "qc_select_complete_jobs"
  ON public.production_jobs
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'qc_inspector'
    AND status = 'complete'
  );

CREATE POLICY "admin_all_production_jobs"
  ON public.production_jobs
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- -----------------------------------------------------------------------------
-- qc_inspections policies
-- qc_inspector: INSERT own inspection records
--               SELECT all (they can view any inspection)
-- admin:        full access
-- (All other roles: no access)
-- Note: qc_inspectors only INSERT new records — never UPDATE existing ones.
--       Updates to production_jobs/locations after QC are done server-side.
-- -----------------------------------------------------------------------------

CREATE POLICY "qc_insert_inspections"
  ON public.qc_inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() = 'qc_inspector'
    AND inspector_id = auth.uid()
  );

CREATE POLICY "qc_select_all_inspections"
  ON public.qc_inspections
  FOR SELECT TO authenticated
  USING (current_user_role() = 'qc_inspector');

CREATE POLICY "admin_all_qc_inspections"
  ON public.qc_inspections
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- -----------------------------------------------------------------------------
-- payment_contracts policies
-- admin only — no other role has any access
-- -----------------------------------------------------------------------------

CREATE POLICY "admin_all_payment_contracts"
  ON public.payment_contracts
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- -----------------------------------------------------------------------------
-- payment_tranches policies
-- admin only — verifier explicitly has NO access (per CLAUDE.md spec)
-- -----------------------------------------------------------------------------

CREATE POLICY "admin_all_payment_tranches"
  ON public.payment_tranches
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- -----------------------------------------------------------------------------
-- installation_reports policies
-- field_agent: INSERT own records on own assigned locations
--              SELECT own records
--              UPDATE own records (needed: Phase 6a inserts the record,
--                Phase 6b updates the same record with installation data)
-- verifier:    SELECT all
--              UPDATE all (column-level restriction enforced at API layer:
--                only status, verified_by, verified_at, verifier_notes,
--                rejection_reason may be changed)
-- admin:       full access
-- -----------------------------------------------------------------------------

CREATE POLICY "fa_insert_installation_reports"
  ON public.installation_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() = 'field_agent'
    AND agent_id = auth.uid()
    AND location_id IN (
      SELECT id FROM public.locations
      WHERE assigned_agent = auth.uid()
    )
  );

CREATE POLICY "fa_select_own_installation_reports"
  ON public.installation_reports
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'field_agent'
    AND agent_id = auth.uid()
  );

CREATE POLICY "fa_update_own_installation_reports"
  ON public.installation_reports
  FOR UPDATE TO authenticated
  USING (
    current_user_role() = 'field_agent'
    AND agent_id = auth.uid()
  )
  WITH CHECK (
    current_user_role() = 'field_agent'
    AND agent_id = auth.uid()
  );

CREATE POLICY "verifier_select_all_installation_reports"
  ON public.installation_reports
  FOR SELECT TO authenticated
  USING (current_user_role() = 'verifier');

CREATE POLICY "verifier_update_installation_reports"
  ON public.installation_reports
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'verifier')
  WITH CHECK (current_user_role() = 'verifier');

CREATE POLICY "admin_all_installation_reports"
  ON public.installation_reports
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- =============================================================================
-- SECTION 5: STORAGE BUCKETS
-- Run after tables. Creates the 4 buckets needed for file uploads.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'survey-media',
    'survey-media',
    false,
    52428800,   -- 50MB (videos up to 50MB)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
  ),
  (
    'qc-inspections',
    'qc-inspections',
    false,
    5242880,    -- 5MB (photos only, post-compression)
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'installation-media',
    'installation-media',
    false,
    5242880,    -- 5MB (photos only)
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'reports',
    'reports',
    false,
    10485760,   -- 10MB (PDFs + signature PNGs)
    ARRAY['application/pdf', 'image/png']
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- SECTION 6: STORAGE BUCKET RLS POLICIES
-- Authenticated users can upload to buckets their role permits.
-- Service role (admin client) has full access regardless.
-- =============================================================================

-- survey-media: field_agents upload, admin reads all
CREATE POLICY "fa_upload_survey_media"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'survey-media'
    AND current_user_role() = 'field_agent'
  );

CREATE POLICY "fa_read_own_survey_media"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'survey-media'
    AND current_user_role() IN ('field_agent', 'admin')
  );

-- qc-inspections: qc_inspectors upload, admin reads all
CREATE POLICY "qc_upload_inspection_media"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'qc-inspections'
    AND current_user_role() = 'qc_inspector'
  );

CREATE POLICY "qc_read_inspection_media"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'qc-inspections'
    AND current_user_role() IN ('qc_inspector', 'admin')
  );

-- installation-media: field_agents upload, verifiers + admin read
CREATE POLICY "fa_upload_installation_media"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'installation-media'
    AND current_user_role() = 'field_agent'
  );

CREATE POLICY "fa_read_installation_media"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'installation-media'
    AND current_user_role() IN ('field_agent', 'verifier', 'admin')
  );

-- reports (PDFs + signatures): uploaded by server (service role), read by relevant roles
CREATE POLICY "read_reports"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reports'
    AND current_user_role() IN ('qc_inspector', 'verifier', 'admin', 'field_agent')
  );


-- =============================================================================
-- SECTION 7: USEFUL INDEXES
-- =============================================================================

CREATE INDEX idx_locations_status         ON public.locations (status);
CREATE INDEX idx_locations_district       ON public.locations (district);
CREATE INDEX idx_locations_assigned_agent ON public.locations (assigned_agent);
CREATE INDEX idx_locations_assigned_unit  ON public.locations (assigned_unit_id);
CREATE INDEX idx_locations_code           ON public.locations (location_code);

CREATE INDEX idx_surveys_location         ON public.surveys (location_id);
CREATE INDEX idx_surveys_agent            ON public.surveys (agent_id);

CREATE INDEX idx_production_jobs_unit     ON public.production_jobs (unit_id);
CREATE INDEX idx_production_jobs_location ON public.production_jobs (location_id);
CREATE INDEX idx_production_jobs_status   ON public.production_jobs (status);

CREATE INDEX idx_qc_inspections_job       ON public.qc_inspections (production_job_id);
CREATE INDEX idx_qc_inspections_location  ON public.qc_inspections (location_id);
CREATE INDEX idx_qc_inspections_result    ON public.qc_inspections (result);

CREATE INDEX idx_payment_tranches_contract  ON public.payment_tranches (contract_id);
CREATE INDEX idx_payment_tranches_status    ON public.payment_tranches (status);
CREATE INDEX idx_payment_tranches_milestone ON public.payment_tranches (trigger_milestone);

CREATE INDEX idx_installation_reports_location ON public.installation_reports (location_id);
CREATE INDEX idx_installation_reports_agent    ON public.installation_reports (agent_id);
CREATE INDEX idx_installation_reports_status   ON public.installation_reports (status);
