DROP POLICY "Equipe autenticada mantem o modelo oficial" ON public.creative_official_model;
CREATE POLICY "Equipe registra o modelo oficial" ON public.creative_official_model FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Autor substitui o modelo oficial" ON public.creative_official_model FOR UPDATE TO authenticated USING (uploaded_by = auth.uid()) WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Autor remove o modelo oficial" ON public.creative_official_model FOR DELETE TO authenticated USING (uploaded_by = auth.uid());