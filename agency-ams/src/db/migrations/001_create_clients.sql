-- Migration 001: Create clients table
-- Run this in the Supabase SQL editor for your project.

CREATE TABLE public.clients (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text        NOT NULL,
  company    text        NOT NULL DEFAULT '',
  email      text        NOT NULL DEFAULT '',
  phone      text        NOT NULL DEFAULT '',
  location   text        NOT NULL DEFAULT '',
  notes      text,
  is_archived boolean    NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated admins only"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
