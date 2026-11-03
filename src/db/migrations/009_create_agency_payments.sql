-- Migration 009: Create agency_payment_submissions and agency_payments tables
-- Run after migration 008. Additive — does not modify existing tables.

-- ── Payment submissions (client-uploaded proofs, pending review) ────────────
CREATE TABLE IF NOT EXISTS agency_payment_submissions (
  id             uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id     uuid          NOT NULL REFERENCES agency_invoices(id) ON DELETE CASCADE,
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method text          NOT NULL CHECK (payment_method IN ('CBE','Telebirr','Bank Transfer','Cash','Other')),
  transaction_ref text,
  payment_date   date          NOT NULL,
  notes          text,
  receipt_path   text,
  status         text          NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending','Approved','Rejected')),
  reviewed_at    timestamptz,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_payment_submissions_invoice_id_idx ON agency_payment_submissions(invoice_id);
CREATE INDEX IF NOT EXISTS agency_payment_submissions_status_idx ON agency_payment_submissions(status);

ALTER TABLE agency_payment_submissions ENABLE ROW LEVEL SECURITY;

-- Admin can read and update (approve/reject). No direct INSERT or DELETE.
CREATE POLICY "admin_select_payment_submissions"
  ON agency_payment_submissions FOR SELECT TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_update_payment_submissions"
  ON agency_payment_submissions FOR UPDATE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid)
  WITH CHECK (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
-- No INSERT/DELETE policies — all writes through RPC functions.

-- ── Confirmed payments (affect invoice balance) ──────────────────────────────
CREATE TABLE IF NOT EXISTS agency_payments (
  id             uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id     uuid          NOT NULL REFERENCES agency_invoices(id) ON DELETE CASCADE,
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method text          NOT NULL CHECK (payment_method IN ('CBE','Telebirr','Bank Transfer','Cash','Other')),
  transaction_ref text,
  payment_date   date          NOT NULL,
  notes          text,
  source         text          NOT NULL CHECK (source IN ('Submission','Manual')),
  submission_id  uuid          REFERENCES agency_payment_submissions(id) ON DELETE SET NULL,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

-- UNIQUE on submission_id prevents duplicate approvals.
CREATE UNIQUE INDEX IF NOT EXISTS agency_payments_submission_id_idx
  ON agency_payments(submission_id) WHERE submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agency_payments_invoice_id_idx ON agency_payments(invoice_id);

ALTER TABLE agency_payments ENABLE ROW LEVEL SECURITY;

-- Admin can read and delete. No direct INSERT or UPDATE — all writes through RPC.
CREATE POLICY "admin_select_payments"
  ON agency_payments FOR SELECT TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
CREATE POLICY "admin_delete_payments"
  ON agency_payments FOR DELETE TO authenticated
  USING (auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid);
-- No INSERT/UPDATE policies — all writes through RPC functions.

-- ── Trigger: recalculate invoice balance after payment changes ─────────────
CREATE OR REPLACE FUNCTION agency_recalc_invoice_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_id   uuid;
  v_total        numeric(14,2);
  v_paid         numeric(14,2);
  v_status       text;
  v_new_status   text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  -- Lock the invoice row to serialize concurrent payment operations
  SELECT total_amount, paid_amount, status
  INTO v_total, v_paid, v_status
  FROM agency_invoices
  WHERE id = v_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculate paid_amount from all confirmed payments
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM agency_payments
  WHERE invoice_id = v_invoice_id;

  -- Overpayment prevention
  IF v_paid > v_total THEN
    RAISE EXCEPTION 'Total approved payments (%) cannot exceed invoice total (%)', v_paid, v_total;
  END IF;

  -- Auto-update invoice status (preserve Cancelled and Draft)
  v_new_status := CASE
    WHEN v_status = 'Cancelled' THEN 'Cancelled'
    WHEN v_status = 'Draft' THEN 'Draft'
    WHEN v_paid = 0 THEN 'Unpaid'
    WHEN v_paid < v_total THEN 'Partially Paid'
    WHEN v_paid >= v_total THEN 'Paid'
    ELSE v_status
  END;

  UPDATE agency_invoices
  SET paid_amount = v_paid,
      status = v_new_status,
      updated_at = now()
  WHERE id = v_invoice_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER agency_payments_after_insert
  AFTER INSERT ON agency_payments
  FOR EACH ROW EXECUTE FUNCTION agency_recalc_invoice_payment();

CREATE TRIGGER agency_payments_after_update
  AFTER UPDATE ON agency_payments
  FOR EACH ROW EXECUTE FUNCTION agency_recalc_invoice_payment();

CREATE TRIGGER agency_payments_after_delete
  AFTER DELETE ON agency_payments
  FOR EACH ROW EXECUTE FUNCTION agency_recalc_invoice_payment();
