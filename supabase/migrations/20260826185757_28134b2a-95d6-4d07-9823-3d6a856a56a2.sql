-- =====================================================================
-- MOTOR DE RELACIONAMENTO — FUNDAÇÃO (100% ADITIVA)
-- Nenhum DROP, nenhum DELETE, nenhuma coluna removida.
-- =====================================================================

-- 1) INSTÂNCIAS DE CADÊNCIA -------------------------------------------
ALTER TABLE public.relationship_cadences
  ADD COLUMN IF NOT EXISTS instance_seq integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS opened_reason text,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

CREATE INDEX IF NOT EXISTS relationship_cadences_active_idx
  ON public.relationship_cadences (scope, lead_id, active);

-- 2) OCORRÊNCIAS E20 ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relationship_e20_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'production',
  lead_id text NOT NULL,
  cadence_id uuid,
  instance_seq integer NOT NULL DEFAULT 1,
  token text NOT NULL,
  link_url text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  generated_by uuid,
  generated_by_name text NOT NULL DEFAULT 'sistema',
  generated_by_executive_id text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  first_opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  checkpoint_due_at timestamptz,
  checkpoint_done_at timestamptz,
  finalization_due_on date,
  finalization_done_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS relationship_e20_token_idx
  ON public.relationship_e20_occurrences (token);
CREATE INDEX IF NOT EXISTS relationship_e20_lead_idx
  ON public.relationship_e20_occurrences (lead_id, status);

GRANT SELECT ON public.relationship_e20_occurrences TO authenticated;
GRANT ALL ON public.relationship_e20_occurrences TO service_role;
ALTER TABLE public.relationship_e20_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "E20 visível para colaboradores do portal"
  ON public.relationship_e20_occurrences FOR SELECT TO authenticated
  USING (public.is_portal_member());

CREATE TRIGGER relationship_e20_updated
  BEFORE UPDATE ON public.relationship_e20_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) ACESSOS AO LINK E20 ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.relationship_e20_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid NOT NULL REFERENCES public.relationship_e20_occurrences(id),
  lead_id text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  outcome text NOT NULL DEFAULT 'OK',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS relationship_e20_accesses_occ_idx
  ON public.relationship_e20_accesses (occurrence_id, accessed_at DESC);

GRANT SELECT ON public.relationship_e20_accesses TO authenticated;
GRANT ALL ON public.relationship_e20_accesses TO service_role;
ALTER TABLE public.relationship_e20_accesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acessos E20 visíveis para colaboradores do portal"
  ON public.relationship_e20_accesses FOR SELECT TO authenticated
  USING (public.is_portal_member());

-- 4) BIBLIOTECA OFICIAL DE MENSAGENS ----------------------------------
CREATE TABLE IF NOT EXISTS public.relationship_message_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'production',
  purpose text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  body text NOT NULL,
  content_group text,
  requires_video boolean NOT NULL DEFAULT false,
  requires_template boolean NOT NULL DEFAULT false,
  meta_template_name text,
  active boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT 'sistema',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS relationship_message_library_version_idx
  ON public.relationship_message_library (scope, purpose, version);
CREATE UNIQUE INDEX IF NOT EXISTS relationship_message_library_active_idx
  ON public.relationship_message_library (scope, purpose) WHERE active;

GRANT SELECT ON public.relationship_message_library TO authenticated;
GRANT INSERT, UPDATE ON public.relationship_message_library TO authenticated;
GRANT ALL ON public.relationship_message_library TO service_role;
ALTER TABLE public.relationship_message_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Biblioteca visível para colaboradores"
  ON public.relationship_message_library FOR SELECT TO authenticated
  USING (public.is_portal_member());

CREATE POLICY "Gestão cria versões da biblioteca"
  ON public.relationship_message_library FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Gestão atualiza versões da biblioteca"
  ON public.relationship_message_library FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER relationship_message_library_updated
  BEFORE UPDATE ON public.relationship_message_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) ENVIOS CONGELADOS (SNAPSHOT IMUTÁVEL) -----------------------------
CREATE TABLE IF NOT EXISTS public.relationship_message_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'production',
  lead_id text NOT NULL,
  cadence_id uuid,
  instance_seq integer NOT NULL DEFAULT 1,
  step text NOT NULL,
  purpose text NOT NULL,
  library_id uuid,
  library_version integer,
  rendered_body text NOT NULL,
  content_id uuid,
  content_url text,
  meta_template_name text,
  channel text NOT NULL DEFAULT 'whatsapp',
  simulated boolean NOT NULL DEFAULT false,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS relationship_message_sends_lead_idx
  ON public.relationship_message_sends (lead_id, sent_at DESC);

GRANT SELECT ON public.relationship_message_sends TO authenticated;
GRANT ALL ON public.relationship_message_sends TO service_role;
ALTER TABLE public.relationship_message_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Envios congelados visíveis para colaboradores"
  ON public.relationship_message_sends FOR SELECT TO authenticated
  USING (public.is_portal_member());

-- 6) WHATSAPP DO EXECUTIVO --------------------------------------------
ALTER TABLE public.executive_profiles
  ADD COLUMN IF NOT EXISTS whatsapp text;

-- 7) CONTROLE DA RESPOSTA AUTOMÁTICA NA JANELA DE 24H ------------------
ALTER TABLE public.relationship_cadences
  ADD COLUMN IF NOT EXISTS auto_reply_window_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_reply_window_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_reply_total_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_reply_last_at timestamptz;

-- 8) PRECEDÊNCIA DA EDIÇÃO MANUAL --------------------------------------
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.portal_leads
  ADD COLUMN IF NOT EXISTS manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;