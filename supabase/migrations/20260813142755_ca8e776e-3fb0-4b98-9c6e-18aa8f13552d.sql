
-- creative_templates: escrita restrita a admin/manager
DROP POLICY IF EXISTS creative_templates_write ON public.creative_templates;
CREATE POLICY creative_templates_write ON public.creative_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- helper: o usuário pode acessar registros do investidor?
CREATE OR REPLACE FUNCTION public.can_access_investor(_investor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR EXISTS (
        SELECT 1 FROM public.portal_leads l
        WHERE l.id = _investor_id
          AND l.responsible_executive_id IS NOT NULL
          AND l.responsible_executive_id = public.current_executive_id()
      );
$$;

REVOKE ALL ON FUNCTION public.can_access_investor(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_investor(text) TO authenticated;

DROP POLICY IF EXISTS "Autenticados leem mensagens do CRM" ON public.crm_messages;
DROP POLICY IF EXISTS "Autenticados registram mensagens do CRM" ON public.crm_messages;
CREATE POLICY "Responsavel ou gestao le mensagens" ON public.crm_messages
  FOR SELECT TO authenticated
  USING (public.can_access_investor(investor_id));
CREATE POLICY "Responsavel ou gestao registra mensagens" ON public.crm_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_investor(investor_id) AND author_id IS NOT NULL);

DROP POLICY IF EXISTS "Autenticados leem a timeline do CRM" ON public.crm_timeline;
DROP POLICY IF EXISTS "Autenticados registram a timeline do CRM" ON public.crm_timeline;
CREATE POLICY "Responsavel ou gestao le a timeline" ON public.crm_timeline
  FOR SELECT TO authenticated
  USING (public.can_access_investor(investor_id));
CREATE POLICY "Responsavel ou gestao registra a timeline" ON public.crm_timeline
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_investor(investor_id));

-- Funções SECURITY DEFINER: execução mínima necessária
REVOKE ALL ON FUNCTION public.grant_admin_for_official_executive() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.current_executive_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_executive_id() TO authenticated;
