-- Migration 005, run after 004
-- Creates the agency_contracts table for Phase 2
-- UNIQUE on proposal_id ensures one contract per accepted proposal.

CREATE TABLE IF NOT EXISTS agency_contracts (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid        NOT NULL REFERENCES agency_proposals(id) ON DELETE RESTRICT UNIQUE,
  client_id   uuid        NOT NULL REFERENCES agency_clients(id) ON DELETE RESTRICT,
  content     jsonb       NOT NULL,
  status      text        NOT NULL DEFAULT 'Draft'
                CHECK (status IN ('Draft','Active')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS agency_contracts_client_id_idx   ON agency_contracts (client_id);
CREATE INDEX IF NOT EXISTS agency_contracts_proposal_id_idx ON agency_contracts (proposal_id);

-- Row Level Security
ALTER TABLE agency_contracts ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT
CREATE POLICY "admin_select_contracts"
  ON agency_contracts FOR SELECT
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- Admin-only INSERT
CREATE POLICY "admin_insert_contracts"
  ON agency_contracts FOR INSERT
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- Admin-only UPDATE
CREATE POLICY "admin_update_contracts"
  ON agency_contracts FOR UPDATE
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid)
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- Admin-only DELETE
CREATE POLICY "admin_delete_contracts"
  ON agency_contracts FOR DELETE
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- updated_at trigger reusing the existing trigger function from Phase 1
CREATE TRIGGER agency_contracts_updated_at
  BEFORE UPDATE ON agency_contracts
  FOR EACH ROW EXECUTE FUNCTION agency_handle_updated_at();
