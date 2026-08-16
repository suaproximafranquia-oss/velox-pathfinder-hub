CREATE TABLE public.relationship_sim_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL UNIQUE,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'COMPLETED',
  total_leads integer NOT NULL DEFAULT 0,
  passed integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  messages_count integer NOT NULL DEFAULT 0,
  outside_hours integer NOT NULL DEFAULT 0,
  scenario_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.relationship_sim_runs TO authenticated;
GRANT ALL ON public.relationship_sim_runs TO service_role;

ALTER TABLE public.relationship_sim_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores leem rodadas de homologacao"
ON public.relationship_sim_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));