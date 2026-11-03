-- Migration 011: Portal invoice RPC functions
-- Run after migrations 007-010. Uses CREATE OR REPLACE FUNCTION — safely rerunnable.
-- All functions: SECURITY DEFINER, SET search_path = public, pg_temp, REVOKE FROM PUBLIC.

-- pgcrypto required for gen_random_bytes() in request_payment_upload
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. get_portal_invoices — returns invoices + payments for a client via token
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_portal_invoices(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid;
  v_invoices  jsonb;
  v_submissions jsonb;
  v_payments  jsonb;
  v_client    RECORD;
  v_result    jsonb;
BEGIN
  -- Try client portal token first (agency_portal_tokens)
  SELECT client_id INTO v_client_id
  FROM agency_portal_tokens
  WHERE token = p_token AND is_active = true;

  -- Fall back to proposal portal token (agency_proposals)
  IF v_client_id IS NULL THEN
    SELECT client_id INTO v_client_id
    FROM agency_proposals
    WHERE portal_token = p_token AND status != 'Draft';
  END IF;

  IF v_client_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fetch client (name and company only)
  SELECT name, company INTO v_client
  FROM agency_clients
  WHERE id = v_client_id;

  -- Fetch invoices (exclude Drafts — not visible to clients)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',                inv.id,
    'invoice_number',    inv.invoice_number,
    'title',             inv.title,
    'status',            inv.status,
    'issue_date',        inv.issue_date,
    'due_date',          inv.due_date,
    'total_amount',      inv.total_amount,
    'paid_amount',       inv.paid_amount,
    'outstanding',       inv.total_amount - inv.paid_amount,
    'currency',          inv.currency,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'description', it.description,
        'quantity',    it.quantity,
        'unit_price',  it.unit_price,
        'subtotal',    it.subtotal
      ) ORDER BY it.sort_order)
      FROM agency_invoice_items it
      WHERE it.invoice_id = inv.id
    ), '[]'::jsonb)
  ) ORDER BY inv.created_at DESC), '[]'::jsonb)
  INTO v_invoices
  FROM agency_invoices inv
  WHERE inv.client_id = v_client_id
    AND inv.status != 'Draft';

  -- Fetch payment submissions (all statuses — client sees their history)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',              sub.id,
    'invoice_id',      sub.invoice_id,
    'amount',          sub.amount,
    'payment_method',  sub.payment_method,
    'transaction_ref', sub.transaction_ref,
    'payment_date',    sub.payment_date,
    'status',          sub.status
  ) ORDER BY sub.created_at DESC), '[]'::jsonb)
  INTO v_submissions
  FROM agency_payment_submissions sub
  WHERE sub.invoice_id IN (
    SELECT id FROM agency_invoices WHERE client_id = v_client_id AND status != 'Draft'
  );

  -- Fetch confirmed payments
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',              pay.id,
    'invoice_id',      pay.invoice_id,
    'amount',          pay.amount,
    'payment_method',  pay.payment_method,
    'transaction_ref', pay.transaction_ref,
    'payment_date',    pay.payment_date
  ) ORDER BY pay.created_at DESC), '[]'::jsonb)
  INTO v_payments
  FROM agency_payments pay
  WHERE pay.invoice_id IN (
    SELECT id FROM agency_invoices WHERE client_id = v_client_id AND status != 'Draft'
  );

  v_result := jsonb_build_object(
    'client', jsonb_build_object('name', v_client.name, 'company', v_client.company),
    'invoices', v_invoices,
    'submissions', v_submissions,
    'payments', v_payments
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_portal_invoices(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_invoices(text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. request_payment_upload — generates a single-use upload path
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.request_payment_upload(p_token text, p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid;
  v_upload_token text;
  v_inv_status text;
  v_inv_client uuid;
BEGIN
  -- Try client portal token first
  SELECT client_id INTO v_client_id
  FROM agency_portal_tokens
  WHERE token = p_token AND is_active = true;

  -- Fall back to proposal portal token
  IF v_client_id IS NULL THEN
    SELECT client_id INTO v_client_id
    FROM agency_proposals
    WHERE portal_token = p_token AND status != 'Draft';
  END IF;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or inactive portal token');
  END IF;

  -- Validate invoice ownership and status
  SELECT client_id, status INTO v_inv_client, v_inv_status
  FROM agency_invoices
  WHERE id = p_invoice_id;

  IF v_inv_client IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_inv_client != v_client_id THEN
    RETURN jsonb_build_object('error', 'Invoice does not belong to this client');
  END IF;

  IF v_inv_status IN ('Draft', 'Cancelled') THEN
    RETURN jsonb_build_object('error', 'This invoice is not accepting payments');
  END IF;

  -- Generate upload token and authorization
  v_upload_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO agency_upload_authorizations (upload_token, invoice_id, client_id)
  VALUES (v_upload_token, p_invoice_id, v_client_id);

  RETURN jsonb_build_object(
    'upload_token', v_upload_token,
    'path', 'payment-proofs/' || v_upload_token
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_payment_upload(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_payment_upload(text, uuid) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. submit_payment_proof — creates a pending payment submission
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  p_token        text,
  p_invoice_id   uuid,
  p_amount       numeric,
  p_method       text,
  p_ref          text,
  p_note         text,
  p_upload_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id     uuid;
  v_inv_client    uuid;
  v_inv_status    text;
  v_upload        RECORD;
BEGIN
  -- Try client portal token first
  SELECT client_id INTO v_client_id
  FROM agency_portal_tokens
  WHERE token = p_token AND is_active = true;

  -- Fall back to proposal portal token
  IF v_client_id IS NULL THEN
    SELECT client_id INTO v_client_id
    FROM agency_proposals
    WHERE portal_token = p_token AND status != 'Draft';
  END IF;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or inactive portal token');
  END IF;

  -- Validate payment method
  IF p_method NOT IN ('CBE','Telebirr','Bank Transfer','Cash','Other') THEN
    RETURN jsonb_build_object('error', 'Invalid payment method');
  END IF;

  -- Validate amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be greater than zero');
  END IF;

  -- Validate invoice ownership and status
  SELECT client_id, status INTO v_inv_client, v_inv_status
  FROM agency_invoices
  WHERE id = p_invoice_id;

  IF v_inv_client IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_inv_client != v_client_id THEN
    RETURN jsonb_build_object('error', 'Invoice does not belong to this client');
  END IF;

  IF v_inv_status IN ('Draft', 'Cancelled') THEN
    RETURN jsonb_build_object('error', 'This invoice is not accepting payments');
  END IF;

  -- Validate upload token
  SELECT * INTO v_upload
  FROM agency_upload_authorizations
  WHERE upload_token = p_upload_token
    AND is_used = false
    AND expires_at > now()
    AND invoice_id = p_invoice_id
    AND client_id = v_client_id;

  IF v_upload.upload_token IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload authorization');
  END IF;

  -- Mark upload token as used
  UPDATE agency_upload_authorizations
  SET is_used = true
  WHERE upload_token = p_upload_token;

  -- Create the payment submission
  INSERT INTO agency_payment_submissions (
    invoice_id, amount, payment_method, transaction_ref,
    payment_date, notes, receipt_path
  )
  VALUES (
    p_invoice_id, p_amount, p_method, p_ref,
    CURRENT_DATE, p_note, 'payment-proofs/' || p_upload_token
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_payment_proof(text, uuid, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(text, uuid, numeric, text, text, text, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. approve_payment_submission — admin only, creates confirmed payment
-- ═══════════════════════════════════════════════════════════════════════════
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
  -- Admin-only check
  IF auth.uid() != '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Fetch submission
  SELECT * INTO v_submission
  FROM agency_payment_submissions
  WHERE id = p_submission_id;

  IF v_submission.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Submission not found');
  END IF;

  IF v_submission.status != 'Pending' THEN
    RETURN jsonb_build_object('error', 'Submission has already been ' || lower(v_submission.status));
  END IF;

  -- Lock the invoice row
  SELECT * INTO v_invoice
  FROM agency_invoices
  WHERE id = v_submission.invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status IN ('Cancelled', 'Draft') THEN
    RETURN jsonb_build_object('error', 'Cannot approve payment for a ' || lower(v_invoice.status) || ' invoice');
  END IF;

  -- Validate against overpayment
  v_new_paid := v_invoice.paid_amount + v_submission.amount;
  IF v_new_paid > v_invoice.total_amount THEN
    RETURN jsonb_build_object('error', 'Approval would exceed invoice total (remaining: ' || (v_invoice.total_amount - v_invoice.paid_amount)::text || ')');
  END IF;

  -- Create confirmed payment (catch unique_violation for race condition)
  BEGIN
    INSERT INTO agency_payments (
      invoice_id, amount, payment_method, transaction_ref,
      payment_date, notes, source, submission_id
    )
    VALUES (
      v_submission.invoice_id, v_submission.amount, v_submission.payment_method,
      v_submission.transaction_ref, v_submission.payment_date,
      v_submission.notes, 'Submission', p_submission_id
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'This submission has already been approved');
  END;

  -- Mark submission as approved
  UPDATE agency_payment_submissions
  SET status = 'Approved', reviewed_at = now()
  WHERE id = p_submission_id;

  -- The AFTER INSERT trigger on agency_payments will recalculate the invoice balance

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_payment_submission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_payment_submission(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. reject_payment_submission — admin only
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reject_payment_submission(p_submission_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() != '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT status INTO v_status
  FROM agency_payment_submissions
  WHERE id = p_submission_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Submission not found');
  END IF;

  IF v_status != 'Pending' THEN
    RETURN jsonb_build_object('error', 'Submission has already been ' || lower(v_status));
  END IF;

  UPDATE agency_payment_submissions
  SET status = 'Rejected', reviewed_at = now()
  WHERE id = p_submission_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_payment_submission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_payment_submission(uuid, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. record_manual_payment — admin only, creates a confirmed payment directly
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.record_manual_payment(
  p_invoice_id    uuid,
  p_amount        numeric,
  p_method        text,
  p_ref           text,
  p_payment_date  date,
  p_notes         text
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
  IF auth.uid() != '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be greater than zero');
  END IF;

  IF p_method NOT IN ('CBE','Telebirr','Bank Transfer','Cash','Other') THEN
    RETURN jsonb_build_object('error', 'Invalid payment method');
  END IF;

  -- Lock the invoice row
  SELECT * INTO v_invoice
  FROM agency_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status IN ('Cancelled', 'Draft') THEN
    RETURN jsonb_build_object('error', 'Cannot record payment for a ' || lower(v_invoice.status) || ' invoice');
  END IF;

  -- Validate against overpayment
  v_new_paid := v_invoice.paid_amount + p_amount;
  IF v_new_paid > v_invoice.total_amount THEN
    RETURN jsonb_build_object('error', 'Payment would exceed invoice total (remaining: ' || (v_invoice.total_amount - v_invoice.paid_amount)::text || ')');
  END IF;

  -- Create confirmed payment
  INSERT INTO agency_payments (
    invoice_id, amount, payment_method, transaction_ref,
    payment_date, notes, source
  )
  VALUES (
    p_invoice_id, p_amount, p_method, p_ref,
    p_payment_date, p_notes, 'Manual'
  );

  -- The AFTER INSERT trigger will recalculate the invoice balance

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_manual_payment(uuid, numeric, text, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_manual_payment(uuid, numeric, text, text, date, text) TO authenticated;
