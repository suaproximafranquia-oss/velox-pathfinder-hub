CREATE TABLE public.whatsapp_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  journey_id text,
  investor_name text,
  status text NOT NULL DEFAULT 'enviado',
  template_name text,
  responded_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_validations_phone_idx ON public.whatsapp_validations (phone, created_at DESC);

GRANT ALL ON public.whatsapp_validations TO service_role;

ALTER TABLE public.whatsapp_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages whatsapp validations"
ON public.whatsapp_validations FOR ALL TO service_role
USING (true) WITH CHECK (true);