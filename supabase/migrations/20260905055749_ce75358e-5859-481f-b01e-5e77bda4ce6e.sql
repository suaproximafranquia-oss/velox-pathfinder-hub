ALTER TABLE public.crm_cadence_tasks
  ADD COLUMN IF NOT EXISTS responsible_executive_id text;

COMMENT ON COLUMN public.crm_cadence_tasks.responsible_executive_id IS
  'Snapshot HISTÓRICO: executivo responsável pelo lead no NASCIMENTO da obrigação de ligação. Nunca recalculado; NULL em tarefas anteriores (sem backfill).';

CREATE INDEX IF NOT EXISTS crm_cadence_tasks_responsible_idx
  ON public.crm_cadence_tasks (responsible_executive_id, due_date DESC);

CREATE INDEX IF NOT EXISTS crm_cadence_tasks_status_due_idx
  ON public.crm_cadence_tasks (status, due_date DESC);

CREATE INDEX IF NOT EXISTS crm_cadence_tasks_completed_idx
  ON public.crm_cadence_tasks (completed_at DESC);

CREATE OR REPLACE FUNCTION public.crm_cadence_tasks_freeze_responsible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- O responsável histórico é imutável: qualquer UPDATE restaura o valor
  -- gravado no nascimento da obrigação (inclusive NULL de tarefas antigas).
  NEW.responsible_executive_id := OLD.responsible_executive_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_cadence_tasks_freeze_responsible() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_cadence_tasks_freeze_responsible_trg ON public.crm_cadence_tasks;
CREATE TRIGGER crm_cadence_tasks_freeze_responsible_trg
  BEFORE UPDATE ON public.crm_cadence_tasks
  FOR EACH ROW EXECUTE FUNCTION public.crm_cadence_tasks_freeze_responsible();