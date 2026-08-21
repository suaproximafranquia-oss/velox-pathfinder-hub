-- Índices de unicidade compatíveis com a gravação do motor.
DROP INDEX IF EXISTS public.relationship_cadences_key;
CREATE UNIQUE INDEX relationship_cadences_key
  ON public.relationship_cadences (scope, run_id, lead_id) NULLS NOT DISTINCT;

DROP INDEX IF EXISTS public.relationship_queue_step;
CREATE UNIQUE INDEX relationship_queue_step
  ON public.relationship_queue (scope, run_id, lead_id, step) NULLS NOT DISTINCT;