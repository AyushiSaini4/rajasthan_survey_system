-- =============================================================================
-- Migration: self-service signup for field_agent, manufacturing_unit,
-- and qc_inspector roles.
--
-- Previously the only way to get app_metadata.role set on an account was:
--   (a) manually via supabase.auth.admin.updateUserById (SQL editor), or
--   (b) the admin-only "Add Unit" / "Add QC Inspector" forms
-- app.metadata is intentionally NOT client-writable (by design — see the
-- comment at the top of setup.sql), so /signup's plain
-- supabase.auth.signUp() call has never actually assigned a role to
-- anyone. It happened to work in testing only because a role was set by
-- hand afterward every time.
--
-- Fix: a signup can request a role via user_metadata (which IS client-
-- writable — supabase.auth.signUp({ options: { data: {...} } })), and a
-- BEFORE INSERT trigger validates + copies that request into
-- app_metadata.role server-side. Only 'field_agent', 'manufacturing_unit',
-- and 'qc_inspector' are accepted this way — 'admin' can never be
-- self-assigned, protecting against a browser client just requesting
-- admin.
--
-- manufacturing_unit signups also get a minimal manufacturing_units row
-- auto-created (name/district/contact from user_metadata, defaults if
-- blank) so their dashboard has something to resolve to immediately —
-- they can be edited later from /admin/units same as any other unit.
-- =============================================================================

-- ── 1. Role assignment (BEFORE INSERT — modifies NEW directly) ─────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested text := NEW.raw_user_meta_data ->> 'requested_role';
BEGIN
  IF requested IN ('field_agent', 'manufacturing_unit', 'qc_inspector') THEN
    NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', requested);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_set_role ON auth.users;
CREATE TRIGGER on_auth_user_created_set_role
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- ── 2. Auto-create manufacturing_units row (AFTER INSERT — auth.users row  ────
--       must exist first to satisfy the user_id foreign key) ──────────────────

CREATE OR REPLACE FUNCTION public.handle_new_unit_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested text := NEW.raw_user_meta_data ->> 'requested_role';
BEGIN
  IF requested = 'manufacturing_unit' THEN
    INSERT INTO public.manufacturing_units (name, district, contact_name, contact_phone, is_active, user_id)
    VALUES (
      COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'unit_name', ''), split_part(NEW.email, '@', 1)),
      NULLIF(NEW.raw_user_meta_data ->> 'unit_district', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'unit_contact_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'unit_contact_phone', ''),
      true,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_unit_signup ON auth.users;
CREATE TRIGGER on_auth_user_created_unit_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_unit_signup();
