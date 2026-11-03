-- Migration 007: Create agency_portal_tokens table
-- Client-level portal tokens with revocation support.
-- Run after migrations 001-006. Additive — does not modify existing tables.

CREATE TABLE IF NOT EXISTS agency_portal_tokens (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32),'hex'),
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

CREATE INDEX IF NOT EXISTS agency_portal_tokens_client_id_idx ON agency_portal_tokens(client_id);
CREATE INDEX IF NOT EXISTS agency_portal_tokens_token_idx ON agency_portal_tokens(token);

ALTER TABLE agency_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_portal_tokens"
  ON agency_portal_tokens FOR SELECT TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

CREATE POLICY "admin_insert_portal_tokens"
  ON agency_portal_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

CREATE POLICY "admin_update_portal_tokens"
  ON agency_portal_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid)
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

CREATE POLICY "admin_delete_portal_tokens"
  ON agency_portal_tokens FOR DELETE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
