GRANT INSERT ON public.group_unit_lead_events TO authenticated;

DROP POLICY IF EXISTS "Administracao registra historico das unidades" ON public.group_unit_lead_events;
CREATE POLICY "Administracao registra historico das unidades"
  ON public.group_unit_lead_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));