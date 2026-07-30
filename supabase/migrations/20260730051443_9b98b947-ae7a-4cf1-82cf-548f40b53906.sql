CREATE TABLE public.portal_leads (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT 'Portal Velox',
  material text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT 'portal' CHECK (scope IN ('green_sales','portal')),
  personalized boolean NOT NULL DEFAULT false,
  responsible_executive_id text,
  responsible_executive_slug text,
  campaign text,
  device text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  journey jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portal_leads_scope_idx ON public.portal_leads (scope, created_at DESC);
CREATE INDEX portal_leads_email_idx ON public.portal_leads (lower(email));

GRANT SELECT ON public.portal_leads TO authenticated;
GRANT ALL ON public.portal_leads TO service_role;

ALTER TABLE public.portal_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executives can read all portal leads"
  ON public.portal_leads FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_portal_leads_updated_at
BEFORE UPDATE ON public.portal_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.portal_leads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_leads;