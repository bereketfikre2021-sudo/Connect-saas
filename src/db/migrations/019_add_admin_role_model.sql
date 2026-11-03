-- ===========================================================================
-- Migration 019: Add admin role model (additive, non-breaking)
-- ===========================================================================
-- PENDING REVIEW — NOT YET APPLIED. Do not run until the implementation plan
-- (.agents/tasks/rls-migration-review/IMPLEMENTATION_PLAN.md) is approved.
--
-- Purpose:
--   Introduce a role lookup table + SECURITY DEFINER helper functions so that
--   admin authorization can move from a hardcoded user UUID to a grant-based
--   model. This migration is purely ADDITIVE: it creates new objects and seeds
--   the existing admin, but it changes NO existing RLS policy. After 019 the
--   app continues to work exactly as before on the old UUID policies until
--   migration 020 performs the cutover.
--
-- Run order: AFTER 018. Idempotent (uses IF NOT EXISTS / OR REPLACE).
-- Run as:    the `postgres` / service role (SQL editor), so that the SECURITY
--            DEFINER functions are owned by a role that bypasses RLS.
--
-- Decision (Finding A): seed ONLY the confirmed admin UUID
--   9705a671-4d69-49bb-b5f9-7f69cad4f0f8
-- Do NOT seed 1decbf78-8c5e-470a-afdc-b310b317d4b1. That UUID's identity is
-- unconfirmed; its existing activity-log policy is preserved by leaving it
-- out of migration 020. See the read-only investigation queries
-- (verification_and_investigation_queries.sql) to establish its identity.
-- ===========================================================================

-- ── 1. Role table ───────────────────────────────────────────────────────────
-- One row per admin user. RLS is intentionally NOT enabled on this table: with
-- no row policies there is nothing for a policy to recurse into, which removes
-- the classic Supabase infinite-recursion trap. Access is controlled purely by
-- table privileges (REVOKE below) + the SECURITY DEFINER functions.
CREATE TABLE IF NOT EXISTS public.agency_admin_users (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Lock the table down: no client role may read or write it directly. The only
-- access path is the SECURITY DEFINER functions below (which run as the owner,
-- `postgres`, bypassing RLS and these privilege revokes).
REVOKE ALL ON public.agency_admin_users FROM anon;
REVOKE ALL ON public.agency_admin_users FROM authenticated;
REVOKE ALL ON public.agency_admin_users FROM PUBLIC;

-- ── 2. Lookup functions (used by RLS policies in migration 020) ─────────────
-- SECURITY DEFINER + owner `postgres` => the inner SELECT runs with RLS
-- bypassed, so reading agency_admin_users inside these functions does NOT
-- trigger RLS on agency_admin_users (there are no policies there anyway).
-- search_path is locked to public, pg_temp to prevent schema hijacking.
-- auth.uid() inside a SECURITY DEFINER function still returns the SESSION user
-- (the real caller), so is_admin() checks the correct user.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_admin_users
    WHERE user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Forward-compatible helper for multi-role expansion (only 'admin' exists
-- today). Policies in 020 use is_admin(); has_role() is provided for future use.
CREATE OR REPLACE FUNCTION public.has_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_admin_users
    WHERE user_id = auth.uid() AND role = p_role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_role(text) TO authenticated;

-- ── 3. Grant / revoke RPCs (the only write path into the role table) ─────────
-- Both are guarded by is_admin(), so only an EXISTING admin can grant or
-- revoke. A new SSO user is therefore NEVER granted admin automatically; they
-- must be granted explicitly by an existing admin (or a one-time operator
-- bootstrap INSERT — see plan §6.4). auth.uid() resolves to the caller here.

CREATE OR REPLACE FUNCTION public.grant_admin(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  INSERT INTO public.agency_admin_users (user_id, role, granted_by)
  VALUES (p_user_id, 'admin', auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_admin(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.grant_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_admin(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  DELETE FROM public.agency_admin_users
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_admin(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.revoke_admin(uuid) TO authenticated;

-- ── 4. Seed the confirmed existing admin ────────────────────────────────────
-- The seed is conditional: it only inserts if the UUID actually exists in
-- auth.users. If the UUID is not found (wrong project, test environment, etc.)
-- the migration still succeeds — the table and functions are created — and you
-- seed manually once you have confirmed the correct UUID (see step 4b below).
--
-- WHY THE FK FAILED: the REFERENCES auth.users(id) constraint is hard. If you
-- see "violates foreign key constraint", this Supabase project does not have
-- that UUID in auth.users. Confirm the real admin UUID first:
--
--   SELECT id, email FROM auth.users ORDER BY created_at;
--
-- Then seed with the correct UUID (replace both occurrences below):
--
--   INSERT INTO public.agency_admin_users (user_id, role, granted_by)
--   VALUES ('<real-uuid>'::uuid, 'admin', '<real-uuid>'::uuid)
--   ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid
  ) THEN
    INSERT INTO public.agency_admin_users (user_id, role, granted_by)
    VALUES (
      '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid,
      'admin',
      '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid
    )
    ON CONFLICT (user_id) DO NOTHING;
    RAISE NOTICE 'Admin seeded: 9705a671-4d69-49bb-b5f9-7f69cad4f0f8';
  ELSE
    RAISE WARNING
      'UUID 9705a671-4d69-49bb-b5f9-7f69cad4f0f8 not found in auth.users. '
      'Migration 019 succeeded but no admin was seeded. '
      'Run: SELECT id, email FROM auth.users ORDER BY created_at; '
      'then INSERT into public.agency_admin_users manually before running 020.';
  END IF;
END $$;

-- ── 5. Post-conditions note ─────────────────────────────────────────────────
-- Table and functions are created regardless of the seed outcome.
-- If the NOTICE above shows "not found", seed manually before running 020 —
-- otherwise is_admin() returns false for everyone and 020 will lock out the
-- admin the moment policies switch.
-- 1decbf78... is deliberately NOT seeded (Finding A — unconfirmed identity).
