CREATE TABLE public.remarketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_name text NOT NULL,
  template_label text NOT NULL DEFAULT '',
  template_language text,
  template_body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'rascunho',
  total_count integer NOT NULL DEFAULT 0,
  valid_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  started_at timestamptz,
  finished_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.remarketing_campaigns TO authenticated;
GRANT ALL ON public.remarketing_campaigns TO service_role;
ALTER TABLE public.remarketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portal members manage remarketing campaigns"
  ON public.remarketing_campaigns FOR ALL TO authenticated
  USING (public.is_portal_member()) WITH CHECK (public.is_portal_member());

CREATE TRIGGER remarketing_campaigns_updated
  BEFORE UPDATE ON public.remarketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.remarketing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.remarketing_campaigns(id) ON DELETE CASCADE,
  phone text NOT NULL,
  raw_input text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX remarketing_contacts_campaign_status_idx
  ON public.remarketing_contacts (campaign_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.remarketing_contacts TO authenticated;
GRANT ALL ON public.remarketing_contacts TO service_role;
ALTER TABLE public.remarketing_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portal members manage remarketing contacts"
  ON public.remarketing_contacts FOR ALL TO authenticated
  USING (public.is_portal_member()) WITH CHECK (public.is_portal_member());

CREATE TRIGGER remarketing_contacts_updated
  BEFORE UPDATE ON public.remarketing_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

SELECT cron.schedule(
  'remarketing-engine',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--ce3eb05c-3308-4ff2-9b94-650cb0170e82.lovable.app/api/public/remarketing/run',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_yYU36XwHhVrFJEoUpdNuFQ_6eeoi77U"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);