ALTER TABLE public.crm_automation_settings
  ADD COLUMN IF NOT EXISTS first_contact_mode text NOT NULL DEFAULT 'automatico';

ALTER TABLE public.crm_automation_settings
  DROP CONSTRAINT IF EXISTS crm_automation_settings_first_contact_mode_check;
ALTER TABLE public.crm_automation_settings
  ADD CONSTRAINT crm_automation_settings_first_contact_mode_check
  CHECK (first_contact_mode IN ('automatico','manual'));

CREATE TABLE IF NOT EXISTS public.workspace_e0_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id text NOT NULL UNIQUE,
  crm_lead_id uuid,
  origin text NOT NULL DEFAULT 'greensales',
  lead_name text,
  lead_whatsapp text,
  responsible_executive_id text,
  state text NOT NULL DEFAULT 'PENDENTE',
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  executed_by text,
  executed_by_user_id uuid,
  result text,
  note text,
  CONSTRAINT workspace_e0_actions_state_check CHECK (state IN ('PENDENTE','EXECUTADA','CANCELADA'))
);

GRANT SELECT, INSERT, UPDATE ON public.workspace_e0_actions TO authenticated;
GRANT ALL ON public.workspace_e0_actions TO service_role;

ALTER TABLE public.workspace_e0_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "e0 actions readable by authenticated" ON public.workspace_e0_actions;
CREATE POLICY "e0 actions readable by authenticated"
  ON public.workspace_e0_actions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "e0 actions writable by authenticated" ON public.workspace_e0_actions;
CREATE POLICY "e0 actions writable by authenticated"
  ON public.workspace_e0_actions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "e0 actions updatable by authenticated" ON public.workspace_e0_actions;
CREATE POLICY "e0 actions updatable by authenticated"
  ON public.workspace_e0_actions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS workspace_e0_actions_state_idx
  ON public.workspace_e0_actions (state, created_at);