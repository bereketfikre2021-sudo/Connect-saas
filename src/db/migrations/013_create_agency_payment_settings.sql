-- Migration 013: Create agency_payment_settings table
-- Additive — does not modify any existing tables.
-- Run after migrations 001-012.

CREATE TABLE IF NOT EXISTS agency_payment_settings (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  method_name      text        NOT NULL,          -- e.g. CBE, Telebirr, Bank Transfer, Cash, Other
  bank_name        text,                           -- e.g. Commercial Bank of Ethiopia
  account_holder   text        NOT NULL DEFAULT '',
  account_number   text        NOT NULL DEFAULT '',
  telebirr_phone   text        NOT NULL DEFAULT '',
  instructions     text,                           -- optional instructions shown to client
  is_enabled       boolean     NOT NULL DEFAULT true,
  sort_order       integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_payment_settings_enabled_idx
  ON agency_payment_settings(is_enabled);

ALTER TABLE agency_payment_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "admin_select_payment_settings"
  ON agency_payment_settings FOR SELECT TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

CREATE POLICY "admin_insert_payment_settings"
  ON agency_payment_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

CREATE POLICY "admin_update_payment_settings"
  ON agency_payment_settings FOR UPDATE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid)
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

CREATE POLICY "admin_delete_payment_settings"
  ON agency_payment_settings FOR DELETE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- Reuse existing trigger function for updated_at
CREATE TRIGGER agency_payment_settings_updated_at
  BEFORE UPDATE ON agency_payment_settings
  FOR EACH ROW EXECUTE FUNCTION agency_handle_updated_at();

-- Public read function — returns only enabled payment methods for the client portal.
-- SECURITY DEFINER so anon can call it without table access.
CREATE OR REPLACE FUNCTION public.get_payment_settings()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',            id,
        'method_name',   method_name,
        'bank_name',     bank_name,
        'account_holder', account_holder,
        'account_number', account_number,
        'telebirr_phone', telebirr_phone,
        'instructions',  instructions
      )
      ORDER BY sort_order, created_at
    ),
    '[]'::jsonb
  )
  FROM agency_payment_settings
  WHERE is_enabled = true;
$$;

REVOKE EXECUTE ON FUNCTION public.get_payment_settings() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_payment_settings() TO anon, authenticated;
