-- Migration 018: Quotation Management
-- Additive. Run after 017. Admin UUID: 9705a671-4d69-49bb-b5f9-7f69cad4f0f8

CREATE SEQUENCE IF NOT EXISTS agency_quotation_number_seq START 1;

CREATE TABLE IF NOT EXISTS agency_quotations (
  id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id           uuid          NOT NULL REFERENCES agency_clients(id) ON DELETE RESTRICT,
  quotation_number    text          NOT NULL UNIQUE DEFAULT
    'QUO-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('agency_quotation_number_seq')::text, 4, '0'),
  title               text          NOT NULL,
  status              text          NOT NULL DEFAULT 'Draft'
                        CHECK (status IN ('Draft','Sent','Accepted','Rejected','Expired')),
  issue_date          date          NOT NULL DEFAULT CURRENT_DATE,
  validity_date       date,
  estimated_delivery  text,                   -- free text e.g. "4–6 weeks"
  currency            text          NOT NULL DEFAULT 'ETB',
  discount_type       text          CHECK (discount_type IN ('fixed','percentage') OR discount_type IS NULL),
  discount_value      numeric(14,2) NOT NULL DEFAULT 0,
  subtotal            numeric(14,2) NOT NULL DEFAULT 0,  -- set by trigger
  discount_amount     numeric(14,2) NOT NULL DEFAULT 0,  -- set by trigger
  total               numeric(14,2) NOT NULL DEFAULT 0,  -- set by trigger
  scope               text,
  deliverables        text,
  timeline            text,
  terms               text,
  payment_terms       text,
  notes               text,
  access_token        text          NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32),'hex'),
  original_quotation_id uuid        REFERENCES agency_quotations(id) ON DELETE SET NULL, -- for duplicates
  converted_proposal_id uuid        REFERENCES agency_proposals(id) ON DELETE SET NULL,
  converted_project_id  uuid        REFERENCES agency_projects(id)  ON DELETE SET NULL,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_quotations_client_id_idx ON agency_quotations(client_id);
CREATE INDEX IF NOT EXISTS agency_quotations_status_idx    ON agency_quotations(status);
CREATE INDEX IF NOT EXISTS agency_quotations_token_idx     ON agency_quotations(access_token);

-- Line items (separate table, normalised)
CREATE TABLE IF NOT EXISTS agency_quotation_items (
  id               uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id     uuid          NOT NULL REFERENCES agency_quotations(id) ON DELETE CASCADE,
  service_name     text          NOT NULL DEFAULT '',
  description      text,
  quantity         numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit             text          NOT NULL DEFAULT 'item',
  unit_price       numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total       numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order       integer       NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS agency_quotation_items_quotation_idx ON agency_quotation_items(quotation_id);

-- Response table (one per quotation)
CREATE TABLE IF NOT EXISTS agency_quotation_responses (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id  uuid        NOT NULL UNIQUE REFERENCES agency_quotations(id) ON DELETE CASCADE,
  action        text        NOT NULL CHECK (action IN ('Accepted','Rejected','Changes Requested')),
  comment       text,
  responded_at  timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE agency_quotations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_quotation_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_quotation_responses ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE uid text := '9705a671-4d69-49bb-b5f9-7f69cad4f0f8';
BEGIN
  EXECUTE format($p$CREATE POLICY "admin_select_quotations" ON agency_quotations FOR SELECT TO authenticated USING (auth.uid()=%L::uuid)$p$, uid);
  EXECUTE format($p$CREATE POLICY "admin_insert_quotations" ON agency_quotations FOR INSERT TO authenticated WITH CHECK (auth.uid()=%L::uuid)$p$, uid);
  EXECUTE format($p$CREATE POLICY "admin_update_quotations" ON agency_quotations FOR UPDATE TO authenticated USING (auth.uid()=%L::uuid) WITH CHECK (auth.uid()=%L::uuid)$p$, uid, uid);
  EXECUTE format($p$CREATE POLICY "admin_delete_quotations" ON agency_quotations FOR DELETE TO authenticated USING (auth.uid()=%L::uuid)$p$, uid);
  EXECUTE format($p$CREATE POLICY "admin_select_quot_items" ON agency_quotation_items FOR SELECT TO authenticated USING (auth.uid()=%L::uuid)$p$, uid);
  EXECUTE format($p$CREATE POLICY "admin_insert_quot_items" ON agency_quotation_items FOR INSERT TO authenticated WITH CHECK (auth.uid()=%L::uuid)$p$, uid);
  EXECUTE format($p$CREATE POLICY "admin_update_quot_items" ON agency_quotation_items FOR UPDATE TO authenticated USING (auth.uid()=%L::uuid) WITH CHECK (auth.uid()=%L::uuid)$p$, uid, uid);
  EXECUTE format($p$CREATE POLICY "admin_delete_quot_items" ON agency_quotation_items FOR DELETE TO authenticated USING (auth.uid()=%L::uuid)$p$, uid);
  EXECUTE format($p$CREATE POLICY "admin_select_quot_resp"  ON agency_quotation_responses FOR SELECT TO authenticated USING (auth.uid()=%L::uuid)$p$, uid);
  EXECUTE format($p$CREATE POLICY "admin_delete_quot_resp"  ON agency_quotation_responses FOR DELETE TO authenticated USING (auth.uid()=%L::uuid)$p$, uid);
END $$;

-- ── Triggers ─────────────────────────────────────────────────────────────────
-- Recalculate quotation totals after item changes
CREATE OR REPLACE FUNCTION agency_recalc_quotation_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_qid          uuid;
  v_subtotal     numeric(14,2);
  v_disc_type    text;
  v_disc_val     numeric(14,2);
  v_disc_amount  numeric(14,2);
BEGIN
  v_qid := COALESCE(NEW.quotation_id, OLD.quotation_id);
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM agency_quotation_items WHERE quotation_id = v_qid;
  SELECT discount_type, discount_value INTO v_disc_type, v_disc_val
  FROM agency_quotations WHERE id = v_qid;
  v_disc_amount := CASE
    WHEN v_disc_type = 'percentage' THEN ROUND(v_subtotal * v_disc_val / 100, 2)
    WHEN v_disc_type = 'fixed'      THEN LEAST(v_disc_val, v_subtotal)
    ELSE 0 END;
  UPDATE agency_quotations
  SET subtotal = v_subtotal, discount_amount = v_disc_amount,
      total = v_subtotal - v_disc_amount, updated_at = now()
  WHERE id = v_qid;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER agency_quot_items_after_insert AFTER INSERT ON agency_quotation_items FOR EACH ROW EXECUTE FUNCTION agency_recalc_quotation_total();
CREATE TRIGGER agency_quot_items_after_update AFTER UPDATE ON agency_quotation_items FOR EACH ROW EXECUTE FUNCTION agency_recalc_quotation_total();
CREATE TRIGGER agency_quot_items_after_delete AFTER DELETE ON agency_quotation_items FOR EACH ROW EXECUTE FUNCTION agency_recalc_quotation_total();

-- Recalc when discount changes on the quotation itself
CREATE OR REPLACE FUNCTION agency_recalc_quotation_on_discount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_subtotal    numeric(14,2);
  v_disc_amount numeric(14,2);
BEGIN
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM agency_quotation_items WHERE quotation_id = NEW.id;
  v_disc_amount := CASE
    WHEN NEW.discount_type = 'percentage' THEN ROUND(v_subtotal * NEW.discount_value / 100, 2)
    WHEN NEW.discount_type = 'fixed'      THEN LEAST(NEW.discount_value, v_subtotal)
    ELSE 0 END;
  NEW.subtotal       := v_subtotal;
  NEW.discount_amount := v_disc_amount;
  NEW.total           := v_subtotal - v_disc_amount;
  RETURN NEW;
END; $$;

CREATE TRIGGER agency_quotation_before_update
  BEFORE UPDATE OF discount_type, discount_value ON agency_quotations
  FOR EACH ROW EXECUTE FUNCTION agency_recalc_quotation_on_discount();

CREATE TRIGGER agency_quotations_updated_at
  BEFORE UPDATE ON agency_quotations
  FOR EACH ROW EXECUTE FUNCTION agency_handle_updated_at();

-- ── RPC: get_quotation_portal ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_quotation_portal(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE AS $$
DECLARE
  v_quot RECORD;
  v_client RECORD;
  v_response RECORD;
  v_items jsonb;
BEGIN
  SELECT * INTO v_quot FROM agency_quotations
  WHERE access_token = p_token AND status != 'Draft';
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT name, company, email FROM agency_clients WHERE id = v_quot.client_id INTO v_client;

  SELECT action, comment, responded_at INTO v_response
  FROM agency_quotation_responses WHERE quotation_id = v_quot.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'service_name', service_name, 'description', description,
    'quantity', quantity, 'unit', unit,
    'unit_price', unit_price, 'line_total', line_total
  ) ORDER BY sort_order), '[]'::jsonb) INTO v_items
  FROM agency_quotation_items WHERE quotation_id = v_quot.id;

  RETURN jsonb_build_object(
    'quotation', jsonb_build_object(
      'quotation_number', v_quot.quotation_number, 'title', v_quot.title,
      'status', v_quot.status, 'issue_date', v_quot.issue_date,
      'validity_date', v_quot.validity_date, 'estimated_delivery', v_quot.estimated_delivery,
      'currency', v_quot.currency, 'subtotal', v_quot.subtotal,
      'discount_type', v_quot.discount_type, 'discount_value', v_quot.discount_value,
      'discount_amount', v_quot.discount_amount, 'total', v_quot.total,
      'scope', v_quot.scope, 'deliverables', v_quot.deliverables,
      'timeline', v_quot.timeline, 'terms', v_quot.terms,
      'payment_terms', v_quot.payment_terms, 'notes', v_quot.notes
    ),
    'client', jsonb_build_object('name', v_client.name, 'company', v_client.company),
    'items', v_items,
    'response', CASE WHEN v_response.action IS NOT NULL THEN
      jsonb_build_object('action', v_response.action, 'comment', v_response.comment, 'responded_at', v_response.responded_at)
    ELSE NULL END
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_quotation_portal(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_quotation_portal(text) TO anon, authenticated;

-- ── RPC: respond_to_quotation ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_to_quotation(p_token text, p_action text, p_comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_qid uuid; v_status text;
BEGIN
  IF p_action NOT IN ('Accepted','Rejected','Changes Requested') THEN
    RETURN jsonb_build_object('error','Invalid action');
  END IF;
  SELECT id, status INTO v_qid, v_status FROM agency_quotations
  WHERE access_token = p_token;
  IF v_qid IS NULL THEN RETURN jsonb_build_object('error','Quotation not found'); END IF;
  IF v_status != 'Sent' THEN RETURN jsonb_build_object('error','Quotation is not open for response'); END IF;
  -- Check expiry
  IF (SELECT validity_date FROM agency_quotations WHERE id = v_qid) < CURRENT_DATE THEN
    UPDATE agency_quotations SET status = 'Expired', updated_at = now() WHERE id = v_qid;
    RETURN jsonb_build_object('error','This quotation has expired');
  END IF;
  -- Check already responded
  IF EXISTS (SELECT 1 FROM agency_quotation_responses WHERE quotation_id = v_qid) THEN
    RETURN jsonb_build_object('error','Already responded');
  END IF;
  BEGIN
    INSERT INTO agency_quotation_responses(quotation_id, action, comment)
    VALUES(v_qid, p_action, p_comment);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error','Already responded');
  END;
  UPDATE agency_quotations SET status = p_action, updated_at = now() WHERE id = v_qid;
  RETURN jsonb_build_object('success', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.respond_to_quotation(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.respond_to_quotation(text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
