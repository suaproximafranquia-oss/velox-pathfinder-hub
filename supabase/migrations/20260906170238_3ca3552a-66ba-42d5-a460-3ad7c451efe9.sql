-- Portal dos Leads /f — recorte de leitura por titularidade do card.
-- Nada além das políticas de SELECT é alterado.

CREATE OR REPLACE FUNCTION public.can_read_crm_lead(_external_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.portal_leads p
      WHERE p.external_id = _external_id
        AND p.responsible_executive_id IS NOT NULL
        AND p.responsible_executive_id = public.current_executive_id()
    )
$$;

DROP POLICY IF EXISTS crm_leads_read ON public.crm_leads;
CREATE POLICY crm_leads_read
ON public.crm_leads
FOR SELECT
TO authenticated
USING (public.can_read_crm_lead(external_id));

DROP POLICY IF EXISTS crm_lead_events_read ON public.crm_lead_events;
CREATE POLICY crm_lead_events_read
ON public.crm_lead_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.crm_leads l
    WHERE l.id = crm_lead_events.lead_id
      AND public.can_read_crm_lead(l.external_id)
  )
);
