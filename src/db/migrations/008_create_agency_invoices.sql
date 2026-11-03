-- Migration 008: Create agency_invoices and agency_invoice_items tables
-- Run after migration 007. Additive — does not modify existing tables.

-- ── Sequence for invoice numbers ──────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS agency_invoice_number_seq START 1;

-- ── Invoices table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_invoices (
  id             uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      uuid          NOT NULL REFERENCES agency_clients(id) ON DELETE RESTRICT,
  project_id     uuid          REFERENCES agency_projects(id) ON DELETE SET NULL,
  invoice_number text          NOT NULL UNIQUE
    DEFAULT 'INV-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('agency_invoice_number_seq')::text, 4, '0'),
  title          text          NOT NULL,
  total_amount   numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount    numeric(14,2) NOT NULL DEFAULT 0,
  currency       text          NOT NULL DEFAULT 'ETB',
  issue_date     date          NOT NULL,
  due_date       date          NOT NULL,
  status         text          NOT NULL DEFAULT 'Draft'
                   CHECK (status IN ('Draft','Unpaid','Partially Paid','Paid','Cancelled')),
  notes          text,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE agency_invoices ADD CONSTRAINT agency_invoices_paid_check
  CHECK (paid_amount >= 0 AND paid_amount <= total_amount);

CREATE INDEX IF NOT EXISTS agency_invoices_client_id_idx ON agency_invoices(client_id);
CREATE INDEX IF NOT EXISTS agency_invoices_status_idx ON agency_invoices(status);
CREATE INDEX IF NOT EXISTS agency_invoices_invoice_number_idx ON agency_invoices(invoice_number);

ALTER TABLE agency_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_invoices"
  ON agency_invoices FOR SELECT TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_insert_invoices"
  ON agency_invoices FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_update_invoices"
  ON agency_invoices FOR UPDATE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid)
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_delete_invoices"
  ON agency_invoices FOR DELETE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

CREATE TRIGGER agency_invoices_updated_at
  BEFORE UPDATE ON agency_invoices
  FOR EACH ROW EXECUTE FUNCTION agency_handle_updated_at();

-- ── Invoice items table (normalized line items) ─────────────────────────────
CREATE TABLE IF NOT EXISTS agency_invoice_items (
  id           uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id   uuid          NOT NULL REFERENCES agency_invoices(id) ON DELETE CASCADE,
  description  text          NOT NULL,
  quantity     numeric(10,2) NOT NULL CHECK (quantity > 0),
  unit_price   numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  subtotal     numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order   integer       NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS agency_invoice_items_invoice_id_idx ON agency_invoice_items(invoice_id);

ALTER TABLE agency_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_invoice_items"
  ON agency_invoice_items FOR SELECT TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_insert_invoice_items"
  ON agency_invoice_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_update_invoice_items"
  ON agency_invoice_items FOR UPDATE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid)
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_delete_invoice_items"
  ON agency_invoice_items FOR DELETE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);

-- ── Trigger: prevent editing items on non-Draft invoices ────────────────────
CREATE OR REPLACE FUNCTION agency_check_invoice_editable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM agency_invoices WHERE id = NEW.invoice_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Invoice not found for line item';
  END IF;
  IF v_status != 'Draft' THEN
    RAISE EXCEPTION 'Cannot modify line items on a non-Draft invoice (status: %)', v_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agency_invoice_items_before_insert
  BEFORE INSERT ON agency_invoice_items
  FOR EACH ROW EXECUTE FUNCTION agency_check_invoice_editable();

CREATE TRIGGER agency_invoice_items_before_update
  BEFORE UPDATE ON agency_invoice_items
  FOR EACH ROW EXECUTE FUNCTION agency_check_invoice_editable();

-- ── Trigger: recalculate invoice total from line items ─────────────────────
CREATE OR REPLACE FUNCTION agency_recalc_invoice_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_id uuid;
  v_total numeric(14,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_total
  FROM agency_invoice_items
  WHERE invoice_id = v_invoice_id;

  UPDATE agency_invoices
  SET total_amount = v_total, updated_at = now()
  WHERE id = v_invoice_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER agency_invoice_items_after_insert
  AFTER INSERT ON agency_invoice_items
  FOR EACH ROW EXECUTE FUNCTION agency_recalc_invoice_total();

CREATE TRIGGER agency_invoice_items_after_update
  AFTER UPDATE ON agency_invoice_items
  FOR EACH ROW EXECUTE FUNCTION agency_recalc_invoice_total();

CREATE TRIGGER agency_invoice_items_after_delete
  AFTER DELETE ON agency_invoice_items
  FOR EACH ROW EXECUTE FUNCTION agency_recalc_invoice_total();

-- ── Trigger: prevent cancelling invoices with confirmed payments ────────────
CREATE OR REPLACE FUNCTION agency_check_cancel_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'Cancelled' AND OLD.status != 'Cancelled' AND OLD.paid_amount > 0 THEN
    RAISE EXCEPTION 'Cannot cancel an invoice with confirmed payments (paid: %)', OLD.paid_amount;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agency_invoices_before_update
  BEFORE UPDATE ON agency_invoices
  FOR EACH ROW EXECUTE FUNCTION agency_check_cancel_allowed();
