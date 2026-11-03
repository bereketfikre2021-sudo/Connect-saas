-- ===========================================================================
-- Migration 021: Migrate admin storage policies to public.is_admin()
-- ===========================================================================
-- PENDING REVIEW — NOT YET APPLIED. Run AFTER 019 and 020.
-- Run as: postgres / service role.
--
-- Live policies confirmed (from pg_policies on the Connect SaaS database):
--
-- MIGRATED (UUID -> is_admin()):
--   admin_delete_payment_proofs  DELETE  authenticated  bucket=agency-payment-proofs
--   admin_read_payment_proofs    SELECT  authenticated  bucket=agency-payment-proofs
--
-- PRESERVED EXACTLY (no UUID guard, no change):
--   anon_upload_receipts         INSERT  anon           bucket=payment-receipts
--   anon_upload_with_valid_token INSERT  anon           bucket=agency-payment-proofs
--                                                        + folder + token check
--
-- NOT touched: agency-files bucket (no UUID policies exist in live DB).
-- ===========================================================================

BEGIN;

-- ── Migrate admin_read_payment_proofs (SELECT) ──────────────────────────────
-- Old USING: (bucket_id = 'agency-payment-proofs') AND (auth.uid() = '9705...')
-- New USING: (bucket_id = 'agency-payment-proofs') AND public.is_admin()
DROP POLICY "admin_read_payment_proofs" ON storage.objects;
CREATE POLICY "admin_read_payment_proofs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'agency-payment-proofs'::text
    AND public.is_admin()
  );

-- ── Migrate admin_delete_payment_proofs (DELETE) ────────────────────────────
-- Old USING: (bucket_id = 'agency-payment-proofs') AND (auth.uid() = '9705...')
-- New USING: (bucket_id = 'agency-payment-proofs') AND public.is_admin()
DROP POLICY "admin_delete_payment_proofs" ON storage.objects;
CREATE POLICY "admin_delete_payment_proofs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agency-payment-proofs'::text
    AND public.is_admin()
  );

-- ── anon_upload_receipts — PRESERVED, NOT TOUCHED ───────────────────────────
-- INSERT  anon  WITH CHECK: (bucket_id = 'payment-receipts'::text)
-- No UUID guard; no change required.

-- ── anon_upload_with_valid_token — PRESERVED, NOT TOUCHED ───────────────────
-- INSERT  anon  WITH CHECK:
--   (bucket_id = 'agency-payment-proofs'::text)
--   AND ((storage.foldername(name))[1] = 'payment-proofs'::text)
--   AND is_valid_upload_token((storage.foldername(name))[2])
-- No UUID guard; no change required.

COMMIT;

NOTIFY pgrst, 'reload schema';
