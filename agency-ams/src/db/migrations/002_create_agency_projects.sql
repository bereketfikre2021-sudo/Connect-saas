-- Migration 002: Create agency_projects table
-- Run this in the Supabase SQL editor AFTER running 001_create_agency_clients.sql.
-- This is an additive migration — it does not modify any existing tables,
-- functions, policies, or data.

CREATE TABLE public.agency_projects (
  id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid          NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  title       text          NOT NULL,
  description text,
  service     text          NOT NULL DEFAULT '',
  budget      numeric(12,2),
  start_date  date,
  deadline    date,
  status      text          NOT NULL DEFAULT 'Pending'
                            CHECK (status IN ('Pending', 'In Progress', 'Completed', 'On Hold')),
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX agency_projects_client_id_idx ON public.agency_projects(client_id);
CREATE INDEX agency_projects_status_idx    ON public.agency_projects(status);

-- Row Level Security
ALTER TABLE public.agency_projects ENABLE ROW LEVEL SECURITY;

-- SELECT: admin only
CREATE POLICY "agency_projects: admin select"
  ON public.agency_projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = '8662a535-fa9b-4e26-8c5d-193992607121'::uuid);

-- INSERT: admin only
CREATE POLICY "agency_projects: admin insert"
  ON public.agency_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = '8662a535-fa9b-4e26-8c5d-193992607121'::uuid);

-- UPDATE: admin only
CREATE POLICY "agency_projects: admin update"
  ON public.agency_projects
  FOR UPDATE
  TO authenticated
  USING     (auth.uid() = '8662a535-fa9b-4e26-8c5d-193992607121'::uuid)
  WITH CHECK (auth.uid() = '8662a535-fa9b-4e26-8c5d-193992607121'::uuid);

-- DELETE: admin only
CREATE POLICY "agency_projects: admin delete"
  ON public.agency_projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = '8662a535-fa9b-4e26-8c5d-193992607121'::uuid);

-- Reuse the agency_handle_updated_at() function created in migration 001.
CREATE TRIGGER agency_projects_updated_at
  BEFORE UPDATE ON public.agency_projects
  FOR EACH ROW
  EXECUTE PROCEDURE public.agency_handle_updated_at();
