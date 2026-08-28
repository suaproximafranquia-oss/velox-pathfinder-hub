ALTER TABLE public.crm_cadence_tasks ADD COLUMN IF NOT EXISTS step_key text;
UPDATE public.crm_cadence_tasks SET step_key = 'L' || step_day::text WHERE step_key IS NULL;
CREATE INDEX IF NOT EXISTS crm_cadence_tasks_step_key_idx ON public.crm_cadence_tasks (step_key);