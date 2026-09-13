DROP POLICY IF EXISTS "Publico consulta modulos visiveis do portal" ON public.crm_automation_settings;
REVOKE SELECT (portal_modules) ON public.crm_automation_settings FROM anon;

CREATE OR REPLACE VIEW public.portal_module_visibility
WITH (security_barrier = true)
AS
SELECT portal_modules
FROM public.crm_automation_settings
WHERE id = true;

REVOKE ALL ON public.portal_module_visibility FROM PUBLIC;
GRANT SELECT ON public.portal_module_visibility TO anon, authenticated;

COMMENT ON VIEW public.portal_module_visibility IS
  'Leitura pública limitada à visibilidade dos cards do Portal do Investidor.';