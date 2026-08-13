-- ============ Funis e etapas ============
CREATE TABLE public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_source text NOT NULL DEFAULT 'greensales',
  external_id text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_source, external_id)
);
GRANT SELECT ON public.crm_pipelines TO authenticated;
GRANT ALL ON public.crm_pipelines TO service_role;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_pipelines_read" ON public.crm_pipelines FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TABLE public.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  external_tag text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_entry boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, external_tag),
  UNIQUE (pipeline_id, key)
);
GRANT SELECT ON public.crm_pipeline_stages TO authenticated;
GRANT ALL ON public.crm_pipeline_stages TO service_role;
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_pipeline_stages_read" ON public.crm_pipeline_stages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- ============ Leads próprios ============
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_source text NOT NULL DEFAULT 'greensales',
  external_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  origin text,
  capture_form text,
  external_pipeline_id text,
  pipeline_name text,
  stage_key text,
  external_stage_id text,
  external_created_at timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'OK',
  sync_error text,
  welcome_status text NOT NULL DEFAULT 'PENDING',
  welcome_started_at timestamptz,
  welcome_sent_at timestamptz,
  welcome_template text,
  welcome_link text,
  welcome_error text,
  welcome_attempts integer NOT NULL DEFAULT 0,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_source, external_id)
);
CREATE INDEX crm_leads_stage_idx ON public.crm_leads (stage_key, external_created_at DESC);
GRANT SELECT ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_leads_read" ON public.crm_leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Histórico ============
CREATE TABLE public.crm_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_lead_events_lead_idx ON public.crm_lead_events (lead_id, created_at DESC);
GRANT SELECT ON public.crm_lead_events TO authenticated;
GRANT ALL ON public.crm_lead_events TO service_role;
ALTER TABLE public.crm_lead_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_lead_events_read" ON public.crm_lead_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- ============ Observabilidade ============
CREATE TABLE public.crm_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL DEFAULT 'automatico',
  status text NOT NULL DEFAULT 'executando',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  found_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  welcome_sent_count integer NOT NULL DEFAULT 0,
  welcome_failed_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_sync_runs_started_idx ON public.crm_sync_runs (started_at DESC);
GRANT SELECT ON public.crm_sync_runs TO authenticated;
GRANT ALL ON public.crm_sync_runs TO service_role;
ALTER TABLE public.crm_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_sync_runs_read" ON public.crm_sync_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- ============ Configuração da automação ============
CREATE TABLE public.crm_automation_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  sync_interval_minutes integer NOT NULL DEFAULT 5,
  welcome_enabled boolean NOT NULL DEFAULT true,
  welcome_template_id text NOT NULL DEFAULT 'envio_manual',
  welcome_body text,
  material_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crm_automation_settings TO authenticated;
GRANT ALL ON public.crm_automation_settings TO service_role;
ALTER TABLE public.crm_automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_automation_settings_read" ON public.crm_automation_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER update_crm_automation_settings_updated_at BEFORE UPDATE ON public.crm_automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.crm_automation_settings (id) VALUES (true);

-- ============ Mapeamento externo (funil 2 — Velox Financeira) ============
INSERT INTO public.crm_pipelines (external_source, external_id, name)
VALUES ('greensales', '2', 'Velox Financeira');

INSERT INTO public.crm_pipeline_stages (pipeline_id, key, label, external_tag, position, is_entry, visible)
SELECT p.id, s.key, s.label, s.tag, s.pos, s.entry, s.vis
FROM public.crm_pipelines p,
(VALUES
  ('novos','NOVOS','26',1,true,true),
  ('zero_contato','ZERO CONTATO','57',2,false,false),
  ('frio','FRIO','7',3,false,false),
  ('agendamentos','AGENDAMENTOS','28',4,false,false),
  ('oportunidades','OPORTUNIDADES','33',5,false,false),
  ('video','VÍDEO','27',6,false,false),
  ('cof_contrato','COF/CONTRATO','14',7,false,false),
  ('pagamento','PAGAMENTO','43',8,false,false),
  ('remarketing','REMARKETING','5',9,false,false),
  ('vencemos','VENCEMOS','41',10,false,false),
  ('finalizado','FINALIZADO','19',11,false,false)
) AS s(key,label,tag,pos,entry,vis)
WHERE p.external_source = 'greensales' AND p.external_id = '2';