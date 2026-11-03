-- Migration 015: Creative approvals
-- Additive. Run after 014.

CREATE TABLE IF NOT EXISTS agency_creatives (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid        NOT NULL REFERENCES agency_projects(id) ON DELETE CASCADE,
  client_id   uuid        NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  version     integer     NOT NULL DEFAULT 1,
  file_path   text        NOT NULL,
  file_type   text        NOT NULL,  -- 'image','pdf','video'
  status      text        NOT NULL DEFAULT 'Pending'
                CHECK (status IN ('Pending','Approved','Revision Requested')),
  client_comment text,
  reviewed_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_creatives_project_id_idx ON agency_creatives(project_id);
CREATE INDEX IF NOT EXISTS agency_creatives_client_id_idx  ON agency_creatives(client_id);
CREATE INDEX IF NOT EXISTS agency_creatives_status_idx     ON agency_creatives(status);

ALTER TABLE agency_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_creatives" ON agency_creatives FOR SELECT TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_insert_creatives" ON agency_creatives FOR INSERT TO authenticated WITH CHECK (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_update_creatives" ON agency_creatives FOR UPDATE TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid) WITH CHECK (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_delete_creatives" ON agency_creatives FOR DELETE TO authenticated USING (auth.uid()='9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

CREATE TRIGGER agency_creatives_updated_at
  BEFORE UPDATE ON agency_creatives
  FOR EACH ROW EXECUTE FUNCTION agency_handle_updated_at();

-- RPC: client reviews a creative submission
CREATE OR REPLACE FUNCTION public.review_creative(
  p_token    text,
  p_creative_id uuid,
  p_action   text,   -- 'Approved' or 'Revision Requested'
  p_comment  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid;
  v_creative  RECORD;
BEGIN
  -- Resolve token (portal token or proposal token)
  SELECT client_id INTO v_client_id FROM agency_portal_tokens WHERE token=p_token AND is_active=true;
  IF v_client_id IS NULL THEN
    SELECT client_id INTO v_client_id FROM agency_proposals WHERE portal_token=p_token AND status!='Draft';
  END IF;
  IF v_client_id IS NULL THEN RETURN jsonb_build_object('error','Invalid token'); END IF;

  IF p_action NOT IN ('Approved','Revision Requested') THEN
    RETURN jsonb_build_object('error','Invalid action');
  END IF;

  SELECT * INTO v_creative FROM agency_creatives WHERE id=p_creative_id;
  IF v_creative.id IS NULL THEN RETURN jsonb_build_object('error','Creative not found'); END IF;
  IF v_creative.client_id != v_client_id THEN RETURN jsonb_build_object('error','Access denied'); END IF;
  IF v_creative.status != 'Pending' THEN RETURN jsonb_build_object('error','Already reviewed'); END IF;

  UPDATE agency_creatives
  SET status=p_action, client_comment=p_comment, reviewed_at=now(), updated_at=now()
  WHERE id=p_creative_id;

  RETURN jsonb_build_object('success',true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.review_creative(text,uuid,text,text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.review_creative(text,uuid,text,text) TO anon, authenticated;

-- RPC: get creatives for a client via portal token
CREATE OR REPLACE FUNCTION public.get_portal_creatives(p_token text)
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
    'id',             c.id,
    'title',          c.title,
    'description',    c.description,
    'version',        c.version,
    'file_type',      c.file_type,
    'status',         c.status,
    'client_comment', c.client_comment,
    'reviewed_at',    c.reviewed_at,
    'created_at',     c.created_at,
    'project_title',  p.title
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM agency_creatives c
  JOIN agency_projects p ON p.id = c.project_id
  WHERE c.client_id = v_client_id;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_portal_creatives(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_portal_creatives(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
