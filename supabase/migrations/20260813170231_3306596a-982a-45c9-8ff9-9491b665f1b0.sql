ALTER TABLE public.portal_leads
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_payload jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS portal_leads_external_unique
  ON public.portal_leads (external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;