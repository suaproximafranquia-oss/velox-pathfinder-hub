CREATE TABLE public.kpi_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  executive_id text NOT NULL,
  month_key text NOT NULL,
  indicator_id text NOT NULL,
  day integer NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kpi_entries_unique_cell UNIQUE (executive_id, month_key, indicator_id, day)
);

GRANT ALL ON public.kpi_entries TO service_role;

ALTER TABLE public.kpi_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX kpi_entries_exec_month_idx ON public.kpi_entries (executive_id, month_key);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_kpi_entries_updated_at
BEFORE UPDATE ON public.kpi_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();