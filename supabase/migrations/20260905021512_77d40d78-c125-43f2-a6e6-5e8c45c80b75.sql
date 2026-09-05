-- BLOCO 2 — identidade canônica + titularidade. Estritamente aditivo.

-- 1. Código do vendedor na origem GreenSales (reutiliza a tabela de executivos).
ALTER TABLE public.executive_profiles
  ADD COLUMN IF NOT EXISTS greensales_vendor_id text;
CREATE UNIQUE INDEX IF NOT EXISTS executive_profiles_greensales_vendor_uidx
  ON public.executive_profiles (greensales_vendor_id)
  WHERE greensales_vendor_id IS NOT NULL;
COMMENT ON COLUMN public.executive_profiles.greensales_vendor_id IS
  'vendedor_id do GreenSales. NULL = não mapeado: o responsável da origem não é resolvido e o comportamento anterior é preservado.';

-- 2. Histórico de titularidade (append-only, idempotente por change_key).
CREATE TABLE IF NOT EXISTS public.lead_ownership_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id text NOT NULL,
  crm_lead_id uuid,
  canonical_investor_id uuid REFERENCES public.investors(id) ON DELETE SET NULL,
  previous_executive_id text,
  new_executive_id text NOT NULL,
  ownership_seq integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'greensales_sync',
  source_event_id text,
  cadence_cycle_id uuid,
  had_real_human_contact boolean NOT NULL DEFAULT false,
  triggered_new_entry boolean NOT NULL DEFAULT false,
  reason text,
  change_key text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_ownership_history_change_key_uidx
  ON public.lead_ownership_history (change_key);
CREATE INDEX IF NOT EXISTS lead_ownership_history_card_idx
  ON public.lead_ownership_history (card_id, ownership_seq DESC);
CREATE INDEX IF NOT EXISTS lead_ownership_history_investor_idx
  ON public.lead_ownership_history (canonical_investor_id);

GRANT SELECT ON public.lead_ownership_history TO authenticated;
GRANT ALL ON public.lead_ownership_history TO service_role;
ALTER TABLE public.lead_ownership_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ownership history read admin manager" ON public.lead_ownership_history;
CREATE POLICY "ownership history read admin manager"
  ON public.lead_ownership_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_lead_ownership_history_updated_at
  BEFORE UPDATE ON public.lead_ownership_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.lead_ownership_history IS
  'Histórico append-only de titularidade do card. Nunca apaga o responsável anterior; change_key garante idempotência da mesma mudança A→B.';

-- 3. E0 por titularidade: a unicidade passa a ser (card, sequência de titularidade).
ALTER TABLE public.workspace_e0_actions
  ADD COLUMN IF NOT EXISTS ownership_seq integer NOT NULL DEFAULT 0;
ALTER TABLE public.workspace_e0_actions
  ADD COLUMN IF NOT EXISTS ownership_key text;
ALTER TABLE public.workspace_e0_actions
  DROP CONSTRAINT IF EXISTS workspace_e0_actions_card_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS workspace_e0_actions_card_ownership_uidx
  ON public.workspace_e0_actions (card_id, ownership_seq);
COMMENT ON COLUMN public.workspace_e0_actions.ownership_seq IS
  '0 = primeira entrada operacional do card (histórico preservado). N>0 = nova entrada operacional após redistribuição real.';