-- Grants qc_inspector access to the installation-media storage bucket.
--
-- The site installation report (photos + 3 signatures) moved from
-- Field Agent to QC Inspector today (app/agent/install → app/qc/install).
-- The bucket's original RLS policies were created live in the SQL Editor
-- (never committed to this repo, same as cwsn_schools before it) and, per
-- the original setup.sql pattern this project has followed elsewhere,
-- were almost certainly scoped to bucket_id = 'installation-media' AND
-- current_user_role() = 'field_agent' only — meaning QC Inspector uploads
-- would fail silently at runtime (TypeScript can't catch an RLS mismatch).
--
-- Deliberately NOT touching/dropping whatever the existing field_agent
-- policy is called — unknown name, and guessing wrong risks a silent
-- no-op same as the cwsn_schools policy-cleanup guess earlier. Multiple
-- permissive policies on the same table/operation OR together in
-- Postgres RLS, so this only ever adds access, never removes any.
--
-- Run this, then confirm by actually uploading a photo as a qc_inspector
-- test account — that's the only way to be certain, since none of this is
-- visible to tsc/build.

DROP POLICY IF EXISTS "qc_upload_installation_media" ON storage.objects;
CREATE POLICY "qc_upload_installation_media"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'installation-media'
    AND current_user_role() = 'qc_inspector'
  );

DROP POLICY IF EXISTS "qc_read_installation_media" ON storage.objects;
CREATE POLICY "qc_read_installation_media"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'installation-media'
    AND current_user_role() = 'qc_inspector'
  );
