-- Função de escopo do E0: reaproveita a identidade oficial do servidor
-- (auth.uid() -> executive_profiles -> executive_id) e o escopo já
-- definido para investidores (can_access_investor sobre portal_leads).
CREATE OR REPLACE FUNCTION public.can_access_e0_action(_responsible_executive_id text, _card_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR (
        _responsible_executive_id IS NOT NULL
        AND _responsible_executive_id = public.current_executive_id()
      )
      OR (
        _card_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.portal_leads l
          WHERE l.id = _card_id
            AND l.responsible_executive_id IS NOT NULL
            AND l.responsible_executive_id = public.current_executive_id()
        )
      );
$$;

-- INVESTOR_NOTES ------------------------------------------------------
DROP POLICY IF EXISTS "Equipe autenticada le notas do investidor" ON public.investor_notes;
DROP POLICY IF EXISTS "Equipe autenticada cria notas do investidor" ON public.investor_notes;

CREATE POLICY "Notas visiveis no escopo do investidor"
ON public.investor_notes
FOR SELECT
TO authenticated
USING (public.can_access_investor(lead_id));

CREATE POLICY "Notas criadas no escopo do investidor"
ON public.investor_notes
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_investor(lead_id)
  AND (author_user_id IS NULL OR author_user_id = auth.uid())
);

-- WORKSPACE_E0_ACTIONS ------------------------------------------------
DROP POLICY IF EXISTS "e0 actions readable by authenticated" ON public.workspace_e0_actions;
DROP POLICY IF EXISTS "e0 actions writable by authenticated" ON public.workspace_e0_actions;
DROP POLICY IF EXISTS "e0 actions updatable by authenticated" ON public.workspace_e0_actions;

CREATE POLICY "E0 visivel no escopo do executivo"
ON public.workspace_e0_actions
FOR SELECT
TO authenticated
USING (public.can_access_e0_action(responsible_executive_id, card_id));

CREATE POLICY "E0 criada no escopo do executivo"
ON public.workspace_e0_actions
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_e0_action(responsible_executive_id, card_id));

CREATE POLICY "E0 atualizada no escopo do executivo"
ON public.workspace_e0_actions
FOR UPDATE
TO authenticated
USING (public.can_access_e0_action(responsible_executive_id, card_id))
WITH CHECK (public.can_access_e0_action(responsible_executive_id, card_id));