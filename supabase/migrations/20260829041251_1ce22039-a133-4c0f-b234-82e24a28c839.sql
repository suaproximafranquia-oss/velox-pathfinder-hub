ALTER TABLE public.group_unit_leads
  ADD COLUMN IF NOT EXISTS from_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_contact_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS first_contact_at timestamptz;

DROP POLICY IF EXISTS "Workspace autenticado gerencia interessados das unidades" ON public.group_unit_leads;

CREATE POLICY "Administracao le interessados das unidades"
ON public.group_unit_leads
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Administracao atualiza interessados das unidades"
ON public.group_unit_leads
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

GRANT SELECT, UPDATE ON public.group_unit_leads TO authenticated;
GRANT ALL ON public.group_unit_leads TO service_role;