ALTER TABLE public.crm_automation_settings ADD COLUMN IF NOT EXISTS cadence_activation_date date;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS external_status text;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS entered_entry_stage_at timestamptz;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS remarketing boolean NOT NULL DEFAULT false;