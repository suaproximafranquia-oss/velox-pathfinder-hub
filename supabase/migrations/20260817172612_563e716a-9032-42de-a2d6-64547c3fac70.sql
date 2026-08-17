ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS stage_entered_at timestamp with time zone;
ALTER TABLE public.crm_cadence_tasks ADD COLUMN IF NOT EXISTS outcome text;
UPDATE public.crm_cadence_tasks SET outcome = 'SIM' WHERE outcome IS NULL AND status = 'DONE';