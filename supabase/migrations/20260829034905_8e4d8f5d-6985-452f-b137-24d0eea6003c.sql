CREATE TABLE public.group_unit_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit text NOT NULL CHECK (unit IN ('solar','seguros')),
  name text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  city text,
  investment_range text NOT NULL CHECK (investment_range IN ('10_20','20_30','acima_30')),
  origin text,
  campaign text,
  status text NOT NULL DEFAULT 'novo',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_unit_leads TO authenticated;
GRANT ALL ON public.group_unit_leads TO service_role;

ALTER TABLE public.group_unit_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace autenticado gerencia interessados das unidades"
ON public.group_unit_leads
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_group_unit_leads_updated_at
BEFORE UPDATE ON public.group_unit_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_group_unit_leads_unit_created ON public.group_unit_leads (unit, created_at DESC);