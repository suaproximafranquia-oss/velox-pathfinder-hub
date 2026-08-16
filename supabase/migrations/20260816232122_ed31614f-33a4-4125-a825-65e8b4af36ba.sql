-- MOTOR DE RELACIONAMENTO (COMANDO 2A) — estrutura isolada por ambiente.
-- Nenhuma tabela existente é alterada. Produção e homologação convivem na
-- mesma estrutura separadas pela coluna scope + run_id.

CREATE TABLE public.relationship_cadences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('production','homologation')),
  run_id TEXT,
  lead_id TEXT NOT NULL,
  state TEXT NOT NULL,
  previous_state TEXT,
  flow TEXT NOT NULL,
  current_step TEXT,
  executed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  started_by TEXT,
  last_event_type TEXT,
  last_event_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  last_executive_reply_at TIMESTAMPTZ,
  window_open_until TIMESTAMPTZ,
  read_count INTEGER NOT NULL DEFAULT 0,
  response_count INTEGER NOT NULL DEFAULT 0,
  scheduled BOOLEAN NOT NULL DEFAULT false,
  name_confirmed BOOLEAN NOT NULL DEFAULT false,
  content_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  opening_template_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX relationship_cadences_key
  ON public.relationship_cadences (scope, coalesce(run_id,''), lead_id);

CREATE TABLE public.relationship_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('production','homologation')),
  run_id TEXT,
  lead_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  type TEXT NOT NULL,
  step TEXT,
  template_id TEXT,
  content_id TEXT,
  historical BOOLEAN NOT NULL DEFAULT false,
  occurred_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX relationship_events_key ON public.relationship_events (scope, event_key);
CREATE INDEX relationship_events_lead ON public.relationship_events (scope, lead_id, occurred_at);

CREATE TABLE public.relationship_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('production','homologation')),
  run_id TEXT,
  lead_id TEXT NOT NULL,
  flow TEXT NOT NULL,
  step TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PROCESSING','EXECUTED','BLOCKED','CANCELLED','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ,
  result TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX relationship_queue_step
  ON public.relationship_queue (scope, coalesce(run_id,''), lead_id, step);
CREATE INDEX relationship_queue_due ON public.relationship_queue (scope, status, due_at);

CREATE TABLE public.relationship_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('production','homologation')),
  run_id TEXT,
  lead_id TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  step TEXT,
  flow TEXT NOT NULL,
  state_before TEXT NOT NULL,
  state_after TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reason TEXT NOT NULL,
  template_id TEXT,
  template_version INTEGER,
  content_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX relationship_decisions_lead
  ON public.relationship_decisions (scope, lead_id, decided_at DESC);

CREATE TABLE public.relationship_template_bindings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('production','homologation')),
  purpose TEXT NOT NULL,
  template_id UUID REFERENCES public.crm_meta_templates(id) ON DELETE SET NULL,
  meta_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  approved BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX relationship_template_bindings_key
  ON public.relationship_template_bindings (scope, purpose);

CREATE TABLE public.relationship_contents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'production' CHECK (scope IN ('production','homologation')),
  content_group TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('imagem','video','pdf','arquivo','link')),
  url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX relationship_contents_group ON public.relationship_contents (scope, content_group, active);

CREATE TABLE public.relationship_engine_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('production','homologation')),
  action TEXT NOT NULL,
  actor TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.relationship_cadences TO authenticated;
GRANT SELECT ON public.relationship_events TO authenticated;
GRANT SELECT ON public.relationship_queue TO authenticated;
GRANT SELECT ON public.relationship_decisions TO authenticated;
GRANT SELECT ON public.relationship_template_bindings TO authenticated;
GRANT SELECT ON public.relationship_contents TO authenticated;
GRANT SELECT ON public.relationship_engine_log TO authenticated;
GRANT ALL ON public.relationship_cadences TO service_role;
GRANT ALL ON public.relationship_events TO service_role;
GRANT ALL ON public.relationship_queue TO service_role;
GRANT ALL ON public.relationship_decisions TO service_role;
GRANT ALL ON public.relationship_template_bindings TO service_role;
GRANT ALL ON public.relationship_contents TO service_role;
GRANT ALL ON public.relationship_engine_log TO service_role;

ALTER TABLE public.relationship_cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_template_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_engine_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada consulta cadências" ON public.relationship_cadences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe autenticada consulta eventos" ON public.relationship_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe autenticada consulta fila" ON public.relationship_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe autenticada consulta decisões" ON public.relationship_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe autenticada consulta vínculos" ON public.relationship_template_bindings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe autenticada consulta conteúdos" ON public.relationship_contents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe autenticada consulta log do motor" ON public.relationship_engine_log FOR SELECT TO authenticated USING (true);