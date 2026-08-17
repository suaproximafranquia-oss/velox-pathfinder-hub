-- Helpers ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_portal_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.executive_profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager');
$$;

CREATE OR REPLACE FUNCTION public.can_access_relationship(_scope text, _lead_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _scope = 'homologation'
      THEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    ELSE public.can_access_investor(_lead_id)
  END;
$$;

REVOKE ALL ON FUNCTION public.is_portal_member() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_relationship(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_portal_member() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_relationship(text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_investor(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_executive_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_investor(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_executive_id() TO authenticated, service_role;

-- Engajamento e jornada -----------------------------------------------------
DROP POLICY IF EXISTS "Equipe autenticada consulta o engajamento" ON public.portal_engagement;
CREATE POLICY "Engajamento visivel ao responsavel ou gestao"
  ON public.portal_engagement FOR SELECT TO authenticated
  USING (public.can_access_investor(investor_id));

DROP POLICY IF EXISTS "Equipe autenticada consulta eventos da jornada" ON public.portal_journey_events;
CREATE POLICY "Jornada visivel ao responsavel ou gestao"
  ON public.portal_journey_events FOR SELECT TO authenticated
  USING (public.can_access_investor(investor_id));

-- Motor de relacionamento ---------------------------------------------------
DROP POLICY IF EXISTS "Equipe autenticada consulta cadências" ON public.relationship_cadences;
CREATE POLICY "Cadencias por escopo e responsavel"
  ON public.relationship_cadences FOR SELECT TO authenticated
  USING (public.can_access_relationship(scope, lead_id));

DROP POLICY IF EXISTS "Equipe autenticada consulta eventos" ON public.relationship_events;
CREATE POLICY "Eventos por escopo e responsavel"
  ON public.relationship_events FOR SELECT TO authenticated
  USING (public.can_access_relationship(scope, lead_id));

DROP POLICY IF EXISTS "Equipe autenticada consulta fila" ON public.relationship_queue;
CREATE POLICY "Fila por escopo e responsavel"
  ON public.relationship_queue FOR SELECT TO authenticated
  USING (public.can_access_relationship(scope, lead_id));

DROP POLICY IF EXISTS "Equipe autenticada consulta decisões" ON public.relationship_decisions;
CREATE POLICY "Decisoes por escopo e responsavel"
  ON public.relationship_decisions FOR SELECT TO authenticated
  USING (public.can_access_relationship(scope, lead_id));

DROP POLICY IF EXISTS "Equipe autenticada consulta log do motor" ON public.relationship_engine_log;
CREATE POLICY "Log do motor restrito a gestao"
  ON public.relationship_engine_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Equipe autenticada consulta vínculos" ON public.relationship_template_bindings;
CREATE POLICY "Vinculos de template restritos a gestao"
  ON public.relationship_template_bindings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Equipe autenticada consulta conteúdos" ON public.relationship_contents;
CREATE POLICY "Biblioteca visivel a colaboradores cadastrados"
  ON public.relationship_contents FOR SELECT TO authenticated
  USING (public.is_portal_member());

-- Tabelas de negocio / conteudo --------------------------------------------
DROP POLICY IF EXISTS "Equipe autenticada le campanhas" ON public.campaigns;
CREATE POLICY "Campanhas visiveis a colaboradores" ON public.campaigns
  FOR SELECT TO authenticated USING (public.is_portal_member());

DROP POLICY IF EXISTS "Equipe autenticada le o cache de artes" ON public.creative_art_cache;
CREATE POLICY "Cache de artes visivel a colaboradores" ON public.creative_art_cache
  FOR SELECT TO authenticated USING (public.is_portal_member());

DROP POLICY IF EXISTS "Equipe autenticada le o modelo oficial" ON public.creative_official_model;
CREATE POLICY "Modelo oficial visivel a colaboradores" ON public.creative_official_model
  FOR SELECT TO authenticated USING (public.is_portal_member());

DROP POLICY IF EXISTS "creative_templates_read" ON public.creative_templates;
CREATE POLICY "creative_templates_read" ON public.creative_templates
  FOR SELECT TO authenticated USING (public.is_portal_member());

DROP POLICY IF EXISTS "Autenticados leem templates Meta" ON public.crm_meta_templates;
CREATE POLICY "Colaboradores leem templates Meta" ON public.crm_meta_templates
  FOR SELECT TO authenticated USING (public.is_portal_member());

DROP POLICY IF EXISTS "Equipe autenticada le a base oficial" ON public.knowledge_documents;
CREATE POLICY "Base oficial visivel a colaboradores" ON public.knowledge_documents
  FOR SELECT TO authenticated USING (public.is_portal_member());

DROP POLICY IF EXISTS "Equipe autenticada le templates" ON public.meta_templates;
CREATE POLICY "Templates visiveis a colaboradores" ON public.meta_templates
  FOR SELECT TO authenticated USING (public.is_portal_member());

DROP POLICY IF EXISTS "Equipe autenticada le o feed" ON public.news_posts;
CREATE POLICY "Feed visivel a colaboradores" ON public.news_posts
  FOR SELECT TO authenticated USING (public.is_portal_member());

-- Storage: bucket privado da Biblioteca -------------------------------------
DROP POLICY IF EXISTS "Biblioteca privada leitura colaboradores" ON storage.objects;
CREATE POLICY "Biblioteca privada leitura colaboradores" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'biblioteca-conteudos' AND public.is_portal_member());

DROP POLICY IF EXISTS "Biblioteca privada escrita gestao" ON storage.objects;
CREATE POLICY "Biblioteca privada escrita gestao" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'biblioteca-conteudos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')));

DROP POLICY IF EXISTS "Biblioteca privada atualizacao gestao" ON storage.objects;
CREATE POLICY "Biblioteca privada atualizacao gestao" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'biblioteca-conteudos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')))
  WITH CHECK (bucket_id = 'biblioteca-conteudos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')));

DROP POLICY IF EXISTS "Biblioteca privada remocao gestao" ON storage.objects;
CREATE POLICY "Biblioteca privada remocao gestao" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'biblioteca-conteudos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')));