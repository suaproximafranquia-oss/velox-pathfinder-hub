ALTER TABLE public.crm_cadence_tasks ADD COLUMN IF NOT EXISTS cycle_date date NOT NULL DEFAULT '1970-01-01';
ALTER TABLE public.crm_cadence_tasks DROP CONSTRAINT IF EXISTS crm_cadence_tasks_lead_id_channel_step_day_key;
CREATE UNIQUE INDEX IF NOT EXISTS crm_cadence_tasks_cycle_step_key ON public.crm_cadence_tasks (lead_id, channel, cycle_date, step_day);