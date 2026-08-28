ALTER TABLE public.crm_messages ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT false;
ALTER TABLE public.crm_timeline ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT false;