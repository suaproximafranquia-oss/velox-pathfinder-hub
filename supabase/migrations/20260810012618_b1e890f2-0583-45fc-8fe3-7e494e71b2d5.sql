ALTER TABLE public.portal_leads
  ADD COLUMN IF NOT EXISTS portal_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_released_by text,
  ADD COLUMN IF NOT EXISTS portal_release_reason text,
  ADD COLUMN IF NOT EXISTS whatsapp_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS journey_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS journey_stage text,
  ADD COLUMN IF NOT EXISTS journey_chapter text,
  ADD COLUMN IF NOT EXISTS journey_first_access_at timestamptz,
  ADD COLUMN IF NOT EXISTS journey_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS journey_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS journey_last_event_at timestamptz;

CREATE TABLE IF NOT EXISTS public.portal_journey_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investor_id text NOT NULL,
  event text NOT NULL,
  module text,
  detail text,
  percent integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portal_journey_events TO authenticated;
GRANT ALL ON public.portal_journey_events TO service_role;

ALTER TABLE public.portal_journey_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe autenticada consulta eventos da jornada" ON public.portal_journey_events;
CREATE POLICY "Equipe autenticada consulta eventos da jornada"
  ON public.portal_journey_events FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS portal_journey_events_investor_idx
  ON public.portal_journey_events (investor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.portal_backup_blobs (
  hash text NOT NULL PRIMARY KEY,
  payload jsonb NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.portal_backup_blobs TO service_role;

ALTER TABLE public.portal_backup_blobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.portal_backups
  ADD COLUMN IF NOT EXISTS payload_hash text,
  ADD COLUMN IF NOT EXISTS protected boolean NOT NULL DEFAULT false;

ALTER TABLE public.portal_backups ALTER COLUMN payload SET DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS portal_backups_created_at_idx
  ON public.portal_backups (created_at DESC);