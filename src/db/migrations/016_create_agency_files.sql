-- Migration 016: Client file library
-- Additive. Run after 015.
-- Requires a private Supabase Storage bucket named 'agency-files'.

CREATE TABLE IF NOT EXISTS agency_files (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  project_id  uuid        REFERENCES agency_projects(id) ON DELETE SET NULL,
  name        text        NOT NULL,
  description text,
  file_path   text        NOT NULL,   -- storage path inside agency-files bucket
  file_type   text        NOT NULL,   -- mime type category: image, pdf, video, other
  file_size   bigint,
  shared_with_client boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_files_client_id_idx  ON agency_files(client_id);
CREATE INDEX IF NOT EXISTS agency_files_project_id_idx ON agency_files(project_id);

ALTER TABLE agency_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_files" ON agency_files FOR SELECT TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_insert_files" ON agency_files FOR INSERT TO authenticated WITH CHECK (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_update_files" ON agency_files FOR UPDATE TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid) WITH CHECK (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_delete_files" ON agency_files FOR DELETE TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- RPC: return files shared with a client via portal token
CREATE OR REPLACE FUNCTION public.get_portal_files(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid;
  v_result    jsonb;
BEGIN
  SELECT client_id INTO v_client_id FROM agency_portal_tokens WHERE token=p_token AND is_active=true;
  IF v_client_id IS NULL THEN
    SELECT client_id INTO v_client_id FROM agency_proposals WHERE portal_token=p_token AND status!='Draft';
  END IF;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',          f.id,
    'name',        f.name,
    'description', f.description,
    'file_type',   f.file_type,
    'file_size',   f.file_size,
    'created_at',  f.created_at,
    'project_title', p.title
  ) ORDER BY f.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM agency_files f
  LEFT JOIN agency_projects p ON p.id = f.project_id
  WHERE f.client_id = v_client_id
    AND f.shared_with_client = true;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_portal_files(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_portal_files(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
