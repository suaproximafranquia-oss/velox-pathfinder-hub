DROP POLICY IF EXISTS "Leads visiveis ao responsavel ou admin" ON public.portal_leads;
CREATE POLICY "Leads visiveis ao responsavel gestora ou admin"
ON public.portal_leads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (responsible_executive_id IS NOT NULL AND responsible_executive_id = current_executive_id())
  OR (has_role(auth.uid(), 'manager'::app_role) AND responsible_executive_id IS NOT NULL)
);