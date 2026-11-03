-- ===========================================================================
-- Migration 020: Migrate ALL live admin RLS policies to public.is_admin()
-- ===========================================================================
-- Generated from the actual live pg_policies output. Run AFTER 019.
-- Run as: postgres / service role.
--
-- Live policy names differ from committed migration files:
--   - Most tables use short names: admin_select, admin_insert, admin_update,
--     admin_delete (not the long names in the original migration files)
--   - Most tables use UUID 1decbf78-8c5e-470a-afdc-b310b317d4b1
--   - Quotations / quotation_items / quotation_responses use 9705a671-...
--   - agency_activity_log is intentionally NOT touched (Finding A)
--
-- Atomicity: single BEGIN/COMMIT. Any failure rolls back everything.
-- ===========================================================================

BEGIN;

-- ── agency_clients (4) ──────────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_clients;
CREATE POLICY "admin_select" ON public.agency_clients FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_clients;
CREATE POLICY "admin_insert" ON public.agency_clients FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_clients;
CREATE POLICY "admin_update" ON public.agency_clients FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_clients;
CREATE POLICY "admin_delete" ON public.agency_clients FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_contracts (4) ────────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_contracts;
CREATE POLICY "admin_select" ON public.agency_contracts FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_contracts;
CREATE POLICY "admin_insert" ON public.agency_contracts FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_contracts;
CREATE POLICY "admin_update" ON public.agency_contracts FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_contracts;
CREATE POLICY "admin_delete" ON public.agency_contracts FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_creatives (4) ────────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_creatives;
CREATE POLICY "admin_select" ON public.agency_creatives FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_creatives;
CREATE POLICY "admin_insert" ON public.agency_creatives FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_creatives;
CREATE POLICY "admin_update" ON public.agency_creatives FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_creatives;
CREATE POLICY "admin_delete" ON public.agency_creatives FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_files (4) ────────────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_files;
CREATE POLICY "admin_select" ON public.agency_files FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_files;
CREATE POLICY "admin_insert" ON public.agency_files FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_files;
CREATE POLICY "admin_update" ON public.agency_files FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_files;
CREATE POLICY "admin_delete" ON public.agency_files FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_invoice_items (4) ─────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_invoice_items;
CREATE POLICY "admin_select" ON public.agency_invoice_items FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_invoice_items;
CREATE POLICY "admin_insert" ON public.agency_invoice_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_invoice_items;
CREATE POLICY "admin_update" ON public.agency_invoice_items FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_invoice_items;
CREATE POLICY "admin_delete" ON public.agency_invoice_items FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_invoices (4) ──────────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_invoices;
CREATE POLICY "admin_select" ON public.agency_invoices FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_invoices;
CREATE POLICY "admin_insert" ON public.agency_invoices FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_invoices;
CREATE POLICY "admin_update" ON public.agency_invoices FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_invoices;
CREATE POLICY "admin_delete" ON public.agency_invoices FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_milestones (4) ────────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_milestones;
CREATE POLICY "admin_select" ON public.agency_milestones FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_milestones;
CREATE POLICY "admin_insert" ON public.agency_milestones FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_milestones;
CREATE POLICY "admin_update" ON public.agency_milestones FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_milestones;
CREATE POLICY "admin_delete" ON public.agency_milestones FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_payment_settings (4) ──────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_payment_settings;
CREATE POLICY "admin_select" ON public.agency_payment_settings FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_payment_settings;
CREATE POLICY "admin_insert" ON public.agency_payment_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_payment_settings;
CREATE POLICY "admin_update" ON public.agency_payment_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_payment_settings;
CREATE POLICY "admin_delete" ON public.agency_payment_settings FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_payment_submissions (4) ───────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_payment_submissions;
CREATE POLICY "admin_select" ON public.agency_payment_submissions FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_payment_submissions;
CREATE POLICY "admin_insert" ON public.agency_payment_submissions FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_payment_submissions;
CREATE POLICY "admin_update" ON public.agency_payment_submissions FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_payment_submissions;
CREATE POLICY "admin_delete" ON public.agency_payment_submissions FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_payments (4) ──────────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_payments;
CREATE POLICY "admin_select" ON public.agency_payments FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_payments;
CREATE POLICY "admin_insert" ON public.agency_payments FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_payments;
CREATE POLICY "admin_update" ON public.agency_payments FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_payments;
CREATE POLICY "admin_delete" ON public.agency_payments FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_portal_tokens (4) ─────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_portal_tokens;
CREATE POLICY "admin_select" ON public.agency_portal_tokens FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_portal_tokens;
CREATE POLICY "admin_insert" ON public.agency_portal_tokens FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_portal_tokens;
CREATE POLICY "admin_update" ON public.agency_portal_tokens FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_portal_tokens;
CREATE POLICY "admin_delete" ON public.agency_portal_tokens FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_projects (4) ──────────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_projects;
CREATE POLICY "admin_select" ON public.agency_projects FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_projects;
CREATE POLICY "admin_insert" ON public.agency_projects FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_projects;
CREATE POLICY "admin_update" ON public.agency_projects FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_projects;
CREATE POLICY "admin_delete" ON public.agency_projects FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_proposal_responses (4) ────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_proposal_responses;
CREATE POLICY "admin_select" ON public.agency_proposal_responses FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_proposal_responses;
CREATE POLICY "admin_insert" ON public.agency_proposal_responses FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_proposal_responses;
CREATE POLICY "admin_update" ON public.agency_proposal_responses FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_proposal_responses;
CREATE POLICY "admin_delete" ON public.agency_proposal_responses FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_proposals (4) ─────────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_proposals;
CREATE POLICY "admin_select" ON public.agency_proposals FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_proposals;
CREATE POLICY "admin_insert" ON public.agency_proposals FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_proposals;
CREATE POLICY "admin_update" ON public.agency_proposals FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_proposals;
CREATE POLICY "admin_delete" ON public.agency_proposals FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_tasks (4) ─────────────────────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_tasks;
CREATE POLICY "admin_select" ON public.agency_tasks FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_tasks;
CREATE POLICY "admin_insert" ON public.agency_tasks FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_tasks;
CREATE POLICY "admin_update" ON public.agency_tasks FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_tasks;
CREATE POLICY "admin_delete" ON public.agency_tasks FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_upload_authorizations (4) ─────────────────────────────────────────
DROP POLICY "admin_select" ON public.agency_upload_authorizations;
CREATE POLICY "admin_select" ON public.agency_upload_authorizations FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert" ON public.agency_upload_authorizations;
CREATE POLICY "admin_insert" ON public.agency_upload_authorizations FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update" ON public.agency_upload_authorizations;
CREATE POLICY "admin_update" ON public.agency_upload_authorizations FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete" ON public.agency_upload_authorizations;
CREATE POLICY "admin_delete" ON public.agency_upload_authorizations FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_quotations (4) — uses 9705 UUID in live DB ────────────────────────
DROP POLICY "admin_select_quotations" ON public.agency_quotations;
CREATE POLICY "admin_select_quotations" ON public.agency_quotations FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert_quotations" ON public.agency_quotations;
CREATE POLICY "admin_insert_quotations" ON public.agency_quotations FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update_quotations" ON public.agency_quotations;
CREATE POLICY "admin_update_quotations" ON public.agency_quotations FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete_quotations" ON public.agency_quotations;
CREATE POLICY "admin_delete_quotations" ON public.agency_quotations FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_quotation_items (4) — uses 9705 UUID in live DB ───────────────────
DROP POLICY "admin_select_quot_items" ON public.agency_quotation_items;
CREATE POLICY "admin_select_quot_items" ON public.agency_quotation_items FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_insert_quot_items" ON public.agency_quotation_items;
CREATE POLICY "admin_insert_quot_items" ON public.agency_quotation_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY "admin_update_quot_items" ON public.agency_quotation_items;
CREATE POLICY "admin_update_quot_items" ON public.agency_quotation_items FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY "admin_delete_quot_items" ON public.agency_quotation_items;
CREATE POLICY "admin_delete_quot_items" ON public.agency_quotation_items FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_quotation_responses (2) — uses 9705 UUID in live DB ───────────────
DROP POLICY "admin_select_quot_resp" ON public.agency_quotation_responses;
CREATE POLICY "admin_select_quot_resp" ON public.agency_quotation_responses FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY "admin_delete_quot_resp" ON public.agency_quotation_responses;
CREATE POLICY "admin_delete_quot_resp" ON public.agency_quotation_responses FOR DELETE TO authenticated USING (public.is_admin());

-- ── agency_activity_log — NOT TOUCHED (1decbf78 is the confirmed real admin) ─
-- Both policies already use 1decbf78 which is now seeded as admin.
-- After this migration is_admin() returns true for 1decbf78, so the existing
-- UUID-based activity log policies continue to work for that user unchanged.

-- ── Payment RPC function guards (migration 011) ───────────────────────────────
-- Recreate all three with IF NOT public.is_admin() guard.
-- Signatures, business logic, SECURITY DEFINER, search_path all preserved.

CREATE OR REPLACE FUNCTION public.approve_payment_submission(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_submission RECORD;
  v_invoice    RECORD;
  v_new_paid   numeric(14,2);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT * INTO v_submission FROM agency_payment_submissions WHERE id = p_submission_id;
  IF v_submission.id IS NULL THEN RETURN jsonb_build_object('error', 'Submission not found'); END IF;
  IF v_submission.status != 'Pending' THEN RETURN jsonb_build_object('error', 'Submission has already been ' || lower(v_submission.status)); END IF;

  SELECT * INTO v_invoice FROM agency_invoices WHERE id = v_submission.invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL THEN RETURN jsonb_build_object('error', 'Invoice not found'); END IF;
  IF v_invoice.status IN ('Cancelled', 'Draft') THEN RETURN jsonb_build_object('error', 'Cannot approve payment for a ' || lower(v_invoice.status) || ' invoice'); END IF;

  v_new_paid := v_invoice.paid_amount + v_submission.amount;
  IF v_new_paid > v_invoice.total_amount THEN
    RETURN jsonb_build_object('error', 'Approval would exceed invoice total (remaining: ' || (v_invoice.total_amount - v_invoice.paid_amount)::text || ')');
  END IF;

  BEGIN
    INSERT INTO agency_payments (invoice_id, amount, payment_method, transaction_ref, payment_date, notes, source, submission_id)
    VALUES (v_submission.invoice_id, v_submission.amount, v_submission.payment_method, v_submission.transaction_ref, v_submission.payment_date, v_submission.notes, 'Submission', p_submission_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'This submission has already been approved');
  END;

  UPDATE agency_payment_submissions SET status = 'Approved', reviewed_at = now() WHERE id = p_submission_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_payment_submission(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.approve_payment_submission(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_payment_submission(p_submission_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT status INTO v_status FROM agency_payment_submissions WHERE id = p_submission_id;
  IF v_status IS NULL THEN RETURN jsonb_build_object('error', 'Submission not found'); END IF;
  IF v_status != 'Pending' THEN RETURN jsonb_build_object('error', 'Submission has already been ' || lower(v_status)); END IF;

  UPDATE agency_payment_submissions SET status = 'Rejected', reviewed_at = now() WHERE id = p_submission_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_payment_submission(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reject_payment_submission(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_manual_payment(
  p_invoice_id   uuid,
  p_amount       numeric,
  p_method       text,
  p_ref          text,
  p_payment_date date,
  p_notes        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice  RECORD;
  v_new_paid numeric(14,2);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('error', 'Amount must be greater than zero'); END IF;
  IF p_method NOT IN ('CBE','Telebirr','Bank Transfer','Cash','Other') THEN RETURN jsonb_build_object('error', 'Invalid payment method'); END IF;

  SELECT * INTO v_invoice FROM agency_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL THEN RETURN jsonb_build_object('error', 'Invoice not found'); END IF;
  IF v_invoice.status IN ('Cancelled', 'Draft') THEN RETURN jsonb_build_object('error', 'Cannot record payment for a ' || lower(v_invoice.status) || ' invoice'); END IF;

  v_new_paid := v_invoice.paid_amount + p_amount;
  IF v_new_paid > v_invoice.total_amount THEN
    RETURN jsonb_build_object('error', 'Payment would exceed invoice total (remaining: ' || (v_invoice.total_amount - v_invoice.paid_amount)::text || ')');
  END IF;

  INSERT INTO agency_payments (invoice_id, amount, payment_method, transaction_ref, payment_date, notes, source)
  VALUES (p_invoice_id, p_amount, p_method, p_ref, p_payment_date, p_notes, 'Manual');

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_manual_payment(uuid, numeric, text, text, date, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_manual_payment(uuid, numeric, text, text, date, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
