CREATE TABLE public.crm_messages (
  id text PRIMARY KEY,
  investor_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('enviada','recebida')),
  body text NOT NULL,
  author_id text NOT NULL,
  author_name text,
  at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_messages_investor ON public.crm_messages (investor_id, at);
GRANT SELECT, INSERT ON public.crm_messages TO authenticated;
GRANT ALL ON public.crm_messages TO service_role;
ALTER TABLE public.crm_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem mensagens do CRM" ON public.crm_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados registram mensagens do CRM" ON public.crm_messages FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.crm_timeline (
  id text PRIMARY KEY,
  investor_id text NOT NULL,
  event text NOT NULL,
  origin text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  owner_id text,
  actor_id text,
  at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_timeline_investor ON public.crm_timeline (investor_id, at DESC);
GRANT SELECT, INSERT ON public.crm_timeline TO authenticated;
GRANT ALL ON public.crm_timeline TO service_role;
ALTER TABLE public.crm_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem a timeline do CRM" ON public.crm_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados registram a timeline do CRM" ON public.crm_timeline FOR INSERT TO authenticated WITH CHECK (true);