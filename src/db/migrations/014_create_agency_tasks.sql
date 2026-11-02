-- Migration 014: Tasks and Milestones
-- Additive. Run after 013.

CREATE TABLE IF NOT EXISTS agency_tasks (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid        REFERENCES agency_projects(id) ON DELETE CASCADE,
  client_id   uuid        REFERENCES agency_clients(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  priority    text        NOT NULL DEFAULT 'Medium'
                CHECK (priority IN ('Low','Medium','High','Urgent')),
  status      text        NOT NULL DEFAULT 'To Do'
                CHECK (status IN ('To Do','In Progress','Review','Completed')),
  start_date  date,
  due_date    date,
  is_archived boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_tasks_project_id_idx ON agency_tasks(project_id);
CREATE INDEX IF NOT EXISTS agency_tasks_client_id_idx  ON agency_tasks(client_id);
CREATE INDEX IF NOT EXISTS agency_tasks_status_idx     ON agency_tasks(status);

ALTER TABLE agency_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_tasks" ON agency_tasks FOR SELECT TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_insert_tasks" ON agency_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_update_tasks" ON agency_tasks FOR UPDATE TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid) WITH CHECK (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_delete_tasks" ON agency_tasks FOR DELETE TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

CREATE TRIGGER agency_tasks_updated_at
  BEFORE UPDATE ON agency_tasks
  FOR EACH ROW EXECUTE FUNCTION agency_handle_updated_at();

-- Milestones
CREATE TABLE IF NOT EXISTS agency_milestones (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid        NOT NULL REFERENCES agency_projects(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  due_date    date,
  status      text        NOT NULL DEFAULT 'Upcoming'
                CHECK (status IN ('Upcoming','In Progress','Completed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_milestones_project_id_idx ON agency_milestones(project_id);

ALTER TABLE agency_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_milestones" ON agency_milestones FOR SELECT TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_insert_milestones" ON agency_milestones FOR INSERT TO authenticated WITH CHECK (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_update_milestones" ON agency_milestones FOR UPDATE TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid) WITH CHECK (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_delete_milestones" ON agency_milestones FOR DELETE TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

CREATE TRIGGER agency_milestones_updated_at
  BEFORE UPDATE ON agency_milestones
  FOR EACH ROW EXECUTE FUNCTION agency_handle_updated_at();
