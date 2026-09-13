ALTER TABLE public.crm_automation_settings
  ADD COLUMN IF NOT EXISTS portal_modules jsonb NOT NULL DEFAULT '{"manual":true,"universo":true,"simulador":true,"estrutura":false,"revista":false,"principios":false}'::jsonb;

GRANT SELECT (portal_modules) ON public.crm_automation_settings TO anon;

CREATE POLICY "Publico consulta modulos visiveis do portal"
  ON public.crm_automation_settings
  FOR SELECT
  TO anon
  USING (id = true);

COMMENT ON COLUMN public.crm_automation_settings.portal_modules IS
  'Visibilidade individual dos seis cards do Portal do Investidor da Financeira.';