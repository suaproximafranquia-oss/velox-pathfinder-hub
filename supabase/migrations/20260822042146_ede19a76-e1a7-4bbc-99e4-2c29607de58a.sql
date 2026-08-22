ALTER TABLE public.test_batches
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'cenarios',
  ADD COLUMN IF NOT EXISTS seed text,
  ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

CREATE TABLE IF NOT EXISTS public.test_batch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL REFERENCES public.test_batches(id) ON DELETE CASCADE,
  entry_type text NOT NULL,
  slot text NOT NULL,
  position integer NOT NULL,
  external_id text NOT NULL,
  lead_name text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE',
  attempts integer NOT NULL DEFAULT 0,
  created_lead_at timestamptz,
  executed_at timestamptz,
  e0_result text,
  e0_reason text,
  card_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, external_id)
);

GRANT SELECT ON public.test_batch_events TO authenticated;
GRANT ALL ON public.test_batch_events TO service_role;
ALTER TABLE public.test_batch_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administradores leem eventos do lote de teste"
  ON public.test_batch_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER test_batch_events_updated
  BEFORE UPDATE ON public.test_batch_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();