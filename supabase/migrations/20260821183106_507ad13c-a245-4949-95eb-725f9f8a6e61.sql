ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_batch_id text;

ALTER TABLE public.portal_leads
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_batch_id text;

CREATE INDEX IF NOT EXISTS crm_leads_test_batch_idx ON public.crm_leads (test_batch_id) WHERE is_test;
CREATE INDEX IF NOT EXISTS portal_leads_test_batch_idx ON public.portal_leads (test_batch_id) WHERE is_test;

CREATE TABLE IF NOT EXISTS public.test_batches (
  id text PRIMARY KEY,
  label text NOT NULL,
  scenarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'ATIVO',
  lead_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT 'sistema',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.test_batches TO authenticated;
GRANT ALL ON public.test_batches TO service_role;

ALTER TABLE public.test_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal members can read test batches"
ON public.test_batches FOR SELECT TO authenticated
USING (public.is_portal_member());

CREATE TRIGGER test_batches_updated
BEFORE UPDATE ON public.test_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();