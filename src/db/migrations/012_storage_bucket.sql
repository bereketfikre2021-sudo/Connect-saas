-- Migration 012: Storage bucket and policies for payment proof uploads
--
-- IMPORTANT: Create the bucket MANUALLY in the Supabase dashboard first:
--   1. Go to Storage → New bucket
--   2. Bucket ID: agency-payment-proofs
--   3. Public: NO (private)
--   4. File size limit: 10 MB
--   5. Allowed MIME types: image/png, image/jpeg, image/webp, application/pdf
--
-- Then run this SQL to create the storage policies.
-- This file does not modify existing buckets.

-- ── Policy 1: Anon can upload ONLY to paths with a valid upload token ──────
-- The is_valid_upload_token() function (created in migration 010) checks
-- the agency_upload_authorizations table in real-time.
CREATE POLICY "anon_upload_with_valid_token"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'agency-payment-proofs'
    AND (storage.foldername(name))[1] = 'payment-proofs'
    AND public.is_valid_upload_token((storage.foldername(name))[2])
  );

-- ── Policy 2: Admin can read all files ─────────────────────────────────────
CREATE POLICY "admin_read_payment_proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'agency-payment-proofs'
    AND auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid
  );

-- ── Policy 3: Admin can delete files ────────────────────────────────────────
CREATE POLICY "admin_delete_payment_proofs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agency-payment-proofs'
    AND auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid
  );

-- No UPDATE policy — files cannot be overwritten by any role.
-- No anon SELECT or DELETE — anonymous users can only upload to authorized paths.
