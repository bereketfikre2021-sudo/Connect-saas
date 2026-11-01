-- Migration 001: Create agency_clients table
-- Run this in the Supabase SQL editor for your project.
-- This is an additive migration — it does not modify any existing tables,
-- functions, policies, or data.

CREATE TABLE public.agency_clients (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  company     text        NOT NULL DEFAULT '',
  email       text        NOT NULL DEFAULT '',
  phone       text        NOT NULL DEFAULT '',
  location    text        NOT NULL DEFAULT '',
  notes       text,
  is_archived boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.agency_clients ENABLE ROW LEVEL SECURITY;

-- SELECT: admin only
CREATE POLICY "agency_clients: admin select"
  ON public.agency_clients
  FOR SELECT
  TO authenticated
  USING (auth.uid() = '8662a535-fa9b-4e26-8c5d-193992607121'::uuid);

-- INSERT: admin only
CREATE POLICY "agency_clients: admin insert"
  ON public.agency_clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = '8662a535-fa9b-4e26-8c5d-193992607121'::uuid);

-- UPDATE: admin only
CREATE POLICY "agency_clients: admin update"
  ON public.agency_clients
  FOR UPDATE
  TO authenticated
  USING     (auth.uid() = '8662a535-fa9b-4e26-8c5d-193992607121'::uuid)
  WITH CHECK (auth.uid() = '8662a535-fa9b-4e26-8c5d-193992607121'::uuid);

-- DELETE: admin only
CREATE POLICY "agency_clients: admin delete"
  ON public.agency_clients
  FOR DELETE
  TO authenticated
  USING (auth.uid() = '8662a535-fa9b-4e26-8c5d-193992607121'::uuid);

-- Auto-update updated_at on every row change.
-- Function is namespaced with agency_ prefix to avoid colliding with any
-- existing handle_updated_at() function in the project.
CREATE OR REPLACE FUNCTION public.agency_handle_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER agency_clients_updated_at
  BEFORE UPDATE ON public.agency_clients
  FOR EACH ROW
  EXECUTE PROCEDURE public.agency_handle_updated_at();
