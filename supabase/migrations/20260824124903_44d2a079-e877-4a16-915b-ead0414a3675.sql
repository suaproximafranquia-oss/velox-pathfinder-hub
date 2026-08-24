-- ============================================================
-- BLINDAGEM DEFINITIVA DOS LEADS DO PORTAL
-- Um Lead registrado no Portal dos Leads NUNCA pode ser excluído.
-- Única exceção: registros marcadamente de teste (is_test / TEST-),
-- usados pelas rotinas de homologação controlada.
-- ============================================================

-- 1) Auditoria de tentativas bloqueadas ---------------------------
CREATE TABLE public.portal_lead_guard_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  lead_id text,
  lead_name text,
  operation text NOT NULL,
  actor_user_id uuid,
  actor_label text,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Auditoria: leitura para gestão, escrita apenas pela trava (dono).
GRANT SELECT ON public.portal_lead_guard_log TO authenticated;
GRANT ALL ON public.portal_lead_guard_log TO service_role;

ALTER TABLE public.portal_lead_guard_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e gestores leem a auditoria de protecao"
  ON public.portal_lead_guard_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 2) Trava de exclusão (última linha de defesa, à prova de rotinas) --
CREATE OR REPLACE FUNCTION public.guard_lead_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Limpeza de homologação: somente registros marcadamente de teste.
  IF COALESCE(OLD.is_test, false) OR OLD.id::text ILIKE 'TEST-%' THEN
    RETURN OLD;
  END IF;
  INSERT INTO public.portal_lead_guard_log
    (table_name, lead_id, lead_name, operation, actor_user_id, actor_label, reason)
  VALUES (
    TG_TABLE_NAME,
    OLD.id::text,
    COALESCE(OLD.name, '—'),
    'delete',
    auth.uid(),
    COALESCE(auth.jwt() ->> 'email', 'servidor'),
    'Lead já registrado no Portal — exclusão proibida pela blindagem definitiva.'
  );
  RAISE EXCEPTION 'Os Leads do Portal estão protegidos contra reset e exclusão. Esta operação não pode remover Leads já registrados.';
END;
$$;

CREATE TRIGGER guard_portal_leads_delete
  BEFORE DELETE ON public.portal_leads
  FOR EACH ROW EXECUTE FUNCTION public.guard_lead_delete();

CREATE TRIGGER guard_crm_leads_delete
  BEFORE DELETE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.guard_lead_delete();

-- 3) Trava contra esvaziamento total ------------------------------
CREATE OR REPLACE FUNCTION public.guard_lead_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.portal_lead_guard_log
    (table_name, lead_id, lead_name, operation, actor_user_id, actor_label, reason)
  VALUES (
    TG_TABLE_NAME,
    NULL,
    NULL,
    'truncate',
    auth.uid(),
    COALESCE(auth.jwt() ->> 'email', 'servidor'),
    'Tentativa de esvaziamento total bloqueada pela blindagem definitiva.'
  );
  RAISE EXCEPTION 'Os Leads do Portal estão protegidos contra reset e exclusão. Esta operação não pode remover Leads já registrados.';
END;
$$;

CREATE TRIGGER guard_portal_leads_truncate
  BEFORE TRUNCATE ON public.portal_leads
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_lead_truncate();

CREATE TRIGGER guard_crm_leads_truncate
  BEFORE TRUNCATE ON public.crm_leads
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_lead_truncate();

-- 4) Remoção da permissão de exclusão que existia ------------------
DROP POLICY IF EXISTS "Responsavel ou admin exclui leads" ON public.portal_leads;
REVOKE DELETE ON public.portal_leads FROM authenticated, anon;
REVOKE DELETE ON public.crm_leads FROM authenticated, anon;