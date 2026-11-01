-- Migration 006, run after 005
-- Defines two SECURITY DEFINER functions for the public client portal.
-- Both functions use SET search_path = public, pg_temp to prevent search-path hijacking.
-- EXECUTE is revoked from PUBLIC and granted only to anon and authenticated roles.

-- ---------------------------------------------------------------------------
-- Function 1: get_portal_data
-- Returns proposal data (and related contract/response/project) for a given
-- portal token. Returns NULL if the token does not exist or the proposal is
-- still in Draft status.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_portal_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal      agency_proposals%ROWTYPE;
  v_client        RECORD;
  v_response      RECORD;
  v_contract      RECORD;
  v_project       RECORD;
  v_result        jsonb;
BEGIN
  -- Fetch proposal by token; must not be Draft
  SELECT * INTO v_proposal
  FROM agency_proposals
  WHERE portal_token = p_token
    AND status <> 'Draft';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Fetch client (expose only non-sensitive fields)
  SELECT id, name, company, email INTO v_client
  FROM agency_clients
  WHERE id = v_proposal.client_id;

  -- Fetch response if any
  SELECT action, comment, responded_at INTO v_response
  FROM agency_proposal_responses
  WHERE proposal_id = v_proposal.id;

  -- Fetch contract content if any
  SELECT content, status, created_at INTO v_contract
  FROM agency_contracts
  WHERE proposal_id = v_proposal.id;

  -- Fetch the most recent project linked to this client
  SELECT title, status, description, start_date, deadline INTO v_project
  FROM agency_projects
  WHERE client_id = v_proposal.client_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Build response JSONB
  v_result := jsonb_build_object(
    'proposal', jsonb_build_object(
      'id',           v_proposal.id,
      'title',        v_proposal.title,
      'introduction', v_proposal.introduction,
      'deliverables', v_proposal.deliverables,
      'terms',        v_proposal.terms,
      'items',        v_proposal.items,
      'total_amount', v_proposal.total_amount,
      'currency',     v_proposal.currency,
      'expiry_date',  v_proposal.expiry_date,
      'status',       v_proposal.status
    ),
    'client', jsonb_build_object(
      'id',      v_client.id,
      'name',    v_client.name,
      'company', v_client.company,
      'email',   v_client.email
    ),
    'response', CASE WHEN v_response.action IS NOT NULL THEN
      jsonb_build_object(
        'action',       v_response.action,
        'comment',      v_response.comment,
        'responded_at', v_response.responded_at
      )
    ELSE NULL END,
    'contract', CASE WHEN v_contract.content IS NOT NULL THEN
      jsonb_build_object(
        'content',    v_contract.content,
        'status',     v_contract.status,
        'created_at', v_contract.created_at
      )
    ELSE NULL END,
    'project', CASE WHEN v_project.title IS NOT NULL THEN
      jsonb_build_object(
        'title',       v_project.title,
        'status',      v_project.status,
        'description', v_project.description,
        'start_date',  v_project.start_date,
        'deadline',    v_project.deadline
      )
    ELSE NULL END
  );

  RETURN v_result;
END;
$$;

-- Restrict execute to only the roles that need it
REVOKE EXECUTE ON FUNCTION public.get_portal_data(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_portal_data(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Function 2: submit_proposal_response
-- Allows a client to respond to a proposal via their portal token.
-- Validates: token exists, proposal is 'Sent', action is valid, no prior
-- response. On success inserts a response record and updates proposal status.
-- Never raises an exception — returns {error: "..."} on failure.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_proposal_response(
  p_token   text,
  p_action  text,
  p_comment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal_id uuid;
  v_existing    int;
BEGIN
  -- Validate action
  IF p_action NOT IN ('Accepted', 'Changes Requested', 'Rejected') THEN
    RETURN jsonb_build_object('error', 'Invalid action');
  END IF;

  -- Fetch proposal; must exist and be in 'Sent' status
  SELECT id INTO v_proposal_id
  FROM agency_proposals
  WHERE portal_token = p_token
    AND status = 'Sent';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Proposal not found or not available for response');
  END IF;

  -- Check for an existing response (UNIQUE constraint is the hard guard;
  -- this check returns a clean error message instead of a constraint violation)
  SELECT COUNT(*) INTO v_existing
  FROM agency_proposal_responses
  WHERE proposal_id = v_proposal_id;

  IF v_existing > 0 THEN
    RETURN jsonb_build_object('error', 'A response has already been submitted for this proposal');
  END IF;

  -- Insert response
  INSERT INTO agency_proposal_responses (proposal_id, action, comment)
  VALUES (v_proposal_id, p_action, p_comment);

  -- Update proposal status to match the action
  UPDATE agency_proposals
  SET status = p_action
  WHERE id = v_proposal_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Restrict execute to only the roles that need it
REVOKE EXECUTE ON FUNCTION public.submit_proposal_response(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_proposal_response(text, text, text) TO anon, authenticated;
