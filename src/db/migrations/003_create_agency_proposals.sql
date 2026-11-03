-- Migration 003, run after 002
-- Creates the agency_proposals table for Phase 2

CREATE TABLE IF NOT EXISTS agency_proposals (
  id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid         NOT NULL REFERENCES agency_clients(id) ON DELETE RESTRICT,
  title         text         NOT NULL,
  introduction  text,
  deliverables  text,
  terms         text,
  items         jsonb        NOT NULL DEFAULT '[]'::jsonb,
  total_amount  numeric(14,2) NOT NULL DEFAULT 0,
  currency      text         NOT NULL DEFAULT 'ETB',
  expiry_date   date,
  status        text         NOT NULL DEFAULT 'Draft'
                  CHECK (status IN ('Draft','Sent','Accepted','Changes Requested','Rejected')),
  portal_token  text         NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32),'hex'),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS agency_proposals_client_id_idx   ON agency_proposals (client_id);
CREATE INDEX IF NOT EXISTS agency_proposals_status_idx      ON agency_proposals (status);
CREATE INDEX IF NOT EXISTS agency_proposals_portal_token_idx ON agency_proposals (portal_token);

-- Row Level Security
ALTER TABLE agency_proposals ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT
CREATE POLICY "admin_select_proposals"
  ON agency_proposals FOR SELECT TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- Admin-only INSERT
CREATE POLICY "admin_insert_proposals"
  ON agency_proposals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- Admin-only UPDATE
CREATE POLICY "admin_update_proposals"
  ON agency_proposals FOR UPDATE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid)
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- Admin-only DELETE
CREATE POLICY "admin_delete_proposals"
  ON agency_proposals FOR DELETE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- updated_at trigger reusing the existing trigger function from Phase 1
CREATE TRIGGER agency_proposals_updated_at
  BEFORE UPDATE ON agency_proposals
  FOR EACH ROW EXECUTE FUNCTION agency_handle_updated_at();
