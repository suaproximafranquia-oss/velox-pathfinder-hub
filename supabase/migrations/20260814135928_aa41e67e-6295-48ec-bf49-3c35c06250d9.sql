CREATE TABLE public.crm_cadence_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'call',
  step_day integer NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'DONE',
  completed_at timestamptz,
  completed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, channel, step_day)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_cadence_tasks TO authenticated;
GRANT ALL ON public.crm_cadence_tasks TO service_role;

ALTER TABLE public.crm_cadence_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestao le tarefas de cadencia"
ON public.crm_cadence_tasks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Gestao registra tarefas de cadencia"
ON public.crm_cadence_tasks FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Gestao atualiza tarefas de cadencia"
ON public.crm_cadence_tasks FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE INDEX crm_cadence_tasks_lead_idx ON public.crm_cadence_tasks (lead_id, channel);

CREATE TRIGGER update_crm_cadence_tasks_updated_at
BEFORE UPDATE ON public.crm_cadence_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();