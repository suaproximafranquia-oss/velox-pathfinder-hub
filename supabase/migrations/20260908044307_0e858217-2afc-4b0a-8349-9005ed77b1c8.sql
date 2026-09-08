DROP INDEX IF EXISTS public.relationship_queue_step;

CREATE UNIQUE INDEX IF NOT EXISTS relationship_queue_step_action
  ON public.relationship_queue (scope, run_id, lead_id, step, action_order)
  NULLS NOT DISTINCT;