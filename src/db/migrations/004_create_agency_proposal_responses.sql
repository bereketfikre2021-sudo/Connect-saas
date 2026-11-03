-- Migration 004, run after 003
-- Creates the agency_proposal_responses table for Phase 2
-- UNIQUE on proposal_id enforces one response per proposal at the DB level.
-- No direct INSERT/UPDATE/DELETE policies for any role — all writes go through
-- the security-definer RPC defined in migration 006.

CREATE TABLE IF NOT EXISTS agency_proposal_responses (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id  uuid        NOT NULL REFERENCES agency_proposals(id) ON DELETE CASCADE UNIQUE,
  action       text        NOT NULL
                 CHECK (action IN ('Accepted','Changes Requested','Rejected')),
  comment      text,
  responded_at timestamptz NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE agency_proposal_responses ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT
CREATE POLICY "admin_select_proposal_responses"
  ON agency_proposal_responses FOR SELECT TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- Admin-only DELETE (allows admin to clear a response if a client needs to re-respond)
CREATE POLICY "admin_delete_proposal_responses"
  ON agency_proposal_responses FOR DELETE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- No INSERT / UPDATE policies for any role.
-- All writes are performed by the security-definer function
-- submit_proposal_response() defined in migration 006.
