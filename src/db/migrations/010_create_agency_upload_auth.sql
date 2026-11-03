-- Migration 010: Create agency_upload_authorizations table and validation function
-- Run after migration 009. Additive — does not modify existing tables.

-- pgcrypto is required for gen_random_bytes() used in the upload token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agency_upload_authorizations (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_token text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32),'hex'),
  invoice_id   uuid        NOT NULL REFERENCES agency_invoices(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  is_used      boolean     NOT NULL DEFAULT false,
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_upload_authorizations_token_idx ON agency_upload_authorizations(upload_token);

ALTER TABLE agency_upload_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_upload_auths"
  ON agency_upload_authorizations FOR SELECT TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
-- No INSERT/UPDATE/DELETE policies — all writes through RPC functions.

-- ── Validation function for storage policy ─────────────────────────────────
-- Called by the storage INSERT policy to validate the upload token in real-time.
CREATE OR REPLACE FUNCTION public.is_valid_upload_token(p_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1 FROM agency_upload_authorizations
    WHERE upload_token = p_token
    AND is_used = false
    AND expires_at > now()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_valid_upload_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_upload_token(text) TO anon;
