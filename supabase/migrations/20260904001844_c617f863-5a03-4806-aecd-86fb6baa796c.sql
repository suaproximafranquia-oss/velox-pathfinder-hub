-- FASE 1 — Fundação de identidade canônica. Estritamente aditiva.

CREATE TABLE public.investors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  identity_key TEXT,
  phones TEXT[] NOT NULL DEFAULT '{}',
  emails TEXT[] NOT NULL DEFAULT '{}',
  merged_into_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  merged_at TIMESTAMPTZ,
  merged_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX investors_identity_key_uidx ON public.investors (identity_key) WHERE identity_key IS NOT NULL;

GRANT SELECT ON public.investors TO authenticated;
GRANT ALL ON public.investors TO service_role;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investors_read_admin_manager" ON public.investors
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TABLE public.investor_identifiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('greensales','portal','tiktok','meta','manual')),
  external_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT investor_identifiers_source_external_uk UNIQUE (source, external_id)
);
CREATE INDEX investor_identifiers_investor_idx ON public.investor_identifiers (investor_id);

GRANT SELECT ON public.investor_identifiers TO authenticated;
GRANT ALL ON public.investor_identifiers TO service_role;
ALTER TABLE public.investor_identifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investor_identifiers_read_admin_manager" ON public.investor_identifiers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_investors_updated_at BEFORE UPDATE ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_investor_identifiers_updated_at BEFORE UPDATE ON public.investor_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vínculo canônico opcional. O identificador textual antigo permanece intacto
-- em todas as tabelas; por isso a coluna nova tem nome próprio.
ALTER TABLE public.crm_leads               ADD COLUMN canonical_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL;
ALTER TABLE public.portal_leads            ADD COLUMN canonical_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL;
ALTER TABLE public.relationship_queue      ADD COLUMN canonical_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL;
ALTER TABLE public.relationship_cadences   ADD COLUMN canonical_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL;
ALTER TABLE public.crm_cadence_tasks       ADD COLUMN canonical_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL;
ALTER TABLE public.crm_timeline            ADD COLUMN canonical_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL;
ALTER TABLE public.relationship_engine_log ADD COLUMN canonical_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL;
ALTER TABLE public.workspace_e0_actions    ADD COLUMN canonical_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL;

CREATE INDEX crm_leads_canonical_investor_idx    ON public.crm_leads (canonical_investor_id);
CREATE INDEX portal_leads_canonical_investor_idx ON public.portal_leads (canonical_investor_id);
CREATE INDEX crm_timeline_canonical_investor_idx ON public.crm_timeline (canonical_investor_id);

-- Ambiente comercial. NULL = LEGADO (anterior ao marco de ativação): nenhum
-- registro histórico recebe ambiente artificialmente.
ALTER TABLE public.crm_leads ADD COLUMN environment TEXT
  CHECK (environment IS NULL OR environment IN ('financeira','solar','seguros'));
CREATE INDEX crm_leads_environment_idx ON public.crm_leads (environment, canonical_investor_id);

COMMENT ON TABLE  public.investors IS 'Identidade canônica da pessoa. Sem ambiente, origem, responsável, estágio, cadência ou qualquer dado operacional.';
COMMENT ON TABLE  public.investor_identifiers IS 'Identificadores de origem (gs_*, ld_*, etc.) apontando para o investidor canônico. Não substitui nem apaga os identificadores antigos.';
COMMENT ON COLUMN public.crm_leads.environment IS 'Ambiente comercial da oportunidade. NULL = legado anterior ao marco de ativação; obrigatório apenas para oportunidades criadas pela nova arquitetura.';