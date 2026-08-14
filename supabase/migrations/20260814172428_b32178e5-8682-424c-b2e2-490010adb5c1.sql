ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS last_entry_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS entry_count integer NOT NULL DEFAULT 1;

UPDATE public.crm_leads
   SET last_entry_at = COALESCE(external_created_at, ingested_at)
 WHERE last_entry_at IS NULL;

CREATE INDEX IF NOT EXISTS crm_leads_last_entry_at_idx ON public.crm_leads (last_entry_at DESC);