-- Migration 002: Create projects table
-- Run this in the Supabase SQL editor AFTER running 001_create_clients.sql.

CREATE TABLE public.projects (
  id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
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

CREATE INDEX projects_client_id_idx ON public.projects(client_id);
CREATE INDEX projects_status_idx    ON public.projects(status);

-- Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated admins only"
  ON public.projects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Reuse the handle_updated_at() function created in migration 001
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
