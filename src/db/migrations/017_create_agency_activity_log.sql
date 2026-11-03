-- Migration 017: Activity log
-- Additive. Run after 016.

CREATE TABLE IF NOT EXISTS agency_activity_log (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text        NOT NULL, -- 'proposal','invoice','payment','task','creative','client','project'
  entity_id   uuid        NOT NULL,
  action      text        NOT NULL, -- e.g. 'created','status_changed','approved','sent'
  detail      text,                 -- human-readable detail
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_activity_log_entity_idx  ON agency_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS agency_activity_log_created_idx ON agency_activity_log(created_at DESC);

ALTER TABLE agency_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_activity" ON agency_activity_log FOR SELECT TO authenticated USING (auth.uid()='1decbf78-8c5e-470a-afdc-b310b317d4b1'::uuid);
CREATE POLICY "admin_insert_activity" ON agency_activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid()='1decbf78-8c5e-470a-afdc-b310b317d4b1'::uuid);
